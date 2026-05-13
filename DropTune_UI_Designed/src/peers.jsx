/* global React, peerById */

function PeerAvatar({ peer, size = 40, withHostRing = false, withYouDot = false }) {
  if (!peer) return null;
  const style = { width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.36)) };
  return (
    <div className="dt-peer-avatar-wrap">
      <div className={`dt-peer-avatar dt-peer-${peer.colorIdx}`} style={style}>
        {peer.short}
      </div>
      {withHostRing && <div className="dt-peer-avatar-host-ring" />}
    </div>
  );
}

function PeerChip({ peerId, isThisDevice }) {
  const peer = peerById(peerId);
  if (!peer) return null;
  return (
    <span className={`dt-peer-chip ${isThisDevice ? 'is-this' : ''}`}>
      <span className={`dt-peer-chip-avatar dt-peer-${peer.colorIdx}`}>{peer.short}</span>
      {isThisDevice ? 'On this device' : peer.name}
    </span>
  );
}

// Small art tile with letter + gradient
function TrackArt({ track, size = 48, radius = 10 }) {
  if (!track) return null;
  const letter = (track.title || '?').trim().charAt(0).toUpperCase();
  const style = { width: size, height: size, borderRadius: radius };
  return (
    <div className="dt-track-art" style={style}>
      <div className={`dt-track-art-gradient dt-art-grad-${track.gradIdx}`} />
      <div className="dt-track-art-letter" style={{ fontSize: Math.round(size * 0.42) }}>
        {letter}
      </div>
    </div>
  );
}

Object.assign(window, { PeerAvatar, PeerChip, TrackArt });
