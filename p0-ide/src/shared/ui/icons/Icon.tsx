import type { ReactNode, SVGProps } from "react";

export type IconProps = {
  size?: number;
  strokeWidth?: number;
  className?: string;
  "aria-label"?: string;
  "aria-hidden"?: boolean;
};

const DEFAULT_SIZE = 14;
const DEFAULT_STROKE = 1.8;

export function createIcon(displayName: string, path: ReactNode) {
  const Component = (props: IconProps) => {
    const {
      size = DEFAULT_SIZE,
      strokeWidth = DEFAULT_STROKE,
      className,
      "aria-label": ariaLabel,
      "aria-hidden": ariaHidden,
    } = props;
    const a11y: Pick<SVGProps<SVGSVGElement>, "aria-label" | "aria-hidden" | "role"> =
      ariaLabel != null
        ? { "aria-label": ariaLabel, role: "img" }
        : { "aria-hidden": ariaHidden ?? true };
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        {...a11y}
      >
        {path}
      </svg>
    );
  };
  Component.displayName = displayName;
  return Component;
}
