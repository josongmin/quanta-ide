import { create } from "zustand";

const STORAGE_KEY = "p0-tour-seen";

function hasSeen(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return true;
  }
}

function markSeen(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    /* ignore */
  }
}

export interface TourStep {
  target: "topbar" | "files" | "editor" | "inspector" | "command";
  title: string;
  body: string;
  position: "bottom-left" | "bottom-right" | "right" | "left" | "center";
}

export const TOUR_STEPS: TourStep[] = [
  {
    target: "topbar",
    title: "System risk at a glance",
    body: "Risk score updates as you edit. Click to drill into what's driving it.",
    position: "bottom-right",
  },
  {
    target: "files",
    title: "Risk lives in the tree",
    body: "Files show issue counts before you open them. Hot paths are first.",
    position: "right",
  },
  {
    target: "editor",
    title: "Hover any line",
    body: "Get instant context. Hover variables for taint flow, complexity, blame.",
    position: "right",
  },
  {
    target: "inspector",
    title: "Inspector is the brain",
    body: "Blast radius, call graph, data flow, and one-click fixes — all live.",
    position: "left",
  },
  {
    target: "command",
    title: "Press ⌘K to ask anything",
    body: "Simulate changes, find taint paths, suggest refactors. Ask in plain English.",
    position: "center",
  },
];

interface TourState {
  isOpen: boolean;
  step: number;
  start: () => void;
  next: () => void;
  prev: () => void;
  skip: () => void;
}

export const useWelcomeTour = create<TourState>()((set) => ({
  isOpen: !hasSeen(),
  step: 0,
  start: () => { set({ isOpen: true, step: 0 }); },
  next: () => {
    set((s) => {
      const nextStep = s.step + 1;
      if (nextStep >= TOUR_STEPS.length) {
        markSeen();
        return { isOpen: false, step: 0 };
      }
      return { step: nextStep };
    });
  },
  prev: () => { set((s) => ({ step: Math.max(0, s.step - 1) })); },
  skip: () => {
    markSeen();
    set({ isOpen: false, step: 0 });
  },
}));
