import { useEffect, useMemo, useRef, useState } from "react";
import type { ControlPlaneEvent } from "@droptune/protocol";
import type { QueueItem, TrackMetadata } from "@droptune/shared-types";
import { buildTrackId, filterSupportedFiles, indexFiles } from "./lib/metadata";
import { makeId } from "./lib/id";
import { selectFilteredTracks, useLibraryStore } from "./stores/libraryStore";
import { usePeerStore } from "./stores/peerStore";
import { usePlaybackStore } from "./stores/playbackStore";
import { useQueueStore } from "./stores/queueStore";
import { useRoomStore } from "./stores/roomStore";

type ExtendedWindow = Window & {
  showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
};

async function listFilesFromHandle(
  dirHandle: FileSystemDirectoryHandle,
  pathPrefix = ""
): Promise<File[]> {
  const files: File[] = [];
  const iterator = (dirHandle as unknown as { values: () => AsyncIterable<FileSystemHandle> }).values();
  for await (const entry of iterator) {
    const nextPrefix = pathPrefix ? `${pathPrefix}/${entry.name}` : entry.name;
    if (entry.kind === "file") {
      const file = await (entry as FileSystemFileHandle).getFile();
      files.push(new File([file], nextPrefix, { type: file.type, lastModified: file.lastModified }));
    } else if (entry.kind === "directory") {
      files.push(...(await listFilesFromHandle(entry as FileSystemDirectoryHandle, nextPrefix)));
    }
  }
  return files;
}

