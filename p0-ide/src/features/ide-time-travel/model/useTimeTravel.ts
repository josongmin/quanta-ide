import { create } from "zustand";

export interface Snapshot {
  id: string;
  label: string;
  ago: string;
  blast: number;
  taint: number;
  commits: { hash: string; msg: string }[];
  inflection?: string;
  spike?: boolean;
}

interface TimeTravelState {
  isOpen: boolean;
  selectedId: string;
  open: () => void;
  close: () => void;
  toggle: () => void;
  select: (id: string) => void;
}

export const SNAPSHOTS: Snapshot[] = [
  {
    id: "6mo",
    label: "6 months ago",
    ago: "6mo",
    blast: 8,
    taint: 0,
    commits: [{ hash: "1a2b", msg: "initial refund implementation" }],
  },
  {
    id: "3mo",
    label: "3 months ago",
    ago: "3mo",
    blast: 12,
    taint: 1,
    commits: [{ hash: "2c3d", msg: "add stripe adapter" }],
    spike: true,
    inflection: "first taint path introduced",
  },
  {
    id: "1mo",
    label: "1 month ago",
    ago: "1mo",
    blast: 28,
    taint: 1,
    commits: [{ hash: "4a7f", msg: "hotfix: retry logic" }],
    spike: true,
    inflection: "blast +16 from retry handlers",
  },
  {
    id: "2w",
    label: "2 weeks ago",
    ago: "2w",
    blast: 30,
    taint: 2,
    commits: [{ hash: "5b8e", msg: "add idempotency check" }],
  },
  {
    id: "today",
    label: "today",
    ago: "now",
    blast: 31,
    taint: 2,
    commits: [{ hash: "9f1c", msg: "extract validation helper" }],
  },
];

export const useTimeTravel = create<TimeTravelState>()((set) => ({
  isOpen: false,
  selectedId: "today",
  open: () => { set({ isOpen: true }); },
  close: () => { set({ isOpen: false }); },
  toggle: () => { set((s) => ({ isOpen: !s.isOpen })); },
  select: (id) => { set({ selectedId: id }); },
}));
