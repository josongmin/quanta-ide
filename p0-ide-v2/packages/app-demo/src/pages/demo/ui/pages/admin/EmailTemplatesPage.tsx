import { useState } from "react";
import type { CSSProperties } from "react";
import {
  Mail,
  MailCheck,
  ShieldCheck,
  Gift,
  Bell,
  Users,
  CreditCard,
  Send,
  Copy,
  Check,
  Pencil,
  FileText,
  KeyRound,
  AlertTriangle,
} from "lucide-react";
import { DemoAppHero } from "../../internal/DemoAppHero";
import { Sparkline } from "../../internal/Sparkline";

type Category =
  | "auth"
  | "billing"
  | "team"
  | "security"
  | "notifications"
  | "marketing";

interface Template {
  key: string;
  category: Category;
  subject: string;
  sent: number;
  editedAgo: string;
  editedRecently: boolean;
  icon: typeof Mail;
  tone: string;
}

const CATEGORIES: Array<{ id: Category | "all"; label: string }> = [
  { id: "all", label: "All" },
  { id: "auth", label: "Auth" },
  { id: "billing", label: "Billing" },
  { id: "team", label: "Team" },
  { id: "security", label: "Security" },
  { id: "notifications", label: "Notifications" },
  { id: "marketing", label: "Marketing" },
];

const CATEGORY_LABEL: Record<Category, string> = {
  auth: "Auth",
  billing: "Billing",
  team: "Team",
  security: "Security",
  notifications: "Notifications",
  marketing: "Marketing",
};

const TEMPLATES: Template[] = [
  {
    key: "auth.welcome",
    category: "auth",
    subject: "Welcome to Quanta, {{first_name}} 👋",
    sent: 184,
    editedAgo: "2d",
    editedRecently: true,
    icon: Gift,
    tone: "var(--accent)",
  },
  {
    key: "auth.email_verify",
    category: "auth",
    subject: "Verify your email",
    sent: 192,
    editedAgo: "21d",
    editedRecently: false,
    icon: MailCheck,
    tone: "var(--accent)",
  },
  {
    key: "auth.password_reset",
    category: "auth",
    subject: "Reset your password",
    sent: 58,
    editedAgo: "47d",
    editedRecently: false,
    icon: KeyRound,
    tone: "var(--accent)",
  },
  {
    key: "auth.new_device",
    category: "auth",
    subject: "New sign-in from {{location}}",
    sent: 211,
    editedAgo: "9d",
    editedRecently: false,
    icon: ShieldCheck,
    tone: "var(--accent)",
  },
  {
    key: "billing.invoice_paid",
    category: "billing",
    subject: "Invoice {{invoice_id}} paid",
    sent: 46,
    editedAgo: "11d",
    editedRecently: false,
    icon: CreditCard,
    tone: "var(--success)",
  },
  {
    key: "billing.payment_failed",
    category: "billing",
    subject: "Your payment didn't go through",
    sent: 7,
    editedAgo: "3d",
    editedRecently: true,
    icon: AlertTriangle,
    tone: "var(--danger)",
  },
  {
    key: "billing.trial_ending",
    category: "billing",
    subject: "Your trial ends in {{days}} days",
    sent: 24,
    editedAgo: "18d",
    editedRecently: false,
    icon: CreditCard,
    tone: "var(--warn)",
  },
  {
    key: "team.invite",
    category: "team",
    subject: "{{inviter}} invited you to {{workspace}}",
    sent: 312,
    editedAgo: "6d",
    editedRecently: false,
    icon: Users,
    tone: "var(--fg)",
  },
  {
    key: "team.role_changed",
    category: "team",
    subject: "Your role was updated",
    sent: 33,
    editedAgo: "31d",
    editedRecently: false,
    icon: Users,
    tone: "var(--fg)",
  },
  {
    key: "security.suspicious_login",
    category: "security",
    subject: "Suspicious login attempt",
    sent: 4,
    editedAgo: "1d",
    editedRecently: true,
    icon: ShieldCheck,
    tone: "var(--danger)",
  },
  {
    key: "security.key_rotated",
    category: "security",
    subject: "API key rotated",
    sent: 18,
    editedAgo: "26d",
    editedRecently: false,
    icon: KeyRound,
    tone: "var(--warn)",
  },
  {
    key: "notifications.digest_weekly",
    category: "notifications",
    subject: "Your weekly Quanta digest",
    sent: 2840,
    editedAgo: "4d",
    editedRecently: false,
    icon: Bell,
    tone: "var(--accent)",
  },
];

