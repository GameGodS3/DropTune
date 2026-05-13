/* global React, trackById, peerById, fmtTime, isLocalToYou, PEERS, ROOM_INFO,
   PeerAvatar, SourcePeerChip,
   IconChevDown, IconPlay, IconPause, IconNext, IconPrev,
   IconShuffle, IconRepeat, IconQueue, IconMore, IconShare,
   IconDownload, IconHost, IconSpeaker */

function NowPlayingOverlay({
  open, onClose, track, playback, onPlayPause, onSeek, onNext, onPrev,
  queue, activeQueueItemId, onPlayItem, transfers,
  hostPeerId, onOpenQueue, onOpenInvite, npStyle, onBecomeHost
}) {
  if (!track) return null;
  const isPlaying = playback.status === 'playing';
  const positionSec = playback.positionSec || 0;
  const duration = track.durationSec || 1;
  const pct = Math.min(100, Math.max(0, (positionSec / duration) * 100));
  const host = peerById(hostPeerId);
  const youAreHost = hostPeerId === 'p0';
  const transfer = transfers.find((t) => t.trackId === track.id);
  const upcoming = queue.filter((q) => q.id !== activeQueueItemId).slice(0, 3);
  const listeners = PEERS.filter((p) => p.online && !p.isYou);

  const onScrubClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    onSeek(ratio * duration);
  };

  return (
    <div className={`dt-np-overlay ${open ? 'is-open' : ''}`} role="dialog" aria-label="Now playing">
      <div className={`dt-np-bg dt-art-grad-${track.gradIdx}`} />
      <div className="dt-np-content">
        <div className="dt-np-header">
          <button type="button" className="dt-icon-btn" onClick={onClose} aria-label="Collapse">
            <IconChevDown size={20} />
          </button>
          <div className="dt-np-header-center">
            <div className="dt-np-header-label">Playing in</div>
            <div className="dt-np-header-room">{ROOM_INFO.name}</div>
          </div>
          <button type="button" className="dt-icon-btn" onClick={onOpenInvite} aria-label="More">
            <IconShare size={18} />
          </button>
        </div>

        <div className={`dt-np-art dt-art-grad-${track.gradIdx}`}>
          <div className="dt-np-art-letter">{(track.title || '?').charAt(0).toUpperCase()}</div>
          {transfer && (
            <div style={{
              position: 'absolute', bottom: 12, left: 12, right: 12,
              padding: '8px 12px', borderRadius: 12,
              background: 'oklch(0 0 0 / 0.4)', backdropFilter: 'blur(20px)',
              color: 'white', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8
            }}>
              <IconDownload size={14} />
              <span style={{ flex: 1 }}>Receiving from {peerById(transfer.sourcePeerId)?.name}</span>
              <span className="dt-mono">{transfer.progress}%</span>
            </div>
          )}
        </div>

        <div style={{ textAlign: 'center', padding: '0 8px' }}>
          <h2 className="dt-np-title">{track.title}</h2>
          <p className="dt-np-artist">{track.artist} · {track.album}</p>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div className={`dt-np-source ${isLocalToYou(track) ? 'is-local' : ''}`}>
              <SourcePeerChip ownerId={isLocalToYou(track) ? 'p0' : track.owners[0]} />
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
          <button type="button" className="dt-np-btn" aria-label="Shuffle">
            <IconShuffle size={18} />
          </button>
          <button type="button" className="dt-np-btn" onClick={onPrev} aria-label="Previous">
            <IconPrev size={26} />
          </button>
          <button type="button" className="dt-np-btn dt-np-btn-play" onClick={onPlayPause} aria-label={isPlaying ? 'Pause' : 'Play'}>
            {isPlaying ? <IconPause size={28} /> : <IconPlay size={28} />}
          </button>
          <button type="button" className="dt-np-btn" onClick={onNext} aria-label="Next">
            <IconNext size={26} />
          </button>
          <button type="button" className="dt-np-btn" aria-label="Repeat">
            <IconRepeat size={18} />
          </button>
        </div>

        {/* Host + listeners strip — visible in 'rich' and 'ambient' */}
        {npStyle !== 'minimal' && (
          <div className="dt-np-strip">
            <div className="dt-np-strip-section">
              <div className="dt-np-strip-label">Playing on</div>
              <div className="dt-np-host-row">
                <PeerAvatar peer={host} size={28} withHostRing />
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {host?.isYou ? 'This device' : host?.name}
                    </span>
                    <span className="dt-peer-host-chip">Host</span>
                  </div>
                  {!youAreHost && (
                    <button
                      type="button"
                      onClick={onBecomeHost}
                      style={{
                        fontSize: 11, fontWeight: 600, color: 'var(--dt-accent)', marginTop: 2,
                        textDecoration: 'underline', textUnderlineOffset: 3
                      }}
                    >
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
                  <div className="dt-np-listener" style={{ background: 'var(--dt-elevated)', color: 'var(--dt-text-muted)' }}>
                    +{listeners.length - 4}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Up-next preview — only in 'ambient' */}
        {npStyle === 'ambient' && upcoming.length > 0 && (
          <div className="dt-np-queue">
            <div className="dt-np-queue-header">
              <div className="dt-np-queue-title">Up next</div>
              <button type="button" className="dt-icon-btn" onClick={onOpenQueue} aria-label="Open queue">
                <IconQueue size={16} />
              </button>
            </div>
            <div className="dt-np-queue-list">
              {upcoming.map((item, i) => {
                const t = trackById(item.trackId);
                if (!t) return null;
                const addedBy = peerById(item.addedBy);
                return (
                  <div key={item.id} className="dt-np-queue-item" onClick={() => onPlayItem(item.id)} style={{ cursor: 'pointer' }}>
                    <div className="dt-np-queue-item-num">{i + 1}</div>
                    <div className="dt-np-queue-item-info">
                      <div className="dt-np-queue-item-title">{t.title}</div>
                      <div className="dt-np-queue-item-sub">
                        {t.artist} · added by {addedBy?.isYou ? 'you' : addedBy?.name.split(' ')[0]}
                      </div>
                    </div>
                    <div className="dt-mono" style={{ fontSize: 11, color: 'var(--dt-text-dim)' }}>
                      {fmtTime(t.durationSec)}
                    </div>
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

Object.assign(window, { NowPlayingOverlay });
