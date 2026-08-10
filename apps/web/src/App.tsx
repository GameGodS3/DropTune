import { useEffect, useMemo, useRef, useState } from "react";
import qrcode from "qrcode-generator";
import type { ControlPlaneEvent } from "@droptune/protocol";
import type { QueueItem, RoomParticipant, TrackMetadata, TrackSnapshot } from "@droptune/shared-types";
import { buildTrackId, filterSupportedFiles, indexFiles } from "./lib/metadata";
import { makeId } from "./lib/id";
import { transferManager } from "./lib/transfer";
import type { SendSignalFn } from "./lib/transfer";
import { useLibraryStore } from "./stores/libraryStore";
import { usePeerStore } from "./stores/peerStore";
import { usePlaybackStore } from "./stores/playbackStore";
import { useQueueStore } from "./stores/queueStore";
import { useRoomStore } from "./stores/roomStore";
import { useTransferStore } from "./stores/transferStore";
import {
  IconPlay, IconPause, IconNext, IconPrev, IconSearch, IconClose,
  IconChevDown, IconChevRight, IconLibrary, IconUsers, IconShare,
  IconQr, IconPlus, IconQueue, IconTrash, IconArrowUp, IconArrowDown,
  IconGrip, IconMore, IconCopy, IconFolder, IconFolderPlus,
  IconWifi, IconShuffle, IconRepeat, IconDownload, IconHost,
  IconCheck, IconMusic, IconHeart,
} from "./components/icons";

// ─── types ───────────────────────────────────────────────────────────────────

interface UITrack {
  id: string;
  title: string;
  artist?: string;
  album?: string;
  durationSec: number;
  gradIdx: number;
  isLocal: boolean;
  sizeBytes?: number;
}

interface UIPeer {
  id: string;
  name: string;
  short: string;
  colorIdx: number;
  isYou: boolean;
  online: boolean;
  isHost: boolean;
}

interface UITransfer {
  trackId: string;
  sourcePeerId: string;
  progress: number;
  status: string;
}

interface IndexedFolder {
  id: string;
  name: string;
  tracks: number;
  size: string;
}

