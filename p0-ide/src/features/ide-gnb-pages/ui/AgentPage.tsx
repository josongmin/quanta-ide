import { useState, useRef, useEffect, useCallback } from "react";

/* ── Types ── */
interface ChatSession {
  id: string;
  title: string;
  time: string;
  messages: ChatMessage[];
}

interface ChatMessage {
  id: string;
  role: "user" | "agent";
  text: string;
  streaming?: boolean;
}

/* ── Agent response pool — picked at random, streamed char-by-char ── */
const RESPONSE_POOL: Record<string, string[]> = {
  // Pattern-matched responses
  "refund": [
    "I traced the refund flow through **14 files** in the webhook chain.\n\n**Root cause:** `orchestrator.py:73` — the retry loop re-invokes `execute()` without checking the idempotency key. The ledger write at `ledger.py:45` can execute twice.\n\n```\nwebhook.py → retry_handler.py → orchestrator.py:execute()\n  → ledger.py:updateLedger()  ← NO DEDUP CHECK\n```\n\n**Impact:** 38 files · 6 writers · risk **0.92**\n\nTop 3 files to fix:\n1. `orchestrator.py` — retry condition (L73)\n2. `ledger.py` — unguarded write (L45)\n3. `retry_handler.py` — missing idempotency pass-through",
  ],
  "fix": [
    "On it. Here's the patch:\n\n```diff\n  # retry_handler.py\n+ from shared.idempotency import IdempotencyGuard\n+\n  async def retry_with_backoff(task):\n+     guard = IdempotencyGuard(task.idempotency_key)\n+     if guard.already_processed:\n+         return CachedResult(guard.previous_result)\n+\n      result = await orchestrator.execute(task)\n+     guard.mark_processed(task.idempotency_key, result)\n      return result\n```\n\n**3 files changed** · +47 -12 lines\n✅ TAINT-001 pass · ✅ AUTH-003 pass\n✅ Tests: 2/12 pass · 0 fail",
  ],
  "test": [
    "Generating tests for edge cases...\n\n```python\ndef test_duplicate_key_returns_cached():\n    guard = IdempotencyGuard(\"key-123\")\n    guard.mark_processed(\"key-123\", Result(amount=100))\n    assert guard.already_processed is True\n    assert guard.previous_result.amount == 100\n\ndef test_expired_key_reprocesses():\n    guard = IdempotencyGuard(\"key-old\", ttl=0)\n    guard.mark_processed(\"key-old\", Result(amount=50))\n    assert guard.already_processed is False\n\ndef test_concurrent_writes_are_serialized():\n    results = await asyncio.gather(\n        process_with_guard(\"key-race\"),\n        process_with_guard(\"key-race\"),\n    )\n    assert sum(1 for r in results if r.was_cached) == 1\n```\n\n**5 test cases** in `tests/test_idempotency.py`\n✅ All passing",
  ],
  "owner": [
    "Ownership is split across **3 teams** with no explicit boundary.\n\n| Owner | Scope | Last Touch |\n|-------|-------|------------|\n| alice (payments) | `processRefund` entry point | 5d ago |\n| bob (infra) | `db.update`, ledger paths | 2w ago |\n| webhooks team | retry logic (implicit) | 3w ago |\n\n**Bus factor risk:** `webhook.py` has bus factor **1** (only bob). `shared/reasoning.py` has no CODEOWNERS entry.\n\nRecommendation: Add explicit CODEOWNERS for the 3 unowned files.",
  ],
  "security": [
    "Found **4 unsanitized taint flows** and **2 compliance failures**.\n\n**Critical paths:**\n1. `request.strategy` → `experience_store.save` (orchestrator.py:28→86) — no validation\n2. `payload.body` → `db.rawQuery` (webhook.py:12 → ledger.py:45) — SQL injection risk\n\n```\nSource: request.strategy (L28, user-controlled)\n  → parseAmount() — no sanitization\n  → buildDetail(validated) — key not checked\n  → experience_store.save() ← SINK\n```\n\n**Compliance:** TAINT-001 FAIL, CRYPTO-002 FAIL\n\nWant me to add input validation to both paths?",
  ],
  "architecture": [
    "Detected **3 architectural violations** in the dependency graph:\n\n1. **Circular dependency:** `orchestrator.py` ↔ `fee.py` (coupling: 0.92)\n2. **Layer violation:** `webhook.py` (infrastructure) imports from `orchestrator.py` (domain)\n3. **High coupling:** `shared/reasoning.py` → `orchestrator.py` (0.85, threshold 0.8)\n\n```\n  infrastructure/\n    webhook.py ──┐\n    fee.py ──────┤── should not import ──→ orchestrator/\n  shared/        │\n    reasoning.py ┘\n```\n\nThe call-edge graph shows 13 edges, 4 of which violate the dependency direction rule.",
  ],
  "dead": [
    "Found **8 dead symbols** across the codebase:\n\n| Symbol | File | Confidence | Reason |\n|--------|------|-----------|--------|\n| `_legacy_inference_bridge` | orchestrator.py | 95% | Zero call-graph references since v7→v8 migration |\n| `OldRetryPolicy` | orchestrator.py | 92% | Replaced by `RetryScheduler` in PR #312 |\n| `TEMP_FEATURE_FLAG` | orchestrator.py | 88% | Permanently enabled, gate always passes |\n\nTotal dead code: **~340 lines** (3.7% of codebase)\n\nSafe to remove the top 3. Want me to generate a cleanup PR?",
  ],
};

