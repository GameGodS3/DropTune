const CHUNK_SIZE = 64 * 1024; // 64 KB

export type SendSignalFn = (targetPeerId: string, signal: unknown) => void;

type WireSignal =
  | { type: "offer"; sdp: RTCSessionDescriptionInit }
  | { type: "answer"; sdp: RTCSessionDescriptionInit }
  | { type: "ice"; candidate: RTCIceCandidateInit };

interface ReceiverSession {
  pc: RTCPeerConnection;
  resolve: (blob: Blob) => void;
  reject: (err: Error) => void;
  onProgress: (pct: number) => void;
  mimeType: string;
  totalSize: number;
  received: number;
  chunks: ArrayBuffer[];
  // ICE candidates buffered until answer's remote description is set
  remoteDescSet: boolean;
  pendingCandidates: RTCIceCandidateInit[];
}

interface SenderSession {
  pc: RTCPeerConnection;
  sendSignal: SendSignalFn;
  // ICE candidates buffered until offer's remote description is set
  remoteDescSet: boolean;
  pendingCandidates: RTCIceCandidateInit[];
}

class TransferManager {
  // HOST side: keyed by sourcePeerId
  private receivers = new Map<string, ReceiverSession>();
  // SOURCE side: keyed by requesterPeerId (the host)
  private senders = new Map<string, SenderSession>();

  /**
   * HOST calls this after receiving FILE_AVAILABLE.
   * Creates RTCPeerConnection + DataChannel, sends the SDP offer,
   * and returns a Promise that resolves with the complete Blob.
   */
  requestFile(
    sourcePeerId: string,
    sendSignal: SendSignalFn,
    onProgress: (pct: number) => void
  ): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const pc = new RTCPeerConnection({ iceServers: [] });
      const channel = pc.createDataChannel("xfer", { ordered: true });
      channel.binaryType = "arraybuffer";

      const session: ReceiverSession = {
        pc, resolve, reject, onProgress,
        mimeType: "audio/mpeg",
        totalSize: 0, received: 0, chunks: [],
        remoteDescSet: false, pendingCandidates: []
      };
      this.receivers.set(sourcePeerId, session);

      channel.onmessage = (evt) => this._onReceiverMessage(sourcePeerId, session, evt);

