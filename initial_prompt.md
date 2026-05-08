You are a senior systems architect and staff-level full-stack engineer.

Your task is to design and incrementally implement a production-quality MVP called “DropTune”.

IMPORTANT:
Do NOT overengineer.
Do NOT introduce unnecessary abstractions.
Do NOT use microservices.
Do NOT use Kubernetes.
Do NOT use Redis/Postgres unless explicitly requested later.
Do NOT add cloud dependencies.
Do NOT add authentication.
Do NOT add streaming platform integrations.
Do NOT use Electron initially.

The goal is:
A local-network collaborative music playback system that works offline on LAN.

==================================================
PRODUCT SUMMARY
==================================================

DropTune is a LAN-first collaborative music playback app.

Multiple devices on the same network can:

- share local music folders
- expose metadata only
- collaboratively search all indexed tracks
- collaboratively manage a queue
- choose a playback host
- transfer music files peer-to-peer on demand
- synchronize playback state

Playback physically occurs on ONE active host device at a time.

Files remain local to their original device unless requested.

The app must work WITHOUT internet access.

==================================================
CORE ARCHITECTURE
==================================================

The system consists of:

1. Browser UI
2. Local coordinator daemon
3. WebSocket control plane
4. WebRTC data plane
5. Local playback engine

Architecture principle:

STRICTLY separate:
- Control Plane
from
- Data Plane

Control Plane:
- room state
- queue state
- participant presence
- playback events
- signaling

Data Plane:
- actual media transfer only

==================================================
TECH STACK (MANDATORY)
==================================================

Frontend:
- React
- TypeScript
- Vite
- Zustand
- Tailwind CSS

Coordinator:
- Node.js
- TypeScript
- ws (raw WebSockets)
- Express (minimal usage)
- bonjour-service (mDNS discovery)

Playback:
- HTMLAudioElement only

P2P Transfer:
- Native WebRTC Data Channels
- NO PeerJS initially

Metadata Parsing:
- music-metadata-browser

Storage:
- IndexedDB via idb wrapper

Packaging:
- coordinator should be packageable later as standalone executable

==================================================
PROJECT STRUCTURE
==================================================

Create a monorepo structure:

/apps
  /web
  /coordinator

/packages
  /shared-types
  /protocol

Use pnpm workspaces.

==================================================
FUNCTIONAL REQUIREMENTS
==================================================

==================================================
PHASE 1 — LOCAL SINGLE DEVICE MVP
==================================================

Implement:

1. Folder selection
2. Local metadata indexing
3. Search UI
4. Queue management
5. Local playback

NO networking yet.

--------------------------------------------------
Folder Access
--------------------------------------------------

Use:
- File System Access API when available
- fallback to input webkitdirectory

User manually selects folders.

NO automatic scanning.

--------------------------------------------------
Metadata Extraction
--------------------------------------------------

Extract:
- filename
- track title
- artist if available
- album if available
- duration
- format
- approximate size

Supported formats:
- MP3
- FLAC
- WAV
- M4A/AAC

Store indexed metadata in IndexedDB.

DO NOT store actual audio files in IndexedDB during indexing.

--------------------------------------------------
State Model
--------------------------------------------------

Use Zustand stores.

Suggested stores:
- roomStore
- libraryStore
- playbackStore
- queueStore
- peerStore
- transferStore

==================================================
PHASE 2 — LOCAL COORDINATOR
==================================================

Build the local coordinator daemon.

Coordinator responsibilities:
- host websocket server
- maintain room state
- maintain participant registry
- maintain authoritative queue state
- relay playback events
- relay WebRTC signaling
- advertise rooms via mDNS

Coordinator MUST run locally on LAN.

--------------------------------------------------
Coordinator APIs
--------------------------------------------------

Implement:

HTTP:
- GET /health
- GET /rooms
- POST /rooms/create

WebSocket:
- realtime room connection

--------------------------------------------------
mDNS Discovery
--------------------------------------------------

Advertise:
_droptune._tcp.local

Allow clients to discover nearby rooms automatically.

==================================================
PHASE 3 — REALTIME ROOM SYNC
==================================================

Implement realtime synchronization.

WebSocket event protocol should include:

JOIN_ROOM
LEAVE_ROOM
ROOM_STATE
QUEUE_ADD
QUEUE_REMOVE
QUEUE_REORDER
PLAY
PAUSE
SEEK
HOST_CHANGE
PLAYBACK_STATE
FILE_REQUEST
FILE_AVAILABLE
WEBRTC_SIGNAL

