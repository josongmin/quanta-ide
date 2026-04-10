import { create } from "zustand";
import type { CodeRange, Comment, CommentAuthor, CommentThread } from "./types";

interface LineCommentState {
  threads: CommentThread[];
  openThreadId: string | null;

  toggleThread: (threadId: string) => void;
  closeThread: () => void;
  createThreadForRange: (range: CodeRange) => void;
  addComment: (threadId: string, body: string, author: CommentAuthor, parentId?: string) => void;
  toggleResolve: (threadId: string) => void;
}

const SEED_RANGE: CodeRange = { startLine: 12, startCol: 0, endLine: 12, endCol: 72 };

export const useLineComment = create<LineCommentState>()((set) => ({
  threads: [
    {
      id: "t-seed-1",
      range: SEED_RANGE,
      resolved: false,
      comments: [
        {
          id: "c-1",
          parentId: null,
          author: { id: "jiyeon", name: "Jiyeon" },
          body: "This write isn't wrapped in a transaction with WorkflowResult — if save() fails mid-way we'll have a partial audit trail.",
          createdAt: new Date(Date.now() - 1000 * 60 * 47).toISOString(),
        },
        {
          id: "c-2",
          parentId: "c-1",
          author: { id: "songmin", name: "Song Min" },
          body: "Agreed. We need to wrap both writes in a single unit-of-work. I'll open a ticket.",
          createdAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
        },
      ],
    },
  ],
  openThreadId: null,

  toggleThread: (threadId) => {
    set((s) => ({ openThreadId: s.openThreadId === threadId ? null : threadId }));
  },

  closeThread: () => { set({ openThreadId: null }); },

  createThreadForRange: (range) => {
    const id = `t-${Date.now()}`;
    set((s) => ({
      threads: [...s.threads, { id, range, comments: [], resolved: false }],
      openThreadId: id,
    }));
  },

  addComment: (threadId, body, author, parentId) => {
    const newComment: Comment = {
      id: `c-${Date.now()}`,
      parentId: parentId ?? null,
      author,
      body,
      createdAt: new Date().toISOString(),
    };
    set((s) => ({
      threads: s.threads.map((t) =>
        t.id === threadId ? { ...t, comments: [...t.comments, newComment] } : t
      ),
    }));
  },

  toggleResolve: (threadId) => {
    set((s) => ({
      threads: s.threads.map((t) =>
        t.id === threadId ? { ...t, resolved: !t.resolved } : t
      ),
    }));
  },
}));

/* 상대 시간 포맷 헬퍼 */
export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
