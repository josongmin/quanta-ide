import { useEffect, useRef } from "react";
import { dispatchCommand } from "@/features/ide-command-palette/model/dispatcher";
import { CONTEXT_ITEMS, useContextMenu } from "../model/useContextMenu";

export function ContextMenu() {
  const { isOpen, x, y, hoveredId, close, setHovered } = useContextMenu();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { close(); }
    };
    const clickOutside = () => { close(); };
    window.addEventListener("keydown", handler);
    window.addEventListener("click", clickOutside);
    return () => {
      window.removeEventListener("keydown", handler);
      window.removeEventListener("click", clickOutside);
    };
  }, [isOpen, close]);

  if (!isOpen) return null;

  const ghost = CONTEXT_ITEMS.find((i) => i.id === hoveredId)?.ghost;

  // Clamp position to viewport
  const menuW = 260;
  const menuH = 380;
  const left = Math.min(x, window.innerWidth - menuW - 8);
  const top = Math.min(y, window.innerHeight - menuH - 8);

  return (
    <>
      <div
        ref={menuRef}
        className="ctxmenu"
        style={{ left, top }}
        role="menu"
      >
        {CONTEXT_ITEMS.map((item) => {
          if (item.divider === true) {
            return <div key={item.id} className="ctxmenu-divider" />;
          }
          const isHovered = hoveredId === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={`ctxmenu-row${isHovered ? " is-active" : ""}`}
              role="menuitem"
              onMouseEnter={() => { setHovered(item.id); }}
              onMouseLeave={() => { setHovered(null); }}
              onClick={() => {
                close();
                dispatchCommand(item.id);
              }}
            >
              <span className="ctxmenu-label">{item.label}</span>
              {item.shortcut && <span className="ctxmenu-kbd">{item.shortcut}</span>}
            </button>
          );
        })}
      </div>

      {ghost && (
        <div className="ctxmenu-ghost" style={{ left: left + menuW + 8, top }}>
          <div className="ctxmenu-ghost-title">Preview</div>
          <pre className="ctxmenu-ghost-code">
            <span className="ctxmenu-ghost-dim">{ghost.before}</span>
            {"\n"}
            <span className="ctxmenu-ghost-add">+ {ghost.after}</span>
          </pre>
        </div>
      )}
    </>
  );
}
