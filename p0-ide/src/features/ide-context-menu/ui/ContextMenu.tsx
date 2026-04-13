import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { dispatchCommand } from "@/shared/hooks";
import { Menu, MenuItem, MenuSeparator } from "@/shared/ui";
import { CONTEXT_ITEMS, useContextMenu } from "../model/useContextMenu";

export function ContextMenu() {
  const { t } = useTranslation();
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

  // Attach native mouseenter/leave to each MenuItem button via ref callback,
  // so the row chrome stays a native <button> (no extra wrapper for a11y).
  const setRowRef = (id: string) => (node: HTMLButtonElement | null) => {
    if (!node) return;
    node.addEventListener("mouseenter", () => { setHovered(id); });
    node.addEventListener("mouseleave", () => { setHovered(null); });
  };

  return (
    <>
      <div ref={menuRef} className="ctxmenu" style={{ left, top }}>
        <Menu>
          {CONTEXT_ITEMS.map((item) => {
            if (item.divider === true) {
              return <MenuSeparator key={item.id} />;
            }
            const isHovered = hoveredId === item.id;
            return (
              <MenuItem
                key={item.id}
                ref={setRowRef(item.id)}
                className="ctxmenu-row"
                active={isHovered}
                shortcut={item.shortcut}
                aria-label={`${t(item.labelKey)}${item.shortcut !== undefined ? ` (${item.shortcut})` : ""}`}
                onClick={() => {
                  close();
                  dispatchCommand(item.id);
                }}
              >
                {t(item.labelKey)}
              </MenuItem>
            );
          })}
        </Menu>
      </div>

      {ghost && (
        <div className="ctxmenu-ghost" style={{ left: left + menuW + 8, top }}>
          <div className="ctxmenu-ghost-title">{t("ide.ctx.preview")}</div>
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
