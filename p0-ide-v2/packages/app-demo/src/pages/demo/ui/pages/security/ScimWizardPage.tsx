import { useState } from "react";
import type { ReactNode } from "react";
import {
  Check,
  ShieldCheck,
  KeyRound,
  AlertTriangle,
  ChevronRight,
  ChevronDown,
  Play,
  RefreshCw,
  Users,
  Clock,
  Link2,
  Eye,
  EyeOff,
} from "lucide-react";
import { DemoAppHero } from "../../internal/DemoAppHero";
import { WizardStepper } from "../../internal/WizardStepper";
import { StepCircle } from "../../internal/StepCircle";
import { DarkPanel, DarkPanelHeader, DarkPanelBody } from "../../internal/DarkPanel";
import { CopyButton } from "../../internal/CopyButton";

const STEPS = [
  { id: "overview", title: "Overview & enable" },
  { id: "creds", title: "Generate credentials" },
  { id: "idp", title: "Configure your IdP" },
  { id: "map", title: "Attribute mapping" },
  { id: "test", title: "Test & activate" },
] as const;

const SCIM_BASE_URL = "https://app.quanta.dev/scim/v2/acme";
const BEARER_TOKEN = "scim_live_a9c1f8e3b7d04a2f9b1e0c5d7e2a3f60";

type IdpTab = "Okta" | "Azure AD" | "OneLogin" | "Google Workspace";
const IDP_TABS: readonly IdpTab[] = ["Okta", "Azure AD", "OneLogin", "Google Workspace"];

const IDP_INSTRUCTIONS: Record<
  IdpTab,
  { path: string; steps: string[]; screenshotLabel: string }
> = {
  Okta: {
    path: "Applications → Provisioning → Configure API Integration",
    steps: [
      "Open your Quanta app in Okta. Go to Provisioning → Integration.",
      "Check 'Enable API integration'. Paste the SCIM base URL and bearer token below.",
      "Click Test API Credentials — you should see 'Okta was able to access Quanta.'",
      "Under To App, enable Create, Update, and Deactivate users.",
    ],
    screenshotLabel: "Okta: Applications → Provisioning → API Integration",
  },
  "Azure AD": {
    path: "Enterprise apps → Quanta → Provisioning",
    steps: [
      "Open Enterprise Applications → your Quanta app → Provisioning.",
      "Set Provisioning Mode to Automatic.",
      "Paste the Tenant URL (SCIM base URL) and Secret Token below.",
      "Click Test Connection, then Save. Leave Mappings at defaults.",
    ],
    screenshotLabel: "Azure AD: Enterprise apps → Provisioning",
  },
  OneLogin: {
    path: "Applications → Quanta → Configuration",
    steps: [
      "Open your Quanta app → Configuration tab.",
      "Paste the SCIM base URL in SCIM Base URL.",
      "Paste the bearer token in SCIM Bearer Token.",
      "Enable API Connection and click Save. Turn on provisioning on the Provisioning tab.",
    ],
    screenshotLabel: "OneLogin: Applications → Quanta → Configuration",
  },
  "Google Workspace": {
    path: "Apps → Web and mobile apps → Quanta → Auto-provisioning",
    steps: [
      "Open Admin Console → Apps → Web and mobile apps → Quanta.",
      "Click Auto-provisioning → Configure.",
      "Paste the SCIM endpoint and bearer token.",
      "Choose attribute mappings (defaults are fine) and turn on auto-provisioning.",
    ],
    screenshotLabel: "Google Admin: Auto-provisioning wizard",
  },
};

interface AttrRow {
  idp: string;
  field: string;
  transform: string;
  required: boolean;
}

const ATTR_ROWS: AttrRow[] = [
  { idp: "userName", field: "email", transform: "—", required: true },
  { idp: "name.givenName", field: "firstName", transform: "—", required: true },
  { idp: "name.familyName", field: "lastName", transform: "—", required: true },
  { idp: "department", field: "metadata.department", transform: "—", required: false },
  { idp: "employeeNumber", field: "metadata.employeeId", transform: "—", required: false },
];

