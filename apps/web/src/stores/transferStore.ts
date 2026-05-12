import { create } from "zustand";

type TransferStatus = "idle" | "requesting" | "downloading";

interface TransferState {
  status: TransferStatus;
  progressPct: number;
  setTransfer: (status: TransferStatus, progressPct: number) => void;
}

export const useTransferStore = create<TransferState>((set) => ({
  status: "idle",
  progressPct: 0,
  setTransfer: (status, progressPct) => set({ status, progressPct })
}));
