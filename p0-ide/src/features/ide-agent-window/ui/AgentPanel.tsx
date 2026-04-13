import { useRef } from "react";
import { Panel } from "@/shared/ui";
import { useAgentWindow } from "../model/useAgentWindow";
import { useDrag } from "../model/useDrag";
import { useResize, type ResizeEdge, RESIZE_CURSORS } from "../model/useResize";
import { useAgentSession } from "../model/useAgentSession";
import { useAgentInteraction } from "../model/useAgentInteraction";
import { SessionTabs } from "./SessionTabs";
import { SessionPicker } from "./SessionPicker";
import { AgentPanelHeader } from "./AgentPanelHeader";
import { AgentPanelChat } from "./AgentPanelChat";
import { AgentPanelInput } from "./AgentPanelInput";

/* augment window for pending query handoff */
declare global {
  interface Window { __agentPendingQuery?: string; }
}

const INIT_W = 660;
const INIT_H = 560;

interface AgentPanelProps {
  initialPos: { x: number; y: number };
}

export function AgentPanel({ initialPos }: AgentPanelProps) {
  const {
    close, minimize, sessions, activeSessionId,
    newSession, switchSession, closeSession, updateSessionTitle, setSessionMode,
  } = useAgentWindow();

  const { pos, setPos, onMouseDown } = useDrag(initialPos);
  const { size, onResizeMouseDown } = useResize({ w: INIT_W, h: INIT_H }, pos, setPos);
  const rootRef = useRef<HTMLDivElement>(null);

  const { pinned, setPinned, serverOnlineRef } = useAgentInteraction(close, minimize, rootRef);
  const { input, setInput, sendMessage, messages, typing } = useAgentSession(
    activeSessionId, updateSessionTitle, serverOnlineRef,
  );

  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const isPicker = activeSession?.mode === "picker";

  const handlePickerSelect = (type: string) => {
    setSessionMode(activeSessionId, "chat");
    updateSessionTitle(activeSessionId, type.charAt(0).toUpperCase() + type.slice(1));
  };

  return (
    <Panel
      tier="floating"
      open
      onClose={close}
      closeOnEsc={false}
      ref={rootRef}
      className="agw-root"
      style={{ transform: `translate(${pos.x}px,${pos.y}px)`, width: size.w, height: size.h }}
      role="dialog"
      ariaModal={false}
      ariaLabel="P0 Agent"
    >
      {/* resize handles — mouse-only drag affordance, no keyboard equivalent */}
      {(["n","s","e","w","ne","nw","se","sw"] as ResizeEdge[]).map((edge) => (
        // eslint-disable-next-line jsx-a11y/no-static-element-interactions
        <div
          key={edge}
          className={`agw-resize-handle agw-resize-${edge}`}
          style={{ cursor: RESIZE_CURSORS[edge] }}
          onMouseDown={(e) => { onResizeMouseDown(e, edge); }}
        />
      ))}

      <AgentPanelHeader
        pinned={pinned}
        onTogglePin={() => { setPinned((v) => !v); }}
        onClose={close}
        onMouseDown={onMouseDown}
      />

      <SessionTabs
        sessions={sessions}
        activeId={activeSessionId}
        onSwitch={switchSession}
        onClose={closeSession}
        onNew={newSession}
      />

      {isPicker ? (
        <SessionPicker onSelect={handlePickerSelect} />
      ) : (
        <>
          <AgentPanelChat messages={messages} typing={typing} />
          <AgentPanelInput
            input={input}
            onInputChange={setInput}
            onSend={sendMessage}
            typing={typing}
            messageCount={messages.length}
          />
        </>
      )}
    </Panel>
  );
}
