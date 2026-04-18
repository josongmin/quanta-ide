import { useMemo, useState } from "react";
import {
  Play,
  Copy,
  Check,
  Zap,
  Clipboard,
  ArrowRight,
} from "lucide-react";
import { DemoAppHero } from "../../internal/DemoAppHero";

type Method = "GET" | "POST" | "DELETE" | "PATCH";

type Endpoint = {
  id: string;
  method: Method;
  path: string;
};

const ENDPOINTS: Endpoint[] = [
  { id: "create_analysis",   method: "POST",   path: "/v1/analyses" },
  { id: "evaluate_policy",   method: "POST",   path: "/v1/policies/evaluate" },
  { id: "get_blast_radius",  method: "GET",    path: "/v1/symbols/:id/blast-radius" },
  { id: "taint_trace",       method: "POST",   path: "/v1/traces/taint" },
  { id: "scan_secrets",      method: "POST",   path: "/v1/scans/secrets" },
  { id: "member_check",      method: "GET",    path: "/v1/members/:email/access" },
  { id: "incident_correlate",method: "POST",   path: "/v1/incidents/correlate" },
];

const METHOD_COLOR: Record<Method, { bg: string; fg: string }> = {
  GET:    { bg: "color-mix(in srgb, var(--success) 14%, var(--bg))", fg: "var(--success)" },
  POST:   { bg: "color-mix(in srgb, var(--accent) 14%, var(--bg))",  fg: "var(--accent)" },
  DELETE: { bg: "color-mix(in srgb, var(--danger) 14%, var(--bg))",  fg: "var(--danger)" },
  PATCH:  { bg: "color-mix(in srgb, var(--warn) 14%, var(--bg))",    fg: "var(--warn)" },
};

type Preset = {
  id: string;
  label: string;
  endpointId: string;
  body: string;
  response: (now: string, callId: string) => string;
  bytes: number;
  ms: number;
};

