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
import { useTierSwitch, TierBreadcrumb } from "../../../features/tier-switch";
import { useEntityState, entityStore } from "../../../entities/entity";
import { useWorkspaceGraph } from "../../../shared/api/graph-source";
import { HoverTooltip } from "./HoverTooltip";
import { mindMapStore } from "../../../features/mind-map";
import {
  useViewMode,
  viewModeStore,
  ViewModePicker,
  ViewContextProvider,
  getViewDescriptor,
  cycleMode,
  switchMode,
  VIEW_MODE_OPTIONS,
  VIEW_GLYPH,
  type ViewContextValue,
  type ViewMode,
} from "../../../features/view-mode";
import { LeftPanel } from "../../left-panel";
import { Inspector } from "../../inspector";
import { NavHistoryButtons } from "../../../features/nav-history";
import { ColorModePicker } from "../../../features/color-mode";
import { color, font, radius, space, transition } from "../../../shared/ui/tokens";
import { IconLayoutGrid, IconSidebarLeft, IconSidebarRight } from "../../../shared/ui/icons";

// CanvasShell — top-level Code Universe widget.
//
//   ┌ header: [◧] [◀ ▶]  Code Universe  workspace/shell/…   [LoC·1.000] [File] [▤] [◨] ┐
//   ├─────────────────────────────────────────────────────────────────────────────────┤
//   │ LeftPanel  │                   active view (registry)                │ Inspector │
//   │            │                                                         │           │
//   │            │             ┌─ Toolbar (tier · kind · weight) ─┐        │           │
//   │            │             └─────────────── floating ─────────┘        │           │
//   └────────────┴─────────────────────────────────────────────────────────┴───────────┘
//
// The shell is view-mode agnostic — it constructs a ViewContextValue,
// asks the view-mode registry which descriptor is active, and renders
// that descriptor's Component inside the overlay wrapper the descriptor
// declares ("base" = direct mount, "overlay" = translucent full-bleed).
// Adding a new mode never requires editing this file.

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

  const [prefs, setPrefs] = useState<PanelPrefs>(loadPrefs);
  useEffect(() => {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* ignore */ }
  }, [prefs]);

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

  const viewMode = useViewMode(s => s.mode);
  const selectedId = useEntityState(s => s.interaction.selectedId);
  const anchorId   = useEntityState(s => s.interaction.anchorId);

  // ── The single ViewContextValue the registry feeds every view ─────
  //
  // Ref-keyed dispatch means the callbacks have stable identity even
  // as the surrounding props change — descriptor activate / deactivate
  // hooks can safely close over them without re-subscribing.
  const dispatch = useMemo<ViewContextValue["dispatch"]>(
    () => ({
      selectEntity: id => entityStore.selectEntity(id),
      openMindMapOn: id => mindMapStore.openOn(id),
      closeMindMap: () => mindMapStore.close(),
      setMode: (m: ViewMode) => {
        // Internal: picker / cross-view pivots call this when they
        // want a mode switch without wiring a ctx themselves. The
        // registry's switchMode handles activate/deactivate symmetry.
        const ctx = ctxRef.current;
        if (ctx) switchMode(m, ctx);
        else viewModeStore.setMode(m);
      },
    }),
    [],
  );

  const ctxValue: ViewContextValue = useMemo(
    () => ({
      graph: graph ?? null,
      tree,
      selectedId,
      anchorId,
      viewportSize,
      tabId,
      dispatch,
    }),
    [graph, tree, selectedId, anchorId, viewportSize, tabId, dispatch],
  );

  // Ref mirrors ctx so keyboard handlers + dispatch.setMode can read
  // the current value without re-creating themselves on every update.
  const ctxRef = useRef<ViewContextValue>(ctxValue);
  ctxRef.current = ctxValue;

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement | null;
      const inField = !!target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);

      // V — cycle to the next view mode. Runs through the registry so
      // activate/deactivate hooks fire automatically.
      if ((e.key === "v" || e.key === "V") && !e.ctrlKey && !e.metaKey && !e.altKey && !inField) {
        e.preventDefault();
        cycleMode(ctxRef.current);
        return;
      }

      // M — toggle mindmap mode. Same as clicking Mind in the picker;
      // the registry handles opening / closing the mind-map store via
      // the descriptor's activate / deactivate hooks.
      if (e.key === "m" || e.key === "M") {
        if (e.ctrlKey || e.metaKey || e.altKey) return; // leave OS shortcuts alone
        if (inField) return;
        e.preventDefault();
        const currentMode = viewModeStore.getState().mode;
        const next: ViewMode = currentMode === "mindmap" ? "treemap" : "mindmap";
        switchMode(next, ctxRef.current);
        return;
      }

      // Esc — any non-treemap mode returns to the Universe (base view).
      if (e.key === "Escape") {
        const current = viewModeStore.getState().mode;
        if (current !== "treemap") {
          e.preventDefault();
          switchMode("treemap", ctxRef.current);
          return;
        }
      }

      // Cmd/Ctrl +/- — treemap camera zoom. Harmless in other modes
      // (the overlay masks the treemap), kept wired so the user can
      // pre-zoom before flipping back.
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

  // Resolve the active descriptor + wrap its Component in the overlay
  // it declares. "base" mounts directly (treemap / Pixi canvas);
  // "overlay" wraps in a translucent full-bleed backdrop the rest of
  // the views share so their visual language reads as "focused layer
  // on top of Universe" consistently.
  const activeDescriptor = getViewDescriptor(viewMode);
  const ActiveComponent = activeDescriptor.Component;
  const activeView =
    activeDescriptor.overlay === "base" ? (
      <ActiveComponent ctx={ctxValue} />
    ) : (
      <div style={OVERLAY_STYLE}>
        <ActiveComponent ctx={ctxValue} />
      </div>
    );

  return (
    <ViewContextProvider value={ctxValue}>
      <div data-product="code-universe" style={ROOT_STYLE}>
        <header style={HEADER_STYLE}>
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

          <div style={HEADER_MIDDLE}>
            <SelectedPath />
          </div>

          {/* Right cluster: shell chrome only (color mode + inspector
              toggle). Code-Universe-specific controls (view mode, tier,
              scale, kind) live in the floating overlay inside the
              viewport below. */}
          <div style={HEADER_GROUP}>
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
            {/* Code-Universe context bar — floating top-center overlay.
                Carries tier / scale / kind, which ONLY make sense in the
                treemap (Universe) view — zoom tier and visible-kind are
                treemap-tier artefacts. Other view modes own their own
                spatial language and don't read tier/scale. Wrapper is
                pointer-events: none so drag-pan flows through the gaps;
                individual controls opt back in. */}
            {viewMode === "treemap" ? (
              <div style={FLOATING_CONTEXT_BAR} role="toolbar" aria-label="Code Universe controls">
                <span style={FLOATING_GROUP}>
                  <TierBreadcrumb />
                </span>
                <span style={FLOATING_DIVIDER} aria-hidden />
                <span style={{ ...SCALE_CHIP, ...FLOATING_GROUP_INLINE }}>
                  <span style={{ color: color.text2 }}>scale</span>
                  <span style={{ fontVariantNumeric: "tabular-nums", color: color.text0, fontWeight: font.weight.semibold }}>
                    {scale.toFixed(2)}
                  </span>
                </span>
                <span style={{ ...KIND_CHIP, ...FLOATING_GROUP_INLINE }}>{tier.visibleKind}</span>
              </div>
            ) : null}

            {/* View-mode switcher — icon button at top-right of the
                viewport. Opens the ViewModePicker popup below itself,
                anchored to the right edge. */}
            <div style={VIEW_MODE_TRIGGER_WRAP}>
              <ViewModeDropdown />
            </div>

            {activeView}
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
    </ViewContextProvider>
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
        width: 24,
        height: 24,
        border: "1px solid transparent",
        background: active ? color.bg3 : "transparent",
        color: active ? color.text0 : color.text2,
        borderRadius: radius.sm,
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
  padding: `0 ${space[3]}px`,
  borderBottom: `1px solid ${color.border}`,
  display: "flex",
  alignItems: "center",
  gap: space[2],
  background: color.bg1,
  flexShrink: 0,
  height: 34,
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
  paddingInline: space[3],
  overflow: "hidden",
};

