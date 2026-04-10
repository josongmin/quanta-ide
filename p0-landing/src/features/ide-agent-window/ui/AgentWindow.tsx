import { useEffect, useRef, useState, useCallback } from "react";
import { useAgentWindow, AGENT_QUERIES, type AgentSession } from "../model/useAgentWindow";

const MIN_W = 400;
const MIN_H = 300;
const INIT_W = 660;
const INIT_H = 560;

/* ─────────────────────────────────────────────
   Drag
───────────────────────────────────────────── */
function useDrag(initialPos: { x: number; y: number }) {
  const [pos, setPos] = useState(initialPos);
  const dragging = useRef(false);
  const origin = useRef({ mx: 0, my: 0, px: 0, py: 0 });

  const onMouseDown = (e: React.MouseEvent) => {
    dragging.current = true;
    origin.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y };
    e.preventDefault();
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      setPos({ x: origin.current.px + (e.clientX - origin.current.mx), y: origin.current.py + (e.clientY - origin.current.my) });
    };
    const onUp = () => { dragging.current = false; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  return { pos, setPos, onMouseDown };
}

/* ─────────────────────────────────────────────
   Resize
───────────────────────────────────────────── */
type ResizeEdge = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
const CURSORS: Record<ResizeEdge, string> = { n:"n-resize",s:"s-resize",e:"e-resize",w:"w-resize",ne:"ne-resize",nw:"nw-resize",se:"se-resize",sw:"sw-resize" };

function useResize(initialSize: { w: number; h: number }, pos: { x: number; y: number }, setPos: (p:{x:number;y:number})=>void) {
  const [size, setSize] = useState(initialSize);
  const resizing = useRef<ResizeEdge | null>(null);
  const origin = useRef({ mx: 0, my: 0, w: 0, h: 0, px: 0, py: 0 });

  const onResizeMouseDown = useCallback((e: React.MouseEvent, edge: ResizeEdge) => {
    e.preventDefault(); e.stopPropagation();
    resizing.current = edge;
    origin.current = { mx: e.clientX, my: e.clientY, w: size.w, h: size.h, px: pos.x, py: pos.y };
  }, [size, pos]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const edge = resizing.current; if (!edge) return;
      const dx = e.clientX - origin.current.mx;
      const dy = e.clientY - origin.current.my;
      let newW = origin.current.w, newH = origin.current.h, newX = origin.current.px, newY = origin.current.py;
      if (edge.includes("e")) newW = Math.max(MIN_W, origin.current.w + dx);
      if (edge.includes("s")) newH = Math.max(MIN_H, origin.current.h + dy);
      if (edge.includes("w")) { newW = Math.max(MIN_W, origin.current.w - dx); newX = origin.current.px + (origin.current.w - newW); }
      if (edge.includes("n")) { newH = Math.max(MIN_H, origin.current.h - dy); newY = origin.current.py + (origin.current.h - newH); }
      setSize({ w: newW, h: newH });
      setPos({ x: newX, y: newY });
    };
    const onUp = () => { resizing.current = null; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [setPos]);

  return { size, onResizeMouseDown };
}

/* ─────────────────────────────────────────────
   Chat message types
───────────────────────────────────────────── */
type CodeBlock = { lang: string; file?: string; code: string };
type MetricItem = { label: string; value: string | number; risk?: boolean };
type BulletItem = string;
type ArtifactItem = string;

type MsgContent =
  | { type: "text"; text: string }
  | { type: "code"; block: CodeBlock }
  | { type: "metrics"; items: MetricItem[] }
  | { type: "bullets"; items: BulletItem[] }
  | { type: "artifacts"; items: ArtifactItem[] };

type ChatMsg = { id: string; role: "user" | "agent"; parts: MsgContent[] };

