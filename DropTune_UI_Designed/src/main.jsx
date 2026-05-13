/* global React, ReactDOM,
   PEERS, TRACKS, INITIAL_QUEUE, INITIAL_PLAYBACK, INITIAL_TRANSFERS, ROOM_INFO,
   peerById, trackById,
   TransportBar, LibraryView, QueueSheet, QueueList, NowPlayingOverlay, LobbyModal, InviteSheet,
   PeerAvatar,
   IconLibrary, IconQueue, IconList, IconUsers, IconQr, IconShare, IconSettings,
   IconHost, IconWifi, IconChevDown, IconFolderPlus, IconCheck,
   TweaksPanel, TweakSection, TweakRadio, TweakColor, TweakToggle, TweakSelect, useTweaks */

const DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "dark",
  "accent": "magenta",
  "npStyle": "ambient"
}/*EDITMODE-END*/;

function App() {
  const [tweaks, setTweak] = useTweaks(DEFAULTS);

  // Room / connection
  const [connected, setConnected] = React.useState(false);
  const [lobbyOpen, setLobbyOpen] = React.useState(true);
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [currentRoom, setCurrentRoom] = React.useState(null);

  // Library
  const [query, setQuery] = React.useState('');
  const [peerFilter, setPeerFilter] = React.useState('all');

  // Mobile view tabs
  const [mobileTab, setMobileTab] = React.useState('library'); // library | peers

  // Queue + playback
  const [queue, setQueue] = React.useState(INITIAL_QUEUE);
  const [activeQueueItemId, setActiveQueueItemId] = React.useState(INITIAL_QUEUE[0].id);
  const [playback, setPlayback] = React.useState(INITIAL_PLAYBACK);
  const [transfers, setTransfers] = React.useState(INITIAL_TRANSFERS);

  // Sheets
  const [queueSheetOpen, setQueueSheetOpen] = React.useState(false);
  const [npOpen, setNpOpen] = React.useState(false);

  // Simulate playback time advancing
  React.useEffect(() => {
    if (playback.status !== 'playing') return;
    const t = setInterval(() => {
      setPlayback((p) => {
        const next = p.positionSec + 1;
        return { ...p, positionSec: next };
      });
    }, 1000);
    return () => clearInterval(t);
  }, [playback.status]);

  // Simulate transfer progress
  React.useEffect(() => {
    if (transfers.length === 0) return;
    const t = setInterval(() => {
      setTransfers((ts) => ts
        .map((tr) => ({ ...tr, progress: Math.min(100, tr.progress + Math.floor(Math.random() * 4 + 2)) }))
        .filter((tr) => tr.progress < 100)
      );
    }, 800);
    return () => clearInterval(t);
  }, [transfers.length]);

  // Auto-advance when track ends
  const activeItem = queue.find((q) => q.id === activeQueueItemId);
  const activeTrack = activeItem ? trackById(activeItem.trackId) : null;
  React.useEffect(() => {
    if (!activeTrack) return;
    if (playback.positionSec >= activeTrack.durationSec) {
      const idx = queue.findIndex((q) => q.id === activeQueueItemId);
      if (idx >= 0 && idx < queue.length - 1) {
        setActiveQueueItemId(queue[idx + 1].id);
        setPlayback((p) => ({ ...p, positionSec: 0 }));
      } else {
        setPlayback((p) => ({ ...p, positionSec: activeTrack.durationSec, status: 'paused' }));
      }
    }
  }, [playback.positionSec, activeTrack, queue, activeQueueItemId]);

  // ===== Actions =====
  const onJoinRoom = (room) => {
    setCurrentRoom(room);
    setConnected(true);
    setLobbyOpen(false);
  };
  const onCreateRoom = (name) => {
    setCurrentRoom({ ...ROOM_INFO, name });
    setConnected(true);
    setLobbyOpen(false);
    // After create, suggest sharing
    setTimeout(() => setInviteOpen(true), 350);
  };

  const onTogglePlay = () => {
    setPlayback((p) => ({ ...p, status: p.status === 'playing' ? 'paused' : 'playing' }));
  };

  const onSeek = (sec) => {
    setPlayback((p) => ({ ...p, positionSec: Math.max(0, sec) }));
  };

  const onNext = () => {
    const idx = queue.findIndex((q) => q.id === activeQueueItemId);
    if (idx >= 0 && idx < queue.length - 1) {
      setActiveQueueItemId(queue[idx + 1].id);
      setPlayback((p) => ({ ...p, positionSec: 0, status: 'playing' }));
    }
  };
  const onPrev = () => {
    if (playback.positionSec > 4) {
      setPlayback((p) => ({ ...p, positionSec: 0 }));
      return;
    }
    const idx = queue.findIndex((q) => q.id === activeQueueItemId);
    if (idx > 0) {
      setActiveQueueItemId(queue[idx - 1].id);
      setPlayback((p) => ({ ...p, positionSec: 0, status: 'playing' }));
    }
  };

  const onPlayTrack = (trackId) => {
    // If already in queue, jump to it. Else add and play.
    const existing = queue.find((q) => q.trackId === trackId);
    if (existing) {
      setActiveQueueItemId(existing.id);
    } else {
      const newItem = { id: 'q' + Math.random().toString(36).slice(2, 8), trackId, addedBy: 'p0' };
      setQueue((q) => {
        const idx = q.findIndex((it) => it.id === activeQueueItemId);
        const next = [...q];
        next.splice(idx + 1, 0, newItem);
        return next;
      });
      setActiveQueueItemId(newItem.id);
    }
    setPlayback((p) => ({ ...p, positionSec: 0, status: 'playing' }));
    // Simulate transfer if track isn't local AND we're host
    const track = trackById(trackId);
    if (track && !track.owners.includes('p0') && playback.hostPeerId === 'p0') {
      setTransfers((ts) => {
        if (ts.find((t) => t.trackId === trackId)) return ts;
        return [...ts, { trackId, sourcePeerId: track.owners[0], progress: 5, status: 'downloading' }];
      });
    }
  };

  const onQueueTrack = (trackId) => {
    const newItem = { id: 'q' + Math.random().toString(36).slice(2, 8), trackId, addedBy: 'p0' };
    setQueue((q) => [...q, newItem]);
  };

  const onPlayItem = (queueItemId) => {
    setActiveQueueItemId(queueItemId);
    setPlayback((p) => ({ ...p, positionSec: 0, status: 'playing' }));
  };

  const onRemove = (queueItemId) => {
    setQueue((q) => q.filter((item) => item.id !== queueItemId));
  };

  const onMove = (from, to) => {
    if (to < 0 || to >= queue.length) return;
    setQueue((q) => {
      const next = [...q];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };

  const onClearQueue = () => {
    setQueue((q) => q.filter((item) => item.id === activeQueueItemId));
  };

  const onBecomeHost = () => {
    setPlayback((p) => ({ ...p, hostPeerId: 'p0' }));
  };

  // ===== Render =====
  const liveQueue = queue;

  return (
    <div
      className="dt-app"
      data-theme={tweaks.theme}
      data-accent={tweaks.accent}
    >
      <TopBar
        connected={connected}
        room={currentRoom}
        onOpenLobby={() => setLobbyOpen(true)}
        onOpenInvite={() => setInviteOpen(true)}
        hostPeerId={playback.hostPeerId}
      />

      <Tabs
        mobileTab={mobileTab}
        setMobileTab={setMobileTab}
        queueCount={liveQueue.length}
      />

      <Sidebar
        hostPeerId={playback.hostPeerId}
        onBecomeHost={onBecomeHost}
        onOpenInvite={() => setInviteOpen(true)}
        room={currentRoom}
      />

      <main className="dt-main">
        {mobileTab === 'peers' ? (
          <PeersView
            hostPeerId={playback.hostPeerId}
            onBecomeHost={onBecomeHost}
            onOpenInvite={() => setInviteOpen(true)}
          />
        ) : (
          <LibraryView
            query={query}
            setQuery={setQuery}
            peerFilter={peerFilter}
            setPeerFilter={setPeerFilter}
            onPlayTrack={onPlayTrack}
            onQueueTrack={onQueueTrack}
            activeTrackId={activeTrack?.id}
            isPlaying={playback.status === 'playing'}
            transfers={transfers}
            onAddFolder={() => {}}
          />
        )}
      </main>

      <aside className="dt-side-queue">
        <div className="dt-side-queue-header">
          <div>
            <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: 16, letterSpacing: '-0.01em' }}>Queue</div>
            <div style={{ fontSize: 12, color: 'var(--dt-text-muted)', marginTop: 2 }}>
              {liveQueue.length} {liveQueue.length === 1 ? 'track' : 'tracks'} · everyone can add
            </div>
          </div>
          {liveQueue.length > 1 && (
            <button
              type="button"
              className="dt-icon-btn"
              onClick={onClearQueue}
              aria-label="Clear queue"
              title="Clear up next"
            >
              <IconTrash size={14} />
            </button>
          )}
        </div>
        <div className="dt-side-queue-body">
          <QueueList
            queue={liveQueue}
            activeQueueItemId={activeQueueItemId}
            transfers={transfers}
            onPlayItem={onPlayItem}
            onRemove={onRemove}
            onMove={onMove}
            embedded
          />
        </div>
      </aside>

      <TransportBar
        track={activeTrack}
        playback={playback}
        transfer={transfers.find((t) => t.trackId === activeTrack?.id)}
        onTogglePlay={onTogglePlay}
        onNext={onNext}
        onPrev={onPrev}
        onSeek={onSeek}
        onExpandNowPlaying={() => setNpOpen(true)}
        onOpenQueue={() => setQueueSheetOpen(true)}
        queueLength={liveQueue.length}
        hostPeerId={playback.hostPeerId}
      />

      <NowPlayingOverlay
        open={npOpen}
        onClose={() => setNpOpen(false)}
        track={activeTrack}
        playback={playback}
        onPlayPause={onTogglePlay}
        onSeek={onSeek}
        onNext={onNext}
        onPrev={onPrev}
        queue={liveQueue}
        activeQueueItemId={activeQueueItemId}
        onPlayItem={onPlayItem}
        transfers={transfers}
        hostPeerId={playback.hostPeerId}
        onOpenQueue={() => setQueueSheetOpen(true)}
        onOpenInvite={() => setInviteOpen(true)}
        npStyle={tweaks.npStyle}
        onBecomeHost={onBecomeHost}
      />

      <QueueSheet
        open={queueSheetOpen}
        onClose={() => setQueueSheetOpen(false)}
        queue={liveQueue}
        activeQueueItemId={activeQueueItemId}
        transfers={transfers}
        onPlayItem={onPlayItem}
        onRemove={onRemove}
        onMove={onMove}
        onClear={onClearQueue}
      />

      <LobbyModal
        open={lobbyOpen}
        onClose={() => connected && setLobbyOpen(false)}
        onJoin={onJoinRoom}
        onCreate={onCreateRoom}
      />

      <InviteSheet
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        room={currentRoom || ROOM_INFO}
        hostIP={ROOM_INFO.hostIP}
        port={ROOM_INFO.port}
      />

      <TweaksUI tweaks={tweaks} setTweak={setTweak} />
    </div>
  );
}

