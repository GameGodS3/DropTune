import { create } from "zustand";

interface PeerStoreState {
  peerId: string;
  displayName: string;
  setDisplayName: (name: string) => void;
}

export const usePeerStore = create<PeerStoreState>((set) => ({
  peerId: crypto.randomUUID(),
  displayName: "Local User",
  setDisplayName: (name) => set({ displayName: name })
}));
