import { useEffect, useRef } from "react";

interface OtpInputProps {
  length?: number;
  value: string[];
  onChange: (next: string[]) => void;
  autoFocus?: boolean;
  ariaLabel?: (index: number) => string;
}

export function OtpInput({
  length = 6,
  value,
  onChange,
  autoFocus = false,
  ariaLabel,
}: OtpInputProps) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  const handleChange = (i: number, raw: string) => {
    const next = [...value];
    next[i] = raw.slice(-1).replace(/\D/, "");
    onChange(next);
    if (next[i] && i < length - 1) refs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !value[i] && i > 0) refs.current[i - 1]?.focus();
  };

  const label = ariaLabel ?? ((i: number) => `Digit ${i + 1}`);

  return (
    <div className="demo-otp">
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          value={value[i] ?? ""}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          aria-label={label(i)}
        />
      ))}
    </div>
  );
}
