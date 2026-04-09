import { create } from "zustand";

interface ToastState {
  message: string;
  visible: boolean;
  show: (msg: string) => void;
  hide: () => void;
}

export const useToast = create<ToastState>()((set) => ({
  message: "",
  visible: false,
  show: (message) => {
    set({ message, visible: true });
    setTimeout(() => { set({ visible: false }); }, 3000);
  },
  hide: () => { set({ visible: false }); },
}));
