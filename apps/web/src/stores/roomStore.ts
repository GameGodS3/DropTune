import { create } from "zustand";

interface RoomStoreState {
  roomId?: string;
  roomName?: string;
  isConnected: boolean;
  participantCount: number;
  hostPeerId?: string;
  setRoom: (roomId: string, roomName: string) => void;
  setConnected: (connected: boolean) => void;
  setPresence: (participantCount: number, hostPeerId?: string) => void;
  clearRoom: () => void;
}

export const useRoomStore = create<RoomStoreState>((set) => ({
  roomId: undefined,
  roomName: undefined,
  isConnected: false,
  participantCount: 0,
  hostPeerId: undefined,
  setRoom: (roomId, roomName) => set({ roomId, roomName, isConnected: true }),
  setConnected: (connected) => set({ isConnected: connected }),
  setPresence: (participantCount, hostPeerId) => set({ participantCount, hostPeerId }),
  clearRoom: () =>
    set({
      roomId: undefined,
      roomName: undefined,
      isConnected: false,
      participantCount: 0,
      hostPeerId: undefined
    })
}));
