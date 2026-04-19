import { useState, type CSSProperties, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleCheck,
  PanelLeft,
  Plus,
  Rocket,
  Sparkles,
  X,
} from "lucide-react";
import { DemoAppHero } from "../../internal/DemoAppHero";
import { useDemoNav } from "../../DemoPage";

type Rect = { top: number; left: number; w: number; h: number };
type Placement = "right" | "left" | "bottom" | "top";

type Step = {
  title: string;
  body: string;
  hole: Rect;
  tooltip: { top: number; left: number };
  tailPlacement: Placement;
};

const STEPS: Step[] = [
  {
    title: "Workspace picker",
    body: "Switch between orgs or spin up a sandbox. Your permissions travel with you.",
    hole: { top: 8, left: 8, w: 180, h: 22 },
    tooltip: { top: 46, left: 20 },
    tailPlacement: "top",
  },
  {
    title: "File tree",
    body: "Repositories, folders, sample runs. Pin anything you touch often.",
    hole: { top: 44, left: 8, w: 216, h: 450 },
    tooltip: { top: 72, left: 244 },
    tailPlacement: "left",
  },
  {
    title: "Code Universe",
    body: "Zoom out to see the whole codebase graph. Every function becomes a node with live risk coloring.",
    hole: { top: 44, left: 232, w: 460, h: 450 },
    tooltip: { top: 88, left: 472 },
    tailPlacement: "bottom",
  },
  {
    title: "Inspector",
    body: "When you focus on a symbol, this shows its risk, blast radius, tests, incidents, and owners.",
    hole: { top: 44, left: 698, w: 278, h: 450 },
    tooltip: { top: 96, left: 406 },
    tailPlacement: "right",
  },
  {
    title: "Agent",
    body: "Ask the agent to refactor, explain, or generate a policy. It knows your full workspace.",
    hole: { top: 432, left: 632, w: 54, h: 54 },
    tooltip: { top: 286, left: 286 },
    tailPlacement: "right",
  },
  {
    title: "Keyboard shortcuts",
    body: "Press ⌘/ anytime for the full cheatsheet. Most common actions have a binding.",
    hole: { top: 8, left: 880, w: 100, h: 22 },
    tooltip: { top: 44, left: 568 },
    tailPlacement: "top",
  },
];

const SAVED_TOURS = [
  {
    id: "default",
    title: "Onboarding (default)",
    blurb: "Six-step walkthrough of the main surfaces. Recommended for first-time users.",
    count: "6 steps · 90s",
  },
  {
    id: "policies",
    title: "Policies deep-dive",
    blurb: "From writing a rule to dry-running it against a past analysis, and publishing.",
    count: "8 steps · 3m",
  },
  {
    id: "agent",
    title: "Agent power-user",
    blurb: "Prompts, slash-commands, and scoping the agent to a file, folder, or the whole workspace.",
    count: "5 steps · 2m",
  },
];

function StepPill({
  active,
  complete,
  label,
  onClick,
}: {
  active: boolean;
  complete: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "step" : undefined}
      aria-label={label}
      style={{
        width: 28,
        height: 10,
        padding: 0,
        border: 0,
        borderRadius: "var(--radius-pill)",
        background: active
          ? "var(--fg)"
          : complete
          ? "var(--success)"
          : "var(--bg-muted)",
        cursor: "pointer",
        transition: "background 0.14s ease, transform 0.14s ease",
        transform: active ? "scaleY(1.4)" : "none",
      }}
    />
  );
}

function TrafficLight({ color }: { color: string }) {
  return (
    <span
      style={{
        width: 10,
        height: 10,
        borderRadius: "50%",
        background: color,
        display: "inline-block",
      }}
    />
  );
}

function FakeTab({ children, active }: { children: ReactNode; active?: boolean }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--space-1h)",
        padding: "3px var(--space-2)",
        borderRadius: "var(--radius-xs)",
        background: active ? "var(--bg-subtle)" : "transparent",
        border: active ? "1px solid var(--border)" : "1px solid transparent",
        color: active ? "var(--fg)" : "var(--fg-muted)",
        fontSize: "var(--fs-10)",
        fontFamily: "var(--font-mono)",
      }}
    >
      {children}
    </span>
  );
}

