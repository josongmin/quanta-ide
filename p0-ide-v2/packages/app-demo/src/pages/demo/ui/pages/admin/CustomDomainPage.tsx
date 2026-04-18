import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  Globe,
  ShieldCheck,
  Check,
  AlertTriangle,
  Lock,
  Upload,
  Palette,
  Paintbrush,
  Link2,
  Clock,
  RefreshCw,
  Eye,
} from "lucide-react";
import { DemoAppHero } from "../../internal/DemoAppHero";
import { CopyButton } from "../../internal/CopyButton";

interface DnsRow {
  type: "CNAME" | "TXT";
  name: string;
  value: string;
  status: "verified" | "pending";
}

const DNS_ROWS: DnsRow[] = [
  { type: "CNAME", name: "@", value: "acme.quanta.dev", status: "verified" },
  { type: "TXT", name: "_quanta-verify", value: "quanta-verify=8a21f3b4c9d0e1f7...", status: "verified" },
  { type: "CNAME", name: "app", value: "proxy.quanta.dev", status: "pending" },
];

interface Swatch {
  id: string;
  name: string;
  color: string;
}

const SWATCHES: Swatch[] = [
  { id: "ink", name: "Ink", color: "#0f172a" },
  { id: "accent", name: "Indigo", color: "#4f46e5" },
  { id: "blue", name: "Blue", color: "#2563eb" },
  { id: "emerald", name: "Emerald", color: "#059669" },
  { id: "amber", name: "Amber", color: "#d97706" },
  { id: "rose", name: "Rose", color: "#e11d48" },
];

const FONTS = ["System", "Inter", "IBM Plex", "Geist", "Manrope"] as const;

type BgMode = "solid" | "gradient" | "image";

