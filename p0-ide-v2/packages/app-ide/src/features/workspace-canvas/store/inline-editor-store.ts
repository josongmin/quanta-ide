import { useSyncExternalStore } from "react";

// Inline-editor store
// -------------------------------------------------------------------
// Owns "double-click a GroundCard to edit its source inline" state:
// the active edit session, the per-file draft buffer, and the AI
// inline-edit prompt + streaming diff state (Cursor Cmd+K-style).
//
// Deliberately isolated from interaction / viewport / scene stores so
// a stream tick does not wake selection listeners, and vice versa.
// Drafts persist across session exit/re-enter within a tab lifetime;
// commit is an explicit user action (Cmd+Enter).

export interface AiEditAnchor {
  /** Screen coords — where to float the AI prompt popup. */
  screenX: number;
  screenY: number;
  /** Character offsets into the current draft text (CM doc coords). */
  selFrom: number;
  selTo: number;
}

export type AiEditStatus = "idle" | "prompting" | "streaming" | "ready" | "error";

export interface AiEditState {
  fileId: string | null;
  anchor: AiEditAnchor | null;
  prompt: string;
  status: AiEditStatus;
  /** Accumulated streamed suggestion replacing [selFrom, selTo). */
  suggestion: string;
  /** Human-readable failure — rendered inline if non-null. */
  errorMessage: string | null;
}

/** Transient "just committed" signal — consumed by CommitFlash to paint
 *  a one-shot success glow over the target card, then cleared. */
export interface CommitSignal {
  fileId: string;
  at: number;
}

export interface InlineEditorState {
  /** The file currently in inline-edit mode, or null if none. */
  editingFileId: string | null;
  /** Pending, uncommitted edits keyed by file id. */
  draftByFileId: Readonly<Record<string, string>>;
  /** Which drafts have diverged from their originally-loaded source. */
  dirtyByFileId: Readonly<Record<string, boolean>>;
  ai: AiEditState;
  /** Most recent successful commit — null once consumed. */
  lastCommit: CommitSignal | null;
}

const initialAi: AiEditState = {
  fileId: null,
  anchor: null,
  prompt: "",
  status: "idle",
  suggestion: "",
  errorMessage: null,
};

let state: InlineEditorState = {
  editingFileId: null,
  draftByFileId: {},
  dirtyByFileId: {},
  ai: initialAi,
  lastCommit: null,
};

const listeners = new Set<() => void>();

function emit(): void {
  for (const l of [...listeners]) l();
}

