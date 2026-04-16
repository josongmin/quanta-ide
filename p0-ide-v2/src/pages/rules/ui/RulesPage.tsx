import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/shared/lib";
import { toast } from "@/shared/model/toast-store";
import {
  rulesStore,
  useRulesStore,
  type BuildArtifact,
  type BuildTarget,
  type Diagnostic,
} from "@/entities/agent-rules";
import "./rules-page.css";

const IMPORTABLE = [
  { path: "CLAUDE.md",                          kind: "claude"  as const, detected: true  },
  { path: ".cursorrules",                       kind: "cursor"  as const, detected: true  },
  { path: ".github/copilot-instructions.md",    kind: "copilot" as const, detected: false },
  { path: "AGENT.md",                           kind: "neutral" as const, detected: true  },
];

function targetById(id: string, targets: readonly BuildTarget[]): BuildTarget | undefined {
  return targets.find((t) => t.id === id);
}

function labelFor(id: string, targets: readonly BuildTarget[]): string {
  return targetById(id, targets)?.label ?? id;
}

export function RulesPage() {
  const source = useRulesStore((s) => s.source);
  const build = useRulesStore((s) => s.build);
  const targets = useRulesStore((s) => s.targets);
  const lastBuiltAt = useRulesStore((s) => s.lastBuiltAt);

  const firstTargetId = build.artifacts[0]?.targetId ?? targets[0]?.id ?? "";
  const [activeTarget, setActiveTarget] = useState(firstTargetId);
  const [importOpen, setImportOpen] = useState(false);
  const [buildPulseAt, setBuildPulseAt] = useState(lastBuiltAt);

  const current = build.artifacts.find((a) => a.targetId === activeTarget) ?? build.artifacts[0];
  const allDiagnostics = build.artifacts.flatMap((a) => a.diagnostics);

  useEffect(() => {
    if (!current && build.artifacts[0]) {
      setActiveTarget(build.artifacts[0].targetId);
    }
  }, [build.artifacts, current]);

  function manualBuild() {
    rulesStore.rebuild();
    setBuildPulseAt(Date.now());
    toast.success(
      `Built ${build.artifacts.length} targets`,
      `${build.artifacts.length * 1} compiled · ${allDiagnostics.length} warnings`,
      "rules build",
    );
  }

  function resetSample() {
    rulesStore.reset();
    toast.info("Source reset to shipped sample", undefined, "rules");
  }

  return (
    <div className="rules-page">
      <RulesHeader
        sourcePath=".agent/rules.md"
        targetCount={build.artifacts.length}
        warningCount={build.totalDiagnostics}
        lastBuildAt={buildPulseAt}
        onBuild={manualBuild}
        onImport={() => setImportOpen(true)}
        onReset={resetSample}
      />

      <div className="rules-page__pitch">
        <span className="rules-pitch__lead">One source, many targets.</span>
        <span className="rules-pitch__body">
          Write rules once in a neutral format. Quanta compiles them to Claude / Cursor / Copilot / AGENT.md —
          flagging any capability the target can&apos;t express.
        </span>
      </div>

      <BuildStatusStrip
        artifacts={build.artifacts}
        targets={targets}
        activeTarget={activeTarget}
        onPick={setActiveTarget}
      />

      <div className="rules-page__body">
        <section className="rules-pane rules-pane--source">
          <header className="rules-pane__h">
            <span className="rules-pane__label">Source</span>
            <span className="rules-pane__path">.agent/rules.md</span>
            <span className="rules-pane__count">
              {source.split("\n").length} ln · {source.length} ch
            </span>
          </header>
          <textarea
            className="rules-source"
            value={source}
            onChange={(e) => rulesStore.setSource(e.target.value)}
            spellCheck={false}
            aria-label="Neutral rules source"
          />
        </section>

        <section className="rules-pane rules-pane--preview">
          <header className="rules-pane__h">
            <span className="rules-pane__label">Preview</span>
            <nav className="rules-target-tabs" role="tablist">
              {build.artifacts.map((a) => {
                const warnCount = a.diagnostics.length;
                const label = labelFor(a.targetId, targets);
                return (
                  <button
                    key={a.targetId}
                    type="button"
                    role="tab"
                    aria-selected={a.targetId === activeTarget}
                    className={cn("rules-target-tab", a.targetId === activeTarget && "is-active", warnCount > 0 && "has-warn")}
                    onClick={() => setActiveTarget(a.targetId)}
                  >
                    <span className="rules-target-tab__dot" aria-hidden />
                    <span className="rules-target-tab__label">{label}</span>
                    {warnCount > 0 && (
                      <span className="rules-target-tab__warn">{warnCount}</span>
                    )}
                  </button>
                );
              })}
            </nav>
            {current && (
              <span className="rules-pane__path">
                → <code>{current.outputPath}</code>
              </span>
            )}
          </header>
          {current && (
            <pre className="rules-preview">{current.output}</pre>
          )}
        </section>
      </div>

      <DiagnosticsList
        diagnostics={allDiagnostics}
        targets={targets}
        activeTarget={activeTarget}
        onFocusTarget={setActiveTarget}
      />

      {importOpen && <ImportWizard onClose={() => setImportOpen(false)} />}
    </div>
  );
}

