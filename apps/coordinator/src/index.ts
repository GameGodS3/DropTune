import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { networkInterfaces } from "node:os";
import { Bonjour } from "bonjour-service";
import { WebSocket, WebSocketServer } from "ws";
import type { ControlPlaneEvent } from "@droptune/protocol";
import type { PlaybackState, QueueItem, RoomState } from "@droptune/shared-types";

const PORT = Number(process.env.DROPTUNE_COORDINATOR_PORT ?? 8787);

type Room = {
  roomId: string;
  roomName: string;
  queue: QueueItem[];
  participants: Map<string, { peerId: string; name: string; isHost: boolean; wsClientId: string }>;
  playback: PlaybackState;
};

const rooms = new Map<string, Room>();
const socketIndex = new Map<string, { roomId: string; peerId: string }>();
const roomSockets = new Map<string, Set<string>>();
const wsByClientId = new Map<string, WebSocket>();

const app = express();
app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "OPTIONS"],
    credentials: false
  })
);
app.use(express.json());

function getLanIp(): string | null {
  const nets = networkInterfaces();
  for (const ifaces of Object.values(nets)) {
    if (!ifaces) continue;
    for (const iface of ifaces) {
      if (iface.family === "IPv4" && !iface.internal) return iface.address;
    }
  }
  return null;
}

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "droptune-coordinator", time: Date.now() });
});

app.get("/info", (_req, res) => {
  res.json({ lanIp: getLanIp(), coordinatorPort: PORT });
});

app.get("/rooms", (_req, res) => {
  const data = Array.from(rooms.values()).map((room) => ({
    roomId: room.roomId,
    roomName: room.roomName,
    participantCount: room.participants.size
  }));
  res.json({ rooms: data });
});

app.post("/rooms/create", (req, res) => {
  const roomName = String(req.body?.roomName ?? "").trim();
  if (!roomName) {
    res.status(400).json({ error: "roomName is required" });
    return;
  }

  const roomId = randomUUID();
  const room: Room = {
    roomId,
    roomName,
    queue: [],
    participants: new Map(),
    playback: {
      status: "idle",
      positionSec: 0,
      durationSec: 0,
      updatedAt: Date.now()
    }
  };
  rooms.set(roomId, room);
  res.status(201).json({ roomId, roomName });
});

const server = createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

function toRoomState(room: Room): RoomState {
  return {
    roomId: room.roomId,
    roomName: room.roomName,
    queue: room.queue,
    playback: room.playback,
    participants: Array.from(room.participants.values()).map((p) => ({
      peerId: p.peerId,
      name: p.name,
      isHost: p.isHost,
      lastSeenAt: Date.now()
    }))
  };
}

function sendToRoom(roomId: string, event: ControlPlaneEvent): void {
  const encoded = JSON.stringify(event);
  const members = roomSockets.get(roomId);
  if (!members) return;
  for (const wsClientId of members) {
    const client = wsByClientId.get(wsClientId);
    if (client && client.readyState === client.OPEN) client.send(encoded);
  }
}

function reassignHostIfNeeded(room: Room): void {
  const hasHost = Array.from(room.participants.values()).some((p) => p.isHost);
  if (!hasHost && room.participants.size > 0) {
    room.participants.values().next().value!.isHost = true;
  }
}

function emitRoomState(room: Room): void {
  const event: ControlPlaneEvent = {
    type: "ROOM_STATE",
    sentAt: Date.now(),
    payload: { room: toRoomState(room) }
  };
  sendToRoom(room.roomId, event);
}

wss.on("connection", (socket) => {
  const wsClientId = randomUUID();
  wsByClientId.set(wsClientId, socket);

  socket.on("message", (raw) => {
    let event: ControlPlaneEvent;
    try {
      event = JSON.parse(String(raw)) as ControlPlaneEvent;
    } catch {
      return;
    }

    if (event.type === "JOIN_ROOM") {
      const room = rooms.get(event.payload.roomId);
      if (!room) return;
      const first = room.participants.size === 0;
      room.participants.set(event.payload.peerId, {
        peerId: event.payload.peerId,
        name: event.payload.displayName,
        isHost: first,
        wsClientId
      });
      socketIndex.set(wsClientId, { roomId: room.roomId, peerId: event.payload.peerId });
      if (!roomSockets.has(room.roomId)) roomSockets.set(room.roomId, new Set());
      roomSockets.get(room.roomId)?.add(wsClientId);
      emitRoomState(room);
      return;
    }

    const membership = socketIndex.get(wsClientId);
    if (!membership) return;
    const room = rooms.get(membership.roomId);
    if (!room) return;

    if (event.type === "LEAVE_ROOM") {
      room.participants.delete(membership.peerId);
      roomSockets.get(room.roomId)?.delete(wsClientId);
      socketIndex.delete(wsClientId);
      reassignHostIfNeeded(room);
      emitRoomState(room);
      return;
    }

    if ("roomId" in event.payload && event.payload.roomId !== room.roomId) return;

    switch (event.type) {
      case "QUEUE_ADD":
        room.queue.push(event.payload.item);
        emitRoomState(room);
        break;
      case "QUEUE_REMOVE":
        room.queue = room.queue.filter((item) => item.id !== event.payload.queueItemId);
        emitRoomState(room);
        break;
      case "QUEUE_REORDER":
        room.queue = event.payload.queue;
        emitRoomState(room);
        break;
      case "PLAY":
        room.playback = {
          ...room.playback,
          status: "playing",
          currentQueueItemId: event.payload.queueItemId,
          updatedAt: Date.now()
        };
        emitRoomState(room);
        break;
      case "PAUSE":
        room.playback = { ...room.playback, status: "paused", updatedAt: Date.now() };
        emitRoomState(room);
        break;
      case "SEEK":
        room.playback = {
          ...room.playback,
          positionSec: event.payload.positionSec,
          updatedAt: Date.now()
        };
        emitRoomState(room);
        break;
      case "PLAYBACK_STATE":
        room.playback = { ...event.payload.state, updatedAt: Date.now() };
        emitRoomState(room);
        break;
      case "HOST_CHANGE":
        for (const participant of room.participants.values()) {
          participant.isHost = participant.peerId === event.payload.nextHostPeerId;
        }
        emitRoomState(room);
        break;
      case "FILE_REQUEST":
      case "FILE_AVAILABLE":
      case "WEBRTC_SIGNAL":
        sendToRoom(room.roomId, event);
        break;
      default:
        break;
    }
  });

  socket.on("close", () => {
    const membership = socketIndex.get(wsClientId);
    wsByClientId.delete(wsClientId);
    if (!membership) return;
    const room = rooms.get(membership.roomId);
    room?.participants.delete(membership.peerId);
    roomSockets.get(membership.roomId)?.delete(wsClientId);
    socketIndex.delete(wsClientId);
    if (room) {
      reassignHostIfNeeded(room);
      emitRoomState(room);
    }
  });
});

server.listen(PORT, () => {
  const bonjour = new Bonjour();
  bonjour.publish({
    name: "DropTune Coordinator",
    type: "droptune",
    protocol: "tcp",
    port: PORT
  });
  console.log(`DropTune coordinator listening on http://localhost:${PORT}`);
});
