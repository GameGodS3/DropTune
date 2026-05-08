# DropTune MVP

LAN-first collaborative music playback for offline local networks.

## Current status

- Phase 1 implemented: local folder indexing, search, queue, and playback.
- Coordinator scaffold implemented for Phase 2/3: health/rooms HTTP, ws relay, mDNS advertisement.
- Shared protocol and domain types are centralized in workspace packages.

## Monorepo structure

```txt
apps/
  web/            # React + Vite frontend
  coordinator/    # Node.js local coordinator daemon
packages/
  shared-types/   # Domain models shared by all apps
  protocol/       # Control plane event schema/types
```

## Architecture decisions

- Control plane and data plane are strictly separated in design:
  - Control plane: `@droptune/protocol` event envelopes sent via ws.
  - Data plane: reserved for WebRTC DataChannel file transfer in later phases.
- No server DB, no cloud dependencies, no auth.
- Local-first browser playback uses `HTMLAudioElement`.
- Indexed metadata is persisted in IndexedDB (`idb`) while file blobs stay in local memory only.

## Protocol schema (control plane)

Defined in `packages/protocol/src/index.ts`:

- `JOIN_ROOM`, `LEAVE_ROOM`, `ROOM_STATE`
- `QUEUE_ADD`, `QUEUE_REMOVE`, `QUEUE_REORDER`
- `PLAY`, `PAUSE`, `SEEK`, `HOST_CHANGE`, `PLAYBACK_STATE`
- `FILE_REQUEST`, `FILE_AVAILABLE`, `WEBRTC_SIGNAL`

All messages use:

- `EventEnvelope<TType, TPayload>`
- `sentAt` timestamp
- optional `requestId` for correlation

## Zustand store model

`apps/web/src/stores`:

- `roomStore`: room identity + connection status
- `libraryStore`: indexed metadata + local file map + search query + hydration/indexing actions
- `queueStore`: queue add/remove/reorder
- `playbackStore`: playback status/position/duration/current track
- `peerStore`: local peer identity and display name
- `transferStore`: transfer status placeholder for Phase 5

## Coordinator architecture (phase-2 foundation)

`apps/coordinator/src/index.ts`:

- HTTP:
  - `GET /health`
  - `GET /rooms`
  - `POST /rooms/create`
- WebSocket:
  - endpoint: `/ws`
  - room join/leave tracking
  - room-state broadcast
  - generic control event relay
- mDNS advertisement:
  - service `_droptune._tcp.local` (type `droptune`, protocol `tcp`)

## WebRTC lifecycle (planned wiring)

1. Host emits `FILE_REQUEST` for missing track.
2. Source peer replies `FILE_AVAILABLE`.
3. Offer/answer/ICE exchange via `WEBRTC_SIGNAL` on control plane.
4. DataChannel opens with fixed chunk protocol.
5. Host reconstructs file `Blob`, creates object URL, plays via `HTMLAudioElement`.
6. Transfer status updates go through `transferStore`.

## Playback state machine

Current playback statuses:

- `idle` -> no active source
- `loading` -> source assigned, waiting for metadata/play
- `playing` -> audio running
- `paused` -> user or host paused
- `ended` -> track finished (auto-advances queue locally)
- `error` -> source/playback failed

Transition source:

- audio element events (`play`, `pause`, `ended`, `loadedmetadata`, `timeupdate`)
- queue actions (`Play now`)
- explicit controls (`Resume`, `Pause`)

## Phase 1 implementation details

- Folder ingestion:
  - primary: File System Access API `showDirectoryPicker`
  - fallback: `<input type="file" webkitdirectory multiple>`
- Metadata extraction:
  - `music-metadata-browser` parses title/artist/album/duration
  - fallback to filename when tags are unavailable
- Supported formats:
  - mp3, flac, wav, m4a, aac
- Storage:
  - metadata in IndexedDB (`tracks` store)
  - raw files NOT persisted in IndexedDB during indexing

## Run

From workspace root:

```bash
pnpm install
pnpm dev:web
```

Coordinator (in a second terminal):

```bash
pnpm dev:coordinator
```

Checks:

```bash
pnpm typecheck
pnpm build
```

## Debugging guidance

- Web app:
  - verify IndexedDB data in browser devtools (`droptune-db` -> `tracks`)
  - verify metadata parser fallbacks on malformed files (title should use filename)
  - verify audio events update store state (status/position/duration)
- Coordinator:
  - `GET /health` for daemon status
  - `GET /rooms` to verify room registry
  - inspect ws payloads in devtools/network (all control events are plain JSON)
  - use `dns-sd`/Bonjour browser tools to confirm `_droptune._tcp.local` advertisement

## Next incremental phases

- Phase 2: room client wiring + room discovery UI from mDNS/HTTP.
- Phase 3: strict room-scoped ws sync and authoritative queue/playback event handling.
- Phase 4: host-authoritative playback controls and state broadcasts.
- Phase 5: WebRTC chunked file transfer.
- Phase 6: local-first track matching before requesting transfer.
- Phase 7: prefetch next `N=2`.
- Phase 8: host migration with room snapshot handoff.
