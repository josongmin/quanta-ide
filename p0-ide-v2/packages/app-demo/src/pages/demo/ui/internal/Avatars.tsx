import { initials, pickPalette } from "./avatar-utils";

interface AvatarsProps {
  names: string[];
  max?: number;
  title?: string;
}

export function Avatars({ names, max = 4, title }: AvatarsProps) {
  const visible = names.slice(0, max);
  const extra = names.length - visible.length;
  return (
    <div className="demo-avatars" title={title ?? names.join(", ")}>
      {visible.map((n) => {
        const p = pickPalette(n);
        return (
          <span
            key={n}
            className="demo-avatars__item"
            style={{ background: p.bg, color: p.fg }}
            aria-label={n}
          >
            {initials(n)}
          </span>
        );
      })}
      {extra > 0 && <span className="demo-avatars__more">+{extra}</span>}
    </div>
  );
}
