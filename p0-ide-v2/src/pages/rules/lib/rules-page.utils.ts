import type { BuildTarget } from "@/entities/agent-rules";

export function targetById(id: string, targets: readonly BuildTarget[]): BuildTarget | undefined {
  return targets.find((t) => t.id === id);
}

export function labelFor(id: string, targets: readonly BuildTarget[]): string {
  return targetById(id, targets)?.label ?? id;
}
