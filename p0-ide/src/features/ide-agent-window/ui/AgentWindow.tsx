import { useState } from "react";
import { useAgentWindow } from "../model/useAgentWindow";
import { smartPos } from "../lib/smartPos";
import { AgentPanel } from "./AgentPanel";
import { BubbleIcon } from "./BubbleIcon";

const INIT_W = 660;
const INIT_H = 560;

const DEFAULT_POS = () => ({
  x: Math.max(0, window.innerWidth / 2 - INIT_W / 2),
  y: 60,
});

export function AgentWindow() {
  const { isOpen, minimized, open, expand, minimizeAt } = useAgentWindow();
  // Use state so reads happen via state snapshot, not ref (ref reads during render are forbidden)
  const [bubblePos, setBubblePos] = useState<{ x: number; y: number } | null>(null);

  if (!isOpen) {
    const fallbackPos = bubblePos ?? { x: window.innerWidth - 80, y: window.innerHeight - 120 };
    return (
      <BubbleIcon
        key="idle-bubble"
        initialPos={fallbackPos}
        onExpand={() => { open(); }}
        onMove={setBubblePos}
      />
    );
  }

  if (minimized) {
    const fallbackPos = bubblePos ?? (() => { const p = DEFAULT_POS(); return { x: p.x + INIT_W - 52, y: p.y + INIT_H - 52 }; })();
    const initialPos = minimizeAt
      ? { x: minimizeAt.pos.x - 24, y: minimizeAt.pos.y - 24 }
      : fallbackPos;

    return (
      <BubbleIcon
        key={minimizeAt ? `${minimizeAt.pos.x}-${minimizeAt.pos.y}` : "default"}
        initialPos={initialPos}
        clickOrigin={minimizeAt?.pos}
        mouseVel={minimizeAt?.vel}
        onExpand={() => { expand(); }}
        onMove={setBubblePos}
      />
    );
  }

  const panelPos = bubblePos
    ? smartPos(bubblePos.x, bubblePos.y, INIT_W, INIT_H)
    : DEFAULT_POS();

  return <AgentPanel initialPos={panelPos} />;
}
