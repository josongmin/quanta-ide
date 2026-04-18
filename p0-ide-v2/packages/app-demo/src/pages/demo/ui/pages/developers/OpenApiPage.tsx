import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import {
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Code,
  Copy,
  Download,
  Hash,
  Key,
  Layers,
  Lock,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { DemoAppHero } from "../../internal/DemoAppHero";
import { StatCard } from "../../internal/StatCard";
import { useDemoNav } from "../../DemoPage";

type Method = "GET" | "POST" | "DELETE" | "PATCH" | "PUT";

const METHOD_COLOR: Record<Method, string> = {
  GET: "var(--success)",
  POST: "var(--accent)",
  DELETE: "var(--danger)",
  PATCH: "var(--warn)",
  PUT: "var(--warn)",
};

type Leaf =
  | { kind: "auth"; id: string; label: string; scheme: "bearer" | "apiKey" | "oauth2" }
  | { kind: "path"; id: string; method: Method; path: string; summary: string }
  | { kind: "schema"; id: string; name: string; fields: number }
  | { kind: "event"; id: string; name: string }
  | { kind: "example"; id: string; name: string };

type Group = {
  id: string;
  label: string;
  icon: ReactNode;
  subgroups?: { id: string; label: string; leaves: Leaf[] }[];
  leaves?: Leaf[];
};

const AUTH_LEAVES: Leaf[] = [
  { kind: "auth", id: "auth_bearer", label: "Bearer Token", scheme: "bearer" },
  { kind: "auth", id: "auth_apikey", label: "API Key",      scheme: "apiKey" },
  { kind: "auth", id: "auth_oauth",  label: "OAuth2",       scheme: "oauth2" },
];

const PATHS: Record<string, Leaf[]> = {
  Analyses: [
    { kind: "path", id: "p_list_an",   method: "GET",    path: "/v1/analyses",            summary: "List analyses" },
    { kind: "path", id: "p_get_an",    method: "GET",    path: "/v1/analyses/{id}",       summary: "Retrieve an analysis" },
    { kind: "path", id: "p_create_an", method: "POST",   path: "/v1/analyses",            summary: "Create an analysis" },
    { kind: "path", id: "p_cancel_an", method: "DELETE", path: "/v1/analyses/{id}",       summary: "Cancel an analysis" },
    { kind: "path", id: "p_stream_an", method: "GET",    path: "/v1/analyses/{id}/stream",summary: "Stream analysis events" },
    { kind: "path", id: "p_rerun_an",  method: "POST",   path: "/v1/analyses/{id}/rerun", summary: "Re-run an analysis" },
  ],
  Policies: [
    { kind: "path", id: "p_list_pol",    method: "GET",    path: "/v1/policies",              summary: "List policies" },
    { kind: "path", id: "p_get_pol",     method: "GET",    path: "/v1/policies/{id}",         summary: "Retrieve a policy" },
    { kind: "path", id: "p_create_pol",  method: "POST",   path: "/v1/policies",              summary: "Create a policy" },
    { kind: "path", id: "p_update_pol",  method: "PATCH",  path: "/v1/policies/{id}",         summary: "Update a policy" },
    { kind: "path", id: "p_delete_pol",  method: "DELETE", path: "/v1/policies/{id}",         summary: "Delete a policy" },
    { kind: "path", id: "p_dryrun_pol",  method: "POST",   path: "/v1/policies/{id}/dry-run", summary: "Dry-run a policy" },
    { kind: "path", id: "p_violations",  method: "GET",    path: "/v1/policies/{id}/violations", summary: "List violations" },
    { kind: "path", id: "p_publish_pol", method: "POST",   path: "/v1/policies/{id}/publish", summary: "Publish policy revision" },
  ],
  Members: [
    { kind: "path", id: "p_list_m",   method: "GET",    path: "/v1/members",          summary: "List members" },
    { kind: "path", id: "p_get_m",    method: "GET",    path: "/v1/members/{email}",  summary: "Retrieve a member" },
    { kind: "path", id: "p_invite_m", method: "POST",   path: "/v1/members",          summary: "Invite a member" },
    { kind: "path", id: "p_update_m", method: "PUT",    path: "/v1/members/{email}",  summary: "Update a member" },
    { kind: "path", id: "p_remove_m", method: "DELETE", path: "/v1/members/{email}",  summary: "Remove a member" },
  ],
  Keys: [
    { kind: "path", id: "p_list_k",   method: "GET",    path: "/v1/keys",       summary: "List API keys" },
    { kind: "path", id: "p_get_k",    method: "GET",    path: "/v1/keys/{id}",  summary: "Retrieve a key" },
    { kind: "path", id: "p_create_k", method: "POST",   path: "/v1/keys",       summary: "Create a key" },
    { kind: "path", id: "p_revoke_k", method: "DELETE", path: "/v1/keys/{id}",  summary: "Revoke a key" },
  ],
  Webhooks: [
    { kind: "path", id: "p_list_wh",   method: "GET",    path: "/v1/webhooks",            summary: "List webhooks" },
    { kind: "path", id: "p_get_wh",    method: "GET",    path: "/v1/webhooks/{id}",       summary: "Retrieve a webhook" },
    { kind: "path", id: "p_create_wh", method: "POST",   path: "/v1/webhooks",            summary: "Create a webhook" },
    { kind: "path", id: "p_update_wh", method: "PATCH",  path: "/v1/webhooks/{id}",       summary: "Update a webhook" },
    { kind: "path", id: "p_delete_wh", method: "DELETE", path: "/v1/webhooks/{id}",       summary: "Delete a webhook" },
    { kind: "path", id: "p_test_wh",   method: "POST",   path: "/v1/webhooks/{id}/test",  summary: "Send a test event" },
  ],
  Reviews: [
    { kind: "path", id: "p_list_rv",   method: "GET",    path: "/v1/reviews",            summary: "List reviews" },
    { kind: "path", id: "p_get_rv",    method: "GET",    path: "/v1/reviews/{id}",       summary: "Retrieve a review" },
    { kind: "path", id: "p_create_rv", method: "POST",   path: "/v1/reviews",            summary: "Open a review" },
    { kind: "path", id: "p_comment_rv",method: "POST",   path: "/v1/reviews/{id}/comments", summary: "Add a comment" },
    { kind: "path", id: "p_close_rv",  method: "POST",   path: "/v1/reviews/{id}/close", summary: "Close a review" },
  ],
  Health: [
    { kind: "path", id: "p_health_live",  method: "GET", path: "/v1/health/live",  summary: "Liveness probe" },
    { kind: "path", id: "p_health_ready", method: "GET", path: "/v1/health/ready", summary: "Readiness probe" },
  ],
};

const SCHEMAS: Leaf[] = [
  { kind: "schema", id: "s_Analysis",         name: "Analysis",         fields: 14 },
  { kind: "schema", id: "s_AnalysisRequest",  name: "AnalysisRequest",  fields:  9 },
  { kind: "schema", id: "s_Policy",           name: "Policy",           fields: 11 },
  { kind: "schema", id: "s_PolicyViolation",  name: "PolicyViolation",  fields:  8 },
  { kind: "schema", id: "s_Member",           name: "Member",           fields:  7 },
  { kind: "schema", id: "s_Role",             name: "Role",             fields:  4 },
  { kind: "schema", id: "s_ApiKey",           name: "ApiKey",           fields:  6 },
  { kind: "schema", id: "s_Webhook",          name: "Webhook",          fields:  8 },
  { kind: "schema", id: "s_WebhookEvent",     name: "WebhookEvent",     fields:  5 },
  { kind: "schema", id: "s_Review",           name: "Review",           fields:  9 },
  { kind: "schema", id: "s_Comment",          name: "Comment",          fields:  6 },
  { kind: "schema", id: "s_User",             name: "User",             fields:  8 },
  { kind: "schema", id: "s_Workspace",        name: "Workspace",        fields: 10 },
  { kind: "schema", id: "s_Error",            name: "Error",            fields:  4 },
  { kind: "schema", id: "s_Pagination",       name: "Pagination",       fields:  4 },
];

const EVENTS: Leaf[] = [
  "analysis.completed", "analysis.failed", "analysis.cancelled",
  "policy.published", "policy.violation.opened", "policy.violation.resolved",
  "webhook.delivery.failed", "review.opened", "review.commented",
  "review.closed", "member.invited",
].map((name) => ({ kind: "event", id: `e_${name}`, name }));

const EXAMPLES: Leaf[] = [
  { kind: "example", id: "ex_first_run",    name: "First analysis run" },
  { kind: "example", id: "ex_dry_run",      name: "Dry-run a policy" },
  { kind: "example", id: "ex_stream",       name: "Stream long-running analysis" },
  { kind: "example", id: "ex_webhook_sig",  name: "Verify webhook signature" },
  { kind: "example", id: "ex_pagination",   name: "Paginate through results" },
];

const GROUPS: Group[] = [
  {
    id: "auth",
    label: "Authentication",
    icon: <Lock size={13} strokeWidth={1.7} aria-hidden="true" />,
    leaves: AUTH_LEAVES,
  },
  {
    id: "paths",
    label: "Paths",
    icon: <Zap size={13} strokeWidth={1.7} aria-hidden="true" />,
    subgroups: Object.keys(PATHS).map((tag) => ({
      id: `paths.${tag}`,
      label: tag,
      leaves: PATHS[tag],
    })),
  },
  {
    id: "schemas",
    label: "Schemas",
    icon: <Layers size={13} strokeWidth={1.7} aria-hidden="true" />,
    leaves: SCHEMAS,
  },
  {
    id: "events",
    label: "Webhook events",
    icon: <Hash size={13} strokeWidth={1.7} aria-hidden="true" />,
    leaves: EVENTS,
  },
  {
    id: "examples",
    label: "Examples",
    icon: <Code size={13} strokeWidth={1.7} aria-hidden="true" />,
    leaves: EXAMPLES,
  },
];

type Tab = "Request" | "Response" | "Example" | "Schema" | "Code";
const TABS: Tab[] = ["Request", "Response", "Example", "Schema", "Code"];

type BodyField = {
  name: string;
  type: string;
  required: boolean;
  description: string;
  children?: BodyField[];
};

const REQUEST_BODY: BodyField[] = [
  { name: "name",   type: "string", required: true,  description: "Human-readable name for this analysis." },
  { name: "repo",   type: "string", required: true,  description: "Repository slug in `owner/name` form." },
  {
    name: "engine",
    type: "enum",
    required: true,
    description: "Analysis engine to run against the ref.",
  },
  { name: "ref",    type: "string", required: false, description: "Git ref to analyze. Defaults to the repo's default branch." },
  {
    name: "options",
    type: "object",
    required: false,
    description: "Engine-specific options. See engine docs.",
    children: [
      { name: "includeTests",  type: "boolean", required: false, description: "Include test files in the analysis." },
      { name: "depth",         type: "integer", required: false, description: "Call-graph depth cap. Default 12." },
      { name: "ignoreGlobs",   type: "string[]", required: false, description: "Glob patterns to exclude." },
    ],
  },
];

const QUERY_ROWS = [
  { name: "limit",  type: "integer", required: false, description: "Max number of items in the page (default 20, max 100)." },
  { name: "cursor", type: "string",  required: false, description: "Opaque cursor from a prior response." },
  { name: "expand", type: "string[]",required: false, description: "Inline related objects: `rules`, `reviewers`." },
];

function MethodChip({ method }: { method: Method }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 58,
        padding: "2px var(--space-2)",
        borderRadius: "var(--radius-xs)",
        background: `color-mix(in srgb, ${METHOD_COLOR[method]} 14%, var(--bg))`,
        color: METHOD_COLOR[method],
        fontFamily: "var(--font-mono)",
        fontSize: "var(--fs-10)",
        fontWeight: "var(--fw-bold)",
        letterSpacing: "0.04em",
      }}
    >
      {method}
    </span>
  );
}

