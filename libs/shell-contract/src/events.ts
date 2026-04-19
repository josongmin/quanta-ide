import type { AppKind } from "./types";

// ---------------------------------------------------------------------------
// Typed cross-app event bus
// Shell emits these; tab apps may subscribe.
// ---------------------------------------------------------------------------

export interface ShellEvents {
  "tab.activated": { tabId: string; app: AppKind };
  "tab.closed": { tabId: string };
  "theme.changed": { theme: "light" | "dark" };
}

/** Helper: extract event names as a union type. */
export type ShellEventName = keyof ShellEvents;

/** Helper: payload for a given event name. */
export type ShellEventPayload<K extends ShellEventName> = ShellEvents[K];
