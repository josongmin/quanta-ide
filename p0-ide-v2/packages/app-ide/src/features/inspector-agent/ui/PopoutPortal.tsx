import { useEffect, useRef, type ReactNode } from "react";
import { FloatingPanel } from "./FloatingPanel";

interface PopoutPortalProps {
  children: ReactNode;
  title?: string;
  onClose: () => void;
}

function isTauri(): boolean {
  return document.documentElement.classList.contains("is-tauri");
}

/**
 * Tauri branch: opens a native OS window via WebviewWindow.
 * The child window loads the same app with `?popout=agent`,
 * which renders a standalone AgentPane in main.tsx.
 */
function TauriNativeWindow({ title, onClose }: { title: string; onClose: () => void }) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    (async () => {
      const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");

      const label = `agent-popout-${Date.now()}`;
      const webview = new WebviewWindow(label, {
        url: "/?popout=agent",
        title,
        width: 480,
        height: 700,
        x: window.screenX + window.outerWidth - 500,
        y: window.screenY + 60,
        resizable: true,
        decorations: true,
        center: false,
      });

      unlisten = await webview.onCloseRequested(() => {
        onCloseRef.current();
      });
    })().catch(() => {
      // Tauri API failed — fall back by closing
      onCloseRef.current();
    });

    return () => {
      unlisten?.();
    };
  }, [title]);

  // No inline content — native window loads its own React tree via ?popout=agent
  return null;
}

/**
 * Platform-aware popout:
 * - Tauri → native OS window (WebviewWindow)
 * - Web   → FloatingPanel (draggable/resizable overlay)
 */
export function PopoutPortal({ children, title = "Agent", onClose }: PopoutPortalProps) {
  if (isTauri()) {
    return <TauriNativeWindow title={title} onClose={onClose} />;
  }

  return (
    <FloatingPanel title={title} onClose={onClose}>
      {children}
    </FloatingPanel>
  );
}
