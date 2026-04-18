import { useState } from "react";
import type { CSSProperties } from "react";
import {
  Apple,
  Monitor,
  Laptop,
  Download,
  Check,
  Shield,
  Zap,
  HardDrive,
  ExternalLink,
  ArrowRight,
  Terminal,
  Package,
} from "lucide-react";
import { DemoAppHero } from "../../internal/DemoAppHero";
import { Sparkline } from "../../internal/Sparkline";
import { StatCard } from "../../internal/StatCard";
import { useDemoNav } from "../../DemoPage";

type Platform = "macOS" | "Windows" | "Linux";
type MacArch = "arm64" | "x64";
type WinArch = "x64" | "arm64";
type LinuxPkg = ".deb" | ".rpm" | "AppImage" | "snap" | "flatpak";

const PLATFORMS: Platform[] = ["macOS", "Windows", "Linux"];
const LINUX_PKGS: LinuxPkg[] = [".deb", ".rpm", "AppImage", "snap", "flatpak"];

const VERSION = "0.12.4";
const SHA_MAC_ARM = "a1b2c3d4e5f6071829304a5b6c7d8e9f0a1b2c3d4e5f6071829304a5b6c7d8e9";
const SHA_MAC_X64 = "ff117a8e21d4b4c9a7e6b19c5d1a2f83b7c4e0a5d6e9f0b1c2d3e4f5a6b7c8d9";
const SHA_WIN_X64 = "1c2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e";
const SHA_WIN_ARM = "aa11bb22cc33dd44ee55ff6677889900aabbccddeeff1122334455667788a9b0";

const downloadsSeries = [0.28, 0.36, 0.4, 0.48, 0.44, 0.62, 0.78, 0.72, 0.84, 0.92, 0.88, 0.96, 1.0, 0.94];

interface Release {
  date: string;
  version: string;
  badge?: "latest" | "beta";
  bullets: string[];
}

const RELEASES: Release[] = [
  {
    date: "Apr 18, 2026",
    version: "0.12.4",
    badge: "latest",
    bullets: [
      "Canvas minimap ships · pan-and-zoom hotspots for recent violations.",
      "Agent memory now survives app restarts · no more re-introducing yourself.",
    ],
  },
  {
    date: "Apr 08, 2026",
    version: "0.12.3",
    bullets: [
      "SCIM provisioning GA · Okta, Azure AD, and Google Workspace.",
      "Policy DSL preview · typed predicates behind a feature flag.",
    ],
  },
  {
    date: "Mar 28, 2026",
    version: "0.12.2",
    bullets: [
      "Multi-file canvas · pan across a repo like a map.",
      "60 fps Code Universe · GPU tile cache with delta invalidation.",
    ],
  },
];

interface MdmBullet {
  title: string;
  blurb: string;
}

const MDM_BULLETS: MdmBullet[] = [
  {
    title: "MDM config · JAMF / Intune",
    blurb: "Pre-configure SSO, update channel, and allowed models. Policies push at login, not at first launch.",
  },
  {
    title: "Silent install flags",
    blurb: "`/quiet /norestart /channel=stable` on Windows · `--silent --accept-license` on deb/rpm builds.",
  },
  {
    title: "Offline bundle",
    blurb: "Air-gapped organizations can mirror releases from a signed S3 prefix. No telemetry to quanta.dev required.",
  },
];

