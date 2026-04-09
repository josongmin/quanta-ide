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
  position: "bottom-left" | "bottom-right" | "right" | "left" | "center";
}

export const TOUR_STEPS: TourStep[] = [
  { target: "topbar", position: "bottom-right" },
  { target: "files", position: "right" },
  { target: "editor", position: "right" },
  { target: "inspector", position: "left" },
  { target: "command", position: "center" },
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
