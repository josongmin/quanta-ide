import type { ViewMode } from "../features/view-mode";

export interface UniverseLaunchIntent {
  mode?: ViewMode;
  selectedId?: string | null;
  tier?: string;
}

let pendingIntent: UniverseLaunchIntent | null = null;

export function primeUniverseLaunch(intent: UniverseLaunchIntent): void {
  pendingIntent = intent;
}

export function consumeUniverseLaunch(): UniverseLaunchIntent | null {
  if (!pendingIntent) return null;
  const next = pendingIntent;
  pendingIntent = null;
  return next;
}
