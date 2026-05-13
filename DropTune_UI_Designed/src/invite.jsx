/* global React, qrcode, ROOM_INFO, PEERS, IconClose, IconCopy, IconCheck, IconUsers, IconHost, IconWifi */

// Render a QR code via the `qrcode-generator` library and emit as SVG.
function renderQR(text, cellSize = 8, margin = 2) {
  // typeNumber 0 = auto, errorCorrectLevel 'M'
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const moduleCount = qr.getModuleCount();
  const size = moduleCount + margin * 2;
  const rects = [];
  for (let r = 0; r < moduleCount; r++) {
    for (let c = 0; c < moduleCount; c++) {
      if (qr.isDark(r, c)) {
        rects.push(
          <rect
            key={`${r}-${c}`}
            x={c + margin}
            y={r + margin}
            width={1.04}
            height={1.04}
            rx={0.2}
          />
        );
      }
    }
  }
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${size} ${size}`}
      shapeRendering="crispEdges"
      fill="currentColor"
    >
      {rects}
    </svg>
  );
}

function InviteSheet({ open, onClose, room, hostIP, port }) {
  const [copied, setCopied] = React.useState(false);
  const url = `http://${hostIP}:${port}/?room=${encodeURIComponent(room?.id || '')}`;

  const onCopy = () => {
    if (navigator.clipboard) navigator.clipboard.writeText(url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <>
      <div className={`dt-sheet-scrim ${open ? 'is-open' : ''}`} onClick={onClose} />
      <div className={`dt-sheet ${open ? 'is-open' : ''}`}>
        <div className="dt-sheet-handle" />
        <div className="dt-sheet-header">
          <div>
            <div className="dt-sheet-title">Invite to {room?.name || 'this room'}</div>
            <div className="dt-sheet-sub">Anyone on this Wi-Fi can scan and join — no app, no account.</div>
          </div>
          <button type="button" className="dt-icon-btn" onClick={onClose} aria-label="Close">
            <IconClose size={18} />
          </button>
        </div>
        <div className="dt-sheet-body" style={{ padding: '0 20px 24px' }}>
          <div className="dt-qr-card">
            <div className="dt-qr-svg" style={{ color: 'oklch(0.18 0.014 280)' }}>
              {renderQR(url)}
            </div>
            <p style={{ fontSize: 13, color: 'oklch(0.45 0.014 280)', margin: 0, textAlign: 'center' }}>
              Point a phone camera at the code
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--dt-text-muted)' }}>
              or share this URL
            </div>
            <div className="dt-qr-url" style={{ width: '100%' }}>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{url}</span>
              <button type="button" className="dt-qr-url-copy" onClick={onCopy} aria-label="Copy link">
                {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 16, fontSize: 12, color: 'var(--dt-text-muted)' }}>
            <div style={{ flex: 1, padding: 12, borderRadius: 12, background: 'var(--dt-tint)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Host</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--dt-text)' }}>
                <IconHost size={14} />
                <span style={{ fontWeight: 600 }}>You</span>
              </div>
            </div>
            <div style={{ flex: 1, padding: 12, borderRadius: 12, background: 'var(--dt-tint)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Listening</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--dt-text)' }}>
                <IconUsers size={14} />
                <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{PEERS.filter((p) => p.online).length}</span>
              </div>
            </div>
            <div style={{ flex: 1, padding: 12, borderRadius: 12, background: 'var(--dt-tint)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Network</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--dt-text)' }}>
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

Object.assign(window, { InviteSheet });
