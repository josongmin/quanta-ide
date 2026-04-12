import { forwardRef, type ReactNode, type KeyboardEvent } from "react";

interface CardProps {
  elevation?: "flat" | "raised";
  interactive?: boolean;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  "aria-label"?: string;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  {
    elevation = "flat",
    interactive = false,
    children,
    className,
    onClick,
    "aria-label": ariaLabel,
  },
  ref,
) {
  if (interactive) {
    const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onClick?.();
      }
    };
    return (
      <div
        ref={ref}
        className={`card card--${elevation} card--interactive ${className ?? ""}`}
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={handleKeyDown}
        aria-label={ariaLabel}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className={`card card--${elevation} ${className ?? ""}`}
      aria-label={ariaLabel}
    >
      {children}
    </div>
  );
});
