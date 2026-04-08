import { create } from "zustand";
import type { RepoName } from "@/entities/repo/model/data";
interface RepoState { current: RepoName; setCurrent: (n: RepoName) => void; }
export const useRepoStore = create<RepoState>()((set) => ({
  current: "acme/payments-api", setCurrent: (current) => set({ current }),
}));