function RulesHeader({
  sourcePath,
  targetCount,
  warningCount,
  lastBuildAt,
  onBuild,
  onImport,
  onReset,
}: {
  sourcePath: string;
  targetCount: number;
  warningCount: number;
  lastBuildAt: number;
  onBuild: () => void;
  onImport: () => void;
  onReset: () => void;
}) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => tick((n) => n + 1), 1000);
    return () => window.clearInterval(t);
  }, []);
  const when = lastBuildAt
    ? `${Math.max(0, Math.round((Date.now() - lastBuildAt) / 1000))}s ago`
    : "—";
  return (
    <header className="rules-header">
      <div className="rules-header__left">
        <span className="rules-header__kicker">Agent Rules</span>
        <span className="rules-header__title">{sourcePath}</span>
      </div>
      <div className="rules-header__meta">
        <span className="rules-header__stat">{targetCount} targets</span>
        <span className="rules-header__sep">·</span>
        <span className={cn("rules-header__stat", warningCount > 0 && "has-warn")}>
          {warningCount} warnings
        </span>
        <span className="rules-header__sep">·</span>
        <span className="rules-header__stat">last build {when}</span>
      </div>
      <div className="rules-header__actions">
        <button type="button" className="rules-btn rules-btn--ghost" onClick={onReset}>
          Reset sample
        </button>
        <button type="button" className="rules-btn rules-btn--ghost" onClick={onImport}>
          Import <kbd>⌘⇧I</kbd>
        </button>
        <button type="button" className="rules-btn rules-btn--primary" onClick={onBuild}>
          Build <kbd>⌘B</kbd>
        </button>
      </div>
    </header>
  );
}

