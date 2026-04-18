import { useMemo, useState } from "react";
import { Play, Search } from "lucide-react";
import { DemoAppHero } from "../../internal/DemoAppHero";

type Method = "GET" | "POST" | "DELETE" | "PATCH" | "PUT";

type Endpoint = {
  id: string;
  method: Method;
  path: string;
  resource: string;
};

const ENDPOINTS: Endpoint[] = [
  // Analyses
  { id: "list_analyses",    resource: "Analyses", method: "GET",    path: "/v1/analyses" },
  { id: "get_analysis",     resource: "Analyses", method: "GET",    path: "/v1/analyses/:id" },
  { id: "create_analysis",  resource: "Analyses", method: "POST",   path: "/v1/analyses" },
  { id: "cancel_analysis",  resource: "Analyses", method: "DELETE", path: "/v1/analyses/:id" },
  // Policies
  { id: "list_policies",    resource: "Policies", method: "GET",    path: "/v1/policies" },
  { id: "update_policy",    resource: "Policies", method: "PATCH",  path: "/v1/policies/:id" },
  { id: "dry_run_policy",   resource: "Policies", method: "POST",   path: "/v1/policies/:id/dry-run" },
  // Members
  { id: "list_members",     resource: "Members",  method: "GET",    path: "/v1/members" },
  { id: "invite_member",    resource: "Members",  method: "POST",   path: "/v1/members" },
  { id: "update_member",    resource: "Members",  method: "PUT",    path: "/v1/members/:email" },
  // Keys
  { id: "list_keys",        resource: "Keys",     method: "GET",    path: "/v1/keys" },
  { id: "create_key",       resource: "Keys",     method: "POST",   path: "/v1/keys" },
  { id: "revoke_key",       resource: "Keys",     method: "DELETE", path: "/v1/keys/:id" },
  // Webhooks
  { id: "list_webhooks",    resource: "Webhooks", method: "GET",    path: "/v1/webhooks" },
  { id: "create_webhook",   resource: "Webhooks", method: "POST",   path: "/v1/webhooks" },
  { id: "delete_webhook",   resource: "Webhooks", method: "DELETE", path: "/v1/webhooks/:id" },
];

const METHOD_STYLE: Record<Method, { bg: string; fg: string }> = {
  GET:    { bg: "color-mix(in srgb, var(--success) 14%, var(--bg))",     fg: "var(--success)" },
  POST:   { bg: "color-mix(in srgb, var(--accent) 14%, var(--bg))",      fg: "var(--accent)" },
  DELETE: { bg: "color-mix(in srgb, var(--danger) 14%, var(--bg))",      fg: "var(--danger)" },
  PATCH:  { bg: "color-mix(in srgb, var(--warn) 14%, var(--bg))",        fg: "var(--warn)" },
  PUT:    { bg: "color-mix(in srgb, var(--warn) 14%, var(--bg))",        fg: "var(--warn)" },
};

type Lang = "curl" | "Node" | "Python" | "Ruby";
const LANGS: Lang[] = ["curl", "Node", "Python", "Ruby"];

const CODE_SAMPLES: Record<Lang, string> = {
  curl: `curl https://api.quanta.dev/v1/analyses/an_01HZK8X2Q3R4N7V \\
  -H "Authorization: Bearer qk_live_••••7a2f" \\
  -H "Quanta-Version: 2026-04-01"`,
  Node: `import { Quanta } from "@quanta/sdk";

const quanta = new Quanta(process.env.QUANTA_API_KEY!);

const analysis = await quanta.analyses.retrieve(
  "an_01HZK8X2Q3R4N7V"
);

console.log(analysis.risk_score);`,
  Python: `from quanta import Quanta

quanta = Quanta(api_key=os.environ["QUANTA_API_KEY"])

analysis = quanta.analyses.retrieve(
    "an_01HZK8X2Q3R4N7V"
)

print(analysis.risk_score)`,
  Ruby: `require "quanta"

Quanta.api_key = ENV["QUANTA_API_KEY"]

analysis = Quanta::Analysis.retrieve(
  "an_01HZK8X2Q3R4N7V"
)

puts analysis.risk_score`,
};

function makeResponse(ts: string) {
  return `{
  "id": "an_01HZK8X2Q3R4N7V",
  "object": "analysis",
  "repo": "acme/core-api",
  "ref": "refs/heads/main",
  "engines": ["quanta.v3", "policy.v1"],
  "risk_score": 0.42,
  "blast_radius": 17,
  "duration_ms": 12480,
  "status": "completed",
  "created_at": "${ts}"
}`;
}

type ParamRow = { name: string; type: string; required: boolean; description: string };

const PATH_PARAMS: ParamRow[] = [
  { name: "id", type: "string", required: true, description: "Unique identifier of the analysis, prefixed with `an_`." },
];

