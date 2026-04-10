import { create } from "zustand";

export interface AgentSession {
  id: string;
  title: string; // first user message, truncated
  messages: AgentChatMsg[];
}

export interface AgentChatMsg {
  id: string;
  role: "user" | "agent";
  text: string; // simplified for model layer
}

export interface AgentQuery {
  id: string;
  question: string;
  repoTag: string;
  complexity: string[];
  answer: {
    headline: string;
    traceHops: number;
    riskScore: number;
    writers: number;
    body: string;
    bullets: string[];
    artifacts: string[];
  };
  related: string[];
}

export const AGENT_QUERIES: AgentQuery[] = [
  {
    id: "double-refund",
    question: "Which path can double-refund a customer?",
    repoTag: "LEGACY MONOLITH",
    complexity: [
      "14-file webhook chain",
      "3 payment providers",
      "7 refund states",
      "2 retry loops",
      "9 shared DB writes",
      "No ownership docs",
    ],
    answer: {
      headline: "Duplicate refund path across PayPal retry + ledger replay",
      traceHops: 14,
      riskScore: 0.92,
      writers: 6,
      body: "p0 follows the same refund intent through webhook ingestion, idempotency storage, and ledger reconciliation to show where replay protection quietly disappears.",
      bullets: [
        "Highlights the branch where the idempotency key is dropped",
        "Shows the ledger write that can be reached twice",
        "Ranks the three files most likely to own the bug",
      ],
      artifacts: ["Transaction path graph", "Conflicting state writer list", "Top 3 risky files"],
    },
    related: ["Who actually owns refund state?", "What breaks if webhook ordering changes?"],
  },
  {
    id: "owns-refund",
    question: "Who actually owns refund state?",
    repoTag: "LEGACY MONOLITH",
    complexity: [
      "6 contributors",
      "No CODEOWNERS",
      "4 implicit owners",
      "Last touched 2mo ago",
      "3 conflicting writers",
    ],
    answer: {
      headline: "Ownership is split across 3 teams with no explicit boundary",
      traceHops: 6,
      riskScore: 0.74,
      writers: 3,
      body: "p0 maps git blame, call-graph ownership, and PR authorship to reconstruct the implicit ownership graph. No single team controls the full refund state machine.",
      bullets: [
        "alice (payments) owns processRefund entry point",
        "bob (infra) last touched db.update and ledger paths",
        "webhooks team implicitly controls retry logic",
      ],
      artifacts: ["Ownership heat map", "Contributor blame timeline", "Implicit boundary graph"],
    },
    related: ["Which path can double-refund a customer?", "What breaks if webhook ordering changes?"],
  },
  {
    id: "webhook-order",
    question: "What breaks if webhook ordering changes?",
    repoTag: "LEGACY MONOLITH",
    complexity: [
      "14-file webhook chain",
      "Order-dependent state",
      "No ordering contract",
      "5 downstream consumers",
    ],
    answer: {
      headline: "Ledger reconciliation and idempotency checks assume strict ordering",
      traceHops: 9,
      riskScore: 0.81,
      writers: 4,
      body: "p0 traces execution order dependencies through the webhook chain. Three critical invariants break silently when events arrive out of sequence.",
      bullets: [
        "Idempotency check runs before state is persisted — reorder breaks dedup",
        "Ledger replay assumes charge precedes refund — swap causes negative balance",
        "sendWebhook fires before db.update in retry path — consumers see stale state",
      ],
      artifacts: ["Ordering dependency graph", "Invariant violation list", "Affected consumer list"],
    },
    related: ["Which path can double-refund a customer?", "Who actually owns refund state?"],
  },
];

export const REPO_STATS = {
  files: "1,284",
  lines: "92.4k",
  deps: "47",
  age: "5y",
};

const INIT_SESSION_ID = "session-1";

export interface Vec2 { x: number; y: number }

interface AgentWindowState {
  isOpen: boolean;
  minimized: boolean;
  hasInteracted: boolean;
  activeQueryId: string;
  expandedQueryId: string | null;
  sessions: AgentSession[];
  activeSessionId: string;
  /** outside-click 좌표 + 마우스 이동 방향 */
  minimizeAt: { pos: Vec2; vel: Vec2 } | null;
  open: () => void;
  close: () => void;
  toggle: () => void;
  minimize: (at?: { pos: Vec2; vel: Vec2 }) => void;
  expand: () => void;
  setInteracted: () => void;
  setActiveQuery: (id: string) => void;
  toggleExpand: (id: string) => void;
  newSession: () => void;
  switchSession: (id: string) => void;
  closeSession: (id: string) => void;
  updateSessionTitle: (id: string, title: string) => void;
}

export const useAgentWindow = create<AgentWindowState>()((set) => ({
  isOpen: false,
  minimized: false,
  hasInteracted: false,
  activeQueryId: "double-refund",
  expandedQueryId: "double-refund",
  sessions: [{ id: INIT_SESSION_ID, title: "Which path can double-refund a customer?", messages: [] }],
  activeSessionId: INIT_SESSION_ID,
  minimizeAt: null,
  open:     () => { set({ isOpen: true, minimized: false }); },
  close:    () => { set({ isOpen: false }); },
  toggle:   () => { set((s) => ({ isOpen: !s.isOpen, minimized: false })); },
  minimize: (at?) => { set({ minimized: true, minimizeAt: at ?? null }); },
  expand:   () => { set({ minimized: false, minimizeAt: null }); },
  setInteracted: () => { set({ hasInteracted: true, isOpen: true, minimized: false }); },
  setActiveQuery: (id) => { set({ activeQueryId: id, expandedQueryId: id }); },
  toggleExpand: (id) => {
    set((s) => ({ expandedQueryId: s.expandedQueryId === id ? null : id }));
  },
  newSession: () => {
    const id = `session-${Date.now()}`;
    set((s) => ({
      sessions: [...s.sessions, { id, title: "새 세션", messages: [] }],
      activeSessionId: id,
    }));
  },
  switchSession: (id) => { set({ activeSessionId: id }); },
  closeSession: (id) => {
    set((s) => {
      if (s.sessions.length <= 1) return s;
      const next = s.sessions.filter((ss) => ss.id !== id);
      const activeSessionId = s.activeSessionId === id
        ? (next[next.length - 1]?.id ?? next[0]?.id)
        : s.activeSessionId;
      return { sessions: next, activeSessionId };
    });
  },
  updateSessionTitle: (id, title) => {
    set((s) => ({
      sessions: s.sessions.map((ss) => ss.id === id ? { ...ss, title } : ss),
    }));
  },
}));