// --- Live preview (sticky) ---
function LivePreview({
  accent,
  logoUploaded,
  forceHttps,
  wwwRedirect,
  hideBranding,
  fromName,
  font,
  heroText,
  subhero,
  bgMode,
}: {
  accent: string;
  logoUploaded: boolean;
  forceHttps: boolean;
  wwwRedirect: boolean;
  hideBranding: boolean;
  fromName: string;
  font: (typeof FONTS)[number];
  heroText: string;
  subhero: string;
  bgMode: BgMode;
}) {
  const protocol = forceHttps ? "https" : "https";
  const host = wwwRedirect ? "yourworkspace.com" : "www.yourworkspace.com";
  const url = `${protocol}://${host}/`;

  const bgPreview: Record<BgMode, CSSProperties["background"]> = {
    solid: accent,
    gradient: `linear-gradient(135deg, ${accent} 0%, color-mix(in srgb, ${accent} 40%, #000) 100%)`,
    image: `linear-gradient(135deg, ${accent} 0%, color-mix(in srgb, ${accent} 40%, #000) 100%)`,
  };

  return (
    <div
      style={{
        position: "sticky",
        top: "var(--space-4)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)",
      }}
    >
      <div
        style={{
          fontSize: "var(--fs-10)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          fontWeight: 700,
          color: "var(--fg-subtle)",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <Eye size={11} strokeWidth={1.8} /> Live preview
      </div>

      {/* Workspace chrome */}
      <div
        style={{
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-md)",
          background: "var(--bg)",
          overflow: "hidden",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        {/* Title bar */}
        <div
          style={{
            height: 28,
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            gap: "var(--space-1h)",
            padding: "0 var(--space-3)",
            background: "var(--bg-subtle)",
          }}
        >
          <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: "50%", background: "#ff5f57" }} />
          <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: "50%", background: "#febc2e" }} />
          <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: "50%", background: "#28c840" }} />
          <span
            style={{
              marginLeft: "var(--space-2)",
              fontSize: "var(--fs-10)",
              color: "var(--fg-subtle)",
              letterSpacing: "0.04em",
              fontFamily: "var(--font-mono)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {url}
          </span>
        </div>
        {/* App body: sidebar + content */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "120px minmax(0, 1fr)",
            minHeight: 200,
            fontFamily: font === "System" ? undefined : font,
          }}
        >
          {/* Sidebar */}
          <div
            style={{
              background: "var(--bg-subtle)",
              borderRight: "1px solid var(--border)",
              padding: "var(--space-2h) var(--space-2)",
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-1h)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "var(--space-1) var(--space-1h)",
                marginBottom: "var(--space-1h)",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: "var(--radius-xs)",
                  background: accent,
                  color: "#fff",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                {logoUploaded ? "A" : "Q"}
              </span>
              <span
                style={{
                  fontSize: "var(--fs-xs)",
                  fontWeight: 700,
                  color: "var(--fg)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {logoUploaded ? "Acme" : "Your logo"}
              </span>
            </div>
            {["Dashboard", "Projects", "Members", "Settings"].map((it, i) => (
              <div
                key={it}
                style={{
                  fontSize: "var(--fs-10)",
                  padding: "4px 6px",
                  borderRadius: "var(--radius-xs)",
                  color: i === 0 ? "#fff" : "var(--fg-muted)",
                  background: i === 0 ? accent : "transparent",
                }}
              >
                {it}
              </div>
            ))}
          </div>
          {/* Content */}
          <div style={{ padding: "var(--space-3)" }}>
            <div
              aria-hidden="true"
              style={{
                height: 16,
                width: "60%",
                background: "var(--bg-muted)",
                borderRadius: "var(--radius-xs)",
                marginBottom: "var(--space-2)",
              }}
            />
            <div
              aria-hidden="true"
              style={{
                height: 8,
                width: "90%",
                background: "var(--bg-muted)",
                borderRadius: "var(--radius-xs)",
                marginBottom: 6,
              }}
            />
            <div
              aria-hidden="true"
              style={{
                height: 8,
                width: "75%",
                background: "var(--bg-muted)",
                borderRadius: "var(--radius-xs)",
                marginBottom: "var(--space-2h)",
              }}
            />
            <div
              style={{
                padding: "var(--space-1h) var(--space-2)",
                background: accent,
                color: "#fff",
                fontSize: "var(--fs-10)",
                fontWeight: 600,
                borderRadius: "var(--radius-xs)",
                display: "inline-block",
              }}
            >
              Get started
            </div>
            {!hideBranding && (
              <div
                style={{
                  marginTop: "var(--space-3)",
                  fontSize: 9,
                  color: "var(--fg-subtle)",
                  textAlign: "right",
                }}
              >
                Powered by Quanta
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SSO login preview */}
      <div
        style={{
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-md)",
          background: bgPreview[bgMode] as string,
          padding: "var(--space-4)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 140,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            background: "rgba(255,255,255,0.95)",
            borderRadius: "var(--radius-md)",
            padding: "var(--space-3)",
            minWidth: 180,
            maxWidth: 240,
            boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 22,
              height: 22,
              borderRadius: "var(--radius-xs)",
              background: accent,
              color: "#fff",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              fontWeight: 700,
              marginBottom: "var(--space-1h)",
            }}
          >
            {logoUploaded ? "A" : "Q"}
          </span>
          <div
            style={{
              fontSize: "var(--fs-xs)",
              fontWeight: 700,
              color: "#0f172a",
              lineHeight: 1.3,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {heroText || "Sign in"}
          </div>
          <div
            style={{
              fontSize: 9,
              color: "#64748b",
              marginTop: 2,
              lineHeight: 1.3,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {subhero || "to continue to Acme"}
          </div>
          <div
            style={{
              marginTop: "var(--space-1h)",
              height: 20,
              background: "#f1f5f9",
              borderRadius: 3,
            }}
          />
          <div
            style={{
              marginTop: 4,
              height: 18,
              background: accent,
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 9,
              fontWeight: 600,
              borderRadius: 3,
            }}
          >
            Continue with SSO
          </div>
        </div>
      </div>

      {/* Email preview */}
      <div
        style={{
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-md)",
          background: "var(--bg)",
          padding: "var(--space-3)",
          fontSize: "var(--fs-10)",
        }}
      >
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
          Email template
        </div>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--fg-muted)",
            lineHeight: 1.5,
          }}
        >
          <div>
            From: <span style={{ color: "var(--fg)" }}>{fromName}</span>
          </div>
          <div>
            Subject: <span style={{ color: "var(--fg)" }}>You were added to Acme on Quanta</span>
          </div>
        </div>
        <div
          style={{
            marginTop: "var(--space-2)",
            padding: "var(--space-2h)",
            background: "var(--bg-subtle)",
            borderRadius: "var(--radius-sm)",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              display: "inline-block",
              width: 18,
              height: 18,
              borderRadius: "var(--radius-xs)",
              background: accent,
              verticalAlign: "middle",
              marginRight: 6,
            }}
          />
          <span style={{ fontSize: "var(--fs-xs)", fontWeight: 600, color: "var(--fg)" }}>
            Welcome to {fromName.split("<")[0]?.trim() || "Acme"}
          </span>
        </div>
      </div>
    </div>
  );
}

function StatusPill({ s }: { s: DnsRow["status"] }) {
  if (s === "verified")
    return (
      <span className="demo-badge demo-badge--success">
        <Check size={10} strokeWidth={2.4} /> Verified
      </span>
    );
  return (
    <span className="demo-badge demo-badge--warn">
      <AlertTriangle size={10} strokeWidth={2} /> Pending
    </span>
  );
}

function EnterpriseLock() {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px var(--space-1h)",
        fontSize: "var(--fs-10)",
        fontWeight: 600,
        color: "var(--fg-muted)",
        background: "var(--bg-subtle)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-xs)",
        letterSpacing: "0.04em",
        textTransform: "uppercase",
      }}
    >
      <Lock size={10} strokeWidth={2} />
      Enterprise
    </span>
  );
}

