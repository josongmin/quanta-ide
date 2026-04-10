import { type ReactNode, useState, useCallback, useId } from "react";
import { PanelResizer } from "@/shared/ui/PanelResizer";

interface IdeInspectorProps {
  children: ReactNode;
  /** tier key — changes trigger the slide-in animation */
  tierKey: string;
  /** Label shown in the panel header bar */
  title: string;
  /** Subtitle shown next to title (e.g. filename) */
  subtitle?: string;
}

export function IdeInspector({ children, tierKey, title, subtitle }: IdeInspectorProps) {

  return (
    <aside className="ide-inspector" aria-label="Inspector">
      <PanelResizer cssVar="--inspector-w" side="left" min={200} max={600} />

      {/* ── Panel header bar ── */}
      <div className="ide-inspector-bar">
        <div className="ide-inspector-bar-breadcrumb">
          {subtitle && (
            <>
              <span className="ide-inspector-bar-sub">{subtitle}</span>
              <span className="ide-inspector-bar-sep">/</span>
            </>
          )}
          <span className="ide-inspector-bar-title">{title}</span>
        </div>
      </div>

      <div
        className="ide-inspector-scroll"
        key={tierKey}
      >
        {children}
      </div>
    </aside>
  );
}

export function InspectorSection({
  label,
  children,
  defaultOpen = true,
  count,
}: {
  label: string;
  children: ReactNode;
  defaultOpen?: boolean;
  count?: number;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const toggle = useCallback(() => { setOpen((v) => !v); }, []);
  const bodyId = useId();

  return (
    <section className={`ide-inspector-section${open ? "" : " is-collapsed"}`}>
      <button
        type="button"
        className="ide-inspector-section-header"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={bodyId}
        aria-label={`${open ? "Collapse" : "Expand"} ${label}`}
      >
        <div className="ide-inspector-section-label">
          <span className="ide-label">{label}</span>
          {count !== undefined && (
            <span className="ide-inspector-section-count">{count}</span>
          )}
        </div>
        <svg
          className={`ide-inspector-chev${open ? " is-open" : ""}`}
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && <div id={bodyId} className="ide-inspector-section-body">{children}</div>}
    </section>
  );
}
