import { useState } from "react";
import type { CSSProperties } from "react";
import {
  Check,
  Send,
  Users,
  Bell,
  Mail,
  Smartphone,
  MessageSquare,
  Upload,
  Calendar,
  Clock,
  Bold,
  Italic,
  Link2,
  List,
  Image as ImageIcon,
  X,
  Plus,
  FileText,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { DemoAppHero } from "../../internal/DemoAppHero";

interface Step {
  id: string;
  title: string;
}

const STEPS: Step[] = [
  { id: "compose", title: "Compose" },
  { id: "audience", title: "Audience" },
  { id: "schedule", title: "Schedule" },
  { id: "review", title: "Review & send" },
];

interface Channel {
  id: string;
  label: string;
  Icon: typeof Bell;
  disabled?: boolean;
  hint?: string;
}

const CHANNELS: Channel[] = [
  { id: "inapp", label: "In-app", Icon: Bell },
  { id: "email", label: "Email", Icon: Mail },
  { id: "chatops", label: "Chat workspace", Icon: MessageSquare, disabled: true, hint: "connect first" },
  { id: "push", label: "Mobile push", Icon: Smartphone },
];

interface Recent {
  subject: string;
  audience: number;
  sentOn: string;
  openRate: string;
  status: "Sent" | "Scheduled" | "Draft";
}

const RECENT: Recent[] = [
  { subject: "Workspaces moved to new region", audience: 387, sentOn: "2026-04-15 09:12", openRate: "71%", status: "Sent" },
  { subject: "Heads up — 30min maintenance Friday", audience: 387, sentOn: "2026-04-10 18:00", openRate: "63%", status: "Sent" },
  { subject: "Q2 pricing changes for Team plan", audience: 214, sentOn: "2026-04-22 10:00", openRate: "—", status: "Scheduled" },
  { subject: "New: multi-file Code Universe", audience: 387, sentOn: "2026-04-03 14:30", openRate: "82%", status: "Sent" },
  { subject: "Security advisory draft", audience: 4, sentOn: "—", openRate: "—", status: "Draft" },
];

const AUDIENCE_MODES = [
  { id: "all", label: "Everyone", subtitle: "387 members · every workspace" },
  { id: "plan", label: "By plan", subtitle: "Target tiers (Free / Team / Enterprise)" },
  { id: "custom", label: "Custom segment", subtitle: "Build with conditions" },
] as const;
type AudienceMode = typeof AUDIENCE_MODES[number]["id"];

const PLANS = [
  { id: "free", label: "Free", members: 184 },
  { id: "team", label: "Team", members: 119 },
  { id: "enterprise", label: "Enterprise", members: 84 },
];

interface Condition {
  id: string;
  field: string;
  op: string;
  value: string;
}

const FIELD_OPTIONS = [
  { value: "role", label: "role" },
  { value: "workspace", label: "workspace" },
  { value: "joined", label: "joined" },
  { value: "last_active", label: "last active" },
  { value: "country", label: "country" },
];

const OP_OPTIONS = [
  { value: "is", label: "is" },
  { value: "not", label: "is not" },
  { value: "contains", label: "contains" },
  { value: "before", label: "before" },
  { value: "after", label: "after" },
];

type ScheduleMode = "now" | "later" | "throttle";

function pill(): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "3px 8px",
    borderRadius: "var(--radius-pill)",
    border: "1px solid var(--border)",
    background: "var(--bg-subtle)",
    fontSize: "var(--fs-xs)",
    fontFamily: "var(--font-mono)",
    color: "var(--fg)",
    cursor: "pointer",
    lineHeight: 1.2,
  };
}

