interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  "aria-label"?: string;
}

export function Spinner({ size = "md", className, "aria-label": ariaLabel }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label={ariaLabel ?? "Loading"}
      className={`spinner spinner--${size} ${className ?? ""}`}
    >
      <svg viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.2" />
        <path d="M22 12 A10 10 0 0 0 12 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </span>
  );
}
