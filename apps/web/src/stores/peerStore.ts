import { create } from "zustand";
import { makeId } from "../lib/id";

interface PeerStoreState {
  peerId: string;
  displayName: string;
  setDisplayName: (name: string) => void;
}

export const usePeerStore = create<PeerStoreState>((set) => ({
  peerId: makeId(),
  displayName: "Local User",
  setDisplayName: (name) => set({ displayName: name })
}));
