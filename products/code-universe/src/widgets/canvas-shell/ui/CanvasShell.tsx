import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
  type WheelEvent as ReactWheelEvent,
} from "react";
import {
  buildHierarchicalLayout,
  type HierarchicalLayout,
} from "@quanta/canvas-engine";
import { useTierSwitch } from "../../../features/tier-switch";
import { useEntityState } from "../../../entities/entity";
import { useWorkspaceGraph } from "../../../shared/api/graph-source";
import { CanvasViewport } from "./CanvasViewport";
import { HoverTooltip } from "./HoverTooltip";
import { DrillPath } from "./DrillPath";
import { loadViewport } from "../../../shared/api/viewport-persistence";
import { LeftPanel } from "../../left-panel";
import { Inspector } from "../../inspector";
import { CanvasToolbar } from "../../canvas-toolbar";
import {
  makeWeightFn,
  useLayoutWeight,
} from "../../../features/layout-weight";
import { NavHistoryButtons } from "../../../features/nav-history";
import { ColorModePicker } from "../../../features/color-mode";
import { color, font, radius, space, transition } from "../../../shared/ui/tokens";
import { IconSidebarLeft, IconSidebarRight } from "../../../shared/ui/icons";

// CanvasShell — top-level Code Universe widget.
//
//   ┌ header: [◧] [◀ ▶]  Code Universe  workspace/shell/…   [LoC·1.000] [File] [▤] [◨] ┐
//   ├─────────────────────────────────────────────────────────────────────────────────┤
//   │ LeftPanel  │                   CanvasViewport (Pixi)                │ Inspector │
//   │            │                                                        │           │
//   │            │             ┌─ Toolbar (tier · kind · weight) ─┐       │           │
//   │            │             └─────────────── floating ─────────┘       │           │
//   └────────────┴────────────────────────────────────────────────────────┴───────────┘
//
// Figma-style split: the top bar carries *chrome* (title, nav
// history, current-context readouts, panel toggles); working
// controls live in a floating toolbar centered over the viewport so
// they're reachable without eye-travel to a distant corner. Panel
// widths + collapsed state persist user-global.

const KEY_FACTOR = 1.2;

const LEFT_MIN = 200;
const LEFT_MAX = 480;
const LEFT_DEFAULT = 264;
const RIGHT_MIN = 260;
const RIGHT_MAX = 560;
const RIGHT_DEFAULT = 320;
const DIVIDER_W = 6;

const PREFS_KEY = "cu:panels:v1";
interface PanelPrefs {
  leftW: number;
  rightW: number;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
}

function loadPrefs(): PanelPrefs {
  if (typeof localStorage === "undefined") return defaultPrefs();
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return defaultPrefs();
    const parsed = JSON.parse(raw) as Partial<PanelPrefs>;
    return {
      leftW: clamp(parsed.leftW ?? LEFT_DEFAULT, LEFT_MIN, LEFT_MAX),
      rightW: clamp(parsed.rightW ?? RIGHT_DEFAULT, RIGHT_MIN, RIGHT_MAX),
      leftCollapsed: parsed.leftCollapsed === true,
      rightCollapsed: parsed.rightCollapsed === true,
    };
  } catch {
    return defaultPrefs();
  }
}
function defaultPrefs(): PanelPrefs {
  return { leftW: LEFT_DEFAULT, rightW: RIGHT_DEFAULT, leftCollapsed: false, rightCollapsed: false };
}
function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export interface CanvasShellProps {
  /** Pass-through from the host's TabAppDescriptor. Enables per-tab
   *  persistence of camera pose / selection. */
  tabId?: string;
}