      // Only "failed" is an error — "closed" is normal after a successful transfer.
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed") {
          this.receivers.delete(sourcePeerId);
          reject(new Error("WebRTC connection failed — no valid ICE path found"));
        }
      };

      pc.onicecandidate = ({ candidate }) => {
        if (candidate) sendSignal(sourcePeerId, { type: "ice", candidate: candidate.toJSON() });
      };

      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .then(() => sendSignal(sourcePeerId, { type: "offer", sdp: pc.localDescription! }))
        .catch((err: Error) => {
          this.receivers.delete(sourcePeerId);
          reject(err);
        });
    });
  }

  private _onReceiverMessage(
    sourcePeerId: string,
    session: ReceiverSession,
    evt: MessageEvent
  ): void {
    if (typeof evt.data === "string") {
      const msg = JSON.parse(evt.data) as { type: string; totalSize?: number; mimeType?: string };
      if (msg.type === "meta") {
        session.totalSize = msg.totalSize ?? 0;
        session.mimeType = msg.mimeType ?? "audio/mpeg";
      } else if (msg.type === "done") {
        const blob = new Blob(session.chunks, { type: session.mimeType });
        // Delete + resolve BEFORE closing the PC so onconnectionstatechange("closed")
        // cannot fire reject() and win the race against resolve().
        this.receivers.delete(sourcePeerId);
        session.resolve(blob);
        session.pc.close();
      }
    } else {
      session.chunks.push(evt.data as ArrayBuffer);
      session.received += (evt.data as ArrayBuffer).byteLength;
      if (session.totalSize > 0) {
        session.onProgress(Math.min(99, Math.round((session.received / session.totalSize) * 100)));
      }
    }
  }

  /**
   * SOURCE calls this after receiving FILE_REQUEST.
   * Sets up RTCPeerConnection ready to accept the host's SDP offer.
   */
  prepareToSend(hostPeerId: string, file: File, sendSignal: SendSignalFn): void {
    if (this.senders.has(hostPeerId)) return;

    const pc = new RTCPeerConnection({ iceServers: [] });
    const session: SenderSession = {
      pc, sendSignal,
      remoteDescSet: false, pendingCandidates: []
    };
    this.senders.set(hostPeerId, session);

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) sendSignal(hostPeerId, { type: "ice", candidate: candidate.toJSON() });
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "closed") {
        this.senders.delete(hostPeerId);
      }
    };

    pc.ondatachannel = ({ channel }) => {
      channel.binaryType = "arraybuffer";
      channel.onopen = () => this._sendFile(hostPeerId, channel, file);
    };
  }

  private _sendFile(hostPeerId: string, channel: RTCDataChannel, file: File): void {
    channel.send(JSON.stringify({
      type: "meta",
      totalSize: file.size,
      mimeType: file.type || "audio/mpeg"
    }));

    let offset = 0;
    const sendNext = (): void => {
      if (offset >= file.size) {
        channel.send(JSON.stringify({ type: "done" }));
        // Do NOT close the channel or PC here. Calling pc.close() immediately
        // after channel.send() aborts the SCTP buffer and drops the "done"
        // message before it is transmitted. HOST closes its PC upon receiving
        // "done"; SOURCE's onconnectionstatechange("closed") then fires and
        // cleans up the sender session.
        return;
      }

      // Back-pressure: wait for buffer to drain before sending more.
      if (channel.bufferedAmount > CHUNK_SIZE * 8) {
        channel.bufferedAmountLowThreshold = CHUNK_SIZE * 2;
        channel.onbufferedamountlow = () => {
          channel.onbufferedamountlow = null;
          sendNext();
        };
        return;
      }

      const slice = file.slice(offset, offset + CHUNK_SIZE);
      void slice.arrayBuffer().then((buf) => {
        try {
          channel.send(buf);
          offset += buf.byteLength;
          sendNext();
        } catch {
          this.senders.delete(hostPeerId);
        }
      });
    };

    sendNext();
  }

  /**
   * Both HOST and SOURCE call this when they receive a WEBRTC_SIGNAL event.
   */
  handleSignal(fromPeerId: string, rawSignal: unknown): void {
    const signal = rawSignal as WireSignal;

    // HOST: receiving answer or ICE from the source.
    const receiver = this.receivers.get(fromPeerId);
    if (receiver) {
      if (signal.type === "answer") {
        receiver.pc.setRemoteDescription(signal.sdp)
          .then(() => {
            receiver.remoteDescSet = true;
            for (const c of receiver.pendingCandidates) {
              void receiver.pc.addIceCandidate(c);
            }
            receiver.pendingCandidates = [];
          })
          .catch(() => undefined);
      } else if (signal.type === "ice") {
        if (receiver.remoteDescSet) {
          void receiver.pc.addIceCandidate(signal.candidate);
        } else {
          receiver.pendingCandidates.push(signal.candidate);
        }
      }
      return;
    }

    // SOURCE: receiving offer or ICE from the host.
    const sender = this.senders.get(fromPeerId);
    if (sender) {
      if (signal.type === "offer") {
        sender.pc.setRemoteDescription(signal.sdp)
          .then(() => sender.pc.createAnswer())
          .then((answer) => sender.pc.setLocalDescription(answer))
          .then(() => {
            sender.sendSignal(fromPeerId, { type: "answer", sdp: sender.pc.localDescription! });
            sender.remoteDescSet = true;
            for (const c of sender.pendingCandidates) {
              void sender.pc.addIceCandidate(c);
            }
            sender.pendingCandidates = [];
          })
          .catch(() => this.senders.delete(fromPeerId));
      } else if (signal.type === "ice") {
        if (sender.remoteDescSet) {
          void sender.pc.addIceCandidate(signal.candidate);
        } else {
          sender.pendingCandidates.push(signal.candidate);
        }
      }
    }
  }

  cleanup(): void {
    for (const s of this.receivers.values()) s.pc.close();
    for (const s of this.senders.values()) s.pc.close();
    this.receivers.clear();
    this.senders.clear();
  }
}

export const transferManager = new TransferManager();