function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="demo-billing-toggle"
      style={{ marginBottom: 0 }}
    >
      {options.map((o) => (
        <button
          key={o}
          type="button"
          role="radio"
          aria-checked={value === o}
          className={value === o ? "is-active" : ""}
          onClick={() => onChange(o)}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function CodeBlock({ cmd, hint }: { cmd: string; hint?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
      {hint && (
        <span
          style={{
            fontSize: "var(--fs-10)",
            color: "var(--fg-subtle)",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            fontWeight: "var(--fw-semibold)",
          }}
        >
          {hint}
        </span>
      )}
      <pre
        className="demo-code"
        style={{
          margin: 0,
          display: "flex",
          alignItems: "center",
          gap: "var(--space-2)",
          padding: "var(--space-2) var(--space-2h)",
        }}
      >
        <span aria-hidden="true" style={{ color: "var(--accent)", userSelect: "none" }}>
          $
        </span>
        <span style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{cmd}</span>
      </pre>
    </div>
  );
}

interface DownloadCardProps {
  filename: string;
  sha: string;
  platformLabel: string;
  signed: string;
  icon: typeof Apple;
}

function DownloadCard({ filename, sha, platformLabel, signed, icon: Icon }: DownloadCardProps) {
  return (
    <div
      style={{
        border: "1px solid var(--border-strong)",
        borderRadius: "var(--radius-lg)",
        background: "linear-gradient(180deg, var(--bg-accent-subtle), var(--bg) 65%)",
        padding: "var(--space-5)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2h)" }}>
        <span
          aria-hidden="true"
          style={{
            width: 36,
            height: 36,
            borderRadius: "var(--radius-md)",
            background: "var(--bg)",
            border: "1px solid var(--border)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--accent)",
          }}
        >
          <Icon size={18} strokeWidth={1.8} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "var(--fs-md)", fontWeight: "var(--fw-semibold)" }}>
            Download for {platformLabel}
          </div>
          <div style={{ fontSize: "var(--fs-10)", color: "var(--fg-subtle)", marginTop: 2 }}>
            Quanta {VERSION} · released Apr 18, 2026
          </div>
        </div>
        <span className="demo-badge demo-badge--accent">
          <Zap size={10} strokeWidth={2.4} aria-hidden="true" /> Recommended
        </span>
      </div>

      <button
        type="button"
        className="demo-btn demo-btn--primary"
        style={{
          marginTop: "var(--space-4)",
          width: "100%",
          height: 52,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "var(--space-2)",
          fontSize: "var(--fs-md)",
          fontWeight: "var(--fw-semibold)",
          letterSpacing: "-0.005em",
        }}
      >
        <Download size={16} strokeWidth={2} aria-hidden="true" />
        {filename}
      </button>

      <div
        style={{
          marginTop: "var(--space-3)",
          display: "flex",
          flexWrap: "wrap",
          gap: "var(--space-2) var(--space-4)",
          fontSize: "var(--fs-10)",
          color: "var(--fg-subtle)",
          alignItems: "center",
          letterSpacing: "0.04em",
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <Shield size={11} strokeWidth={2} aria-hidden="true" /> {signed}
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            minWidth: 0,
            flex: 1,
          }}
          title={sha}
        >
          SHA-256 {sha.slice(0, 10)}…{sha.slice(-6)}
        </span>
      </div>
    </div>
  );
}

function RequirementsCard({ rows }: { rows: [string, string][] }) {
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        background: "var(--bg)",
        padding: "var(--space-4)",
      }}
    >
      <div
        style={{
          fontSize: "var(--fs-10)",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          fontWeight: "var(--fw-bold)",
          color: "var(--fg-subtle)",
          marginBottom: "var(--space-2)",
        }}
      >
        System requirements
      </div>
      <dl className="demo-kv" style={{ margin: 0 }}>
        {rows.flatMap(([k, v]) => [
          <div className="demo-kv__k" key={`k-${k}`}>
            {k}
          </div>,
          <div className="demo-kv__v" key={`v-${k}`} style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-xs)" }}>
            {v}
          </div>,
        ])}
      </dl>
    </div>
  );
}

function MacPanel() {
  const [arch, setArch] = useState<MacArch>("arm64");
  const filename = `Quanta-${VERSION}-${arch}.dmg`;
  const sha = arch === "arm64" ? SHA_MAC_ARM : SHA_MAC_X64;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "var(--space-4)", marginTop: "var(--space-4)" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2h)",
            paddingBottom: "var(--space-1h)",
          }}
        >
          <span
            style={{
              fontSize: "var(--fs-10)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--fg-subtle)",
              fontWeight: "var(--fw-semibold)",
            }}
          >
            Architecture
          </span>
          <Segmented
            options={["arm64", "x64"] as const}
            value={arch}
            onChange={setArch}
            label="macOS architecture"
          />
          <span style={{ fontSize: "var(--fs-10)", color: "var(--fg-subtle)" }}>
            Apple Silicon · Intel
          </span>
        </div>

        <DownloadCard
          filename={filename}
          sha={sha}
          platformLabel={arch === "arm64" ? "Apple Silicon" : "Intel Mac"}
          signed="Signed & notarized · Developer ID: Quanta Systems Inc (KZ7M4X8T3R)"
          icon={Apple}
        />

        <div>
          <div
            style={{
              fontSize: "var(--fs-10)",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              fontWeight: "var(--fw-bold)",
              color: "var(--fg-subtle)",
              marginBottom: "var(--space-1h)",
            }}
          >
            Or via Homebrew
          </div>
          <CodeBlock cmd="brew install --cask quanta" />
        </div>
      </div>

      <RequirementsCard
        rows={[
          ["Operating system", "macOS 13 Ventura or later"],
          ["CPU", "Apple Silicon (M-series) or Intel x86-64"],
          ["Memory", "4 GB RAM (8 GB recommended)"],
          ["Disk", "500 MB free"],
          ["Code Universe", "Metal-compatible GPU"],
          ["Network", "Optional · fully offline-capable"],
        ]}
      />
    </div>
  );
}

