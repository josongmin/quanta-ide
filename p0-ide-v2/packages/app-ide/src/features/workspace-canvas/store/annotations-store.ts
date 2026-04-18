import { useSyncExternalStore } from "react";

// Annotations store — user-drawn canvas overlays (Miro / FigJam family).
// Distinct from stickies: stickies are anchored task notes; annotations are
// ephemeral or long-lived drawings (pen, text labels, shapes, connectors,
// frames). Each entry carries a `kind`-tagged geometry blob — we keep it
// `unknown` at the store boundary so a kind-specific renderer / editor
// narrows on read instead of forcing every write site to ship a fat union.

export type ToolKind =
  | "none"
  | "pen"
  | "text"
  | "shape"
  | "connector"
  | "laser"
  | "frame";

export type ShapeVariant = "rect" | "ellipse" | "arrow";

export interface AnnotationAnchor {
  kind: "file" | "sticky" | "annotation" | "free";
  id?: string;
  // Offset is stored in world coords for "free" anchors. For "file" /
  // "sticky" / "annotation" anchors we keep a cached world position so
  // the renderer has a resolved fallback when the referenced entity has
  // not yet laid out (or has been removed).
  x: number;
  y: number;
}

export interface PenGeometry {
  points: Array<[number, number]>;
  color: string;
  strokeWidth: number;
}

export interface TextGeometry {
  x: number;
  y: number;
  text: string;
  fontSize: number;
  color: string;
}

export interface ShapeGeometry {
  x: number;
  y: number;
  w: number;
  h: number;
  shape: ShapeVariant;
  color: string;
  strokeWidth: number;
}

export interface ConnectorGeometry {
  fromAnchor: AnnotationAnchor;
  toAnchor: AnnotationAnchor;
  color: string;
  strokeWidth: number;
}

export interface FrameGeometry {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  color: string;
}

export interface Annotation {
  id: string;
  kind: "pen" | "text" | "shape" | "connector" | "frame";
  authorId?: string;
  createdAt: number;
  geometry: unknown;
}

export interface AnnotationsState {
  annotations: readonly Annotation[];
  activeTool: ToolKind;
  /** Last-used per-tool color — persisted to keep user intent between sessions. */
  penColor: string;
  textColor: string;
  shapeColor: string;
  connectorColor: string;
  shapeVariant: ShapeVariant;
  /** Currently-editing annotation id (text commit / frame label). */
  editingId: string | null;
}

const STORAGE_KEY = "quanta.canvas.annotations.v1";

const DEFAULT_STATE: AnnotationsState = {
  annotations: [],
  activeTool: "none",
  penColor: "#dc2626",
  textColor: "#0f172a",
  shapeColor: "#2563eb",
  connectorColor: "#7c3aed",
  shapeVariant: "rect",
  editingId: null,
};

function readPersisted(): AnnotationsState {
  if (typeof localStorage === "undefined") return DEFAULT_STATE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return DEFAULT_STATE;
    const anns: Annotation[] = Array.isArray(parsed.annotations)
      ? (parsed.annotations as Annotation[]).filter(
          a => a && typeof a.id === "string" && typeof a.kind === "string",
        )
      : [];
    return {
      ...DEFAULT_STATE,
      annotations: anns,
      penColor: typeof parsed.penColor === "string" ? parsed.penColor : DEFAULT_STATE.penColor,
      textColor: typeof parsed.textColor === "string" ? parsed.textColor : DEFAULT_STATE.textColor,
      shapeColor: typeof parsed.shapeColor === "string" ? parsed.shapeColor : DEFAULT_STATE.shapeColor,
      connectorColor:
        typeof parsed.connectorColor === "string" ? parsed.connectorColor : DEFAULT_STATE.connectorColor,
      shapeVariant:
        parsed.shapeVariant === "rect" || parsed.shapeVariant === "ellipse" || parsed.shapeVariant === "arrow"
          ? parsed.shapeVariant
          : DEFAULT_STATE.shapeVariant,
    };
  } catch {
    return DEFAULT_STATE;
  }
}

function writePersisted(state: AnnotationsState): void {
  if (typeof localStorage === "undefined") return;
  try {
    // Active tool / editingId are ephemeral and deliberately excluded from
    // persisted state so a reload always lands on "none".
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        annotations: state.annotations,
        penColor: state.penColor,
        textColor: state.textColor,
        shapeColor: state.shapeColor,
        connectorColor: state.connectorColor,
        shapeVariant: state.shapeVariant,
      }),
    );
  } catch {
    // best-effort
  }
}

