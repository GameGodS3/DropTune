import { openDB } from "idb";
import type { DBSchema } from "idb";
import type { TrackMetadata } from "@droptune/shared-types";

interface DropTuneDb extends DBSchema {
  tracks: {
    key: string;
    value: TrackMetadata;
    indexes: {
      "by-title": string;
      "by-normalized-name": string;
    };
  };
}

export const dbPromise = openDB<DropTuneDb>("droptune-db", 2, {
  upgrade(db, oldVersion) {
    if (oldVersion < 2 && db.objectStoreNames.contains("tracks")) {
      db.deleteObjectStore("tracks");
    }
    const trackStore = db.createObjectStore("tracks", { keyPath: "id" });
    trackStore.createIndex("by-title", "title");
    trackStore.createIndex("by-normalized-name", "normalizedName");
  }
});

export async function saveTracks(tracks: TrackMetadata[]): Promise<void> {
  const db = await dbPromise;
  const tx = db.transaction("tracks", "readwrite");
  for (const track of tracks) tx.store.put(track);
  await tx.done;
}

export async function loadTracks(): Promise<TrackMetadata[]> {
  const db = await dbPromise;
  return db.getAll("tracks");
}
