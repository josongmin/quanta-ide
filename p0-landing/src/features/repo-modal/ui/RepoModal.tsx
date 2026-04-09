import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useModalStore } from "@/app/stores/useModalStore";
import { useRepoStore } from "@/app/stores/useRepoStore";
import { REPOS, REPO_NAMES, type RepoName } from "@/entities/repo/model/data";

/* ── Circuit board background canvas ── */
function CircuitCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    const GRID = 28;
    const NODE_R = 1.6;

    type Node = { x: number; y: number; };
    type Edge = { a: Node; b: Node; };
    type Pulse = { edge: Edge; t: number; speed: number; color: string; };

    let nodes: Node[] = [];
    let edges: Edge[] = [];
    let pulses: Pulse[] = [];

    const PULSE_COLORS = ["rgba(139,92,246,", "rgba(99,102,241,", "rgba(167,139,250,", "rgba(196,181,253,"];

    function build(w: number, h: number) {
      nodes = [];
      edges = [];
      pulses = [];

      const cols = Math.ceil(w / GRID) + 1;
      const rows = Math.ceil(h / GRID) + 1;

      // Grid nodes with jitter
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (Math.random() < 0.72) {
            nodes.push({
              x: c * GRID + (Math.random() - 0.5) * GRID * 0.35,
              y: r * GRID + (Math.random() - 0.5) * GRID * 0.35,
            });
          }
        }
      }

      // Edges: connect nearby nodes (Manhattan-ish — prefer H/V)
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        let connections = 0;
        for (let j = i + 1; j < nodes.length; j++) {
          if (connections >= 3) break;
          const b = nodes[j];
          const dx = Math.abs(a.x - b.x);
          const dy = Math.abs(a.y - b.y);
          const dist = Math.sqrt(dx * dx + dy * dy);
          // prefer axis-aligned connections
          const aligned = dx < 6 || dy < 6;
          if (dist < GRID * 1.6 && (aligned || Math.random() < 0.25)) {
            edges.push({ a, b });
            connections++;
          }
        }
      }
    }

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas!.offsetWidth;
      const h = canvas!.offsetHeight;
      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      ctx!.scale(dpr, dpr);
      build(w, h);
    }

    function spawnPulse() {
      if (edges.length === 0) return;
      const edge = edges[Math.floor(Math.random() * edges.length)];
      const colorBase = PULSE_COLORS[Math.floor(Math.random() * PULSE_COLORS.length)];
      pulses.push({ edge, t: 0, speed: 0.004 + Math.random() * 0.006, color: colorBase });
    }

    let frame = 0;
    function draw() {
      const w = canvas!.offsetWidth;
      const h = canvas!.offsetHeight;
      ctx!.clearRect(0, 0, w, h);

      // edges
      ctx!.lineWidth = 0.5;
      for (const { a, b } of edges) {
        ctx!.beginPath();
        ctx!.strokeStyle = "rgba(139,92,246,0.07)";
        ctx!.moveTo(a.x, a.y);
        ctx!.lineTo(b.x, b.y);
        ctx!.stroke();
      }

      // nodes
      for (const { x, y } of nodes) {
        ctx!.beginPath();
        ctx!.arc(x, y, NODE_R, 0, Math.PI * 2);
        ctx!.fillStyle = "rgba(139,92,246,0.18)";
        ctx!.fill();
      }

      // pulses
      frame++;
      if (frame % 18 === 0 && pulses.length < 28) spawnPulse();

      pulses = pulses.filter(p => p.t <= 1.3);
      for (const p of pulses) {
        const { a, b } = p.edge;
        const t = Math.min(p.t, 1);
        const px = a.x + (b.x - a.x) * t;
        const py = a.y + (b.y - a.y) * t;

        // fade out when t > 0.8
        const alpha = p.t > 0.8 ? Math.max(0, 1 - (p.t - 0.8) / 0.5) : 1;

        // glow trail
        const grad = ctx!.createRadialGradient(px, py, 0, px, py, 6);
        grad.addColorStop(0, p.color + (0.9 * alpha).toFixed(2) + ")");
        grad.addColorStop(0.4, p.color + (0.3 * alpha).toFixed(2) + ")");
        grad.addColorStop(1, p.color + "0)");
        ctx!.beginPath();
        ctx!.arc(px, py, 6, 0, Math.PI * 2);
        ctx!.fillStyle = grad;
        ctx!.fill();

        // dot
        ctx!.beginPath();
        ctx!.arc(px, py, 1.8, 0, Math.PI * 2);
        ctx!.fillStyle = p.color + alpha.toFixed(2) + ")";
        ctx!.fill();

        p.t += p.speed;
      }

      animId = requestAnimationFrame(draw);
    }

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    draw();

    return () => {
      cancelAnimationFrame(animId);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: "absolute", inset: 0, width: "100%", height: "100%",
        borderRadius: "inherit", pointerEvents: "none", opacity: 0.55, zIndex: 0,
      }}
    />
  );
}

