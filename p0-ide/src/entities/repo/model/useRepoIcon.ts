import { create } from "zustand";
import { persist } from "zustand/middleware";

interface RepoIconState {
  icon: string | null;
  setIcon: (icon: string | null) => void;
}

export const useRepoIcon = create<RepoIconState>()(
  persist(
    (set) => ({ icon: "🛵", setIcon: (icon) => set({ icon }) }),
    { name: "p0-repo-icon-v2" },
  ),
);