function GatedRow({
  title,
  desc,
  checked,
  onChange,
  disabled,
}: {
  title: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled: boolean;
}) {
  return (
    <div
      className="demo-row"
      style={{
        gridTemplateColumns: "minmax(0, 1fr) auto auto",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <div className="demo-row__primary">
        <div className="demo-row__title">{title}</div>
        <div
          style={{
            fontSize: "var(--fs-10)",
            color: "var(--fg-subtle)",
            marginTop: 2,
          }}
        >
          {desc}
        </div>
      </div>
      <EnterpriseLock />
      <label className="demo-toggle" aria-label={title}>
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="demo-toggle__track" />
      </label>
    </div>
  );
}

function DropZone({ label, filled, onReplace }: { label: string; filled: boolean; onReplace: () => void }) {
  return (
    <div
      style={{
        border: `1.5px dashed ${filled ? "var(--border)" : "var(--border-strong)"}`,
        borderRadius: "var(--radius-md)",
        background: filled ? "var(--bg)" : "var(--bg-subtle)",
        padding: "var(--space-3)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--space-1h)",
        minHeight: 100,
      }}
    >
      {filled ? (
        <>
          <span
            aria-hidden="true"
            style={{
              width: 40,
              height: 20,
              background: "var(--fg)",
              color: "var(--bg)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: 11,
              borderRadius: "var(--radius-xs)",
            }}
          >
            Acme
          </span>
          <div style={{ fontSize: "var(--fs-10)", color: "var(--fg-subtle)" }}>{label}</div>
          <button type="button" className="demo-btn demo-btn--ghost" onClick={onReplace}>
            Replace
          </button>
        </>
      ) : (
        <>
          <Upload size={18} strokeWidth={1.6} style={{ color: "var(--fg-subtle)" }} />
          <div style={{ fontSize: "var(--fs-xs)", fontWeight: 600 }}>Drop {label}</div>
          <div style={{ fontSize: "var(--fs-10)", color: "var(--fg-subtle)" }}>
            PNG or SVG up to 1 MB
          </div>
        </>
      )}
    </div>
  );
}

function RadioCard({
  id,
  title,
  selected,
  onSelect,
  children,
}: {
  id: string;
  title: string;
  selected: boolean;
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-1h)",
        padding: "var(--space-2h)",
        background: selected ? "var(--bg-subtle)" : "var(--bg)",
        border: `1px solid ${selected ? "var(--accent)" : "var(--border)"}`,
        borderRadius: "var(--radius-md)",
        cursor: "pointer",
        textAlign: "left",
        boxShadow: selected ? "0 0 0 2px color-mix(in srgb, var(--accent) 18%, transparent)" : "none",
        transition: "box-shadow 0.12s, border-color 0.12s",
      }}
      aria-pressed={selected}
    >
      <div style={{ fontSize: "var(--fs-sm)", fontWeight: 600 }}>{title}</div>
      <div style={{ minHeight: 40 }}>{children}</div>
      <div
        style={{
          fontSize: "var(--fs-10)",
          color: "var(--fg-subtle)",
          fontFamily: "var(--font-mono)",
        }}
      >
        {id}
      </div>
    </button>
  );
}