function WindowsPanel() {
  const [arch, setArch] = useState<WinArch>("x64");
  const filename = `Quanta-${VERSION}-${arch}.msi`;
  const sha = arch === "x64" ? SHA_WIN_X64 : SHA_WIN_ARM;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "var(--space-4)", marginTop: "var(--space-4)" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2h)",
            paddingBottom: "var(--space-1h)",
          }}
        >
          <span
            style={{
              fontSize: "var(--fs-10)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--fg-subtle)",
              fontWeight: "var(--fw-semibold)",
            }}
          >
            Architecture
          </span>
          <Segmented
            options={["x64", "arm64"] as const}
            value={arch}
            onChange={setArch}
            label="Windows architecture"
          />
          <span style={{ fontSize: "var(--fs-10)", color: "var(--fg-subtle)" }}>
            Intel / AMD · Snapdragon X
          </span>
        </div>

        <DownloadCard
          filename={filename}
          sha={sha}
          platformLabel={arch === "x64" ? "Windows x64" : "Windows arm64"}
          signed="Signed by EV cert · DigiCert CA · verified Microsoft SmartScreen"
          icon={Monitor}
        />

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <CodeBlock cmd="winget install quanta" hint="Windows Package Manager" />
          <CodeBlock cmd="scoop install quanta" hint="Scoop (alternative)" />
        </div>
      </div>

      <RequirementsCard
        rows={[
          ["Operating system", "Windows 11 or Windows Server 2022"],
          ["CPU", "x86-64 (SSE4.2) or ARM64"],
          ["Memory", "4 GB RAM (8 GB recommended)"],
          ["Disk", "500 MB free"],
          ["Code Universe", "DirectX 12 GPU"],
          ["Defender", "Passes SmartScreen on first run"],
        ]}
      />
    </div>
  );
}

function LinuxPanel() {
  const [pkg, setPkg] = useState<LinuxPkg>(".deb");

  const filename =
    pkg === ".deb"     ? `quanta_${VERSION}_amd64.deb`
  : pkg === ".rpm"     ? `quanta-${VERSION}-1.x86_64.rpm`
  : pkg === "AppImage" ? `Quanta-${VERSION}-x86_64.AppImage`
  : pkg === "snap"     ? `quanta_${VERSION}_amd64.snap`
  :                       `dev.quanta.Quanta-${VERSION}.flatpak`;

  const cmd =
    pkg === ".deb"     ? "sudo apt install ./quanta.deb"
  : pkg === ".rpm"     ? "sudo dnf install ./quanta.rpm"
  : pkg === "AppImage" ? "chmod +x Quanta-0.12.4-x86_64.AppImage && ./Quanta-0.12.4-x86_64.AppImage"
  : pkg === "snap"     ? "sudo snap install quanta"
  :                       "flatpak install flathub dev.quanta.Quanta";

  const hint =
    pkg === ".deb"     ? "apt · Debian, Ubuntu"
  : pkg === ".rpm"     ? "dnf · Fedora, RHEL, openSUSE"
  : pkg === "AppImage" ? "Portable · no install"
  : pkg === "snap"     ? "snap · Ubuntu"
  :                       "flatpak · Flathub";

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "var(--space-4)", marginTop: "var(--space-4)" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2h)",
            paddingBottom: "var(--space-1h)",
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontSize: "var(--fs-10)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--fg-subtle)",
              fontWeight: "var(--fw-semibold)",
            }}
          >
            Distribution
          </span>
          <Segmented
            options={LINUX_PKGS}
            value={pkg}
            onChange={setPkg}
            label="Linux package"
          />
        </div>

        <DownloadCard
          filename={filename}
          sha="4d3c2b1a0f9e8d7c6b5a49382716054f3e2d1c0b9a887766554433221100ffee"
          platformLabel={`Linux · ${pkg}`}
          signed="Signed with GPG key 0x4F2A 9CB1 · releases.quanta.dev/keyring.asc"
          icon={Laptop}
        />

        <CodeBlock cmd={cmd} hint={hint} />
      </div>

      <RequirementsCard
        rows={[
          ["Distro family", "Debian, Ubuntu, Fedora, RHEL, Arch"],
          ["CPU", "x86-64 or aarch64"],
          ["Memory", "4 GB RAM (8 GB recommended)"],
          ["Disk", "500 MB free"],
          ["Display", "Wayland or X11 · Vulkan for GPU canvas"],
          ["libc", "glibc 2.35+ · musl not supported"],
        ]}
      />
    </div>
  );
}

