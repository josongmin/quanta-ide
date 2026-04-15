import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import type { CSSProperties } from "react";

type ClosePhase = "pin" | "out";

interface CloseAnim {
  tabId: string;
  widthPx: number;
  phase: ClosePhase;
}

function readTabFlexMs(topbarEl: Element | null): number {
  if (!topbarEl) return 200;
  const raw = getComputedStyle(topbarEl).getPropertyValue("--topbar-tab-flex-ms").trim();
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 200;
}

function measureSiblingFreeze(strip: HTMLDivElement, closingId: string): Record<string, number> {
  const frozen: Record<string, number> = {};
  strip.querySelectorAll<HTMLButtonElement>(".topbar__tab").forEach((btn) => {
    const tid = btn.dataset.tabId;
    if (!tid || tid === closingId) return;
    const w = Math.round(btn.getBoundingClientRect().width);
    if (w > 0) frozen[tid] = w;
  });
  return frozen;
}

function tabSelector(id: string): string {
  const safe = typeof CSS !== "undefined" && "escape" in CSS ? CSS.escape(id) : id.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `[data-tab-id="${safe}"]`;
}

export function useWorkspaceTabStrip(onClose: (id: string) => void) {
  const stripRef = useRef<HTMLDivElement>(null);
  /** DOM `setTimeout` returns a number (avoid `NodeJS.Timeout` from ambient Node typings). */
  const closeTimerRef = useRef<number | null>(null);
  const [frozenSiblingPx, setFrozenSiblingPx] = useState<Record<string, number> | null>(null);
  const [closeAnim, setCloseAnim] = useState<CloseAnim | null>(null);

  useEffect(
    () => () => {
      if (closeTimerRef.current != null) window.clearTimeout(closeTimerRef.current);
    },
    [],
  );

  const releaseWidthFreeze = useCallback(() => {
    setFrozenSiblingPx((prev) => (prev == null ? prev : null));
  }, []);

  const beginCloseTab = useCallback(
    (id: string) => {
      const strip = stripRef.current;
      if (!strip) {
        onClose(id);
        return;
      }

      const tabEl = strip.querySelector<HTMLButtonElement>(tabSelector(id));
      if (!tabEl) {
        onClose(id);
        return;
      }

      if (closeTimerRef.current != null) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }

      const widthPx = Math.round(tabEl.getBoundingClientRect().width);
      const frozen = measureSiblingFreeze(strip, id);

      flushSync(() => {
        setFrozenSiblingPx(frozen);
        setCloseAnim({ tabId: id, widthPx, phase: "pin" });
      });

      void tabEl.offsetWidth;

      flushSync(() => {
        setCloseAnim({ tabId: id, widthPx, phase: "out" });
      });

      const ms = readTabFlexMs(strip.closest(".topbar"));
      const settleMs = ms + Math.ceil(ms * 0.12);

      closeTimerRef.current = window.setTimeout(() => {
        closeTimerRef.current = null;
        setCloseAnim(null);
        onClose(id);
      }, settleMs);
    },
    [onClose],
  );

  const tabChrome = useCallback(
    (tabId: string, isActive: boolean): { className: string; style: CSSProperties | undefined; innerStyle: CSSProperties | undefined } => {
      const frozenW = frozenSiblingPx?.[tabId];
      const ex = closeAnim?.tabId === tabId ? closeAnim : null;

      const parts = ["topbar__tab"];
      if (isActive) parts.push("is-active");
      if (ex) parts.push("is-tab-exiting");
      else if (frozenW != null) parts.push("is-width-frozen");

      let style: CSSProperties | undefined;
      if (ex) {
        style = {
          flex: ex.phase === "pin" ? `0 0 ${ex.widthPx}px` : "0 0 0",
          minWidth: ex.phase === "pin" ? ex.widthPx : 0,
          maxWidth: ex.phase === "pin" ? ex.widthPx : 0,
          overflow: "visible",
          pointerEvents: "none",
          zIndex: 1,
        };
      } else if (frozenW != null) {
        style = { flex: `0 0 ${frozenW}px`, minWidth: frozenW, maxWidth: frozenW };
      }

      const innerStyle: CSSProperties | undefined = ex
        ? {
            position: "absolute",
            left: 0,
            top: 0,
            height: "100%",
            width: ex.widthPx,
            opacity: ex.phase === "out" ? 0 : 1,
          }
        : undefined;

      return { className: parts.join(" "), style, innerStyle };
    },
    [frozenSiblingPx, closeAnim],
  );

  return {
    stripRef,
    onStripMouseLeave: releaseWidthFreeze,
    beginCloseTab,
    tabChrome,
  };
}
