import type { FeatureState, RegistryEvent } from "@/shared/model/feature-registry";

export const STATE_ORDER: Record<FeatureState, number> = {
  error: 0,
  active: 1,
  disabled: 2,
};

function pad(n: number, w: number): string {
  return n.toString().padStart(w, "0");
}

export function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${pad(d.getHours(), 2)}:${pad(d.getMinutes(), 2)}:${pad(d.getSeconds(), 2)}.${pad(d.getMilliseconds(), 3)}`;
}

export function formatIsoShort(ts: number): string {
  if (!ts) return "\u2014";
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1, 2)}-${pad(d.getDate(), 2)} ${pad(d.getHours(), 2)}:${pad(d.getMinutes(), 2)}:${pad(d.getSeconds(), 2)}`;
}

export function stateDotClass(s: FeatureState): string {
  return `devc__feat-dot devc__feat-dot--${s}`;
}

export function stateGlyph(s: FeatureState): string {
  if (s === "active") return "\u25CF";
  if (s === "disabled") return "\u25CB";
  return "\u26A0";
}

export function eventFeatureId(e: RegistryEvent): string | undefined {
  return "featureId" in e ? e.featureId : undefined;
}

export function eventCommandId(e: RegistryEvent): string | undefined {
  return "commandId" in e ? e.commandId : undefined;
}

export function eventMessage(e: RegistryEvent): string | undefined {
  return "message" in e ? e.message : undefined;
}