export function BroadcastComposerPage() {
  const [activeIdx, setActiveIdx] = useState(0);
  const [from, setFrom] = useState("quanta");
  const [selectedChannels, setSelectedChannels] = useState<Record<string, boolean>>({
    inapp: true,
    email: true,
    chatops: false,
    push: true,
  });
  const [subject, setSubject] = useState("New: multi-file Code Universe is live");
  const [body, setBody] = useState(
    "Hi {{first_name}},\n\nWe just shipped multi-file Code Universe — your whole workspace laid out as one canvas.\n\nWhat's new\n- Map imports across repos\n- Keep every file expanded with inline symbols\n- Share a live deep-link to any subgraph\n\nOpen {{workspace_name}} and hit ⌘K to try it.\n\n— The Quanta team",
  );
  const [audience, setAudience] = useState<AudienceMode>("custom");
  const [plansChecked, setPlansChecked] = useState<Record<string, boolean>>({
    free: false,
    team: true,
    enterprise: true,
  });
  const [conditions, setConditions] = useState<Condition[]>([
    { id: "c1", field: "last_active", op: "after", value: "2026-01-01" },
    { id: "c2", field: "role", op: "is", value: "admin" },
  ]);
  const [excluded, setExcluded] = useState<string[]>([
    "churn-risk@acme.com",
    "demo-bot@quanta.dev",
  ]);
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>("later");
  const [throttle, setThrottle] = useState(25);
  const [respectQuiet, setRespectQuiet] = useState(true);
  const [skipSuspended, setSkipSuspended] = useState(true);

  const goNext = () => setActiveIdx((i) => Math.min(STEPS.length - 1, i + 1));
  const goBack = () => setActiveIdx((i) => Math.max(0, i - 1));

  const toggleChannel = (id: string) => {
    setSelectedChannels((s) => ({ ...s, [id]: !s[id] }));
  };

  const addCondition = () => {
    setConditions((prev) => [
      ...prev,
      {
        id: `c${prev.length + 1}-${Date.now()}`,
        field: "role",
        op: "is",
        value: "",
      },
    ]);
  };

  const removeCondition = (id: string) => {
    setConditions((prev) => prev.filter((c) => c.id !== id));
  };

  const insertVar = (token: string) => {
    setBody((b) => `${b}${b.endsWith(" ") || b === "" ? "" : " "}${token}`);
  };

  const removeExcluded = (email: string) => {
    setExcluded((prev) => prev.filter((e) => e !== email));
  };

  // Derived audience count
  const audienceCount = (() => {
    if (audience === "all") return 387 - excluded.length;
    if (audience === "plan") {
      const n = PLANS.reduce(
        (acc, p) => acc + (plansChecked[p.id] ? p.members : 0),
        0,
      );
      return Math.max(0, n - excluded.length);
    }
    // custom
    return Math.max(0, 142 - excluded.length);
  })();
  const emailReach = Math.round(audienceCount * 0.83);
  const inAppReach = audienceCount;

  return (
    <div className="demo-app">
      <DemoAppHero
        kicker="Admin"
        title="Broadcast composer"
        sub="Send one-off announcements to everyone, a plan tier, or a specific audience. Schedules, audience targeting, approval chain."
      />
      <div className="demo-app__body">
        <div className="demo-sectionbar">
          <div className="demo-sectionbar__title">New broadcast</div>
          <span className="demo-sectionbar__spacer" />
          <button className="demo-btn demo-btn--ghost">
            <FileText size={12} strokeWidth={1.8} /> Drafts · 3
          </button>
          <button className="demo-btn demo-btn--ghost">
            <Send size={12} strokeWidth={1.8} /> Sent · 42
          </button>
        </div>

        {/* ==================== STEPPER ==================== */}
        <nav
          aria-label="Broadcast progress"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 0,
            marginBottom: "var(--space-5)",
          }}
        >
          {STEPS.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiveIdx(i)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-2)",
                position: "relative",
                background: "transparent",
                border: 0,
                padding: 0,
                textAlign: "left",
                cursor: "pointer",
              }}
              aria-current={i === activeIdx ? "step" : undefined}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: i <= activeIdx ? "var(--fg)" : "var(--bg-muted)",
                  color: i <= activeIdx ? "var(--bg)" : "var(--fg-subtle)",
                  border: "2px solid var(--bg)",
                  boxShadow:
                    i === activeIdx ? "0 0 0 3px var(--bg-accent-subtle)" : "none",
                  fontWeight: 700,
                  fontSize: "var(--fs-xs)",
                  flex: "0 0 auto",
                  zIndex: 1,
                }}
              >
                {i < activeIdx ? <Check size={14} strokeWidth={2.4} /> : i + 1}
              </div>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: "var(--fs-10)",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    fontWeight: 700,
                    color: i <= activeIdx ? "var(--fg-muted)" : "var(--fg-subtle)",
                  }}
                >
                  Step {i + 1}
                </div>
                <div
                  style={{
                    fontSize: "var(--fs-sm)",
                    fontWeight: i === activeIdx ? 700 : 500,
                    color: "var(--fg)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {s.title}
                </div>
              </div>
              {i < STEPS.length - 1 && (
                <span
                  style={{
                    position: "absolute",
                    left: 32,
                    right: -12,
                    top: 15,
                    height: 1,
                    background: i < activeIdx ? "var(--fg)" : "var(--border)",
                  }}
                  aria-hidden
                />
              )}
            </button>
          ))}
        </nav>

        {/* ==================== STEP CONTENT ==================== */}
        <div className="demo-block">
          <header className="demo-block__head">
            <div>
              <div className="demo-block__title">{STEPS[activeIdx].title}</div>
              <div className="demo-block__sub">
                {activeIdx === 0 && "Write the message and pick which channels deliver it."}
                {activeIdx === 1 && "Choose who receives this broadcast."}
                {activeIdx === 2 && "When should we send, and who should we spare?"}
                {activeIdx === 3 && "Final check before we put this in flight."}
              </div>
            </div>
          </header>

          <div className="demo-block__body">
            {/* ========== STEP 1: COMPOSE ========== */}
            {activeIdx === 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3h)" }}>
                <div className="demo-field">
                  <label className="demo-field__label" htmlFor="bc-from">From</label>
                  <select
                    id="bc-from"
                    className="demo-select"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                  >
                    <option value="quanta">Quanta &lt;no-reply@quanta.dev&gt;</option>
                    <option value="ada">Ada Lovelace · CEO &lt;ada@quanta.dev&gt;</option>
                    <option value="support">Support team &lt;help@quanta.dev&gt;</option>
                  </select>
                </div>

                <div className="demo-field">
                  <label className="demo-field__label">Channels</label>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                      gap: "var(--space-2)",
                    }}
                  >
                    {CHANNELS.map((ch) => {
                      const Icon = ch.Icon;
                      const isOn = !!selectedChannels[ch.id];
                      const disabled = !!ch.disabled;
                      return (
                        <button
                          key={ch.id}
                          type="button"
                          disabled={disabled}
                          onClick={() => !disabled && toggleChannel(ch.id)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "var(--space-2h)",
                            padding: "var(--space-2h) var(--space-3)",
                            borderRadius: "var(--radius-md)",
                            border: isOn
                              ? "1px solid var(--fg)"
                              : "1px solid var(--border)",
                            background: disabled
                              ? "var(--bg-muted)"
                              : isOn
                              ? "var(--bg-subtle)"
                              : "var(--bg)",
                            color: disabled ? "var(--fg-subtle)" : "var(--fg)",
                            cursor: disabled ? "not-allowed" : "pointer",
                            textAlign: "left",
                          }}
                        >
                          <span
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: "var(--radius-sm)",
                              background: isOn && !disabled ? "var(--fg)" : "var(--bg-muted)",
                              color: isOn && !disabled ? "var(--bg)" : "var(--fg-subtle)",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flex: "0 0 auto",
                            }}
                          >
                            <Icon size={14} strokeWidth={1.8} />
                          </span>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: "var(--fs-sm)", fontWeight: 600 }}>
                              {ch.label}
                            </div>
                            {ch.hint && (
                              <div
                                style={{
                                  fontSize: "var(--fs-10)",
                                  color: "var(--fg-subtle)",
                                }}
                              >
                                {ch.hint}
                              </div>
                            )}
                          </div>
                          {!disabled && (
                            <span
                              className="demo-toggle"
                              aria-hidden
                              style={{ pointerEvents: "none" }}
                            >
                              <input type="checkbox" checked={isOn} readOnly />
                              <span className="demo-toggle__track" />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="demo-field">
                  <label className="demo-field__label" htmlFor="bc-subject">Subject</label>
                  <input
                    id="bc-subject"
                    className="demo-input"
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="What's this about?"
                  />
                  <span className="demo-field__hint">
                    Keep it under 60 characters — anything longer gets truncated on iOS Mail.
                  </span>
                </div>

                <div className="demo-field">
                  <label className="demo-field__label" htmlFor="bc-body">Body</label>
                  <div
                    style={{
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-md)",
                      overflow: "hidden",
                      background: "var(--bg)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "var(--space-1)",
                        padding: "var(--space-2) var(--space-2h)",
                        borderBottom: "1px solid var(--border)",
                        background: "var(--bg-subtle)",
                      }}
                    >
                      {[
                        { Icon: Bold, label: "Bold" },
                        { Icon: Italic, label: "Italic" },
                        { Icon: Link2, label: "Link" },
                        { Icon: List, label: "List" },
                        { Icon: ImageIcon, label: "Image" },
                      ].map((t) => {
                        const Icon = t.Icon;
                        return (
                          <button
                            key={t.label}
                            type="button"
                            aria-label={t.label}
                            style={{
                              width: 26,
                              height: 26,
                              border: 0,
                              background: "transparent",
                              color: "var(--fg-muted)",
                              borderRadius: "var(--radius-sm)",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              cursor: "pointer",
                            }}
                          >
                            <Icon size={13} strokeWidth={1.8} />
                          </button>
                        );
                      })}
                      <span
                        style={{
                          width: 1,
                          alignSelf: "stretch",
                          background: "var(--border)",
                          margin: "0 var(--space-1)",
                        }}
                      />
                      <span
                        style={{
                          fontSize: "var(--fs-10)",
                          color: "var(--fg-subtle)",
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                          fontWeight: 700,
                        }}
                      >
                        Insert
                      </span>
                      {["{{first_name}}", "{{workspace_name}}"].map((tok) => (
                        <button
                          key={tok}
                          type="button"
                          onClick={() => insertVar(tok)}
                          style={pill()}
                          title={`Insert ${tok}`}
                        >
                          {tok}
                        </button>
                      ))}
                    </div>
                    <textarea
                      id="bc-body"
                      className="demo-textarea"
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      style={{
                        border: 0,
                        borderRadius: 0,
                        minHeight: 200,
                        width: "100%",
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "var(--space-2)",
                      padding: "var(--space-4)",
                      border: "1.5px dashed var(--border-strong)",
                      borderRadius: "var(--radius-md)",
                      background: "var(--bg-subtle)",
                      color: "var(--fg-muted)",
                    }}
                  >
                    <Upload size={20} strokeWidth={1.6} style={{ color: "var(--fg-subtle)" }} />
                    <div style={{ fontSize: "var(--fs-sm)", fontWeight: 600, color: "var(--fg)" }}>
                      Drag files to attach
                    </div>
                    <div style={{ fontSize: "var(--fs-xs)" }}>
                      PDF, PNG, MP4 up to 20MB — inlined for email, linked for in-app.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ========== STEP 2: AUDIENCE ========== */}
            {activeIdx === 1 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3h)" }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: "var(--space-2h)",
                  }}
                >
                  {AUDIENCE_MODES.map((m) => {
                    const isSel = audience === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setAudience(m.id)}
                        style={{
                          padding: "var(--space-3h)",
                          border: isSel ? "1px solid var(--fg)" : "1px solid var(--border)",
                          background: isSel ? "var(--bg-subtle)" : "var(--bg)",
                          borderRadius: "var(--radius-md)",
                          textAlign: "left",
                          cursor: "pointer",
                          display: "flex",
                          flexDirection: "column",
                          gap: 6,
                        }}
                        aria-pressed={isSel}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "var(--space-2)",
                          }}
                        >
                          <span
                            style={{
                              width: 16,
                              height: 16,
                              borderRadius: "50%",
                              border: isSel
                                ? "5px solid var(--fg)"
                                : "1px solid var(--border-strong)",
                              background: "var(--bg)",
                              flex: "0 0 auto",
                            }}
                            aria-hidden
                          />
                          <span style={{ fontSize: "var(--fs-sm)", fontWeight: 700 }}>
                            {m.label}
                          </span>
                        </div>
                        <div
                          style={{
                            fontSize: "var(--fs-xs)",
                            color: "var(--fg-muted)",
                            lineHeight: "var(--lh-relaxed)",
                          }}
                        >
                          {m.subtitle}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {audience === "plan" && (
                  <div
                    style={{
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-md)",
                      padding: "var(--space-3)",
                      background: "var(--bg-subtle)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "var(--space-2)",
                    }}
                  >
                    {PLANS.map((p) => (
                      <label
                        key={p.id}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "auto minmax(0, 1fr) auto",
                          alignItems: "center",
                          gap: "var(--space-2h)",
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={plansChecked[p.id]}
                          onChange={(e) =>
                            setPlansChecked((s) => ({ ...s, [p.id]: e.target.checked }))
                          }
                        />
                        <span style={{ fontSize: "var(--fs-sm)", fontWeight: 600 }}>
                          {p.label}
                        </span>
                        <span
                          style={{
                            fontSize: "var(--fs-xs)",
                            color: "var(--fg-subtle)",
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {p.members} members
                        </span>
                      </label>
                    ))}
                  </div>
                )}

                {audience === "custom" && (
                  <div
                    style={{
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-md)",
                      padding: "var(--space-3)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "var(--space-2h)",
                    }}
                  >
                    {conditions.map((c, idx) => (
                      <div
                        key={c.id}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "auto minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) auto",
                          alignItems: "center",
                          gap: "var(--space-2)",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "var(--fs-10)",
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                            color: "var(--fg-subtle)",
                            fontWeight: 700,
                            width: 36,
                          }}
                        >
                          {idx === 0 ? "Where" : "And"}
                        </span>
                        <select
                          className="demo-select"
                          value={c.field}
                          onChange={(e) =>
                            setConditions((prev) =>
                              prev.map((r) =>
                                r.id === c.id ? { ...r, field: e.target.value } : r,
                              ),
                            )
                          }
                        >
                          {FIELD_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                        <select
                          className="demo-select"
                          value={c.op}
                          onChange={(e) =>
                            setConditions((prev) =>
                              prev.map((r) =>
                                r.id === c.id ? { ...r, op: e.target.value } : r,
                              ),
                            )
                          }
                        >
                          {OP_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                        <input
                          className="demo-input"
                          type="text"
                          value={c.value}
                          onChange={(e) =>
                            setConditions((prev) =>
                              prev.map((r) =>
                                r.id === c.id ? { ...r, value: e.target.value } : r,
                              ),
                            )
                          }
                          placeholder="value"
                          style={{ fontFamily: "var(--font-mono)" }}
                        />
                        <button
                          type="button"
                          className="demo-btn demo-btn--ghost"
                          onClick={() => removeCondition(c.id)}
                          aria-label="Remove condition"
                        >
                          <X size={12} strokeWidth={2} />
                        </button>
                      </div>
                    ))}
                    <div>
                      <button className="demo-btn demo-btn--ghost" onClick={addCondition}>
                        <Plus size={12} strokeWidth={2} /> Add condition
                      </button>
                    </div>
                  </div>
                )}

                <div>
                  <div
                    style={{
                      fontSize: "var(--fs-10)",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "var(--fg-subtle)",
                      fontWeight: 700,
                      marginBottom: 6,
                    }}
                  >
                    Excluded
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "var(--space-1h)",
                      minHeight: 32,
                      padding: "var(--space-2) var(--space-2h)",
                      background: "var(--bg-subtle)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-md)",
                      alignItems: "center",
                    }}
                  >
                    {excluded.length === 0 && (
                      <span style={{ fontSize: "var(--fs-xs)", color: "var(--fg-subtle)" }}>
                        No exclusions. Add members who should never receive this.
                      </span>
                    )}
                    {excluded.map((email) => (
                      <span
                        key={email}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "3px 4px 3px 10px",
                          borderRadius: "var(--radius-pill)",
                          background: "var(--bg)",
                          border: "1px solid var(--border)",
                          fontSize: "var(--fs-xs)",
                          fontFamily: "var(--font-mono)",
                        }}
                      >
                        {email}
                        <button
                          type="button"
                          onClick={() => removeExcluded(email)}
                          aria-label={`Remove ${email}`}
                          style={{
                            border: 0,
                            background: "var(--bg-muted)",
                            color: "var(--fg-muted)",
                            width: 16,
                            height: 16,
                            borderRadius: "50%",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                          }}
                        >
                          <X size={10} strokeWidth={2.4} />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "auto minmax(0, 1fr) auto",
                    alignItems: "center",
                    gap: "var(--space-3)",
                    padding: "var(--space-3)",
                    background: "var(--bg-accent-subtle)",
                    border: "1px solid var(--border-accent-subtle)",
                    borderRadius: "var(--radius-md)",
                  }}
                >
                  <Users size={18} strokeWidth={1.8} style={{ color: "var(--accent)" }} />
                  <div>
                    <div style={{ fontSize: "var(--fs-sm)", fontWeight: 600 }}>
                      Will reach {audienceCount.toLocaleString()} members
                    </div>
                    <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)" }}>
                      {emailReach.toLocaleString()} email · {inAppReach.toLocaleString()} in-app · live count
                    </div>
                  </div>
                  <span className="demo-badge demo-badge--accent">live</span>
                </div>
              </div>
            )}

            {/* ========== STEP 3: SCHEDULE ========== */}
            {activeIdx === 2 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3h)" }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: "var(--space-2h)",
                  }}
                >
                  {(
                    [
                      { id: "now", label: "Send immediately", hint: "Delivered within 60 seconds", Icon: Zap },
                      { id: "later", label: "Schedule for later", hint: "Pick date and time", Icon: Calendar },
                      { id: "throttle", label: "Throttle (gradual)", hint: "Slow rollout over hours", Icon: Clock },
                    ] as const
                  ).map((o) => {
                    const isSel = scheduleMode === o.id;
                    const Icon = o.Icon;
                    return (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => setScheduleMode(o.id)}
                        style={{
                          padding: "var(--space-3h)",
                          border: isSel ? "1px solid var(--fg)" : "1px solid var(--border)",
                          background: isSel ? "var(--bg-subtle)" : "var(--bg)",
                          borderRadius: "var(--radius-md)",
                          textAlign: "left",
                          cursor: "pointer",
                          display: "flex",
                          flexDirection: "column",
                          gap: 6,
                        }}
                        aria-pressed={isSel}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                          <span
                            style={{
                              width: 16,
                              height: 16,
                              borderRadius: "50%",
                              border: isSel
                                ? "5px solid var(--fg)"
                                : "1px solid var(--border-strong)",
                              background: "var(--bg)",
                              flex: "0 0 auto",
                            }}
                            aria-hidden
                          />
                          <Icon size={14} strokeWidth={1.8} style={{ color: "var(--fg-muted)" }} />
                          <span style={{ fontSize: "var(--fs-sm)", fontWeight: 700 }}>
                            {o.label}
                          </span>
                        </div>
                        <div
                          style={{
                            fontSize: "var(--fs-xs)",
                            color: "var(--fg-muted)",
                            lineHeight: "var(--lh-relaxed)",
                          }}
                        >
                          {o.hint}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {scheduleMode === "later" && (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr 1fr",
                      gap: "var(--space-3)",
                    }}
                  >
                    <div className="demo-field">
                      <label className="demo-field__label" htmlFor="sch-date">Date</label>
                      <input
                        id="sch-date"
                        className="demo-input"
                        type="date"
                        defaultValue="2026-04-20"
                      />
                    </div>
                    <div className="demo-field">
                      <label className="demo-field__label" htmlFor="sch-time">Time</label>
                      <input
                        id="sch-time"
                        className="demo-input"
                        type="time"
                        defaultValue="14:30"
                      />
                    </div>
                    <div className="demo-field">
                      <label className="demo-field__label" htmlFor="sch-tz">Timezone</label>
                      <select id="sch-tz" className="demo-select" defaultValue="seoul">
                        <option value="utc">UTC</option>
                        <option value="seoul">Asia/Seoul (GMT+9)</option>
                        <option value="tokyo">Asia/Tokyo (GMT+9)</option>
                        <option value="sf">America/Los_Angeles (GMT-8)</option>
                        <option value="ny">America/New_York (GMT-5)</option>
                        <option value="berlin">Europe/Berlin (GMT+1)</option>
                      </select>
                    </div>
                  </div>
                )}

                {scheduleMode === "throttle" && (
                  <div
                    style={{
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-md)",
                      padding: "var(--space-3h)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "var(--space-2h)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "var(--fs-sm)",
                        color: "var(--fg-muted)",
                        lineHeight: "var(--lh-relaxed)",
                      }}
                    >
                      Deliver to{" "}
                      <strong style={{ color: "var(--fg)", fontVariantNumeric: "tabular-nums" }}>
                        {throttle}%
                      </strong>{" "}
                      of the audience per hour, over{" "}
                      <strong style={{ color: "var(--fg)" }}>
                        {Math.ceil(100 / throttle)}
                      </strong>{" "}
                      hours.
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "minmax(0, 1fr) 88px",
                        gap: "var(--space-3)",
                        alignItems: "center",
                      }}
                    >
                      <input
                        type="range"
                        min={5}
                        max={100}
                        step={5}
                        value={throttle}
                        onChange={(e) => setThrottle(Number(e.target.value))}
                        aria-label="Throttle percent"
                      />
                      <input
                        className="demo-input"
                        type="number"
                        min={5}
                        max={100}
                        step={5}
                        value={throttle}
                        onChange={(e) => setThrottle(Number(e.target.value))}
                        style={{
                          fontVariantNumeric: "tabular-nums",
                          fontFamily: "var(--font-mono)",
                        }}
                        aria-label="Throttle percent (number)"
                      />
                    </div>
                  </div>
                )}

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-md)",
                    overflow: "hidden",
                  }}
                >
                  <div className="demo-row" style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
                    <div className="demo-row__primary">
                      <div className="demo-row__title">Respect quiet hours (22:00–07:00 local)</div>
                      <div className="demo-row__sub">
                        Messages stack until morning for recipients already asleep.
                      </div>
                    </div>
                    <label className="demo-toggle" aria-label="Respect quiet hours">
                      <input
                        type="checkbox"
                        checked={respectQuiet}
                        onChange={(e) => setRespectQuiet(e.target.checked)}
                      />
                      <span className="demo-toggle__track" />
                    </label>
                  </div>
                  <div className="demo-row" style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
                    <div className="demo-row__primary">
                      <div className="demo-row__title">Don't send to suspended accounts</div>
                      <div className="demo-row__sub">Also skips trial-expired and read-only workspaces.</div>
                    </div>
                    <label className="demo-toggle" aria-label="Skip suspended">
                      <input
                        type="checkbox"
                        checked={skipSuspended}
                        onChange={(e) => setSkipSuspended(e.target.checked)}
                      />
                      <span className="demo-toggle__track" />
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* ========== STEP 4: REVIEW ========== */}
            {activeIdx === 3 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3h)" }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.2fr 1fr",
                    gap: "var(--space-3h)",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: "var(--fs-10)",
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: "var(--fg-subtle)",
                        fontWeight: 700,
                        marginBottom: 8,
                      }}
                    >
                      Summary
                    </div>
                    <div className="demo-kv">
                      <div className="demo-kv__k">Audience</div>
                      <div className="demo-kv__v">
                        {audienceCount.toLocaleString()} members ·{" "}
                        <span style={{ color: "var(--fg-subtle)" }}>
                          {audience === "all"
                            ? "everyone"
                            : audience === "plan"
                            ? "by plan"
                            : "custom segment"}
                        </span>
                      </div>
                      <div className="demo-kv__k">When</div>
                      <div className="demo-kv__v">
                        {scheduleMode === "now" && "Immediately (in ~60 seconds)"}
                        {scheduleMode === "later" && "In 3 min · scheduled Apr 20 14:30 KST"}
                        {scheduleMode === "throttle" && `Throttled · ${throttle}% per hour`}
                      </div>
                      <div className="demo-kv__k">Channels</div>
                      <div className="demo-kv__v">
                        {CHANNELS.filter((c) => selectedChannels[c.id] && !c.disabled)
                          .map((c) => c.label)
                          .join(" · ") || "—"}
                      </div>
                      <div className="demo-kv__k">Approvals</div>
                      <div className="demo-kv__v">
                        Requires 1 admin approval before send
                      </div>
                    </div>

                    <div
                      style={{
                        marginTop: "var(--space-3)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-md)",
                        padding: "var(--space-3)",
                        background: "var(--bg-subtle)",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "var(--fs-10)",
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          color: "var(--fg-subtle)",
                          fontWeight: 700,
                          marginBottom: 6,
                        }}
                      >
                        Approval chain
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "var(--space-2)",
                        }}
                      >
                        {[
                          { name: "Ada Lovelace", role: "Owner", status: "approved" },
                          { name: "Alan Turing", role: "Admin", status: "pending" },
                        ].map((r) => (
                          <div
                            key={r.name}
                            style={{
                              display: "grid",
                              gridTemplateColumns: "auto minmax(0, 1fr) auto",
                              alignItems: "center",
                              gap: "var(--space-2h)",
                            }}
                          >
                            <span className="demo-avatar" aria-hidden>
                              {r.name
                                .split(" ")
                                .map((n) => n[0])
                                .join("")}
                            </span>
                            <div>
                              <div style={{ fontSize: "var(--fs-sm)", fontWeight: 600 }}>
                                {r.name}
                              </div>
                              <div
                                style={{
                                  fontSize: "var(--fs-xs)",
                                  color: "var(--fg-subtle)",
                                }}
                              >
                                {r.role}
                              </div>
                            </div>
                            {r.status === "approved" ? (
                              <span className="demo-badge demo-badge--success">
                                <Check size={11} strokeWidth={2.4} /> Approved
                              </span>
                            ) : (
                              <div style={{ display: "flex", gap: 6 }}>
                                <span className="demo-badge demo-badge--warn">Pending</span>
                                <button className="demo-btn demo-btn--ghost">
                                  Request
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Preview */}
                  <div>
                    <div
                      style={{
                        fontSize: "var(--fs-10)",
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: "var(--fg-subtle)",
                        fontWeight: 700,
                        marginBottom: 8,
                      }}
                    >
                      Email preview
                    </div>
                    <div
                      style={{
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-md)",
                        background: "var(--bg)",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          padding: "var(--space-2h) var(--space-3)",
                          borderBottom: "1px solid var(--border)",
                          fontSize: "var(--fs-xs)",
                          color: "var(--fg-muted)",
                        }}
                      >
                        <div>
                          <strong style={{ color: "var(--fg)" }}>Subject:</strong> {subject}
                        </div>
                      </div>
                      <div style={{ height: 3, background: "var(--fg)" }} />
                      <div
                        style={{
                          padding: "var(--space-3h)",
                          fontSize: "var(--fs-xs)",
                          lineHeight: "var(--lh-relaxed)",
                          color: "var(--fg)",
                          whiteSpace: "pre-wrap",
                          maxHeight: 260,
                          overflow: "auto",
                        }}
                      >
                        {body}
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: "var(--space-2)",
                    paddingTop: "var(--space-3)",
                    borderTop: "1px solid var(--border)",
                  }}
                >
                  <button className="demo-btn demo-btn--ghost">
                    <FileText size={12} strokeWidth={1.8} /> Save as template
                  </button>
                  <span className="demo-sectionbar__spacer" />
                  <button
                    className="demo-btn demo-btn--danger"
                    style={{ paddingLeft: 20, paddingRight: 20 }}
                  >
                    <Send size={13} strokeWidth={1.8} /> Send broadcast
                  </button>
                </div>
              </div>
            )}
          </div>

          <footer className="demo-block__foot">
            <button
              className="demo-btn demo-btn--ghost"
              onClick={goBack}
              disabled={activeIdx === 0}
            >
              Back
            </button>
            <span className="demo-sectionbar__spacer" />
            <span
              style={{
                fontSize: "var(--fs-10)",
                color: "var(--fg-subtle)",
                letterSpacing: "0.06em",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Clock size={11} strokeWidth={1.8} />
              Step {activeIdx + 1} of {STEPS.length}
            </span>
            {activeIdx < STEPS.length - 1 ? (
              <button className="demo-btn demo-btn--primary" onClick={goNext}>
                Continue
              </button>
            ) : (
              <button className="demo-btn demo-btn--primary">
                <ShieldCheck size={13} strokeWidth={1.8} /> Queue for approval
              </button>
            )}
          </footer>
        </div>

        {/* ==================== RECENT BROADCASTS ==================== */}
        <div className="demo-block" style={{ marginTop: "var(--space-4)" }}>
          <header className="demo-block__head">
            <div>
              <div className="demo-block__title">Recent broadcasts</div>
              <div className="demo-block__sub">Your org's last 5 broadcasts across all channels.</div>
            </div>
          </header>
          <div className="demo-block__body demo-block__body--flush">
            <table className="demo-table">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Audience</th>
                  <th>Sent on</th>
                  <th>Open rate</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {RECENT.map((r) => (
                  <tr key={r.subject}>
                    <td style={{ fontWeight: 500 }}>{r.subject}</td>
                    <td className="is-num">{r.audience.toLocaleString()}</td>
                    <td
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 11,
                        color: "var(--fg-subtle)",
                      }}
                    >
                      {r.sentOn}
                    </td>
                    <td className="is-num">{r.openRate}</td>
                    <td>
                      {r.status === "Sent" && (
                        <span className="demo-badge demo-badge--success">Sent</span>
                      )}
                      {r.status === "Scheduled" && (
                        <span className="demo-badge demo-badge--accent">Scheduled</span>
                      )}
                      {r.status === "Draft" && (
                        <span className="demo-badge">Draft</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