const QUERY_PARAMS: ParamRow[] = [
  { name: "expand",   type: "string[]", required: false, description: "Inline related objects. Supports `rules`, `reviewers`." },
  { name: "ref_only", type: "boolean",  required: false, description: "When true, returns only the ref metadata (faster)." },
];

const RESPONSE_FIELDS: ParamRow[] = [
  { name: "id",           type: "string",   required: true, description: "Stable identifier for the analysis record." },
  { name: "repo",         type: "string",   required: true, description: "Repository slug in `owner/name` form." },
  { name: "ref",          type: "string",   required: true, description: "Git ref this analysis was computed for." },
  { name: "risk_score",   type: "number",   required: true, description: "Aggregate risk in the `[0, 1]` range." },
  { name: "blast_radius", type: "integer",  required: true, description: "Count of downstream symbols structurally impacted." },
  { name: "engines",      type: "string[]", required: true, description: "Analysis engines that contributed to this record." },
  { name: "created_at",   type: "string",   required: true, description: "RFC 3339 timestamp when analysis completed." },
];

const RESPONSE_CODES: { code: number; label: string; tone: "success" | "warn" | "danger"; note: string }[] = [
  { code: 200, label: "OK",             tone: "success", note: "Analysis object returned in the response body." },
  { code: 404, label: "Not Found",      tone: "danger",  note: "No analysis exists for the given id in this workspace." },
  { code: 429, label: "Too Many Reqs",  tone: "warn",    note: "You have hit the per-minute rate limit for your plan." },
];

function MethodBadge({ method, size = "sm" }: { method: Method; size?: "sm" | "md" }) {
  const style = METHOD_STYLE[method];
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
        background: style.bg,
        color: style.fg,
        ...dims,
      }}
    >
      {method}
    </span>
  );
}

function ParamTable({ rows }: { rows: ParamRow[] }) {
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-sm)",
        overflow: "hidden",
        background: "var(--bg)",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(120px, 160px) 110px 80px minmax(0, 1fr)",
          padding: "var(--space-2) var(--space-3)",
          background: "var(--bg-subtle)",
          borderBottom: "1px solid var(--border)",
          fontSize: "var(--fs-10)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--fg-subtle)",
          fontWeight: "var(--fw-semibold)",
        }}
      >
        <span>Name</span>
        <span>Type</span>
        <span>Required</span>
        <span>Description</span>
      </div>
      {rows.map((r, i) => (
        <div
          key={r.name}
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(120px, 160px) 110px 80px minmax(0, 1fr)",
            padding: "var(--space-2) var(--space-3)",
            borderTop: i === 0 ? "0" : "1px solid var(--border)",
            alignItems: "baseline",
            fontSize: "var(--fs-xs)",
            gap: "var(--space-2)",
          }}
        >
          <code style={{ fontFamily: "var(--font-mono)", color: "var(--fg)", fontWeight: "var(--fw-medium)" }}>
            {r.name}
          </code>
          <code style={{ fontFamily: "var(--font-mono)", color: "var(--accent-purple)" }}>{r.type}</code>
          <span style={{ color: r.required ? "var(--danger)" : "var(--fg-subtle)" }}>
            {r.required ? "required" : "optional"}
          </span>
          <span style={{ color: "var(--fg-muted)", lineHeight: 1.5 }}>{r.description}</span>
        </div>
      ))}
    </div>
  );
}

function LangTab({
  lang,
  active,
  onSelect,
}: {
  lang: Lang;
  active: boolean;
  onSelect: () => void;
}) {
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onSelect}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      style={{
        padding: "var(--space-1) var(--space-2h)",
        border: 0,
        borderRadius: "var(--radius-pill)",
        background: active ? "#2a2a2a" : hover ? "#1f1f1f" : "transparent",
        color: active ? "#f4f4f4" : hover ? "#d4d4d4" : "#9a9a9a",
        fontSize: "var(--fs-10)",
        fontWeight: "var(--fw-semibold)",
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        fontFamily: "var(--font-mono)",
        cursor: "pointer",
        outline: focus ? "2px solid var(--accent)" : "none",
        outlineOffset: 1,
        transition: "background 0.14s ease, color 0.14s ease",
      }}
    >
      {lang}
    </button>
  );
}

function RunButton({ onClick, pulse }: { onClick: () => void; pulse: boolean }) {
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      style={{
        marginLeft: "auto",
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--space-1h)",
        padding: "var(--space-1) var(--space-3)",
        height: 26,
        border: `1px solid ${pulse ? "var(--accent)" : hover ? "#3a3a3a" : "#2a2a2a"}`,
        borderRadius: "var(--radius-sm)",
        background: pulse ? "var(--accent)" : hover ? "#1f1f1f" : "#141414",
        color: pulse ? "#fff" : "#e4e4e4",
        fontSize: "var(--fs-10)",
        fontWeight: "var(--fw-semibold)",
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        cursor: "pointer",
        outline: focus ? "2px solid var(--accent)" : "none",
        outlineOffset: 2,
        transition: "background 0.14s ease, border-color 0.14s ease",
      }}
    >
      <Play size={11} strokeWidth={2.2} aria-hidden="true" />
      Run
    </button>
  );
}

