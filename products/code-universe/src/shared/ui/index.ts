// Barrel for Code Universe shared UI primitives. Import from
// "../../../shared/ui" when you want the canonical set; reach into the
// individual modules only when you need something the barrel doesn't
// re-export (most callers shouldn't).

export { ensureA11yStyles } from "./a11y-styles";
export {
  color,
  font,
  kindColor,
  kindIcon,
  kindLabel,
  pixiColor,
  pixiKindColor,
  radius,
  shadow,
  space,
  transition,
} from "./tokens";
export {
  ViewSkeleton,
  type ViewSkeletonKind,
  type ViewSkeletonProps,
} from "./ViewSkeleton";
