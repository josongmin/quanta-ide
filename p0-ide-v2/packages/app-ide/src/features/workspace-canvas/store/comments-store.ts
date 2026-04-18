import { useSyncExternalStore } from "react";

// Threaded comments — pinned to a file / edge / canvas-position.
// Persisted to localStorage so a refresh keeps the review thread alive.

export type CommentTargetKind = "file" | "edge" | "canvas";

export interface CommentMessage {
  id: string;
  author: string;
  body: string;
  createdAt: number;
  mentions: readonly string[];
}

export interface CommentThread {
  id: string;
  targetKind: CommentTargetKind;
  targetId: string;
  posX: number;
  posY: number;
  messages: readonly CommentMessage[];
  resolved: boolean;
  locked: boolean;
  createdAt: number;
}

export interface CommentsState {
  threads: readonly CommentThread[];
  openThreadId: string | null;
}

const STORAGE_KEY = "quanta.canvas.comments.v1";

function readPersisted(): CommentThread[] | null {
  try {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((t): t is CommentThread =>
      !!t
      && typeof t.id === "string"
      && typeof t.targetKind === "string"
      && typeof t.targetId === "string"
      && Array.isArray(t.messages),
    );
  } catch {
    return null;
  }
}

function writePersisted(threads: readonly CommentThread[]): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(threads));
  } catch {
    // best-effort
  }
}

let state: CommentsState = {
  threads: readPersisted() ?? [],
  openThreadId: null,
};

const listeners = new Set<() => void>();

function emit() {
  writePersisted(state.threads);
  for (const l of [...listeners]) l();
}

function getState(): CommentsState {
  return state;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

let idCounter = 0;
function makeId(prefix: string): string {
  idCounter += 1;
  const rand = Math.floor(Math.random() * 0xffffff).toString(36);
  return `${prefix}_${Date.now().toString(36)}_${idCounter.toString(36)}_${rand}`;
}

const MENTION_RE = /@([a-zA-Z0-9_-]+)/g;

function extractMentions(body: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = MENTION_RE.exec(body)) !== null) {
    const name = m[1];
    if (name && !seen.has(name)) {
      seen.add(name);
      out.push(name);
    }
  }
  return out;
}

export interface CreateThreadOpts {
  targetKind: CommentTargetKind;
  targetId: string;
  posX: number;
  posY: number;
  author?: string;
  firstMessage?: string;
}

const actions = {
  createThread(opts: CreateThreadOpts): string {
    const id = makeId("thread");
    const now = Date.now();
    const firstBody = opts.firstMessage ?? "";
    const msgs: CommentMessage[] = firstBody.length > 0
      ? [{
        id: makeId("msg"),
        author: opts.author ?? "you",
        body: firstBody,
        createdAt: now,
        mentions: extractMentions(firstBody),
      }]
      : [];
    const thread: CommentThread = {
      id,
      targetKind: opts.targetKind,
      targetId: opts.targetId,
      posX: opts.posX,
      posY: opts.posY,
      messages: msgs,
      resolved: false,
      locked: false,
      createdAt: now,
    };
    state = {
      threads: [...state.threads, thread],
      openThreadId: id,
    };
    emit();
    return id;
  },

  openOnFile(fileId: string, posX: number, posY: number, author?: string): string {
    // Reuse the first unresolved thread attached to this file if present;
    // otherwise create a fresh one seeded at (posX, posY).
    const existing = state.threads.find(
      t => t.targetKind === "file" && t.targetId === fileId && !t.resolved,
    );
    if (existing) {
      state = { ...state, openThreadId: existing.id };
      emit();
      return existing.id;
    }
    return actions.createThread({
      targetKind: "file",
      targetId: fileId,
      posX,
      posY,
      author,
    });
  },

  addMessage(threadId: string, body: string, author?: string): void {
    const trimmed = body.trim();
    if (trimmed.length === 0) return;
    let changed = false;
    const next = state.threads.map(t => {
      if (t.id !== threadId) return t;
      changed = true;
      const msg: CommentMessage = {
        id: makeId("msg"),
        author: author ?? "you",
        body: trimmed,
        createdAt: Date.now(),
        mentions: extractMentions(trimmed),
      };
      return { ...t, messages: [...t.messages, msg] };
    });
    if (!changed) return;
    state = { ...state, threads: next };
    emit();
  },

  toggleResolved(threadId: string): void {
    let changed = false;
    const next = state.threads.map(t => {
      if (t.id !== threadId) return t;
      changed = true;
      return { ...t, resolved: !t.resolved };
    });
    if (!changed) return;
    state = { ...state, threads: next };
    emit();
  },

  toggleLocked(threadId: string): void {
    let changed = false;
    const next = state.threads.map(t => {
      if (t.id !== threadId) return t;
      changed = true;
      return { ...t, locked: !t.locked };
    });
    if (!changed) return;
    state = { ...state, threads: next };
    emit();
  },

  setPosition(threadId: string, x: number, y: number): void {
    let changed = false;
    const next = state.threads.map(t => {
      if (t.id !== threadId) return t;
      if (t.locked) return t;
      if (t.posX === x && t.posY === y) return t;
      changed = true;
      return { ...t, posX: x, posY: y };
    });
    if (!changed) return;
    state = { ...state, threads: next };
    emit();
  },

  remove(threadId: string): void {
    const next = state.threads.filter(t => t.id !== threadId);
    if (next.length === state.threads.length) return;
    state = {
      threads: next,
      openThreadId: state.openThreadId === threadId ? null : state.openThreadId,
    };
    emit();
  },

  setOpen(id: string | null): void {
    if (state.openThreadId === id) return;
    state = { ...state, openThreadId: id };
    emit();
  },

  reset(threads: readonly CommentThread[]): void {
    state = { threads, openThreadId: null };
    emit();
  },
};

export const commentsStore = { getState, subscribe, ...actions };

export const AVAILABLE_USERS: readonly string[] = ["alice", "bob", "charlie", "dana", "you"];

export function useCommentsStore<T>(selector: (s: CommentsState) => T): T {
  return useSyncExternalStore(
    commentsStore.subscribe,
    () => selector(commentsStore.getState()),
    () => selector(commentsStore.getState()),
  );
}

export function extractMentionsPublic(body: string): string[] {
  return extractMentions(body);
}
