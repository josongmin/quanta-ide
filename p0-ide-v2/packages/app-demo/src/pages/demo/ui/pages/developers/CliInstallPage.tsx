import { useState } from "react";
import {
  Terminal,
  Package,
  Download,
  Boxes,
  Copy,
  Check,
  Rocket,
  ArrowRight,
  FileCode,
  Zap,
} from "lucide-react";
import { DemoAppHero } from "../../internal/DemoAppHero";
import { useDemoNav } from "../../DemoPage";

type Platform = "macOS" | "Linux" | "Windows";

const PLATFORMS: Platform[] = ["macOS", "Linux", "Windows"];

const PRIMARY_COMMAND: Record<Platform, { cmd: string; manager: string }> = {
  macOS:   { cmd: "brew install quanta-dev/tap/quanta",             manager: "Homebrew" },
  Linux:   { cmd: "curl -fsSL https://get.quanta.dev/cli.sh | sh",  manager: "install script" },
  Windows: { cmd: "scoop install quanta",                           manager: "Scoop" },
};

const ARCH_DOWNLOAD: Record<Platform, string> = {
  macOS:   "quanta-0.12.4-darwin-arm64.tar.gz",
  Linux:   "quanta-0.12.4-linux-x86_64.tar.gz",
  Windows: "quanta-0.12.4-windows-x86_64.zip",
};

type Alt = {
  id: string;
  name: string;
  icon: typeof Package;
  blurb: string;
  cmd: (p: Platform) => string;
};

const ALTS: Alt[] = [
  {
    id: "npm",
    name: "npm (Node 18+)",
    icon: Package,
    blurb: "Pulls a standalone binary shim. Handy in CI where Node is already installed.",
    cmd: () => "npm install -g @quanta/cli",
  },
  {
    id: "download",
    name: "Direct download",
    icon: Download,
    blurb: "Unsigned binary, no package manager. Verify the SHA-256 from releases.quanta.dev.",
    cmd: (p) => `curl -LO https://releases.quanta.dev/v0.12.4/${ARCH_DOWNLOAD[p]}`,
  },
  {
    id: "docker",
    name: "Docker image",
    icon: Boxes,
    blurb: "Runs in a sealed container. Ships with every engine preloaded (≈ 180 MB).",
    cmd: () => "docker run --rm -v $PWD:/src quanta/cli:0.12.4 run risk /src",
  },
];

