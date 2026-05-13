/* global React, trackById, peerById, fmtTime, isLocalToYou,
   IconPlay, IconPause, IconNext, IconPrev, IconQueue, IconDownload */

function TransportBar({
  track, playback, transfer,
  onTogglePlay, onNext, onPrev, onSeek,
  onExpandNowPlaying, onOpenQueue, queueLength, hostPeerId
}) {
  if (!track) {
    return (
      <div className="dt-transport">
        <div className="dt-transport-art" style={{ background: 'var(--dt-tint)' }} />
        <div className="dt-transport-info">
          <div className="dt-transport-title" style={{ color: 'var(--dt-text-muted)' }}>Nothing playing</div>
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

  const isPlaying = playback.status === 'playing';
  const positionSec = playback.positionSec || 0;
  const duration = track.durationSec || 1;
  const pct = Math.min(100, (positionSec / duration) * 100);
  const host = peerById(hostPeerId);

  const onScrubClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    onSeek(ratio * duration);
  };

  return (
    <div className="dt-transport">
      <div className="dt-transport-progress" onClick={onScrubClick} aria-label="Seek">
        <div className="dt-transport-progress-fill" style={{ width: `${pct}%` }} />
      </div>

      <div className={`dt-transport-art dt-art-grad-${track.gradIdx}`} onClick={onExpandNowPlaying} style={{ cursor: 'pointer', position: 'relative' }}>
        <div style={{
          position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
          color: 'white', fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif',
          fontSize: 20, textShadow: '0 2px 6px oklch(0 0 0 / 0.3)'
        }}>
          {(track.title || '?').charAt(0).toUpperCase()}
        </div>
      </div>

      <div className="dt-transport-info" onClick={onExpandNowPlaying}>
        <div className="dt-transport-title">{track.title}</div>
        <div className="dt-transport-meta">
          <span className="dt-host-tag">
            <span className="dt-host-tag-dot" />
            {host?.isYou ? 'On this device' : host?.name}
          </span>
          {transfer && (
            <>
              <span className="dt-transport-meta-dot">·</span>
              <span className="dt-transfer-pill" style={{ padding: '1px 6px', fontSize: 9 }}>
                <IconDownload size={9} />
                {transfer.progress}%
              </span>
            </>
          )}
        </div>
      </div>

      <div className="dt-transport-controls">
        <button type="button" className="dt-transport-btn" onClick={onPrev} aria-label="Previous">
          <IconPrev size={20} />
        </button>
        <button
          type="button"
          className="dt-transport-btn dt-transport-btn-play dt-transport-btn-keep"
          onClick={onTogglePlay}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <IconPause size={20} /> : <IconPlay size={20} />}
        </button>
        <button type="button" className="dt-transport-btn" onClick={onNext} aria-label="Next">
          <IconNext size={20} />
        </button>
        <button type="button" className="dt-transport-btn dt-transport-btn-keep" onClick={onOpenQueue} aria-label="Open queue" style={{ position: 'relative' }}>
          <IconQueue size={20} />
          {queueLength > 0 && (
            <span style={{
              position: 'absolute', top: 2, right: 2,
              minWidth: 16, height: 16, padding: '0 4px',
              borderRadius: 999, background: 'var(--dt-accent)', color: 'var(--dt-on-accent)',
              fontSize: 10, fontWeight: 800, fontVariantNumeric: 'tabular-nums',
              display: 'grid', placeItems: 'center'
            }}>{queueLength}</span>
          )}
        </button>
      </div>
    </div>
  );
}

Object.assign(window, { TransportBar });
