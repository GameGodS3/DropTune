/* global React, trackById, peerById, fmtTime, isLocalToYou,
   TrackArt, SourcePeerChip,
   IconClose, IconGrip, IconArrowUp, IconArrowDown, IconTrash,
   IconQueue, IconPlay, IconMusic */

function QueueList({
  queue,
  activeQueueItemId,
  transfers,
  onPlayItem,
  onRemove,
  onMove,
  embedded = false  // true when in side panel (no header etc.)
}) {
  const transferByTrack = React.useMemo(() => {
    const map = {};
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
    <div style={{ padding: embedded ? '0' : '0 8px' }}>
      {queue.map((item, index) => {
        const track = trackById(item.trackId);
        if (!track) return null;
        const isActive = item.id === activeQueueItemId;
        const isLocal = isLocalToYou(track);
        const primaryOwner = isLocal ? 'p0' : track.owners[0];
        const transfer = transferByTrack[track.id];

        return (
          <div key={item.id} className={`dt-queue-item ${isActive ? 'is-active' : ''}`}>
            <button type="button" className="dt-queue-grip" aria-label="Drag to reorder">
              <IconGrip size={16} />
            </button>
            <div className="dt-queue-art" onClick={() => onPlayItem(item.id)}>
              <div className={`dt-track-art-gradient dt-art-grad-${track.gradIdx}`} />
              <div className="dt-track-art-letter" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 18 }}>
                {(track.title || '?').charAt(0).toUpperCase()}
              </div>
              {isActive && (
                <div style={{ position: 'absolute', inset: 0, background: 'oklch(0 0 0 / 0.45)', display: 'grid', placeItems: 'center', color: 'white' }}>
                  <span className="dt-playing-bars">
                    <span /><span /><span />
                  </span>
                </div>
              )}
            </div>
            <div className="dt-queue-info" onClick={() => onPlayItem(item.id)} style={{ cursor: 'pointer' }}>
              <div className="dt-queue-title">{track.title}</div>
              <div className="dt-queue-sub">
                <span>{track.artist}</span>
                <span className="dt-track-sub-dot">·</span>
                <SourcePeerChip ownerId={primaryOwner} />
                {transfer && (
                  <>
                    <span className="dt-track-sub-dot">·</span>
                    <span className="dt-transfer-pill">
                      <span className="dt-spinner-dot" />
                      {transfer.progress}%
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="dt-queue-actions">
              <button
                type="button"
                className="dt-icon-btn"
                onClick={() => onMove(index, index - 1)}
                disabled={index === 0}
                style={{ opacity: index === 0 ? 0.35 : 1 }}
                aria-label="Move up"
              >
                <IconArrowUp size={16} />
              </button>
              <button
                type="button"
                className="dt-icon-btn"
                onClick={() => onMove(index, index + 1)}
                disabled={index === queue.length - 1}
                style={{ opacity: index === queue.length - 1 ? 0.35 : 1 }}
                aria-label="Move down"
              >
                <IconArrowDown size={16} />
              </button>
              <button
                type="button"
                className="dt-icon-btn"
                onClick={() => onRemove(item.id)}
                aria-label="Remove from queue"
              >
                <IconTrash size={16} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function QueueSheet({ open, onClose, queue, activeQueueItemId, transfers, onPlayItem, onRemove, onMove, onClear }) {
  const upcoming = queue.filter((q) => q.id !== activeQueueItemId);
  return (
    <>
      <div className={`dt-sheet-scrim dt-queue-sheet-scrim ${open ? 'is-open' : ''}`} onClick={onClose} />
      <div className={`dt-sheet dt-queue-sheet ${open ? 'is-open' : ''}`}>
        <div className="dt-sheet-handle" />
        <div className="dt-sheet-header">
          <div>
            <div className="dt-sheet-title">Queue</div>
            <div className="dt-sheet-sub">{upcoming.length} up next · everyone in the room can add</div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
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
          <QueueList
            queue={queue}
            activeQueueItemId={activeQueueItemId}
            transfers={transfers}
            onPlayItem={onPlayItem}
            onRemove={onRemove}
            onMove={onMove}
          />
        </div>
      </div>
    </>
  );
}

Object.assign(window, { QueueList, QueueSheet });
