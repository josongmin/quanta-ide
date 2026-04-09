import { useRepoStore, REPOS } from "@/entities/repo";
import { useModalStore } from "@/features/repo-modal/model/useModalStore";

export function useRepoSelection() {
  const { current, setCurrent } = useRepoStore();
  const { isOpen, open, close } = useModalStore();
  const repo = REPOS[current];
  return { current, setCurrent, isOpen, open, close, repo } as const;
}
