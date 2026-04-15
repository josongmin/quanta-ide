import { useSyncExternalStore } from "react";
import type {
  FeatureManifest,
  FeatureRecord,
  FeatureState,
  CommandContribution,
  FeatureCategory,
  FeatureVisibility,
} from "./types";

interface RegistryState {
  features: ReadonlyMap<string, FeatureRecord>;
  events: readonly RegistryEvent[];
}

export type RegistryEventKind =
  | "register"
  | "unregister"
  | "enable"
  | "disable"
  | "error"
  | "command"
  | "shortcut";

interface RegistryEventBase {
  t: number;
}

export type RegistryEvent =
  | (RegistryEventBase & { kind: "register"; featureId: string })
  | (RegistryEventBase & { kind: "unregister"; featureId: string })
  | (RegistryEventBase & { kind: "enable"; featureId: string; message?: string })
  | (RegistryEventBase & { kind: "disable"; featureId: string; message?: string })
  | (RegistryEventBase & {
      kind: "error";
      featureId: string;
      commandId?: string;
      message: string;
    })
  | (RegistryEventBase & { kind: "command"; featureId: string; commandId: string })
  | (RegistryEventBase & { kind: "shortcut"; featureId: string; commandId: string });

const MAX_EVENTS = 200;

let state: RegistryState = {
  features: new Map(),
  events: [],
};

const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;
type RegistryEventInput = DistributiveOmit<RegistryEvent, "t">;

function pushEvent(ev: RegistryEventInput) {
  const stamped = { ...ev, t: Date.now() } as RegistryEvent;
  const next = [stamped, ...state.events].slice(0, MAX_EVENTS);
  state = { ...state, events: next };
}

function withFeature(id: string, update: (r: FeatureRecord) => FeatureRecord): boolean {
  const existing = state.features.get(id);
  if (!existing) return false;
  const map = new Map(state.features);
  map.set(id, update(existing));
  state = { ...state, features: map };
  return true;
}

export const featureRegistry = {
  get: (): RegistryState => state,

  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },

  register(manifest: FeatureManifest): void {
    const start = performance.now();
    const record: FeatureRecord = {
      ...manifest,
      state: "active",
      loadedAt: Date.now(),
      loadMs: Math.round(performance.now() - start),
    };
    const map = new Map(state.features);
    map.set(manifest.id, record);
    state = { ...state, features: map };
    pushEvent({ kind: "register", featureId: manifest.id });
    emit();
  },

  unregister(id: string): void {
    const map = new Map(state.features);
    if (!map.delete(id)) return;
    state = { ...state, features: map };
    pushEvent({ kind: "unregister", featureId: id });
    emit();
  },

  setState(id: string, nextState: FeatureState, errorMessage?: string): void {
    const ok = withFeature(id, (r) => ({ ...r, state: nextState, errorMessage }));
    if (!ok) return;
    if (nextState === "error") {
      pushEvent({ kind: "error", featureId: id, message: errorMessage ?? "unknown error" });
    } else if (nextState === "disabled") {
      pushEvent({ kind: "disable", featureId: id, message: errorMessage });
    } else {
      pushEvent({ kind: "enable", featureId: id, message: errorMessage });
    }
    emit();
  },

  runCommand(commandId: string): boolean {
    for (const f of state.features.values()) {
      if (f.state !== "active") continue;
      const cmd = f.commands?.find((c) => c.id === commandId);
      if (cmd) {
        try {
          cmd.run();
          pushEvent({ kind: "command", featureId: f.id, commandId });
          emit();
          return true;
        } catch (err) {
          pushEvent({
            kind: "error",
            featureId: f.id,
            commandId,
            message: err instanceof Error ? err.message : String(err),
          });
          emit();
          return false;
        }
      }
    }
    return false;
  },

  getCommand(commandId: string): { feature: FeatureRecord; command: CommandContribution } | null {
    for (const f of state.features.values()) {
      const cmd = f.commands?.find((c) => c.id === commandId);
      if (cmd) return { feature: f, command: cmd };
    }
    return null;
  },

  allCommands(opts?: { includeDisabled?: boolean; includeDevOnly?: boolean }): {
    feature: FeatureRecord;
    command: CommandContribution;
  }[] {
    const out: { feature: FeatureRecord; command: CommandContribution }[] = [];
    for (const f of state.features.values()) {
      if (!opts?.includeDisabled && f.state !== "active") continue;
      if (!opts?.includeDevOnly && f.visibility === "dev-only") continue;
      for (const cmd of f.commands ?? []) out.push({ feature: f, command: cmd });
    }
    return out;
  },

  byCategory(category: FeatureCategory, visibility: FeatureVisibility = "user"): FeatureRecord[] {
    return [...state.features.values()]
      .filter((f) => f.category === category)
      .filter((f) => visibility === "user" ? f.visibility === "user" : true)
      .sort((a, b) => a.title.localeCompare(b.title));
  },

  allFeatures(includeDevOnly = false): FeatureRecord[] {
    return [...state.features.values()]
      .filter((f) => includeDevOnly || f.visibility === "user")
      .sort((a, b) => {
        const stateOrder: Record<FeatureState, number> = { error: 0, active: 1, disabled: 2 };
        const sd = stateOrder[a.state] - stateOrder[b.state];
        return sd !== 0 ? sd : a.title.localeCompare(b.title);
      });
  },

  clearEvents(): void {
    state = { ...state, events: [] };
    emit();
  },
};

export function useFeatureRegistry<T>(selector: (s: RegistryState) => T): T {
  return useSyncExternalStore(
    featureRegistry.subscribe,
    () => selector(state),
    () => selector(state),
  );
}