export function CustomDomainPage() {
  const [accent, setAccent] = useState<string>(SWATCHES[1]!.color);
  const [customHex, setCustomHex] = useState<string>("");
  const [logoUploaded, setLogoUploaded] = useState(false);
  const [darkLogoUploaded, setDarkLogoUploaded] = useState(false);
  const [faviconUploaded, setFaviconUploaded] = useState(false);
  const [forceHttps, setForceHttps] = useState(true);
  const [wwwRedirect, setWwwRedirect] = useState(true);
  const [custom404, setCustom404] = useState(false);
  const [custom404Url, setCustom404Url] = useState("https://yourworkspace.com/404");
  const [hideBranding, setHideBranding] = useState(false);
  const [poweredBy, setPoweredBy] = useState(true);
  const [font, setFont] = useState<(typeof FONTS)[number]>("Inter");
  const [fromName, setFromName] = useState("Acme via Quanta <noreply@yourworkspace.com>");
  const [replyTo, setReplyTo] = useState("team@yourworkspace.com");
  const [emailFooter, setEmailFooter] = useState(
    "Acme, Inc. · 500 Market St, San Francisco · Unsubscribe",
  );
  const [primaryDomain, setPrimaryDomain] = useState("yourworkspace.com");
  const [heroText, setHeroText] = useState("Sign in to Acme");
  const [subhero, setSubhero] = useState("Use your work email to continue");
  const [bgMode, setBgMode] = useState<BgMode>("gradient");

  const effectiveAccent = customHex.trim() ? customHex : accent;
  const enterpriseAllowed = false;

  return (
    <div className="demo-app">
      <DemoAppHero
        kicker="Admin"
        title="Custom domain & branding"
        sub="Serve your workspace on your own domain. Match your brand with logo, colors, and email sender."
      />
      <div className="demo-app__body">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) 380px",
            gap: "var(--space-4)",
            alignItems: "start",
          }}
        >
          {/* Left column */}
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            {/* Section 1: Custom domain */}
            <div className="demo-block">
              <header className="demo-block__head">
                <div>
                  <div className="demo-block__title">Custom domain</div>
                  <div className="demo-block__sub">
                    Serve the workspace on your own hostname with a managed certificate.
                  </div>
                </div>
                <span className="demo-sectionbar__spacer" />
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "var(--space-1)",
                    fontSize: "var(--fs-10)",
                    color: "var(--fg-subtle)",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    fontWeight: 600,
                  }}
                >
                  <Globe size={11} strokeWidth={2} /> Served from{" "}
                  <code
                    style={{
                      fontFamily: "var(--font-mono)",
                      color: "var(--fg-muted)",
                      background: "var(--bg-subtle)",
                      padding: "1px var(--space-1)",
                      borderRadius: "var(--radius-xs)",
                    }}
                  >
                    app.quanta.dev
                  </code>
                </span>
              </header>
              <div className="demo-block__body" style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                <div className="demo-field">
                  <label className="demo-field__label">Primary domain</label>
                  <div style={{ display: "flex", gap: "var(--space-2)" }}>
                    <input
                      type="text"
                      className="demo-input"
                      value={primaryDomain}
                      onChange={(e) => setPrimaryDomain(e.target.value)}
                    />
                    <button type="button" className="demo-btn demo-btn--primary">
                      <ShieldCheck size={13} strokeWidth={1.8} /> Verify
                    </button>
                  </div>
                  <div className="demo-field__hint">
                    Add the DNS records below at your registrar; we check automatically every 5
                    minutes.
                  </div>
                </div>

                <table className="demo-table">
                  <thead>
                    <tr>
                      <th style={{ width: 80 }}>Type</th>
                      <th style={{ width: 160 }}>Name</th>
                      <th>Value</th>
                      <th style={{ width: 120 }}>Status</th>
                      <th style={{ width: 40 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {DNS_ROWS.map((r, i) => (
                      <tr key={i}>
                        <td>
                          <span
                            className="demo-badge"
                            style={{ fontFamily: "var(--font-mono)" }}
                          >
                            {r.type}
                          </span>
                        </td>
                        <td
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: 11,
                            color: "var(--fg)",
                          }}
                        >
                          {r.name}
                        </td>
                        <td
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: 11,
                            color: "var(--fg-muted)",
                            maxWidth: 280,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {r.value}
                        </td>
                        <td>
                          <StatusPill s={r.status} />
                        </td>
                        <td>
                          <CopyButton value={r.value} label="" variant="ghost" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "auto minmax(0, 1fr) auto",
                    gap: "var(--space-3)",
                    alignItems: "center",
                    padding: "var(--space-2h) var(--space-3)",
                    border: "1px solid var(--border-success-subtle)",
                    background: "var(--bg-success-subtle)",
                    borderRadius: "var(--radius-md)",
                  }}
                >
                  <span
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "var(--radius-md)",
                      background: "var(--bg)",
                      color: "var(--success)",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <ShieldCheck size={14} strokeWidth={1.8} />
                  </span>
                  <div>
                    <div style={{ fontSize: "var(--fs-sm)", fontWeight: 600 }}>
                      SSL certificate — Let's Encrypt (auto-renewed)
                    </div>
                    <div
                      style={{
                        fontSize: "var(--fs-xs)",
                        color: "var(--fg-muted)",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <Clock size={11} strokeWidth={1.8} /> Next renewal: Aug 14, 2026
                    </div>
                  </div>
                  <button type="button" className="demo-btn demo-btn--ghost">
                    <RefreshCw size={12} strokeWidth={1.8} /> Re-issue
                  </button>
                </div>

                <div className="demo-row" style={{ gridTemplateColumns: "minmax(0, 1fr) auto" }}>
                  <div className="demo-row__primary">
                    <div className="demo-row__title">Force HTTPS</div>
                    <div
                      style={{
                        fontSize: "var(--fs-10)",
                        color: "var(--fg-subtle)",
                        marginTop: 2,
                      }}
                    >
                      Redirect any http:// request to https:// with HSTS.
                    </div>
                  </div>
                  <label className="demo-toggle" aria-label="Force HTTPS">
                    <input
                      type="checkbox"
                      checked={forceHttps}
                      onChange={(e) => setForceHttps(e.target.checked)}
                    />
                    <span className="demo-toggle__track" />
                  </label>
                </div>

                <div className="demo-row" style={{ gridTemplateColumns: "minmax(0, 1fr) auto" }}>
                  <div className="demo-row__primary">
                    <div className="demo-row__title">Redirect www → root</div>
                    <div
                      style={{
                        fontSize: "var(--fs-10)",
                        color: "var(--fg-subtle)",
                        marginTop: 2,
                      }}
                    >
                      www.yourworkspace.com permanent-redirects to yourworkspace.com.
                    </div>
                  </div>
                  <label className="demo-toggle" aria-label="Redirect www to root">
                    <input
                      type="checkbox"
                      checked={wwwRedirect}
                      onChange={(e) => setWwwRedirect(e.target.checked)}
                    />
                    <span className="demo-toggle__track" />
                  </label>
                </div>

                <div
                  className="demo-row"
                  style={{ gridTemplateColumns: "minmax(0, 1fr) minmax(0, 320px) auto" }}
                >
                  <div className="demo-row__primary">
                    <div className="demo-row__title">Custom 404 page</div>
                    <div
                      style={{
                        fontSize: "var(--fs-10)",
                        color: "var(--fg-subtle)",
                        marginTop: 2,
                      }}
                    >
                      Redirect unknown routes to your own URL instead of our default page.
                    </div>
                  </div>
                  <input
                    type="url"
                    className="demo-input"
                    value={custom404Url}
                    onChange={(e) => setCustom404Url(e.target.value)}
                    disabled={!custom404}
                    style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}
                  />
                  <label className="demo-toggle" aria-label="Custom 404">
                    <input
                      type="checkbox"
                      checked={custom404}
                      onChange={(e) => setCustom404(e.target.checked)}
                    />
                    <span className="demo-toggle__track" />
                  </label>
                </div>
              </div>
            </div>

            {/* Section 2: Branding */}
            <div className="demo-block">
              <header className="demo-block__head">
                <div>
                  <div className="demo-block__title">Branding</div>
                  <div className="demo-block__sub">
                    Logo, accent color, typography, and email sender identity.
                  </div>
                </div>
                <span className="demo-sectionbar__spacer" />
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "var(--space-1)",
                    fontSize: "var(--fs-10)",
                    color: "var(--fg-subtle)",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    fontWeight: 600,
                  }}
                >
                  <Paintbrush size={11} strokeWidth={2} /> Applies workspace-wide
                </span>
              </header>
              <div
                className="demo-block__body"
                style={{ display: "flex", flexDirection: "column", gap: "var(--space-3h)" }}
              >
                {/* Logo upload */}
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
                    Logo
                  </div>
                  <div className="demo-grid-2">
                    <div>
                      <div
                        style={{
                          fontSize: "var(--fs-xs)",
                          fontWeight: 600,
                          marginBottom: "var(--space-1)",
                        }}
                      >
                        Light background
                      </div>
                      <DropZone
                        label="light-mode logo"
                        filled={logoUploaded}
                        onReplace={() => setLogoUploaded(false)}
                      />
                      {!logoUploaded && (
                        <button
                          type="button"
                          className="demo-btn demo-btn--ghost"
                          onClick={() => setLogoUploaded(true)}
                          style={{ marginTop: "var(--space-1h)" }}
                        >
                          Upload sample
                        </button>
                      )}
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: "var(--fs-xs)",
                          fontWeight: 600,
                          marginBottom: "var(--space-1)",
                        }}
                      >
                        Dark background
                      </div>
                      <DropZone
                        label="dark-mode logo"
                        filled={darkLogoUploaded}
                        onReplace={() => setDarkLogoUploaded(false)}
                      />
                      {!darkLogoUploaded && (
                        <button
                          type="button"
                          className="demo-btn demo-btn--ghost"
                          onClick={() => setDarkLogoUploaded(true)}
                          style={{ marginTop: "var(--space-1h)" }}
                        >
                          Upload sample
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Favicon */}
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
                    Favicon
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "140px minmax(0, 1fr)",
                      gap: "var(--space-3)",
                      alignItems: "center",
                    }}
                  >
                    <DropZone
                      label="32×32 ico"
                      filled={faviconUploaded}
                      onReplace={() => setFaviconUploaded(false)}
                    />
                    <div>
                      <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", lineHeight: "var(--lh-relaxed)" }}>
                        Browsers show this in tabs and bookmarks. We auto-generate the Apple touch
                        icon and maskable PWA icon from whatever you upload.
                      </div>
                      {!faviconUploaded && (
                        <button
                          type="button"
                          className="demo-btn demo-btn--ghost"
                          onClick={() => setFaviconUploaded(true)}
                          style={{ marginTop: "var(--space-1h)" }}
                        >
                          Upload favicon
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Accent color */}
                <div>
                  <div
                    style={{
                      fontSize: "var(--fs-10)",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      fontWeight: 700,
                      color: "var(--fg-subtle)",
                      marginBottom: "var(--space-1h)",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Palette size={11} strokeWidth={2} /> Primary accent
                  </div>
                  <div style={{ display: "flex", gap: "var(--space-1h)", flexWrap: "wrap", alignItems: "center" }}>
                    {SWATCHES.map((s) => {
                      const isSel = !customHex && accent === s.color;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            setAccent(s.color);
                            setCustomHex("");
                          }}
                          aria-label={s.name}
                          title={s.name}
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: "50%",
                            background: s.color,
                            border: isSel ? "2px solid var(--fg)" : "2px solid transparent",
                            boxShadow: isSel ? "0 0 0 2px var(--bg)" : "none",
                            cursor: "pointer",
                            padding: 0,
                          }}
                        />
                      );
                    })}
                    <div
                      className="demo-field"
                      style={{ width: 140, marginLeft: "var(--space-2)" }}
                    >
                      <input
                        type="text"
                        className="demo-input"
                        value={customHex}
                        onChange={(e) => setCustomHex(e.target.value)}
                        placeholder="#4f46e5"
                        style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}
                      />
                    </div>
                    <span
                      aria-hidden="true"
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: "var(--radius-sm)",
                        background: effectiveAccent,
                        border: "1px solid var(--border)",
                      }}
                      title="Preview"
                    />
                  </div>
                </div>

                {/* Font */}
                <div
                  className="demo-field"
                  style={{ maxWidth: 320, flexDirection: "row", alignItems: "center", gap: "var(--space-2)" }}
                >
                  <label
                    className="demo-field__label"
                    style={{ flex: "0 0 auto", minWidth: 80 }}
                  >
                    Font
                  </label>
                  <select
                    className="demo-select"
                    value={font}
                    onChange={(e) => setFont(e.target.value as (typeof FONTS)[number])}
                  >
                    {FONTS.map((f) => (
                      <option key={f}>{f}</option>
                    ))}
                  </select>
                </div>

                {/* Email sender */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
                    gap: "var(--space-2h)",
                  }}
                >
                  <div className="demo-field">
                    <label className="demo-field__label">From name</label>
                    <input
                      type="text"
                      className="demo-input"
                      value={fromName}
                      onChange={(e) => setFromName(e.target.value)}
                      style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}
                    />
                  </div>
                  <div className="demo-field">
                    <label className="demo-field__label">Reply-to email</label>
                    <input
                      type="email"
                      className="demo-input"
                      value={replyTo}
                      onChange={(e) => setReplyTo(e.target.value)}
                      style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}
                    />
                  </div>
                </div>

                {/* Email footer */}
                <div className="demo-field">
                  <label className="demo-field__label">Email footer (Markdown)</label>
                  <textarea
                    className="demo-textarea"
                    value={emailFooter}
                    onChange={(e) => setEmailFooter(e.target.value)}
                    style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}
                  />
                </div>

                {/* Hide branding — gated */}
                <GatedRow
                  title="Hide Quanta branding from emails & login"
                  desc="Removes 'Powered by Quanta' everywhere. Requires Enterprise."
                  checked={hideBranding}
                  onChange={setHideBranding}
                  disabled={!enterpriseAllowed}
                />
              </div>
            </div>

            {/* Section 3: SSO login screen */}
            <div className="demo-block">
              <header className="demo-block__head">
                <div>
                  <div className="demo-block__title">SSO login screen</div>
                  <div className="demo-block__sub">
                    What members see at <code style={{ fontFamily: "var(--font-mono)" }}>login.{primaryDomain}</code>.
                  </div>
                </div>
              </header>
              <div
                className="demo-block__body"
                style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
                    gap: "var(--space-2h)",
                  }}
                >
                  <div className="demo-field">
                    <label className="demo-field__label">Hero text</label>
                    <input
                      type="text"
                      className="demo-input"
                      value={heroText}
                      onChange={(e) => setHeroText(e.target.value)}
                    />
                  </div>
                  <div className="demo-field">
                    <label className="demo-field__label">Sub-hero</label>
                    <input
                      type="text"
                      className="demo-input"
                      value={subhero}
                      onChange={(e) => setSubhero(e.target.value)}
                    />
                  </div>
                </div>

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
                    Background
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                      gap: "var(--space-2)",
                    }}
                  >
                    <RadioCard
                      id="solid"
                      title="Solid color"
                      selected={bgMode === "solid"}
                      onSelect={() => setBgMode("solid")}
                    >
                      <div
                        style={{
                          height: 40,
                          background: effectiveAccent,
                          borderRadius: "var(--radius-sm)",
                        }}
                      />
                    </RadioCard>
                    <RadioCard
                      id="gradient"
                      title="Gradient"
                      selected={bgMode === "gradient"}
                      onSelect={() => setBgMode("gradient")}
                    >
                      <div
                        style={{
                          height: 40,
                          background: `linear-gradient(135deg, ${effectiveAccent} 0%, color-mix(in srgb, ${effectiveAccent} 40%, #000) 100%)`,
                          borderRadius: "var(--radius-sm)",
                        }}
                      />
                    </RadioCard>
                    <RadioCard
                      id="image"
                      title="Image"
                      selected={bgMode === "image"}
                      onSelect={() => setBgMode("image")}
                    >
                      <div
                        style={{
                          height: 40,
                          background:
                            "repeating-linear-gradient(45deg, var(--bg-subtle), var(--bg-subtle) 6px, var(--bg-muted) 6px, var(--bg-muted) 12px)",
                          borderRadius: "var(--radius-sm)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Upload size={14} strokeWidth={1.8} style={{ color: "var(--fg-subtle)" }} />
                      </div>
                    </RadioCard>
                  </div>
                </div>

                <GatedRow
                  title={`Show "powered by Quanta" on login`}
                  desc="Required on Team plans; optional on Enterprise."
                  checked={poweredBy}
                  onChange={setPoweredBy}
                  disabled={!enterpriseAllowed}
                />
              </div>
            </div>

            {/* Save bar */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-2)",
                padding: "var(--space-3) var(--space-4)",
                background: "var(--bg-subtle)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
              }}
            >
              <span
                style={{
                  fontSize: "var(--fs-xs)",
                  color: "var(--fg-muted)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Link2 size={12} strokeWidth={1.8} />
                Changes propagate in ~1 minute via the edge cache.
              </span>
              <span className="demo-sectionbar__spacer" />
              <button type="button" className="demo-btn demo-btn--ghost">
                Discard
              </button>
              <button type="button" className="demo-btn demo-btn--primary">
                <Check size={13} strokeWidth={1.8} /> Save changes
              </button>
            </div>
          </div>

          {/* Right column: live preview */}
          <LivePreview
            accent={effectiveAccent}
            logoUploaded={logoUploaded}
            forceHttps={forceHttps}
            wwwRedirect={wwwRedirect}
            hideBranding={hideBranding && enterpriseAllowed}
            fromName={fromName}
            font={font}
            heroText={heroText}
            subhero={subhero}
            bgMode={bgMode}
          />
        </div>
      </div>
    </div>
  );
}