/* Generic fallback responses */
const GENERIC_RESPONSES = [
  "Let me analyze the codebase for that.\n\nI'm tracing through the call graph and data flow to find the relevant paths. The `payments-api` repo has 1,284 files and 61 symbols indexed.\n\nHere's what I found:\n- **12 files** are directly relevant to your query\n- **3 call chains** involve the pattern you described\n- Risk score for this area: **0.67**\n\nWant me to dig deeper into any specific path?",
  "Looking at the code structure...\n\nThe function you're asking about has:\n- Cyclomatic complexity: **6.4**\n- 3 callers, 5 callees\n- Last modified 12 days ago by alice\n- Test coverage: **42%** (3 of 7 branches uncovered)\n\n```python\n# Uncovered branches:\nL45: if amount <= 0:  # never tested\nL52: except TimeoutError:  # never tested  \nL67: elif retry_count > MAX:  # never tested\n```\n\nShould I generate tests for the uncovered branches?",
  "I ran a blast radius analysis on that change.\n\n**Direct impact:** 4 files\n**Transitive impact:** 23 files (via call graph)\n**Cross-service:** 2 downstream services affected\n\nThe highest-risk propagation path:\n```\nyour change → orchestrator.execute()\n  → ledger.updateLedger() (coupling: 0.92)\n  → webhook.sendNotification() (coupling: 0.71)\n  → [payments-gateway service] (external)\n```\n\n⚠️ The payments-gateway service has no contract test for this path.\n\nWant me to check if there are existing tests that cover this?",
  "Interesting question. Let me trace the data flow.\n\nI found **6 taint paths** through this area. Here's the critical one:\n\n```\nSource: user input (request.body)\n  → L12: parsed without validation\n  → L28: passed to business logic\n  → L45: reaches database query ← SINK\n  Sanitization: NONE\n```\n\nThis is a **TAINT-001** violation (unsanitized user input reaching sensitive sink).\n\nThe fix is straightforward — add validation at L12. Want me to generate the patch?",
];

/* ── Helpers ── */
function pickResponse(userText: string): string {
  const lower = userText.toLowerCase();
  for (const [keyword, responses] of Object.entries(RESPONSE_POOL)) {
    if (lower.includes(keyword)) {
      return responses[Math.floor(Math.random() * responses.length)];
    }
  }
  return GENERIC_RESPONSES[Math.floor(Math.random() * GENERIC_RESPONSES.length)];
}

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

const STREAM_SPEED = 12; // ms per character

/* ── Initial sessions with pre-filled history ── */
function createInitialSessions(): ChatSession[] {
  return [
    {
      id: "s1",
      title: "Double refund path analysis",
      time: "12m ago",
      messages: [
        { id: "1", role: "user", text: "Which path can double-refund a customer?" },
        { id: "2", role: "agent", text: "I traced the refund flow through **14 files** in the webhook chain.\n\n**Root cause:** `orchestrator.py:73` — the retry loop re-invokes `execute()` without checking the idempotency key.\n\n```\nwebhook.py → retry_handler.py → orchestrator.py:execute()\n  → ledger.py:updateLedger()  ← NO DEDUP CHECK\n```\n\n**Impact:** 38 files · 6 writers · risk **0.92**" },
      ],
    },
    {
      id: "s2",
      title: "Idempotency guard tests",
      time: "28m ago",
      messages: [
        { id: "1", role: "user", text: "Write unit tests for the idempotency guard." },
        { id: "2", role: "agent", text: "```python\ndef test_duplicate_key_returns_cached():\n    guard = IdempotencyGuard(\"key-123\")\n    guard.mark_processed(\"key-123\", Result(amount=100))\n    assert guard.already_processed is True\n```\n\n**5 test cases** generated." },
      ],
    },
    { id: "s3", title: "Webhook async migration", time: "1h ago", messages: [] },
    { id: "s4", title: "Coverage gap analysis", time: "3h ago", messages: [] },
  ];
}

