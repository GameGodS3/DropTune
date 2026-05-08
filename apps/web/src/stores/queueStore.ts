import { create } from "zustand";
import type { QueueItem } from "@droptune/shared-types";
import { makeId } from "../lib/id";

interface QueueState {
  queue: QueueItem[];
  setQueue: (queue: QueueItem[]) => void;
  addToQueue: (trackId: string, requestedBy: string) => QueueItem;
  removeFromQueue: (queueItemId: string) => void;
  moveQueueItem: (fromIndex: number, toIndex: number) => void;
}

export const useQueueStore = create<QueueState>((set) => ({
  queue: [],
  setQueue: (queue) => set({ queue }),
  addToQueue: (trackId, requestedBy) => {
    const item: QueueItem = {
      id: makeId(),
      trackId,
      requestedBy,
      addedAt: Date.now()
    };
    set((state) => ({ queue: [...state.queue, item] }));
    return item;
  },
  removeFromQueue: (queueItemId) =>
    set((state) => ({ queue: state.queue.filter((item) => item.id !== queueItemId) })),
  moveQueueItem: (fromIndex, toIndex) =>
    set((state) => {
      if (fromIndex < 0 || toIndex < 0) return state;
      if (fromIndex >= state.queue.length || toIndex >= state.queue.length) return state;
      const copy = [...state.queue];
      const [item] = copy.splice(fromIndex, 1);
      copy.splice(toIndex, 0, item);
      return { queue: copy };
    })
}));
