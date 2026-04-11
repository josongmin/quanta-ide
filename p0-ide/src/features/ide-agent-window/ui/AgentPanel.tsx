import { useCallback, useEffect, useRef, useState } from "react";
import { useAgentWindow } from "../model/useAgentWindow";
import { postAgentTurn, postAgentOneshot, makeTurnId, DevosError, DEVOS_REPO_PATH, type ExecutionMetadata } from "../model/devosClient";
import { useDrag } from "../model/useDrag";
import { useResize, type ResizeEdge, RESIZE_CURSORS } from "../model/useResize";
import { buildReply } from "../lib/buildReply";
import type { ChatMsg, SessionChat } from "../model/types";
import { SessionTabs } from "./SessionTabs";
import { MsgPart } from "./MsgPart";
import { IconClose, IconChevron, IconPlus, IconSend } from "./icons";

/* pin / unpin icon — thumbtack */
function IconPin({ pinned }: { pinned: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* needle going down */}
      <line x1="7" y1="9" x2="7" y2="13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      {/* top cap */}
      <rect x="3.5" y="1" width="7" height="2.2" rx="1.1" fill={pinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.15"/>
      {/* body trapezoid */}
      <path d="M4.2 3.2L3.2 9H10.8L9.8 3.2H4.2Z" fill={pinned ? "currentColor" : "none"} fillOpacity="0.18" stroke="currentColor" strokeWidth="1.15" strokeLinejoin="round"/>
    </svg>
  );
}

/* augment window for pending query handoff */
declare global {
  interface Window { __agentPendingQuery?: string; }
}

const INIT_W = 660;
const INIT_H = 560;

const INITIAL_MESSAGES: ChatMsg[] = [
  {
    id: "init-user",
    role: "user",
    parts: [{ type: "text", text: "Which path can double-refund a customer?" }],
  },
  ...buildReply("double-refund"),
];

const SUGGESTIONS = [
  "Who actually owns refund state?",
  "What breaks if webhook ordering changes?",
  "Show me the blast radius of db.update",
];

interface AgentPanelProps {
  initialPos: { x: number; y: number };
}