Use shared TypeScript protocol types.

==================================================
PHASE 4 — PLAYBACK HOST MODEL
==================================================

At any time:
ONE participant is playback host.

Host responsibilities:
- execute playback
- request media
- maintain playback state
- broadcast playback position
- preload next tracks

All participants can:
- control playback
- modify queue

BUT:
host remains authoritative playback executor.

==================================================
PHASE 5 — WEBRTC FILE TRANSFER
==================================================

Implement peer-to-peer media transfer.

IMPORTANT:
Do NOT implement true live streaming initially.

Instead:
transfer full files in chunks.

Flow:
1. Host requests track
2. Source device opens RTCDataChannel
3. Source sends chunks
4. Host reconstructs Blob
5. Host creates Blob URL
6. HTMLAudioElement plays Blob URL

--------------------------------------------------
Chunking Strategy
--------------------------------------------------

Use:
- fixed chunk sizes
- chunk acknowledgements optional
- simple sequential transfer initially

Optimize for:
- reliability
- simplicity
- debuggability

NOT maximum efficiency.

==================================================
PHASE 6 — FILE MATCHING
==================================================

When host needs a track:

1. Check local indexed library first
2. Match using:
   - normalized filename
   - track title
   - duration tolerance

If local equivalent exists:
- play local version

Else:
- request transfer from source peer

NO advanced fingerprinting initially.

==================================================
PHASE 7 — PREFETCH SYSTEM
==================================================

Implement preload system.

Host should:
- maintain current track
- preload next N tracks

Suggested:
N = 2 initially.

Transferred files may be:
- stored temporarily in memory
OR
- temporarily cached in IndexedDB

==================================================
PHASE 8 — HOST MIGRATION
==================================================

Implement host switching.

Host switching should preserve:
- queue state
- current playback position
- playback status
- room state

Use authoritative room snapshots.

==================================================
UI REQUIREMENTS
==================================================

UI should be:
- minimal
- modern
- low-clutter
- responsive

Primary views:
- Nearby Rooms
- Create Room
- Room Lobby
- Shared Search
- Queue
- Playback Controls
- Transfer Status

==================================================
IMPORTANT ENGINEERING CONSTRAINTS
==================================================

==================================================
DO NOT:
==================================================

- Do NOT use Socket.IO initially
- Do NOT use Redux
- Do NOT use GraphQL
- Do NOT use Electron
- Do NOT use Tauri initially
- Do NOT use server-side databases
- Do NOT use cloud storage
- Do NOT use SSR frameworks
- Do NOT use Next.js
- Do NOT use mediasoup
- Do NOT use PeerJS abstractions
- Do NOT implement streaming platform integrations
- Do NOT implement accounts/auth

==================================================
DO:
==================================================

- Prefer plain TypeScript
- Prefer explicit state machines
- Prefer simplicity over abstraction
- Keep networking inspectable/debuggable
- Use strong typings
- Separate protocol definitions cleanly
- Build incrementally
- Ensure LAN-only operation works without internet

==================================================
CRITICAL DESIGN PRINCIPLES
==================================================

1. Local-first
2. Offline-first
3. Browser-centric UI
4. Peer-to-peer media transfer
5. Temporary collaborative sessions
6. Minimal infrastructure
7. Fast iteration
8. Debuggable networking
9. Modular architecture
10. Coordinator only handles control traffic

==================================================
EXPECTED OUTPUT
==================================================

First:
1. Design the complete folder structure
2. Define protocol schemas
3. Define Zustand stores
4. Define coordinator architecture
5. Define WebRTC lifecycle
6. Define playback state machine

Then:
Implement incrementally phase-by-phase.

At each phase:
- explain architecture decisions
- generate code
- generate types
- generate interfaces
- generate setup instructions
- generate run commands
- generate debugging guidance

Prefer complete working implementations over pseudocode.

Always explain:
- why architectural decisions are being made
- tradeoffs
- future extensibility implications

==================================================
SUCCESS CRITERIA
==================================================

The MVP is successful if users can:

1. Create a LAN room
2. Discover nearby rooms
3. Join room from multiple devices
4. Share local folders
5. Search all shared metadata
6. Queue tracks collaboratively
7. Transfer tracks peer-to-peer
8. Play tracks successfully
9. Switch playback host
10. Operate entirely offline on local network

==================================================
FINAL IMPORTANT NOTE
==================================================

Optimize for:
- reliability
- maintainability
- simplicity
- debuggability

NOT:
- theoretical purity
- premature optimization
- enterprise complexity

Build a REAL working MVP.