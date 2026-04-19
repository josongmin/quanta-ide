import { Fragment, useEffect, useRef } from "react";

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
  const splitAt = length % 2 === 0 && length >= 6 ? length / 2 : -1;
  const allFilled = value.slice(0, length).every(Boolean) && value.length >= length;

  return (
    <div className={`demo-otp${allFilled ? " is-complete" : ""}`} data-length={length}>
      {Array.from({ length }).map((_, i) => (
        <Fragment key={i}>
          {i === splitAt ? <span className="demo-otp__sep" aria-hidden="true" /> : null}
          <input
            ref={(el) => {
              refs.current[i] = el;
            }}
            className={value[i] ? "is-filled" : ""}
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={1}
            placeholder="·"
            value={value[i] ?? ""}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            aria-label={label(i)}
          />
        </Fragment>
      ))}
    </div>
  );
}