function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);

  const onCopy = () => {
    void navigator.clipboard?.writeText(value).catch(() => {});
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      type="button"
      onClick={onCopy}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      aria-live="polite"
      aria-label={copied ? "Copied" : `Copy ${label.toLowerCase()}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--space-1h)",
        padding: "var(--space-1) var(--space-2h)",
        height: 26,
        border: `1px solid ${copied ? "var(--success)" : hover ? "var(--border-strong)" : "var(--border)"}`,
        borderRadius: "var(--radius-sm)",
        background: copied
          ? "var(--bg-success-subtle)"
          : hover
          ? "var(--bg-hover)"
          : "var(--bg)",
        color: copied ? "var(--success)" : "var(--fg)",
        fontSize: "var(--fs-10)",
        fontFamily: "var(--font-mono)",
        fontWeight: "var(--fw-semibold)",
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        cursor: "pointer",
        outline: focus ? "2px solid var(--accent)" : "none",
        outlineOffset: 2,
        transition: "background 0.14s ease, color 0.14s ease, border-color 0.14s ease",
      }}
    >
      {copied ? <Check size={11} strokeWidth={2.4} /> : <Copy size={11} strokeWidth={2} />}
      {copied ? "Copied" : label}
    </button>
  );
}

function NextStepTile({
  icon: Icon,
  kicker,
  title,
  blurb,
  onClick,
}: {
  icon: typeof Rocket;
  kicker: string;
  title: string;
  blurb: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className="demo-catalog__card" onClick={onClick}>
      <div className="demo-catalog__card-head">
        <span className="demo-catalog__card-icon">
          <Icon size={16} strokeWidth={1.8} aria-hidden="true" />
        </span>
        <span className="demo-catalog__card-cat">{kicker}</span>
        <span style={{ marginLeft: "auto", color: "var(--fg-subtle)" }}>
          <ArrowRight size={14} strokeWidth={1.8} aria-hidden="true" />
        </span>
      </div>
      <div className="demo-catalog__card-title">{title}</div>
      <div className="demo-catalog__card-blurb">{blurb}</div>
    </button>
  );
}

export function CliInstallPage() {
  const [platform, setPlatform] = useState<Platform>("macOS");
  const { navigate } = useDemoNav();

  const primary = PRIMARY_COMMAND[platform];

  return (
    <div className="demo-app">
      <DemoAppHero
        kicker="Developers"
        title="Install the Quanta CLI"
        sub="A single command to run analyses, ship policies, and talk to the engine from your terminal. Takes 30 seconds."
      />
      <div className="demo-app__body">
        {/* Platform tabs */}
        <div className="demo-sectionbar">
          <span className="demo-sectionbar__title">Step 1 · Pick your platform</span>
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

        {/* Primary install card */}
        <section
          style={{
            position: "relative",
            border: "1px solid var(--border-strong)",
            borderRadius: "var(--radius-lg)",
            background:
              "linear-gradient(180deg, var(--bg-accent-subtle), var(--bg) 60%)",
            padding: "var(--space-5)",
            marginBottom: "var(--space-5)",
            overflow: "hidden",
          }}
          aria-labelledby="primary-install-heading"
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-2)",
              marginBottom: "var(--space-2h)",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 28,
                height: 28,
                borderRadius: "var(--radius-md)",
                background: "var(--bg)",
                border: "1px solid var(--border)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--accent)",
              }}
            >
              <Terminal size={15} strokeWidth={2} />
            </span>
            <h2
              id="primary-install-heading"
              style={{
                margin: 0,
                fontSize: "var(--fs-md)",
                fontWeight: "var(--fw-semibold)",
                letterSpacing: "-0.005em",
              }}
            >
              Recommended · {primary.manager} on {platform}
            </h2>
            <span
              className="demo-badge demo-badge--accent"
              style={{ marginLeft: "var(--space-2)" }}
            >
              <Zap size={10} strokeWidth={2.4} aria-hidden="true" />
              Fastest
            </span>
          </div>

          <div
            style={{
              position: "relative",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              background: "var(--bg)",
              padding: "var(--space-4) var(--space-4h)",
              paddingRight: 120,
              fontFamily: "var(--font-mono)",
              fontSize: "var(--fs-md)",
              color: "var(--fg)",
              overflow: "hidden",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                color: "var(--accent)",
                marginRight: "var(--space-2)",
                userSelect: "none",
              }}
            >
              $
            </span>
            <span style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
              {primary.cmd}
            </span>
            <span
              style={{
                position: "absolute",
                top: "var(--space-2h)",
                right: "var(--space-2h)",
              }}
            >
              <CopyButton value={primary.cmd} />
            </span>
          </div>

          <p
            style={{
              margin: "var(--space-3) 0 0 0",
              fontSize: "var(--fs-xs)",
              color: "var(--fg-muted)",
              lineHeight: 1.6,
            }}
          >
            Installs <code style={{ fontFamily: "var(--font-mono)" }}>quanta 0.12.4</code>{" "}
            globally. Auto-updates are on by default — run{" "}
            <code style={{ fontFamily: "var(--font-mono)" }}>quanta upgrade</code> any time.
          </p>
        </section>

        {/* Alternative methods */}
        <div className="demo-sectionbar">
          <span className="demo-sectionbar__title">Alternative install methods</span>
          <span className="demo-sectionbar__desc">
            Same binary, different delivery
          </span>
        </div>
        <div className="demo-grid-3" style={{ marginBottom: "var(--space-5)" }}>
          {ALTS.map((alt) => {
            const Icon = alt.icon;
            const cmd = alt.cmd(platform);
            return (
              <div
                key={alt.id}
                className="demo-catalog__card"
                style={{ cursor: "default" }}
              >
                <div className="demo-catalog__card-head">
                  <span className="demo-catalog__card-icon">
                    <Icon size={15} strokeWidth={1.8} aria-hidden="true" />
                  </span>
                  <span className="demo-catalog__card-cat">{alt.id}</span>
                </div>
                <div className="demo-catalog__card-title">{alt.name}</div>
                <div
                  className="demo-catalog__card-blurb"
                  style={{ marginBottom: "var(--space-2)" }}
                >
                  {alt.blurb}
                </div>
                <div
                  style={{
                    position: "relative",
                    paddingRight: 62,
                  }}
                >
                  <pre
                    className="demo-code"
                    style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-all" }}
                  >
                    {cmd}
                  </pre>
                  <span
                    style={{
                      position: "absolute",
                      top: 4,
                      right: 4,
                    }}
                  >
                    <CopyButton value={cmd} />
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Verification */}
        <div className="demo-block">
          <div className="demo-block__head">
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span className="demo-block__title">Step 2 · Verify install</span>
              <span className="demo-block__sub">
                Run it to confirm the binary is on your PATH.
              </span>
            </div>
            <span style={{ marginLeft: "auto" }}>
              <CopyButton value="quanta --version" label="Copy cmd" />
            </span>
          </div>
          <div className="demo-block__body">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
                gap: "var(--space-3)",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: "var(--fs-10)",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--fg-subtle)",
                    fontWeight: "var(--fw-semibold)",
                    marginBottom: "var(--space-1h)",
                  }}
                >
                  Input
                </div>
                <pre
                  className="demo-code"
                  style={{
                    margin: 0,
                    padding: "var(--space-3)",
                    fontSize: "var(--fs-sm)",
                    color: "var(--fg)",
                  }}
                >
{`$ quanta --version`}
                </pre>
              </div>
              <div>
                <div
                  style={{
                    fontSize: "var(--fs-10)",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--fg-subtle)",
                    fontWeight: "var(--fw-semibold)",
                    marginBottom: "var(--space-1h)",
                  }}
                >
                  Expected output
                </div>
                <pre
                  style={{
                    margin: 0,
                    padding: "var(--space-3)",
                    fontSize: "var(--fs-sm)",
                    fontFamily: "var(--font-mono)",
                    background: "#0a0a0a",
                    color: "#e4e4e4",
                    border: "1px solid #1f1f1f",
                    borderRadius: "var(--radius-sm)",
                    whiteSpace: "pre",
                    overflow: "auto",
                  }}
                >
{`quanta 0.12.4 (2026-04-12)
engines: risk,taint,policy,blast
checksum: sha256:a1b2c3…9ef0 [ok]`}
                </pre>
              </div>
            </div>
          </div>
        </div>

        {/* Post-install checklist */}
        <div className="demo-sectionbar" style={{ marginTop: "var(--space-5)" }}>
          <span className="demo-sectionbar__title">Step 3 · First run</span>
          <span className="demo-sectionbar__desc">
            Three commands and you are talking to the engine
          </span>
        </div>
        <ul className="demo-checklist" style={{ marginBottom: "var(--space-5)" }}>
          {[
            {
              n: 1,
              title: "Authenticate",
              desc: "Opens your browser and links the CLI to this workspace. Token is cached at ~/.quanta/token.",
              cmd: "quanta auth login",
            },
            {
              n: 2,
              title: "Link a repo",
              desc: "Run inside any git checkout — creates .quanta/ with workspace config and a default policy set.",
              cmd: "quanta init",
            },
            {
              n: 3,
              title: "Run your first analysis",
              desc: "Risk-scores the src/ directory and prints a summary table. No uploads unless you push.",
              cmd: "quanta run risk ./src",
            },
          ].map((step) => (
            <li key={step.n} className="demo-checklist__item">
              <span
                className="demo-checklist__bullet"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--fs-xs)",
                  fontWeight: "var(--fw-bold)",
                }}
              >
                {step.n}
              </span>
              <div>
                <div className="demo-checklist__title">{step.title}</div>
                <div className="demo-checklist__desc">{step.desc}</div>
                <pre
                  className="demo-code"
                  style={{
                    margin: "var(--space-2) 0 0 0",
                    padding: "var(--space-1h) var(--space-2h)",
                    width: "fit-content",
                    maxWidth: "100%",
                  }}
                >
                  {`$ ${step.cmd}`}
                </pre>
              </div>
              <CopyButton value={step.cmd} />
            </li>
          ))}
        </ul>

        {/* Next steps */}
        <div className="demo-sectionbar">
          <span className="demo-sectionbar__title">What next</span>
        </div>
        <div className="demo-grid-2">
          <NextStepTile
            icon={FileCode}
            kicker="SDK"
            title="Read the SDK quickstart"
            blurb="Hello world in TypeScript, Python, Go, Rust — from install to first signed request."
            onClick={() => navigate("developers.sdk")}
          />
          <NextStepTile
            icon={Rocket}
            kicker="Playground"
            title="Try the playground"
            blurb="Poke the engines with real requests. Sandboxed against synthetic data."
            onClick={() => navigate("developers.playground")}
          />
        </div>
      </div>
    </div>
  );
}
