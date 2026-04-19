export interface WorkspaceUrlState {
  version: 1;
  viewport?: { x: number; y: number; scale: number };
  selectedFileId?: string | null;
  forceLod?: "auto" | "universe" | "supergalaxy" | "galaxy" | "city" | "street" | "ground";
  edgeLayers?: Partial<Record<"structural" | "flow" | "safety" | "impact", boolean>>;
  edgeMinSeverity?: "low" | "medium" | "high" | "critical";
  focusMode?: "on" | "off";
  focusHops?: 1 | 2;
  edgeFilterQuery?: string;
  highlightArchViolations?: boolean;
  showSccBubbles?: boolean;
  showStartHereBadges?: boolean;
  showHeatmap?: boolean;
  showClusterEdges?: boolean;
  showBlameGutter?: boolean;
  temporal?: {
    mode: "off" | "live" | "diff";
    snapshotIndex?: number;
    diffFrom?: number;
    diffTo?: number;
  };
  pathQuery?: {
    sourceFileId: string;
    targetFileId: string;
    mode: "shortest" | "all-shortest" | "k-shortest";
    k?: number;
  };
  inspectedEvidenceId?: string | null;
  /**
   * Optional feature-preset id (see `feature-presets.ts`). When set, the
   * URL decoder applies the preset before reading individual flag fields,
   * so preset-based shares stay small ("?ws=...preset=reviewer" instead
   * of 50+ booleans).
   */
  preset?: string;
}

const CURRENT_VERSION = 1 as const;

function toUrlSafe(b64: string): string {
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromUrlSafe(s: string): string {
  const normal = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = normal.length % 4 === 0 ? 0 : 4 - (normal.length % 4);
  return normal + "=".repeat(pad);
}

function encodeBase64(s: string): string {
  return btoa(unescape(encodeURIComponent(s)));
}

function decodeBase64(s: string): string {
  return decodeURIComponent(escape(atob(s)));
}

export function encodeWorkspaceState(s: WorkspaceUrlState): string {
  const json = JSON.stringify(s);
  return toUrlSafe(encodeBase64(json));
}

export function decodeWorkspaceState(encoded: string): WorkspaceUrlState | null {
  if (typeof encoded !== "string" || encoded.length === 0) return null;
  try {
    const json = decodeBase64(fromUrlSafe(encoded));
    const parsed = JSON.parse(json) as unknown;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      (parsed as { version?: unknown }).version !== CURRENT_VERSION
    ) {
      return null;
    }
    return parsed as WorkspaceUrlState;
  } catch {
    return null;
  }
}

export function buildShareUrl(base: string, state: WorkspaceUrlState): string {
  const encoded = encodeWorkspaceState(state);
  return `${base}?ws=${encoded}`;
}

export function readShareUrlFromLocation(): WorkspaceUrlState | null {
  if (typeof window === "undefined" || !window.location) return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const ws = params.get("ws");
    if (!ws) return null;
    return decodeWorkspaceState(ws);
  } catch {
    return null;
  }
}
