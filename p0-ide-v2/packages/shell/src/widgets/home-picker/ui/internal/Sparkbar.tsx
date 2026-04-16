import type { SparkDay } from "../../lib/home-picker.mock";

export function Sparkbar({ values }: { values: SparkDay[] }) {
  const max = Math.max(1, ...values.map((d) => Math.max(d.add, d.del)));
  const totalAdd = values.reduce((s, d) => s + d.add, 0);
  const totalDel = values.reduce((s, d) => s + d.del, 0);
  return (
    <span
      className="hp__sparkbar"
      aria-label={`+${totalAdd} / −${totalDel} over last ${values.length} days`}
      title={`+${totalAdd} · −${totalDel} · last ${values.length} days`}
    >
      {values.map((d, i) => {
        const empty = d.add === 0 && d.del === 0;
        const addH = empty ? 0 : Math.max(6, (d.add / max) * 100);
        const delH = empty ? 0 : Math.max(6, (d.del / max) * 100);
        return (
          <span key={i} className="hp__sparkbar-day" aria-hidden>
            <span className="hp__sparkbar-add" style={{ height: `${addH}%` }} />
            <span className="hp__sparkbar-axis" />
            <span className="hp__sparkbar-del" style={{ height: `${delH}%` }} />
          </span>
        );
      })}
    </span>
  );
}

export function BranchIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="6" y1="3" x2="6" y2="15" />
      <circle cx="18" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M18 9a9 9 0 0 1-9 9" />
    </svg>
  );
}
