import { useMemo, useState } from "react";
import { figmaModeStore, useFigmaMode, type FigmaModeState } from "../store/figma-mode-store";
import { useFeature, featureFlagsStore } from "../store/feature-flags-store";
import { useFeatureFlags } from "../store/feature-flags-store";
import { FEATURE_REGISTRY, type FeatureCategory } from "../lib/feature-registry";
import { listPresets, applyPreset, inferActivePreset } from "../lib/feature-presets";
import { useInteractionStore, interactionStore } from "../store/interaction-store";
import { renderSettingsStore, useRenderSettings } from "../store/render-settings-store";
import { usePagesStore, pagesStore } from "../store/pages-store";
import { useBookmarksStore } from "../store/bookmarks-store";
import { useSceneStore } from "../store/scene-store";
import { viewportStore } from "../store/viewport-store";

// Figma-style left rail (P0).
// -------------------------------------------------------------------
// Four tabs, each wrapping an existing store so we never duplicate
// state:
//
//  * Layers   — feature-flag toggle list grouped by category (like
//               Figma's Layers panel, but semantic).
//  * Filters  — render-settings edge filter + DSL input.
//  * Focus    — neighborhood expander (1-hop / 2-hop) + path query
//               controls.
//  * Saved    — pagesStore + bookmarksStore merged into a quick list.
//
// The rail itself collapses to a 32px icon column when closed so the
// canvas gets back its width — same pattern as Figma's assets panel.

type LeftTab = FigmaModeState["leftTab"];

const TAB_ORDER: readonly { id: LeftTab; label: string; glyph: string; hint: string }[] = [
  { id: "layers",  label: "Layers",   glyph: "◰", hint: "Semantic layers and feature toggles" },
  { id: "filters", label: "Filters",  glyph: "⧖", hint: "Edge kinds, layers, severity, DSL" },
  { id: "focus",   label: "Focus",    glyph: "⊙", hint: "Neighborhood expand / trace path" },
  { id: "saved",   label: "Saved",    glyph: "☐", hint: "Pages + bookmarks" },
];

export function FigmaLeftRail() {
  const enabled = useFeature("power.figmaShell");
  const open = useFigmaMode(s => s.leftOpen);
  const tab = useFigmaMode(s => s.leftTab);

  if (!enabled) return null;

  return (
    <aside
      className={`ws-figma-left${open ? " is-open" : ""}`}
      aria-label="Shell left rail"
    >
      <div className="ws-figma-left__tabs" role="tablist">
        {TAB_ORDER.map(t => {
          const active = t.id === tab && open;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              className={`ws-figma-left__tab${active ? " is-active" : ""}`}
              onClick={() => {
                if (active) figmaModeStore.setLeftOpen(false);
                else figmaModeStore.setLeftTab(t.id);
              }}
              title={t.hint}
            >
              <span className="ws-figma-left__tab-glyph" aria-hidden>{t.glyph}</span>
              {open && <span className="ws-figma-left__tab-lbl">{t.label}</span>}
            </button>
          );
        })}
      </div>
      {open && (
        <div className="ws-figma-left__body">
          {tab === "layers" && <LayersTab />}
          {tab === "filters" && <FiltersTab />}
          {tab === "focus" && <FocusTab />}
          {tab === "saved" && <SavedTab />}
        </div>
      )}
    </aside>
  );
}

// ── Layers tab ────────────────────────────────────────────────────

const CATEGORY_LABEL: Record<FeatureCategory, string> = {
  collab: "Collab",
  annotation: "Annotation",
  devmode: "Dev mode",
  review: "Review",
  navigation: "Navigation",
  power: "Power",
  embeds: "Embeds",
  ai: "AI",
  temporal: "Temporal",
  archaeology: "Archaeology",
};

