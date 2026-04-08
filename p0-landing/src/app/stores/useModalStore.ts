import { create } from "zustand";

interface ModalState {
  isRepoModalOpen: boolean;
  openRepoModal: () => void;
  closeRepoModal: () => void;
}

export const useModalStore = create<ModalState>()((set) => ({
  isRepoModalOpen: false,
  openRepoModal: () => set({ isRepoModalOpen: true }),
  closeRepoModal: () => set({ isRepoModalOpen: false }),
}));