/* ─────────────────────────────────────────────
   Rule-based reply builder
───────────────────────────────────────────── */
function buildReply(question: string): ChatMsg[] {
  // Match against known queries
  const q = AGENT_QUERIES.find((aq) =>
    question.toLowerCase().includes(aq.id.replace("-", " ")) ||
    question === aq.question
  ) ?? AGENT_QUERIES[0];

  const a = q.answer;

  return [
    {
      id: `agent-${Date.now()}`,
      role: "agent",
      parts: [
        { type: "text", text: a.body },
        {
          type: "metrics",
          items: [
            { label: "TRACE HOPS", value: a.traceHops },
            { label: "RISK SCORE", value: a.riskScore, risk: true },
            { label: "WRITERS", value: a.writers },
          ],
        },
        { type: "text", text: `**${a.headline}**` },
        { type: "bullets", items: a.bullets },
        {
          type: "code",
          block: {
            lang: "typescript",
            file: "refund.ts:7-9",
            code: [
              `<span class="agw-code-cmt">// idempotency key dropped here ↓</span>`,
              `<span class="agw-code-kw">const</span> validated = <span class="agw-code-fn">parse</span>(amount);`,
              `<span class="agw-code-kw">const</span> tx = <span class="agw-code-fn">build</span>(validated); <span class="agw-code-cmt">// no key passed</span>`,
              `<span class="agw-code-kw">await</span> db.<span class="agw-code-fn">update</span>(tx); <span class="agw-code-cmt">// ← can run twice</span>`,
            ].join("\n"),
          },
        },
        { type: "artifacts", items: a.artifacts },
      ],
    },
  ];
}

/* ─────────────────────────────────────────────
   Icons
───────────────────────────────────────────── */
function IconClose() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  );
}
function IconSend() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="19" x2="12" y2="5" />
      <polyline points="5 12 12 5 19 12" />
    </svg>
  );
}
function IconChevron() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}
function IconPlus() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
function Dot() {
  return <span style={{ width:5,height:5,borderRadius:"50%",background:"var(--accent)",display:"inline-block",flexShrink:0,marginTop:6 }} />;
}

/* ─────────────────────────────────────────────
   Session tab bar
───────────────────────────────────────────── */
function SessionTabs({
  sessions,
  activeId,
  onSwitch,
  onClose,
  onNew,
}: {
  sessions: AgentSession[];
  activeId: string;
  onSwitch: (id: string) => void;
  onClose: (id: string) => void;
  onNew: () => void;
}) {
  return (
    <div className="agw-session-tabs">
      <div className="agw-session-tab-list">
        {sessions.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`agw-session-tab${s.id === activeId ? " is-active" : ""}`}
            onClick={() => onSwitch(s.id)}
            title={s.title}
          >
            <span className="agw-session-tab-title">
              {s.title.length > 22 ? `${s.title.slice(0, 22)}…` : s.title}
            </span>
            {sessions.length > 1 && (
              <span
                className="agw-session-tab-close"
                role="button"
                tabIndex={0}
                aria-label="세션 닫기"
                onClick={(e) => { e.stopPropagation(); onClose(s.id); }}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); onClose(s.id); } }}
              >
                <IconClose />
              </span>
            )}
          </button>
        ))}
      </div>
      <button type="button" className="agw-session-new" onClick={onNew} aria-label="새 세션">
        <IconPlus />
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Message renderer
───────────────────────────────────────────── */
function MsgPart({ part }: { part: MsgContent }) {
  if (part.type === "text") {
    // Bold via **…**
    const html = part.text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    return <span style={{ display:"block" }} dangerouslySetInnerHTML={{ __html: html }} />;
  }
  if (part.type === "metrics") {
    return (
      <div className="agw-inline-metrics">
        {part.items.map((m) => (
          <div key={m.label} className="agw-inline-metric">
            <div className="agw-inline-metric-label">{m.label}</div>
            <div className={`agw-inline-metric-val${m.risk ? " is-risk" : ""}`}>{m.value}</div>
          </div>
        ))}
      </div>
    );
  }
  if (part.type === "bullets") {
    return (
      <div className="agw-chat-bullets">
        {part.items.map((b) => (
          <div key={b} className="agw-chat-bullet"><Dot /><span>{b}</span></div>
        ))}
      </div>
    );
  }
  if (part.type === "code") {
    return (
      <div className="agw-code-block">
        <div className="agw-code-block-header">
          {part.block.lang}
          {part.block.file && <span>{part.block.file}</span>}
        </div>
        <pre dangerouslySetInnerHTML={{ __html: part.block.code }} />
      </div>
    );
  }
  if (part.type === "artifacts") {
    return (
      <div className="agw-chat-artifacts">
        {part.items.map((a) => (
          <button key={a} type="button" className="agw-artifact-chip">{a}</button>
        ))}
      </div>
    );
  }
  return null;
}

/* ─────────────────────────────────────────────
   Initial messages
───────────────────────────────────────────── */
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