const PRESETS: Preset[] = [
  {
    id: "risk_commit",
    label: "Risk score a commit",
    endpointId: "create_analysis",
    body: `{
  "repo": "acme/order-service",
  "ref": "refs/heads/main",
  "commit": "9b4f12a8d7c0",
  "engine": "risk",
  "options": {
    "include_tests": false,
    "depth": "standard"
  }
}`,
    response: (now, id) => `{
  "id": "${id}",
  "object": "analysis",
  "repo": "acme/order-service",
  "commit": "9b4f12a8d7c0",
  "engine": "risk",
  "risk_score": 0.62,
  "blast_radius": 23,
  "top_factors": [
    "cross_module_write",
    "auth_path_touched"
  ],
  "created_at": "${now}"
}`,
    bytes: 2316,
    ms: 184,
  },
  {
    id: "blast_user_service",
    label: "Blast radius: change user_service.py",
    endpointId: "get_blast_radius",
    body: `{
  "symbol": "user_service.py::UserService.update_email",
  "repo": "acme/core-api",
  "depth": 3,
  "include_tests": true
}`,
    response: (now, id) => `{
  "id": "${id}",
  "symbol": "UserService.update_email",
  "total_impacted": 47,
  "by_kind": {
    "functions": 18,
    "classes": 4,
    "tests": 21,
    "configs": 4
  },
  "hotspots": [
    "payments/checkout.py",
    "notify/email.py"
  ],
  "computed_at": "${now}"
}`,
    bytes: 1842,
    ms: 97,
  },
  {
    id: "taint_admin",
    label: "Taint trace: GET /admin",
    endpointId: "taint_trace",
    body: `{
  "source": "http.request.query.token",
  "sink": "db.raw_exec",
  "entrypoint": "GET /admin",
  "repo": "acme/admin-console",
  "max_hops": 8
}`,
    response: (now, id) => `{
  "id": "${id}",
  "tainted": true,
  "hops": 5,
  "path": [
    "handlers/admin.ts:34",
    "middleware/auth.ts:112",
    "db/query.ts:78",
    "db/raw.ts:21"
  ],
  "severity": "high",
  "traced_at": "${now}"
}`,
    bytes: 1502,
    ms: 246,
  },
  {
    id: "secrets_scan",
    label: "Policy violation: secrets scan",
    endpointId: "scan_secrets",
    body: `{
  "repo": "acme/core-api",
  "ref": "refs/heads/feat/payments",
  "entropy_threshold": 4.2,
  "redact": true
}`,
    response: (now, id) => `{
  "id": "${id}",
  "violations": [
    {
      "rule": "hardcoded_api_key",
      "file": "config/dev.ts",
      "line": 14,
      "preview": "STRIPE_SK=sk_live_••••",
      "severity": "critical"
    }
  ],
  "scanned_at": "${now}"
}`,
    bytes: 1120,
    ms: 312,
  },
  {
    id: "member_check",
    label: "Member onboarding check",
    endpointId: "member_check",
    body: `{
  "email": "maya@acme.com",
  "workspace": "acme",
  "required_repos": [
    "acme/core-api",
    "acme/docs"
  ]
}`,
    response: (now, id) => `{
  "id": "${id}",
  "email": "maya@acme.com",
  "status": "partial",
  "has_repos": ["acme/core-api"],
  "missing_repos": ["acme/docs"],
  "mfa_enabled": true,
  "checked_at": "${now}"
}`,
    bytes: 894,
    ms: 64,
  },
  {
    id: "incident_correlate",
    label: "Incident correlate",
    endpointId: "incident_correlate",
    body: `{
  "incident_id": "inc_01HZM7K3",
  "started_at": "2026-04-19T09:42:18Z",
  "affected_service": "checkout",
  "window_minutes": 30
}`,
    response: (now, id) => `{
  "id": "${id}",
  "incident_id": "inc_01HZM7K3",
  "correlated_deploys": [
    "deploy_9b4f12a",
    "deploy_7c1d309"
  ],
  "suspect_symbol": "PaymentsGateway.charge",
  "confidence": 0.81,
  "correlated_at": "${now}"
}`,
    bytes: 1612,
    ms: 143,
  },
];

type Header = { key: string; value: string };

const DEFAULT_HEADERS: Header[] = [
  { key: "Authorization", value: "Bearer pk_sandbox_••••f03a" },
  { key: "Content-Type",  value: "application/json" },
];

type RecentCall = {
  ts: string;
  endpoint: string;
  method: Method;
  status: number;
  ms: number;
  presetId: string;
};

const RECENT_SEED: RecentCall[] = [
  { ts: "10:14:02", method: "POST", endpoint: "/v1/analyses",              status: 200, ms: 184, presetId: "risk_commit" },
  { ts: "10:13:47", method: "POST", endpoint: "/v1/policies/evaluate",     status: 200, ms: 72,  presetId: "secrets_scan" },
  { ts: "10:13:31", method: "GET",  endpoint: "/v1/symbols/:id/blast-radius", status: 200, ms: 97,  presetId: "blast_user_service" },
  { ts: "10:12:58", method: "POST", endpoint: "/v1/traces/taint",          status: 429, ms: 12,  presetId: "taint_admin" },
];

function MethodPill({ method, size = "sm" }: { method: Method; size?: "sm" | "md" }) {
  const c = METHOD_COLOR[method];
  const dims =
    size === "md"
      ? { padding: "var(--space-1) var(--space-2h)", fontSize: "var(--fs-xs)", minWidth: 58 }
      : { padding: "var(--space-1) var(--space-2)", fontSize: "var(--fs-10)", minWidth: 46 };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-mono)",
        fontWeight: "var(--fw-semibold)",
        letterSpacing: "0.04em",
        borderRadius: "var(--radius-xs)",
        background: c.bg,
        color: c.fg,
        ...dims,
      }}
    >
      {method}
    </span>
  );
}

