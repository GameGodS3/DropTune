import type { PlaybackState, QueueItem, RoomState, TrackId } from "@droptune/shared-types";

export type ControlEventType =
  | "JOIN_ROOM"
  | "LEAVE_ROOM"
  | "ROOM_STATE"
  | "QUEUE_ADD"
  | "QUEUE_REMOVE"
  | "QUEUE_REORDER"
  | "PLAY"
  | "PAUSE"
  | "SEEK"
  | "HOST_CHANGE"
  | "PLAYBACK_STATE"
  | "FILE_REQUEST"
  | "FILE_AVAILABLE"
  | "WEBRTC_SIGNAL";

export interface EventEnvelope<TType extends ControlEventType, TPayload> {
  type: TType;
  requestId?: string;
  payload: TPayload;
  sentAt: number;
}

export type JoinRoomEvent = EventEnvelope<
  "JOIN_ROOM",
  { roomId: string; peerId: string; displayName: string }
>;

export type LeaveRoomEvent = EventEnvelope<"LEAVE_ROOM", { roomId: string; peerId: string }>;

export type RoomStateEvent = EventEnvelope<"ROOM_STATE", { room: RoomState }>;

export type QueueAddEvent = EventEnvelope<"QUEUE_ADD", { roomId: string; item: QueueItem }>;
export type QueueRemoveEvent = EventEnvelope<
  "QUEUE_REMOVE",
  { roomId: string; queueItemId: string }
>;
export type QueueReorderEvent = EventEnvelope<
  "QUEUE_REORDER",
  { roomId: string; queue: QueueItem[] }
>;

export type PlayEvent = EventEnvelope<"PLAY", { roomId: string; queueItemId: string }>;
export type PauseEvent = EventEnvelope<"PAUSE", { roomId: string }>;
export type SeekEvent = EventEnvelope<"SEEK", { roomId: string; positionSec: number }>;
export type HostChangeEvent = EventEnvelope<"HOST_CHANGE", { roomId: string; nextHostPeerId: string }>;
export type PlaybackStateEvent = EventEnvelope<"PLAYBACK_STATE", { roomId: string; state: PlaybackState }>;

export type FileRequestEvent = EventEnvelope<
  "FILE_REQUEST",
  { roomId: string; trackId: TrackId; sourcePeerId: string; targetPeerId: string }
>;
export type FileAvailableEvent = EventEnvelope<
  "FILE_AVAILABLE",
  { roomId: string; trackId: TrackId; sourcePeerId: string }
>;
export type WebRtcSignalEvent = EventEnvelope<
  "WEBRTC_SIGNAL",
  { roomId: string; sourcePeerId: string; targetPeerId: string; signal: unknown }
>;

export type ControlPlaneEvent =
  | JoinRoomEvent
  | LeaveRoomEvent
  | RoomStateEvent
  | QueueAddEvent
  | QueueRemoveEvent
  | QueueReorderEvent
  | PlayEvent
  | PauseEvent
  | SeekEvent
  | HostChangeEvent
  | PlaybackStateEvent
  | FileRequestEvent
  | FileAvailableEvent
  | WebRtcSignalEvent;