let state: AnnotationsState = readPersisted();
const listeners = new Set<() => void>();

function emit() {
  for (const l of [...listeners]) l();
}

function getState(): AnnotationsState {
  return state;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

let idCounter = 0;
function makeId(): string {
  idCounter += 1;
  const rand = Math.floor(Math.random() * 0xffffff).toString(36);
  return `ann_${Date.now().toString(36)}_${idCounter.toString(36)}_${rand}`;
}

const actions = {
  add(ann: Omit<Annotation, "id" | "createdAt"> & Partial<Pick<Annotation, "id" | "createdAt">>): string {
    const id = ann.id ?? makeId();
    const next: Annotation = {
      id,
      kind: ann.kind,
      authorId: ann.authorId,
      createdAt: ann.createdAt ?? Date.now(),
      geometry: ann.geometry,
    };
    state = { ...state, annotations: [...state.annotations, next] };
    writePersisted(state);
    emit();
    return id;
  },

  update(id: string, patch: Partial<Omit<Annotation, "id" | "createdAt">>) {
    let changed = false;
    const next = state.annotations.map(a => {
      if (a.id !== id) return a;
      changed = true;
      return { ...a, ...patch, id: a.id, createdAt: a.createdAt };
    });
    if (!changed) return;
    state = { ...state, annotations: next };
    writePersisted(state);
    emit();
  },

  remove(id: string) {
    const next = state.annotations.filter(a => a.id !== id);
    if (next.length === state.annotations.length) return;
    state = { ...state, annotations: next, editingId: state.editingId === id ? null : state.editingId };
    writePersisted(state);
    emit();
  },

  list(): readonly Annotation[] {
    return state.annotations;
  },

  bringToFront(id: string) {
    const idx = state.annotations.findIndex(a => a.id === id);
    if (idx < 0 || idx === state.annotations.length - 1) return;
    const next = [...state.annotations.slice(0, idx), ...state.annotations.slice(idx + 1), state.annotations[idx]];
    state = { ...state, annotations: next };
    writePersisted(state);
    emit();
  },

  reset() {
    state = { ...DEFAULT_STATE, annotations: [] };
    writePersisted(state);
    emit();
  },

  setTool(tool: ToolKind) {
    if (state.activeTool === tool) return;
    state = { ...state, activeTool: tool, editingId: null };
    // Tool is ephemeral — no persist.
    emit();
  },

  setEditingId(id: string | null) {
    if (state.editingId === id) return;
    state = { ...state, editingId: id };
    emit();
  },

  setPenColor(color: string) {
    if (state.penColor === color) return;
    state = { ...state, penColor: color };
    writePersisted(state);
    emit();
  },
  setTextColor(color: string) {
    if (state.textColor === color) return;
    state = { ...state, textColor: color };
    writePersisted(state);
    emit();
  },
  setShapeColor(color: string) {
    if (state.shapeColor === color) return;
    state = { ...state, shapeColor: color };
    writePersisted(state);
    emit();
  },
  setConnectorColor(color: string) {
    if (state.connectorColor === color) return;
    state = { ...state, connectorColor: color };
    writePersisted(state);
    emit();
  },
  setShapeVariant(variant: ShapeVariant) {
    if (state.shapeVariant === variant) return;
    state = { ...state, shapeVariant: variant };
    writePersisted(state);
    emit();
  },

  /**
   * Translate every annotation whose AABB is fully contained by `bounds`
   * by (dx, dy). Used for frame group-drag.
   */
  translateWithin(bounds: { x: number; y: number; w: number; h: number }, dx: number, dy: number, exceptId?: string) {
    if (dx === 0 && dy === 0) return;
    let changed = false;
    const next = state.annotations.map(a => {
      if (a.id === exceptId) return a;
      const aabb = getAnnotationAabb(a);
      if (!aabb) return a;
      if (!containsAabb(bounds, aabb)) return a;
      const moved = translateAnnotation(a, dx, dy);
      if (moved !== a) changed = true;
      return moved;
    });
    if (!changed) return;
    state = { ...state, annotations: next };
    writePersisted(state);
    emit();
  },

  /**
   * Translate a single annotation by (dx, dy). Used for dragging the frame
   * itself and for the non-group drag case.
   */
  translate(id: string, dx: number, dy: number) {
    if (dx === 0 && dy === 0) return;
    let changed = false;
    const next = state.annotations.map(a => {
      if (a.id !== id) return a;
      const moved = translateAnnotation(a, dx, dy);
      if (moved !== a) changed = true;
      return moved;
    });
    if (!changed) return;
    state = { ...state, annotations: next };
    writePersisted(state);
    emit();
  },
};

// ── Geometry helpers ─────────────────────────────────────────────────

export function getAnnotationAabb(
  a: Annotation,
): { x: number; y: number; w: number; h: number } | null {
  switch (a.kind) {
    case "pen": {
      const g = a.geometry as PenGeometry;
      if (!g.points.length) return null;
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const [x, y] of g.points) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
      return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    }
    case "text": {
      const g = a.geometry as TextGeometry;
      // Rough width estimate — AABB only used for frame-containment check.
      const w = Math.max(40, g.text.length * g.fontSize * 0.55);
      return { x: g.x, y: g.y, w, h: g.fontSize * 1.4 };
    }
    case "shape": {
      const g = a.geometry as ShapeGeometry;
      const x = Math.min(g.x, g.x + g.w);
      const y = Math.min(g.y, g.y + g.h);
      return { x, y, w: Math.abs(g.w), h: Math.abs(g.h) };
    }
    case "connector": {
      const g = a.geometry as ConnectorGeometry;
      const x = Math.min(g.fromAnchor.x, g.toAnchor.x);
      const y = Math.min(g.fromAnchor.y, g.toAnchor.y);
      const w = Math.abs(g.toAnchor.x - g.fromAnchor.x);
      const h = Math.abs(g.toAnchor.y - g.fromAnchor.y);
      return { x, y, w, h };
    }
    case "frame": {
      const g = a.geometry as FrameGeometry;
      return { x: g.x, y: g.y, w: g.w, h: g.h };
    }
  }
}

