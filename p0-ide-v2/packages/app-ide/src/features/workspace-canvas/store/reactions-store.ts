import { useSyncExternalStore } from "react";

export type ReactionTargetKind = "file" | "edge" | "sticky" | "comment";

export interface ReactionTarget {
  kind: ReactionTargetKind;
  id: string;
}

export interface Reaction {
  id: string;
  targetKind: ReactionTargetKind;
  targetId: string;
  emoji: string;
  author: string;
  createdAt: number;
}

export interface ReactionsState {
  reactions: readonly Reaction[];
}

const STORAGE_KEY = "quanta.canvas.reactions.v1";

function readPersisted(): Reaction[] | null {
  try {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((r): r is Reaction =>
      !!r
      && typeof r.id === "string"
      && typeof r.targetKind === "string"
      && typeof r.targetId === "string"
      && typeof r.emoji === "string"
      && typeof r.author === "string"
      && typeof r.createdAt === "number",
    );
  } catch {
    return null;
  }
}

function writePersisted(reactions: readonly Reaction[]): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reactions));
  } catch {
    // best-effort
  }
}

let state: ReactionsState = { reactions: readPersisted() ?? [] };

const listeners = new Set<() => void>();

function emit() {
  writePersisted(state.reactions);
  for (const l of [...listeners]) l();
}

function getState(): ReactionsState {
  return state;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

let idCounter = 0;
function makeId(): string {
  idCounter += 1;
  const rand = Math.floor(Math.random() * 0xffffff).toString(36);
  return `r_${Date.now().toString(36)}_${idCounter.toString(36)}_${rand}`;
}

const actions = {
  react(target: ReactionTarget, emoji: string, author: string): string | null {
    // Toggle: if the same (target, author, emoji) already exists, remove it
    // so a second click acts as un-react.
    const existing = state.reactions.find(r =>
      r.targetKind === target.kind
      && r.targetId === target.id
      && r.emoji === emoji
      && r.author === author,
    );
    if (existing) {
      actions.unreact(existing.id);
      return null;
    }
    const r: Reaction = {
      id: makeId(),
      targetKind: target.kind,
      targetId: target.id,
      emoji,
      author,
      createdAt: Date.now(),
    };
    state = { reactions: [...state.reactions, r] };
    emit();
    return r.id;
  },

  unreact(id: string): void {
    const next = state.reactions.filter(r => r.id !== id);
    if (next.length === state.reactions.length) return;
    state = { reactions: next };
    emit();
  },

  listFor(target: ReactionTarget): readonly Reaction[] {
    return state.reactions.filter(
      r => r.targetKind === target.kind && r.targetId === target.id,
    );
  },

  reset(): void {
    if (state.reactions.length === 0) return;
    state = { reactions: [] };
    emit();
  },
};

export const reactionsStore = { getState, subscribe, ...actions };

export const REACTION_PALETTE: readonly string[] = ["🔥", "🎯", "❓", "🚨", "👀", "🚀"] as const;

export function useReactionsStore<T>(selector: (s: ReactionsState) => T): T {
  return useSyncExternalStore(
    reactionsStore.subscribe,
    () => selector(reactionsStore.getState()),
    () => selector(reactionsStore.getState()),
  );
}

export interface GroupedReaction {
  emoji: string;
  count: number;
  authors: readonly string[];
  byYou: boolean;
}

export function groupReactions(
  list: readonly Reaction[],
  currentAuthor: string,
): readonly GroupedReaction[] {
  const map = new Map<string, { count: number; authors: string[]; byYou: boolean }>();
  for (const r of list) {
    let bucket = map.get(r.emoji);
    if (!bucket) { bucket = { count: 0, authors: [], byYou: false }; map.set(r.emoji, bucket); }
    bucket.count += 1;
    bucket.authors.push(r.author);
    if (r.author === currentAuthor) bucket.byYou = true;
  }
  return [...map.entries()].map(([emoji, v]) => ({
    emoji,
    count: v.count,
    authors: v.authors,
    byYou: v.byYou,
  }));
}