function FakeSidebar() {
  const rows = [
    { depth: 0, label: "acme", bold: true },
    { depth: 1, label: "order-service" },
    { depth: 2, label: "src/" },
    { depth: 3, label: "order_service.py", active: true },
    { depth: 3, label: "models.py" },
    { depth: 3, label: "router.py" },
    { depth: 2, label: "tests/" },
    { depth: 1, label: "payment-gateway" },
    { depth: 1, label: "identity-core" },
    { depth: 1, label: "notifier" },
    { depth: 0, label: "Pinned runs", bold: true },
    { depth: 1, label: "weekly-risk", tag: "live" },
    { depth: 1, label: "ledger-blast" },
  ];
  return (
    <aside
      style={{
        borderRight: "1px solid var(--border)",
        padding: "var(--space-2) 0",
        background: "var(--bg)",
        overflow: "hidden",
      }}
    >
      {rows.map((r, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-1)",
            padding: `3px calc(var(--space-3) + ${r.depth * 10}px)`,
            background: r.active ? "var(--bg-hover)" : "transparent",
            fontSize: "var(--fs-10)",
            color: r.bold ? "var(--fg-subtle)" : "var(--fg-muted)",
            fontWeight: r.bold ? "var(--fw-semibold)" : "var(--fw-medium)",
            letterSpacing: r.bold ? "0.06em" : "0",
            textTransform: r.bold ? "uppercase" : "none",
            fontFamily: r.bold ? "inherit" : "var(--font-mono)",
          }}
        >
          <span style={{ color: r.active ? "var(--accent)" : "var(--fg-subtle)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {r.label}
          </span>
          {r.tag ? (
            <span
              style={{
                padding: "0 4px",
                borderRadius: "var(--radius-xs)",
                fontSize: 8,
                background: "color-mix(in srgb, var(--success) 18%, var(--bg))",
                color: "var(--success)",
                fontFamily: "inherit",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              {r.tag}
            </span>
          ) : null}
        </div>
      ))}
    </aside>
  );
}

function FakeCanvas() {
  // 6x4 grid of node dots — cheap canvas feel
  const nodes: { x: number; y: number; risk: number }[] = [];
  let seed = 17;
  for (let y = 0; y < 4; y += 1) {
    for (let x = 0; x < 6; x += 1) {
      seed = (seed * 9301 + 49297) % 233280;
      const risk = (seed % 1000) / 1000;
      nodes.push({ x, y, risk });
    }
  }
  const edges: [number, number][] = [
    [0, 1], [1, 2], [1, 8], [2, 3], [3, 9], [8, 14], [9, 15], [4, 5],
    [5, 11], [11, 17], [6, 12], [12, 18], [13, 19], [10, 16], [7, 13],
    [14, 20], [15, 21], [16, 22], [17, 23],
  ];
  const toColor = (risk: number) =>
    risk > 0.72
      ? "var(--danger)"
      : risk > 0.5
      ? "var(--warn)"
      : risk > 0.28
      ? "var(--accent)"
      : "var(--success)";

  return (
    <main
      style={{
        position: "relative",
        background:
          "radial-gradient(circle at 30% 20%, color-mix(in srgb, var(--accent) 10%, var(--bg-subtle)) 0%, var(--bg-subtle) 60%)",
        padding: "var(--space-4)",
        overflow: "hidden",
      }}
    >
      <svg
        viewBox="0 0 460 440"
        preserveAspectRatio="xMidYMid meet"
        width="100%"
        height="100%"
        style={{ display: "block" }}
        aria-hidden="true"
      >
        <defs>
          <pattern id="tour-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="var(--border)" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="460" height="440" fill="url(#tour-grid)" />
        {edges.map(([a, b], i) => {
          const na = nodes[a];
          const nb = nodes[b];
          if (!na || !nb) return null;
          return (
            <line
              key={i}
              x1={40 + na.x * 70}
              y1={40 + na.y * 96}
              x2={40 + nb.x * 70}
              y2={40 + nb.y * 96}
              stroke="var(--border)"
              strokeWidth={1}
            />
          );
        })}
        {nodes.map((n, i) => (
          <g key={i}>
            <circle
              cx={40 + n.x * 70}
              cy={40 + n.y * 96}
              r={10}
              fill="var(--bg)"
              stroke={toColor(n.risk)}
              strokeWidth={2}
            />
            <circle cx={40 + n.x * 70} cy={40 + n.y * 96} r={4} fill={toColor(n.risk)} />
          </g>
        ))}
        {/* highlight focus symbol */}
        <circle
          cx={40 + 2 * 70}
          cy={40 + 1 * 96}
          r={18}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={1.5}
          strokeDasharray="3 3"
        />
        <text
          x={40 + 2 * 70 + 24}
          y={40 + 1 * 96 + 4}
          fontFamily="var(--font-mono)"
          fontSize="10"
          fill="var(--fg)"
        >
          place_order()
        </text>
      </svg>

      {/* floating agent bubble (step 5 target lives here) */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          right: 16,
          bottom: 16,
          width: 50,
          height: 50,
          borderRadius: "50%",
          background: "var(--fg)",
          color: "var(--bg)",
          display: "grid",
          placeItems: "center",
          boxShadow: "var(--shadow-md)",
          border: "3px solid var(--bg)",
        }}
      >
        <Sparkles size={18} strokeWidth={1.8} />
      </div>
    </main>
  );
}

function FakeInspector() {
  const rows = [
    { label: "Risk score",   value: "0.74", tone: "danger" as const },
    { label: "Blast radius", value: "17",   tone: "warn" as const },
    { label: "Tests",        value: "4/6",  tone: "warn" as const },
    { label: "Incidents",    value: "2",    tone: "danger" as const },
    { label: "Owner",        value: "@orders-platform", tone: "neutral" as const },
    { label: "Last changed", value: "3 days ago", tone: "neutral" as const },
  ];
  const toneColor = (t: "danger" | "warn" | "neutral") =>
    t === "danger" ? "var(--danger)" : t === "warn" ? "var(--warn)" : "var(--fg)";
  return (
    <aside
      style={{
        borderLeft: "1px solid var(--border)",
        padding: "var(--space-3)",
        background: "var(--bg)",
        overflow: "hidden",
      }}
    >
      <div style={{ fontSize: "var(--fs-10)", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-subtle)", fontWeight: "var(--fw-bold)", marginBottom: "var(--space-1h)" }}>
        Inspector
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-xs)", color: "var(--fg)", marginBottom: "var(--space-3)" }}>
        place_order()
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1h)" }}>
        {rows.map((r) => (
          <div
            key={r.label}
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: "var(--space-2)",
              padding: "var(--space-1) 0",
              borderBottom: "1px dashed var(--border)",
            }}
          >
            <span style={{ flex: 1, fontSize: "var(--fs-10)", color: "var(--fg-subtle)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              {r.label}
            </span>
            <span
              style={{
                fontSize: "var(--fs-xs)",
                fontFamily: "var(--font-mono)",
                color: toneColor(r.tone),
                fontWeight: "var(--fw-semibold)",
              }}
            >
              {r.value}
            </span>
          </div>
        ))}
      </div>
    </aside>
  );
}

