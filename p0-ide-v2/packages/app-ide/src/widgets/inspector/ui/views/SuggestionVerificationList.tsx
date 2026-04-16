import type { VerifyItem } from "./SuggestionOverlay.types";

export function VerificationList({ items }: { items: VerifyItem[] }) {
  return (
    <ul className="verify">
      {items.map((it, i) => (
        <li key={i} className={`verify__row verify__row--${it.state}`}>
          <span className="verify__icon" aria-hidden>
            {it.state === "pass" ? "✓" : it.state === "warn" ? "!" : "·"}
          </span>
          <span className="verify__label">{it.label}</span>
          {it.value && <span className="verify__val">{it.value}</span>}
          <span className="verify__engine">{it.engine}</span>
        </li>
      ))}
    </ul>
  );
}