function EndpointNavButton({
  endpoint,
  active,
  onClick,
}: {
  endpoint: Endpoint;
  active: boolean;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      aria-current={active ? "true" : undefined}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: "var(--space-2)",
        padding: "var(--space-1h) var(--space-3)",
        border: 0,
        background: active
          ? "var(--bg)"
          : hover
          ? "var(--bg-hover)"
          : "transparent",
        borderLeft: active
          ? `2px solid ${METHOD_STYLE[endpoint.method].fg}`
          : "2px solid transparent",
        color: active || hover ? "var(--fg)" : "var(--fg-muted)",
        cursor: "pointer",
        font: "inherit",
        textAlign: "left",
        outline: focus ? "2px solid var(--accent)" : "none",
        outlineOffset: -2,
        transition: "background 0.14s ease, color 0.14s ease",
      }}
    >
      <MethodBadge method={endpoint.method} />
      <code
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--fs-xs)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {endpoint.path}
      </code>
    </button>
  );
}

export function ApiExplorerPage() {
  const [selectedId, setSelectedId] = useState("get_analysis");
  const [lang, setLang] = useState<Lang>("curl");
  const [q, setQ] = useState("");
  const [responseTs, setResponseTs] = useState("2026-04-19T10:14:22Z");
  const [pulse, setPulse] = useState(false);

  const selected = ENDPOINTS.find((e) => e.id === selectedId) ?? ENDPOINTS[1];

  const grouped = useMemo(() => {
    const out: Record<string, Endpoint[]> = {};
    const needle = q.trim().toLowerCase();
    ENDPOINTS.forEach((e) => {
      if (needle && !e.path.toLowerCase().includes(needle) && !e.resource.toLowerCase().includes(needle)) return;
      (out[e.resource] ??= []).push(e);
    });
    return out;
  }, [q]);

  const run = () => {
    const now = new Date();
    const iso = now.toISOString().replace(/\.\d{3}Z$/, "Z");
    setResponseTs(iso);
    setPulse(true);
    window.setTimeout(() => setPulse(false), 550);
  };

  return (
    <div className="demo-app">
      <DemoAppHero
        kicker="Developers"
        title="API explorer"
        sub="Browse every endpoint, read the docs, and try calls with live mocked responses."
      />
      <div className="demo-app__body">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "240px minmax(0, 1fr) 420px",
            gap: 0,
            minHeight: 640,
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            overflow: "hidden",
            background: "var(--bg)",
          }}
        >
          {/* LEFT */}
          <aside
            style={{
              borderRight: "1px solid var(--border)",
              background: "var(--bg-subtle)",
              overflow: "auto",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                padding: "var(--space-3)",
                borderBottom: "1px solid var(--border)",
                background: "var(--bg)",
                position: "sticky",
                top: 0,
              }}
            >
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-1h)",
                  border: "1px solid var(--border)",
                  padding: "0 var(--space-2h)",
                  height: 28,
                  borderRadius: "var(--radius-sm)",
                  background: "var(--bg)",
                  color: "var(--fg-subtle)",
                  fontSize: "var(--fs-xs)",
                  cursor: "text",
                }}
              >
                <Search size={13} strokeWidth={2} aria-hidden="true" />
                <input
                  type="search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search endpoints"
                  aria-label="Search endpoints"
                  style={{
                    border: 0,
                    outline: "none",
                    background: "transparent",
                    color: "var(--fg)",
                    font: "inherit",
                    flex: 1,
                    minWidth: 0,
                  }}
                />
              </label>
            </div>

            <div style={{ padding: "var(--space-2) 0" }}>
              {Object.keys(grouped).map((resource) => (
                <div key={resource} style={{ marginBottom: "var(--space-2)" }}>
                  <div
                    style={{
                      padding: "6px var(--space-3)",
                      fontSize: "var(--fs-10)",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "var(--fg-subtle)",
                      fontWeight: "var(--fw-semibold)",
                    }}
                  >
                    {resource}
                  </div>
                  {grouped[resource].map((e) => (
                    <EndpointNavButton
                      key={e.id}
                      endpoint={e}
                      active={e.id === selectedId}
                      onClick={() => setSelectedId(e.id)}
                    />
                  ))}
                </div>
              ))}
            </div>
          </aside>

          {/* MIDDLE */}
          <section style={{ padding: "var(--space-5)", overflow: "auto" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-2h)",
                marginBottom: "var(--space-2)",
              }}
            >
              <MethodBadge method={selected.method} size="md" />
              <code
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--fs-lg)",
                  fontWeight: "var(--fw-semibold)",
                  color: "var(--fg)",
                }}
              >
                {selected.path}
              </code>
            </div>
            <p
              style={{
                margin: 0,
                fontSize: "var(--fs-sm)",
                color: "var(--fg-muted)",
                lineHeight: 1.6,
                marginBottom: "var(--space-5)",
              }}
            >
              Retrieve a single analysis by id. Returns the aggregate risk score, blast radius, and
              the list of engines that contributed to the record. Analyses are immutable once
              completed — to re-run, create a new one.
            </p>

            <Section title="Path parameters">
              <ParamTable rows={PATH_PARAMS} />
            </Section>

            <Section title="Query parameters">
              <ParamTable rows={QUERY_PARAMS} />
            </Section>

            <Section title="Response fields">
              <ParamTable rows={RESPONSE_FIELDS} />
            </Section>

            <Section title="Response codes">
              <div
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  overflow: "hidden",
                }}
              >
                {RESPONSE_CODES.map((r, i) => (
                  <div
                    key={r.code}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "80px 140px minmax(0, 1fr)",
                      padding: "var(--space-2h) var(--space-3)",
                      borderTop: i === 0 ? "0" : "1px solid var(--border)",
                      alignItems: "center",
                      gap: "var(--space-3)",
                      fontSize: "var(--fs-xs)",
                    }}
                  >
                    <code
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontWeight: "var(--fw-semibold)",
                        color: "var(--fg)",
                      }}
                    >
                      {r.code}
                    </code>
                    <span className={`demo-badge demo-badge--${r.tone}`}>{r.label}</span>
                    <span style={{ color: "var(--fg-muted)" }}>{r.note}</span>
                  </div>
                ))}
              </div>
            </Section>
          </section>

          {/* RIGHT */}
          <aside
            style={{
              borderLeft: "1px solid var(--border)",
              background: "#0a0a0a",
              color: "#e4e4e4",
              overflow: "auto",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                padding: "var(--space-3) var(--space-4)",
                borderBottom: "1px solid #1f1f1f",
                display: "flex",
                alignItems: "center",
                gap: "var(--space-2)",
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  display: "inline-flex",
                  padding: "var(--space-1)",
                  background: "#141414",
                  border: "1px solid #1f1f1f",
                  borderRadius: "var(--radius-pill)",
                  gap: "var(--space-1)",
                }}
                role="tablist"
                aria-label="Language"
              >
                {LANGS.map((l) => (
                  <LangTab key={l} lang={l} active={lang === l} onSelect={() => setLang(l)} />
                ))}
              </div>
              <RunButton onClick={run} pulse={pulse} />
            </div>

            <pre
              style={{
                color: "#e4e4e4",
                fontFamily: "var(--font-mono)",
                fontSize: "var(--fs-sm)",
                padding: "var(--space-4)",
                margin: 0,
                whiteSpace: "pre",
                overflow: "auto",
              }}
            >
              {CODE_SAMPLES[lang]}
            </pre>

            <div
              style={{
                borderTop: "1px solid #1f1f1f",
                padding: "var(--space-3) var(--space-4)",
                display: "flex",
                alignItems: "center",
                gap: "var(--space-2)",
              }}
            >
              <span
                style={{
                  fontSize: "var(--fs-10)",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "#9a9a9a",
                  fontWeight: "var(--fw-semibold)",
                }}
              >
                Response
              </span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "var(--space-1)",
                  padding: "var(--space-1) var(--space-2)",
                  borderRadius: "var(--radius-xs)",
                  background: "color-mix(in srgb, var(--success) 18%, #0a0a0a)",
                  color: "var(--success)",
                  fontSize: "var(--fs-10)",
                  fontFamily: "var(--font-mono)",
                  fontWeight: "var(--fw-semibold)",
                }}
              >
                200 OK
              </span>
              <span
                style={{
                  marginLeft: "auto",
                  color: "#6a6a6a",
                  fontSize: "var(--fs-10)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                {responseTs}
              </span>
            </div>

            <pre
              style={{
                color: "#e4e4e4",
                fontFamily: "var(--font-mono)",
                fontSize: "var(--fs-sm)",
                padding: "var(--space-4)",
                margin: 0,
                whiteSpace: "pre",
                overflow: "auto",
                flex: 1,
              }}
            >
              {makeResponse(responseTs)}
            </pre>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "var(--space-5)" }}>
      <h3
        style={{
          margin: "0 0 var(--space-2h) 0",
          fontSize: "var(--fs-sm)",
          fontWeight: "var(--fw-semibold)",
          color: "var(--fg)",
          letterSpacing: "-0.005em",
        }}
      >
        {title}
      </h3>
      {children}
    </div>
  );
}
