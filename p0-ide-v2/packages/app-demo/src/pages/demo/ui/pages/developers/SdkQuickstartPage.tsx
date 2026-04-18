import { useState } from "react";
import {
  Package,
  Terminal,
  Play,
  FileCode,
  Check,
  ArrowRight,
  Copy,
  Rocket,
} from "lucide-react";
import { DemoAppHero } from "../../internal/DemoAppHero";
import { useDemoNav } from "../../DemoPage";

type Lang = "TypeScript" | "Python" | "Go" | "Rust";

const LANGS: Lang[] = ["TypeScript", "Python", "Go", "Rust"];

type StepSnippets = Record<Lang, string>;

const INSTALL: StepSnippets = {
  TypeScript: "npm i @quanta/sdk",
  Python:     "pip install quanta",
  Go:         "go get github.com/quanta-dev/sdk",
  Rust:       "cargo add quanta-sdk",
};

const AUTH: StepSnippets = {
  TypeScript: `import { Quanta } from "@quanta/sdk";

const client = new Quanta({
  apiKey: process.env.QUANTA_KEY!,
  workspace: "acme",
});`,
  Python: `import os
from quanta import Quanta

client = Quanta(
    api_key=os.environ["QUANTA_KEY"],
    workspace="acme",
)`,
  Go: `package main

import (
    "os"
    "github.com/quanta-dev/sdk"
)

client := quanta.New(quanta.Config{
    APIKey:    os.Getenv("QUANTA_KEY"),
    Workspace: "acme",
})`,
  Rust: `use quanta_sdk::Quanta;

let client = Quanta::builder()
    .api_key(std::env::var("QUANTA_KEY")?)
    .workspace("acme")
    .build()?;`,
};

const FIRST_CALL: StepSnippets = {
  TypeScript: `const analysis = await client.analyses.create({
  repo: "acme/order-service",
  ref: "refs/heads/main",
  engine: "risk",
});

console.log(analysis.id);`,
  Python: `analysis = await client.analyses.create(
    repo="acme/order-service",
    ref="refs/heads/main",
    engine="risk",
)

print(analysis.id)`,
  Go: `ctx := context.Background()

analysis, err := client.Analyses.Create(ctx, &quanta.AnalysisCreateParams{
    Repo:   "acme/order-service",
    Ref:    "refs/heads/main",
    Engine: "risk",
})
if err != nil { return err }

fmt.Println(analysis.ID)`,
  Rust: `let analysis = client
    .analyses()
    .create()
    .repo("acme/order-service")
    .r#ref("refs/heads/main")
    .engine("risk")
    .send()
    .await?;

println!("{}", analysis.id);`,
};

const HANDLE_RESULT: StepSnippets = {
  TypeScript: `const findings = await client.analyses.findings(analysis.id);

for (const f of findings) {
  if (f.severity === "high") {
    console.log(\`[HIGH] \${f.rule}  \${f.file}:\${f.line}\`);
  }
}

console.log(\`Risk score: \${analysis.risk_score.toFixed(2)}\`);
console.log(\`Blast radius: \${analysis.blast_radius} symbols\`);`,
  Python: `findings = await client.analyses.findings(analysis.id)

for f in findings:
    if f.severity == "high":
        print(f"[HIGH] {f.rule}  {f.file}:{f.line}")

print(f"Risk score: {analysis.risk_score:.2f}")
print(f"Blast radius: {analysis.blast_radius} symbols")`,
  Go: `findings, err := client.Analyses.Findings(ctx, analysis.ID)
if err != nil { return err }

for _, f := range findings {
    if f.Severity == "high" {
        fmt.Printf("[HIGH] %s  %s:%d\\n", f.Rule, f.File, f.Line)
    }
}

fmt.Printf("Risk score: %.2f\\n", analysis.RiskScore)
fmt.Printf("Blast radius: %d symbols\\n", analysis.BlastRadius)`,
  Rust: `let findings = client.analyses().findings(&analysis.id).send().await?;

for f in findings.iter().filter(|f| f.severity == "high") {
    println!("[HIGH] {}  {}:{}", f.rule, f.file, f.line);
}

println!("Risk score: {:.2}", analysis.risk_score);
println!("Blast radius: {} symbols", analysis.blast_radius);`,
};