interface NearbyRoom {
  roomId: string;
  roomName: string;
  participantCount: number;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function toGradIdx(id: string): number { return hashStr(id) % 10; }
function toPeerColorIdx(id: string): number { return hashStr(id) % 6; }
function toPeerShort(name: string): string {
  return name.split(" ").map((w) => w[0] ?? "").join("").slice(0, 2).toUpperCase() || "??";
}

function fmtTime(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── QR renderer ─────────────────────────────────────────────────────────────

function renderQR(text: string) {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  const moduleCount = qr.getModuleCount();
  const margin = 2;
  const size = moduleCount + margin * 2;
  const rects: JSX.Element[] = [];
  for (let r = 0; r < moduleCount; r++) {
    for (let c = 0; c < moduleCount; c++) {
      if (qr.isDark(r, c)) {
        rects.push(
          <rect key={`${r}-${c}`} x={c + margin} y={r + margin} width={1.04} height={1.04} rx={0.2} />
        );
      }
    }
  }
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${size} ${size}`} shapeRendering="crispEdges" fill="currentColor">
      {rects}
    </svg>
  );
}

// ─── shared sub-components ───────────────────────────────────────────────────

function PeerAvatar({ peer, size = 40, withHostRing = false }: { peer: UIPeer | undefined; size?: number; withHostRing?: boolean }) {
  if (!peer) return null;
  const style = { width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.36)) };
  return (
    <div className="dt-peer-avatar-wrap">
      <div className={`dt-peer-avatar dt-peer-${peer.colorIdx}`} style={style}>{peer.short}</div>
      {withHostRing && <div className="dt-peer-avatar-host-ring" />}
    </div>
  );
}

function TrackArt({ track, size = 48, radius = 10 }: { track: UITrack; size?: number; radius?: number }) {
  const letter = (track.title || "?").trim().charAt(0).toUpperCase();
  const style = { width: size, height: size, borderRadius: radius };
  return (
    <div className="dt-track-art" style={style}>
      <div className={`dt-track-art-gradient dt-art-grad-${track.gradIdx}`} />
      <div className="dt-track-art-letter" style={{ fontSize: Math.round(size * 0.42) }}>{letter}</div>
    </div>
  );
}

function SourcePeerChip({ peer, extraOwners = 0 }: { peer: UIPeer | undefined; extraOwners?: number }) {
  if (!peer) return null;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: peer.isYou ? "var(--dt-accent)" : "inherit" }}>
      <span className={`dt-chip-avatar dt-peer-${peer.colorIdx}`} style={{ width: 16, height: 16, fontSize: 9 }}>{peer.short}</span>
      <span style={{ fontWeight: peer.isYou ? 600 : 500 }}>{peer.isYou ? "This device" : peer.name}</span>
      {extraOwners > 0 && <span style={{ color: "var(--dt-text-dim)", fontSize: 11 }}>+{extraOwners}</span>}
    </span>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: 12, background: "var(--dt-tint)" }}>
      <span style={{ fontSize: 12, color: "var(--dt-text-muted)", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>{label}</span>
      <span style={{ fontSize: 13 }}>{children}</span>
    </div>
  );
}

// ─── TopBar ──────────────────────────────────────────────────────────────────

function TopBar({ connected, roomName, onOpenLobby, onOpenInvite, participantCount }: {
  connected: boolean; roomName: string | null; onOpenLobby: () => void;
  onOpenInvite: () => void; participantCount: number;
}) {
  return (
    <header className="dt-topbar">
      <div className="dt-topbar-title">
        <div className="dt-logo">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 3v12.55A4 4 0 1 0 14 19V7h4V3h-6z" />
          </svg>
        </div>
        DropTune
      </div>
      <div className="dt-topbar-spacer" />
      {connected ? (
        <>
          <button type="button" className="dt-room-pill" onClick={onOpenLobby}>
            <span className="dt-room-pill-dot">
              {(roomName || "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
            </span>
            <span className="dt-room-pill-name">{roomName || "Room"}</span>
            <span className="dt-room-pill-count">·</span>
            <span className="dt-room-pill-count">{participantCount}</span>
          </button>
          <button type="button" className="dt-icon-btn" onClick={onOpenInvite} aria-label="Share / QR">
            <IconQr size={18} />
          </button>
        </>
      ) : (
        <button type="button" className="dt-btn dt-btn-primary" onClick={onOpenLobby}>
          <IconWifi size={14} /> Join a room
        </button>
      )}
    </header>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

function Tabs({ mobileTab, setMobileTab }: { mobileTab: string; setMobileTab: (t: string) => void }) {
  return (
    <div className="dt-tabs">
      <button type="button" className={`dt-tab ${mobileTab === "library" ? "is-active" : ""}`} onClick={() => setMobileTab("library")}>
        <IconLibrary size={16} /> Library
      </button>
      <button type="button" className={`dt-tab ${mobileTab === "peers" ? "is-active" : ""}`} onClick={() => setMobileTab("peers")}>
        <IconUsers size={16} /> Devices
      </button>
    </div>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

function Sidebar({ peers, hostPeer, onBecomeHost, onOpenInvite, roomName, indexedFolders, onAddFolder, isYouHost }: {
  peers: UIPeer[]; hostPeer: UIPeer | undefined; onBecomeHost: () => void; onOpenInvite: () => void;
  roomName: string | null; indexedFolders: IndexedFolder[]; onAddFolder: () => void; isYouHost: boolean;
}) {
  const r = { name: roomName ?? "Room" };
  const onlinePeers = peers.filter((p) => p.online);
  return (
    <aside className="dt-side">
      <div className="dt-side-section">
        <h3 className="dt-side-label">Room</h3>
        <div style={{ padding: 12, borderRadius: 14, background: "var(--dt-tint)", border: "1px solid var(--dt-border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="dt-lobby-room-avatar" style={{ width: 36, height: 36, fontSize: 13 }}>
              {r.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</div>
              <div style={{ fontSize: 11, color: "var(--dt-text-muted)", marginTop: 1 }}>
                {onlinePeers.length} listening · LAN
              </div>
            </div>
          </div>
          <button type="button" className="dt-btn dt-btn-ghost dt-btn-block" onClick={onOpenInvite} style={{ marginTop: 12, fontSize: 13 }}>
            <IconQr size={14} /> Show QR
          </button>
        </div>
      </div>

      <div className="dt-side-section">
        <h3 className="dt-side-label">In the room</h3>
        <div>
          {onlinePeers.map((peer) => (
            <div key={peer.id} className="dt-peer-row" style={{ padding: "8px 0" }}>
              <PeerAvatar peer={peer} size={32} withHostRing={peer.isHost} />
              <div className="dt-peer-info">
                <div className="dt-peer-name" style={{ fontSize: 13 }}>
                  <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{peer.name}</span>
                  {peer.isYou && <span className="dt-peer-name-you">YOU</span>}
                </div>
                {peer.isHost && (
                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--dt-accent)", letterSpacing: "0.06em", textTransform: "uppercase", marginTop: 2 }}>
                    Host
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        {!isYouHost && (
          <button type="button" className="dt-btn dt-btn-primary dt-btn-block" onClick={onBecomeHost} style={{ marginTop: 10, fontSize: 13 }}>
            <IconHost size={14} /> Take over hosting
          </button>
        )}
      </div>

      <div className="dt-side-section">
        <h3 className="dt-side-label">Indexed folders</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {indexedFolders.slice(0, 3).map((folder) => (
            <div key={folder.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 10, background: "var(--dt-tint)" }}>
              <IconFolder size={14} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{folder.name}</div>
                <div style={{ fontSize: 10, color: "var(--dt-text-muted)" }}>{folder.tracks} tracks</div>
              </div>
            </div>
          ))}
          <button type="button" className="dt-btn dt-btn-ghost" onClick={onAddFolder} style={{ fontSize: 12, padding: "8px 12px" }}>
            <IconFolderPlus size={14} /> Add folder
          </button>
        </div>
      </div>
    </aside>
  );
}

// ─── PeersView ────────────────────────────────────────────────────────────────

function PeersView({ peers, hostPeer, onBecomeHost, onOpenInvite, coordinatorHost, lanIp, isYouHost }: {
  peers: UIPeer[]; hostPeer: UIPeer | undefined; onBecomeHost: () => void;
  onOpenInvite: () => void; coordinatorHost: string; lanIp: string | null; isYouHost: boolean;
}) {
  const onlinePeers = peers.filter((p) => p.online);
  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <h2 style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: 20, fontWeight: 700, margin: 0, letterSpacing: "-0.01em" }}>In this room</h2>
          <p style={{ fontSize: 13, color: "var(--dt-text-muted)", margin: "2px 0 0" }}>
            {onlinePeers.length} device{onlinePeers.length !== 1 ? "s" : ""} · everyone can queue
          </p>
        </div>
        <button type="button" className="dt-btn dt-btn-ghost" onClick={onOpenInvite}>
          <IconShare size={14} /> Invite
        </button>
      </div>

      <div>
        {onlinePeers.map((peer) => (
          <div key={peer.id} className="dt-peer-row">
            <PeerAvatar peer={peer} withHostRing={peer.isHost} />
            <div className="dt-peer-info">
              <div className="dt-peer-name">
                <span>{peer.name}</span>
                {peer.isYou && <span className="dt-peer-name-you">YOU</span>}
                {peer.isHost && <span className="dt-peer-host-chip"><IconHost size={10} /> Host</span>}
              </div>
              <div className="dt-peer-meta">Sharing music</div>
            </div>
            {!peer.isHost && !peer.isYou && (
              <button type="button" className="dt-btn dt-btn-ghost" style={{ fontSize: 12, padding: "7px 12px" }}>
                Make host
              </button>
            )}
            {!peer.isHost && peer.isYou && (
              <button type="button" className="dt-btn dt-btn-ghost" onClick={onBecomeHost} style={{ fontSize: 12, padding: "7px 12px" }}>
                Take over
              </button>
            )}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 28 }}>
        <h3 style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--dt-text-muted)", margin: "0 0 12px" }}>
          About this room
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <InfoRow label="Network">LAN · DropTune coordinator</InfoRow>
          <InfoRow label="Host IP"><span className="dt-mono">{lanIp ?? coordinatorHost}:8787</span></InfoRow>
          <InfoRow label="Transfer">Peer-to-peer · WebRTC</InfoRow>
        </div>
      </div>
    </div>
  );
}

// ─── LibraryView ──────────────────────────────────────────────────────────────

function LibraryView({ tracks, myPeer, peerFilter, setPeerFilter, query, setQuery, onPlayTrack, onQueueTrack, activeTrackId, isPlaying, transfers, onAddFolder, indexedFolders, peers }: {
  tracks: UITrack[]; myPeer: UIPeer; peerFilter: string; setPeerFilter: (p: string) => void;
  query: string; setQuery: (q: string) => void; onPlayTrack: (id: string) => void;
  onQueueTrack: (id: string) => void; activeTrackId: string | undefined; isPlaying: boolean;
  transfers: UITransfer[]; onAddFolder: () => void; indexedFolders: IndexedFolder[]; peers: UIPeer[];
}) {
  const transferByTrack = useMemo(() => {
    const map: Record<string, UITransfer> = {};
    for (const tr of transfers) map[tr.trackId] = tr;
    return map;
  }, [transfers]);

  return (
    <div>
      {/* Search */}
      <div className="dt-search-row">
        <div className="dt-search">
          <IconSearch size={18} />
          <input
            type="text"
            placeholder="Search title, artist, album…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button type="button" className="dt-track-action" style={{ opacity: 1 }} onClick={() => setQuery("")} aria-label="Clear">
              <IconClose size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Filter chips */}
      <div className="dt-filter-chips">
        <button type="button" className={`dt-chip ${peerFilter === "all" ? "is-active" : ""}`} onClick={() => setPeerFilter("all")}>
          <span className="dt-chip-all">∗</span>
          All devices
        </button>
        <button
          key={myPeer.id}
          type="button"
          className={`dt-chip ${peerFilter === myPeer.id ? "is-active" : ""}`}
          onClick={() => setPeerFilter(myPeer.id)}
        >
          <span className={`dt-chip-avatar dt-peer-${myPeer.colorIdx}`}>{myPeer.short}</span>
          This device
        </button>
        {peers.filter((p) => p.online && !p.isYou).map((peer) => (
          <button
            key={peer.id}
            type="button"
            className={`dt-chip ${peerFilter === peer.id ? "is-active" : ""}`}
            onClick={() => setPeerFilter(peer.id)}
          >
            <span className={`dt-chip-avatar dt-peer-${peer.colorIdx}`}>{peer.short}</span>
            {peer.name.split(" ")[0]}
          </button>
        ))}
      </div>

      {tracks.length === 0 ? (
        <div className="dt-empty">
          <div className="dt-empty-icon"><IconSearch size={26} /></div>
          <div>
            <div className="dt-empty-title">{query ? "No tracks match" : "No tracks indexed"}</div>
            <div className="dt-empty-text">{query ? "Try a different search or peer filter." : "Select a music folder to get started."}</div>
          </div>
        </div>
      ) : (
        <div className="dt-library">
          {tracks.map((track) => {
            const isActive = activeTrackId === track.id;
            const transfer = transferByTrack[track.id];
            return (
              <div
                key={track.id}
                className={`dt-track ${isActive ? "is-playing" : ""}`}
                onDoubleClick={() => onPlayTrack(track.id)}
              >
                <TrackArt track={track} />
                <div className="dt-track-info">
                  <div className="dt-track-title-row">
                    <span className="dt-track-title">{track.title}</span>
                    {isActive && (
                      <span className={`dt-playing-bars ${isPlaying ? "" : "is-paused"}`}>
                        <span /><span /><span />
                      </span>
                    )}
                    {transfer && (
                      <span className="dt-transfer-pill">
                        <span className="dt-spinner-dot" />
                        {transfer.progress}%
                      </span>
                    )}
                  </div>
                  <div className="dt-track-sub">
                    <span>{track.artist}</span>
                    <span className="dt-track-sub-dot">·</span>
                    <span>{track.album}</span>
                    <span className="dt-track-sub-dot">·</span>
                    <SourcePeerChip peer={myPeer} />
                  </div>
                </div>
                <div className="dt-track-actions">
                  <span className="dt-track-duration">{fmtTime(track.durationSec)}</span>
                  <button type="button" className="dt-track-action" onClick={() => onQueueTrack(track.id)} title="Add to queue" aria-label="Add to queue">
                    <IconPlus size={18} />
                  </button>
                  <button type="button" className="dt-track-action dt-action-play" onClick={() => onPlayTrack(track.id)} title="Play now" aria-label="Play now">
                    <IconPlay size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ padding: "24px 16px 8px" }}>
        <h3 style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--dt-text-muted)", margin: "0 0 12px" }}>
          Shared folders
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {indexedFolders.map((folder) => (
            <div key={folder.id} className="dt-folder-card">
              <div className="dt-folder-icon"><IconFolder size={18} /></div>
              <div className="dt-folder-info">
                <div className="dt-folder-name">{folder.name}</div>
                <div className="dt-folder-meta">{folder.tracks} tracks · {folder.size}</div>
              </div>
            </div>
          ))}
          <button type="button" className="dt-btn dt-btn-ghost dt-btn-block" onClick={onAddFolder} style={{ marginTop: 4 }}>
            <IconFolderPlus size={16} /> Index another folder
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── QueueList ────────────────────────────────────────────────────────────────

function QueueList({ queue, getTrack, getPeer, activeQueueItemId, transfers, onPlayItem, onRemove, onMove, embedded = false }: {
  queue: QueueItem[]; getTrack: (item: QueueItem) => UITrack | undefined;
  getPeer: (id: string) => UIPeer | undefined;
  activeQueueItemId: string | undefined; transfers: UITransfer[];
  onPlayItem: (id: string) => void; onRemove: (id: string) => void;
  onMove: (from: number, to: number) => void; embedded?: boolean;
}) {
  const transferByTrack = useMemo(() => {
    const map: Record<string, UITransfer> = {};
    for (const tr of transfers) map[tr.trackId] = tr;
    return map;
  }, [transfers]);

  if (queue.length === 0) {
    return (
      <div className="dt-queue-empty">
        <div className="dt-queue-empty-icon"><IconMusic size={26} /></div>
        <div className="dt-empty-title">Queue is empty</div>
        <div className="dt-queue-empty-text">Tap a track from the library to queue it up.</div>
      </div>
    );
  }

  return (
    <div style={{ padding: embedded ? "0" : "0 8px" }}>
      {queue.map((item, index) => {
        const track = getTrack(item);
        if (!track) return null;
        const isActive = item.id === activeQueueItemId;
        const transfer = transferByTrack[track.id];
        const addedByPeer = getPeer(item.requestedBy);

        return (
          <div key={item.id} className={`dt-queue-item ${isActive ? "is-active" : ""}`}>
            <button type="button" className="dt-queue-grip" aria-label="Drag to reorder">
              <IconGrip size={16} />
            </button>
            <div className="dt-queue-art" onClick={() => onPlayItem(item.id)} style={{ cursor: "pointer", position: "relative" }}>
              <div className={`dt-track-art-gradient dt-art-grad-${track.gradIdx}`} />
              <div className="dt-track-art-letter" style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontSize: 18 }}>
                {(track.title || "?").charAt(0).toUpperCase()}
              </div>
              {isActive && (
                <div style={{ position: "absolute", inset: 0, background: "oklch(0 0 0 / 0.45)", display: "grid", placeItems: "center", color: "white" }}>
                  <span className="dt-playing-bars"><span /><span /><span /></span>
                </div>
              )}
            </div>
            <div className="dt-queue-info" onClick={() => onPlayItem(item.id)} style={{ cursor: "pointer" }}>
              <div className="dt-queue-title">{track.title}</div>
              <div className="dt-queue-sub">
                <span>{track.artist}</span>
                <span className="dt-track-sub-dot">·</span>
                <SourcePeerChip peer={addedByPeer} />
                {transfer && (
                  <>
                    <span className="dt-track-sub-dot">·</span>
                    <span className="dt-transfer-pill"><span className="dt-spinner-dot" />{transfer.progress}%</span>
                  </>
                )}
              </div>
            </div>
            <div className="dt-queue-actions">
              <button type="button" className="dt-icon-btn" onClick={() => onMove(index, index - 1)} disabled={index === 0} style={{ opacity: index === 0 ? 0.35 : 1 }} aria-label="Move up">
                <IconArrowUp size={16} />
              </button>
              <button type="button" className="dt-icon-btn" onClick={() => onMove(index, index + 1)} disabled={index === queue.length - 1} style={{ opacity: index === queue.length - 1 ? 0.35 : 1 }} aria-label="Move down">
                <IconArrowDown size={16} />
              </button>
              <button type="button" className="dt-icon-btn" onClick={() => onRemove(item.id)} aria-label="Remove from queue">
                <IconTrash size={16} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── QueueSheet ───────────────────────────────────────────────────────────────

function QueueSheet({ open, onClose, queue, getTrack, getPeer, activeQueueItemId, transfers, onPlayItem, onRemove, onMove, onClear }: {
  open: boolean; onClose: () => void; queue: QueueItem[];
  getTrack: (item: QueueItem) => UITrack | undefined;
  getPeer: (id: string) => UIPeer | undefined;
  activeQueueItemId: string | undefined; transfers: UITransfer[];
  onPlayItem: (id: string) => void; onRemove: (id: string) => void;
  onMove: (from: number, to: number) => void; onClear: () => void;
}) {
  const upcoming = queue.filter((q) => q.id !== activeQueueItemId);
  return (
    <>
      <div className={`dt-sheet-scrim dt-queue-sheet-scrim ${open ? "is-open" : ""}`} onClick={onClose} />
      <div className={`dt-sheet dt-queue-sheet ${open ? "is-open" : ""}`}>
        <div className="dt-sheet-handle" />
        <div className="dt-sheet-header">
          <div>
            <div className="dt-sheet-title">Queue</div>
            <div className="dt-sheet-sub">{upcoming.length} up next · everyone in the room can add</div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {queue.length > 0 && (
              <button type="button" className="dt-icon-btn" onClick={onClear} aria-label="Clear queue" title="Clear queue">
                <IconTrash size={18} />
              </button>
            )}
            <button type="button" className="dt-icon-btn" onClick={onClose} aria-label="Close">
              <IconClose size={18} />
            </button>
          </div>
        </div>
        <div className="dt-sheet-body">
          <QueueList queue={queue} getTrack={getTrack} getPeer={getPeer} activeQueueItemId={activeQueueItemId} transfers={transfers} onPlayItem={onPlayItem} onRemove={onRemove} onMove={onMove} />
        </div>
      </div>
    </>
  );
}

// ─── TransportBar ─────────────────────────────────────────────────────────────

function TransportBar({ track, positionSec, durationSec, isPlaying, transfer, onTogglePlay, onNext, onPrev, onSeek, onExpandNowPlaying, onOpenQueue, queueLength, hostPeer }: {
  track: UITrack | undefined; positionSec: number; durationSec: number; isPlaying: boolean;
  transfer: UITransfer | undefined; onTogglePlay: () => void; onNext: () => void; onPrev: () => void;
  onSeek: (sec: number) => void; onExpandNowPlaying: () => void; onOpenQueue: () => void;
  queueLength: number; hostPeer: UIPeer | undefined;
}) {
  if (!track) {
    return (
      <div className="dt-transport">
        <div className="dt-transport-art" style={{ background: "var(--dt-tint)" }} />
        <div className="dt-transport-info">
          <div className="dt-transport-title" style={{ color: "var(--dt-text-muted)" }}>Nothing playing</div>
          <div className="dt-transport-meta">Pick a track from the library</div>
        </div>
        <div className="dt-transport-controls">
          <button type="button" className="dt-transport-btn dt-transport-btn-play dt-transport-btn-keep" disabled style={{ opacity: 0.5 }}>
            <IconPlay size={20} />
          </button>
        </div>
      </div>
    );
  }

  const duration = durationSec || 1;
  const pct = Math.min(100, (positionSec / duration) * 100);

  const onScrubClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    onSeek(ratio * duration);
  };

  return (
    <div className="dt-transport">
      <div className="dt-transport-progress" onClick={onScrubClick} aria-label="Seek">
        <div className="dt-transport-progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className={`dt-transport-art dt-art-grad-${track.gradIdx}`} onClick={onExpandNowPlaying} style={{ cursor: "pointer", position: "relative" }}>
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "white", fontWeight: 700, fontFamily: "Space Grotesk, sans-serif", fontSize: 20, textShadow: "0 2px 6px oklch(0 0 0 / 0.3)" }}>
          {(track.title || "?").charAt(0).toUpperCase()}
        </div>
      </div>
      <div className="dt-transport-info" onClick={onExpandNowPlaying} style={{ cursor: "pointer" }}>
        <div className="dt-transport-title">{track.title}</div>
        <div className="dt-transport-meta">
          <span className="dt-host-tag">
            <span className="dt-host-tag-dot" />
            {hostPeer?.isYou ? "On this device" : (hostPeer?.name ?? "Unknown")}
          </span>
          {transfer && (
            <>
              <span className="dt-transport-meta-dot">·</span>
              <span className="dt-transfer-pill" style={{ padding: "1px 6px", fontSize: 9 }}>
                <IconDownload size={9} />{transfer.progress}%
              </span>
            </>
          )}
        </div>
      </div>
      <div className="dt-transport-controls">
        <button type="button" className="dt-transport-btn" onClick={onPrev} aria-label="Previous"><IconPrev size={20} /></button>
        <button type="button" className="dt-transport-btn dt-transport-btn-play dt-transport-btn-keep" onClick={onTogglePlay} aria-label={isPlaying ? "Pause" : "Play"}>
          {isPlaying ? <IconPause size={20} /> : <IconPlay size={20} />}
        </button>
        <button type="button" className="dt-transport-btn" onClick={onNext} aria-label="Next"><IconNext size={20} /></button>
        <button type="button" className="dt-transport-btn dt-transport-btn-keep" onClick={onOpenQueue} aria-label="Open queue" style={{ position: "relative" }}>
          <IconQueue size={20} />
          {queueLength > 0 && (
            <span style={{ position: "absolute", top: 2, right: 2, minWidth: 16, height: 16, padding: "0 4px", borderRadius: 999, background: "var(--dt-accent)", color: "var(--dt-on-accent)", fontSize: 10, fontWeight: 800, fontVariantNumeric: "tabular-nums", display: "grid", placeItems: "center" }}>
              {queueLength}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── NowPlayingOverlay ────────────────────────────────────────────────────────

function NowPlayingOverlay({ open, onClose, track, positionSec, durationSec, isPlaying, onPlayPause, onSeek, onNext, onPrev, queue, getTrack, getPeer, activeQueueItemId, onPlayItem, transfers, hostPeer, onOpenQueue, onOpenInvite, onBecomeHost, peers, roomName, isYouHost }: {
  open: boolean; onClose: () => void; track: UITrack | undefined;
  positionSec: number; durationSec: number; isPlaying: boolean;
  onPlayPause: () => void; onSeek: (s: number) => void; onNext: () => void; onPrev: () => void;
  queue: QueueItem[]; getTrack: (item: QueueItem) => UITrack | undefined;
  getPeer: (id: string) => UIPeer | undefined;
  activeQueueItemId: string | undefined; onPlayItem: (id: string) => void;
  transfers: UITransfer[]; hostPeer: UIPeer | undefined; onOpenQueue: () => void;
  onOpenInvite: () => void; onBecomeHost: () => void; peers: UIPeer[];
  roomName: string | null; isYouHost: boolean;
}) {
  if (!track) return null;
  const duration = durationSec || 1;
  const pct = Math.min(100, Math.max(0, (positionSec / duration) * 100));
  const transfer = transfers.find((t) => t.trackId === track.id);
  const upcoming = queue.filter((q) => q.id !== activeQueueItemId).slice(0, 3);
  const listeners = peers.filter((p) => p.online && !p.isYou);

  const onScrubClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    onSeek(ratio * duration);
  };

  return (
    <div className={`dt-np-overlay ${open ? "is-open" : ""}`} role="dialog" aria-label="Now playing">
      <div className={`dt-np-bg dt-art-grad-${track.gradIdx}`} />
      <div className="dt-np-content">
        <div className="dt-np-header">
          <button type="button" className="dt-icon-btn" onClick={onClose} aria-label="Collapse"><IconChevDown size={20} /></button>
          <div className="dt-np-header-center">
            <div className="dt-np-header-label">Playing in</div>
            <div className="dt-np-header-room">{roomName ?? "Room"}</div>
          </div>
          <button type="button" className="dt-icon-btn" onClick={onOpenInvite} aria-label="Share"><IconShare size={18} /></button>
        </div>

        <div className={`dt-np-art dt-art-grad-${track.gradIdx}`}>
          <div className="dt-np-art-letter">{(track.title || "?").charAt(0).toUpperCase()}</div>
          {transfer && (
            <div style={{ position: "absolute", bottom: 12, left: 12, right: 12, padding: "8px 12px", borderRadius: 12, background: "oklch(0 0 0 / 0.4)", backdropFilter: "blur(20px)", color: "white", fontSize: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <IconDownload size={14} />
              <span style={{ flex: 1 }}>Receiving from peer</span>
              <span className="dt-mono">{transfer.progress}%</span>
            </div>
          )}
        </div>

        <div style={{ textAlign: "center", padding: "0 8px" }}>
          <h2 className="dt-np-title">{track.title}</h2>
          <p className="dt-np-artist">{track.artist} · {track.album}</p>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <div className={`dt-np-source ${track.isLocal ? "is-local" : ""}`}>
              <SourcePeerChip peer={track.isLocal ? peers.find(p => p.isYou) : undefined} />
            </div>
          </div>
        </div>

        <div className="dt-np-scrubber">
          <div className="dt-scrub-track" onClick={onScrubClick}>
            <div className="dt-scrub-fill" style={{ width: `${pct}%` }} />
          </div>
          <div className="dt-scrub-times">
            <span>{fmtTime(positionSec)}</span>
            <span>-{fmtTime(Math.max(0, duration - positionSec))}</span>
          </div>
        </div>

        <div className="dt-np-controls">
          <button type="button" className="dt-np-btn" aria-label="Shuffle"><IconShuffle size={18} /></button>
          <button type="button" className="dt-np-btn" onClick={onPrev} aria-label="Previous"><IconPrev size={26} /></button>
          <button type="button" className="dt-np-btn dt-np-btn-play" onClick={onPlayPause} aria-label={isPlaying ? "Pause" : "Play"}>
            {isPlaying ? <IconPause size={28} /> : <IconPlay size={28} />}
          </button>
          <button type="button" className="dt-np-btn" onClick={onNext} aria-label="Next"><IconNext size={26} /></button>
          <button type="button" className="dt-np-btn" aria-label="Repeat"><IconRepeat size={18} /></button>
        </div>

        {/* Host + listeners strip */}
        <div className="dt-np-strip">
          <div className="dt-np-strip-section">
            <div className="dt-np-strip-label">Playing on</div>
            <div className="dt-np-host-row">
              <PeerAvatar peer={hostPeer} size={28} withHostRing />
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {hostPeer?.isYou ? "This device" : (hostPeer?.name ?? "Unknown")}
                  </span>
                  <span className="dt-peer-host-chip">Host</span>
                </div>
                {!isYouHost && (
                  <button type="button" onClick={onBecomeHost} style={{ fontSize: 11, fontWeight: 600, color: "var(--dt-accent)", marginTop: 2, textDecoration: "underline", textUnderlineOffset: 3 }}>
                    Take over hosting
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="dt-np-strip-divider" />
          <div className="dt-np-strip-section">
            <div className="dt-np-strip-label">Listening</div>
            <div className="dt-np-listeners">
              {listeners.slice(0, 4).map((p) => (
                <div key={p.id} className={`dt-np-listener dt-peer-${p.colorIdx}`}>{p.short}</div>
              ))}
              {listeners.length > 4 && (
                <div className="dt-np-listener" style={{ background: "var(--dt-elevated)", color: "var(--dt-text-muted)" }}>+{listeners.length - 4}</div>
              )}
            </div>
          </div>
        </div>

        {/* Up next */}
        {upcoming.length > 0 && (
          <div className="dt-np-queue">
            <div className="dt-np-queue-header">
              <div className="dt-np-queue-title">Up next</div>
              <button type="button" className="dt-icon-btn" onClick={onOpenQueue} aria-label="Open queue"><IconQueue size={16} /></button>
            </div>
            <div className="dt-np-queue-list">
              {upcoming.map((item, i) => {
                const t = getTrack(item);
                if (!t) return null;
                const addedBy = getPeer(item.requestedBy);
                return (
                  <div key={item.id} className="dt-np-queue-item" onClick={() => onPlayItem(item.id)} style={{ cursor: "pointer" }}>
                    <div className="dt-np-queue-item-num">{i + 1}</div>
                    <div className="dt-np-queue-item-info">
                      <div className="dt-np-queue-item-title">{t.title}</div>
                      <div className="dt-np-queue-item-sub">{t.artist} · added by {addedBy?.isYou ? "you" : (addedBy?.name.split(" ")[0] ?? "someone")}</div>
                    </div>
                    <div className="dt-mono" style={{ fontSize: 11, color: "var(--dt-text-dim)" }}>{fmtTime(t.durationSec)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── LobbyModal ───────────────────────────────────────────────────────────────

function LobbyModal({ open, onClose, onJoin, onCreate, rooms, roomNameInput, setRoomNameInput }: {
  open: boolean; onClose: () => void;
  onJoin: (roomId: string, roomName: string) => void;
  onCreate: (name: string) => void;
  rooms: NearbyRoom[]; roomNameInput: string; setRoomNameInput: (v: string) => void;
}) {
  return (
    <div className={`dt-modal-scrim ${open ? "is-open" : ""}`} onClick={onClose}>
      <div className="dt-modal" onClick={(e) => e.stopPropagation()}>
        <div className="dt-modal-header" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <h2 className="dt-modal-title">Welcome to DropTune</h2>
            <p className="dt-modal-sub">Listen together with anyone on this network.</p>
          </div>
          <button type="button" className="dt-icon-btn" onClick={onClose} aria-label="Close"><IconClose size={18} /></button>
        </div>
        <div className="dt-modal-body">
          <div className="dt-modal-section" style={{ marginTop: 0 }}>
            <h3 className="dt-modal-section-label">
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <IconWifi size={12} /> Rooms on this network
              </span>
            </h3>
            <div>
              {rooms.length === 0 ? (
                <div style={{ fontSize: 13, color: "var(--dt-text-muted)", padding: "12px 4px" }}>No rooms found. Create one below.</div>
              ) : (
                rooms.map((room) => (
                  <button type="button" className="dt-lobby-room" key={room.roomId} onClick={() => onJoin(room.roomId, room.roomName)}>
                    <div className="dt-lobby-room-avatar">
                      {room.roomName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                    <div className="dt-lobby-room-info">
                      <div className="dt-lobby-room-name">{room.roomName}</div>
                      <div className="dt-lobby-room-meta">
                        <IconUsers size={12} />{room.participantCount} listening
                      </div>
                    </div>
                    <div className="dt-lobby-room-arrow"><IconChevRight size={18} /></div>
                  </button>
                ))
              )}
            </div>
          </div>
          <div className="dt-lobby-divider">or start one</div>
          <div className="dt-modal-section" style={{ marginTop: 0 }}>
            <h3 className="dt-modal-section-label">New room</h3>
            <div className="dt-create-row">
              <input
                className="dt-text-input"
                placeholder="Room name"
                value={roomNameInput}
                onChange={(e) => setRoomNameInput(e.target.value)}
              />
              <button type="button" className="dt-btn dt-btn-primary" onClick={() => onCreate(roomNameInput || "New Room")}>
                <IconPlus size={16} /> Create
              </button>
            </div>
            <p style={{ fontSize: 12, color: "var(--dt-text-muted)", margin: "10px 2px 0" }}>
              You'll become the playback host. Others can join via QR code.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── InviteSheet ──────────────────────────────────────────────────────────────

function InviteSheet({ open, onClose, room, inviteUrl, peers }: {
  open: boolean; onClose: () => void; room: { id: string; name: string } | null;
  inviteUrl: string; peers: UIPeer[];
}) {
  const [copied, setCopied] = useState(false);
  const url = inviteUrl;
  const onlinePeers = peers.filter((p) => p.online);

  const onCopy = () => {
    if (navigator.clipboard) navigator.clipboard.writeText(url).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <>
      <div className={`dt-sheet-scrim ${open ? "is-open" : ""}`} onClick={onClose} />
      <div className={`dt-sheet ${open ? "is-open" : ""}`}>
        <div className="dt-sheet-handle" />
        <div className="dt-sheet-header">
          <div>
            <div className="dt-sheet-title">Invite to {room?.name ?? "this room"}</div>
            <div className="dt-sheet-sub">Anyone on this Wi-Fi can scan and join — no app, no account.</div>
          </div>
          <button type="button" className="dt-icon-btn" onClick={onClose} aria-label="Close"><IconClose size={18} /></button>
        </div>
        <div className="dt-sheet-body" style={{ padding: "0 20px 24px" }}>
          <div className="dt-qr-card">
            <div className="dt-qr-svg" style={{ color: "oklch(0.18 0.014 280)" }}>
              {room?.id ? renderQR(url) : <div style={{ width: 160, height: 160, background: "var(--dt-tint)", borderRadius: 8 }} />}
            </div>
            <p style={{ fontSize: 13, color: "oklch(0.45 0.014 280)", margin: 0, textAlign: "center" }}>
              Point a phone camera at the code
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--dt-text-muted)" }}>
              or share this URL
            </div>
            <div className="dt-qr-url" style={{ width: "100%" }}>
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{url}</span>
              <button type="button" className="dt-qr-url-copy" onClick={onCopy} aria-label="Copy link">
                {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
              </button>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 16, fontSize: 12, color: "var(--dt-text-muted)" }}>
            <div style={{ flex: 1, padding: 12, borderRadius: 12, background: "var(--dt-tint)" }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>Host</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--dt-text)" }}>
                <IconHost size={14} />
                <span style={{ fontWeight: 600 }}>You</span>
              </div>
            </div>
            <div style={{ flex: 1, padding: 12, borderRadius: 12, background: "var(--dt-tint)" }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>Listening</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--dt-text)" }}>
                <IconUsers size={14} />
                <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{onlinePeers.length}</span>
              </div>
            </div>
            <div style={{ flex: 1, padding: 12, borderRadius: 12, background: "var(--dt-tint)" }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>Network</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--dt-text)" }}>
                <IconWifi size={14} />
                <span style={{ fontWeight: 600 }}>LAN</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── ExtendedWindow ───────────────────────────────────────────────────────────

type ExtendedWindow = Window & {
  showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle & { name: string }>;
};

async function listFilesFromHandle(dirHandle: FileSystemDirectoryHandle, pathPrefix = ""): Promise<File[]> {
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

// ─── App ─────────────────────────────────────────────────────────────────────

export function App() {
  const coordinatorHost = window.location.hostname || "localhost";
  const coordinatorBaseUrl = `http://${coordinatorHost}:8787`;
  const wsUrl = `ws://${coordinatorHost}:8787/ws`;
  const wsRef = useRef<WebSocket | null>(null);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [lobbyOpen, setLobbyOpen] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [queueSheetOpen, setQueueSheetOpen] = useState(false);
  const [npOpen, setNpOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState("library");
  const [peerFilter, setPeerFilter] = useState("all");
  const [participants, setParticipants] = useState<RoomParticipant[]>([]);
  const [indexedFolders, setIndexedFolders] = useState<IndexedFolder[]>([]);
  const [rooms, setRooms] = useState<NearbyRoom[]>([]);
  const [roomNameInput, setRoomNameInput] = useState("Living Room");
  const [lanIp, setLanIp] = useState<string | null>(null);

  // ── error state ───────────────────────────────────────────────────────────
  const [roomError, setRoomError] = useState<string | null>(null);
  const [indexError, setIndexError] = useState<string | null>(null);
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const [activeQueueItemId, setActiveQueueItemId] = useState<string | undefined>();
  const lastPlaybackEmitRef = useRef(0);
  const wsMessageHandlerRef = useRef<(msg: MessageEvent) => void>(() => undefined);
  const pendingFileRequests = useRef(new Map<string, {
    resolve: (blob: Blob) => void;
    reject: (err: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }>());

  // ── stores ────────────────────────────────────────────────────────────────
  const { tracks, localFiles, query, isIndexing, setQuery, setIndexing, upsertTracks, hydrate } = useLibraryStore();
  const { peerId, displayName } = usePeerStore();
  const roomStore = useRoomStore();
  const isHost = !roomStore.roomId || !roomStore.isConnected || peerId === roomStore.hostPeerId;
  const { queue, setQueue, addToQueue, removeFromQueue, moveQueueItem } = useQueueStore();
  const playback = usePlaybackStore();
  const { status: transferStatus, progressPct, setTransfer } = useTransferStore();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // ── derived UI data ───────────────────────────────────────────────────────
  const myPeer: UIPeer = {
    id: peerId,
    name: displayName,
    short: toPeerShort(displayName),
    colorIdx: toPeerColorIdx(peerId),
    isYou: true,
    online: true,
    isHost,
  };

  const uiPeers: UIPeer[] = useMemo(() => {
    if (participants.length === 0) return [myPeer];
    return participants.map((p) => ({
      id: p.peerId,
      name: p.name,
      short: toPeerShort(p.name),
      colorIdx: toPeerColorIdx(p.peerId),
      isYou: p.peerId === peerId,
      online: true,
      isHost: p.isHost,
    }));
  }, [participants, peerId, displayName, isHost]);

  const hostPeer = uiPeers.find((p) => p.isHost) ?? uiPeers.find((p) => p.isYou);

  function toUITrack(meta: TrackMetadata): UITrack {
    return {
      ...meta,
      gradIdx: toGradIdx(meta.id),
      isLocal: !!localFiles[meta.id],
    };
  }

  function getTrackForQueueItem(item: QueueItem): UITrack | undefined {
    const meta = tracks.find((t) => t.id === item.trackId);
    if (meta) return toUITrack(meta);
    const snap = item.trackSnapshot;
    if (snap) {
      return {
        id: item.trackId,
        title: snap.title,
        artist: snap.artist,
        album: snap.album,
        durationSec: snap.durationSec,
        gradIdx: toGradIdx(item.trackId),
        isLocal: false,
      };
    }
    return undefined;
  }

  function getPeerById(id: string): UIPeer | undefined {
    return uiPeers.find((p) => p.id === id);
  }

  const filteredTracks = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tracks
      .filter((t) => {
        if (peerFilter !== "all" && peerFilter !== peerId) return false;
        if (!q) return true;
        return (
          t.title.toLowerCase().includes(q) ||
          (t.artist ?? "").toLowerCase().includes(q) ||
          (t.album ?? "").toLowerCase().includes(q)
        );
      })
      .map(toUITrack);
  }, [tracks, peerFilter, peerId, query, localFiles]);

  const activeItem = queue.find((q) => q.id === activeQueueItemId);
  const activeTrack = activeItem ? getTrackForQueueItem(activeItem) : undefined;
  const activeTrackId = activeTrack?.id;

  const uiTransfers: UITransfer[] = useMemo(() => {
    if (transferStatus === "idle" || !activeTrackId) return [];
    return [{ trackId: activeTrackId, sourcePeerId: "peer", progress: progressPct, status: transferStatus }];
  }, [transferStatus, progressPct, activeTrackId]);

  const isPlaying = playback.status === "playing";

  useEffect(() => { void hydrate(); }, [hydrate]);

  useEffect(() => {
    fetch(`${coordinatorBaseUrl}/info`)
      .then((r) => r.json())
      .then((d: { lanIp: string | null }) => { if (d.lanIp) setLanIp(d.lanIp); })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    void refreshRooms();
    const timer = window.setInterval(() => void refreshRooms(), 3000);
    return () => window.clearInterval(timer);
  }, []);

  // ── audio event handlers ──────────────────────────────────────────────────
  function emitPlaybackState() {
    if (!roomStore.roomId || !roomStore.isConnected || !isHost) return;
    const audio = audioRef.current;
    if (!audio) return;
    sendEvent({
      type: "PLAYBACK_STATE", sentAt: Date.now(),
      payload: {
        roomId: roomStore.roomId,
        state: {
          status: playback.status,
          currentQueueItemId: activeQueueItemId,
          positionSec: audio.currentTime || playback.positionSec,
          durationSec: audio.duration || playback.durationSec,
          updatedAt: Date.now(),
        },
      },
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
    const onPlay = () => { playback.setStatus("playing"); emitPlaybackState(); };
    const onPause = () => { playback.setStatus("paused"); emitPlaybackState(); };
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
  }, [playback, queue, activeQueueItemId, roomStore.isConnected, roomStore.roomId, roomStore.hostPeerId]);

  // ── WS helpers ────────────────────────────────────────────────────────────
  function sendEvent(event: ControlPlaneEvent) {
    if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify(event));
  }

  function sendSignalTo(targetPeerId: string, signal: unknown) {
    if (!roomStore.roomId || !roomStore.isConnected) return;
    sendEvent({ type: "WEBRTC_SIGNAL", sentAt: Date.now(), payload: { roomId: roomStore.roomId, sourcePeerId: peerId, targetPeerId, signal } });
  }

  function onRoomState(event: Extract<ControlPlaneEvent, { type: "ROOM_STATE" }>) {
    const { room } = event.payload;
    setQueue(room.queue);
    setActiveQueueItemId(room.playback.currentQueueItemId);
    setParticipants(room.participants);
    playback.hydrateFromRemote({
      status: room.playback.status,
      positionSec: room.playback.positionSec,
      durationSec: room.playback.durationSec,
      currentTrackId: room.playback.currentQueueItemId,
    });
    const host = room.participants.find((p) => p.isHost);
    roomStore.setPresence(room.participants.length, host?.peerId);
    roomStore.setRoom(room.roomId, room.roomName);

    if (!isHost) return;
    const audio = audioRef.current;
    if (!audio) return;
    if (room.playback.status === "paused" && !audio.paused) audio.pause();
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
      ws.send(JSON.stringify({ type: "JOIN_ROOM", sentAt: Date.now(), payload: { roomId, peerId, displayName } } as ControlPlaneEvent));
    };
    ws.onmessage = (msg) => wsMessageHandlerRef.current(msg);
    ws.onclose = () => {
      roomStore.setConnected(false);
      transferManager.cleanup();
      for (const pending of pendingFileRequests.current.values()) {
        clearTimeout(pending.timer);
        pending.reject(new Error("Disconnected from room"));
      }
      pendingFileRequests.current.clear();
      setTransfer("idle", 0);
    };
  }

  async function refreshRooms() {
    try {
      const response = await fetch(`${coordinatorBaseUrl}/rooms`);
      const data = (await response.json()) as { rooms: NearbyRoom[] };
      setRooms(data.rooms);
      setRoomError(null);
    } catch {
      setRoomError("Coordinator is not reachable.");
    }
  }

  async function createRoom(name: string) {
    setRoomError(null);
    try {
      const response = await fetch(`${coordinatorBaseUrl}/rooms/create`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ roomName: name }),
      });
      if (!response.ok) throw new Error("create room failed");
      const data = (await response.json()) as { roomId: string; roomName: string };
      await refreshRooms();
      connectRoom(data.roomId, data.roomName);
      setLobbyOpen(false);
      setTimeout(() => setInviteOpen(true), 350);
    } catch {
      setRoomError("Failed to create room");
    }
  }

  async function ingestFiles(files: File[], folderHint?: string) {
    setIndexError(null);
    setIndexing(true);
    try {
      const supportedFiles = filterSupportedFiles(files);
      const importable = supportedFiles.map((file) => ({ id: makeId(), file }));
      const indexed = await indexFiles(peerId, importable);
      const rekeyed = indexed.map((track) => ({ ...track, id: buildTrackId(track) }));
      const fileMap = rekeyed.map((track, i) => ({ id: track.id, file: importable[i].file }));
      await upsertTracks(rekeyed, fileMap);
      const folderName = folderHint ?? files[0]?.name.split("/")[0] ?? "My Music";
      const totalSize = rekeyed.reduce((s, t) => s + (t.sizeBytes ?? 0), 0);
      setIndexedFolders((prev) => {
        const idx = prev.findIndex((f) => f.name === folderName);
        const entry: IndexedFolder = { id: prev[idx]?.id ?? makeId(), name: folderName, tracks: rekeyed.length, size: formatSize(totalSize) };
        if (idx >= 0) { const next = [...prev]; next[idx] = entry; return next; }
        return [...prev, entry];
      });
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
        await ingestFiles(files, handle.name);
        return;
      } catch { /* fallback */ }
    }
    inputRef.current?.click();
  }

  // ── playback helpers ──────────────────────────────────────────────────────
  function resolvePlayableTrack(item: QueueItem): TrackMetadata | undefined {
    const exact = tracks.find((t) => t.id === item.trackId);
    if (exact) return exact;
    const byId = tracks.find((t) => buildTrackId(t) === item.trackId);
    if (byId) return byId;
    const snap = item.trackSnapshot;
    if (snap) {
      const normTitle = snap.title.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      const normArtist = (snap.artist ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      const fuzzy = tracks.find((t) => {
        const tTitle = t.title.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
        const tArtist = (t.artist ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
        return tTitle === normTitle && (!normArtist || !tArtist || tArtist === normArtist) && Math.abs(t.durationSec - snap.durationSec) <= 2;
      });
      if (fuzzy) return fuzzy;
    }
    return undefined;
  }

  function requestFileFromPeer(trackId: string): Promise<Blob> {
    return new Promise<Blob>((resolve, reject) => {
      if (!roomStore.roomId || !roomStore.isConnected) { reject(new Error("Not connected to a room")); return; }
      if (pendingFileRequests.current.has(trackId)) { reject(new Error("Transfer already in progress for this track")); return; }
      const timer = setTimeout(() => {
        pendingFileRequests.current.delete(trackId);
        setTransfer("idle", 0);
        reject(new Error("File request timed out — no peer in the room has this track"));
      }, 15000);
      pendingFileRequests.current.set(trackId, { resolve, reject, timer });
      sendEvent({ type: "FILE_REQUEST", sentAt: Date.now(), payload: { roomId: roomStore.roomId!, trackId, sourcePeerId: peerId, targetPeerId: "broadcast" } });
      setTransfer("requesting", 0);
    });
  }

  async function playTrack(track: TrackMetadata) {
    setPlaybackError(null);
    let file = localFiles[track.id];
    if (!file && roomStore.isConnected && roomStore.roomId) {
      try {
        const blob = await requestFileFromPeer(track.id);
        file = new File([blob], track.fileName || track.title, { type: blob.type });
      } catch (err) {
        setPlaybackError(err instanceof Error ? err.message : "Transfer failed");
        setTransfer("idle", 0);
        playback.setStatus("error");
        return;
      }
    }
    if (!file || !audioRef.current) {
      setPlaybackError("Track file is unavailable on this device.");
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
      setPlaybackError(error instanceof Error ? error.message : "Playback failed.");
      playback.setStatus("error");
    }
  }

  async function playQueueItem(queueItemId: string, emitPlayEvent = true) {
    const item = queue.find((q) => q.id === queueItemId);
    if (!item) return;
    setActiveQueueItemId(queueItemId);
    if (emitPlayEvent && roomStore.roomId && roomStore.isConnected) {
      sendEvent({ type: "PLAY", sentAt: Date.now(), payload: { roomId: roomStore.roomId, queueItemId } });
    }
    if (!isHost) return;
    let track = resolvePlayableTrack(item);
    if (!track && item.trackSnapshot) {
      track = { id: item.trackId, sourceDeviceId: "", fileName: item.trackSnapshot.title, title: item.trackSnapshot.title, artist: item.trackSnapshot.artist, album: item.trackSnapshot.album, durationSec: item.trackSnapshot.durationSec, format: "unknown", sizeBytes: 0, normalizedName: item.trackSnapshot.title.toLowerCase() };
    }
    if (!track) { setPlaybackError("No locally playable copy found."); return; }
    await playTrack(track);
  }

  function getSnapshotForTrack(trackId: string): TrackSnapshot | undefined {
    const meta = tracks.find((t) => t.id === trackId);
    if (!meta) return undefined;
    return { title: meta.title, artist: meta.artist, album: meta.album, durationSec: meta.durationSec };
  }

  function emitQueueAdd(trackId: string) {
    const snapshot = getSnapshotForTrack(trackId);
    if (!roomStore.roomId || !roomStore.isConnected) {
      addToQueue(trackId, peerId, snapshot);
      return;
    }
    const item: QueueItem = { id: makeId(), trackId, requestedBy: peerId, addedAt: Date.now(), trackSnapshot: snapshot };
    sendEvent({ type: "QUEUE_ADD", sentAt: Date.now(), payload: { roomId: roomStore.roomId, item } });
  }

  function emitQueueRemove(queueItemId: string) {
    if (!roomStore.roomId || !roomStore.isConnected) { removeFromQueue(queueItemId); return; }
    sendEvent({ type: "QUEUE_REMOVE", sentAt: Date.now(), payload: { roomId: roomStore.roomId, queueItemId } });
  }

  function emitQueueReorder(fromIndex: number, toIndex: number) {
    if (!roomStore.roomId || !roomStore.isConnected) { moveQueueItem(fromIndex, toIndex); return; }
    const reordered = [...queue];
    const [item] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, item);
    sendEvent({ type: "QUEUE_REORDER", sentAt: Date.now(), payload: { roomId: roomStore.roomId, queue: reordered } });
  }

  function emitClearQueue() {
    const toRemove = queue.filter((item) => item.id !== activeQueueItemId);
    for (const item of toRemove) emitQueueRemove(item.id);
  }

  function emitPause() {
    if (!roomStore.roomId || !roomStore.isConnected) { audioRef.current?.pause(); return; }
    sendEvent({ type: "PAUSE", sentAt: Date.now(), payload: { roomId: roomStore.roomId } });
  }

  function emitBecomeHost() {
    if (!roomStore.roomId || !roomStore.isConnected) return;
    sendEvent({ type: "HOST_CHANGE", sentAt: Date.now(), payload: { roomId: roomStore.roomId, nextHostPeerId: peerId } });
  }

  function emitSeek(positionSec: number) {
    if (!roomStore.roomId || !roomStore.isConnected) return;
    sendEvent({ type: "SEEK", sentAt: Date.now(), payload: { roomId: roomStore.roomId, positionSec } });
  }

  function handleTogglePlay() {
    if (isPlaying) {
      emitPause();
    } else if (activeQueueItemId) {
      void playQueueItem(activeQueueItemId, true);
    } else {
      void audioRef.current?.play();
    }
  }

  function handleSeek(sec: number) {
    if (audioRef.current) audioRef.current.currentTime = sec;
    playback.setPosition(sec);
    emitSeek(sec);
  }

  function handleNext() {
    const idx = queue.findIndex((q) => q.id === activeQueueItemId);
    if (idx >= 0 && idx < queue.length - 1) void playQueueItem(queue[idx + 1].id, true);
  }

  function handlePrev() {
    const pos = audioRef.current?.currentTime ?? 0;
    if (pos > 4) {
      if (audioRef.current) audioRef.current.currentTime = 0;
      emitSeek(0);
      return;
    }
    const idx = queue.findIndex((q) => q.id === activeQueueItemId);
    if (idx > 0) void playQueueItem(queue[idx - 1].id, true);
  }

  function handlePlayTrack(trackId: string) {
    const existing = queue.find((q) => q.trackId === trackId);
    if (existing) { void playQueueItem(existing.id, true); return; }
    if (!roomStore.isConnected) {
      const snapshot = getSnapshotForTrack(trackId);
      const item = addToQueue(trackId, peerId, snapshot);
      setActiveQueueItemId(item.id);
      const meta = tracks.find((t) => t.id === trackId);
      if (meta) void playTrack(meta);
    } else {
      emitQueueAdd(trackId);
      if (isHost) {
        const meta = tracks.find((t) => t.id === trackId);
        if (meta) void playTrack(meta);
      }
    }
  }

  // ── WS message handler (live ref) ─────────────────────────────────────────
  wsMessageHandlerRef.current = (message: MessageEvent) => {
    let event: ControlPlaneEvent;
    try { event = JSON.parse(String(message.data)) as ControlPlaneEvent; } catch { return; }

    if (event.type === "ROOM_STATE") { onRoomState(event); return; }

    if (event.type === "FILE_REQUEST" && event.payload.sourcePeerId !== peerId) {
      const { trackId, sourcePeerId: requestingPeerId } = event.payload;
      const file = localFiles[trackId];
      if (file && roomStore.roomId && roomStore.isConnected) {
        const signalFn: SendSignalFn = (targetPeerId, signal) => sendSignalTo(targetPeerId, signal);
        transferManager.prepareToSend(requestingPeerId, file, signalFn);
        sendEvent({ type: "FILE_AVAILABLE", sentAt: Date.now(), payload: { roomId: roomStore.roomId, sourcePeerId: peerId, trackId } });
      }
      return;
    }

    if (event.type === "FILE_AVAILABLE") {
      const { trackId, sourcePeerId } = event.payload;
      const pending = pendingFileRequests.current.get(trackId);
      if (pending) {
        clearTimeout(pending.timer);
        pendingFileRequests.current.delete(trackId);
        setTransfer("downloading", 0);
        const signalFn: SendSignalFn = (targetPeerId, signal) => sendSignalTo(targetPeerId, signal);
        transferManager.requestFile(sourcePeerId, signalFn, (pct) => setTransfer("downloading", pct))
          .then((blob) => { setTransfer("idle", 100); pending.resolve(blob); })
          .catch((err: unknown) => { setTransfer("idle", 0); pending.reject(err instanceof Error ? err : new Error(String(err))); });
      }
      return;
    }

    if (event.type === "WEBRTC_SIGNAL" && event.payload.targetPeerId === peerId) {
      transferManager.handleSignal(event.payload.sourcePeerId, event.payload.signal);
    }
  };

  const roomInfo = roomStore.roomId ? { id: roomStore.roomId, name: roomStore.roomName ?? "Room" } : null;

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="dt-app" data-theme="dark" data-accent="magenta">
      <audio ref={audioRef} preload="metadata" />
      <input
        ref={inputRef}
        type="file"
        multiple
        style={{ display: "none" }}
        // @ts-expect-error non-standard but required fallback
        webkitdirectory="true"
        onChange={(e) => { const files = Array.from(e.target.files ?? []); void ingestFiles(files); }}
      />

      <TopBar
        connected={roomStore.isConnected}
        roomName={roomStore.roomName ?? null}
        onOpenLobby={() => setLobbyOpen(true)}
        onOpenInvite={() => setInviteOpen(true)}
        participantCount={roomStore.participantCount}
      />

      <Tabs mobileTab={mobileTab} setMobileTab={setMobileTab} />

      <Sidebar
        peers={uiPeers}
        hostPeer={hostPeer}
        onBecomeHost={emitBecomeHost}
        onOpenInvite={() => setInviteOpen(true)}
        roomName={roomStore.roomName ?? null}
        indexedFolders={indexedFolders}
        onAddFolder={() => void onSelectFolder()}
        isYouHost={isHost}
      />

      <main className="dt-main">
        {mobileTab === "peers" ? (
          <PeersView
            peers={uiPeers}
            hostPeer={hostPeer}
            onBecomeHost={emitBecomeHost}
            onOpenInvite={() => setInviteOpen(true)}
            coordinatorHost={coordinatorHost}
            lanIp={lanIp}
            isYouHost={isHost}
          />
        ) : (
          <LibraryView
            tracks={filteredTracks}
            myPeer={myPeer}
            peers={uiPeers}
            peerFilter={peerFilter}
            setPeerFilter={setPeerFilter}
            query={query}
            setQuery={setQuery}
            onPlayTrack={handlePlayTrack}
            onQueueTrack={emitQueueAdd}
            activeTrackId={activeTrackId}
            isPlaying={isPlaying}
            transfers={uiTransfers}
            onAddFolder={() => void onSelectFolder()}
            indexedFolders={indexedFolders}
          />
        )}
      </main>

      <aside className="dt-side-queue">
        <div className="dt-side-queue-header">
          <div>
            <div style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 700, fontSize: 16, letterSpacing: "-0.01em" }}>Queue</div>
            <div style={{ fontSize: 12, color: "var(--dt-text-muted)", marginTop: 2 }}>
              {queue.length} {queue.length === 1 ? "track" : "tracks"} · everyone can add
            </div>
          </div>
          {queue.length > 1 && (
            <button type="button" className="dt-icon-btn" onClick={emitClearQueue} aria-label="Clear queue" title="Clear up next">
              <IconTrash size={14} />
            </button>
          )}
        </div>
        <div className="dt-side-queue-body">
          <QueueList
            queue={queue}
            getTrack={getTrackForQueueItem}
            getPeer={getPeerById}
            activeQueueItemId={activeQueueItemId}
            transfers={uiTransfers}
            onPlayItem={(id) => void playQueueItem(id, true)}
            onRemove={emitQueueRemove}
            onMove={emitQueueReorder}
            embedded
          />
        </div>
      </aside>

      <TransportBar
        track={activeTrack}
        positionSec={playback.positionSec}
        durationSec={playback.durationSec}
        isPlaying={isPlaying}
        transfer={uiTransfers[0]}
        onTogglePlay={handleTogglePlay}
        onNext={handleNext}
        onPrev={handlePrev}
        onSeek={handleSeek}
        onExpandNowPlaying={() => setNpOpen(true)}
        onOpenQueue={() => setQueueSheetOpen(true)}
        queueLength={queue.length}
        hostPeer={hostPeer}
      />

      <NowPlayingOverlay
        open={npOpen}
        onClose={() => setNpOpen(false)}
        track={activeTrack}
        positionSec={playback.positionSec}
        durationSec={playback.durationSec}
        isPlaying={isPlaying}
        onPlayPause={handleTogglePlay}
        onSeek={handleSeek}
        onNext={handleNext}
        onPrev={handlePrev}
        queue={queue}
        getTrack={getTrackForQueueItem}
        getPeer={getPeerById}
        activeQueueItemId={activeQueueItemId}
        onPlayItem={(id) => void playQueueItem(id, true)}
        transfers={uiTransfers}
        hostPeer={hostPeer}
        onOpenQueue={() => setQueueSheetOpen(true)}
        onOpenInvite={() => setInviteOpen(true)}
        onBecomeHost={emitBecomeHost}
        peers={uiPeers}
        roomName={roomStore.roomName ?? null}
        isYouHost={isHost}
      />

      <QueueSheet
        open={queueSheetOpen}
        onClose={() => setQueueSheetOpen(false)}
        queue={queue}
        getTrack={getTrackForQueueItem}
        getPeer={getPeerById}
        activeQueueItemId={activeQueueItemId}
        transfers={uiTransfers}
        onPlayItem={(id) => void playQueueItem(id, true)}
        onRemove={emitQueueRemove}
        onMove={emitQueueReorder}
        onClear={emitClearQueue}
      />

      <LobbyModal
        open={lobbyOpen}
        onClose={() => roomStore.isConnected && setLobbyOpen(false)}
        onJoin={(roomId, roomName) => { connectRoom(roomId, roomName); setLobbyOpen(false); }}
        onCreate={createRoom}
        rooms={rooms}
        roomNameInput={roomNameInput}
        setRoomNameInput={setRoomNameInput}
      />

      <InviteSheet
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        room={roomInfo}
        inviteUrl={roomInfo ? `http://${lanIp ?? window.location.hostname}:${window.location.port || "5173"}/?room=${encodeURIComponent(roomInfo.id)}` : ""}
        peers={uiPeers}
      />

      {/* Error toasts */}
      {(indexError ?? playbackError ?? (roomError && roomStore.isConnected ? roomError : null)) && (
        <div style={{ position: "fixed", bottom: "calc(var(--transport-h, 80px) + 16px)", left: "50%", transform: "translateX(-50%)", padding: "10px 16px", borderRadius: 12, background: "oklch(0.3 0.08 30)", color: "white", fontSize: 13, zIndex: 9999, maxWidth: "90vw", textAlign: "center" }}>
          {indexError ?? playbackError ?? roomError}
        </div>
      )}
    </div>
  );
}
