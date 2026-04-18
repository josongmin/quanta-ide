import { sceneStore } from "../store/scene-store";
import { presenceStore, type AgentActivity, type AgentPresence } from "../store/presence-store";

const TICK_MS = 3000;

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

export function startMockPresence(): () => void {
  presenceStore.setAgents(seedAgents());

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
    presenceStore.setAgents([]);
  };
}
