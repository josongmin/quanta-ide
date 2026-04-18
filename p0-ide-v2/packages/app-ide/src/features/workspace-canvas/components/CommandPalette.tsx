import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFeature } from "../store/feature-flags-store";
import { useSceneStore } from "../store/scene-store";
import { useStickiesStore } from "../store/stickies-store";
import {
  type Command,
  type CommandCategory,
  type RankedCommand,
  seedCommands,
  searchCommands,
  COMMAND_CATEGORY_ORDER,
  COMMAND_CATEGORY_LABEL,
} from "../lib/command-registry";

// Command palette (Batch 7 — power.commandPalette).
// -------------------------------------------------------------------
// Opens on Cmd+K / Ctrl+K (parent passes `open` from a global keybind).
// Dark HUD modal, ~480px wide, centred via fixed backdrop. Input at top,
// fuzzy-matched results grouped by category below. Arrows navigate,
// Enter runs, Esc closes. The palette is fully controlled — parent owns
// open-state so it also owns the keybind glue.

interface Props {
  open: boolean;
  onClose: () => void;
  /** Optional overrides from MultiFileCanvas so palette actions can use
   *  the smooth-camera / export helpers already wired into the canvas. */
  zoomToFile?: (fileId: string) => void;
  fitToGraph?: () => void;
  resetViewport?: () => void;
  exportPng?: () => void;
}

interface CategoryBucket {
  category: CommandCategory;
  items: readonly RankedCommand[];
}

export function CommandPalette(props: Props) {
  const on = useFeature("power.commandPalette");
  if (!on) return null;
  return <CommandPaletteInner {...props} />;
}

function CommandPaletteInner({ open, onClose, zoomToFile, fitToGraph, resetViewport, exportPng }: Props) {
  // Subscribe to sources that change the command set. Stickies re-seed on
  // create/delete; the graph re-seeds on workspace swap. Features are
  // static (declaration-time) so re-seeding on every search is fine.
  const graph = useSceneStore(s => s.graph);
  const layout = useSceneStore(s => s.layout);
  const stickies = useStickiesStore(s => s.stickies);

  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Reset transient state whenever the palette is reopened.
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIdx(0);
      // Delay a tick so the input exists in the DOM before focus.
      queueMicrotask(() => inputRef.current?.focus());
    }
  }, [open]);

  const commands: readonly Command[] = useMemo(() => {
    if (!open) return [];
    return seedCommands({ graph, layout, zoomToFile, fitToGraph, resetViewport, exportPng });
    // `stickies` inclusion re-seeds when stickies change, even though we
    // read the snapshot through the store inside seedCommands.
  }, [open, graph, layout, stickies, zoomToFile, fitToGraph, resetViewport, exportPng]);

  const ranked = useMemo(
    () => searchCommands(commands, query, 200),
    [commands, query],
  );

  const buckets = useMemo<readonly CategoryBucket[]>(() => {
    const byCat = new Map<CommandCategory, RankedCommand[]>();
    for (const item of ranked) {
      const list = byCat.get(item.command.category) ?? [];
      list.push(item);
      byCat.set(item.command.category, list);
    }
    return COMMAND_CATEGORY_ORDER
      .map(category => ({ category, items: byCat.get(category) ?? [] }))
      .filter(b => b.items.length > 0);
  }, [ranked]);

  // Flattened list in render order for keyboard navigation — matches
  // the visual order of buckets → items.
  const flat = useMemo(() => buckets.flatMap(b => b.items), [buckets]);

  // Clamp active index on result-set change.
  useEffect(() => {
    if (activeIdx >= flat.length) setActiveIdx(Math.max(0, flat.length - 1));
  }, [flat.length, activeIdx]);

  const runIndex = useCallback((i: number) => {
    const item = flat[i];
    if (!item) return;
    item.command.run();
    onClose();
  }, [flat, onClose]);

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx(i => (flat.length === 0 ? 0 : Math.min(i + 1, flat.length - 1)));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx(i => Math.max(0, i - 1));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      runIndex(activeIdx);
      return;
    }
  }, [activeIdx, flat.length, runIndex, onClose]);

  // Ensure the active item is in view as the user arrow-navigates.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const active = list.querySelector<HTMLElement>(".ws-palette__item.is-active");
    if (active) active.scrollIntoView({ block: "nearest" });
  }, [activeIdx, flat.length]);

  if (!open) return null;

  let runningIndex = -1;

  return (
    <div
      className="ws-palette__backdrop"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
      role="presentation"
    >
      <div className="ws-palette" role="dialog" aria-label="Command palette">
        <input
          ref={inputRef}
          className="ws-palette__input"
          placeholder="Search commands, files, features…"
          value={query}
          onChange={e => { setQuery(e.target.value); setActiveIdx(0); }}
          onKeyDown={onKeyDown}
          aria-label="Command palette query"
        />
        <div ref={listRef} className="ws-palette__results">
          {flat.length === 0 ? (
            <div className="ws-palette__empty">No commands match "{query}"</div>
          ) : (
            buckets.map(b => (
              <div key={b.category}>
                <div className="ws-palette__group-header">{COMMAND_CATEGORY_LABEL[b.category]}</div>
                {b.items.map(item => {
                  runningIndex += 1;
                  const myIndex = runningIndex;
                  const active = myIndex === activeIdx;
                  return (
                    <button
                      key={item.command.id}
                      type="button"
                      className={`ws-palette__item${active ? " is-active" : ""}`}
                      onMouseEnter={() => setActiveIdx(myIndex)}
                      onClick={() => runIndex(myIndex)}
                    >
                      <span className="ws-palette__label">{item.command.label}</span>
                      {item.command.hint && <span className="ws-palette__hint">{item.command.hint}</span>}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