/* ─────────────────────────────────────────────
   Minimized bubble (draggable)
───────────────────────────────────────────── */
/* 버블 위치 기준으로 창이 들어갈 수 있는 최적 위치 계산 */
function smartPos(bx: number, by: number, w: number, h: number): { x: number; y: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const PAD = 12;
  const BUBBLE = 48;

  // 후보 위치: 버블 기준 상하좌우
  const candidates = [
    { x: bx + BUBBLE + PAD,        y: by - h / 2 },          // 오른쪽
    { x: bx - w - PAD,             y: by - h / 2 },          // 왼쪽
    { x: bx - w / 2,               y: by - h - PAD },        // 위
    { x: bx - w / 2,               y: by + BUBBLE + PAD },   // 아래
  ];

  const fits = (p: { x: number; y: number }) =>
    p.x >= PAD && p.y >= PAD && p.x + w <= vw - PAD && p.y + h <= vh - PAD;

  const clamp = (p: { x: number; y: number }) => ({
    x: Math.min(Math.max(p.x, PAD), vw - w - PAD),
    y: Math.min(Math.max(p.y, PAD), vh - h - PAD),
  });

  return clamp(candidates.find(fits) ?? candidates[0]);
}

function BubbleIcon({ initialPos, onExpand }: { initialPos: { x: number; y: number }; onExpand: (pos: { x: number; y: number }) => void }) {
  const [bpos, setBpos] = useState(initialPos);
  const dragging = useRef(false);
  const moved = useRef(false);
  const origin = useRef({ mx: 0, my: 0, px: 0, py: 0 });

  const onMouseDown = (e: React.MouseEvent) => {
    dragging.current = true;
    moved.current = false;
    origin.current = { mx: e.clientX, my: e.clientY, px: bpos.x, py: bpos.y };
    e.preventDefault();
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const dx = e.clientX - origin.current.mx;
      const dy = e.clientY - origin.current.my;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved.current = true;
      setBpos({ x: origin.current.px + dx, y: origin.current.py + dy });
    };
    const onUp = () => {
      if (dragging.current && !moved.current) {
        onExpand(smartPos(bpos.x, bpos.y, INIT_W, INIT_H));
      }
      dragging.current = false;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [onExpand, bpos]);

  return (
    <div
      className="agw-bubble"
      style={{ transform: `translate(${bpos.x}px, ${bpos.y}px)` }}
      onMouseDown={onMouseDown}
      role="button"
      tabIndex={0}
      aria-label="에이전트 열기"
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onExpand(smartPos(bpos.x, bpos.y, INIT_W, INIT_H)); }}
    >
      {/* robot icon */}
      <svg className="agw-robot-svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="8" width="18" height="12" rx="3" />
        <g className="agw-robot-eye" style={{ transformOrigin: "9.25px 12.25px" }}>
          <rect x="8" y="11" width="2.5" height="2.5" rx="0.6" fill="currentColor" stroke="none" />
        </g>
        <g className="agw-robot-eye" style={{ transformOrigin: "14.75px 12.25px" }}>
          <rect x="13.5" y="11" width="2.5" height="2.5" rx="0.6" fill="currentColor" stroke="none" />
        </g>
        <line x1="9.5" y1="17" x2="14.5" y2="17" strokeWidth="1.8" />
        <line x1="12" y1="8" x2="12" y2="5" />
        <circle cx="12" cy="3.8" r="1.2" fill="currentColor" stroke="none" />
        <line x1="3" y1="13" x2="1.2" y2="13" strokeWidth="2" />
        <line x1="21" y1="13" x2="22.8" y2="13" strokeWidth="2" />
      </svg>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Main
───────────────────────────────────────────── */
/* per-session chat state, keyed by session id */
type SessionChat = { messages: ChatMsg[]; typing: boolean };

