import { create } from "zustand";
import { REPOS, type RepoName } from "@/entities/repo/model/data";

interface RepoState {
  current: RepoName;
  setCurrent: (name: RepoName) => void;
  getData: () => (typeof REPOS)[RepoName];
}

export const useRepoStore = create<RepoState>()((set, get) => ({
  current: "acme/payments-api",
  setCurrent: (name) => set({ current: name }),
  getData: () => REPOS[get().current],
}));
