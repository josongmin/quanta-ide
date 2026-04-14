import "./home-picker.css";

type Choice = "repo" | "agent" | "pr";

interface HomePickerProps {
  onPick: (choice: Choice, label: string) => void;
}

const cards: { id: Choice; label: string; sub: string; bg: string; icon: React.ReactNode }[] = [
  {
    id: "repo",
    label: "레포 열기",
    sub: "Open repository",
    bg: "linear-gradient(135deg, #5b8df0, #4d6ee0)",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z" />
      </svg>
    ),
  },
  {
    id: "agent",
    label: "AI 코딩 에이전트",
    sub: "Coding agent session",
    bg: "linear-gradient(135deg, #a960ee, #7b4ddc)",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="6" width="16" height="13" rx="2" />
        <path d="M9 3v3M15 3v3M9 13h.01M15 13h.01M9 17h6" />
      </svg>
    ),
  },
  {
    id: "pr",
    label: "PR 전용 화면",
    sub: "Pull request review",
    bg: "linear-gradient(135deg, #ff8a4d, #ec5d2e)",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="6" cy="6" r="2.2" />
        <circle cx="6" cy="18" r="2.2" />
        <circle cx="18" cy="18" r="2.2" />
        <path d="M6 8.2v7.6M18 15.8V11a4 4 0 0 0-4-4h-2.5l2 2m0-4l-2 2" />
      </svg>
    ),
  },
];

const recents = [
  { name: "payments-api", meta: "main · 3 changes", time: "1시간 전" },
  { name: "order-service", meta: "feat/checkout · clean", time: "3시간 전" },
  { name: "ledger-core", meta: "main · 12 changes", time: "어제" },
  { name: "auth-gateway", meta: "release/0.4 · 1 change", time: "2일 전" },
  { name: "search-index", meta: "main · clean", time: "5일 전" },
];

export function HomePicker({ onPick }: HomePickerProps) {
  return (
    <div className="hp">
      <div className="hp__inner">
        <div className="hp__cards">
          {cards.map((c) => (
            <button
              key={c.id}
              type="button"
              className="hp__card"
              onClick={() => onPick(c.id, c.label)}
              title={c.label}
            >
              <span className="hp__card-icon" style={{ background: c.bg }}>{c.icon}</span>
              <span className="hp__card-label">{c.label}</span>
            </button>
          ))}
        </div>

        <div className="hp__search">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input type="text" placeholder="검색" />
        </div>

        <div className="hp__section-label">최근</div>
        <ul className="hp__list">
          {recents.map((r) => (
            <li key={r.name} className="hp__row">
              <span className="hp__row-thumb">{r.name.charAt(0).toUpperCase()}</span>
              <span className="hp__row-name">{r.name}</span>
              <span className="hp__row-meta">{r.meta}</span>
              <span className="hp__row-time">{r.time}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
