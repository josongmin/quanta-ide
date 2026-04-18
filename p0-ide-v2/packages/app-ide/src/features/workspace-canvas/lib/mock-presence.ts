import { sceneStore } from "../store/scene-store";
import { presenceStore, type AgentActivity, type AgentPresence } from "../store/presence-store";
import { getPresenceTransport } from "./presence-transport-ref";
import { MockPresenceTransport, type PresenceMessage } from "./presence-transport";

// perf: was 3000ms; raised to 12000ms to reduce main-thread tax.
const TICK_MS = 12000;

const ACTIVITY_CYCLE: Record<string, readonly AgentActivity[]> = {
  "claude-reviewer": ["reading", "analyzing", "idle", "reading"],
  "gpt-fixer": ["editing", "reading", "editing", "idle"],
  "security-scanner": ["analyzing", "analyzing", "idle", "analyzing"],
};

function seedAgents(): AgentPresence[] {
  const now = Date.now();
  return [
    {
      agentId: "claude-reviewer",
      label: "Claude-review",
      color: 0x7dd3fc,
      focusFileId: null,
      activity: "reading",
      updatedAt: now,
    },
    {
      agentId: "gpt-fixer",
      label: "GPT-fixer",
      color: 0xc084fc,
      focusFileId: null,
      activity: "editing",
      updatedAt: now,
    },
    {
      agentId: "security-scanner",
      label: "SecScan",
      color: 0xf97316,
      focusFileId: null,
      activity: "analyzing",
      updatedAt: now,
    },
  ];
}

function pickRandom<T>(arr: readonly T[]): T | undefined {
  if (arr.length === 0) return undefined;
  return arr[Math.floor(Math.random() * arr.length)];
}

function emit(msg: PresenceMessage): void {
  const tr = getPresenceTransport();
  if (tr instanceof MockPresenceTransport) {
    tr.dispatch(msg);
  } else {
    tr.send(msg);
  }
}

export function startMockPresence(): () => void {
  const agents = seedAgents();
  presenceStore.setAgents(agents);
  // Announce each agent over the transport so any peer subscribed to
  // `presence-join` picks them up symmetrically. Agent *activity*
  // (reading/editing/…) is richer than the current wire schema, so the
  // ticking update below still touches `presenceStore` directly — that
  // can be promoted to a dedicated wire message later without changing
  // the interface.
  for (const a of agents) {
    emit({
      kind: "presence-join",
      userId: a.agentId,
      label: a.label,
      color: a.color,
    });
  }

  let tick = 0;
  const interval = window.setInterval(() => {
    const files = sceneStore.getState().graph?.files;
    if (!files || files.length === 0) return;
    const agents = presenceStore.getState().agents;
    if (agents.length === 0) return;

    tick++;
    const now = Date.now();
    const next: AgentPresence[] = agents.map((a, idx) => {
      if ((tick + idx) % 2 !== 0) return a;
      const file = pickRandom(files);
      const cycle = ACTIVITY_CYCLE[a.agentId] ?? ["idle"];
      const activity = cycle[(tick + idx) % cycle.length] ?? a.activity;
      const trailPool = [pickRandom(files)?.id, pickRandom(files)?.id].filter(
        (x): x is string => typeof x === "string",
      );
      return {
        ...a,
        focusFileId: file?.id ?? a.focusFileId,
        activity,
        trailFileIds: trailPool,
        updatedAt: now,
      };
    });
    presenceStore.setAgents(next);
  }, TICK_MS);

  return () => {
    window.clearInterval(interval);
    for (const a of agents) {
      emit({ kind: "presence-leave", userId: a.agentId });
    }
    presenceStore.setAgents([]);
  };
}