function LayersTab() {
  const flags = useFeatureFlags(s => s.flags);
  const [expandedCat, setExpandedCat] = useState<FeatureCategory | null>("collab");

  const groups = useMemo(() => {
    const byCat = new Map<FeatureCategory, typeof FEATURE_REGISTRY[number][]>();
    for (const f of FEATURE_REGISTRY) {
      const arr = byCat.get(f.category) ?? [];
      arr.push(f);
      byCat.set(f.category, arr);
    }
    return byCat;
  }, []);

  const presets = useMemo(() => listPresets(), []);
  const activePreset = useMemo(() => inferActivePreset(), [flags]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="ws-figma-panel">
      <div className="ws-figma-panel__section">
        <div className="ws-figma-panel__section-head">Presets</div>
        <div className="ws-figma-panel__chips">
          {presets.map(p => (
            <button
              key={p.id}
              type="button"
              className={`ws-figma-chip${activePreset === p.id ? " is-on" : ""}`}
              onClick={() => applyPreset(p.id)}
              title={p.description}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      {[...groups.entries()].map(([cat, feats]) => {
        const enabled = feats.filter(f => flags[f.id]).length;
        const open = expandedCat === cat;
        return (
          <div key={cat} className="ws-figma-panel__group">
            <button
              type="button"
              className={`ws-figma-panel__group-head${open ? " is-open" : ""}`}
              onClick={() => setExpandedCat(open ? null : cat)}
            >
              <span className="ws-figma-panel__group-caret" aria-hidden>▸</span>
              <span className="ws-figma-panel__group-lbl">{CATEGORY_LABEL[cat]}</span>
              <span className="ws-figma-panel__group-count">{enabled}/{feats.length}</span>
            </button>
            {open && (
              <div className="ws-figma-panel__group-body">
                {feats.map(f => {
                  const on = flags[f.id] === true;
                  return (
                    <label
                      key={f.id}
                      className={`ws-figma-row${on ? " is-on" : ""}`}
                      title={f.description}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={e => featureFlagsStore.setFlag(f.id, e.target.checked)}
                      />
                      <span className="ws-figma-row__lbl">{f.label}</span>
                      <span className={`ws-figma-row__matur ws-figma-row__matur--${f.maturity}`}>
                        {f.maturity === "stable" ? "●" : f.maturity === "beta" ? "◐" : "○"}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Filters tab ───────────────────────────────────────────────────

function FiltersTab() {
  const showEdges = useRenderSettings(s => s.showEdges);
  const edgeFilterQuery = useRenderSettings(s => s.edgeFilterQuery);
  const edgeMinSeverity = useRenderSettings(s => s.edgeMinSeverity);

  return (
    <div className="ws-figma-panel">
      <div className="ws-figma-panel__section">
        <label className="ws-figma-row is-on">
          <input
            type="checkbox"
            checked={showEdges}
            onChange={e => renderSettingsStore.setShowEdges(e.target.checked)}
          />
          <span className="ws-figma-row__lbl">Show edges (master)</span>
        </label>
      </div>
      <div className="ws-figma-panel__section">
        <div className="ws-figma-panel__section-head">DSL query</div>
        <textarea
          value={edgeFilterQuery}
          onChange={e => renderSettingsStore.setEdgeFilterQuery(e.target.value)}
          placeholder='e.g. kind:call AND churn>5'
          rows={3}
          className="ws-figma-textarea"
          spellCheck={false}
        />
        {edgeFilterQuery && (
          <button
            type="button"
            className="ws-figma-chip"
            onClick={() => renderSettingsStore.setEdgeFilterQuery("")}
          >
            Clear
          </button>
        )}
      </div>
      <div className="ws-figma-panel__section">
        <div className="ws-figma-panel__section-head">Min severity</div>
        <div className="ws-figma-panel__chips">
          {(["low", "medium", "high", "critical"] as const).map(sev => (
            <button
              key={sev}
              type="button"
              className={`ws-figma-chip${edgeMinSeverity === sev ? " is-on" : ""}`}
              onClick={() => renderSettingsStore.setEdgeMinSeverity(sev)}
            >
              {sev}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Focus tab ─────────────────────────────────────────────────────

function FocusTab() {
  const focusMode = useInteractionStore(s => s.focusMode);
  const focusHops = useInteractionStore(s => s.focusHops);
  const pathQuery = useInteractionStore(s => s.pathQuery);
  const pathResult = useInteractionStore(s => s.pathResult);
  const selectedFileId = useInteractionStore(s => s.viewState.selectedFileId);

  return (
    <div className="ws-figma-panel">
      <div className="ws-figma-panel__section">
        <div className="ws-figma-panel__section-head">Neighborhood focus</div>
        <label className="ws-figma-row is-on">
          <input
            type="checkbox"
            checked={focusMode === "on"}
            onChange={e => interactionStore.setFocusMode(e.target.checked ? "on" : "off")}
          />
          <span className="ws-figma-row__lbl">Dim non-neighbors</span>
        </label>
        <div className="ws-figma-panel__chips" style={{ marginTop: 6 }}>
          {([1, 2] as const).map(h => (
            <button
              key={h}
              type="button"
              className={`ws-figma-chip${focusHops === h ? " is-on" : ""}`}
              onClick={() => interactionStore.setFocusHops(h)}
            >
              {h}-hop
            </button>
          ))}
        </div>
        <div className="ws-figma-panel__hint">
          {selectedFileId
            ? `Focused on ${selectedFileId.split("/").pop() ?? selectedFileId}`
            : "Click a file to anchor focus."}
        </div>
      </div>
      <div className="ws-figma-panel__section">
        <div className="ws-figma-panel__section-head">Path query</div>
        {pathQuery ? (
          <>
            <div className="ws-figma-panel__hint">
              {pathQuery.sourceFileId.split("/").pop()} → {pathQuery.targetFileId.split("/").pop()}
              {pathResult && ` · ${pathResult.paths.length} paths found`}
            </div>
            <button
              type="button"
              className="ws-figma-chip"
              onClick={() => interactionStore.clearPathQuery()}
            >
              Clear path
            </button>
          </>
        ) : (
          <div className="ws-figma-panel__hint">
            shift+click two files in the canvas to compute a path.
          </div>
        )}
      </div>
    </div>
  );
}

// ── Saved tab ─────────────────────────────────────────────────────

function SavedTab() {
  const pages = usePagesStore(s => s.pages);
  const activePageId = usePagesStore(s => s.activeId);
  const bookmarks = useBookmarksStore(s => s.bookmarks);
  const scene = useSceneStore(s => s.graph);

  return (
    <div className="ws-figma-panel">
      <div className="ws-figma-panel__section">
        <div className="ws-figma-panel__section-head">Pages ({pages.length})</div>
        {pages.length === 0 ? (
          <div className="ws-figma-panel__hint">No pages yet. Cmd+K → “New page”.</div>
        ) : (
          <div className="ws-figma-panel__list">
            {pages.map(p => (
              <button
                key={p.id}
                type="button"
                className={`ws-figma-row${activePageId === p.id ? " is-on" : ""}`}
                onClick={() => pagesStore.setActive(p.id)}
                title={p.description ?? p.label}
              >
                <span className="ws-figma-row__lbl">{p.label}</span>
                <span className="ws-figma-row__meta">
                  {bookmarks.filter(b => b.pageId === p.id).length} pins
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="ws-figma-panel__section">
        <div className="ws-figma-panel__section-head">Bookmarks ({bookmarks.length})</div>
        {bookmarks.length === 0 ? (
          <div className="ws-figma-panel__hint">Bookmark a camera from the canvas controls.</div>
        ) : (
          <div className="ws-figma-panel__list">
            {bookmarks.slice(0, 12).map(b => (
              <button
                key={b.id}
                type="button"
                className="ws-figma-row"
                onClick={() => {
                  const vp = viewportStore.getState().viewport;
                  const cam = b.cameraState;
                  viewportStore.setViewport({
                    ...vp,
                    x: cam.x,
                    y: cam.y,
                    scale: cam.scale,
                  });
                  const focused = b.filterState?.focusFileId;
                  if (focused) interactionStore.selectFile(focused);
                }}
                title={b.label}
              >
                <span className="ws-figma-row__lbl">{b.label}</span>
              </button>
            ))}
            {bookmarks.length > 12 && (
              <div className="ws-figma-panel__hint">(+{bookmarks.length - 12} more)</div>
            )}
          </div>
        )}
      </div>
      {scene && (
        <div className="ws-figma-panel__section">
          <div className="ws-figma-panel__section-head">Scene</div>
          <div className="ws-figma-panel__hint">
            {scene.files.length.toLocaleString()} files · {scene.fileEdges.length.toLocaleString()} edges
          </div>
        </div>
      )}
    </div>
  );
}
