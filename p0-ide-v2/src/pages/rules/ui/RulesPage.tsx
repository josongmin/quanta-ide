import { useEffect, useState } from "react";
import { cn } from "@/shared/lib";
import { toast } from "@/shared/model/toast-store";
import {
  rulesStore,
  useRulesStore,
} from "@/entities/agent-rules";
import { labelFor } from "../lib/rules-page.utils";
import { RulesHeader } from "./RulesHeader";
import { BuildStatusStrip } from "./BuildStatusStrip";
import { DiagnosticsList } from "./DiagnosticsList";
import { ImportWizard } from "./ImportWizard";
import "./rules-page.css";

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
