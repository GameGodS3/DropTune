import express from "express";
import { createServer } from "node:http";
import { Bonjour } from "bonjour-service";
import { WebSocketServer } from "ws";
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

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "droptune-coordinator", time: Date.now() });
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

  const roomId = crypto.randomUUID();
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

function emitRoomState(room: Room): void {
  const event: ControlPlaneEvent = {
    type: "ROOM_STATE",
    sentAt: Date.now(),
    payload: { room: toRoomState(room) }
  };
  const encoded = JSON.stringify(event);
  wss.clients.forEach((client) => {
    if (client.readyState === client.OPEN) client.send(encoded);
  });
}

wss.on("connection", (socket) => {
  const wsClientId = crypto.randomUUID();

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
      emitRoomState(room);
      return;
    }

    const membership = socketIndex.get(wsClientId);
    if (!membership) return;
    const room = rooms.get(membership.roomId);
    if (!room) return;

    if (event.type === "LEAVE_ROOM") {
      room.participants.delete(membership.peerId);
      socketIndex.delete(wsClientId);
      emitRoomState(room);
      return;
    }

    // broadcast every other control-plane event to all clients for now.
    // phase 3+ will tighten authorization and room-only routing.
    const encoded = JSON.stringify(event);
    wss.clients.forEach((client) => {
      if (client.readyState === client.OPEN) client.send(encoded);
    });
  });

  socket.on("close", () => {
    const membership = socketIndex.get(wsClientId);
    if (!membership) return;
    const room = rooms.get(membership.roomId);
    room?.participants.delete(membership.peerId);
    socketIndex.delete(wsClientId);
    if (room) emitRoomState(room);
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
