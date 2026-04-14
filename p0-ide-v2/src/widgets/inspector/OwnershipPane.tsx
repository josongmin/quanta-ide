import type { FileFacts } from "@/entities/engine";

const ROLE_LABEL = {
  primary: "primary",
  contributor: "contrib",
  orphan: "orphan",
} as const;

export function OwnershipPane({ file }: { file: FileFacts }) {
  return (
    <div className="ownership-pane">
      <div className="ownership-pane__kicker">
        call-graph weighted ownership
      </div>
      <div className="ownership-pane__bar" aria-hidden>
        {file.ownership.map((o, i) => (
          <span
            key={i}
            className={`ownership-pane__seg ownership-pane__seg--${o.role}`}
            style={{ width: `${o.pct}%` }}
            title={`${o.author}: ${o.pct}%`}
          />
        ))}
      </div>
      <ul className="ownership-list">
        {file.ownership.map((o) => (
          <li key={o.author} className={`ownership-row ownership-row--${o.role}`}>
            <span className="ownership-row__dot" aria-hidden />
            <span className="ownership-row__name">
              <span className="ownership-row__at">@</span>
              {o.author.replace("@", "")}
            </span>
            <span className="ownership-row__role">{ROLE_LABEL[o.role]}</span>
            <span className="ownership-row__pct">{o.pct}%</span>
          </li>
        ))}
      </ul>
      <div className="ownership-pane__note">
        Bus factor: {file.ownership.filter((o) => o.pct >= 20).length}
      </div>
    </div>
  );
}
