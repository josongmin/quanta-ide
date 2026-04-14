import { useSyncExternalStore } from "react";

export type GitLetter = "M" | "A" | "D" | "?";

export interface GitChangedFile {
  id: string;
  path: string;
  letter: GitLetter;
  staged: boolean;
}

export interface GitCommitRow {
  hash: string;
  subject: string;
  graphColor: "a" | "b" | "c";
  lane: number;
}

export type GitRemoteBusy = "idle" | "fetch" | "pull" | "push";

export interface GitWorkspaceState {
  branch: string;
  files: GitChangedFile[];
  commitMessage: string;
  ahead: number;
  behind: number;
  recentCommits: GitCommitRow[];
  busy: GitRemoteBusy;
  toast: string | null;
  agentReviewOpen: boolean;
}

const listeners = new Set<() => void>();

function emit() {
  for (const l of [...listeners]) l();
}

function shortHash(): string {
  return Math.random().toString(16).slice(2, 9);
}

function initialState(): GitWorkspaceState {
  return {
    branch: "main",
    files: [
      { id: "f1", path: "codegraph_agent/orchestrator/orchestrator.py", letter: "M", staged: false },
      { id: "f2", path: "codegraph_agent/orchestrator/routing_policy.py", letter: "M", staged: false },
      { id: "f3", path: "codegraph_agent/tools/plan_orchestration/security.py", letter: "A", staged: false },
    ],
    commitMessage: "",
    ahead: 0,
    behind: 1,
    recentCommits: [
      { hash: "4f2a9c1", subject: "feat(ds): phase 5 engine risk hooks", graphColor: "a", lane: 0 },
      { hash: "91be2aa", subject: "chore: remove tracked build artifacts", graphColor: "a", lane: 0 },
      { hash: "d8031f4", subject: "fix: routing retry backoff", graphColor: "b", lane: 1 },
      { hash: "c110e02", subject: "Merge branch 'redesign/ide-shell'", graphColor: "c", lane: 0 },
    ],
    busy: "idle",
    toast: null,
    agentReviewOpen: false,
  };
}

let state: GitWorkspaceState = initialState();

let toastTimer: ReturnType<typeof setTimeout> | null = null;

function showToast(message: string | null, ms = 2200) {
  if (toastTimer) {
    clearTimeout(toastTimer);
    toastTimer = null;
  }
  state = { ...state, toast: message };
  emit();
  if (message && ms > 0) {
    toastTimer = setTimeout(() => {
      toastTimer = null;
      if (state.toast === message) {
        state = { ...state, toast: null };
        emit();
      }
    }, ms);
  }
}

function sanitizeBranchName(raw: string): string {
  return raw.trim().replace(/\s+/g, "-");
}

export function isValidBranchName(name: string): boolean {
  if (!name || name.endsWith(".") || name.endsWith("/") || name.startsWith("/")) return false;
  if (name.includes("..") || name.startsWith(".")) return false;
  return /^[a-zA-Z0-9/_.-]+$/.test(name);
}

