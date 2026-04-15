/* GraphView — call graph visualization */

export function GraphView() {
  const nodes = [
    { id: "webhook", label: "webhook.handle", x: 80, y: 180, layer: 0 },
    { id: "retry", label: "retry_with_backoff", x: 260, y: 110, layer: 1, changed: true },
    { id: "guard", label: "IdempotencyGuard", x: 260, y: 250, layer: 1, added: true },
    { id: "orchestr", label: "orchestrator.execute", x: 450, y: 110, layer: 2, changed: true },
    { id: "ledger", label: "ledger.update", x: 450, y: 250, layer: 2, changed: true, risky: true },
    { id: "store", label: "store.write", x: 640, y: 180, layer: 3 },
    { id: "metrics", label: "metrics.emit", x: 640, y: 60, layer: 3 },
    { id: "notify", label: "_notify", x: 640, y: 300, layer: 3 },
  ];
  const edges: { a: string; b: string; kind: "ctx" | "mod" | "new" | "risk" }[] = [
    { a: "webhook", b: "retry", kind: "mod" },
    { a: "retry", b: "guard", kind: "new" },
    { a: "retry", b: "orchestr", kind: "mod" },
    { a: "orchestr", b: "ledger", kind: "risk" },
    { a: "ledger", b: "store", kind: "mod" },
    { a: "ledger", b: "notify", kind: "ctx" },
    { a: "retry", b: "metrics", kind: "new" },
  ];
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  return (
    <div className="pr-page__graph">
      <header className="pr-page__graph-head">
        <h3>Call graph · change impact</h3>
        <div className="pr-page__graph-legend">
          <span className="pr-page__lg pr-page__lg--changed">modified</span>
          <span className="pr-page__lg pr-page__lg--added">new</span>
          <span className="pr-page__lg pr-page__lg--risky">blocker</span>
          <span className="pr-page__lg pr-page__lg--ctx">unchanged</span>
        </div>
      </header>
      <svg className="pr-page__graph-svg" viewBox="0 0 740 360">
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
          </marker>
        </defs>
        {edges.map((e, i) => {
          const a = byId[e.a];
          const b = byId[e.b];
          return (
            <line
              key={i}
              className={`pr-page__edge pr-page__edge--${e.kind}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              markerEnd="url(#arrow)"
            />
          );
        })}
        {nodes.map((n) => (
          <g
            key={n.id}
            className={`pr-page__node${n.changed ? " is-changed" : ""}${n.added ? " is-added" : ""}${n.risky ? " is-risky" : ""}`}
            transform={`translate(${n.x - 70},${n.y - 18})`}
          >
            <rect width="140" height="36" rx="6" />
            <text x="70" y="22" textAnchor="middle">
              {n.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

