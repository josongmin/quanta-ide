interface DividerProps {
  orientation?: "horizontal" | "vertical";
  variant?: "subtle" | "default" | "strong";
  className?: string;
}

export function Divider({
  orientation = "horizontal",
  variant = "default",
  className,
}: DividerProps) {
  return (
    <div
      role="separator"
      aria-orientation={orientation}
      className={`divider divider--${orientation} divider--${variant} ${className ?? ""}`}
    />
  );
}