/* ── Tooltip descriptions for complexity signal keywords ── */
const SIGNAL_TOOLTIPS: Record<string, string> = {
  "webhook": "Chains of HTTP callbacks that propagate events across services",
  "payment": "External payment provider integrations adding failure surfaces",
  "refund": "Distinct refund lifecycle states that can conflict or duplicate",
  "retry": "Retry loops that can re-trigger side effects if not idempotent",
  "DB write": "Shared database writes across services risking race conditions",
  "ownership": "Missing documentation about who owns what code or process",
  "service": "Independently deployed services that must coordinate",
  "async": "Asynchronous messaging topics adding eventual-consistency risk",
  "queue": "Retry queues that can replay work and cause duplication",
  "protobuf": "Protocol buffer packages defining cross-service contracts",
  "hop": "Network hops in a distributed trace increasing latency and failure risk",
  "competing": "Multiple teams or services claiming ownership of the same area",
  "ranking": "Scoring signals combined to produce a final ranking",
  "scoring": "Rules that assign numeric scores to candidates or items",
  "fallback": "Fallback stages that activate when primary logic fails",
  "feature transform": "Feature engineering steps that reshape raw data for models",
  "SIMD": "Low-level vectorized code path optimized for throughput",
  "decision doc": "Missing architectural decision records for critical choices",
  "line": "Very large single-file component that is hard to reason about",
  "data hook": "Custom React hooks that fetch or manage data state",
  "cache": "Caching layers that can serve stale or inconsistent data",
  "selector": "Derived state selectors that recompute from store values",
  "modal": "Stacked modal dialogs with complex open/close state",
  "filter": "Shared filter state scattered across multiple owners",
  "DAG": "Directed acyclic graph pipelines defining task dependencies",
  "dbt": "dbt transformation models in the analytics pipeline",
  "upstream": "External data sources feeding into the pipeline",
  "table": "Critical database tables with many downstream consumers",
  "ownerless": "Transforms with no clear team ownership or documentation",
  "code style": "Inconsistent coding patterns across the codebase",
  "Terraform": "Infrastructure-as-code modules defining cloud resources",
  "cluster": "Compute clusters that host deployed workloads",
  "CI pipeline": "Continuous integration pipelines that build and test code",
  "deployed": "Services running in production environments",
  "env overlay": "Environment-specific config overrides (staging, prod, etc.)",
  "Drift": "Configuration drift between environments causing surprises",
};

function getSignalTooltip(signal: string): string {
  for (const [keyword, description] of Object.entries(SIGNAL_TOOLTIPS)) {
    if (signal.toLowerCase().includes(keyword.toLowerCase())) {
      return description;
    }
  }
  return "Complexity indicator identified by static analysis";
}

/* ── CountUp: animates a formatted string's numeric parts ── */
function CountUp({ value, duration = 0.7 }: { value: string; duration?: number }) {
  const [display, setDisplay] = useState(value);
  const rafRef = useRef(0);
  const prevRef = useRef(value);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = value;

    // Extract leading number (with optional decimals / commas) from prev & next
    const extract = (s: string) => {
      const m = s.match(/^([0-9][0-9,]*\.?\d*)/);
      if (!m) return null;
      const suffix = s.slice(m[0].length);
      const num = parseFloat(m[0].replace(/,/g, ""));
      const decimals = m[0].includes(".") ? (m[0].split(".")[1]?.length ?? 0) : 0;
      const hasCommas = m[0].includes(",");
      return { num, suffix, decimals, hasCommas };
    };

    const from = extract(prev);
    const to = extract(value);

    if (!from || !to || from.num === to.num) {
      setDisplay(value);
      return;
    }

    const start = performance.now();
    const fmt = (n: number) => {
      let s = to.decimals > 0 ? n.toFixed(to.decimals) : Math.round(n).toString();
      if (to.hasCommas) {
        const [int, dec] = s.split(".");
        s = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (dec ? `.${dec}` : "");
      }
      return s + to.suffix;
    };

    const tick = (now: number) => {
      const t = Math.min((now - start) / (duration * 1000), 1);
      const ease = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setDisplay(fmt(from.num + (to.num - from.num) * ease));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration]);

  return <>{display}</>;
}

