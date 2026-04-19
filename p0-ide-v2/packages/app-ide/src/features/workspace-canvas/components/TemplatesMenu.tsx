import { useCallback, useEffect, useRef } from "react";
import { TEMPLATES, applyTemplate } from "../lib/templates";
import { useSceneStore } from "../store/scene-store";
import { switchToPage } from "./PagesTabBar";
import { showToast } from "../lib/toast";

// TemplatesMenu (Batch 5 — Navigation)
// -------------------------------------------------------------------
// Dropdown card invoked from the pages tab bar. Click a template to
// create a fresh page with its seeded bookmarks, then flip to it.

interface Props {
  onClose: () => void;
}

export function TemplatesMenu({ onClose }: Props) {
  const graph = useSceneStore(s => s.graph);
  const layout = useSceneStore(s => s.layout);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current?.contains(e.target as Node)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const apply = useCallback(
    (id: string) => {
      const result = applyTemplate(id, graph, layout);
      switchToPage(result.pageId);
      if (result.seeded === 0) {
        showToast("Page created — graph not ready, no views seeded yet.", 1800);
      }
      onClose();
    },
    [graph, layout, onClose],
  );

  return (
    <div ref={ref} className="ws-templates" role="menu" aria-label="Canvas templates">
      <div className="ws-templates__title">New from template</div>
      {TEMPLATES.length === 0 ? (
        <div className="ws-templates__empty" role="status">
          No templates available yet.
        </div>
      ) : (
        TEMPLATES.map(t => (
          <button
            key={t.id}
            type="button"
            role="menuitem"
            className="ws-templates__item"
            onClick={() => apply(t.id)}
            aria-label={`${t.label} — ${t.steps}`}
            title={t.description}
          >
            <div className="ws-templates__item-label">{t.label}</div>
            <div className="ws-templates__item-desc">{t.steps}</div>
          </button>
        ))
      )}
    </div>
  );
}
