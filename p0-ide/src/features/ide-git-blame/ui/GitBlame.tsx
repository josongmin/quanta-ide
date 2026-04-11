interface Contributor {
  name: string;
  initial: string;
  avatarColor: string;
  role: string;
  timeAgo: string;
  activity: boolean[]; // 5 segments
}

const CONTRIBUTORS: Contributor[] = [
  {
    name: "Sarah K.",
    initial: "S",
    avatarColor: "#f472b6",
    role: "owner",
    timeAgo: "2d ago",
    activity: [true, true, true, true, false],
  },
  {
    name: "Marcus T.",
    initial: "M",
    avatarColor: "#22d3ee",
    role: "last touched",
    timeAgo: "14d ago",
    activity: [false, true, false, true, true],
  },
  {
    name: "Priya N.",
    initial: "P",
    avatarColor: "#a78bfa",
    role: "reviewer",
    timeAgo: "21d ago",
    activity: [false, false, true, false, false],
  },
];

// 30-segment heatmap — deterministic churn values (0–1) baked as a static array
const HEATMAP: number[] = [
  0.1, 0.2, 0.05, 0.4, 0.6, 0.3, 0.15, 0.7, 0.9, 0.5,
  0.2, 0.1, 0.35, 0.8, 0.6, 0.4, 0.25, 0.55, 0.7, 0.3,
  0.1, 0.45, 0.65, 0.9, 0.5, 0.2, 0.15, 0.4, 0.7, 0.85,
];

function heatmapColor(value: number): string {
  // blend from --paper-3 toward --accent based on value
  // We use inline opacity on a colored background via rgba mixing
  if (value < 0.15) return "rgba(43, 43, 55, 0.9)"; // ~paper-3
  const alpha = 0.25 + value * 0.75;
  return `rgba(252, 231, 243, ${alpha.toFixed(2)})`; // --accent tint
}

export function GitBlame() {
  return (
    <div className="gitb-root">
      <div className="gitb-contributors">
        {CONTRIBUTORS.map((c) => (
          <div key={c.name} className="gitb-row">
            <span className="gitb-avatar" style={{ background: c.avatarColor }}>
              {c.initial}
            </span>
            <div className="gitb-row-info">
              <span className="gitb-name">{c.name}</span>
              <span className="gitb-role">{c.role}</span>
            </div>
            <div className="gitb-row-right">
              <span className="gitb-time">{c.timeAgo}</span>
              <div className="gitb-activity">
                {c.activity.map((filled, i) => (
                  <span
                    key={i}
                    className={`gitb-activity-seg${filled ? " is-filled" : ""}`}
                  />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="gitb-heatmap-wrap">
        <span className="gitb-heatmap-label">Last 30 commits</span>
        <div className="gitb-heatmap">
          {HEATMAP.map((v, i) => (
            <span
              key={i}
              className="gitb-heatmap-seg"
              style={{ background: heatmapColor(v) }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