function AuthSchemeIcon({ scheme }: { scheme: "bearer" | "apiKey" | "oauth2" }) {
  const size = 13;
  const sw = 1.7;
  if (scheme === "bearer")
    return <ShieldCheck size={size} strokeWidth={sw} aria-hidden="true" />;
  if (scheme === "apiKey")
    return <Key size={size} strokeWidth={sw} aria-hidden="true" />;
  return <Lock size={size} strokeWidth={sw} aria-hidden="true" />;
}

function TreeCaret({ open }: { open: boolean }) {
  return open ? (
    <ChevronDown size={12} strokeWidth={2} aria-hidden="true" />
  ) : (
    <ChevronRight size={12} strokeWidth={2} aria-hidden="true" />
  );
}

function LeafRow({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "true" : undefined}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: "var(--space-1h)",
        padding: "4px var(--space-2) 4px var(--space-4h)",
        border: 0,
        background: active ? "var(--bg-hover)" : "transparent",
        color: active ? "var(--fg)" : "var(--fg-muted)",
        fontSize: "var(--fs-xs)",
        fontFamily: "var(--font-mono)",
        cursor: "pointer",
        borderRadius: "var(--radius-xs)",
        textAlign: "left",
        borderLeft: active ? "2px solid var(--accent)" : "2px solid transparent",
      }}
    >
      {children}
    </button>
  );
}

