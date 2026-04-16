import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "@quanta/shell/stores/toast-store";
import { IMPORTABLE } from "../lib/rules-page.mock";

export function ImportWizard({ onClose }: { onClose: () => void }) {
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