const PATH_MONO: CSSProperties = {
  fontFamily: font.mono,
  fontSize: font.size.sm,
  color: color.text1,
  letterSpacing: -0.1,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  maxWidth: "100%",
};

const PATH_MUTED: CSSProperties = {
  ...PATH_MONO,
  color: color.text3,
  fontStyle: "italic",
};

const PATH_SEP: CSSProperties = {
  color: color.text3,
  padding: "0 4px",
};

const PATH_LEAF: CSSProperties = {
  color: color.text0,
  fontWeight: font.weight.semibold,
};

const PATH_KIND_PILL: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "1px 6px",
  marginRight: space[2],
  fontFamily: font.family,
  fontSize: 10,
  fontWeight: font.weight.semibold,
  letterSpacing: 0.3,
  textTransform: "uppercase",
  color: color.text2,
  background: color.bg2,
  border: `1px solid ${color.border}`,
  borderRadius: radius.sm,
  flexShrink: 0,
};

const PRODUCT_NAME: CSSProperties = {
  fontSize: font.size.md,
  fontWeight: font.weight.semibold,
  color: color.text0,
  letterSpacing: -0.2,
  paddingLeft: space[1],
  paddingRight: space[1],
  whiteSpace: "nowrap",
};

const SCALE_CHIP: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: `2px ${space[2]}px`,
  background: color.bg2,
  border: `1px solid ${color.border}`,
  borderRadius: radius.sm,
  fontSize: font.size.sm,
  fontFamily: font.mono,
  fontVariantNumeric: "tabular-nums",
  whiteSpace: "nowrap",
};