function getState(): InlineEditorState {
  return state;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const actions = {
  /** Enter inline-edit mode for `fileId`. Idempotent; clears any stale
   *  AI prompt. Seeds the draft from `initialSource` only if no draft
   *  for that file exists yet — returning users see their prior typing. */
  beginEdit(fileId: string, initialSource: string): void {
    const hasDraft = Object.prototype.hasOwnProperty.call(state.draftByFileId, fileId);
    const nextDrafts = hasDraft
      ? state.draftByFileId
      : { ...state.draftByFileId, [fileId]: initialSource };
    state = {
      ...state,
      editingFileId: fileId,
      draftByFileId: nextDrafts,
      ai: initialAi,
    };
    emit();
  },

  /** Exit edit mode without discarding the draft. */
  endEdit(): void {
    if (state.editingFileId === null && state.ai.fileId === null) return;
    state = { ...state, editingFileId: null, ai: initialAi };
    emit();
  },

  /** Overwrite the draft for `fileId`. Called on every CM keystroke, so
   *  it compares references and drops no-ops. */
  setDraft(fileId: string, nextDoc: string): void {
    if (state.draftByFileId[fileId] === nextDoc) return;
    state = {
      ...state,
      draftByFileId: { ...state.draftByFileId, [fileId]: nextDoc },
      dirtyByFileId: { ...state.dirtyByFileId, [fileId]: true },
    };
    emit();
  },

  /** Drop the draft and dirty flag for `fileId`. Used on "discard" and
   *  once a real persistence layer confirms the write. */
  discardDraft(fileId: string): void {
    if (
      !Object.prototype.hasOwnProperty.call(state.draftByFileId, fileId) &&
      !state.dirtyByFileId[fileId]
    ) return;
    const { [fileId]: _d, ...restDraft } = state.draftByFileId;
    const { [fileId]: _b, ...restDirty } = state.dirtyByFileId;
    state = {
      ...state,
      draftByFileId: restDraft,
      dirtyByFileId: restDirty,
    };
    emit();
  },

  /** Open the AI prompt popup anchored at `anchor`. */
  openAiPrompt(fileId: string, anchor: AiEditAnchor): void {
    state = {
      ...state,
      ai: {
        fileId,
        anchor,
        prompt: "",
        status: "prompting",
        suggestion: "",
        errorMessage: null,
      },
    };
    emit();
  },

  closeAiPrompt(): void {
    if (state.ai.fileId === null && state.ai.status === "idle") return;
    state = { ...state, ai: initialAi };
    emit();
  },

  setAiPrompt(prompt: string): void {
    if (state.ai.prompt === prompt) return;
    state = { ...state, ai: { ...state.ai, prompt } };
    emit();
  },

  aiStreamStart(): void {
    if (state.ai.status === "streaming") return;
    state = { ...state, ai: { ...state.ai, status: "streaming", suggestion: "", errorMessage: null } };
    emit();
  },

  aiStreamAppend(chunk: string): void {
    if (state.ai.status !== "streaming") return;
    state = { ...state, ai: { ...state.ai, suggestion: state.ai.suggestion + chunk } };
    emit();
  },

  aiStreamReady(): void {
    if (state.ai.status !== "streaming") return;
    state = { ...state, ai: { ...state.ai, status: "ready" } };
    emit();
  },

  aiStreamError(message: string): void {
    state = { ...state, ai: { ...state.ai, status: "error", errorMessage: message } };
    emit();
  },

  /** Mark `fileId`'s draft as committed. Clears dirty flag, exits edit
   *  mode, and fires a one-shot `lastCommit` signal for CommitFlash.
   *  No-op when there's no draft for `fileId` — nothing to commit. */
  commitDraft(fileId: string): void {
    const hasDraft = Object.prototype.hasOwnProperty.call(state.draftByFileId, fileId);
    if (!hasDraft) return;
    state = {
      ...state,
      editingFileId: state.editingFileId === fileId ? null : state.editingFileId,
      // Explicit `false` (not key removal) — consumers want to distinguish
      // "known clean" from "unknown / never touched".
      dirtyByFileId: { ...state.dirtyByFileId, [fileId]: false },
      ai: state.ai.fileId === fileId ? initialAi : state.ai,
      lastCommit: { fileId, at: Date.now() },
    };
    emit();
  },

  /** Consumed by CommitFlash after the success animation — clears the
   *  one-shot signal so the next commit re-fires. */
  clearCommitSignal(): void {
    if (state.lastCommit === null) return;
    state = { ...state, lastCommit: null };
    emit();
  },

  /** Wipe every dirty draft — used by "Discard all" commands. */
  discardAllDrafts(): void {
    if (Object.keys(state.draftByFileId).length === 0 && Object.keys(state.dirtyByFileId).length === 0) return;
    state = {
      ...state,
      draftByFileId: {},
      dirtyByFileId: {},
      editingFileId: null,
      ai: initialAi,
    };
    emit();
  },
};

export const inlineEditorStore = { getState, subscribe, ...actions };

export function useInlineEditorStore<T>(selector: (s: InlineEditorState) => T): T {
  return useSyncExternalStore(
    inlineEditorStore.subscribe,
    () => selector(inlineEditorStore.getState()),
    () => selector(inlineEditorStore.getState()),
  );
}

/** Resolve the draft for a file, falling back to the original source when
 *  no typing has happened yet. Pure helper so read-only consumers (the
 *  GroundCard renderer) don't have to duplicate the lookup. */
export function resolveDocForFile(fileId: string, fallback: string): string {
  const draft = state.draftByFileId[fileId];
  return typeof draft === "string" ? draft : fallback;
}
