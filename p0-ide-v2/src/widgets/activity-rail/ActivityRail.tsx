import "./activity-rail.css";

const items = [
  { id: "files", label: "파일" },
  { id: "search", label: "검색" },
  { id: "graph", label: "그래프" },
  { id: "agent", label: "에이전트" },
];

export function ActivityRail() {
  return (
    <aside className="rail" aria-label="Activity">
      {items.map((it, i) => (
        <button
          key={it.id}
          className={"rail__item" + (i === 0 ? " rail__item--active" : "")}
          title={it.label}
        >
          <span className="rail__glyph" aria-hidden="true">
            {it.label[0]}
          </span>
        </button>
      ))}
    </aside>
  );
}