function BodyTree({ fields, depth = 0 }: { fields: BodyField[]; depth?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {fields.map((f) => (
        <div key={f.name}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(160px, 200px) 120px 72px minmax(0, 1fr)",
              padding: "var(--space-1h) var(--space-3)",
              paddingLeft: `calc(var(--space-3) + ${depth * 16}px)`,
              borderTop: "1px solid var(--border)",
              alignItems: "baseline",
              gap: "var(--space-2)",
              fontSize: "var(--fs-xs)",
            }}
          >
            <code style={{ fontFamily: "var(--font-mono)", fontWeight: "var(--fw-medium)", color: "var(--fg)" }}>
              {f.name}
              {f.required ? null : "?"}
            </code>
            <code style={{ fontFamily: "var(--font-mono)", color: "var(--accent-purple)" }}>{f.type}</code>
            <span style={{ color: f.required ? "var(--danger)" : "var(--fg-subtle)", fontSize: "var(--fs-10)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              {f.required ? "required" : "optional"}
            </span>
            <span style={{ color: "var(--fg-muted)", lineHeight: 1.5 }}>
              {f.description}
              {f.type === "enum"
                ? ` Values: risk, blast, taint, behavior, incidents, ownership.`
                : null}
            </span>
          </div>
          {f.children ? <BodyTree fields={f.children} depth={depth + 1} /> : null}
        </div>
      ))}
    </div>
  );
}