interface MergeField {
  token: string;
  sample: string;
}

const MERGE_FIELDS: Record<string, MergeField[]> = {
  "auth.welcome": [
    { token: "{{first_name}}", sample: "Ada" },
    { token: "{{workspace}}", sample: "Acme Inc." },
    { token: "{{inviter_name}}", sample: "Alan Turing" },
    { token: "{{cta_url}}", sample: "https://app.quanta.dev/welcome?t=xP92b" },
    { token: "{{locale}}", sample: "en-US" },
  ],
  default: [
    { token: "{{first_name}}", sample: "Ada" },
    { token: "{{workspace}}", sample: "Acme Inc." },
    { token: "{{cta_url}}", sample: "https://app.quanta.dev" },
    { token: "{{locale}}", sample: "en-US" },
  ],
};

const SEND_SERIES: Record<string, number[]> = {
  "auth.welcome": [0.4, 0.5, 0.42, 0.55, 0.62, 0.58, 0.7, 0.75, 0.68, 0.8, 0.72, 0.88],
  default: [0.3, 0.4, 0.5, 0.42, 0.48, 0.55, 0.5, 0.62, 0.58, 0.64, 0.7, 0.68],
};

function iconTile(tone: string): CSSProperties {
  return {
    width: 32,
    height: 32,
    borderRadius: "var(--radius-md)",
    background: "var(--bg-subtle)",
    color: tone,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flex: "0 0 auto",
    border: "1px solid var(--border)",
  };
}

