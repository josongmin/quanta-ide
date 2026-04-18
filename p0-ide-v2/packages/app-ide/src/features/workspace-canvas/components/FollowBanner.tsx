import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { followStore } from "../store/follow-store";

interface Props {
  targetId: string;
  label: string;
}

// Portal div so the banner renders above every canvas layer without fighting
// z-index inside the canvas container tree. Mounted to document.body.
export function FollowBanner({ label }: Props) {
  const [host, setHost] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const el = document.createElement("div");
    el.className = "ws-follow-banner-host";
    document.body.appendChild(el);
    setHost(el);
    return () => {
      el.remove();
    };
  }, []);

  if (!host) return null;
  return createPortal(
    <button
      type="button"
      className="ws-follow-banner"
      onClick={() => followStore.stop()}
      title="click or press esc to stop following"
    >
      <span className="ws-follow-banner__dot" />
      Following <strong>{label}</strong>
      <span className="ws-follow-banner__stop">click to stop</span>
    </button>,
    host,
  );
}
