export const EASE_SMOOTH = [0.2, 0.85, 0.2, 1] as const;

export const MODAL_FADE = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.22 },
};

export const MODAL_SHELL = {
  initial: { y: 10, scale: 0.985 },
  animate: { y: 0, scale: 1 },
  exit: { y: 10, scale: 0.985 },
  transition: { duration: 0.26, ease: [0.2, 0.85, 0.2, 1] as const },
};

export const crossfade = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: { duration: 0.22 },
};
