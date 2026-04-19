/* ── ui-kit barrel ────────────────────────────────────── */

// Lib
export { cn } from "./lib/cn";
export { matchPositions, positionScore } from "./lib/fuzzy-search";
export { useDebounce, useDebouncedCallback } from "./lib/use-debounce";
export { focusManager } from "./lib/focus-manager";
export { useScrollRestoration } from "./lib/scroll-restoration";
export { riskColor, riskColorBg, riskBarStyle } from "./lib/risk";

// UI — Icons
export {
  IconTaint,
  IconNoTests,
  IconComplexity,
  IconDead,
  IconFunction,
  IconClass,
  IconArrowOut,
  IconArrowIn,
  IconChevron,
  IconSlash,
  IconTrendUp,
  IconTrendDown,
  IconTrendFlat,
  IconClock,
  IconPlay,
} from "./ui/icons/EngineIcons";
export { Sparkline } from "./ui/icons/Sparkline";
export { ChevronIcon, FolderIcon, pickFileIcon } from "./ui/icons/FileIcons";
export { ICON_PACKS, ICON_PACK_ORDER, ICON_PACK_CATEGORIES, useActivePack } from "./ui/icons/packs";
export type { IconPack } from "./ui/icons/packs";
export { detectFileType, FILE_TYPE_META } from "./ui/icons/file-type";
export type { FileTypeKey, FileTypeMeta } from "./ui/icons/file-type";

// UI — Components
export { Modal } from "./ui/modal";
export type { ModalProps } from "./ui/modal";
export { ToastHost } from "./ui/toast";
export type { ToastHostProps } from "./ui/toast";
export { Section, Sub } from "./ui/section";
export type { SectionStyle } from "./ui/section/Section";
export { EmptyPane } from "./ui/empty-pane";
export { ResizeHandle } from "./ui/resize-handle";