function formatDuration(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return "00:00";
  const min = Math.floor(sec / 60);
  const rem = Math.floor(sec % 60);
  return `${String(min).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function App() {
  const coordinatorHost = window.location.hostname || "localhost";
  const coordinatorBaseUrl = `http://${coordinatorHost}:8787`;
  const wsUrl = `ws://${coordinatorHost}:8787/ws`;
  const wsRef = useRef<WebSocket | null>(null);

  const [rooms, setRooms] = useState<Array<{ roomId: string; roomName: string; participantCount: number }>>([]);
  const [roomNameInput, setRoomNameInput] = useState("Living Room");
  const [roomError, setRoomError] = useState<string | null>(null);
  const [indexError, setIndexError] = useState<string | null>(null);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [activeQueueItemId, setActiveQueueItemId] = useState<string | undefined>();
  const lastPlaybackEmitRef = useRef(0);

  const { tracks, localFiles, query, isIndexing, setQuery, setIndexing, upsertTracks, hydrate } =
    useLibraryStore();
  const filtered = useMemo(() => selectFilteredTracks(useLibraryStore.getState()), [tracks, query]);

  const { peerId, displayName } = usePeerStore();
  const roomStore = useRoomStore();
  const { queue, setQueue, addToQueue, removeFromQueue, moveQueueItem } = useQueueStore();
  const playback = usePlaybackStore();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    void refreshRooms();
    const timer = window.setInterval(() => void refreshRooms(), 3000);
    return () => window.clearInterval(timer);
  }, []);

  function emitPlaybackState() {
    if (!roomStore.roomId || !roomStore.isConnected) return;
    const audio = audioRef.current;
    if (!audio) return;
    sendEvent({
      type: "PLAYBACK_STATE",
      sentAt: Date.now(),
      payload: {
        roomId: roomStore.roomId,
        state: {
          status: playback.status,
          currentQueueItemId: activeQueueItemId,
          positionSec: audio.currentTime || playback.positionSec,
          durationSec: audio.duration || playback.durationSec,
          updatedAt: Date.now()
        }
      }
    });
  }

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTimeUpdate = () => {
      playback.setPosition(audio.currentTime);
      if (roomStore.isConnected && roomStore.roomId && Date.now() - lastPlaybackEmitRef.current > 1000) {
        lastPlaybackEmitRef.current = Date.now();
        emitPlaybackState();
      }
    };
    const onLoadedMetadata = () => playback.setDuration(audio.duration || 0);
    const onPlay = () => {
      playback.setStatus("playing");
      emitPlaybackState();
    };
    const onPause = () => {
      playback.setStatus("paused");
      emitPlaybackState();
    };
    const onEnded = () => {
      playback.setStatus("ended");
      emitPlaybackState();
      const currentIndex = queue.findIndex((item) => item.id === activeQueueItemId);
      if (currentIndex >= 0 && currentIndex < queue.length - 1) {
        void playQueueItem(queue[currentIndex + 1].id, true);
      }
    };
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
    };
  }, [playback, queue, activeQueueItemId, roomStore.isConnected, roomStore.roomId]);

  function sendEvent(event: ControlPlaneEvent) {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(event));
    }
  }

  function onRoomState(event: Extract<ControlPlaneEvent, { type: "ROOM_STATE" }>) {
    const { room } = event.payload;
    setQueue(room.queue);
    setActiveQueueItemId(room.playback.currentQueueItemId);
    playback.hydrateFromRemote({
      status: room.playback.status,
      positionSec: room.playback.positionSec,
      durationSec: room.playback.durationSec,
      currentTrackId: room.playback.currentQueueItemId
    });
    const host = room.participants.find((p) => p.isHost);
    roomStore.setPresence(room.participants.length, host?.peerId);
    roomStore.setRoom(room.roomId, room.roomName);

    const audio = audioRef.current;
    if (!audio) return;

    if (room.playback.status === "paused" && !audio.paused) {
      audio.pause();
    }

    if (room.playback.status === "playing" && room.playback.currentQueueItemId) {
      if (activeQueueItemId !== room.playback.currentQueueItemId) {
        void playQueueItem(room.playback.currentQueueItemId, false);
      } else if (audio.paused) {
        void audio.play().catch(() => undefined);
      }
    }

    if (Math.abs((audio.currentTime || 0) - room.playback.positionSec) > 1.5) {
      audio.currentTime = room.playback.positionSec;
    }
  }

  function connectRoom(roomId: string, roomName: string) {
    wsRef.current?.close();
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      roomStore.setRoom(roomId, roomName);
      roomStore.setConnected(true);
      const joinEvent: ControlPlaneEvent = {
        type: "JOIN_ROOM",
        sentAt: Date.now(),
        payload: { roomId, peerId, displayName }
      };
      ws.send(JSON.stringify(joinEvent));
    };

    ws.onmessage = (message) => {
      let event: ControlPlaneEvent;
      try {
        event = JSON.parse(String(message.data)) as ControlPlaneEvent;
      } catch {
        return;
      }
      if (event.type === "ROOM_STATE") onRoomState(event);
    };

    ws.onclose = () => {
      roomStore.setConnected(false);
    };
  }

  async function refreshRooms() {
    try {
      const response = await fetch(`${coordinatorBaseUrl}/rooms`);
      const data = (await response.json()) as { rooms: Array<{ roomId: string; roomName: string; participantCount: number }> };
      setRooms(data.rooms);
      setRoomError(null);
    } catch {
      setRoomError("Coordinator is not reachable. Start local coordinator to enable room sync.");
    }
  }

  async function createRoom() {
    setRoomError(null);
    try {
      const response = await fetch(`${coordinatorBaseUrl}/rooms/create`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ roomName: roomNameInput })
      });
      if (!response.ok) throw new Error("create room failed");
      const data = (await response.json()) as { roomId: string; roomName: string };
      await refreshRooms();
      connectRoom(data.roomId, data.roomName);
    } catch {
      setRoomError("Failed to create room");
    }
  }

  async function ingestFiles(files: File[]) {
    setIndexError(null);
    setIndexing(true);
    try {
      const supportedFiles = filterSupportedFiles(files);
      const importable = supportedFiles.map((file) => ({ id: makeId(), file }));
      const indexed = await indexFiles(peerId, importable);
      const rekeyed = indexed.map((track) => ({ ...track, id: buildTrackId(track) }));
      const fileMap = rekeyed.map((track, i) => ({ id: track.id, file: importable[i].file }));
      await upsertTracks(rekeyed, fileMap);
    } catch (error) {
      setIndexError(error instanceof Error ? error.message : "Failed to index files");
    } finally {
      setIndexing(false);
    }
  }

  async function onSelectFolder() {
    const win = window as ExtendedWindow;
    if (typeof win.showDirectoryPicker === "function") {
      try {
        const handle = await win.showDirectoryPicker();
        const files = await listFilesFromHandle(handle);
        await ingestFiles(files);
        return;
      } catch {
        // fallback selector below.
      }
    }
    inputRef.current?.click();
  }

  function resolvePlayableTrack(item: QueueItem): TrackMetadata | undefined {
    const exact = tracks.find((t) => t.id === item.trackId);
    if (exact) return exact;

    const target = tracks.find((candidate) => {
      const candidateId = buildTrackId(candidate);
      return candidateId === item.trackId;
    });
    if (target) return target;

    return undefined;
  }

  async function playTrack(track: TrackMetadata) {
    setPlaybackError(null);
    const file = localFiles[track.id];
    if (!file || !audioRef.current) {
      setPlaybackError("Track file is unavailable on this device. Re-index this folder on the current device.");
      return;
    }
    playback.setCurrentTrack(track.id);
    playback.setStatus("loading");
    const url = URL.createObjectURL(file);
    const audio = audioRef.current;
    audio.src = url;
    try {
      await audio.play();
    } catch (error) {
      setPlaybackError(error instanceof Error ? error.message : "Playback failed on this browser/device.");
      playback.setStatus("error");
    }
  }

  async function playQueueItem(queueItemId: string, emitPlayEvent = true) {
    const item = queue.find((q) => q.id === queueItemId);
    if (!item) return;
    const track = resolvePlayableTrack(item);
    if (!track) {
      setPlaybackError("No locally playable copy found for this queued track on current device.");
      return;
    }
    setActiveQueueItemId(queueItemId);
    if (emitPlayEvent && roomStore.roomId && roomStore.isConnected) {
      sendEvent({
        type: "PLAY",
        sentAt: Date.now(),
        payload: { roomId: roomStore.roomId, queueItemId }
      });
    }
    await playTrack(track);
  }

  function emitQueueAdd(trackId: string) {
    if (!roomStore.roomId || !roomStore.isConnected) {
      addToQueue(trackId, peerId);
      return;
    }
    const item: QueueItem = { id: makeId(), trackId, requestedBy: peerId, addedAt: Date.now() };
    const event: ControlPlaneEvent = {
      type: "QUEUE_ADD",
      sentAt: Date.now(),
      payload: { roomId: roomStore.roomId, item }
    };
    sendEvent(event);
  }

  function emitQueueRemove(queueItemId: string) {
    if (!roomStore.roomId || !roomStore.isConnected) {
      removeFromQueue(queueItemId);
      return;
    }
    sendEvent({
      type: "QUEUE_REMOVE",
      sentAt: Date.now(),
      payload: { roomId: roomStore.roomId, queueItemId }
    });
  }

  function emitQueueReorder(fromIndex: number, toIndex: number) {
    if (!roomStore.roomId || !roomStore.isConnected) {
      moveQueueItem(fromIndex, toIndex);
      return;
    }
    const reordered = [...queue];
    const [item] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, item);
    sendEvent({
      type: "QUEUE_REORDER",
      sentAt: Date.now(),
      payload: { roomId: roomStore.roomId, queue: reordered }
    });
  }

  function emitPause() {
    if (!roomStore.roomId || !roomStore.isConnected) {
      audioRef.current?.pause();
      return;
    }
    sendEvent({ type: "PAUSE", sentAt: Date.now(), payload: { roomId: roomStore.roomId } });
  }

  function emitSeek(positionSec: number) {
    if (!roomStore.roomId || !roomStore.isConnected) return;
    sendEvent({
      type: "SEEK",
      sentAt: Date.now(),
      payload: { roomId: roomStore.roomId, positionSec }
    });
  }

  return (
    <div className="mx-auto min-h-screen max-w-6xl p-6">
      <audio ref={audioRef} preload="metadata" />
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        // @ts-expect-error non-standard but required fallback.
        webkitdirectory="true"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          void ingestFiles(files);
        }}
      />

      <header className="mb-6">
        <h1 className="mb-4 text-2xl font-semibold">DropTune - Phase 2/3</h1>
        <div className="grid gap-3 rounded border border-slate-800 bg-slate-900 p-4 md:grid-cols-3">
          <div className="md:col-span-2">
            <p className="mb-2 text-sm text-slate-300">Nearby Rooms</p>
            <div className="flex flex-wrap gap-2">
              {rooms.map((room) => (
                <button
                  key={room.roomId}
                  type="button"
                  className="rounded border border-slate-700 bg-slate-950 px-3 py-1 text-sm hover:bg-slate-800"
                  onClick={() => connectRoom(room.roomId, room.roomName)}
                >
                  {room.roomName} ({room.participantCount})
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm text-slate-300">Create Room</p>
            <div className="flex gap-2">
              <input
                value={roomNameInput}
                onChange={(event) => setRoomNameInput(event.target.value)}
                className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm"
              />
              <button
                type="button"
                className="rounded bg-indigo-600 px-3 py-1 text-sm hover:bg-indigo-500"
                onClick={() => void createRoom()}
              >
                Create
              </button>
            </div>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-300">
          <span>Room: {roomStore.roomName ?? "Not connected"}</span>
          <span>Participants: {roomStore.participantCount}</span>
          <span>Host: {roomStore.hostPeerId ? roomStore.hostPeerId.slice(0, 8) : "-"}</span>
          <span>Socket: {roomStore.isConnected ? "Connected" : "Offline"}</span>
        </div>
        <div className="mt-4">
          <button
            type="button"
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500 disabled:opacity-50"
            onClick={() => void onSelectFolder()}
            disabled={isIndexing}
          >
            {isIndexing ? "Indexing..." : "Select Music Folder"}
          </button>
        </div>
      </header>

      {indexError ? <p className="mb-2 text-sm text-red-400">{indexError}</p> : null}
      {roomError ? <p className="mb-4 text-sm text-amber-400">{roomError}</p> : null}
      {playbackError ? <p className="mb-4 text-sm text-red-400">{playbackError}</p> : null}

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded border border-slate-800 bg-slate-900 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-medium">Library ({tracks.length})</h2>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search title, artist, album..."
              className="rounded border border-slate-700 bg-slate-950 px-3 py-1 text-sm text-slate-100"
            />
          </div>
          <div className="max-h-[65vh] overflow-auto space-y-2">
            {filtered.map((track) => (
              <article
                key={track.id}
                className="rounded border border-slate-800 bg-slate-950 p-3 text-sm"
              >
                <p className="font-medium">{track.title}</p>
                <p className="text-slate-300">{track.artist ?? "Unknown artist"}</p>
                <p className="text-xs text-slate-400">
                  {track.album ?? "Unknown album"} | {formatDuration(track.durationSec)} |{" "}
                  {formatSize(track.sizeBytes)}
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    className="rounded bg-slate-700 px-2 py-1 hover:bg-slate-600"
                    onClick={() => void playTrack(track)}
                  >
                    Play
                  </button>
                  <button
                    type="button"
                    className="rounded bg-emerald-700 px-2 py-1 hover:bg-emerald-600"
                    onClick={() => emitQueueAdd(track.id)}
                  >
                    Queue
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded border border-slate-800 bg-slate-900 p-4">
          <h2 className="mb-3 text-lg font-medium">Queue ({queue.length})</h2>
          <div className="mb-4 space-y-2">
            {queue.map((item, index) => {
              const track = tracks.find((t) => t.id === item.trackId);
              if (!track) return null;
              return (
                <article key={item.id} className="rounded border border-slate-800 bg-slate-950 p-3 text-sm">
                  <p className="font-medium">{track.title}</p>
                  <p className="text-slate-300">{track.artist ?? "Unknown artist"}</p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      className="rounded bg-blue-700 px-2 py-1 hover:bg-blue-600"
                      onClick={() => void playQueueItem(item.id)}
                    >
                      Play now
                    </button>
                    <button
                      type="button"
                      className="rounded bg-slate-700 px-2 py-1 hover:bg-slate-600 disabled:opacity-40"
                      disabled={index === 0}
                      onClick={() => emitQueueReorder(index, index - 1)}
                    >
                      Up
                    </button>
                    <button
                      type="button"
                      className="rounded bg-slate-700 px-2 py-1 hover:bg-slate-600 disabled:opacity-40"
                      disabled={index === queue.length - 1}
                      onClick={() => emitQueueReorder(index, index + 1)}
                    >
                      Down
                    </button>
                    <button
                      type="button"
                      className="rounded bg-red-700 px-2 py-1 hover:bg-red-600"
                      onClick={() => emitQueueRemove(item.id)}
                    >
                      Remove
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="rounded border border-slate-800 bg-slate-950 p-3 text-sm">
            <p className="font-medium">Playback</p>
            <p>Status: {playback.status}</p>
            <p>
              Position: {formatDuration(playback.positionSec)} / {formatDuration(playback.durationSec)}
            </p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                className="rounded bg-slate-700 px-2 py-1 hover:bg-slate-600"
                onClick={() => {
                  if (activeQueueItemId) {
                    void playQueueItem(activeQueueItemId, true);
                  } else {
                    void audioRef.current?.play();
                  }
                }}
              >
                Resume
              </button>
              <button
                type="button"
                className="rounded bg-slate-700 px-2 py-1 hover:bg-slate-600"
                onClick={() => emitPause()}
              >
                Pause
              </button>
              <button
                type="button"
                className="rounded bg-slate-700 px-2 py-1 hover:bg-slate-600"
                onClick={() => {
                  const nextPos = Math.max(0, (audioRef.current?.currentTime ?? 0) - 10);
                  if (audioRef.current) audioRef.current.currentTime = nextPos;
                  emitSeek(nextPos);
                }}
              >
                -10s
              </button>
              <button
                type="button"
                className="rounded bg-slate-700 px-2 py-1 hover:bg-slate-600"
                onClick={() => {
                  const current = audioRef.current?.currentTime ?? 0;
                  const duration = audioRef.current?.duration ?? playback.durationSec;
                  const nextPos = Math.min(duration || current + 10, current + 10);
                  if (audioRef.current) audioRef.current.currentTime = nextPos;
                  emitSeek(nextPos);
                }}
              >
                +10s
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
