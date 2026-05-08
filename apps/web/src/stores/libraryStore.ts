import { create } from "zustand";
import type { TrackMetadata } from "@droptune/shared-types";
import { loadTracks, saveTracks } from "../lib/db";

type LocalFileRecord = {
  id: string;
  file: File;
};

interface LibraryState {
  tracks: TrackMetadata[];
  localFiles: Record<string, File>;
  query: string;
  isIndexing: boolean;
  setQuery: (query: string) => void;
  setIndexing: (value: boolean) => void;
  upsertTracks: (tracks: TrackMetadata[], files: LocalFileRecord[]) => Promise<void>;
  hydrate: () => Promise<void>;
}

export const useLibraryStore = create<LibraryState>((set) => ({
  tracks: [],
  localFiles: {},
  query: "",
  isIndexing: false,
  setQuery: (query) => set({ query }),
  setIndexing: (value) => set({ isIndexing: value }),
  upsertTracks: async (newTracks, files) => {
    await saveTracks(newTracks);
    set((state) => {
      const map = new Map(state.tracks.map((track) => [track.id, track]));
      for (const track of newTracks) map.set(track.id, track);

      const fileMap = { ...state.localFiles };
      for (const fileEntry of files) fileMap[fileEntry.id] = fileEntry.file;

      return {
        tracks: Array.from(map.values()),
        localFiles: fileMap
      };
    });
  },
  hydrate: async () => {
    const tracks = await loadTracks();
    set({ tracks });
  }
}));

export function selectFilteredTracks(state: LibraryState): TrackMetadata[] {
  const query = state.query.trim().toLowerCase();
  if (!query) return state.tracks;
  return state.tracks.filter((track) => {
    return (
      track.title.toLowerCase().includes(query) ||
      track.fileName.toLowerCase().includes(query) ||
      track.artist?.toLowerCase().includes(query) ||
      track.album?.toLowerCase().includes(query)
    );
  });
}