function BuildStatusStrip({
  artifacts,
  targets,
  activeTarget,
  onPick,
}: {
  artifacts: readonly BuildArtifact[];
  targets: readonly BuildTarget[];
  activeTarget: string;
  onPick: (id: string) => void;
}) {
  return (
    <div className="rules-build">
      <span className="rules-build__label">Build</span>
      <div className="rules-build__targets">
        {artifacts.map((a) => {
          const hasWarn = a.diagnostics.length > 0;
          const state: "ok" | "warn" = hasWarn ? "warn" : "ok";
          const label = labelFor(a.targetId, targets);
          return (
            <button
              key={a.targetId}
              type="button"
              className={cn(`rules-build__target rules-build__target--${state}`, a.targetId === activeTarget && "is-active")}
              onClick={() => onPick(a.targetId)}
              title={`${label} → ${a.outputPath}`}
            >
              <span className={`rules-build__icon rules-build__icon--${state}`} aria-hidden>
                {state === "ok" ? "✓" : "!"}
              </span>
              <span className="rules-build__name">{label}</span>
              <span className="rules-build__count">
                {a.diagnostics.length > 0 && (
                  <span className="rules-build__dropped">−{a.diagnostics.length}</span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DiagnosticsList({
  diagnostics,
  targets,
  activeTarget,
  onFocusTarget,
}: {
  diagnostics: readonly Diagnostic[];
  targets: readonly BuildTarget[];
  activeTarget: string;
  onFocusTarget: (id: string) => void;
}) {
  if (diagnostics.length === 0) {
    return (
      <footer className="rules-diag rules-diag--empty">
        <span className="rules-diag__dot" aria-hidden />
        All targets compiled without warnings.
      </footer>
    );
  }
  return (
    <footer className="rules-diag">
      <div className="rules-diag__head">
        <span className="rules-diag__label">Warnings</span>
        <span className="rules-diag__count">{diagnostics.length}</span>
      </div>
      <ul className="rules-diag__list">
        {diagnostics.map((d, i) => {
          const label = labelFor(d.targetId, targets);
          return (
            <li key={i} className={`rules-diag__row rules-diag__row--${d.kind}`}>
              <span className="rules-diag__icon" aria-hidden>⚠</span>
              <button
                type="button"
                className={cn("rules-diag__adapter", d.targetId === activeTarget && "is-active")}
                onClick={() => onFocusTarget(d.targetId)}
              >
                {label}
              </button>
              <span className="rules-diag__msg">{d.message}</span>
            </li>
          );
        })}
      </ul>
    </footer>
  );
}

function ImportWizard({ onClose }: { onClose: () => void }) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(IMPORTABLE.filter((i) => i.detected).map((i) => i.path)),
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function toggle(path: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  function runImport() {
    toast.success(
      "Rules imported",
      `Synthesized neutral source from ${selected.size} existing files`,
      "rules import",
    );
    onClose();
  }

  return createPortal(
    <div className="rules-import" role="dialog" aria-label="Import existing rule files">
      <div className="rules-import__scrim" onClick={onClose} aria-hidden />
      <div className="rules-import__panel">
        <header className="rules-import__head">
          <span className="rules-import__kicker">Import wizard</span>
          <span className="rules-import__title">Reverse-parse existing rule files</span>
          <button type="button" className="rules-import__close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>
        <div className="rules-import__body">
          <p className="rules-import__lead">
            Quanta will parse each detected file through its adapter and merge into a single
            <code> .agent/rules.md</code> neutral source. Conflicting sections open a merge UI.
          </p>
          <ul className="rules-import__list">
            {IMPORTABLE.map((f) => (
              <li
                key={f.path}
                className={`rules-import__row rules-import__row--${f.detected ? "detected" : "missing"}`}
              >
                <label className="rules-import__label">
                  <input
                    type="checkbox"
                    checked={selected.has(f.path)}
                    onChange={() => toggle(f.path)}
                    disabled={!f.detected}
                  />
                  <span className="rules-import__path">{f.path}</span>
                  <span className={`rules-import__status rules-import__status--${f.detected ? "detected" : "missing"}`}>
                    {f.detected ? "detected" : "not found"}
                  </span>
                  <span className="rules-import__adapter">{f.kind}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
        <footer className="rules-import__foot">
          <span className="rules-import__hint">
            <kbd>Esc</kbd> close
          </span>
          <div className="rules-import__actions">
            <button type="button" className="rules-btn rules-btn--ghost" onClick={onClose}>Cancel</button>
            <button
              type="button"
              className="rules-btn rules-btn--primary"
              onClick={runImport}
              disabled={selected.size === 0}
            >
              Import {selected.size} file{selected.size === 1 ? "" : "s"}
            </button>
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