const KIND_CHIP: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: `2px ${space[2]}px`,
  background: color.bg2,
  color: color.text0,
  border: `1px solid ${color.border}`,
  borderRadius: radius.sm,
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

const OVERLAY_STYLE: CSSProperties = {
  position: "absolute",
  inset: 0,
  background: "rgba(248, 250, 252, 0.96)",
  backdropFilter: "blur(6px)",
  WebkitBackdropFilter: "blur(6px)",
  zIndex: 6,
  display: "flex",
  alignItems: "stretch",
  justifyContent: "stretch",
};

const FLOATING_CONTEXT_BAR: CSSProperties = {
  position: "absolute",
  top: 12,
  left: "50%",
  transform: "translateX(-50%)",
  display: "inline-flex",
  alignItems: "center",
  gap: space[2],
  padding: `${space[1]}px ${space[2]}px`,
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.pill,
  boxShadow: [
    "0 1px 2px rgba(0, 0, 0, 0.04)",
    "0 10px 28px rgba(0, 0, 0, 0.08)",
  ].join(", "),
  zIndex: 10,
  pointerEvents: "none",
};

const FLOATING_GROUP: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  pointerEvents: "auto",
};

const FLOATING_GROUP_INLINE: CSSProperties = {
  pointerEvents: "auto",
};

const FLOATING_DIVIDER: CSSProperties = {
  width: 1,
  height: 20,
  alignSelf: "center",
  background: color.border,
  opacity: 0.7,
};

// Icon-button trigger for the view-mode dropdown. Sits top-right of
// the canvas viewport — square, glass-pill styled to match the
// floating context bar so the two read as part of one system.
const VIEW_MODE_TRIGGER_WRAP: CSSProperties = {
  position: "absolute",
  top: 12,
  right: 12,
  zIndex: 11,
};

const VIEW_MODE_ICON_BTN: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  height: 30,
  padding: "0 9px 0 8px",
  color: color.text1,
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  cursor: "pointer",
  fontFamily: font.sans,
  boxShadow: [
    "0 1px 2px rgba(0, 0, 0, 0.04)",
    "0 10px 28px rgba(0, 0, 0, 0.08)",
  ].join(", "),
  transition: `background ${transition.fast}, color ${transition.fast}, border-color ${transition.fast}`,
};

const VIEW_MODE_BTN_ICON_SLOT: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  color: color.text2,
};

const VIEW_MODE_BTN_GLYPH: CSSProperties = {
  fontSize: 14,
  lineHeight: 1,
  color: color.accent,
  fontWeight: font.weight.semibold,
};

