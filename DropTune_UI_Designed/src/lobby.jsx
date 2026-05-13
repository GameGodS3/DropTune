/* global React, NEARBY_ROOMS, IconClose, IconUsers, IconChevRight, IconPlus, IconFolder, IconLibrary, IconWifi */

function LobbyModal({ open, onJoin, onCreate, onClose }) {
  const [roomNameInput, setRoomNameInput] = React.useState('Living Room');
  return (
    <div className={`dt-modal-scrim ${open ? 'is-open' : ''}`} onClick={onClose}>
      <div className="dt-modal" onClick={(e) => e.stopPropagation()}>
        <div className="dt-modal-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h2 className="dt-modal-title">Welcome to DropTune</h2>
            <p className="dt-modal-sub">Listen together with anyone on this network.</p>
          </div>
          <button type="button" className="dt-icon-btn" onClick={onClose} aria-label="Close">
            <IconClose size={18} />
          </button>
        </div>

        <div className="dt-modal-body">
          <div className="dt-modal-section" style={{ marginTop: 0 }}>
            <h3 className="dt-modal-section-label">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <IconWifi size={12} />
                Rooms on this network
              </span>
            </h3>
            <div>
              {NEARBY_ROOMS.map((room) => (
                <button
                  type="button"
                  className="dt-lobby-room"
                  key={room.id}
                  onClick={() => onJoin(room)}
                >
                  <div className="dt-lobby-room-avatar">
                    {room.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="dt-lobby-room-info">
                    <div className="dt-lobby-room-name">{room.name}</div>
                    <div className="dt-lobby-room-meta">
                      <IconUsers size={12} />
                      {room.participants} listening
                      <span style={{ opacity: 0.5 }}>·</span>
                      {room.lastActive}
                    </div>
                  </div>
                  <div className="dt-lobby-room-arrow">
                    <IconChevRight size={18} />
                  </div>
                </button>
              ))}
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
              <button
                type="button"
                className="dt-btn dt-btn-primary"
                onClick={() => onCreate(roomNameInput || 'New Room')}
              >
                <IconPlus size={16} />
                Create
              </button>
            </div>
            <p style={{ fontSize: 12, color: 'var(--dt-text-muted)', margin: '10px 2px 0' }}>
              You'll become the playback host. Others can join via QR code.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { LobbyModal });
