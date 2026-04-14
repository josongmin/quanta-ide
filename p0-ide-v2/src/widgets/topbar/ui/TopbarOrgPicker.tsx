import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./topbar-org-picker.css";

const ORGS = [
  { id: "acme", label: "Acme Corp" },
  { id: "quanta", label: "Quanta" },
  { id: "personal", label: "Personal" },
] as const;

type MenuCoords = { top: number; left: number; width: number };

export function TopbarOrgPicker() {
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string>(ORGS[0].id);
  const [menuCoords, setMenuCoords] = useState<MenuCoords | null>(null);

  const selected = ORGS.find((o) => o.id === selectedId) ?? ORGS[0];

  const close = useCallback(() => setOpen(false), []);

  const updateMenuCoords = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setMenuCoords({ top: r.bottom + 4, left: r.left, width: r.width });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setMenuCoords(null);
      return;
    }
    updateMenuCoords();
    const onScroll = () => updateMenuCoords();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open, updateMenuCoords]);

  useEffect(() => {
    if (!open) return;
    const onDocDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  const menu =
    open && menuCoords
      ? createPortal(
          <ul
            ref={menuRef}
            id={listId}
            className="topbar-org-picker__menu"
            role="listbox"
            aria-label="Organization"
            style={{
              top: menuCoords.top,
              left: menuCoords.left,
              width: menuCoords.width,
            }}
          >
            {ORGS.map((o) => {
              const isSel = o.id === selectedId;
              return (
                <li key={o.id} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSel}
                    className={`topbar-org-picker__option${isSel ? " is-selected" : ""}`}
                    onClick={() => {
                      setSelectedId(o.id);
                      close();
                    }}
                  >
                    {o.label}
                  </button>
                </li>
              );
            })}
          </ul>,
          document.body,
        )
      : null;

  return (
    <div className="topbar-org-picker" ref={wrapRef}>
      <button
        ref={triggerRef}
        type="button"
        className="topbar-org-picker__trigger"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? listId : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="topbar-org-picker__trigger-label" title={selected.label}>
          {selected.label}
        </span>
        <ChevronIcon className={`topbar-org-picker__chevron${open ? " is-open" : ""}`} />
      </button>
      {menu}
    </div>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