function ParamTable({
  rows,
}: {
  rows: { name: string; type: string; required: boolean; description: string }[];
}) {
  if (rows.length === 0) {
    return (
      <div
        style={{
          padding: "var(--space-3)",
          color: "var(--fg-subtle)",
          fontSize: "var(--fs-xs)",
          border: "1px dashed var(--border)",
          borderRadius: "var(--radius-sm)",
          textAlign: "center",
        }}
      >
        No parameters.
      </div>
    );
  }
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
            gap: "var(--space-2)",
            fontSize: "var(--fs-xs)",
          }}
        >
          <code style={{ fontFamily: "var(--font-mono)", fontWeight: "var(--fw-medium)" }}>{r.name}</code>
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

function DownloadButton({
  title,
  filename,
  size,
}: {
  title: string;
  filename: string;
  size: string;
}) {
  return (
    <button
      type="button"
      className="demo-btn demo-btn--primary"
      style={{
        height: 58,
        padding: "0 var(--space-3h)",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "center",
        gap: 2,
        minWidth: 220,
        textAlign: "left",
      }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)" }}>
        <Download size={13} strokeWidth={2} aria-hidden="true" />
        {title}
      </span>
      <span
        style={{
          fontSize: "var(--fs-10)",
          fontFamily: "var(--font-mono)",
          color: "color-mix(in srgb, var(--bg) 72%, transparent)",
          letterSpacing: "0.02em",
          fontWeight: "var(--fw-medium)",
        }}
      >
        {filename} · {size}
      </span>
    </button>
  );
}

