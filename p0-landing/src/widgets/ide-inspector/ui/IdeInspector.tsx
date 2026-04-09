import { type ReactNode, useState, useCallback } from "react";

interface IdeInspectorProps {
  children: ReactNode;
}

export function IdeInspector({ children }: IdeInspectorProps) {
  return <aside className="ide-inspector">{children}</aside>;
}

export function InspectorSection({
  label,
  children,
  defaultOpen = true,
}: {
  label: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const toggle = useCallback(() => { setOpen((v) => !v); }, []);

  return (
    <section className={`ide-inspector-section${open ? "" : " is-collapsed"}`}>
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- section toggle */}
      <div className="ide-inspector-section-header" onClick={toggle}>
        <div className="ide-label">{label}</div>
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
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
      {open && <div className="ide-inspector-section-body">{children}</div>}
    </section>
  );
}