export function AgentWindow() {
  const { isOpen, minimized, close, minimize, expand, sessions, activeSessionId, newSession, switchSession, closeSession, updateSessionTitle } = useAgentWindow();
  const { pos, setPos, onMouseDown } = useDrag({ x: Math.max(0, window.innerWidth / 2 - INIT_W / 2), y: 60 });
  const { size, onResizeMouseDown } = useResize({ w: INIT_W, h: INIT_H }, pos, setPos);
  const rootRef = useRef<HTMLDivElement>(null);

  const [sessionChats, setSessionChats] = useState<Record<string, SessionChat>>({
    [activeSessionId]: { messages: INITIAL_MESSAGES, typing: false },
  });
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentChat: SessionChat = sessionChats[activeSessionId] ?? { messages: [], typing: false };
  const messages = currentChat.messages;
  const typing = currentChat.typing;

  const setCurrentChat = useCallback((updater: (prev: SessionChat) => SessionChat) => {
    setSessionChats((prev) => {
      const current = prev[activeSessionId] ?? { messages: [], typing: false };
      return { ...prev, [activeSessionId]: updater(current) };
    });
  }, [activeSessionId]);

  // reset input when switching sessions
  useEffect(() => { setInput(""); }, [activeSessionId]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, close]);

  // minimize on outside click
  useEffect(() => {
    if (!isOpen || minimized) return;
    const handler = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        minimize();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen, minimized, minimize]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  const sendMessage = useCallback((text: string) => {
    if (!text.trim() || typing) return;
    const userMsg: ChatMsg = { id: `u-${Date.now()}`, role: "user", parts: [{ type: "text", text }] };
    setCurrentChat((prev) => ({ ...prev, messages: [...prev.messages, userMsg], typing: true }));
    setInput("");

    // set session title from first user message
    const isFirstMsg = (sessionChats[activeSessionId]?.messages ?? []).filter((m) => m.role === "user").length === 0;
    if (isFirstMsg) { updateSessionTitle(activeSessionId, text); }

    setTimeout(() => {
      const replies = buildReply(text);
      setCurrentChat((prev) => ({ messages: [...prev.messages, ...replies], typing: false }));
    }, 900 + Math.random() * 400);
  }, [typing, activeSessionId, sessionChats, setCurrentChat, updateSessionTitle]);

  if (!isOpen) return null;

  // minimized bubble
  if (minimized) {
    return (
      <BubbleIcon
        initialPos={{ x: pos.x + size.w - 52, y: pos.y + size.h - 52 }}
        onExpand={(newPos) => { setPos(newPos); expand(); }}
      />
    );
  }

  return (
    <div
      ref={rootRef}
      className="agw-root"
      style={{ transform: `translate(${pos.x}px,${pos.y}px)`, width: size.w, height: size.h }}
      role="dialog"
      aria-modal="false"
      aria-label="P0 Agent"
    >
      {/* resize handles */}
      {(["n","s","e","w","ne","nw","se","sw"] as ResizeEdge[]).map((edge) => (
        <div
          key={edge}
          className={`agw-resize-handle agw-resize-${edge}`}
          style={{ cursor: CURSORS[edge] }}
          onMouseDown={(e) => onResizeMouseDown(e, edge)}
        />
      ))}

      {/* header */}
      <header className="agw-header" onMouseDown={onMouseDown}>
        <div className="agw-header-left">
          <span className="agw-repo-name">acme/payments-api</span>
        </div>
        <button type="button" className="agw-close" onClick={close} aria-label="Close">
          <IconClose />
        </button>
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
            <div className="agw-msg-role">{msg.role === "agent" ? "P0" : "You"}</div>
            <div className="agw-msg-bubble">
              {msg.parts.map((part, i) => <MsgPart key={i} part={part} />)}
            </div>
          </div>
        ))}

        {typing && (
          <div className="agw-msg is-agent">
            <div className="agw-msg-role">P0</div>
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
          {SUGGESTIONS.map((s) => (
            <button key={s} type="button" className="agw-suggestion-chip" onClick={() => sendMessage(s)}>
              {s}
            </button>
          ))}
        </div>
      )}

      {/* input row */}
      <div className="agw-input-wrap">
        <div className="agw-input-outer">
          <input
            ref={inputRef}
            className="agw-input"
            placeholder=""
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") sendMessage(input); }}
          />
          <div className="agw-input-toolbar">
            <div className="agw-input-toolbar-left">
              <button type="button" className="agw-toolbar-btn" aria-label="추가"><IconPlus /></button>
              <button type="button" className="agw-toolbar-model" aria-label="모델 선택">
                P0 <IconChevron />
              </button>
              <button type="button" className="agw-toolbar-model" aria-label="분석 깊이">
                Deep <IconChevron />
              </button>
            </div>
            <button type="button" className="agw-send-btn" onClick={() => sendMessage(input)} disabled={!input.trim() || typing}>
              <IconSend />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