export const gitWorkspaceStore = {
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getState: (): GitWorkspaceState => state,

  createAndCheckout: (raw: string): { ok: true; name: string } | { ok: false; reason: "empty" | "invalid" } => {
    const name = sanitizeBranchName(raw);
    if (!name) return { ok: false, reason: "empty" };
    if (!isValidBranchName(name)) return { ok: false, reason: "invalid" };
    state = { ...state, branch: name };
    emit();
    showToast(`Switched to branch ${name}`, 1800);
    return { ok: true, name };
  },

  setCommitMessage: (commitMessage: string) => {
    state = { ...state, commitMessage };
    emit();
  },

  toggleAgentReview: () => {
    state = { ...state, agentReviewOpen: !state.agentReviewOpen };
    emit();
  },

  stageFile: (id: string) => {
    state = { ...state, files: state.files.map((f) => (f.id === id ? { ...f, staged: true } : f)) };
    emit();
  },

  unstageFile: (id: string) => {
    state = { ...state, files: state.files.map((f) => (f.id === id ? { ...f, staged: false } : f)) };
    emit();
  },

  stageAll: () => {
    state = { ...state, files: state.files.map((f) => ({ ...f, staged: true })) };
    emit();
  },

  unstageAll: () => {
    state = { ...state, files: state.files.map((f) => ({ ...f, staged: false })) };
    emit();
  },

  discardFile: (id: string) => {
    state = { ...state, files: state.files.filter((f) => f.id !== id) };
    emit();
    showToast("Discarded local changes", 1600);
  },

  refresh: () => {
    showToast("Working tree refreshed");
  },

  fetchRemotes: () => {
    if (state.busy !== "idle") return;
    state = { ...state, busy: "fetch" };
    emit();
    setTimeout(() => {
      state = {
        ...state,
        busy: "idle",
        behind: Math.max(0, state.behind - 1),
      };
      emit();
      showToast("Fetched from origin", 2000);
    }, 550);
  },

  pull: () => {
    if (state.busy !== "idle") return;
    state = { ...state, busy: "pull" };
    emit();
    setTimeout(() => {
      state = {
        ...state,
        busy: "idle",
        behind: 0,
        ahead: state.ahead,
      };
      emit();
      showToast("Fast-forwarded origin/main", 2200);
    }, 700);
  },

  push: () => {
    if (state.busy !== "idle" || state.ahead === 0) return;
    state = { ...state, busy: "push" };
    emit();
    setTimeout(() => {
      state = { ...state, busy: "idle", ahead: 0 };
      emit();
      showToast("Pushed to origin", 2000);
    }, 650);
  },

  commit: (andPush: boolean): { ok: true } | { ok: false; reason: "empty_message" | "nothing_staged" } => {
    const msg = state.commitMessage.trim();
    const staged = state.files.filter((f) => f.staged);
    if (!msg) {
      showToast("Add a commit message", 2400);
      return { ok: false, reason: "empty_message" };
    }
    if (staged.length === 0) {
      showToast("Stage changes before committing", 2400);
      return { ok: false, reason: "nothing_staged" };
    }
    const h = shortHash();
    state = {
      ...state,
      files: state.files.filter((f) => !f.staged),
      commitMessage: "",
      ahead: state.ahead + 1,
      recentCommits: [
        { hash: h, subject: msg.length > 80 ? `${msg.slice(0, 77)}…` : msg, graphColor: "a", lane: 0 },
        ...state.recentCommits,
      ].slice(0, 24),
    };
    emit();
    if (andPush) {
      state = { ...state, busy: "push" };
      emit();
      setTimeout(() => {
        state = { ...state, busy: "idle", ahead: 0 };
        emit();
        showToast("Committed and pushed", 2000);
      }, 500);
    } else {
      showToast(`Created commit ${h}`, 2200);
    }
    return { ok: true };
  },
};

export function useGitWorkspace(): GitWorkspaceState {
  return useSyncExternalStore(
    gitWorkspaceStore.subscribe,
    () => gitWorkspaceStore.getState(),
    () => gitWorkspaceStore.getState(),
  );
}

export function useGitWorkspaceBranch(): string {
  return useGitWorkspace().branch;
}

export function useGitWorkspaceSync(): Pick<GitWorkspaceState, "ahead" | "behind" | "busy"> {
  const s = useGitWorkspace();
  return { ahead: s.ahead, behind: s.behind, busy: s.busy };
}

/** Tab badge: rerenders only when dirty file count changes. */
export function useGitWorkspaceChangeCount(): number {
  return useSyncExternalStore(
    gitWorkspaceStore.subscribe,
    () => gitWorkspaceStore.getState().files.length,
    () => gitWorkspaceStore.getState().files.length,
  );
}