type Step = {
  n: number;
  icon: typeof Package;
  title: string;
  blurb: string;
  snippets: StepSnippets;
  filename: Record<Lang, string>;
};

const STEPS: Step[] = [
  {
    n: 1,
    icon: Package,
    title: "Install the SDK",
    blurb: "One dependency, no native build. Binaries for Node 18+, Python 3.10+, Go 1.22+, and Rust 1.74+.",
    snippets: INSTALL,
    filename: {
      TypeScript: "terminal",
      Python:     "terminal",
      Go:         "terminal",
      Rust:       "terminal",
    },
  },
  {
    n: 2,
    icon: Terminal,
    title: "Authenticate",
    blurb: "Export your key, construct the client. The workspace slug scopes every call that follows.",
    snippets: AUTH,
    filename: {
      TypeScript: "src/client.ts",
      Python:     "app/client.py",
      Go:         "client.go",
      Rust:       "src/client.rs",
    },
  },
  {
    n: 3,
    icon: Play,
    title: "Run your first call",
    blurb: "Kicks off a structural risk analysis. Returns immediately with an id — the engine runs on our side.",
    snippets: FIRST_CALL,
    filename: {
      TypeScript: "src/run.ts",
      Python:     "app/run.py",
      Go:         "run.go",
      Rust:       "src/run.rs",
    },
  },
  {
    n: 4,
    icon: FileCode,
    title: "Handle the result",
    blurb: "Iterate findings, filter by severity, summarise the score. Everything is strongly typed.",
    snippets: HANDLE_RESULT,
    filename: {
      TypeScript: "src/report.ts",
      Python:     "app/report.py",
      Go:         "report.go",
      Rust:       "src/report.rs",
    },
  },
];

const LANG_DOT: Record<Lang, string> = {
  TypeScript: "var(--accent)",
  Python:     "var(--warn)",
  Go:         "var(--success)",
  Rust:       "var(--danger)",
};

function CopyButton({ value }: { value: string }) {
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
      aria-label={copied ? "Copied" : "Copy snippet"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--space-1)",
        padding: "var(--space-1) var(--space-2)",
        height: 24,
        border: `1px solid ${copied ? "var(--success)" : hover ? "var(--border-strong)" : "var(--border)"}`,
        borderRadius: "var(--radius-xs)",
        background: copied ? "var(--bg-success-subtle)" : "var(--bg)",
        color: copied ? "var(--success)" : "var(--fg-muted)",
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

function NumberBadge({ n }: { n: number }) {
  return (
    <div
      aria-hidden="true"
      style={{
        width: 32,
        height: 32,
        borderRadius: "50%",
        border: "1px solid var(--border-strong)",
        background: "var(--bg)",
        color: "var(--fg)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-mono)",
        fontSize: "var(--fs-sm)",
        fontWeight: "var(--fw-bold)",
        flex: "0 0 auto",
      }}
    >
      {n}
    </div>
  );
}

function CodeBlock({
  code,
  filename,
  lang,
}: {
  code: string;
  filename: string;
  lang: Lang;
}) {
  return (
    <div
      style={{
        border: "1px solid #1f1f1f",
        borderRadius: "var(--radius-md)",
        background: "#0a0a0a",
        overflow: "hidden",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-2)",
          padding: "var(--space-2) var(--space-3)",
          borderBottom: "1px solid #1f1f1f",
          background: "#141414",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: LANG_DOT[lang],
          }}
        />
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--fs-10)",
            color: "#9a9a9a",
            letterSpacing: "0.04em",
          }}
        >
          {filename}
        </span>
        <span style={{ marginLeft: "auto" }}>
          <CopyButton value={code} />
        </span>
      </header>
      <pre
        style={{
          margin: 0,
          padding: "var(--space-3h) var(--space-4)",
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          lineHeight: 1.6,
          color: "#e4e4e4",
          whiteSpace: "pre",
          overflow: "auto",
        }}
      >
        {code}
      </pre>
    </div>
  );
}