const VIEW_MODE_BTN_LABEL: CSSProperties = {
  fontSize: font.size.md,
  fontWeight: font.weight.semibold,
  letterSpacing: font.letter.tight,
  color: color.text0,
  lineHeight: 1,
};

const VIEW_MODE_BTN_CHEVRON: CSSProperties = {
  fontSize: 9,
  color: color.text3,
  marginLeft: 2,
  fontFamily: font.sans,
  lineHeight: 1,
};

const VIEW_MODE_ICON_BTN_OPEN: CSSProperties = {
  ...VIEW_MODE_ICON_BTN,
  background: color.selected,
  color: color.text0,
  borderColor: color.borderStrong,
};

const VIEW_MODE_POPUP_STYLE: CSSProperties = {
  position: "absolute",
  top: "100%",
  right: 0,
  marginTop: 4,
  zIndex: 20,
};

// SelectedPath — shows the full path of the currently anchored/selected
// entity in the shell header. Shell chrome should say *what* you are
// looking at; view-mode/tier/scale chips belong to the Code Universe
// content area and moved to the floating overlay below.
function SelectedPath(): ReactElement {
  const selectedId = useEntityState(s => s.interaction.selectedId);
  const anchorId   = useEntityState(s => s.interaction.anchorId);
  const tree       = useEntityState(s => s.tree);

  const contextId = anchorId ?? selectedId;
  const entity = contextId ? tree?.byId.get(contextId) : undefined;

  if (!entity) {
    return (
      <span style={PATH_MUTED} title="No selection — Workspace root">
        Workspace · 파일을 선택하세요
      </span>
    );
  }

  const rawPath = entity.path || entity.name;
  const parts = rawPath.split("/").filter(Boolean);
  const leaf = parts.length > 0 ? parts[parts.length - 1] : rawPath;
  const head = parts.slice(0, -1);

  return (
    <span style={PATH_MONO} title={rawPath}>
      <span style={PATH_KIND_PILL}>{entity.kind}</span>
      {head.map((seg, i) => (
        <span key={i}>
          <span>{seg}</span>
          <span style={PATH_SEP}>/</span>
        </span>
      ))}
      <span style={PATH_LEAF}>{leaf}</span>
    </span>
  );
}

function ViewModeDropdown(): ReactElement {
  const mode = useViewMode(s => s.mode);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const prevMode = useRef(mode);
  useEffect(() => {
    if (prevMode.current !== mode) {
      prevMode.current = mode;
      setOpen(false);
    }
  }, [mode]);

  useEffect(() => {
    if (!open) return;
    const closeOnOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    // Close on wheel only when the scroll happens OUTSIDE the popup.
    // Scrolling inside the picker itself (long list of modes) must not
    // dismiss it — but scroll-to-zoom on the canvas should.
    const closeOnWheel = (e: WheelEvent) => {
      if (ref.current && ref.current.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutside);
    document.addEventListener("wheel", closeOnWheel, { capture: true, passive: true });
    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      document.removeEventListener("wheel", closeOnWheel, { capture: true });
    };
  }, [open]);

  const label = VIEW_MODE_OPTIONS.find(o => o.value === mode)?.label ?? "Universe";

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`Switch visualization mode (current: ${label})`}
        title={`View mode · ${label}`}
        style={open ? VIEW_MODE_ICON_BTN_OPEN : VIEW_MODE_ICON_BTN}
        onMouseEnter={e => {
          if (!open) {
            e.currentTarget.style.borderColor = color.borderStrong;
          }
        }}
        onMouseLeave={e => {
          if (!open) {
            e.currentTarget.style.borderColor = color.border;
          }
        }}
      >
        <span style={VIEW_MODE_BTN_ICON_SLOT}>
          <IconLayoutGrid size={14} />
        </span>
        <span style={VIEW_MODE_BTN_GLYPH}>{VIEW_GLYPH[mode]}</span>
        <span style={VIEW_MODE_BTN_LABEL}>{label}</span>
        <span style={VIEW_MODE_BTN_CHEVRON}>▾</span>
      </button>
      {open && (
        <div style={VIEW_MODE_POPUP_STYLE}>
          <ViewModePicker />
        </div>
      )}
    </div>
  );
}