export function AgentPanel({ initialPos }: AgentPanelProps) {
  const {
    close, minimize, sessions, activeSessionId,
    newSession, switchSession, closeSession, updateSessionTitle,
  } = useAgentWindow();

  const { pos, setPos, onMouseDown } = useDrag(initialPos);
  const { size, onResizeMouseDown } = useResize({ w: INIT_W, h: INIT_H }, pos, setPos);
  const rootRef = useRef<HTMLDivElement>(null);

  const [sessionChats, setSessionChats] = useState<Record<string, SessionChat>>({
    [activeSessionId]: { messages: INITIAL_MESSAGES, typing: false },
  });
  const [input, setInput] = useState("");
  const serverOnlineRef = useRef<boolean | null>(null);
  const [pinned, setPinned] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentChat: SessionChat = sessionChats[activeSessionId] ?? { messages: [], typing: false };
  const { messages, typing } = currentChat;

  const setCurrentChat = useCallback((updater: (prev: SessionChat) => SessionChat) => {
    setSessionChats((prev) => {
      const current = prev[activeSessionId] ?? { messages: [], typing: false };
      return { ...prev, [activeSessionId]: updater(current) };
    });
  }, [activeSessionId]);

  // reset input on session switch (wrap in callback to avoid set-state-in-effect lint)
  useEffect(() => { queueMicrotask(() => { setInput(""); }); }, [activeSessionId]);

  // Escape → close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", handler);
    return () => { window.removeEventListener("keydown", handler); };
  }, [close]);

  // 마우스 velocity 추적
  const lastMouse = useRef({ x: 0, y: 0, t: 0 });
  const mouseVel  = useRef({ x: 0, y: 0 });
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const now = performance.now();
      const dt  = now - lastMouse.current.t || 1;
      mouseVel.current = {
        x: (e.clientX - lastMouse.current.x) / dt,
        y: (e.clientY - lastMouse.current.y) / dt,
      };
      lastMouse.current = { x: e.clientX, y: e.clientY, t: now };
    };
    window.addEventListener("mousemove", onMove);
    return () => { window.removeEventListener("mousemove", onMove); };
  }, []);

  // outside click → minimize (pinned 모드면 무시)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pinned) return;
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        minimize({
          pos: { x: e.clientX, y: e.clientY },
          vel: { ...mouseVel.current },
        });
      }
    };
    document.addEventListener("mousedown", handler);
    return () => { document.removeEventListener("mousedown", handler); };
  }, [minimize, pinned]);

  // auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  // server health check
  useEffect(() => {
    serverOnlineRef.current = null;
    fetch("http://127.0.0.1:8081/health")
      .then((r) => { serverOnlineRef.current = r.ok; })
      .catch(() => { serverOnlineRef.current = false; });
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || typing) return;
    const userMsg: ChatMsg = { id: `u-${Date.now()}`, role: "user", parts: [{ type: "text", text }] };
    setCurrentChat((prev) => ({ ...prev, messages: [...prev.messages, userMsg], typing: true }));
    setInput("");

    const isFirstMsg = (sessionChats[activeSessionId] ?? { messages: [] }).messages.filter((m) => m.role === "user").length === 0;
    if (isFirstMsg) updateSessionTitle(activeSessionId, text);

    try {
      let resultText = "";
      let meta: ExecutionMetadata | null = null;

      const turnRes = await postAgentTurn({
        session_id: activeSessionId,
        client_turn_id: makeTurnId(),
        user_message: text,
        repo_path: DEVOS_REPO_PATH,
        execution_mode: "standard",
      });

      const turnStatus = turnRes.status;
      if ((turnStatus.state === "completed" || turnStatus.state === "in_progress") && turnRes.result) {
        resultText = turnRes.result;
        meta = turnRes.metadata;
      } else if (turnStatus.state === "failed" || turnStatus.state === "unavailable") {
        resultText = `[${turnStatus.state}] ${"reason" in turnStatus ? turnStatus.reason : ""}`;
        meta = turnRes.metadata;
      } else {
        const oneshotRes = await postAgentOneshot({
          task: text,
          repo_path: DEVOS_REPO_PATH,
          mode: "fast",
        });
        const os = oneshotRes.status;
        resultText = oneshotRes.result !== "" ? oneshotRes.result : (os.state !== "completed" && os.state !== "in_progress" && "reason" in os ? `[${os.state}] ${os.reason}` : "(결과 없음)");
        meta = oneshotRes.metadata;
      }

      serverOnlineRef.current = true;

      const metricsParts = [{
        type: "metrics" as const,
        items: [
          { label: "EXEC TIME", value: `${meta.execution_time_ms}ms` },
          { label: "LANES OK",  value: `${meta.lanes_succeeded}/${meta.lanes_executed}` },
          ...(meta.lanes_failed > 0 ? [{ label: "FAILED", value: meta.lanes_failed, risk: true }] : []),
        ],
      }];
      const agentMsg: ChatMsg = {
        id: `agent-${Date.now()}`,
        role: "agent",
        parts: [{ type: "text", text: resultText }, ...metricsParts],
      };
      setCurrentChat((prev) => ({ messages: [...prev.messages, agentMsg], typing: false }));
    } catch (err) {
      serverOnlineRef.current = false;
      const fallbackReplies = buildReply(text);
      const notice: ChatMsg = {
        id: `notice-${Date.now()}`,
        role: "agent",
        parts: [{ type: "text", text: `⚠ 서버 연결 실패${err instanceof DevosError ? ` (HTTP ${err.status})` : ""} — 데모 응답으로 대체합니다.` }],
      };
      setCurrentChat((prev) => ({ messages: [...prev.messages, notice, ...fallbackReplies], typing: false }));
    }
  }, [typing, activeSessionId, sessionChats, setCurrentChat, updateSessionTitle]);

  // pending query handoff
  useEffect(() => {
    if (window.__agentPendingQuery) {
      const q = window.__agentPendingQuery;
      window.__agentPendingQuery = undefined;
      const t = setTimeout(() => { void sendMessage(q); }, 50);
      return () => { clearTimeout(t); };
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={rootRef}
      className="agw-root"
      style={{ transform: `translate(${pos.x}px,${pos.y}px)`, width: size.w, height: size.h }}
      role="dialog"
      aria-modal="false"
      aria-label="P0 Agent"
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

      {/* header — drag handle, mouse-only */}
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <header className="agw-header" onMouseDown={onMouseDown}>
        <div className="agw-header-left">
          <span className="agw-header-logo">p0</span>
          <span className="agw-header-sep">/</span>
          <span className="agw-repo-name">acme/payments-api</span>
        </div>
        <div className="agw-header-actions">
          <button
            type="button"
            className={`agw-pin-btn${pinned ? " is-pinned" : ""}`}
            onClick={(e) => { e.stopPropagation(); setPinned((v) => !v); }}
            aria-label={pinned ? "플로팅 고정 해제" : "플로팅 고정"}
            title={pinned ? "고정 중 — 외부 클릭해도 유지됨" : "고정 해제 — 외부 클릭 시 최소화"}
          >
            <IconPin pinned={pinned} />
          </button>
          <button type="button" className="agw-close" onClick={close} aria-label="Close">
            <IconClose />
          </button>
        </div>
      </header>

      {/* session tabs */}
      <SessionTabs
        sessions={sessions}
        activeId={activeSessionId}
        onSwitch={switchSession}
        onClose={closeSession}
        onNew={newSession}
      />

      {/* chat body */}
      <div className="agw-chat-body">
        {messages.map((msg) => (
          <div key={msg.id} className={`agw-msg is-${msg.role}`}>
            <div className="agw-msg-role">{msg.role === "agent" ? "p0" : "You"}</div>
            <div className="agw-msg-bubble">
              {msg.parts.map((part, i) => <MsgPart key={i} part={part} />)}
            </div>
          </div>
        ))}

        {typing && (
          <div className="agw-msg is-agent">
            <div className="agw-msg-role">p0</div>
            <div className="agw-typing">
              <div className="agw-typing-dot" />
              <div className="agw-typing-dot" />
              <div className="agw-typing-dot" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* suggestion chips */}
      {messages.length <= 2 && !typing && (
        <div className="agw-suggestions">
          {SUGGESTIONS.slice(0, 2).map((s) => (
            <button key={s} type="button" className="agw-suggestion-chip" onClick={() => { void sendMessage(s); }}>
              {s}
            </button>
          ))}
        </div>
      )}

      {/* input row — floating */}
      <div className="agw-input-wrap">
        <div className="agw-input-outer">
          <input
            ref={inputRef}
            className="agw-input"
            placeholder=""
            value={input}
            onChange={(e) => { setInput(e.target.value); }}
            onKeyDown={(e) => { if (e.key === "Enter") { void sendMessage(input); } }}
          />
          <div className="agw-input-toolbar">
            <div className="agw-input-toolbar-left">
              <button type="button" className="agw-toolbar-btn" aria-label="추가"><IconPlus /></button>
              <button type="button" className="agw-toolbar-model" aria-label="모델 선택">
                p0 <IconChevron />
              </button>
              <button type="button" className="agw-toolbar-model" aria-label="분석 깊이">
                Deep <IconChevron />
              </button>
            </div>
            <button
              type="button"
              className="agw-send-btn"
              onClick={() => { void sendMessage(input); }}
              disabled={!input.trim() || typing}
            >
              <IconSend />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