export function SdkQuickstartPage() {
  const [lang, setLang] = useState<Lang>("TypeScript");
  const { navigate } = useDemoNav();

  return (
    <div className="demo-app">
      <DemoAppHero
        kicker="Developers"
        title="SDK quickstart"
        sub="Hello world in every supported language — from first install to your first signed request."
      />
      <div className="demo-app__body">
        {/* Language tabs */}
        <div className="demo-sectionbar">
          <span className="demo-sectionbar__title">Choose your language</span>
          <span className="demo-sectionbar__desc">
            Four clients, one identical API surface
          </span>
          <span className="demo-sectionbar__spacer" />
          <div
            className="demo-billing-toggle"
            role="tablist"
            aria-label="SDK language"
            style={{ marginBottom: 0 }}
          >
            {LANGS.map((l) => (
              <button
                key={l}
                type="button"
                role="tab"
                aria-selected={lang === l}
                className={lang === l ? "is-active" : ""}
                onClick={() => setLang(l)}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Vertical step flow */}
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            const isLast = i === STEPS.length - 1;
            const snippet = step.snippets[lang];
            const filename = step.filename[lang];
            return (
              <section
                key={step.n}
                aria-labelledby={`step-${step.n}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "40px 1fr",
                  gap: "var(--space-3h)",
                  paddingTop: i === 0 ? 0 : "var(--space-5)",
                  paddingBottom: "var(--space-5)",
                  borderBottom: isLast ? "0" : "1px dashed var(--border)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "var(--space-2)",
                  }}
                >
                  <NumberBadge n={step.n} />
                  {!isLast && (
                    <span
                      aria-hidden="true"
                      style={{
                        flex: 1,
                        width: 1,
                        background:
                          "linear-gradient(180deg, var(--border), transparent)",
                      }}
                    />
                  )}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--space-2)",
                      marginBottom: "var(--space-1h)",
                    }}
                  >
                    <Icon size={14} strokeWidth={2} aria-hidden="true" color="var(--fg-muted)" />
                    <h3
                      id={`step-${step.n}`}
                      style={{
                        margin: 0,
                        fontSize: "var(--fs-lg)",
                        fontWeight: "var(--fw-semibold)",
                        letterSpacing: "-0.01em",
                      }}
                    >
                      {step.title}
                    </h3>
                  </div>
                  <p
                    style={{
                      margin: "0 0 var(--space-3) 0",
                      fontSize: "var(--fs-sm)",
                      color: "var(--fg-muted)",
                      lineHeight: 1.6,
                      maxWidth: 620,
                    }}
                  >
                    {step.blurb}
                  </p>
                  <CodeBlock code={snippet} filename={filename} lang={lang} />
                </div>
              </section>
            );
          })}
        </div>

        {/* Outcome card */}
        <section
          aria-labelledby="outcome-heading"
          style={{
            marginTop: "var(--space-5)",
            border: "1px solid var(--border-success-subtle)",
            borderRadius: "var(--radius-lg)",
            background: "var(--bg-success-subtle)",
            padding: "var(--space-4h) var(--space-5)",
            display: "grid",
            gridTemplateColumns: "40px 1fr auto",
            alignItems: "center",
            gap: "var(--space-3h)",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "var(--success)",
              color: "var(--bg)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Check size={18} strokeWidth={2.6} />
          </span>
          <div>
            <h3
              id="outcome-heading"
              style={{
                margin: 0,
                fontSize: "var(--fs-md)",
                fontWeight: "var(--fw-semibold)",
                color: "var(--fg)",
                letterSpacing: "-0.005em",
              }}
            >
              That is it — you just pushed your first analysis
            </h3>
            <p
              style={{
                margin: "2px 0 0 0",
                fontSize: "var(--fs-xs)",
                color: "var(--fg-muted)",
                lineHeight: 1.55,
              }}
            >
              Typical round-trip is 8–15 seconds for a medium repo. Results are idempotent per commit SHA.
            </p>
          </div>
          <div
            style={{
              display: "flex",
              gap: "var(--space-2)",
              flexWrap: "wrap",
              justifyContent: "flex-end",
            }}
          >
            <button
              type="button"
              className="demo-btn demo-btn--ghost"
              onClick={() => navigate("developers.api")}
            >
              <FileCode size={13} strokeWidth={2} aria-hidden="true" />
              Open API reference
            </button>
            <button
              type="button"
              className="demo-btn demo-btn--primary"
              onClick={() => navigate("admin.keys")}
            >
              <Rocket size={13} strokeWidth={2} aria-hidden="true" />
              Get an API key
              <ArrowRight size={13} strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