const CALLOUT_STYLE: CSSProperties = {
  marginTop: "var(--space-5)",
  padding: "var(--space-3) var(--space-4)",
  background: "var(--bg-subtle)",
  borderRadius: "var(--radius-md)",
  border: "1px dashed var(--border)",
  display: "flex",
  alignItems: "center",
  gap: "var(--space-2)",
  fontSize: "var(--fs-xs)",
  color: "var(--fg-muted)",
};

export function DesktopClientPage() {
  const [platform, setPlatform] = useState<Platform>("macOS");
  const { navigate } = useDemoNav();

  return (
    <div className="demo-app">
      <DemoAppHero
        kicker="Distribution"
        title="Quanta desktop"
        sub="Native client for macOS, Windows, and Linux. 60 fps Code Universe, offline analysis, and system-tray agent shortcuts."
      />
      <div className="demo-app__body">
        {/* Version stats row */}
        <div className="demo-grid-3" style={{ marginBottom: "var(--space-4)" }}>
          <StatCard
            label="Current release"
            value={VERSION}
            icon={<Download size={12} strokeWidth={1.8} />}
            delta="+1,248 downloads / day"
            deltaTone="up"
            chart={<Sparkline values={downloadsSeries} color="var(--accent)" height={36} />}
          />
          <StatCard
            label="System size"
            value="120 MB"
            icon={<HardDrive size={12} strokeWidth={1.8} />}
            delta="8 MB smaller than 0.12.3"
            deltaTone="up"
          />
          <StatCard
            label="Auto-update"
            value="Enabled"
            icon={<Zap size={12} strokeWidth={1.8} />}
            delta="Stable channel"
            deltaTone="neutral"
            chart={
              <label
                className="demo-toggle"
                style={{ marginTop: 4 }}
                aria-label="Auto-update"
              >
                <input type="checkbox" defaultChecked />
                <span className="demo-toggle__track" />
              </label>
            }
          />
        </div>

        {/* Platform tabs */}
        <div className="demo-sectionbar">
          <span className="demo-sectionbar__title">Pick your platform</span>
          <span className="demo-sectionbar__spacer" />
          <div
            className="demo-billing-toggle"
            role="tablist"
            aria-label="Operating system"
            style={{ marginBottom: 0 }}
          >
            {PLATFORMS.map((p) => (
              <button
                key={p}
                type="button"
                role="tab"
                aria-selected={platform === p}
                className={platform === p ? "is-active" : ""}
                onClick={() => setPlatform(p)}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Per-platform panel */}
        <div style={{ marginBottom: "var(--space-5)" }}>
          {platform === "macOS" && <MacPanel />}
          {platform === "Windows" && <WindowsPanel />}
          {platform === "Linux" && <LinuxPanel />}
        </div>

        {/* Release notes */}
        <div className="demo-block">
          <header className="demo-block__head">
            <div>
              <div className="demo-block__title">Release notes</div>
              <div className="demo-block__sub">
                The three most recent releases · updates every ~2 weeks
              </div>
            </div>
            <span className="demo-sectionbar__spacer" />
            <button
              type="button"
              className="demo-btn demo-btn--ghost"
              onClick={() => navigate("updates.changelog")}
              style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
            >
              Full changelog <ArrowRight size={12} strokeWidth={2} aria-hidden="true" />
            </button>
          </header>
          <div className="demo-block__body demo-block__body--flush">
            {RELEASES.map((r) => (
              <div
                key={r.version}
                className="demo-row"
                style={{
                  gridTemplateColumns: "110px auto minmax(0, 1fr)",
                  alignItems: "flex-start",
                  padding: "var(--space-3) var(--space-4)",
                }}
              >
                <span
                  style={{
                    fontSize: "var(--fs-10)",
                    color: "var(--fg-subtle)",
                    fontFamily: "var(--font-mono)",
                    letterSpacing: "0.04em",
                    paddingTop: 2,
                  }}
                >
                  {r.date}
                </span>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-1h)",
                    minWidth: 120,
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "var(--fs-xs)",
                      fontWeight: "var(--fw-semibold)",
                      color: "var(--fg)",
                    }}
                  >
                    v{r.version}
                  </span>
                  {r.badge === "latest" && <span className="demo-badge demo-badge--success">Latest</span>}
                  {r.badge === "beta" && <span className="demo-badge demo-badge--accent">Beta</span>}
                </div>
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: "var(--space-4)",
                    fontSize: "var(--fs-xs)",
                    color: "var(--fg-muted)",
                    lineHeight: "var(--lh-relaxed)",
                    listStyle: "disc",
                  }}
                >
                  {r.bullets.map((b) => (
                    <li key={b} style={{ marginBottom: 2 }}>
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Enterprise deployment */}
        <div className="demo-block">
          <header className="demo-block__head">
            <div>
              <div className="demo-block__title">For IT admins</div>
              <div className="demo-block__sub">
                Rollout to hundreds of seats with zero end-user interaction
              </div>
            </div>
            <span className="demo-sectionbar__spacer" />
            <button type="button" className="demo-btn demo-btn--primary">
              <Download size={13} strokeWidth={1.8} aria-hidden="true" /> MDM profile
            </button>
          </header>
          <div className="demo-block__body">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: "var(--space-3)",
              }}
            >
              {MDM_BULLETS.map((b, idx) => {
                const Ic = idx === 0 ? Shield : idx === 1 ? Terminal : Package;
                return (
                  <div
                    key={b.title}
                    style={{
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-md)",
                      padding: "var(--space-3)",
                      background: "var(--bg)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "var(--space-1h)",
                        marginBottom: "var(--space-1h)",
                      }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: "var(--radius-sm)",
                          background: "var(--bg-subtle)",
                          color: "var(--fg-muted)",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Ic size={12} strokeWidth={1.8} />
                      </span>
                      <span style={{ fontSize: "var(--fs-xs)", fontWeight: "var(--fw-semibold)" }}>
                        {b.title}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: "var(--fs-10)",
                        color: "var(--fg-muted)",
                        lineHeight: "var(--lh-relaxed)",
                      }}
                    >
                      {b.blurb}
                    </div>
                  </div>
                );
              })}
            </div>

            <div
              style={{
                marginTop: "var(--space-3)",
                display: "flex",
                flexWrap: "wrap",
                gap: "var(--space-1h)",
                fontSize: "var(--fs-10)",
                color: "var(--fg-subtle)",
                letterSpacing: "0.04em",
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <Check size={11} strokeWidth={2.2} style={{ color: "var(--success)" }} aria-hidden="true" />
                SAML 2.0 / OIDC SSO
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <Check size={11} strokeWidth={2.2} style={{ color: "var(--success)" }} aria-hidden="true" />
                SCIM 2.0 provisioning
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <Check size={11} strokeWidth={2.2} style={{ color: "var(--success)" }} aria-hidden="true" />
                FIPS 140-3 crypto optional
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <Check size={11} strokeWidth={2.2} style={{ color: "var(--success)" }} aria-hidden="true" />
                Air-gapped install supported
              </span>
            </div>
          </div>
        </div>

        {/* Web fallback callout */}
        <div style={CALLOUT_STYLE}>
          <ExternalLink size={13} strokeWidth={1.8} aria-hidden="true" style={{ color: "var(--fg-subtle)" }} />
          <span>
            Prefer the web app? Go to{" "}
            <span style={{ color: "var(--accent)", fontFamily: "var(--font-mono)" }}>
              app.quanta.dev
            </span>
            . Same Code Universe, same agent — no install needed.
          </span>
        </div>
      </div>
    </div>
  );
}
