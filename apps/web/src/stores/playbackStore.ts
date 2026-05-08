import { create } from "zustand";
import type { PlaybackStatus } from "@droptune/shared-types";

interface PlaybackState {
  status: PlaybackStatus;
  currentTrackId?: string;
  positionSec: number;
  durationSec: number;
  setStatus: (status: PlaybackStatus) => void;
  setCurrentTrack: (trackId?: string) => void;
  setPosition: (positionSec: number) => void;
  setDuration: (durationSec: number) => void;
}

export const usePlaybackStore = create<PlaybackState>((set) => ({
  status: "idle",
  currentTrackId: undefined,
  positionSec: 0,
  durationSec: 0,
  setStatus: (status) => set({ status }),
  setCurrentTrack: (trackId) => set({ currentTrackId: trackId, positionSec: 0 }),
  setPosition: (positionSec) => set({ positionSec }),
  setDuration: (durationSec) => set({ durationSec })
}));
