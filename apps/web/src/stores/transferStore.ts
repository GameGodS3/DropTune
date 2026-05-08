import { create } from "zustand";

type TransferStatus = "idle" | "requesting" | "transferring" | "done" | "error";

interface TransferState {
  status: TransferStatus;
  activeTrackId?: string;
  progressPct: number;
  setTransfer: (status: TransferStatus, activeTrackId?: string, progressPct?: number) => void;
}

export const useTransferStore = create<TransferState>((set) => ({
  status: "idle",
  activeTrackId: undefined,
  progressPct: 0,
  setTransfer: (status, activeTrackId, progressPct = 0) =>
    set({ status, activeTrackId, progressPct })
}));