/* ── Shared transition variants ── */
const crossfade = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: { duration: 0.22 },
};

export function RepoModal() {
  const { isOpen, close } = useModalStore();
  const { current, setCurrent } = useRepoStore();
  const [local, setLocal] = useState<RepoName>(current);
  const [activeQuestion, setActiveQuestion] = useState(0);
  const [treeExpanded, setTreeExpanded] = useState(false);
  const seedsRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (isOpen) setLocal(current); }, [isOpen, current]);
  useEffect(() => { setActiveQuestion(0); setTreeExpanded(false); }, [local]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    if (isOpen) document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [isOpen, close]);

  /* ── Arrow-key navigation for question seed buttons ── */
  const handleSeedKeyDown = useCallback((e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const container = seedsRef.current;
    if (!container) return;
    const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>("button.repo-modal-seed"));
    const idx = buttons.indexOf(e.currentTarget);
    if (idx === -1) return;
    const next = e.key === "ArrowDown"
      ? buttons[(idx + 1) % buttons.length]
      : buttons[(idx - 1 + buttons.length) % buttons.length];
    next?.focus();
  }, []);

  const pick = (n: RepoName) => { setLocal(n); setCurrent(n); };
  const data = REPOS[local];
  const preview = data.questions[activeQuestion] ?? data.questions[0];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div className="repo-modal is-open" style={{ "--ink": "#e4e4e7", "--ink-2": "#a1a1aa", "--ink-3": "#71717a", "--line": "rgba(255,255,255,.08)", "--line-2": "rgba(255,255,255,.04)", "--paper": "#0f0f14", "--paper-2": "#18181f", "--paper-3": "#1e1e28" } as React.CSSProperties}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}>
          <motion.div className="repo-modal-backdrop" onClick={close} />
          <motion.div className="repo-modal-shell" initial={{ y: 10, scale: 0.985 }} animate={{ y: 0, scale: 1 }} exit={{ y: 10, scale: 0.985 }} transition={{ duration: 0.26, ease: [0.2, 0.85, 0.2, 1] }}>
            <CircuitCanvas />
            <button type="button" className="repo-modal-close" onClick={close} aria-label="Close">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></svg>
            </button>
            <div className="repo-modal-card">
              <div className="repo-modal-main">
                <aside className="repo-modal-sidebar">
                  <div className="repo-modal-tabs-wrap">
                    <div className="repo-modal-tabs">
                      <div className="repo-modal-sidebar-label" style={{ padding: "0 2px 6px" }}>Sample repos</div>
                      {REPO_NAMES.map((n, i) => {
                        const repo = REPOS[n];
                        return (
                        <motion.button key={n} type="button" className={`repo-modal-tab${n === local ? " is-active" : ""}`} onClick={() => pick(n)}
                          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: i * 0.04, ease: [0.2, 0.85, 0.2, 1] }}>
                          <div className="repo-modal-tab-topline">
                            <span className="repo-modal-tab-kind">{repo.kind}</span>
                          </div>
                          <div className="repo-modal-tab-name">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0, opacity: 0.45 }}>
                              <path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.868-.013-1.703-2.782.604-3.369-1.342-3.369-1.342-.454-1.154-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836a9.59 9.59 0 0 1 2.504.337c1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
                            </svg>
                            {n}
                          </div>
                          <div className="repo-modal-tab-path">{repo.tree.split("\n").slice(1, 4).map((line) => line.replace(/^[│├└─\s]+/, "").replace(/\/$/, "")).join("  /  ")}</div>
                          <div className="repo-modal-tab-meta">
                            <span>{repo.language}</span>
                            <span>{repo.meta.find((item) => item.k === "Lines")?.v ?? repo.meta[1]?.v} LoC</span>
                            <span>{repo.meta[0]?.v} {repo.meta[0]?.k}</span>
                          </div>
                        </motion.button>
                        );
                      })}

                    </div>
                  </div>
                </aside>

                <div className="repo-modal-content">
                  <AnimatePresence mode="wait">
                  <motion.div key={local} {...crossfade} style={{ display: "contents" }}>
                  <header className="repo-modal-head">
                    <div className="repo-modal-head-row">
                      <span className="repo-modal-dot" aria-hidden="true">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4.75 7.75A2.75 2.75 0 0 1 7.5 5h3.13c.73 0 1.42.3 1.93.84l.8.82c.5.52 1.2.81 1.92.81h1.22a2.75 2.75 0 0 1 2.75 2.75v5.28A2.75 2.75 0 0 1 16.5 18.25h-9A2.75 2.75 0 0 1 4.75 15.5z"/>
                          <path d="M8.5 11.25h7"/>
                        </svg>
                      </span>
                      <span className="repo-modal-kind">{data.kind}</span>
                      <h2 className="repo-modal-name">{local}</h2>
                      <span className="repo-modal-status"><span className="repo-modal-status-pulse" />Indexed</span>
                    </div>
                    <div className="repo-modal-submeta">
                      <span className="repo-modal-submeta-pill">{data.language}</span>
                      <span className="repo-modal-submeta-pill">{data.meta.find((item) => item.k === "Lines")?.v ?? "?"} lines of code</span>
                      <span className="repo-modal-submeta-pill">{preview.ask}</span>
                    </div>
                  </header>

                  <div className="repo-modal-meta-row">
                    {data.meta.map((m) => (<div key={m.k} className="repo-modal-meta"><div className="repo-modal-meta-k">{m.k}</div><div className="repo-modal-meta-v"><CountUp value={m.v} /></div></div>))}
                  </div>

                  <div className="repo-modal-body">
                    <div className="repo-modal-section-label">// Complexity Signals</div>
                    <div className="repo-modal-signals">
                      {data.signals.map((signal) => <span key={signal} className="repo-modal-signal" title={getSignalTooltip(signal)}>{signal}</span>)}
                    </div>

                    {/* L2 — Ask p0 (accordion) */}
                    <div className="repo-modal-section-label">// Ask p0</div>
                    <div className="repo-modal-seeds" ref={seedsRef}>
                      {data.questions.map((question, index) => {
                        const isActive = index === activeQuestion;
                        return (
                          <div key={question.ask} className="repo-modal-accordion">
                            <button type="button" className={`repo-modal-seed${isActive ? " is-active" : ""}`} onClick={() => setActiveQuestion(index)} onKeyDown={handleSeedKeyDown}>
                              {question.ask}
                            </button>
                            <AnimatePresence>
                            {isActive && (
                              <motion.div
                                className="repo-modal-preview"
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.25, ease: [0.2, 0.85, 0.2, 1] }}
                                style={{ overflow: "hidden" }}
                              >
                                <div className="repo-modal-preview-inner">
                                  <div className="repo-modal-preview-stats">
                                    {question.stats.map((stat) => (
                                      <div key={stat.k} className="repo-modal-preview-stat">
                                        <div className="repo-modal-preview-stat-k">{stat.k}</div>
                                        <div className="repo-modal-preview-stat-v">{stat.v}</div>
                                      </div>
                                    ))}
                                  </div>
                                  <h3 className="repo-modal-preview-title">{question.answerTitle}</h3>
                                  <p className="repo-modal-preview-summary">{question.answerSummary}</p>
                                  <div className="repo-modal-preview-list">
                                    {question.answerBullets.map((bullet) => <div key={bullet} className="repo-modal-preview-item">{bullet}</div>)}
                                  </div>
                                  <div className="repo-modal-preview-artifacts">
                                    <div className="repo-modal-preview-artifacts-label">Artifacts</div>
                                    <div className="repo-modal-preview-artifacts-list">
                                      {question.artifacts.map((artifact) => <span key={artifact} className="repo-modal-preview-artifact">{artifact}</span>)}
                                    </div>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </div>

                    {/* L3 — System shape */}
                    <div className="repo-modal-section-label">// System Shape</div>
                    <pre className="repo-modal-tree"><span style={{ color: "var(--ink-3)" }}>{"# "}</span>{treeExpanded ? data.tree : data.tree.split("\n").slice(0, 8).join("\n")}</pre>
                    {data.tree.split("\n").length > 8 && (
                      <button
                        type="button"
                        className="repo-modal-tree-toggle"
                        onClick={() => setTreeExpanded((v) => !v)}
                        style={{ fontSize: "0.68rem", color: "var(--ink-3)", cursor: "pointer", border: "none", background: "none", padding: "6px 0" }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--ink-2)"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--ink-3)"; }}
                      >
                        {treeExpanded ? "Show less" : "Show more"}
                      </button>
                    )}
                  </div>
                  </motion.div>
                  </AnimatePresence>
                </div>
              </div>

            </div>
            <footer className="repo-modal-foot">
              <p className="repo-modal-foot-note">Pick the hardest sample → inspect the answer → bring your own repo.</p>
              <div className="repo-modal-actions">
                <button type="button" className="repo-modal-cta repo-modal-cta-secondary">
                  Try hardest question
                </button>
                <button type="button" className="repo-modal-cta">
                  Analyze this repo
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
                </button>
              </div>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