export function CanvasShell({ tabId }: CanvasShellProps = {}): ReactElement {
  const { tier, scale, zoomBy } = useTierSwitch();
  const tree = useEntityState(s => s.tree);
  const graph = useWorkspaceGraph();

  const [initialCamera] = useState(() => {
    const saved = loadViewport(tabId);
    return saved ? { tx: saved.tx, ty: saved.ty, scale: saved.scale } : undefined;
  });

  const [prefs, setPrefs] = useState<PanelPrefs>(loadPrefs);
  useEffect(() => {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* ignore */ }
  }, [prefs]);

  const weightMode = useLayoutWeight(s => s.mode);
  const layout = useMemo<HierarchicalLayout | null>(
    () =>
      tree
        ? buildHierarchicalLayout(tree, {
            weight: makeWeightFn(tree, weightMode),
            // World-unit gutter between siblings — reads as ~1–2 screen-
            // px at the universe zoom, ~12 screen-px at file-level. Makes
            // each card a discrete unit rather than a cell in a sheet.
            gap: 12,
          })
        : null,
    [tree, weightMode],
  );

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [viewportSize, setViewportSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const r = entries[0]?.contentRect;
      if (!r) return;
      setViewportSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        zoomBy(KEY_FACTOR);
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        zoomBy(1 / KEY_FACTOR);
      }
    },
    [zoomBy],
  );
  const onSwallowReactWheel = useCallback((e: ReactWheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey) return;
  }, []);

  const onDragLeft = useDividerDrag(
    prefs.leftW,
    LEFT_MIN,
    LEFT_MAX,
    +1,
    next => setPrefs(p => ({ ...p, leftW: next })),
  );
  const onDragRight = useDividerDrag(
    prefs.rightW,
    RIGHT_MIN,
    RIGHT_MAX,
    -1,
    next => setPrefs(p => ({ ...p, rightW: next })),
  );

  return (
    <div data-product="code-universe" style={ROOT_STYLE}>
      <header style={HEADER_STYLE}>
        {/* Left cluster: navigation + identity. The sidebar toggle,
            history buttons, and title live together because a user
            scanning the top-left expects nav context, not tools. */}
        <div style={HEADER_GROUP}>
          <IconToggle
            onClick={() => setPrefs(p => ({ ...p, leftCollapsed: !p.leftCollapsed }))}
            active={!prefs.leftCollapsed}
            title={prefs.leftCollapsed ? "Show sidebar" : "Hide sidebar"}
            ariaLabel="Toggle sidebar"
          >
            <IconSidebarLeft size={16} />
          </IconToggle>
          <NavHistoryButtons />
          <span style={PRODUCT_NAME}>Code Universe</span>
        </div>

        {/* Middle: drill path — muted, prose-like, shows selection
            context without competing for attention. Shrinks/truncates
            before the right cluster gives up space. */}
        <div style={HEADER_MIDDLE}>
          <DrillPath />
        </div>

        {/* Right cluster: current-context readouts + Inspector
            toggle. No tools — those live in the floating toolbar. */}
        <div style={HEADER_GROUP}>
          <span style={SCALE_CHIP}>
            <span style={{ color: color.text2 }}>scale</span>
            <span style={{ fontVariantNumeric: "tabular-nums", color: color.text0, fontWeight: font.weight.semibold }}>
              {scale.toFixed(2)}
            </span>
          </span>
          <span style={KIND_CHIP}>{tier.visibleKind}</span>
          <ColorModePicker />
          <IconToggle
            onClick={() => setPrefs(p => ({ ...p, rightCollapsed: !p.rightCollapsed }))}
            active={!prefs.rightCollapsed}
            title={prefs.rightCollapsed ? "Show inspector" : "Hide inspector"}
            ariaLabel="Toggle inspector"
          >
            <IconSidebarRight size={16} />
          </IconToggle>
        </div>
      </header>

      <div style={{ flex: 1, minHeight: 0, display: "flex", background: color.bg0 }}>
        {prefs.leftCollapsed ? null : (
          <>
            <div style={{ width: prefs.leftW, flexShrink: 0, height: "100%" }}>
              <LeftPanel />
            </div>
            <Divider onPointerDown={onDragLeft} />
          </>
        )}

        <div
          ref={viewportRef}
          role="region"
          aria-label="Code Universe viewport"
          tabIndex={0}
          onKeyDown={onKeyDown}
          onWheel={onSwallowReactWheel}
          style={{
            flex: 1,
            minWidth: 0,
            position: "relative",
            outline: "none",
            background: color.bg0,
          }}
        >
          {tree && layout && graph ? (
            <CanvasViewport
              tree={tree}
              layout={layout}
              tier={tier}
              graph={graph}
              width={viewportSize.w}
              height={viewportSize.h}
              tabId={tabId}
              initialCamera={initialCamera}
            />
          ) : (
            <div style={LOADING_STYLE}>
              <span style={{ opacity: 0.5 }}>·</span>
              <span>waiting for workspace graph</span>
              <span style={{ opacity: 0.5 }}>·</span>
            </div>
          )}
          <CanvasToolbar />
        </div>

        {prefs.rightCollapsed ? null : (
          <>
            <Divider onPointerDown={onDragRight} />
            <div
              style={{
                width: prefs.rightW,
                flexShrink: 0,
                height: "100%",
                background: color.bg1,
              }}
            >
              <Inspector />
            </div>
          </>
        )}
      </div>

      <HoverTooltip />
    </div>
  );
}

