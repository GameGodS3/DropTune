import { create } from "zustand";

interface RoomStoreState {
  roomId?: string;
  roomName?: string;
  isConnected: boolean;
  setRoom: (roomId: string, roomName: string) => void;
  clearRoom: () => void;
}

export const useRoomStore = create<RoomStoreState>((set) => ({
  roomId: undefined,
  roomName: undefined,
  isConnected: false,
  setRoom: (roomId, roomName) => set({ roomId, roomName, isConnected: true }),
  clearRoom: () => set({ roomId: undefined, roomName: undefined, isConnected: false })
}));
