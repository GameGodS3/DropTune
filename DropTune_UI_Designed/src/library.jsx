/* global React, TRACKS, PEERS, peerById, trackById, fmtTime, isLocalToYou,
   TrackArt, IconSearch, IconPlay, IconPause, IconPlus, IconClose,
   IconFolderPlus, IconFolder, IconCheck, INDEXED_FOLDERS */

function LibraryView({
  query, setQuery,
  peerFilter, setPeerFilter,
  onPlayTrack, onQueueTrack,
  activeTrackId, isPlaying,
  transfers, onAddFolder
}) {
  // Filter & search
  const q = query.trim().toLowerCase();
  const tracks = React.useMemo(() => {
    return TRACKS.filter((t) => {
      if (peerFilter !== 'all' && !t.owners.includes(peerFilter)) return false;
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        (t.artist || '').toLowerCase().includes(q) ||
        (t.album || '').toLowerCase().includes(q)
      );
    });
  }, [q, peerFilter]);

  const transferByTrack = React.useMemo(() => {
    const map = {};
    for (const tr of transfers) map[tr.trackId] = tr;
    return map;
  }, [transfers]);

  return (
    <div>
      <SearchRow query={query} setQuery={setQuery} />
      <FilterChips peerFilter={peerFilter} setPeerFilter={setPeerFilter} />

      {tracks.length === 0 ? (
        <div className="dt-empty">
          <div className="dt-empty-icon"><IconSearch size={26} /></div>
          <div>
            <div className="dt-empty-title">No tracks match</div>
            <div className="dt-empty-text">Try a different search or peer filter.</div>
          </div>
        </div>
      ) : (
        <div className="dt-library">
          {tracks.map((track) => {
            const isActive = activeTrackId === track.id;
            const isLocal = isLocalToYou(track);
            // Primary "source" peer: prefer this device, else the first owner.
            const primaryOwner = isLocal ? 'p0' : track.owners[0];
            const transfer = transferByTrack[track.id];

            return (
              <div
                key={track.id}
                className={`dt-track ${isActive ? 'is-playing' : ''}`}
                onDoubleClick={() => onPlayTrack(track.id)}
              >
                <TrackArt track={track} />
                <div className="dt-track-info">
                  <div className="dt-track-title-row">
                    <span className="dt-track-title">{track.title}</span>
                    {isActive && (
                      <span className={`dt-playing-bars ${isPlaying ? '' : 'is-paused'}`}>
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
                    <SourcePeerChip ownerId={primaryOwner} extraOwners={track.owners.length - 1} />
                  </div>
                </div>
                <div className="dt-track-actions">
                  <span className="dt-track-duration">{fmtTime(track.durationSec)}</span>
                  <button
                    type="button"
                    className="dt-track-action"
                    onClick={() => onQueueTrack(track.id)}
                    title="Add to queue"
                    aria-label="Add to queue"
                  >
                    <IconPlus size={18} />
                  </button>
                  <button
                    type="button"
                    className="dt-track-action dt-action-play"
                    onClick={() => onPlayTrack(track.id)}
                    title="Play now"
                    aria-label="Play now"
                  >
                    <IconPlay size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ padding: '24px 16px 8px' }}>
        <h3 style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--dt-text-muted)', margin: '0 0 12px' }}>
          Shared folders
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {INDEXED_FOLDERS.map((folder) => (
            <div key={folder.id} className="dt-folder-card">
              <div className="dt-folder-icon"><IconFolder size={18} /></div>
              <div className="dt-folder-info">
                <div className="dt-folder-name">{folder.name}</div>
                <div className="dt-folder-meta">{folder.tracks} tracks · {folder.size}</div>
              </div>
              <button type="button" className="dt-icon-btn" aria-label="Remove folder">
                <IconClose size={16} />
              </button>
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

function SearchRow({ query, setQuery }) {
  return (
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
          <button type="button" className="dt-track-action" style={{ opacity: 1 }} onClick={() => setQuery('')} aria-label="Clear">
            <IconClose size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

function FilterChips({ peerFilter, setPeerFilter }) {
  return (
    <div className="dt-filter-chips">
      <button
        type="button"
        className={`dt-chip ${peerFilter === 'all' ? 'is-active' : ''}`}
        onClick={() => setPeerFilter('all')}
      >
        <span className="dt-chip-all">∗</span>
        All devices
      </button>
      {PEERS.filter((p) => p.online).map((peer) => (
        <button
          key={peer.id}
          type="button"
          className={`dt-chip ${peerFilter === peer.id ? 'is-active' : ''}`}
          onClick={() => setPeerFilter(peer.id)}
        >
          <span className={`dt-chip-avatar dt-peer-${peer.colorIdx}`}>{peer.short}</span>
          {peer.isYou ? 'This device' : peer.name.split(' ')[0] + (peer.name.includes('Speaker') ? ' Spkr' : '')}
        </button>
      ))}
    </div>
  );
}

function SourcePeerChip({ ownerId, extraOwners = 0 }) {
  const peer = peerById(ownerId);
  if (!peer) return null;
  const isYou = peer.isYou;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: isYou ? 'var(--dt-accent)' : 'inherit' }}>
      <span
        className={`dt-chip-avatar dt-peer-${peer.colorIdx}`}
        style={{ width: 16, height: 16, fontSize: 9 }}
      >
        {peer.short}
      </span>
      <span style={{ fontWeight: isYou ? 600 : 500 }}>
        {isYou ? 'This device' : peer.name}
      </span>
      {extraOwners > 0 && (
        <span style={{ color: 'var(--dt-text-dim)', fontSize: 11 }}>+{extraOwners}</span>
      )}
    </span>
  );
}

Object.assign(window, { LibraryView, SearchRow, FilterChips, SourcePeerChip });
