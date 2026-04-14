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

/** Graphite-style stacked branch / PR row (mock). */
export interface StackedBranch {
  id: string;
  /** Rows with the same group share one vertical spine. */
  stackGroup: string;
  /** 0 = base of stack, increments toward tip. */
  depth: number;
  name: string;
  relativeTime: string;
  hasOpenPr: boolean;
  prNumber?: number;
  pushedToRemote: boolean;
  /** Files changed on this branch (mock). */
  touchedFiles: string[];
}

export type GitRemoteBusy = "idle" | "fetch" | "pull" | "push";

export interface GitWorkspaceState {
  branch: string;
  files: GitChangedFile[];
  commitMessage: string;
  ahead: number;
  behind: number;
  recentCommits: GitCommitRow[];
  /** Stacked PRs / branches (Graphite-style mock). */
  stackBranches: StackedBranch[];
  selectedStackBranchId: string | null;
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
    stackBranches: [
      {
        id: "stk-sync-1",
        stackGroup: "pp-12-12",
        depth: 0,
        name: "pp-12-12-route-guard",
        relativeTime: "3m",
        hasOpenPr: true,
        prNumber: 2404,
        pushedToRemote: true,
        touchedFiles: ["apps/api/src/middleware.ts"],
      },
      {
        id: "stk-sync-2",
        stackGroup: "pp-12-12",
        depth: 1,
        name: "pp-12-12-auth-hook",
        relativeTime: "3m",
        hasOpenPr: true,
        prNumber: 2405,
        pushedToRemote: true,
        touchedFiles: ["apps/api/src/auth.ts"],
      },
      {
        id: "stk-core-a",
        stackGroup: "pp-01-03",
        depth: 0,
        name: "pp-01-03-A",
        relativeTime: "2w",
        hasOpenPr: true,
        prNumber: 118,
        pushedToRemote: true,
        touchedFiles: ["libs/core/a.py"],
      },
      {
        id: "stk-core-b",
        stackGroup: "pp-01-03",
        depth: 1,
        name: "pp-01-03-B",
        relativeTime: "2w",
        hasOpenPr: true,
        prNumber: 119,
        pushedToRemote: true,
        touchedFiles: ["libs/core/b.py"],
      },
      {
        id: "stk-core-c",
        stackGroup: "pp-01-03",
        depth: 2,
        name: "pp-01-03-C",
        relativeTime: "3m",
        hasOpenPr: true,
        prNumber: 2410,
        pushedToRemote: true,
        touchedFiles: ["apps/public/splash-page/src/css/global.scss"],
      },
      {
        id: "stk-solo",
        stackGroup: "solo",
        depth: 0,
        name: "pp-12-14-new_branch",
        relativeTime: "1h",
        hasOpenPr: false,
        pushedToRemote: false,
        touchedFiles: ["README.md"],
      },
    ],
    selectedStackBranchId: "stk-core-c",
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

  /** Ephemeral toast from UI actions (mock). */
  notify: (message: string, ms = 2000) => {
    showToast(message, ms);
  },

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

  discardAll: () => {
    if (state.files.length === 0) return;
    state = { ...state, files: [] };
    emit();
    showToast("Discarded all changes", 2000);
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
        { hash: h, subject: msg.length > 80 ? `${msg.slice(0, 77)}…` : msg, graphColor: "a" as const, lane: 0 },
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

  selectStackBranch: (id: string | null) => {
    state = { ...state, selectedStackBranchId: id };
    emit();
  },

  checkoutStackBranch: (id: string) => {
    const row = state.stackBranches.find((b) => b.id === id);
    if (!row) return;
    state = { ...state, branch: row.name, selectedStackBranchId: id };
    emit();
    showToast(`Checked out ${row.name}`, 2000);
  },

  /** Mock: submit / restack current stack segment. */
  submitStackBranch: (id: string) => {
    const row = state.stackBranches.find((b) => b.id === id);
    if (!row) return;
    showToast(`Submitted stack for ${row.name} (mock)`, 2400);
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
  return useSyncExternalStore(
    gitWorkspaceStore.subscribe,
    () => gitWorkspaceStore.getState().branch,
    () => gitWorkspaceStore.getState().branch,
  );
}

function syncSnapshotKey(): string {
  const { ahead, behind, busy } = gitWorkspaceStore.getState();
  return `${ahead}|${behind}|${busy}`;
}

export function useGitWorkspaceSync(): Pick<GitWorkspaceState, "ahead" | "behind" | "busy"> {
  const key = useSyncExternalStore(
    gitWorkspaceStore.subscribe,
    syncSnapshotKey,
    syncSnapshotKey,
  );
  const [a, b, busy] = key.split("|");
  return { ahead: Number(a), behind: Number(b), busy: busy as GitRemoteBusy };
}

/** Tab badge: rerenders only when dirty file count changes. */
export function useGitWorkspaceChangeCount(): number {
  return useSyncExternalStore(
    gitWorkspaceStore.subscribe,
    () => gitWorkspaceStore.getState().files.length,
    () => gitWorkspaceStore.getState().files.length,
  );
}