export function EmailTemplatesPage() {
  const [selectedKey, setSelectedKey] = useState<string>("auth.welcome");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<Category | "all">("all");
  const [language, setLanguage] = useState("en");
  const [darkPreview, setDarkPreview] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const selected = TEMPLATES.find((t) => t.key === selectedKey) ?? TEMPLATES[0];
  const mergeFields = MERGE_FIELDS[selected.key] ?? MERGE_FIELDS.default;
  const sparkValues = SEND_SERIES[selected.key] ?? SEND_SERIES.default;

  const filtered = TEMPLATES.filter((t) => {
    if (category !== "all" && t.category !== category) return false;
    if (search.trim() === "") return true;
    const q = search.toLowerCase();
    return (
      t.key.toLowerCase().includes(q) ||
      t.subject.toLowerCase().includes(q) ||
      CATEGORY_LABEL[t.category].toLowerCase().includes(q)
    );
  });

  const grouped = (Object.keys(CATEGORY_LABEL) as Category[])
    .map((cat) => ({
      cat,
      items: filtered.filter((t) => t.category === cat),
    }))
    .filter((g) => g.items.length > 0);

  const copyToken = (token: string) => {
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 1400);
  };

  // Preview theming
  const mailBg = darkPreview ? "#0b0b0f" : "var(--bg)";
  const mailFg = darkPreview ? "#e9e9ef" : "var(--fg)";
  const mailMutedFg = darkPreview ? "#9c9cab" : "var(--fg-muted)";
  const mailSubtleFg = darkPreview ? "#6e6e7e" : "var(--fg-subtle)";
  const mailBorder = darkPreview ? "#1f1f27" : "var(--border)";
  const mailBand = darkPreview ? "#e9e9ef" : "var(--fg)";
  const mergeChipBg = darkPreview ? "#1a2331" : "var(--bg-accent-subtle)";
  const mergeChipFg = darkPreview ? "#7ab3ff" : "var(--accent)";

  // Subject resolution per template
  const resolvedSubject = selected.subject
    .replace("{{first_name}}", "Ada")
    .replace("{{location}}", "Seoul, KR")
    .replace("{{invoice_id}}", "INV-3091")
    .replace("{{days}}", "3")
    .replace("{{inviter}}", "Alan Turing")
    .replace("{{workspace}}", "Acme Inc.");

  return (
    <div className="demo-app">
      <DemoAppHero
        kicker="Admin"
        title="Email templates"
        sub="Every transactional email Quanta sends, with live preview and merge-field data. Edit once, applies org-wide."
      />
      <div className="demo-app__body">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(300px, 360px) minmax(0, 1fr)",
            gap: "var(--space-4)",
            minHeight: 640,
          }}
        >
          {/* ============================ LEFT: TEMPLATE LIST ============================ */}
          <aside
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-3)",
              minWidth: 0,
            }}
          >
            <div className="demo-sectionbar">
              <input
                className="demo-input"
                type="search"
                placeholder="Search templates…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ flex: 1, minWidth: 0 }}
                aria-label="Search templates"
              />
              <select
                className="demo-select"
                value={category}
                onChange={(e) => setCategory(e.target.value as Category | "all")}
                style={{ maxWidth: 140 }}
                aria-label="Filter category"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-3h)",
                minWidth: 0,
              }}
            >
              {grouped.length === 0 && (
                <div className="demo-empty">
                  <Mail size={18} strokeWidth={1.6} />
                  <div className="demo-empty__title">No templates match</div>
                  <div className="demo-empty__hint">
                    Try a different search or category.
                  </div>
                </div>
              )}
              {grouped.map(({ cat, items }) => (
                <div
                  key={cat}
                  style={{ display: "flex", flexDirection: "column", gap: "var(--space-1h)" }}
                >
                  <div
                    style={{
                      fontSize: "var(--fs-10)",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      fontWeight: 700,
                      color: "var(--fg-subtle)",
                      padding: "0 var(--space-1)",
                    }}
                  >
                    {CATEGORY_LABEL[cat]} · {items.length}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "var(--space-1h)",
                    }}
                  >
                    {items.map((t) => {
                      const isSel = t.key === selectedKey;
                      const Icon = t.icon;
                      return (
                        <button
                          key={t.key}
                          type="button"
                          onClick={() => setSelectedKey(t.key)}
                          style={{
                            width: "100%",
                            textAlign: "left",
                            padding: "var(--space-3)",
                            border: isSel ? "1px solid var(--fg)" : "1px solid var(--border)",
                            background: isSel ? "var(--bg-subtle)" : "var(--bg)",
                            borderRadius: "var(--radius-md)",
                            display: "grid",
                            gridTemplateColumns: "auto minmax(0, 1fr) auto",
                            gap: "var(--space-2h)",
                            alignItems: "center",
                            cursor: "pointer",
                          }}
                          aria-pressed={isSel}
                        >
                          <span style={iconTile(t.tone)}>
                            <Icon size={14} strokeWidth={1.8} />
                          </span>
                          <div style={{ minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: "var(--fs-sm)",
                                fontWeight: 500,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {t.subject}
                            </div>
                            <div
                              style={{
                                fontSize: "var(--fs-10)",
                                color: "var(--fg-subtle)",
                                fontFamily: "var(--font-mono)",
                                marginTop: 2,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {t.key}
                            </div>
                          </div>
                          <span
                            className={
                              t.editedRecently
                                ? "demo-badge demo-badge--warn"
                                : "demo-badge"
                            }
                            title={
                              t.editedRecently
                                ? `Edited ${t.editedAgo} ago`
                                : `${t.sent} sent last 30 days`
                            }
                          >
                            {t.sent >= 1000
                              ? `${(t.sent / 1000).toFixed(1)}k/mo`
                              : `${t.sent}/mo`}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </aside>

          {/* ============================ RIGHT: PREVIEW ============================ */}
          <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", minWidth: 0 }}>
            {/* Top bar */}
            <div className="demo-sectionbar">
              <code
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--fs-xs)",
                  padding: "3px 8px",
                  background: "var(--bg-subtle)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  color: "var(--fg)",
                }}
              >
                {selected.key}
              </code>
              <span
                className={
                  selected.editedRecently
                    ? "demo-badge demo-badge--warn"
                    : "demo-badge"
                }
              >
                edited {selected.editedAgo}
              </span>
              <span className="demo-sectionbar__spacer" />
              <select
                className="demo-select"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                aria-label="Preview language"
                style={{ maxWidth: 96 }}
              >
                <option value="en">EN</option>
                <option value="ko">KO</option>
                <option value="ja">JA</option>
                <option value="de">DE</option>
              </select>
              <label
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: "var(--fs-xs)",
                  color: "var(--fg-muted)",
                }}
              >
                <span>Dark preview</span>
                <span className="demo-toggle" aria-label="Dark mode preview">
                  <input
                    type="checkbox"
                    checked={darkPreview}
                    onChange={(e) => setDarkPreview(e.target.checked)}
                  />
                  <span className="demo-toggle__track" />
                </span>
              </label>
              <button className="demo-btn demo-btn--ghost">
                <Pencil size={12} strokeWidth={1.8} /> Edit
              </button>
              <button className="demo-btn demo-btn--ghost">
                <FileText size={12} strokeWidth={1.8} /> Duplicate
              </button>
              <button className="demo-btn demo-btn--primary">
                <Send size={12} strokeWidth={1.8} /> Send test
              </button>
            </div>

            {/* Email preview frame */}
            <div
              style={{
                padding: "var(--space-5) var(--space-4)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                background: "var(--bg-subtle)",
              }}
            >
              <div
                style={{
                  maxWidth: 560,
                  margin: "0 auto",
                  border: `1px solid ${mailBorder}`,
                  borderRadius: "var(--radius-md)",
                  background: mailBg,
                  boxShadow: "var(--shadow-xs)",
                  overflow: "hidden",
                  color: mailFg,
                }}
              >
                {/* Header metadata */}
                <div
                  style={{
                    padding: "var(--space-3) var(--space-4)",
                    borderBottom: `1px solid ${mailBorder}`,
                    fontSize: "var(--fs-xs)",
                    color: mailMutedFg,
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                  }}
                >
                  <div>
                    <strong style={{ color: mailFg }}>From:</strong> Quanta &lt;no-reply@quanta.dev&gt;
                  </div>
                  <div>
                    <strong style={{ color: mailFg }}>To:</strong> ada@acme.com
                  </div>
                  <div>
                    <strong style={{ color: mailFg }}>Subject:</strong>{" "}
                    <span style={{ color: mailFg }}>{resolvedSubject}</span>
                  </div>
                </div>

                {/* Email body */}
                <div style={{ padding: 0 }}>
                  <div style={{ height: 4, background: mailBand }} />
                  <div
                    style={{
                      padding: "var(--space-6) var(--space-5)",
                      fontFamily: "var(--font-sans)",
                      color: mailFg,
                      lineHeight: "var(--lh-relaxed)",
                      fontSize: 14,
                    }}
                  >
                    {/* Logo */}
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        background: mailBand,
                        color: mailBg,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontFamily: "var(--font-mono)",
                        fontWeight: 700,
                        fontSize: 18,
                        letterSpacing: "-0.04em",
                        marginBottom: 24,
                      }}
                      aria-hidden
                    >
                      q
                    </div>

                    <h1
                      style={{
                        fontSize: 22,
                        letterSpacing: "-0.02em",
                        margin: "0 0 12px",
                        color: mailFg,
                        fontWeight: 700,
                      }}
                    >
                      {language === "ko"
                        ? "Quanta에 오신 것을 환영합니다"
                        : language === "ja"
                        ? "Quanta へようこそ"
                        : language === "de"
                        ? "Willkommen bei Quanta"
                        : "Welcome to Quanta"}
                    </h1>

                    <p style={{ margin: "0 0 14px" }}>
                      Hi{" "}
                      <span
                        style={{
                          background: mergeChipBg,
                          color: mergeChipFg,
                          padding: "1px 6px",
                          borderRadius: 3,
                          fontFamily: "var(--font-mono)",
                          fontSize: "var(--fs-xs)",
                        }}
                      >
                        {"{{first_name}}"}
                      </span>
                      ,
                    </p>
                    <p style={{ margin: "0 0 14px" }}>
                      You&rsquo;re all set. Here are the first three things to try inside{" "}
                      <span
                        style={{
                          background: mergeChipBg,
                          color: mergeChipFg,
                          padding: "1px 6px",
                          borderRadius: 3,
                          fontFamily: "var(--font-mono)",
                          fontSize: "var(--fs-xs)",
                        }}
                      >
                        {"{{workspace}}"}
                      </span>
                      :
                    </p>

                    <ul style={{ listStyle: "none", padding: 0, margin: "0 0 22px" }}>
                      {[
                        "Drop a repo and let the engine map your architecture",
                        "Invite one teammate and share a live workspace link",
                        "Connect GitHub so PRs show risk inline",
                      ].map((line, i) => (
                        <li
                          key={line}
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            gap: 10,
                            padding: "4px 0",
                          }}
                        >
                          <span
                            style={{
                              width: 18,
                              height: 18,
                              borderRadius: "50%",
                              background: mailBand,
                              color: mailBg,
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flex: "0 0 auto",
                              fontSize: 10,
                              fontWeight: 700,
                              marginTop: 2,
                            }}
                          >
                            {i + 1}
                          </span>
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>

                    <a
                      href="#"
                      onClick={(e) => e.preventDefault()}
                      style={{
                        display: "inline-block",
                        padding: "12px 20px",
                        background: mailBand,
                        color: mailBg,
                        borderRadius: 6,
                        textDecoration: "none",
                        fontWeight: 600,
                        fontSize: 14,
                      }}
                    >
                      Open your workspace →
                    </a>

                    <p style={{ marginTop: 24, marginBottom: 0 }}>— The Quanta team</p>

                    <hr
                      style={{
                        border: 0,
                        borderTop: `1px solid ${mailBorder}`,
                        margin: "24px 0",
                      }}
                    />
                    <p
                      style={{
                        fontSize: "var(--fs-10)",
                        color: mailSubtleFg,
                        margin: 0,
                        lineHeight: "var(--lh-relaxed)",
                      }}
                    >
                      Quanta, Inc. · 600 California St, San Francisco, CA 94108 ·{" "}
                      <span style={{ textDecoration: "underline" }}>Unsubscribe</span> ·{" "}
                      <span style={{ textDecoration: "underline" }}>Preferences</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Sidecar blocks */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1.2fr 1fr",
                gap: "var(--space-3)",
              }}
            >
              {/* Merge fields */}
              <div className="demo-block">
                <header className="demo-block__head">
                  <div>
                    <div className="demo-block__title">Merge fields</div>
                    <div className="demo-block__sub">
                      Data available to this template at render time.
                    </div>
                  </div>
                  <span className="demo-sectionbar__spacer" />
                  <span className="demo-badge">{mergeFields.length} fields</span>
                </header>
                <div className="demo-block__body">
                  <div className="demo-kv">
                    {mergeFields.map((f) => (
                      <div key={f.token} style={{ display: "contents" }}>
                        <div
                          className="demo-kv__k"
                          style={{
                            fontFamily: "var(--font-mono)",
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          {f.token}
                          <button
                            type="button"
                            onClick={() => copyToken(f.token)}
                            aria-label={`Copy ${f.token}`}
                            style={{
                              border: 0,
                              background: "transparent",
                              color:
                                copiedToken === f.token
                                  ? "var(--success)"
                                  : "var(--fg-subtle)",
                              cursor: "pointer",
                              display: "inline-flex",
                              padding: 0,
                            }}
                          >
                            {copiedToken === f.token ? (
                              <Check size={11} strokeWidth={2.4} />
                            ) : (
                              <Copy size={11} strokeWidth={1.8} />
                            )}
                          </button>
                        </div>
                        <div
                          className="demo-kv__v"
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: 11,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {f.sample}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Delivery stats */}
              <div className="demo-block">
                <header className="demo-block__head">
                  <div>
                    <div className="demo-block__title">Delivery</div>
                    <div className="demo-block__sub">Last 30 days · live</div>
                  </div>
                </header>
                <div className="demo-block__body">
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(3, 1fr)",
                      gap: "var(--space-2)",
                      marginBottom: "var(--space-3)",
                    }}
                  >
                    {[
                      { label: "Sent 30d", value: selected.sent.toLocaleString() },
                      { label: "Open rate", value: "61.4%" },
                      { label: "Click rate", value: "22.8%" },
                    ].map((s) => (
                      <div
                        key={s.label}
                        style={{
                          padding: "var(--space-2) var(--space-2h)",
                          border: "1px solid var(--border)",
                          borderRadius: "var(--radius-sm)",
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
                          }}
                        >
                          {s.label}
                        </div>
                        <div
                          style={{
                            fontSize: "var(--fs-md)",
                            fontWeight: 700,
                            fontVariantNumeric: "tabular-nums",
                            marginTop: 2,
                          }}
                        >
                          {s.value}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 4,
                    }}
                  >
                    <span
                      style={{
                        fontSize: "var(--fs-10)",
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: "var(--fg-subtle)",
                        fontWeight: 700,
                      }}
                    >
                      Sends per day
                    </span>
                    <span
                      style={{
                        fontSize: "var(--fs-10)",
                        color: "var(--fg-subtle)",
                      }}
                    >
                      12w trailing
                    </span>
                  </div>
                  <Sparkline values={sparkValues} width={300} height={52} />
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