interface GroupRow {
  scim: string;
  role: string;
}
const GROUP_ROWS: GroupRow[] = [
  { scim: "quanta-admins", role: "Owner" },
  { scim: "quanta-engineers", role: "Engineer" },
  { scim: "quanta-viewers", role: "Viewer" },
];

interface SkipRow {
  user: string;
  reason: string;
}
const SKIPPED: SkipRow[] = [
  { user: "bot-ci@acme.com", reason: "Service account — no role mapping" },
  { user: "contractor-aug24@acme.com", reason: "Deactivated in IdP" },
  { user: "alumni-2025@acme.com", reason: "Missing givenName / familyName" },
  { user: "test-seat-09@acme.com", reason: "Not in any quanta-* group" },
];

interface RecentSync {
  when: string;
  direction: "Full" | "Delta";
  added: number;
  updated: number;
  deactivated: number;
  status: "success" | "warn";
  duration: string;
}
const RECENT_SYNCS: RecentSync[] = [
  { when: "2026-04-19 14:00 KST", direction: "Delta", added: 1, updated: 4, deactivated: 0, status: "success", duration: "2.1s" },
  { when: "2026-04-19 10:00 KST", direction: "Delta", added: 0, updated: 2, deactivated: 1, status: "success", duration: "1.8s" },
  { when: "2026-04-19 06:00 KST", direction: "Delta", added: 3, updated: 1, deactivated: 0, status: "success", duration: "2.4s" },
  { when: "2026-04-19 02:00 KST", direction: "Delta", added: 0, updated: 0, deactivated: 0, status: "warn", duration: "32.1s" },
  { when: "2026-04-18 22:00 KST", direction: "Full", added: 118, updated: 0, deactivated: 2, status: "success", duration: "14.2s" },
];

const INTERVALS = ["15 min", "1 hour", "4 hours", "Daily"] as const;

function ScreenshotPlaceholder({ label }: { label: string }) {
  return (
    <div
      style={{
        border: "1.5px dashed var(--border-strong)",
        borderRadius: "var(--radius-md)",
        background:
          "repeating-linear-gradient(45deg, var(--bg-subtle), var(--bg-subtle) 8px, var(--bg-muted) 8px, var(--bg-muted) 16px)",
        padding: "var(--space-6) var(--space-4)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--space-1h)",
        minHeight: 120,
      }}
    >
      <Eye size={18} strokeWidth={1.6} style={{ color: "var(--fg-subtle)" }} />
      <div
        style={{
          fontSize: "var(--fs-10)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          fontWeight: 600,
          color: "var(--fg-muted)",
          textAlign: "center",
        }}
      >
        {label}
      </div>
    </div>
  );
}

function CheckRow({ children }: { children: ReactNode }) {
  return (
    <li
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-2)",
        fontSize: "var(--fs-sm)",
        color: "var(--fg)",
        lineHeight: "var(--lh-snug)",
      }}
    >
      <span
        style={{
          width: 20,
          height: 20,
          borderRadius: "50%",
          background: "var(--bg-success-subtle)",
          color: "var(--success)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flex: "0 0 auto",
          border: "1px solid var(--border-success-subtle)",
        }}
      >
        <Check size={11} strokeWidth={2.6} />
      </span>
      <span>{children}</span>
    </li>
  );
}