function CoachTail({ placement }: { placement: Placement }) {
  const base: CSSProperties = {
    position: "absolute",
    width: 12,
    height: 12,
    background: "var(--bg)",
    border: "1px solid var(--border)",
    transform: "rotate(45deg)",
  };
  if (placement === "right") {
    return <span aria-hidden="true" style={{ ...base, left: -7, top: 24, borderRight: "0", borderTop: "0" }} />;
  }
  if (placement === "left") {
    return <span aria-hidden="true" style={{ ...base, right: -7, top: 24, borderLeft: "0", borderBottom: "0" }} />;
  }
  if (placement === "bottom") {
    return <span aria-hidden="true" style={{ ...base, top: -7, left: 24, borderRight: "0", borderBottom: "0" }} />;
  }
  return <span aria-hidden="true" style={{ ...base, bottom: -7, left: 24, borderLeft: "0", borderTop: "0" }} />;
}

export function ProductTourPage() {
  const { navigate } = useDemoNav();
  const [activeStep, setActiveStep] = useState(2); // 0..5 → starts on step 3 to match "3 / 6"
  const [complete, setComplete] = useState(false);
  const [showOnFirstSignIn, setShowOnFirstSignIn] = useState(true);
  const [showWhatsNew, setShowWhatsNew] = useState(true);

  const step = STEPS[activeStep];
  const isLast = activeStep === STEPS.length - 1;

  const goNext = () => {
    if (isLast) {
      setComplete(true);
    } else {
      setActiveStep((n) => Math.min(STEPS.length - 1, n + 1));
    }
  };
  const goBack = () => setActiveStep((n) => Math.max(0, n - 1));
  const skip = () => setComplete(true);
  const restart = () => {
    setComplete(false);
    setActiveStep(0);
  };

  return (
    <div className="demo-app">
      <DemoAppHero
        editorial
        kicker="Onboarding"
        title={<>Interactive <em>product</em> tour</>}
        sub="A guided walkthrough of the key surfaces. Step through the tooltips, or skip to what you care about."
      />
      <div className="demo-app__body">
        {/* Tour controls */}
        <div className="demo-sectionbar">
          <span
            className="demo-badge demo-badge--accent"
            style={{ fontSize: "var(--fs-10)" }}
          >
            Step {Math.min(activeStep + 1, STEPS.length)} / {STEPS.length}
          </span>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={STEPS.length}
            aria-valuenow={activeStep + 1}
            style={{ display: "inline-flex", gap: 4, alignItems: "center" }}
          >
            {STEPS.map((s, i) => (
              <StepPill
                key={s.title}
                active={i === activeStep && !complete}
                complete={complete || i < activeStep}
                label={`Step ${i + 1}: ${s.title}`}
                onClick={() => {
                  setComplete(false);
                  setActiveStep(i);
                }}
              />
            ))}
          </div>
          <span style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", marginLeft: "var(--space-2)" }}>
            {complete ? "Tour complete" : step.title}
          </span>
          <span className="demo-sectionbar__spacer" />
          <button
            type="button"
            className="demo-btn demo-btn--ghost"
            onClick={skip}
            disabled={complete}
            style={{ height: 28 }}
          >
            Skip tour
          </button>
          <button
            type="button"
            className="demo-btn demo-btn--ghost"
            onClick={goBack}
            disabled={activeStep === 0 || complete}
            style={{ height: 28 }}
          >
            <ArrowLeft size={12} strokeWidth={2} aria-hidden="true" />
            Back
          </button>
          <button
            type="button"
            className="demo-btn demo-btn--primary"
            onClick={goNext}
            disabled={complete}
            style={{ height: 28 }}
          >
            {isLast ? "Finish" : "Next"}
            <ArrowRight size={12} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>

        {/* Simulated app chrome */}
        <div
          style={{
            position: "relative",
            minHeight: 540,
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            background: "var(--bg-subtle)",
            overflow: "hidden",
          }}
        >
          {/* fake topbar */}
          <div
            style={{
              height: 36,
              borderBottom: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              gap: "var(--space-2)",
              padding: "0 var(--space-3)",
              background: "var(--bg)",
            }}
          >
            <div style={{ display: "inline-flex", gap: 6, marginRight: "var(--space-2)" }}>
              <TrafficLight color="#ff5f57" />
              <TrafficLight color="#febc2e" />
              <TrafficLight color="#28c840" />
            </div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "var(--space-1h)",
                padding: "2px var(--space-2)",
                borderRadius: "var(--radius-xs)",
                border: "1px solid var(--border)",
                background: "var(--bg-subtle)",
                fontSize: "var(--fs-10)",
                color: "var(--fg-muted)",
                fontWeight: "var(--fw-medium)",
              }}
            >
              <PanelLeft size={11} strokeWidth={1.7} aria-hidden="true" />
              acme · production
            </div>
            <FakeTab>order-service.py</FakeTab>
            <FakeTab active>Code Universe</FakeTab>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 18,
                height: 18,
                color: "var(--fg-subtle)",
                cursor: "pointer",
              }}
            >
              <Plus size={11} strokeWidth={1.7} aria-hidden="true" />
            </span>
            <span style={{ flex: 1 }} />
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "2px var(--space-1h)",
                borderRadius: "var(--radius-xs)",
                border: "1px solid var(--border)",
                background: "var(--bg-subtle)",
                fontSize: "var(--fs-10)",
                fontFamily: "var(--font-mono)",
                color: "var(--fg-muted)",
              }}
            >
              <kbd style={{ fontFamily: "inherit" }}>⌘</kbd>
              <kbd style={{ fontFamily: "inherit" }}>/</kbd>
              <span style={{ marginLeft: 4 }}>Shortcuts</span>
            </div>
          </div>

          {/* fake body */}
          <div style={{ display: "grid", gridTemplateColumns: "220px 1fr 280px", minHeight: 500 }}>
            <FakeSidebar />
            <FakeCanvas />
            <FakeInspector />
          </div>

          {/* ===== COACHMARK OVERLAY ===== */}
          {!complete ? (
            <>
              {/* dimmer — non-pointer-blocking */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "rgba(0,0,0,0.42)",
                  pointerEvents: "none",
                }}
                aria-hidden="true"
              />
              {/* spotlight */}
              <div
                style={{
                  position: "absolute",
                  top: step.hole.top,
                  left: step.hole.left,
                  width: step.hole.w,
                  height: step.hole.h,
                  borderRadius: "var(--radius-md)",
                  boxShadow: "0 0 0 9999px rgba(0,0,0,0.42)",
                  border: "2px solid var(--accent)",
                  background: "transparent",
                  pointerEvents: "none",
                }}
                aria-hidden="true"
              />
              {/* tooltip */}
              <div
                role="dialog"
                aria-labelledby="coach-title"
                aria-describedby="coach-body"
                style={{
                  position: "absolute",
                  top: step.tooltip.top,
                  left: step.tooltip.left,
                  width: 340,
                  padding: "var(--space-4)",
                  background: "var(--bg)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  boxShadow: "var(--shadow-md)",
                  zIndex: 2,
                }}
              >
                <CoachTail placement={step.tailPlacement} />
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-2)",
                    marginBottom: "var(--space-1h)",
                  }}
                >
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 22,
                      height: 22,
                      background: "var(--accent)",
                      color: "#fff",
                      borderRadius: "var(--radius-xs)",
                      fontSize: "var(--fs-10)",
                      fontWeight: "var(--fw-bold)",
                      fontFamily: "var(--font-mono)",
                      letterSpacing: "0.04em",
                    }}
                    aria-hidden="true"
                  >
                    {activeStep + 1}
                  </span>
                  <h3
                    id="coach-title"
                    style={{
                      margin: 0,
                      fontSize: "var(--fs-md)",
                      fontWeight: "var(--fw-semibold)",
                      letterSpacing: "-0.005em",
                    }}
                  >
                    {step.title}
                  </h3>
                  <span style={{ flex: 1 }} />
                  <button
                    type="button"
                    aria-label="Close"
                    onClick={skip}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 20,
                      height: 20,
                      padding: 0,
                      border: 0,
                      background: "transparent",
                      color: "var(--fg-subtle)",
                      cursor: "pointer",
                      borderRadius: "var(--radius-xs)",
                    }}
                  >
                    <X size={12} strokeWidth={2} aria-hidden="true" />
                  </button>
                </div>
                <p
                  id="coach-body"
                  style={{
                    margin: 0,
                    fontSize: "var(--fs-xs)",
                    color: "var(--fg-muted)",
                    lineHeight: "var(--lh-relaxed)",
                  }}
                >
                  {step.body}
                </p>
                <div
                  style={{
                    display: "flex",
                    gap: "var(--space-2)",
                    marginTop: "var(--space-3)",
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{
                      fontSize: "var(--fs-10)",
                      color: "var(--fg-subtle)",
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      fontWeight: "var(--fw-semibold)",
                    }}
                  >
                    {activeStep + 1} of {STEPS.length}
                  </span>
                  <span style={{ flex: 1 }} />
                  <button
                    type="button"
                    className="demo-btn demo-btn--ghost"
                    onClick={skip}
                    style={{ height: 28 }}
                  >
                    Skip
                  </button>
                  <button
                    type="button"
                    className="demo-btn demo-btn--ghost"
                    onClick={goBack}
                    disabled={activeStep === 0}
                    style={{ height: 28 }}
                  >
                    <ArrowLeft size={12} strokeWidth={2} aria-hidden="true" />
                    Back
                  </button>
                  <button
                    type="button"
                    className="demo-btn demo-btn--primary"
                    onClick={goNext}
                    style={{ height: 28 }}
                  >
                    {isLast ? "Finish" : "Next"}
                    {!isLast ? <ArrowRight size={12} strokeWidth={2} aria-hidden="true" /> : null}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "grid",
                placeItems: "center",
                background: "rgba(0,0,0,0.46)",
                zIndex: 3,
              }}
              role="dialog"
              aria-labelledby="tour-complete-title"
            >
              <div
                style={{
                  width: 420,
                  padding: "var(--space-5)",
                  background: "var(--bg)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  boxShadow: "var(--shadow-md)",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 56,
                    height: 56,
                    borderRadius: "50%",
                    background: "color-mix(in srgb, var(--success) 16%, var(--bg))",
                    color: "var(--success)",
                    marginBottom: "var(--space-3)",
                  }}
                >
                  <CircleCheck size={28} strokeWidth={1.6} aria-hidden="true" />
                </div>
                <h3
                  id="tour-complete-title"
                  style={{
                    margin: 0,
                    fontSize: "var(--fs-lg)",
                    fontWeight: "var(--fw-bold)",
                    letterSpacing: "-0.01em",
                  }}
                >
                  Tour complete
                </h3>
                <p
                  style={{
                    margin: "var(--space-1h) 0 var(--space-4) 0",
                    fontSize: "var(--fs-sm)",
                    color: "var(--fg-muted)",
                    lineHeight: "var(--lh-relaxed)",
                  }}
                >
                  You've seen the main surfaces. Jump into the checklist to finish setup, or restart
                  the tour anytime.
                </p>
                <div
                  style={{
                    display: "flex",
                    gap: "var(--space-2)",
                    justifyContent: "center",
                  }}
                >
                  <button
                    type="button"
                    className="demo-btn demo-btn--ghost"
                    onClick={restart}
                    style={{ height: 32 }}
                  >
                    Restart tour
                  </button>
                  <button
                    type="button"
                    className="demo-btn demo-btn--primary"
                    onClick={() => navigate("onboarding.checklist")}
                    style={{ height: 32 }}
                  >
                    <Rocket size={13} strokeWidth={1.8} aria-hidden="true" />
                    Jump to Getting started checklist
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Saved tours */}
        <div style={{ marginTop: "var(--space-5)" }}>
          <div className="demo-sectionbar">
            <span className="demo-sectionbar__title">Saved tours</span>
            <span className="demo-sectionbar__desc">Launch a specific walkthrough from here</span>
          </div>
          <div className="demo-grid-3">
            {SAVED_TOURS.map((t) => (
              <div key={t.id} className="demo-catalog__card" style={{ cursor: "default" }}>
                <div className="demo-catalog__card-head">
                  <span className="demo-catalog__card-icon">
                    <Rocket size={14} strokeWidth={1.7} aria-hidden="true" />
                  </span>
                  <span className="demo-catalog__card-cat">Guided</span>
                </div>
                <div className="demo-catalog__card-title">{t.title}</div>
                <div className="demo-catalog__card-blurb">{t.blurb}</div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-2)",
                    marginTop: "var(--space-2)",
                  }}
                >
                  <span className="demo-catalog__card-count">{t.count}</span>
                  <span style={{ flex: 1 }} />
                  <button
                    type="button"
                    className="demo-btn demo-btn--primary"
                    onClick={restart}
                    style={{ height: 26, padding: "0 var(--space-2h)" }}
                  >
                    Launch
                    <ArrowRight size={11} strokeWidth={2} aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Preferences */}
        <div style={{ marginTop: "var(--space-5)" }}>
          <div className="demo-sectionbar">
            <span className="demo-sectionbar__title">Preferences</span>
            <span className="demo-sectionbar__desc">Apply to every member of this workspace</span>
          </div>
          <div className="demo-block">
            <PrefRow
              title="Show tour on first sign-in"
              hint="New members see the 6-step default tour the first time they land in the IDE."
              checked={showOnFirstSignIn}
              onChange={setShowOnFirstSignIn}
            />
            <PrefRow
              title={`Show "What's new" coachmarks after releases`}
              hint="After every release, highlight new surfaces with a one-time coachmark on hover."
              checked={showWhatsNew}
              onChange={setShowWhatsNew}
            />
            <PrefRow
              title="Announce tour completion in the activity feed"
              hint="Let teammates know when you finish a tour, so they can follow up with tips."
              checked={false}
              onChange={() => undefined}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function PrefRow({
  title,
  hint,
  checked,
  onChange,
}: {
  title: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) auto",
        alignItems: "center",
        gap: "var(--space-3)",
        padding: "var(--space-3) var(--space-4)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--space-1h)",
            fontSize: "var(--fs-sm)",
            fontWeight: "var(--fw-medium)",
            color: "var(--fg)",
          }}
        >
          {checked ? (
            <span style={{ color: "var(--success)", display: "inline-flex" }}>
              <Check size={12} strokeWidth={2} aria-hidden="true" />
            </span>
          ) : null}
          {title}
        </div>
        <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", marginTop: 2 }}>
          {hint}
        </div>
      </div>
      <label className="demo-toggle">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="demo-toggle__track" />
      </label>
    </div>
  );
}
