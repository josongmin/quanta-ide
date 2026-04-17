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

// Singleton: only one agent window at a time
interface TauriWebview {
  destroy(): Promise<void>;
  onCloseRequested(
    handler: (event: { preventDefault(): void }) => void | Promise<void>,
  ): Promise<() => void>;
}

let activeWebview: TauriWebview | null = null;

function setActiveWebview(wv: TauriWebview | null) {
  activeWebview = wv;
}

function getActiveWebview(): TauriWebview | null {
  return activeWebview;
}

async function destroyActiveWebview() {
  const wv = activeWebview;
  activeWebview = null;
  if (wv) await wv.destroy().catch(() => {});
}

function TauriNativeWindow({ title, onClose }: { title: string; onClose: () => void }) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const mounted = useRef(false);

  useEffect(() => {
    if (mounted.current || getActiveWebview()) return;
    mounted.current = true;

    let unlistenClose: (() => void) | undefined;

    (async () => {
      await destroyActiveWebview();

      const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");

      const webview = new WebviewWindow(`agent-${Date.now()}`, {
        url: "/?popout=agent",
        title,
        width: 480,
        height: 700,
        resizable: true,
        decorations: true,
        center: true,
      });
      setActiveWebview(webview);

      unlistenClose = await webview.onCloseRequested(async (event) => {
        event.preventDefault();
        setActiveWebview(null);
        await webview.destroy();
        onCloseRef.current();
      });
    })().catch((err: unknown) => {
      console.error("[Agent popout] Tauri window failed:", err);
      setActiveWebview(null);
      onCloseRef.current();
    });

    return () => {
      unlistenClose?.();
      const wv = getActiveWebview();
      if (wv) {
        setActiveWebview(null);
        wv.destroy().catch(() => {});
      }
    };
  }, []);

  return null;
}

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