function IconToggle({
  onClick,
  active,
  title,
  ariaLabel,
  children,
}: {
  onClick: () => void;
  active: boolean;
  title: string;
  ariaLabel: string;
  children: ReactElement;
}): ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={ariaLabel}
      aria-pressed={active}
      style={{
        width: 30,
        height: 30,
        border: "1px solid transparent",
        background: active ? color.accentSofter : "transparent",
        color: active ? color.accent : color.text2,
        borderRadius: radius.md,
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        transition: `background ${transition.fast}, color ${transition.fast}`,
      }}
      onMouseEnter={e => {
        if (!active) e.currentTarget.style.background = color.hover;
      }}
      onMouseLeave={e => {
        if (!active) e.currentTarget.style.background = "transparent";
      }}
    >
      {children}
    </button>
  );
}

function Divider({
  onPointerDown,
}: {
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
}): ReactElement {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      onPointerDown={onPointerDown}
      style={DIVIDER_STYLE}
      onMouseEnter={e => {
        const line = e.currentTarget.firstElementChild as HTMLElement | null;
        if (line) line.style.background = color.accent;
      }}
      onMouseLeave={e => {
        const line = e.currentTarget.firstElementChild as HTMLElement | null;
        if (line) line.style.background = color.border;
      }}
    >
      <span style={DIVIDER_LINE} />
    </div>
  );
}

function useDividerDrag(
  current: number,
  min: number,
  max: number,
  sign: 1 | -1,
  onChange: (next: number) => void,
): (e: React.PointerEvent<HTMLDivElement>) => void {
  const stateRef = useRef({ startX: 0, startW: current });
  stateRef.current.startW = current;

  return useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      stateRef.current.startX = e.clientX;
      const el = e.currentTarget;
      try { el.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      const onMove = (ev: PointerEvent) => {
        const dx = (ev.clientX - stateRef.current.startX) * sign;
        onChange(clamp(stateRef.current.startW + dx, min, max));
      };
      const onUp = (ev: PointerEvent) => {
        el.removeEventListener("pointermove", onMove);
        el.removeEventListener("pointerup", onUp);
        el.removeEventListener("pointercancel", onUp);
        try { el.releasePointerCapture(ev.pointerId); } catch { /* ignore */ }
      };
      el.addEventListener("pointermove", onMove);
      el.addEventListener("pointerup", onUp);
      el.addEventListener("pointercancel", onUp);
    },
    [min, max, sign, onChange],
  );
}

const ROOT_STYLE: CSSProperties = {
  position: "relative",
  width: "100%",
  height: "100%",
  display: "flex",
  flexDirection: "column",
  fontFamily: font.family,
  background: color.bg0,
  color: color.text0,
};

const HEADER_STYLE: CSSProperties = {
  padding: `${space[2]}px ${space[3]}px`,
  borderBottom: `1px solid ${color.border}`,
  display: "flex",
  alignItems: "center",
  gap: space[3],
  background: color.bg1,
  flexShrink: 0,
  height: 48,
};

const HEADER_GROUP: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: space[1],
  flexShrink: 0,
};

const HEADER_MIDDLE: CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-start",
  paddingInline: space[2],
  overflow: "hidden",
};

const PRODUCT_NAME: CSSProperties = {
  fontSize: font.size.lg,
  fontWeight: font.weight.semibold,
  color: color.text0,
  letterSpacing: font.letter.tight,
  paddingLeft: space[2],
  paddingRight: space[1],
  whiteSpace: "nowrap",
};

const SCALE_CHIP: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: `4px ${space[2]}px`,
  background: color.bg2,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  fontSize: font.size.sm,
  fontFamily: font.mono,
  fontVariantNumeric: "tabular-nums",
  whiteSpace: "nowrap",
};

const KIND_CHIP: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: `4px ${space[2]}px`,
  background: color.accentSoft,
  color: color.accent,
  border: `1px solid ${color.accentBorder}`,
  borderRadius: radius.md,
  fontSize: font.size.sm,
  fontWeight: font.weight.medium,
  fontFamily: font.mono,
  letterSpacing: font.letter.tight,
  whiteSpace: "nowrap",
};

const DIVIDER_STYLE: CSSProperties = {
  width: DIVIDER_W,
  flexShrink: 0,
  cursor: "col-resize",
  position: "relative",
  background: "transparent",
  display: "flex",
  justifyContent: "center",
};

const DIVIDER_LINE: CSSProperties = {
  display: "block",
  width: 1,
  height: "100%",
  background: color.border,
  transition: `background ${transition.fast}`,
};

const LOADING_STYLE: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: space[2],
  color: color.text2,
  fontSize: font.size.md,
  fontStyle: "italic",
  letterSpacing: font.letter.wide,
};
