export type DeviceId = string;
export type PeerId = string;
export type RoomId = string;
export type TrackId = string;
export type QueueItemId = string;

export interface TrackMetadata {
  id: TrackId;
  sourceDeviceId: DeviceId;
  fileName: string;
  title: string;
  artist?: string;
  album?: string;
  durationSec: number;
  format: "mp3" | "flac" | "wav" | "m4a" | "aac" | "unknown";
  sizeBytes: number;
  normalizedName: string;
}

export interface QueueItem {
  id: QueueItemId;
  trackId: TrackId;
  requestedBy: PeerId;
  addedAt: number;
}

export type PlaybackStatus = "idle" | "loading" | "playing" | "paused" | "ended" | "error";

export interface PlaybackState {
  status: PlaybackStatus;
  currentQueueItemId?: QueueItemId;
  positionSec: number;
  durationSec: number;
  updatedAt: number;
  hostPeerId?: PeerId;
}

export interface RoomParticipant {
  peerId: PeerId;
  name: string;
  isHost: boolean;
  lastSeenAt: number;
}

export interface RoomState {
  roomId: RoomId;
  roomName: string;
  participants: RoomParticipant[];
  queue: QueueItem[];
  playback: PlaybackState;
}
