import { create } from "zustand";

export interface Owner {
  handle: string;
  name: string;
  status: "active" | "vacation" | "left";
  expertise: number; // 0..1
  lastTouched: string;
}

export type OwnershipBandId = "imports" | "processRefund" | "deadWebhook";

export interface OwnershipBand {
  fromLine: number;
  toLine: number;
  bandId: OwnershipBandId;
  primary: Owner | null;
  secondary?: Owner;
  health: "owned" | "thin" | "orphan";
}

interface OwnershipMapState {
  isOpen: boolean;
  toggle: () => void;
  close: () => void;
}

export const useOwnershipMap = create<OwnershipMapState>()((set) => ({
  isOpen: false,
  toggle: () => { set((s) => ({ isOpen: !s.isOpen })); },
  close: () => { set({ isOpen: false }); },
}));

export const OWNERSHIP_BANDS: OwnershipBand[] = [
  {
    fromLine: 1,
    toLine: 2,
    bandId: "imports",
    primary: { handle: "@alice", name: "Alice Park", status: "active", expertise: 0.92, lastTouched: "2d ago" },
    health: "owned",
  },
  {
    fromLine: 4,
    toLine: 11,
    bandId: "processRefund",
    primary: { handle: "@bob", name: "Bob Yoon", status: "vacation", expertise: 0.78, lastTouched: "11d ago" },
    secondary: { handle: "@carol", name: "Carol Lim", status: "active", expertise: 0.41, lastTouched: "3w ago" },
    health: "thin",
  },
  {
    fromLine: 13,
    toLine: 14,
    bandId: "deadWebhook",
    primary: null,
    health: "orphan",
  },
];