/* ── Component ── */
export function AgentPage() {
  const [sessions, setSessions] = useState<ChatSession[]>(createInitialSessions);
  const [activeSessionId, setActiveSessionId] = useState("s1");
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const streamAbort = useRef(false);

  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const messages = activeSession?.messages ?? [];

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages.length, scrollToBottom]);

  /* Stream a response character by character */
  const streamResponse = useCallback((sessionId: string, fullText: string) => {
    setStreaming(true);
    streamAbort.current = false;
    const agentMsgId = makeId();

    // Add empty agent message
    setSessions((prev) => prev.map((s) =>
      s.id === sessionId
        ? { ...s, messages: [...s.messages, { id: agentMsgId, role: "agent" as const, text: "", streaming: true }] }
        : s,
    ));

    let charIdx = 0;
    const tick = () => {
      if (streamAbort.current) { setStreaming(false); return; }
      charIdx += 1 + Math.floor(Math.random() * 2); // 1-3 chars at a time for natural feel
      if (charIdx >= fullText.length) charIdx = fullText.length;

      setSessions((prev) => prev.map((s) =>
        s.id === sessionId
          ? {
              ...s,
              messages: s.messages.map((m) =>
                m.id === agentMsgId
                  ? { ...m, text: fullText.slice(0, charIdx), streaming: charIdx < fullText.length }
                  : m,
              ),
            }
          : s,
      ));

      if (charIdx < fullText.length) {
        setTimeout(tick, STREAM_SPEED + Math.random() * 8);
      } else {
        setStreaming(false);
      }
    };
    setTimeout(tick, 300 + Math.random() * 400); // initial "thinking" delay
  }, []);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");

    const userMsg: ChatMessage = { id: makeId(), role: "user", text };

    // Update session title if first message
    setSessions((prev) => prev.map((s) =>
      s.id === activeSessionId
        ? {
            ...s,
            title: s.messages.length === 0 ? text.slice(0, 50) : s.title,
            time: "just now",
            messages: [...s.messages, userMsg],
          }
        : s,
    ));

    // Pick and stream response
    const response = pickResponse(text);
    setTimeout(() => { streamResponse(activeSessionId, response); }, 100);
  }, [input, streaming, activeSessionId, streamResponse]);

  const handleNewSession = useCallback(() => {
    const id = `s-${makeId()}`;
    const newSession: ChatSession = { id, title: "New chat", time: "now", messages: [] };
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(id);
    setInput("");
  }, []);

  return (
    <div className="gnb-page gnb-agent" style={{ padding: 0, display: "flex", overflow: "hidden" }}>
      {/* ── Sidebar ── */}
      <aside className="gnb-agent-sidebar">
        <div className="gnb-agent-sidebar-header">
          <button type="button" className="gnb-agent-new-btn" onClick={handleNewSession}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Agent
          </button>
        </div>
        <nav className="gnb-agent-sessions">
          {sessions.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`gnb-agent-session${activeSessionId === s.id ? " is-active" : ""}`}
              onClick={() => { setActiveSessionId(s.id); }}
            >
              <span className="gnb-agent-session-title">{s.title}</span>
              <span className="gnb-agent-session-meta">{s.time}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* ── Chat ── */}
      <main className="gnb-agent-main">
        <div className="gnb-agent-messages">
          {messages.length === 0 ? (
            <div className="gnb-agent-empty">
              <div className="gnb-agent-empty-icon">p0</div>
              <p>Ask anything about your codebase.</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className={`gnb-agent-msg gnb-agent-msg--${msg.role}`}>
                <div className="gnb-agent-msg-avatar">
                  {msg.role === "user" ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                    </svg>
                  ) : (
                    <span className="gnb-agent-msg-logo">p0</span>
                  )}
                </div>
                <div className="gnb-agent-msg-body">
                  {msg.text.split("```").map((block, i) => {
                    if (i % 2 === 1) {
                      const lines = block.split("\n");
                      const lang = lines[0] || "";
                      const code = lines.slice(lang ? 1 : 0).join("\n");
                      return <pre key={i} data-lang={lang}>{code}</pre>;
                    }
                    return block.split("\n\n").map((para, j) => (
                      <p key={`${i}-${j}`}>{para}</p>
                    ));
                  })}
                  {msg.streaming && <span className="gnb-agent-cursor">▊</span>}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="gnb-agent-input-bar">
          <input
            className="gnb-agent-input"
            type="text"
            placeholder="Send a message..."
            value={input}
            onChange={(e) => { setInput(e.target.value); }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSend();
              if (e.key === "Enter" && !e.shiftKey && !e.metaKey && !e.ctrlKey) { e.preventDefault(); handleSend(); }
            }}
            disabled={streaming}
          />
          <kbd className="gnb-agent-input-kbd">{streaming ? "..." : "↵"}</kbd>
        </div>
      </main>
    </div>
  );
}