export function OpenApiPage() {
  const { navigate } = useDemoNav();
  const [version, setVersion] = useState("v2");
  const [selectedId, setSelectedId] = useState<string>("p_create_an");
  const [tab, setTab] = useState<Tab>("Request");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    auth: true,
    paths: true,
    "paths.Analyses": true,
    schemas: false,
    events: false,
    examples: false,
  });

  const toggle = (id: string) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  const allLeaves = useMemo<Leaf[]>(() => {
    const out: Leaf[] = [...AUTH_LEAVES];
    Object.values(PATHS).forEach((ps) => out.push(...ps));
    out.push(...SCHEMAS, ...EVENTS, ...EXAMPLES);
    return out;
  }, []);

  const selected = useMemo<Leaf | undefined>(
    () => allLeaves.find((l) => (l as { id: string }).id === selectedId),
    [allLeaves, selectedId],
  );

  const selectedPath = selected && selected.kind === "path" ? selected : undefined;

  const asideSticky: CSSProperties = {
    borderRight: "1px solid var(--border)",
    background: "var(--bg-subtle)",
    overflow: "auto",
    maxHeight: 720,
    alignSelf: "start",
    position: "sticky",
    top: 0,
  };

  return (
    <div className="demo-app">
      <DemoAppHero
        kicker="Developers"
        title="OpenAPI spec"
        sub="Machine-readable description of every public endpoint. Download the spec or the Postman collection."
      />
      <div className="demo-app__body">
        {/* Top download bar */}
        <div className="demo-sectionbar">
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "var(--space-1h)",
              fontSize: "var(--fs-xs)",
              color: "var(--fg-muted)",
            }}
          >
            Version
            <select
              className="demo-select"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              style={{ height: 28, width: 104, paddingRight: "var(--space-4)" }}
            >
              <option value="v1">v1</option>
              <option value="v2">v2</option>
              <option value="v2-beta">v2-beta</option>
            </select>
          </label>
          <span className="demo-badge demo-badge--accent">OpenAPI 3.1</span>
          <span className="demo-badge">Stable</span>
          <span className="demo-sectionbar__spacer" />
          <DownloadButton title="OpenAPI JSON" filename="quanta-openapi-v2.json" size="384 KB" />
          <DownloadButton title="OpenAPI YAML" filename="quanta-openapi-v2.yaml" size="219 KB" />
          <DownloadButton title="Postman collection" filename="quanta-postman-v2.json" size="412 KB" />
        </div>

        {/* Meta stats */}
        <div className="demo-grid-3" style={{ marginBottom: "var(--space-4)" }}>
          <StatCard label="Endpoints" value="42" icon={<Zap size={13} strokeWidth={1.7} aria-hidden="true" />} delta="+4 since v1" deltaTone="up" />
          <StatCard label="Schemas"   value="68" icon={<Layers size={13} strokeWidth={1.7} aria-hidden="true" />} delta="+11" deltaTone="up" />
          <StatCard label="Auth schemes" value="3" icon={<Lock size={13} strokeWidth={1.7} aria-hidden="true" />} delta="Bearer, API key, OAuth2" />
          <StatCard label="Webhook events" value="11" icon={<Hash size={13} strokeWidth={1.7} aria-hidden="true" />} delta="+3" deltaTone="up" />
        </div>

        {/* Main 2-col */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "300px minmax(0, 1fr)",
            gap: 0,
            minHeight: 640,
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            overflow: "hidden",
            background: "var(--bg)",
          }}
        >
          {/* LEFT — spec tree */}
          <aside style={asideSticky}>
            <div style={{ padding: "var(--space-2) 0" }}>
              {GROUPS.map((g) => {
                const open = expanded[g.id];
                return (
                  <div key={g.id} style={{ marginBottom: "var(--space-1)" }}>
                    <button
                      type="button"
                      onClick={() => toggle(g.id)}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        gap: "var(--space-1h)",
                        padding: "var(--space-1h) var(--space-3)",
                        border: 0,
                        background: "transparent",
                        color: "var(--fg)",
                        fontSize: "var(--fs-xs)",
                        fontWeight: "var(--fw-semibold)",
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      <TreeCaret open={open} />
                      <span style={{ color: "var(--fg-muted)", display: "inline-flex" }}>{g.icon}</span>
                      {g.label}
                      <span style={{ flex: 1 }} />
                      <span style={{ fontSize: "var(--fs-10)", color: "var(--fg-subtle)", fontWeight: "var(--fw-medium)" }}>
                        {g.subgroups
                          ? g.subgroups.reduce((n, sg) => n + sg.leaves.length, 0)
                          : g.leaves?.length ?? 0}
                      </span>
                    </button>

                    {open && g.leaves
                      ? g.leaves.map((leaf) =>
                          leaf.kind === "auth" ? (
                            <LeafRow
                              key={leaf.id}
                              active={selectedId === leaf.id}
                              onClick={() => setSelectedId(leaf.id)}
                            >
                              <AuthSchemeIcon scheme={leaf.scheme} />
                              <span style={{ color: "var(--fg)", fontFamily: "var(--font-sans, inherit)", fontWeight: "var(--fw-medium)" }}>
                                {leaf.label}
                              </span>
                            </LeafRow>
                          ) : leaf.kind === "schema" ? (
                            <LeafRow
                              key={leaf.id}
                              active={selectedId === leaf.id}
                              onClick={() => setSelectedId(leaf.id)}
                            >
                              <span style={{ color: "var(--accent-purple)" }}>{"{ }"}</span>
                              <span>{leaf.name}</span>
                              <span style={{ flex: 1 }} />
                              <span style={{ fontSize: "var(--fs-10)", color: "var(--fg-subtle)" }}>
                                {leaf.fields}
                              </span>
                            </LeafRow>
                          ) : leaf.kind === "event" ? (
                            <LeafRow
                              key={leaf.id}
                              active={selectedId === leaf.id}
                              onClick={() => setSelectedId(leaf.id)}
                            >
                              <Hash size={11} strokeWidth={1.7} aria-hidden="true" />
                              <span>{leaf.name}</span>
                            </LeafRow>
                          ) : leaf.kind === "example" ? (
                            <LeafRow
                              key={leaf.id}
                              active={selectedId === leaf.id}
                              onClick={() => setSelectedId(leaf.id)}
                            >
                              <Code size={11} strokeWidth={1.7} aria-hidden="true" />
                              <span>{leaf.name}</span>
                            </LeafRow>
                          ) : null,
                        )
                      : null}

                    {open && g.subgroups
                      ? g.subgroups.map((sg) => {
                          const sgOpen = expanded[sg.id];
                          return (
                            <div key={sg.id}>
                              <button
                                type="button"
                                onClick={() => toggle(sg.id)}
                                style={{
                                  width: "100%",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "var(--space-1h)",
                                  padding: "var(--space-1) var(--space-3) var(--space-1) var(--space-4h)",
                                  border: 0,
                                  background: "transparent",
                                  color: "var(--fg-muted)",
                                  fontSize: "var(--fs-xs)",
                                  fontWeight: "var(--fw-medium)",
                                  cursor: "pointer",
                                  textAlign: "left",
                                }}
                              >
                                <TreeCaret open={sgOpen} />
                                <span>{sg.label}</span>
                                <span style={{ flex: 1 }} />
                                <span style={{ fontSize: "var(--fs-10)", color: "var(--fg-subtle)" }}>
                                  {sg.leaves.length}
                                </span>
                              </button>
                              {sgOpen
                                ? sg.leaves.map((leaf) =>
                                    leaf.kind === "path" ? (
                                      <LeafRow
                                        key={leaf.id}
                                        active={selectedId === leaf.id}
                                        onClick={() => setSelectedId(leaf.id)}
                                      >
                                        <MethodChip method={leaf.method} />
                                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                          {leaf.path}
                                        </span>
                                      </LeafRow>
                                    ) : null,
                                  )
                                : null}
                            </div>
                          );
                        })
                      : null}
                  </div>
                );
              })}
            </div>
          </aside>

          {/* RIGHT — detail */}
          <section style={{ padding: "var(--space-5)", overflow: "auto" }}>
            {selectedPath ? (
              <>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-2h)",
                    marginBottom: "var(--space-2)",
                    flexWrap: "wrap",
                  }}
                >
                  <MethodChip method={selectedPath.method} />
                  <code
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "var(--fs-lg)",
                      fontWeight: "var(--fw-semibold)",
                      color: "var(--fg)",
                    }}
                  >
                    {selectedPath.path}
                  </code>
                  <span className="demo-badge">Stable</span>
                  <span className="demo-sectionbar__spacer" />
                  <button
                    type="button"
                    className="demo-btn demo-btn--ghost"
                    onClick={() => navigate("developers.playground")}
                    style={{ height: 30 }}
                  >
                    Try it in Playground
                    <ArrowRight size={12} strokeWidth={2} aria-hidden="true" />
                  </button>
                </div>
                <p
                  style={{
                    margin: 0,
                    fontSize: "var(--fs-sm)",
                    color: "var(--fg-muted)",
                    lineHeight: 1.6,
                    marginBottom: "var(--space-4)",
                  }}
                >
                  {selectedPath.summary}. Create a new analysis record and kick off the configured
                  engine against the given ref. Returns the analysis object with{" "}
                  <code style={{ fontFamily: "var(--font-mono)", color: "var(--fg)" }}>
                    status: "queued"
                  </code>{" "}
                  immediately; poll the resource or subscribe to{" "}
                  <code style={{ fontFamily: "var(--font-mono)", color: "var(--fg)" }}>
                    analysis.completed
                  </code>{" "}
                  webhook events to know when it's done.
                </p>

                {/* Tabs */}
                <div
                  role="tablist"
                  aria-label="Endpoint detail"
                  style={{
                    display: "flex",
                    gap: "var(--space-1)",
                    borderBottom: "1px solid var(--border)",
                    marginBottom: "var(--space-4)",
                  }}
                >
                  {TABS.map((t) => {
                    const active = t === tab;
                    return (
                      <button
                        key={t}
                        role="tab"
                        aria-selected={active}
                        type="button"
                        onClick={() => setTab(t)}
                        style={{
                          padding: "var(--space-2) var(--space-3)",
                          border: 0,
                          background: "transparent",
                          color: active ? "var(--fg)" : "var(--fg-muted)",
                          fontSize: "var(--fs-xs)",
                          fontWeight: active ? "var(--fw-semibold)" : "var(--fw-medium)",
                          cursor: "pointer",
                          borderBottom: active ? "2px solid var(--fg)" : "2px solid transparent",
                          marginBottom: -1,
                        }}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>

                {tab === "Request" ? (
                  <>
                    <DetailSection title="Authentication">
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "var(--space-2)",
                          padding: "var(--space-2h) var(--space-3)",
                          border: "1px solid var(--border)",
                          borderRadius: "var(--radius-sm)",
                          background: "var(--bg-subtle)",
                          fontSize: "var(--fs-xs)",
                        }}
                      >
                        <ShieldCheck size={14} strokeWidth={1.7} aria-hidden="true" />
                        <span style={{ color: "var(--fg)", fontWeight: "var(--fw-medium)" }}>
                          Bearer Token
                        </span>
                        <span className="demo-badge demo-badge--danger">required</span>
                        <span style={{ color: "var(--fg-muted)" }}>
                          Send{" "}
                          <code style={{ fontFamily: "var(--font-mono)" }}>
                            Authorization: Bearer qk_live_…
                          </code>
                        </span>
                      </div>
                    </DetailSection>

                    <DetailSection title="Path parameters">
                      <ParamTable rows={[]} />
                    </DetailSection>

                    <DetailSection title="Query parameters">
                      <ParamTable rows={QUERY_ROWS} />
                    </DetailSection>

                    <DetailSection title="Request body">
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
                            gridTemplateColumns: "minmax(160px, 200px) 120px 72px minmax(0, 1fr)",
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
                          <span>Field</span>
                          <span>Type</span>
                          <span>Required</span>
                          <span>Description</span>
                        </div>
                        <BodyTree fields={REQUEST_BODY} />
                      </div>
                    </DetailSection>
                  </>
                ) : null}

                {tab === "Response" ? (
                  <pre className="demo-code" style={{ padding: "var(--space-3)", lineHeight: 1.6 }}>
{`HTTP/1.1 201 Created
Content-Type: application/json

{
  "id": "an_01HZK8X2Q3R4N7V",
  "object": "analysis",
  "repo": "acme/order-service",
  "ref": "refs/heads/main",
  "engine": "risk",
  "status": "queued",
  "created_at": "2026-04-19T10:14:22Z"
}`}
                  </pre>
                ) : null}

                {tab === "Example" ? (
                  <pre className="demo-code" style={{ padding: "var(--space-3)", lineHeight: 1.6 }}>
{`curl https://api.quanta.dev/v1/analyses \\
  -X POST \\
  -H "Authorization: Bearer qk_live_••••7a2f" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "nightly-order-service",
    "repo": "acme/order-service",
    "engine": "risk",
    "ref": "refs/heads/main"
  }'`}
                  </pre>
                ) : null}

                {tab === "Schema" ? (
                  <pre className="demo-code" style={{ padding: "var(--space-3)", lineHeight: 1.6 }}>
{`AnalysisRequest:
  type: object
  required: [name, repo, engine]
  properties:
    name:   { type: string }
    repo:   { type: string }
    engine:
      type: string
      enum: [risk, blast, taint, behavior, incidents, ownership]
    ref:    { type: string }
    options:
      type: object
      additionalProperties: false
      properties:
        includeTests: { type: boolean }
        depth:        { type: integer }
        ignoreGlobs:  { type: array, items: { type: string } }`}
                  </pre>
                ) : null}

                {tab === "Code" ? (
                  <pre className="demo-code" style={{ padding: "var(--space-3)", lineHeight: 1.6 }}>
{`import { Quanta } from "@quanta/sdk";

const quanta = new Quanta(process.env.QUANTA_API_KEY!);

const analysis = await quanta.analyses.create({
  name: "nightly-order-service",
  repo: "acme/order-service",
  engine: "risk",
  ref: "refs/heads/main",
});

console.log(analysis.id);`}
                  </pre>
                ) : null}

                <div style={{ marginTop: "var(--space-4)" }}>
                  <button type="button" className="demo-btn demo-btn--ghost" style={{ height: 28 }}>
                    View raw schema in spec
                    <ArrowRight size={12} strokeWidth={2} aria-hidden="true" />
                  </button>
                </div>
              </>
            ) : (
              <div className="demo-empty">
                <Code size={24} strokeWidth={1.5} aria-hidden="true" />
                <div className="demo-empty__title">Pick something from the tree</div>
                <div className="demo-empty__hint">
                  Paths, schemas, auth schemes, webhook events — all documented.
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Changelog + embed */}
        <div className="demo-grid-2" style={{ marginTop: "var(--space-5)" }}>
          <div className="demo-block">
            <div className="demo-block__head">
              <span className="demo-block__title">Changelog</span>
              <span className="demo-block__sub">Last 90 days</span>
            </div>
            <div className="demo-block__body" style={{ padding: 0 }}>
              <ChangelogRow
                tag="v2"
                tone="accent"
                title="New engine ownership endpoint"
                date="Apr 12"
                note="/v1/analyses now supports engine=ownership for code-owner graphs."
              />
              <ChangelogRow
                tag="v2-beta"
                tone="warn"
                title="Streaming analysis"
                date="Apr 5"
                note="GET /v1/analyses/{id}/stream returns an SSE feed of events."
              />
              <ChangelogRow
                tag="v1"
                tone="danger"
                title="Deprecation notice"
                date="Mar 1"
                note="v1 endpoints will stop accepting new writes on 2026-09-01."
              />
            </div>
          </div>

          <div className="demo-block">
            <div className="demo-block__head">
              <span className="demo-block__title">Embed the spec</span>
              <span className="demo-block__sub">Point your tooling at the hosted JSON</span>
            </div>
            <div className="demo-block__body">
              <pre
                className="demo-code"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-2)",
                  padding: "var(--space-2h) var(--space-3)",
                  marginBottom: "var(--space-3)",
                }}
              >
                <span style={{ flex: 1 }}>curl https://api.quanta.dev/openapi.json</span>
                <button
                  type="button"
                  aria-label="Copy"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "2px var(--space-2)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-xs)",
                    background: "var(--bg)",
                    color: "var(--fg-muted)",
                    fontSize: "var(--fs-10)",
                    cursor: "pointer",
                    fontFamily: "var(--font-sans, inherit)",
                  }}
                >
                  <Copy size={11} strokeWidth={1.8} aria-hidden="true" />
                  Copy
                </button>
              </pre>
              <div className="demo-kv">
                <span className="demo-kv__k">Spec URL</span>
                <span className="demo-kv__v" style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>
                  https://api.quanta.dev/openapi.json
                </span>
                <span className="demo-kv__k">ETag</span>
                <span className="demo-kv__v" style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>
                  W/"0a7c-1a42bf"
                </span>
                <span className="demo-kv__k">Updated</span>
                <span className="demo-kv__v">2026-04-18 · 14:02 UTC</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: "var(--space-4)" }}>
      <h3
        style={{
          margin: "0 0 var(--space-2) 0",
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

function ChangelogRow({
  tag,
  tone,
  title,
  date,
  note,
}: {
  tag: string;
  tone: "accent" | "warn" | "danger";
  title: string;
  date: string;
  note: string;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "80px minmax(0, 1fr) auto",
        alignItems: "baseline",
        gap: "var(--space-3)",
        padding: "var(--space-3) var(--space-4)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <span className={`demo-badge demo-badge--${tone}`}>{tag}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: "var(--fs-sm)", fontWeight: "var(--fw-medium)", color: "var(--fg)" }}>
          {title}
        </div>
        <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", marginTop: 2 }}>{note}</div>
      </div>
      <span style={{ fontSize: "var(--fs-10)", color: "var(--fg-subtle)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
        {date}
      </span>
    </div>
  );
}
