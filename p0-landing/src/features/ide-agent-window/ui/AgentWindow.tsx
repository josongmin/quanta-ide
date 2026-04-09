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
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
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
function IconSparkle() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l2.4 7.2H22l-6.2 4.5 2.4 7.3L12 16.5l-6.2 4.5 2.4-7.3L2 9.2h7.6z" />
    </svg>
  );
}
function Dot() {
  return <span style={{ width:5,height:5,borderRadius:"50%",background:"var(--accent)",display:"inline-block",flexShrink:0,marginTop:6 }} />;
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
   Main
───────────────────────────────────────────── */
export function AgentWindow() {
  const { isOpen, close } = useAgentWindow();
  const { pos, setPos, onMouseDown } = useDrag({ x: Math.max(0, window.innerWidth / 2 - INIT_W / 2), y: 60 });
  const { size, onResizeMouseDown } = useResize({ w: INIT_W, h: INIT_H }, pos, setPos);

  const [messages, setMessages] = useState<ChatMsg[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, close]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  const sendMessage = useCallback((text: string) => {
    if (!text.trim() || typing) return;
    const userMsg: ChatMsg = { id: `u-${Date.now()}`, role: "user", parts: [{ type: "text", text }] };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setTyping(true);

    setTimeout(() => {
      setTyping(false);
      const replies = buildReply(text);
      setMessages((prev) => [...prev, ...replies]);
    }, 900 + Math.random() * 400);
  }, [typing]);

  if (!isOpen) return null;

  return (
    <div
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
          <div className="agw-repo-tag">LEGACY MONOLITH</div>
          <span className="agw-repo-name">acme/payments-api</span>
          <span className="agw-status-dot" />
          <span className="agw-status-label">인덱싱됨</span>
        </div>
        <button type="button" className="agw-close" onClick={close} aria-label="Close">
          <IconClose />
        </button>
      </header>

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
        <div className="agw-input-box">
          <IconSparkle />
          <input
            ref={inputRef}
            className="agw-input"
            placeholder="코드베이스에 대해 무엇이든 질문하세요..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") sendMessage(input); }}
          />
        </div>
        <button type="button" className="agw-send-btn" onClick={() => sendMessage(input)} disabled={!input.trim() || typing}>
          <IconSend />
        </button>
      </div>
      <div className="agw-input-hints">
        <span>질문</span><span className="agw-hint-sep">·</span>
        <span>코드 편집</span><span className="agw-hint-sep">·</span>
        <span>리팩토링</span><span className="agw-hint-sep">·</span>
        <span>임팩트 분석</span>
      </div>
    </div>
  );
}