function TopBar({ connected, room, onOpenLobby, onOpenInvite, hostPeerId }) {
  const host = peerById(hostPeerId);
  return (
    <header className="dt-topbar">
      <div className="dt-topbar-title">
        <div className="dt-logo">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v12.55A4 4 0 1 0 14 19V7h4V3h-6z" /></svg>
        </div>
        DropTune
      </div>
      <div className="dt-topbar-spacer" />

      {connected ? (
        <>
          <button type="button" className="dt-room-pill" onClick={onOpenLobby}>
            <span className="dt-room-pill-dot">
              {(room?.name || '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
            </span>
            <span className="dt-room-pill-name">{room?.name || 'Room'}</span>
            <span className="dt-room-pill-count">·</span>
            <span className="dt-room-pill-count">{room?.participants ?? PEERS.filter((p) => p.online).length}</span>
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

function Tabs({ mobileTab, setMobileTab, queueCount }) {
  const items = [
    { id: 'library', label: 'Library',  icon: <IconLibrary size={16} /> },
    { id: 'peers',   label: 'Devices',  icon: <IconUsers size={16} /> },
  ];
  return (
    <div className="dt-tabs">
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          className={`dt-tab ${mobileTab === it.id ? 'is-active' : ''}`}
          onClick={() => setMobileTab(it.id)}
        >
          {it.icon}
          {it.label}
        </button>
      ))}
    </div>
  );
}

function PeersView({ hostPeerId, onBecomeHost, onOpenInvite }) {
  return (
    <div style={{ padding: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 20, fontWeight: 700, margin: 0, letterSpacing: '-0.01em' }}>
            In this room
          </h2>
          <p style={{ fontSize: 13, color: 'var(--dt-text-muted)', margin: '2px 0 0' }}>
            {PEERS.filter((p) => p.online).length} devices · everyone can queue
          </p>
        </div>
        <button type="button" className="dt-btn dt-btn-ghost" onClick={onOpenInvite}>
          <IconShare size={14} /> Invite
        </button>
      </div>

      <div>
        {PEERS.filter((p) => p.online).map((peer) => {
          const isHost = peer.id === hostPeerId;
          return (
            <div key={peer.id} className="dt-peer-row">
              <PeerAvatar peer={peer} withHostRing={isHost} />
              <div className="dt-peer-info">
                <div className="dt-peer-name">
                  <span>{peer.name}</span>
                  {peer.isYou && <span className="dt-peer-name-you">YOU</span>}
                  {isHost && <span className="dt-peer-host-chip"><IconHost size={10} /> Host</span>}
                </div>
                <div className="dt-peer-meta">
                  {peer.device === 'speaker' && 'Audio output · always on'}
                  {peer.device === 'phone' && 'Phone · sharing music'}
                  {peer.device === 'macbook' && 'Laptop · sharing music'}
                  {peer.device === 'desktop' && 'Desktop · sharing music'}
                </div>
              </div>
              {!isHost && !peer.isYou && (
                <button
                  type="button"
                  className="dt-btn dt-btn-ghost"
                  onClick={() => {/* in real app: emit host transfer */}}
                  style={{ fontSize: 12, padding: '7px 12px' }}
                >
                  Make host
                </button>
              )}
              {!isHost && peer.isYou && (
                <button type="button" className="dt-btn dt-btn-ghost" onClick={onBecomeHost} style={{ fontSize: 12, padding: '7px 12px' }}>
                  Take over
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 28 }}>
        <h3 style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--dt-text-muted)', margin: '0 0 12px' }}>
          About this room
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <InfoRow label="Network">LAN · DropTune coordinator</InfoRow>
          <InfoRow label="Host IP"><span className="dt-mono">{ROOM_INFO.hostIP}:{ROOM_INFO.port}</span></InfoRow>
          <InfoRow label="Transfer">Peer-to-peer · WebRTC</InfoRow>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 12, background: 'var(--dt-tint)' }}>
      <span style={{ fontSize: 12, color: 'var(--dt-text-muted)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{label}</span>
      <span style={{ fontSize: 13 }}>{children}</span>
    </div>
  );
}

function Sidebar({ hostPeerId, onBecomeHost, onOpenInvite, room }) {
  const r = room || ROOM_INFO;
  return (
    <aside className="dt-side">
      <div className="dt-side-section">
        <h3 className="dt-side-label">Room</h3>
        <div style={{ padding: 12, borderRadius: 14, background: 'var(--dt-tint)', border: '1px solid var(--dt-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="dt-lobby-room-avatar" style={{ width: 36, height: 36, fontSize: 13 }}>
              {(r.name || '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</div>
              <div style={{ fontSize: 11, color: 'var(--dt-text-muted)', marginTop: 1 }}>
                {PEERS.filter((p) => p.online).length} listening · LAN
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
          {PEERS.filter((p) => p.online).map((peer) => {
            const isHost = peer.id === hostPeerId;
            return (
              <div key={peer.id} className="dt-peer-row" style={{ padding: '8px 0' }}>
                <PeerAvatar peer={peer} size={32} withHostRing={isHost} />
                <div className="dt-peer-info">
                  <div className="dt-peer-name" style={{ fontSize: 13 }}>
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{peer.name}</span>
                    {peer.isYou && <span className="dt-peer-name-you">YOU</span>}
                  </div>
                  {isHost && <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--dt-accent)', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 2, textShadow: '0 0 12px var(--dt-glow, var(--dt-accent))' }}>Host</div>}
                </div>
              </div>
            );
          })}
        </div>
        {hostPeerId !== 'p0' && (
          <button type="button" className="dt-btn dt-btn-primary dt-btn-block" onClick={onBecomeHost} style={{ marginTop: 10, fontSize: 13 }}>
            <IconHost size={14} /> Take over hosting
          </button>
        )}
      </div>

      <div className="dt-side-section">
        <h3 className="dt-side-label">Indexed folders</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {INDEXED_FOLDERS.slice(0, 3).map((folder) => (
            <div key={folder.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 10, background: 'var(--dt-tint)' }}>
              <IconFolder size={14} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {folder.name.replace('~/Music/', '').replace('~/Downloads/', '')}
                </div>
                <div style={{ fontSize: 10, color: 'var(--dt-text-muted)' }}>{folder.tracks} tracks</div>
              </div>
            </div>
          ))}
          <button type="button" className="dt-btn dt-btn-ghost" style={{ fontSize: 12, padding: '8px 12px' }}>
            <IconFolderPlus size={14} /> Add folder
          </button>
        </div>
      </div>
    </aside>
  );
}

const ACCENT_HEX = {
  magenta:  '#ff4fb5',
  electric: '#7aa5ff',
  teal:     '#46e1d7',
  amber:    '#ffb14a',
  lime:     '#c5f25e',
};
const ACCENT_ORDER = ['magenta', 'electric', 'teal', 'amber', 'lime'];
const HEX_TO_ACCENT = Object.fromEntries(ACCENT_ORDER.map((k) => [ACCENT_HEX[k].toLowerCase(), k]));

function TweaksUI({ tweaks, setTweak }) {
  return (
    <TweaksPanel>
      <TweakSection label="Theme">
        <TweakRadio
          label="Mode"
          value={tweaks.theme}
          onChange={(v) => setTweak('theme', v)}
          options={[
            { value: 'dark',     label: 'Dark' },
            { value: 'light',    label: 'Light' },
            { value: 'midnight', label: 'Night' },
          ]}
        />
        <TweakColor
          label="Accent"
          value={ACCENT_HEX[tweaks.accent] || ACCENT_HEX.amber}
          options={ACCENT_ORDER.map((k) => ACCENT_HEX[k])}
          onChange={(hex) => setTweak('accent', HEX_TO_ACCENT[String(hex).toLowerCase()] || 'amber')}
        />
      </TweakSection>
      <TweakSection label="Now playing">
        <TweakRadio
          label="Style"
          value={tweaks.npStyle}
          onChange={(v) => setTweak('npStyle', v)}
          options={[
            { value: 'minimal', label: 'Minimal' },
            { value: 'rich',    label: 'Rich' },
            { value: 'ambient', label: 'Ambient' },
          ]}
        />
      </TweakSection>
    </TweaksPanel>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
