import { useCallback, useEffect, useRef, useState } from "react";
import { pagesStore, usePagesStore, type CanvasPage } from "../store/pages-store";
import { bookmarksStore } from "../store/bookmarks-store";
import { viewportStore } from "../store/viewport-store";
import { interactionStore } from "../store/interaction-store";
import { actionTerrainStore } from "../store/action-terrain-store";
import { useFeature } from "../store/feature-flags-store";
import { TemplatesMenu } from "./TemplatesMenu";

// PagesTabBar (Batch 5 — Navigation)
// -------------------------------------------------------------------
// Top-of-canvas horizontal tab bar — active page highlighted, click a
// tab to switch, right-click to rename / delete, + to create a blank
// page or apply a template.
//
// Page switching semantics: before flipping the active id, we snapshot
// the current viewport + selection into the outgoing page; after
// switching, we push the incoming page's snapshot into those stores.
// That single-pass sync keeps state loss-free without routing through
// React effects.

interface ContextMenuState {
  pageId: string;
  x: number;
  y: number;
}

export function PagesTabBar() {
  const on = useFeature("nav.pages");
  const pages = usePagesStore(s => s.pages);
  const activeId = usePagesStore(s => s.activeId);
  const templatesOn = useFeature("nav.templates");

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // Close the right-click menu when clicking elsewhere.
  useEffect(() => {
    if (!contextMenu) return;
    const onDown = (e: MouseEvent) => {
      if ((e.target as HTMLElement)?.closest(".ws-pages__ctx")) return;
      setContextMenu(null);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [contextMenu]);

  const handleSwitch = useCallback((targetId: string) => {
    switchToPage(targetId);
  }, []);

  const handleCreate = useCallback(() => {
    const label = `Page ${pages.length + 1}`;
    const id = pagesStore.create(label);
    switchToPage(id);
    setRenamingId(id);
  }, [pages.length]);

  const handleDelete = useCallback((id: string) => {
    bookmarksStore.removeForPage(id);
    pagesStore.remove(id);
    setContextMenu(null);
  }, []);

  if (!on) return null;

  return (
    <div className="ws-pages" role="tablist" aria-label="Canvas pages">
      <div className="ws-pages__list">
        {pages.map(page => (
          <PageTab
            key={page.id}
            page={page}
            active={page.id === activeId}
            renaming={renamingId === page.id}
            onStartRename={() => setRenamingId(page.id)}
            onFinishRename={() => setRenamingId(null)}
            onSwitch={() => handleSwitch(page.id)}
            onContextMenu={(x, y) => setContextMenu({ pageId: page.id, x, y })}
          />
        ))}
      </div>
      <div className="ws-pages__actions">
        <button
          type="button"
          className="ws-pages__new"
          onClick={handleCreate}
          title="New blank page"
          aria-label="New blank page"
        >
          +
        </button>
        {templatesOn && (
          <button
            type="button"
            className="ws-pages__new"
            onClick={() => setMenuOpen(v => !v)}
            title="New from template"
          >
            templates
          </button>
        )}
      </div>

      {contextMenu && (
        <div
          className="ws-pages__ctx"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          role="menu"
        >
          <button
            type="button"
            className="ws-pages__ctx-item"
            onClick={() => {
              setRenamingId(contextMenu.pageId);
              setContextMenu(null);
            }}
          >
            Rename
          </button>
          <button
            type="button"
            className="ws-pages__ctx-item ws-pages__ctx-item--danger"
            onClick={() => handleDelete(contextMenu.pageId)}
            disabled={pages.length <= 1}
            title={pages.length <= 1 ? "Can't delete the last page" : "Delete page"}
          >
            Delete
          </button>
        </div>
      )}

      {templatesOn && menuOpen && (
        <TemplatesMenu onClose={() => setMenuOpen(false)} />
      )}
    </div>
  );
}

interface PageTabProps {
  page: CanvasPage;
  active: boolean;
  renaming: boolean;
  onStartRename: () => void;
  onFinishRename: () => void;
  onSwitch: () => void;
  onContextMenu: (x: number, y: number) => void;
}

function PageTab({
  page,
  active,
  renaming,
  onStartRename,
  onFinishRename,
  onSwitch,
  onContextMenu,
}: PageTabProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(page.label);

  useEffect(() => {
    if (renaming) {
      setDraft(page.label);
      const t = window.setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 0);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [renaming, page.label]);

  const commit = useCallback(() => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== page.label) {
      pagesStore.rename(page.id, trimmed);
    }
    onFinishRename();
  }, [draft, page.id, page.label, onFinishRename]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      onContextMenu(e.clientX, e.clientY);
    },
    [onContextMenu],
  );

  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={`ws-pages__tab${active ? " ws-pages__tab--active" : ""}`}
      onClick={onSwitch}
      onDoubleClick={onStartRename}
      onContextMenu={handleContextMenu}
      title={page.description ?? page.label}
    >
      {renaming ? (
        <input
          ref={inputRef}
          className="ws-pages__rename-input"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            } else if (e.key === "Escape") {
              e.preventDefault();
              onFinishRename();
            }
          }}
          // Prevent the tab's click from firing while editing.
          onClick={e => e.stopPropagation()}
        />
      ) : (
        <span className="ws-pages__tab-label">{page.label}</span>
      )}
    </button>
  );
}

// Internal — exported for the storyboard + applyToCanvas paths that need
// to switch pages without duplicating the save/restore dance.
export function switchToPage(targetId: string): void {
  const s = pagesStore.getState();
  if (s.activeId === targetId) return;
  if (!s.pages.some(p => p.id === targetId)) return;

  // 1) snapshot current viewport + selection into outgoing page.
  const outgoing = s.pages.find(p => p.id === s.activeId);
  if (outgoing) {
    const vp = viewportStore.getState().viewport;
    pagesStore.updatePageState(outgoing.id, {
      viewport: { x: vp.x, y: vp.y, scale: vp.scale },
      selectedFileId: interactionStore.getState().viewState.selectedFileId,
    });
  }

  // 2) flip active.
  pagesStore.setActive(targetId);

  // 3) restore incoming page's snapshot.
  const incoming = pagesStore.getState().pages.find(p => p.id === targetId);
  if (incoming) {
    const vp = viewportStore.getState().viewport;
    viewportStore.setViewport({
      ...vp,
      x: incoming.viewport.x,
      y: incoming.viewport.y,
      scale: incoming.viewport.scale,
    });
    interactionStore.selectFile(incoming.selectedFileId);
    // Action-terrain selection is per-canvas — clear it on page switch so
    // stale cones don't linger. Mode + heightScale persist (user prefs).
    actionTerrainStore.selectFile(null);
    actionTerrainStore.selectPlan(null);
  }
}