export function ScimWizardPage() {
  const [activeIdx, setActiveIdx] = useState(0);
  const [enabled, setEnabled] = useState(false);
  const [idpTab, setIdpTab] = useState<IdpTab>("Okta");
  const [tokenVisible, setTokenVisible] = useState(false);
  const [tested, setTested] = useState(false);
  const [showSkipped, setShowSkipped] = useState(true);
  const [autoProvision, setAutoProvision] = useState(true);
  const [interval, setIntervalVal] = useState<(typeof INTERVALS)[number]>("1 hour");

  const goNext = () => setActiveIdx((i) => Math.min(STEPS.length - 1, i + 1));
  const goBack = () => setActiveIdx((i) => Math.max(0, i - 1));

  return (
    <div className="demo-app">
      <DemoAppHero
        kicker="Security"
        title="SCIM provisioning"
        sub="Auto-sync members from your identity provider. Creates, updates, and deactivates accounts without manual invites."
      />
      <div className="demo-app__body">
        <WizardStepper steps={STEPS} activeIdx={activeIdx} onChange={setActiveIdx} />

        <div className="demo-block">
          <header className="demo-block__head">
            <div>
              <div className="demo-block__title">{STEPS[activeIdx]!.title}</div>
              <div className="demo-block__sub">Step {activeIdx + 1} of {STEPS.length}</div>
            </div>
          </header>

          <div className="demo-block__body">
            {/* Step 1: Overview & enable */}
            {activeIdx === 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3h)" }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: "var(--fs-sm)",
                    color: "var(--fg-muted)",
                    lineHeight: "var(--lh-relaxed)",
                  }}
                >
                  SCIM (System for Cross-domain Identity Management) lets your identity provider
                  push user changes to Quanta automatically. Here's what it does:
                </p>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                    gap: "var(--space-3)",
                  }}
                >
                  {[
                    {
                      n: 1,
                      title: "Create",
                      body: "A new hire added to your SCIM group shows up in Quanta within 15 minutes.",
                    },
                    {
                      n: 2,
                      title: "Update",
                      body: "Name, email, department, or group changes in the IdP flow into Quanta.",
                    },
                    {
                      n: 3,
                      title: "Deactivate",
                      body: "Removing someone in the IdP signs them out and revokes access everywhere.",
                    },
                  ].map((s) => (
                    <div
                      key={s.n}
                      style={{
                        padding: "var(--space-3h)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-md)",
                        background: "var(--bg)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "var(--space-1h)",
                      }}
                    >
                      <StepCircle n={s.n} state="current" size={28} />
                      <div style={{ fontSize: "var(--fs-md)", fontWeight: 600 }}>{s.title}</div>
                      <div
                        style={{
                          fontSize: "var(--fs-xs)",
                          color: "var(--fg-muted)",
                          lineHeight: "var(--lh-relaxed)",
                        }}
                      >
                        {s.body}
                      </div>
                    </div>
                  ))}
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "var(--space-2h)",
                    padding: "var(--space-3)",
                    background: "var(--bg-warn-subtle)",
                    border: "1px solid var(--border-warn-subtle)",
                    borderRadius: "var(--radius-md)",
                  }}
                >
                  <AlertTriangle
                    size={14}
                    strokeWidth={1.8}
                    style={{ color: "var(--warn)", flex: "0 0 auto", marginTop: 2 }}
                  />
                  <div
                    style={{
                      fontSize: "var(--fs-xs)",
                      color: "var(--fg)",
                      lineHeight: "var(--lh-relaxed)",
                    }}
                  >
                    Manual invites will continue to work until SCIM takes over. Existing members
                    will be linked by email on first sync — make sure each user's primary email
                    in your IdP matches what they signed in with.
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "auto minmax(0, 1fr) auto",
                    alignItems: "center",
                    gap: "var(--space-3)",
                    padding: "var(--space-3)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-md)",
                    background: "var(--bg)",
                  }}
                >
                  <span
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "var(--radius-md)",
                      background: "var(--bg-accent-subtle)",
                      color: "var(--accent)",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Users size={16} strokeWidth={1.8} />
                  </span>
                  <div>
                    <div style={{ fontSize: "var(--fs-sm)", fontWeight: 600 }}>
                      Enable SCIM for this workspace
                    </div>
                    <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)" }}>
                      Turning this on exposes the SCIM endpoint. You can still finish the wizard
                      before any sync runs.
                    </div>
                  </div>
                  <label className="demo-toggle" aria-label="Enable SCIM">
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={(e) => setEnabled(e.target.checked)}
                    />
                    <span className="demo-toggle__track" />
                  </label>
                </div>
              </div>
            )}

            {/* Step 2: Generate credentials */}
            {activeIdx === 1 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3h)" }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: "var(--fs-sm)",
                    color: "var(--fg-muted)",
                    lineHeight: "var(--lh-relaxed)",
                  }}
                >
                  Your IdP will need two things: the SCIM base URL for your workspace, and a bearer
                  token it can use to authenticate. Save the token somewhere safe — we won't show
                  it again.
                </p>

                <DarkPanel padding="0" borderRadius="var(--radius-md)">
                  <DarkPanelHeader>
                    <Link2 size={12} strokeWidth={1.8} style={{ color: "#9ca3af" }} />
                    <span style={{ color: "#e4e4e4", fontWeight: 600 }}>SCIM base URL</span>
                  </DarkPanelHeader>
                  <DarkPanelBody padding="var(--space-3) var(--space-4)">
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "var(--space-2)",
                        justifyContent: "space-between",
                      }}
                    >
                      <code
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 12,
                          color: "#e4e4e4",
                          wordBreak: "break-all",
                        }}
                      >
                        {SCIM_BASE_URL}
                      </code>
                      <CopyButton value={SCIM_BASE_URL} variant="soft" size="sm" />
                    </div>
                  </DarkPanelBody>
                </DarkPanel>

                <DarkPanel padding="0" borderRadius="var(--radius-md)">
                  <DarkPanelHeader
                    right={
                      <div style={{ display: "flex", gap: "var(--space-1h)", alignItems: "center" }}>
                        <button
                          type="button"
                          onClick={() => setTokenVisible((v) => !v)}
                          style={{
                            background: "transparent",
                            border: "1px solid #1f1f1f",
                            color: "#9ca3af",
                            padding: "3px var(--space-2)",
                            borderRadius: "var(--radius-xs)",
                            fontSize: 10,
                            fontFamily: "var(--font-mono)",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          {tokenVisible ? <EyeOff size={10} strokeWidth={1.8} /> : <Eye size={10} strokeWidth={1.8} />}
                          {tokenVisible ? "Hide" : "Show"}
                        </button>
                        <CopyButton value={BEARER_TOKEN} variant="soft" size="sm" />
                      </div>
                    }
                  >
                    <KeyRound size={12} strokeWidth={1.8} style={{ color: "#9ca3af" }} />
                    <span style={{ color: "#e4e4e4", fontWeight: 600 }}>Bearer token</span>
                    <span
                      style={{
                        color: "#fbbf24",
                        fontSize: 10,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                      }}
                    >
                      Shown once
                    </span>
                  </DarkPanelHeader>
                  <DarkPanelBody padding="var(--space-3) var(--space-4)">
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "var(--space-2)",
                        justifyContent: "space-between",
                      }}
                    >
                      <code
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 12,
                          color: "#e4e4e4",
                          wordBreak: "break-all",
                          letterSpacing: tokenVisible ? "normal" : "0.15em",
                        }}
                      >
                        {tokenVisible ? BEARER_TOKEN : "scim_live_" + "•".repeat(28)}
                      </code>
                      <button
                        type="button"
                        style={{
                          background: "transparent",
                          border: "1px solid #1f1f1f",
                          color: "#9ca3af",
                          padding: "4px var(--space-2)",
                          borderRadius: "var(--radius-xs)",
                          fontSize: 10,
                          fontFamily: "var(--font-mono)",
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          whiteSpace: "nowrap",
                        }}
                      >
                        <RefreshCw size={10} strokeWidth={1.8} /> Regenerate
                      </button>
                    </div>
                  </DarkPanelBody>
                </DarkPanel>

                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "var(--space-2h)",
                    padding: "var(--space-3)",
                    background: "var(--bg-warn-subtle)",
                    border: "1px solid var(--border-warn-subtle)",
                    borderRadius: "var(--radius-md)",
                  }}
                >
                  <AlertTriangle
                    size={14}
                    strokeWidth={1.8}
                    style={{ color: "var(--warn)", flex: "0 0 auto", marginTop: 2 }}
                  />
                  <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg)", lineHeight: "var(--lh-relaxed)" }}>
                    <strong>The bearer token is shown once.</strong> Save it in your IdP now. If you
                    lose it, regenerate — that immediately invalidates the old token and existing
                    syncs will fail until your IdP is updated.
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Configure IdP */}
            {activeIdx === 2 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3h)" }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: "var(--fs-sm)",
                    color: "var(--fg-muted)",
                    lineHeight: "var(--lh-relaxed)",
                  }}
                >
                  Switch to the tab matching your identity provider and paste the URL and bearer
                  token from the previous step.
                </p>

                <div className="demo-billing-toggle" style={{ alignSelf: "flex-start" }}>
                  {IDP_TABS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      className={idpTab === t ? "is-active" : ""}
                      onClick={() => setIdpTab(t)}
                    >
                      {t}
                    </button>
                  ))}
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1fr) 360px",
                    gap: "var(--space-3)",
                    alignItems: "start",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2h)" }}>
                    <div
                      style={{
                        fontSize: "var(--fs-10)",
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        fontWeight: 700,
                        color: "var(--fg-subtle)",
                      }}
                    >
                      In your admin console
                    </div>
                    <div
                      style={{
                        fontSize: "var(--fs-sm)",
                        fontFamily: "var(--font-mono)",
                        color: "var(--fg-muted)",
                        padding: "var(--space-1h) var(--space-2)",
                        background: "var(--bg-subtle)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-sm)",
                        alignSelf: "flex-start",
                      }}
                    >
                      {IDP_INSTRUCTIONS[idpTab].path}
                    </div>
                    <ol
                      style={{
                        margin: 0,
                        paddingLeft: 0,
                        listStyle: "none",
                        display: "flex",
                        flexDirection: "column",
                        gap: "var(--space-2)",
                      }}
                    >
                      {IDP_INSTRUCTIONS[idpTab].steps.map((s, i) => (
                        <li
                          key={i}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "auto minmax(0, 1fr)",
                            gap: "var(--space-2)",
                            alignItems: "start",
                          }}
                        >
                          <StepCircle n={i + 1} state="upcoming" size={24} />
                          <span
                            style={{
                              fontSize: "var(--fs-sm)",
                              color: "var(--fg)",
                              lineHeight: "var(--lh-relaxed)",
                              paddingTop: 2,
                            }}
                          >
                            {s}
                          </span>
                        </li>
                      ))}
                    </ol>
                    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1h)" }}>
                      <div
                        style={{
                          fontSize: "var(--fs-10)",
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          fontWeight: 700,
                          color: "var(--fg-subtle)",
                        }}
                      >
                        Paste these into {idpTab}
                      </div>
                      <pre className="demo-code" style={{ margin: 0 }}>
{`SCIM base URL : ${SCIM_BASE_URL}
Bearer token  : ${BEARER_TOKEN}`}
                      </pre>
                    </div>
                  </div>
                  <ScreenshotPlaceholder label={IDP_INSTRUCTIONS[idpTab].screenshotLabel} />
                </div>
              </div>
            )}

            {/* Step 4: Attribute mapping */}
            {activeIdx === 3 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3h)" }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: "var(--fs-sm)",
                    color: "var(--fg-muted)",
                    lineHeight: "var(--lh-relaxed)",
                  }}
                >
                  Quanta ships sensible defaults. You rarely need to change these — the most common
                  customization is adding department or employee ID to user metadata.
                </p>

                <table className="demo-table">
                  <thead>
                    <tr>
                      <th>IdP attribute</th>
                      <th>Quanta field</th>
                      <th>Transform</th>
                      <th style={{ width: 100 }}>Required</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ATTR_ROWS.map((a) => (
                      <tr key={a.idp}>
                        <td>
                          <code
                            style={{
                              fontFamily: "var(--font-mono)",
                              fontSize: 11,
                              color: "var(--fg)",
                            }}
                          >
                            {a.idp}
                          </code>
                        </td>
                        <td>
                          <code
                            style={{
                              fontFamily: "var(--font-mono)",
                              fontSize: 11,
                              color: "var(--fg)",
                            }}
                          >
                            {a.field}
                          </code>
                        </td>
                        <td
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: 11,
                            color: "var(--fg-muted)",
                          }}
                        >
                          {a.transform}
                        </td>
                        <td>
                          {a.required ? (
                            <span className="demo-badge demo-badge--accent">Required</span>
                          ) : (
                            <span className="demo-badge">Optional</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div>
                  <div
                    style={{
                      fontSize: "var(--fs-10)",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      fontWeight: 700,
                      color: "var(--fg-subtle)",
                      marginBottom: "var(--space-1h)",
                    }}
                  >
                    Group → Role mapping
                  </div>
                  <table className="demo-table">
                    <thead>
                      <tr>
                        <th>SCIM group</th>
                        <th>Quanta role</th>
                      </tr>
                    </thead>
                    <tbody>
                      {GROUP_ROWS.map((g) => (
                        <tr key={g.scim}>
                          <td>
                            <code
                              style={{
                                fontFamily: "var(--font-mono)",
                                fontSize: 11,
                                color: "var(--fg)",
                              }}
                            >
                              {g.scim}
                            </code>
                          </td>
                          <td>
                            <span className="demo-badge demo-badge--accent">{g.role}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Step 5: Test & activate */}
            {activeIdx === 4 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3h)" }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: "var(--fs-sm)",
                    color: "var(--fg-muted)",
                    lineHeight: "var(--lh-relaxed)",
                  }}
                >
                  Run a one-shot dry sync. This calls your IdP, pulls users, and walks through
                  mappings without writing anything yet.
                </p>

                <div
                  style={{
                    padding: "var(--space-4)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-md)",
                    background: "var(--bg-subtle)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "var(--space-3)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                    <button
                      type="button"
                      className="demo-btn demo-btn--primary"
                      onClick={() => setTested(true)}
                    >
                      <Play size={13} strokeWidth={1.8} /> Run test sync
                    </button>
                    {tested && (
                      <span className="demo-badge demo-badge--success">
                        <Check size={11} strokeWidth={2.4} /> Passed
                      </span>
                    )}
                    <span className="demo-sectionbar__spacer" />
                    {tested && (
                      <span
                        style={{
                          fontSize: "var(--fs-xs)",
                          color: "var(--fg-muted)",
                          fontFamily: "var(--font-mono)",
                        }}
                      >
                        Finished in 2.4s
                      </span>
                    )}
                  </div>

                  {tested && (
                    <ul
                      style={{
                        listStyle: "none",
                        padding: 0,
                        margin: 0,
                        display: "flex",
                        flexDirection: "column",
                        gap: "var(--space-1h)",
                      }}
                    >
                      <CheckRow>Connected to IdP endpoint</CheckRow>
                      <CheckRow>Authenticated with bearer token</CheckRow>
                      <CheckRow>
                        Retrieved 142 users (118 mapped, 24 skipped — see reasons below)
                      </CheckRow>
                      <CheckRow>Role mapping resolved (3 SCIM groups → Quanta roles)</CheckRow>
                    </ul>
                  )}
                </div>

                {tested && (
                  <div
                    style={{
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-md)",
                      background: "var(--bg)",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setShowSkipped((s) => !s)}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        gap: "var(--space-2)",
                        padding: "var(--space-2h) var(--space-3)",
                        background: "transparent",
                        border: 0,
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      {showSkipped ? (
                        <ChevronDown size={13} strokeWidth={1.8} />
                      ) : (
                        <ChevronRight size={13} strokeWidth={1.8} />
                      )}
                      <span style={{ fontSize: "var(--fs-sm)", fontWeight: 600 }}>
                        Skipped users ({SKIPPED.length})
                      </span>
                      <span
                        style={{
                          fontSize: "var(--fs-xs)",
                          color: "var(--fg-muted)",
                          marginLeft: "var(--space-1h)",
                        }}
                      >
                        + 20 more with the same reasons
                      </span>
                    </button>
                    {showSkipped && (
                      <div
                        style={{
                          borderTop: "1px solid var(--border)",
                          padding: "var(--space-1h) 0",
                        }}
                      >
                        {SKIPPED.map((s) => (
                          <div
                            key={s.user}
                            style={{
                              display: "grid",
                              gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
                              gap: "var(--space-2)",
                              padding: "var(--space-1h) var(--space-3)",
                              fontSize: "var(--fs-xs)",
                            }}
                          >
                            <span
                              style={{
                                fontFamily: "var(--font-mono)",
                                color: "var(--fg)",
                              }}
                            >
                              {s.user}
                            </span>
                            <span style={{ color: "var(--fg-muted)" }}>{s.reason}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {tested && (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "auto minmax(0, 1fr) auto",
                      alignItems: "center",
                      gap: "var(--space-3)",
                      padding: "var(--space-3)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-md)",
                      background: "var(--bg)",
                    }}
                  >
                    <span
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: "var(--radius-md)",
                        background: "var(--bg-accent-subtle)",
                        color: "var(--accent)",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Clock size={16} strokeWidth={1.8} />
                    </span>
                    <div>
                      <div style={{ fontSize: "var(--fs-sm)", fontWeight: 600 }}>
                        Auto-provision on schedule
                      </div>
                      <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)" }}>
                        We'll pull deltas on this interval. Your IdP can still push changes in real
                        time via SCIM POST.
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                      <select
                        className="demo-select"
                        value={interval}
                        onChange={(e) =>
                          setIntervalVal(e.target.value as (typeof INTERVALS)[number])
                        }
                        disabled={!autoProvision}
                        style={{ width: 120 }}
                        aria-label="Sync interval"
                      >
                        {INTERVALS.map((i) => (
                          <option key={i}>{i}</option>
                        ))}
                      </select>
                      <label className="demo-toggle" aria-label="Auto-provision on schedule">
                        <input
                          type="checkbox"
                          checked={autoProvision}
                          onChange={(e) => setAutoProvision(e.target.checked)}
                        />
                        <span className="demo-toggle__track" />
                      </label>
                    </div>
                  </div>
                )}

                {tested && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "var(--space-2h)",
                      padding: "var(--space-3)",
                      background: "var(--bg-danger-subtle)",
                      border: "1px solid var(--border-danger-subtle)",
                      borderRadius: "var(--radius-md)",
                    }}
                  >
                    <ShieldCheck
                      size={14}
                      strokeWidth={1.8}
                      style={{ color: "var(--danger)", flex: "0 0 auto", marginTop: 2 }}
                    />
                    <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg)", lineHeight: "var(--lh-relaxed)" }}>
                      Saving will start the first live sync. 118 users will be created or linked.
                      <strong> 2 existing Quanta members</strong> have no match in your IdP and will
                      be deactivated unless you add them.
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <footer className="demo-block__foot">
            <button className="demo-btn demo-btn--ghost" onClick={goBack} disabled={activeIdx === 0}>
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
              <button
                className="demo-btn demo-btn--primary"
                onClick={goNext}
                disabled={activeIdx === 0 && !enabled}
              >
                Continue
                <ChevronRight size={12} strokeWidth={1.8} />
              </button>
            ) : (
              <button className="demo-btn demo-btn--danger" disabled={!tested}>
                <ShieldCheck size={13} strokeWidth={1.8} /> Save & activate
              </button>
            )}
          </footer>
        </div>

        {/* Recent syncs */}
        <div className="demo-block">
          <header className="demo-block__head">
            <div>
              <div className="demo-block__title">Recent syncs</div>
              <div className="demo-block__sub">Last 5 runs on this workspace.</div>
            </div>
            <span className="demo-sectionbar__spacer" />
            <button type="button" className="demo-btn demo-btn--ghost">
              <RefreshCw size={12} strokeWidth={1.8} /> Sync now
            </button>
          </header>
          <div className="demo-block__body demo-block__body--flush">
            <table className="demo-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Direction</th>
                  <th>Changes</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Duration</th>
                </tr>
              </thead>
              <tbody>
                {RECENT_SYNCS.map((r, i) => (
                  <tr key={i}>
                    <td className="is-mono">{r.when}</td>
                    <td>
                      <span className="demo-badge">{r.direction}</span>
                    </td>
                    <td
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 11,
                        color: "var(--fg-muted)",
                      }}
                    >
                      <span style={{ color: "var(--success)" }}>+{r.added}</span>
                      {" · "}
                      <span>~{r.updated}</span>
                      {" · "}
                      <span style={{ color: r.deactivated > 0 ? "var(--danger)" : undefined }}>
                        -{r.deactivated}
                      </span>
                    </td>
                    <td>
                      {r.status === "success" ? (
                        <span className="demo-badge demo-badge--success">
                          <Check size={10} strokeWidth={2.4} /> ok
                        </span>
                      ) : (
                        <span className="demo-badge demo-badge--warn">
                          <AlertTriangle size={10} strokeWidth={2} /> no changes
                        </span>
                      )}
                    </td>
                    <td
                      className="is-num"
                      style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-muted)" }}
                    >
                      {r.duration}
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