function CopyIconButton({ value, dark = false }: { value: string; dark?: boolean }) {
  const [copied, setCopied] = useState(false);
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);

  const onCopy = () => {
    void navigator.clipboard?.writeText(value).catch(() => {});
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const baseColor = dark ? "#e4e4e4" : "var(--fg-muted)";
  const baseBg = dark ? "#141414" : "var(--bg)";
  const baseBorder = dark ? "#1f1f1f" : "var(--border)";
  const hoverBg = dark ? "#1f1f1f" : "var(--bg-hover)";

  return (
    <button
      type="button"
      onClick={onCopy}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      aria-live="polite"
      aria-label={copied ? "Copied" : "Copy"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--space-1)",
        padding: "var(--space-1) var(--space-2)",
        height: 24,
        border: `1px solid ${copied ? "var(--success)" : hover ? (dark ? "#3a3a3a" : "var(--border-strong)") : baseBorder}`,
        borderRadius: "var(--radius-xs)",
        background: copied ? (dark ? "color-mix(in srgb, var(--success) 18%, #0a0a0a)" : "var(--bg-success-subtle)") : hover ? hoverBg : baseBg,
        color: copied ? "var(--success)" : baseColor,
        fontSize: "var(--fs-10)",
        fontFamily: "var(--font-mono)",
        fontWeight: "var(--fw-semibold)",
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        cursor: "pointer",
        outline: focus ? "2px solid var(--accent)" : "none",
        outlineOffset: 2,
      }}
    >
      {copied ? <Check size={10} strokeWidth={2.6} /> : <Copy size={10} strokeWidth={2} />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function StatusBadge({ status }: { status: number }) {
  const tone: "success" | "warn" | "danger" =
    status >= 500 ? "danger" : status >= 400 ? "warn" : "success";
  return <span className={`demo-badge demo-badge--${tone}`}>{status}</span>;
}

// Stable pseudo-random id from a seed.
function callIdFor(seed: number): string {
  const hex = Math.abs(seed * 2654435761)
    .toString(16)
    .padStart(12, "0")
    .slice(-12)
    .toUpperCase();
  return `an_${hex}`;
}

export function PlaygroundPage() {
  const [presetId, setPresetId] = useState<string>(PRESETS[0].id);
  const [runCount, setRunCount] = useState(0);
  const [pulse, setPulse] = useState(false);
  const [responseTs, setResponseTs] = useState("2026-04-19T10:14:22Z");
  const [callId, setCallId] = useState(() => callIdFor(1));
  const [shareCopied, setShareCopied] = useState(false);
  const [recent, setRecent] = useState<RecentCall[]>(RECENT_SEED);
  const [bodyOverride, setBodyOverride] = useState<string | null>(null);

  const preset = useMemo(
    () => PRESETS.find((p) => p.id === presetId) ?? PRESETS[0],
    [presetId],
  );
  const endpoint = useMemo(
    () =>
      ENDPOINTS.find((e) => e.id === preset.endpointId) ?? ENDPOINTS[0],
    [preset],
  );

  const body = bodyOverride ?? preset.body;
  const responseText = preset.response(responseTs, callId);
  const responseBytes = preset.bytes + runCount * 3;

  const onChangePreset = (id: string) => {
    setPresetId(id);
    setBodyOverride(null);
  };

  const onRun = () => {
    const now = new Date();
    const iso = now.toISOString().replace(/\.\d{3}Z$/, "Z");
    const hhmmss = iso.slice(11, 19);
    const nextCount = runCount + 1;
    const id = callIdFor(Date.now() + nextCount);
    setRunCount(nextCount);
    setResponseTs(iso);
    setCallId(id);
    setPulse(true);
    window.setTimeout(() => setPulse(false), 650);

    setRecent((prev) =>
      [
        {
          ts: hhmmss,
          method: endpoint.method,
          endpoint: endpoint.path,
          status: 200,
          ms: preset.ms,
          presetId: preset.id,
        },
        ...prev,
      ].slice(0, 4),
    );
  };

  const onReset = () => {
    setBodyOverride(null);
  };

  const onShare = () => {
    const url = `https://play.quanta.dev/s/${preset.id}-${callIdFor(runCount + 5)}`;
    void navigator.clipboard?.writeText(url).catch(() => {});
    setShareCopied(true);
    window.setTimeout(() => setShareCopied(false), 1500);
  };

  const onRecentClick = (call: RecentCall) => {
    const next = PRESETS.find((p) => p.id === call.presetId);
    if (next) {
      setPresetId(next.id);
      setBodyOverride(null);
    }
    // Mock interaction — real build would rehydrate the request.
    // eslint-disable-next-line no-console
    console.info("[playground] replay", call);
  };

  const rateUsed = 36;
  const rateTotal = 60;
  const ratePct = Math.round((rateUsed / rateTotal) * 100);

  return (
    <div className="demo-app">
      <DemoAppHero
        kicker="Developers"
        title="Engine playground"
        sub="Poke the engines with real requests. Nothing is saved — it's a sandbox against synthetic data."
      />
      <div className="demo-app__body">
        {/* Main sandbox shell */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            overflow: "hidden",
            background: "var(--bg)",
            minHeight: 580,
          }}
        >
          {/* LEFT — request */}
          <section
            aria-label="Request"
            style={{
              display: "flex",
              flexDirection: "column",
              minWidth: 0,
            }}
          >
            {/* Preset selector */}
            <div
              style={{
                padding: "var(--space-3) var(--space-4)",
                borderBottom: "1px solid var(--border)",
                background: "var(--bg-subtle)",
              }}
            >
              <label
                htmlFor="playground-preset"
                style={{
                  display: "block",
                  fontSize: "var(--fs-10)",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  fontWeight: "var(--fw-semibold)",
                  color: "var(--fg-subtle)",
                  marginBottom: "var(--space-1h)",
                }}
              >
                Example
              </label>
              <select
                id="playground-preset"
                className="demo-select"
                value={presetId}
                onChange={(e) => onChangePreset(e.target.value)}
              >
                {PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Endpoint + method */}
            <div
              style={{
                padding: "var(--space-3) var(--space-4)",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                gap: "var(--space-2h)",
              }}
            >
              <MethodPill method={endpoint.method} size="md" />
              <code
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--fs-sm)",
                  color: "var(--fg)",
                  fontWeight: "var(--fw-semibold)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  flex: 1,
                  minWidth: 0,
                }}
              >
                {endpoint.path}
              </code>
            </div>

            {/* Headers */}
            <div
              style={{
                padding: "var(--space-3) var(--space-4)",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <div
                style={{
                  fontSize: "var(--fs-10)",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  fontWeight: "var(--fw-semibold)",
                  color: "var(--fg-subtle)",
                  marginBottom: "var(--space-2)",
                }}
              >
                Headers
              </div>
              <div
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  overflow: "hidden",
                  background: "var(--bg)",
                }}
              >
                {DEFAULT_HEADERS.map((h, i) => (
                  <div
                    key={h.key}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "160px minmax(0, 1fr)",
                      padding: "var(--space-2) var(--space-3)",
                      borderTop: i === 0 ? 0 : "1px solid var(--border)",
                      alignItems: "baseline",
                      fontSize: "var(--fs-xs)",
                      fontFamily: "var(--font-mono)",
                      gap: "var(--space-2)",
                    }}
                  >
                    <span style={{ color: "var(--fg-muted)" }}>{h.key}</span>
                    <span
                      style={{
                        color: "var(--fg)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Body */}
            <div
              style={{
                padding: "var(--space-3) var(--space-4)",
                borderBottom: "1px solid var(--border)",
                flex: 1,
                display: "flex",
                flexDirection: "column",
                minHeight: 0,
              }}
            >
              <label
                htmlFor="playground-body"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-2)",
                  fontSize: "var(--fs-10)",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  fontWeight: "var(--fw-semibold)",
                  color: "var(--fg-subtle)",
                  marginBottom: "var(--space-1h)",
                }}
              >
                Body · JSON
                <span
                  style={{
                    marginLeft: "auto",
                    fontSize: "var(--fs-10)",
                    color: "var(--fg-subtle)",
                    letterSpacing: 0,
                    textTransform: "none",
                  }}
                >
                  {body.split("\n").length} lines
                </span>
              </label>
              <textarea
                id="playground-body"
                className="demo-textarea"
                spellCheck={false}
                value={body}
                onChange={(e) => setBodyOverride(e.target.value)}
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  lineHeight: 1.55,
                  minHeight: 220,
                  flex: 1,
                }}
              />
            </div>

            {/* Bottom bar */}
            <div
              style={{
                padding: "var(--space-2h) var(--space-4)",
                display: "flex",
                alignItems: "center",
                gap: "var(--space-2)",
                background: "var(--bg-subtle)",
              }}
            >
              <button
                type="button"
                className="demo-btn demo-btn--ghost"
                onClick={onReset}
              >
                Reset
              </button>
              <button
                type="button"
                className="demo-btn demo-btn--ghost"
                onClick={onShare}
                aria-live="polite"
              >
                {shareCopied ? (
                  <>
                    <Check size={13} strokeWidth={2.2} aria-hidden="true" />
                    Link copied
                  </>
                ) : (
                  <>
                    <Clipboard size={13} strokeWidth={2} aria-hidden="true" />
                    Share link
                  </>
                )}
              </button>
              <span style={{ marginLeft: "auto" }}>
                <button
                  type="button"
                  className="demo-btn demo-btn--primary"
                  onClick={onRun}
                >
                  <Play size={13} strokeWidth={2.2} aria-hidden="true" />
                  Run
                </button>
              </span>
            </div>
          </section>

          {/* RIGHT — response (dark) */}
          <section
            aria-label="Response"
            style={{
              background: "#0a0a0a",
              color: "#e4e4e4",
              borderLeft: "1px solid var(--border)",
              display: "flex",
              flexDirection: "column",
              minWidth: 0,
            }}
          >
            <header
              style={{
                padding: "var(--space-2h) var(--space-4)",
                borderBottom: "1px solid #1f1f1f",
                display: "flex",
                alignItems: "center",
                gap: "var(--space-2h)",
                flexWrap: "wrap",
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "var(--space-1)",
                  padding: "var(--space-1) var(--space-2)",
                  borderRadius: "var(--radius-xs)",
                  background: "color-mix(in srgb, var(--success) 18%, #0a0a0a)",
                  color: "var(--success)",
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--fs-10)",
                  fontWeight: "var(--fw-semibold)",
                  letterSpacing: "0.04em",
                }}
              >
                200 OK
              </span>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--fs-10)",
                  color: "#9a9a9a",
                }}
              >
                {preset.ms} ms
              </span>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--fs-10)",
                  color: "#9a9a9a",
                }}
              >
                {(responseBytes / 1024).toFixed(1)} KB
              </span>
              {pulse && (
                <span
                  aria-hidden="true"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "var(--space-1)",
                    padding: "var(--space-1) var(--space-2)",
                    borderRadius: "var(--radius-xs)",
                    background: "color-mix(in srgb, var(--accent) 24%, #0a0a0a)",
                    color: "var(--accent)",
                    fontFamily: "var(--font-mono)",
                    fontSize: "var(--fs-10)",
                    fontWeight: "var(--fw-semibold)",
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                  }}
                >
                  <Zap size={10} strokeWidth={2.4} />
                  Fresh
                </span>
              )}
              <span style={{ marginLeft: "auto" }}>
                <CopyIconButton value={responseText} dark />
              </span>
            </header>

            <pre
              aria-live="polite"
              style={{
                padding: "var(--space-4)",
                margin: 0,
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                lineHeight: 1.6,
                color: "#e4e4e4",
                whiteSpace: "pre",
                overflow: "auto",
                flex: 1,
                boxShadow: pulse
                  ? "inset 0 0 0 1px color-mix(in srgb, var(--accent) 60%, transparent)"
                  : "none",
                transition: "box-shadow 0.3s ease",
              }}
            >
              {responseText}
            </pre>

            <footer
              style={{
                padding: "var(--space-2h) var(--space-4)",
                borderTop: "1px solid #1f1f1f",
                display: "flex",
                alignItems: "center",
                gap: "var(--space-2h)",
                color: "#6a6a6a",
                fontFamily: "var(--font-mono)",
                fontSize: "var(--fs-10)",
              }}
            >
              <span>id: {callId}</span>
              <span style={{ marginLeft: "auto" }}>{responseTs}</span>
            </footer>
          </section>
        </div>

        {/* Rate limit strip */}
        <div
          className="demo-row"
          style={{
            marginTop: "var(--space-4)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            gridTemplateColumns: "auto minmax(0, 1fr) auto",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 28,
              height: 28,
              borderRadius: "var(--radius-md)",
              background: "var(--bg-accent-subtle)",
              color: "var(--accent)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Zap size={14} strokeWidth={2} />
          </span>
          <div className="demo-row__primary">
            <span className="demo-row__title">
              Playground rate limit · {rateTotal - rateUsed} of {rateTotal} requests remaining this minute
            </span>
            <span className="demo-row__sub">
              Resets every 60 seconds · Sandbox only · Upgrade for production limits
            </span>
            <div
              role="progressbar"
              aria-valuenow={rateUsed}
              aria-valuemin={0}
              aria-valuemax={rateTotal}
              aria-label="Rate limit usage"
              style={{
                marginTop: "var(--space-1h)",
                height: 4,
                background: "var(--bg-muted)",
                borderRadius: "var(--radius-pill)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${ratePct}%`,
                  height: "100%",
                  background: ratePct > 80 ? "var(--warn)" : "var(--accent)",
                  borderRadius: "var(--radius-pill)",
                  transition: "width 0.3s ease",
                }}
              />
            </div>
          </div>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--fs-xs)",
              color: "var(--fg-muted)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {rateUsed} / {rateTotal}
          </span>
        </div>

        {/* Recent calls */}
        <div
          style={{
            marginTop: "var(--space-4)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            background: "var(--bg)",
            overflow: "hidden",
          }}
        >
          <header
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-2)",
              padding: "var(--space-3) var(--space-4)",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <span
              style={{
                fontSize: "var(--fs-sm)",
                fontWeight: "var(--fw-semibold)",
                color: "var(--fg)",
              }}
            >
              Recent calls
            </span>
            <span
              style={{
                fontSize: "var(--fs-xs)",
                color: "var(--fg-subtle)",
              }}
            >
              Click any row to replay it
            </span>
          </header>
          <table className="demo-table">
            <thead>
              <tr>
                <th style={{ width: 110 }}>Time</th>
                <th style={{ width: 72 }}>Method</th>
                <th>Endpoint</th>
                <th style={{ width: 96 }}>Status</th>
                <th style={{ width: 96, textAlign: "right" }}>Duration</th>
                <th style={{ width: 36 }} aria-hidden="true" />
              </tr>
            </thead>
            <tbody>
              {recent.map((call, i) => (
                <tr
                  key={`${call.ts}-${i}`}
                  onClick={() => onRecentClick(call)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onRecentClick(call);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={`Replay ${call.method} ${call.endpoint}`}
                  style={{ cursor: "pointer" }}
                >
                  <td className="is-mono" style={{ color: "var(--fg-muted)" }}>
                    {call.ts}
                  </td>
                  <td>
                    <MethodPill method={call.method} />
                  </td>
                  <td className="is-mono">{call.endpoint}</td>
                  <td>
                    <StatusBadge status={call.status} />
                  </td>
                  <td
                    className="is-num is-mono"
                    style={{ color: "var(--fg-muted)" }}
                  >
                    {call.ms} ms
                  </td>
                  <td style={{ color: "var(--fg-subtle)" }}>
                    <ArrowRight size={12} strokeWidth={2} aria-hidden="true" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