function containsAabb(
  outer: { x: number; y: number; w: number; h: number },
  inner: { x: number; y: number; w: number; h: number },
): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.w <= outer.x + outer.w &&
    inner.y + inner.h <= outer.y + outer.h
  );
}

function translateAnnotation(a: Annotation, dx: number, dy: number): Annotation {
  switch (a.kind) {
    case "pen": {
      const g = a.geometry as PenGeometry;
      const next: PenGeometry = {
        ...g,
        points: g.points.map(([x, y]): [number, number] => [x + dx, y + dy]),
      };
      return { ...a, geometry: next };
    }
    case "text": {
      const g = a.geometry as TextGeometry;
      const next: TextGeometry = { ...g, x: g.x + dx, y: g.y + dy };
      return { ...a, geometry: next };
    }
    case "shape": {
      const g = a.geometry as ShapeGeometry;
      const next: ShapeGeometry = { ...g, x: g.x + dx, y: g.y + dy };
      return { ...a, geometry: next };
    }
    case "connector": {
      const g = a.geometry as ConnectorGeometry;
      const next: ConnectorGeometry = {
        ...g,
        fromAnchor: { ...g.fromAnchor, x: g.fromAnchor.x + dx, y: g.fromAnchor.y + dy },
        toAnchor: { ...g.toAnchor, x: g.toAnchor.x + dx, y: g.toAnchor.y + dy },
      };
      return { ...a, geometry: next };
    }
    case "frame": {
      const g = a.geometry as FrameGeometry;
      const next: FrameGeometry = { ...g, x: g.x + dx, y: g.y + dy };
      return { ...a, geometry: next };
    }
  }
}

export const annotationsStore = { getState, subscribe, ...actions };

export function useAnnotationsStore<T>(selector: (s: AnnotationsState) => T): T {
  return useSyncExternalStore(
    annotationsStore.subscribe,
    () => selector(annotationsStore.getState()),
    () => selector(annotationsStore.getState()),
  );
}

/** Convenience colors row shown in the toolbar. */
export const ANNOTATION_COLORS: readonly string[] = [
  "#dc2626", // red
  "#2563eb", // blue
  "#f59e0b", // yellow
  "#0f172a", // black
];
