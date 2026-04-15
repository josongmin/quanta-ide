import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import {
  featureRegistry,
  useFeatureRegistry,
  type CommandContribution,
  type FeatureCategory,
  type FeatureRecord,
} from "@/shared/model/feature-registry";
import { uiBus, useUiBus } from "@/shared/model/ui-bus";
import { matchPositions, positionScore } from "@/shared/lib/fuzzy-search";
import "./command-palette.css";

interface CommandEntry {
  feature: FeatureRecord;
  command: CommandContribution;
  score: number;
  titlePositions: readonly number[];
  featurePositions: readonly number[];
}

interface GroupedEntries {
  key: string;
  label: string;
  items: CommandEntry[];
}

const CATEGORY_ORDER: readonly FeatureCategory[] = [
  "intelligence",
  "editing",
  "rules",
  "integration",
  "workflow",
];

const CATEGORY_LABELS: Record<FeatureCategory, string> = {
  intelligence: "Intelligence",
  editing: "Editing",
  rules: "Rules",
  integration: "Integration",
  workflow: "Workflow",
};

const MAX_RESULTS = 40;
const MAX_RECENT = 5;
const DEV_PREFIX = ">dev ";

function scoreEntry(
  feature: FeatureRecord,
  command: CommandContribution,
  query: string,
): { score: number; titlePositions: number[]; featurePositions: number[] } | null {
  if (query.length === 0) {
    return { score: 0, titlePositions: [], featurePositions: [] };
  }
  const titleMatch = matchPositions(command.title, query);
  const featureMatch = matchPositions(feature.title, query);
  const descMatch = command.description ? matchPositions(command.description, query) : null;
  if (!titleMatch && !featureMatch && !descMatch) return null;
  const titleScore = titleMatch ? positionScore(titleMatch) : Infinity;
  const featureScore = featureMatch ? positionScore(featureMatch) + 40 : Infinity;
  const descScore = descMatch ? positionScore(descMatch) + 80 : Infinity;
  const best = Math.min(titleScore, featureScore, descScore);
  return {
    score: best,
    titlePositions: titleMatch ?? [],
    featurePositions: featureMatch ?? [],
  };
}

/* ──────────────────────────────────────────────────────────────────
   Module-level MRU (survives palette open/close within a session).
   ────────────────────────────────────────────────────────────────── */
const recentCommandIds: string[] = [];
function markRecent(id: string) {
  const idx = recentCommandIds.indexOf(id);
  if (idx !== -1) recentCommandIds.splice(idx, 1);
  recentCommandIds.unshift(id);
  if (recentCommandIds.length > MAX_RECENT) recentCommandIds.length = MAX_RECENT;
}

/* ──────────────────────────────────────────────────────────────────
   Palette
   ────────────────────────────────────────────────────────────────── */
interface CommandPaletteProps {
  onClose: () => void;
}

export function CommandPalette({ onClose }: CommandPaletteProps) {
  useFeatureRegistry((s) => s.features);

  const [rawQuery, setRawQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const { devMode, filter } = useMemo(() => {
    if (rawQuery.startsWith(DEV_PREFIX)) {
      return { devMode: true, filter: rawQuery.slice(DEV_PREFIX.length) };
    }
    return { devMode: false, filter: rawQuery };
  }, [rawQuery]);

  const flatResults = useMemo<readonly CommandEntry[]>(() => {
    const all = featureRegistry.allCommands({ includeDevOnly: devMode });
    const query = filter.trim();
    const entries: CommandEntry[] = [];
    for (const { feature, command } of all) {
      const scored = scoreEntry(feature, command, query);
      if (!scored) continue;
      entries.push({
        feature,
        command,
        score: scored.score,
        titlePositions: scored.titlePositions,
        featurePositions: scored.featurePositions,
      });
    }
    entries.sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      return a.command.title.localeCompare(b.command.title);
    });
    return entries.slice(0, MAX_RESULTS);
  }, [filter, devMode]);

  const grouped = useMemo<readonly GroupedEntries[]>(() => {
    const out: GroupedEntries[] = [];
    const query = filter.trim();

    // Recent section — only when query is empty, from MRU order
    if (query.length === 0 && recentCommandIds.length > 0) {
      const byId = new Map(flatResults.map((e) => [e.command.id, e]));
      const recents: CommandEntry[] = [];
      for (const id of recentCommandIds) {
        const entry = byId.get(id);
        if (entry) recents.push(entry);
      }
      if (recents.length > 0) {
        out.push({ key: "recent", label: "Recent", items: recents });
      }
    }

    const recentIds = new Set(out[0]?.items.map((e) => e.command.id) ?? []);
    const byCat = new Map<FeatureCategory, CommandEntry[]>();
    for (const entry of flatResults) {
      if (recentIds.has(entry.command.id)) continue;
      const bucket = byCat.get(entry.feature.category);
      if (bucket) bucket.push(entry);
      else byCat.set(entry.feature.category, [entry]);
    }
    for (const cat of CATEGORY_ORDER) {
      const items = byCat.get(cat);
      if (items && items.length > 0) {
        out.push({ key: cat, label: CATEGORY_LABELS[cat], items });
      }
    }
    return out;
  }, [flatResults, filter]);

  // Flat-order list that matches visual order (Recent first, then categories).
  const visualOrder = useMemo<readonly CommandEntry[]>(() => {
    const seq: CommandEntry[] = [];
    for (const group of grouped) seq.push(...group.items);
    return seq;
  }, [grouped]);

  const selectedEntry = visualOrder[selectedIndex];

  useEffect(() => {
    setSelectedIndex(0);
  }, [rawQuery]);

  useEffect(() => {
    if (selectedIndex >= visualOrder.length) {
      setSelectedIndex(visualOrder.length > 0 ? visualOrder.length - 1 : 0);
    }
  }, [visualOrder.length, selectedIndex]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const row = list.querySelector<HTMLElement>(`[data-palette-index="${selectedIndex}"]`);
    row?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const runAt = useCallback(
    (index: number) => {
      const entry = visualOrder[index];
      if (!entry) return;
      const ok = featureRegistry.runCommand(entry.command.id);
      if (ok) {
        markRecent(entry.command.id);
        onClose();
      }
    },
    [visualOrder, onClose],
  );

  const handleKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowDown" || (e.ctrlKey && e.key.toLowerCase() === "n")) {
        e.preventDefault();
        if (visualOrder.length === 0) return;
        setSelectedIndex((i) => (i + 1) % visualOrder.length);
        return;
      }
      if (e.key === "ArrowUp" || (e.ctrlKey && e.key.toLowerCase() === "p")) {
        e.preventDefault();
        if (visualOrder.length === 0) return;
        setSelectedIndex((i) => (i - 1 + visualOrder.length) % visualOrder.length);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        runAt(selectedIndex);
      }
    },
    [visualOrder.length, onClose, runAt, selectedIndex],
  );

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setRawQuery(e.target.value);
  };

  const handleBackdropClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  const indexOf = useMemo(() => {
    const map = new Map<string, number>();
    visualOrder.forEach((entry, i) => {
      map.set(`${entry.feature.id}:${entry.command.id}`, i);
    });
    return map;
  }, [visualOrder]);

  return (
    <div
      className="cp__backdrop"
      onMouseDown={handleBackdropClick}
      role="presentation"
    >
      <div
        className="cp"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onKeyDown={handleKeyDown}
      >
        <div className="cp__head">
          <span className="cp__search-icon" aria-hidden>
            <SearchIcon />
          </span>
          <input
            ref={inputRef}
            className="cp__input"
            type="text"
            value={rawQuery}
            onChange={handleInputChange}
            placeholder="Type a command or capability…"
            spellCheck={false}
            autoComplete="off"
          />
          {devMode && <span className="cp__chip cp__chip--dev">DEV</span>}
          <span className="cp__chip cp__chip--esc">ESC</span>
        </div>

        <div className="cp__body">
          <div className="cp__list" ref={listRef}>
            {grouped.length === 0 ? (
              <EmptyState query={filter.trim()} />
            ) : (
              grouped.map((group) => (
                <Fragment key={group.key}>
                  <div className="cp__group-head">
                    <span className="cp__group-label">{group.label}</span>
                    <span className="cp__group-count">{group.items.length}</span>
                  </div>
                  {group.items.map((entry) => {
                    const flatIndex = indexOf.get(`${entry.feature.id}:${entry.command.id}`) ?? 0;
                    const isSelected = flatIndex === selectedIndex;
                    return (
                      <div
                        key={`${entry.feature.id}:${entry.command.id}`}
                        data-palette-index={flatIndex}
                        className={`cp__row${isSelected ? " cp__row--selected" : ""}`}
                        onMouseEnter={() => setSelectedIndex(flatIndex)}
                        onMouseDown={(ev) => {
                          ev.preventDefault();
                          runAt(flatIndex);
                        }}
                        role="option"
                        aria-selected={isSelected}
                      >
                        <span className="cp__row-icon" aria-hidden>
                          <CategoryIcon category={entry.feature.category} />
                        </span>
                        <span className="cp__row-main">
                          <span className="cp__row-title">
                            <Highlight text={entry.command.title} positions={entry.titlePositions} />
                          </span>
                          <span className="cp__row-feature">
                            <Highlight text={entry.feature.title} positions={entry.featurePositions} />
                          </span>
                        </span>
                        {entry.command.keybinding ? (
                          <span className="cp__row-kb">{entry.command.keybinding}</span>
                        ) : null}
                        <span className="cp__row-chev" aria-hidden>
                          ↵
                        </span>
                      </div>
                    );
                  })}
                </Fragment>
              ))
            )}
          </div>

          <div className="cp__preview" aria-live="polite">
            {selectedEntry ? <Preview entry={selectedEntry} /> : <PreviewEmpty />}
          </div>
        </div>

        <div className="cp__foot">
          <span className="cp__foot-count">
            {visualOrder.length} {visualOrder.length === 1 ? "result" : "results"}
          </span>
          <div className="cp__foot-hints">
            <Hint keys="↑↓">navigate</Hint>
            <Hint keys="↵">run</Hint>
            <Hint keys="esc">dismiss</Hint>
            {!devMode && <Hint keys=">dev">dev</Hint>}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Sub-components
   ────────────────────────────────────────────────────────────────── */
function Highlight({ text, positions }: { text: string; positions: readonly number[] }) {
  if (positions.length === 0) return <>{text}</>;
  const set = new Set(positions);
  const out: ReactNode[] = [];
  let buf = "";
  for (let i = 0; i < text.length; i++) {
    if (set.has(i)) {
      if (buf) {
        out.push(<span key={`p${i}`}>{buf}</span>);
        buf = "";
      }
      out.push(
        <mark key={`m${i}`} className="cp__hl">
          {text[i]}
        </mark>,
      );
    } else {
      buf += text[i];
    }
  }
  if (buf) out.push(<span key="tail">{buf}</span>);
  return <>{out}</>;
}

function Preview({ entry }: { entry: CommandEntry }) {
  const depsOn = entry.feature.dependsOn ?? [];
  return (
    <div className="cp__prev">
      <div className="cp__prev-head">
        <span className="cp__prev-icon" aria-hidden>
          <CategoryIcon category={entry.feature.category} size={20} />
        </span>
        <div className="cp__prev-title">
          <div className="cp__prev-title-main">{entry.command.title}</div>
          <div className="cp__prev-title-sub">
            {entry.feature.title} · {CATEGORY_LABELS[entry.feature.category]}
          </div>
        </div>
      </div>

      {entry.command.description && (
        <p className="cp__prev-desc">{entry.command.description}</p>
      )}

      <div className="cp__prev-meta">
        <MetaRow label="Feature">
          <code>{entry.feature.id}</code>
          <span className="cp__prev-ver">v{entry.feature.version}</span>
        </MetaRow>
        <MetaRow label="Category">
          {CATEGORY_LABELS[entry.feature.category]}
        </MetaRow>
        {entry.feature.badge && (
          <MetaRow label="Badge">
            <span className={`cp__prev-badge cp__prev-badge--${entry.feature.badge}`}>
              {entry.feature.badge}
            </span>
          </MetaRow>
        )}
        <MetaRow label="State">
          <span className={`cp__prev-state cp__prev-state--${entry.feature.state}`}>
            <span className="cp__prev-state-dot" aria-hidden />
            {entry.feature.state}
          </span>
        </MetaRow>
        {entry.command.keybinding && (
          <MetaRow label="Keybinding">
            <span className="cp__prev-kb">{entry.command.keybinding}</span>
          </MetaRow>
        )}
        {depsOn.length > 0 && (
          <MetaRow label="Depends on">
            <span className="cp__prev-deps">
              {depsOn.map((d, i) => (
                <Fragment key={d}>
                  {i > 0 && <span className="cp__prev-deps-sep">·</span>}
                  <code>{d}</code>
                </Fragment>
              ))}
            </span>
          </MetaRow>
        )}
      </div>

      <div className="cp__prev-run">
        <span className="cp__prev-run-kb">↵</span>
        <span className="cp__prev-run-label">press enter to run</span>
      </div>
    </div>
  );
}

function MetaRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="cp__prev-row">
      <span className="cp__prev-row-label">{label}</span>
      <span className="cp__prev-row-value">{children}</span>
    </div>
  );
}

function PreviewEmpty() {
  return (
    <div className="cp__prev cp__prev--empty">
      <div className="cp__prev-empty-mark" aria-hidden>
        ∅
      </div>
      <div className="cp__prev-empty-title">No selection</div>
      <div className="cp__prev-empty-sub">
        type to filter — navigation and preview are keyboard-first
      </div>
    </div>
  );
}

function EmptyState({ query }: { query: string }) {
  return (
    <div className="cp__empty">
      <div className="cp__empty-mark" aria-hidden>
        ⌁
      </div>
      <div className="cp__empty-title">
        {query ? `No commands match "${query}"` : "Start typing"}
      </div>
      <div className="cp__empty-hints">
        <span>try:</span>
        <kbd>agent rules</kbd>
        <kbd>flow</kbd>
        <kbd>dev console</kbd>
        <kbd>compliance</kbd>
      </div>
    </div>
  );
}

function Hint({ keys, children }: { keys: string; children: ReactNode }) {
  return (
    <span className="cp__hint">
      <kbd>{keys}</kbd>
      <span className="cp__hint-label">{children}</span>
    </span>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Icons — tiny inline SVGs tuned to 14px
   ────────────────────────────────────────────────────────────────── */
const SVG_BASE = {
  fill: "none" as const,
  stroke: "currentColor" as const,
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" {...SVG_BASE}>
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function CategoryIcon({ category, size = 14 }: { category: FeatureCategory; size?: number }) {
  const base = { width: size, height: size, viewBox: "0 0 24 24", ...SVG_BASE };
  switch (category) {
    case "intelligence":
      return (
        <svg {...base}>
          <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
        </svg>
      );
    case "editing":
      return (
        <svg {...base}>
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z" />
        </svg>
      );
    case "rules":
      return (
        <svg {...base}>
          <path d="M12 3v18M5 8l7-5 7 5M5 8l3 9h8l3-9" />
        </svg>
      );
    case "integration":
      return (
        <svg {...base}>
          <path d="M9 2v6M15 2v6M7 8h10v6a5 5 0 0 1-5 5 5 5 0 0 1-5-5z" />
          <path d="M12 19v3" />
        </svg>
      );
    case "workflow":
      return (
        <svg {...base}>
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      );
  }
}

/* ──────────────────────────────────────────────────────────────────
   Host
   ────────────────────────────────────────────────────────────────── */
export function CommandPaletteHost() {
  const open = useUiBus((s) => s.paletteOpen);
  const handleClose = useCallback(() => {
    uiBus.togglePalette(false);
  }, []);
  if (!open) return null;
  return <CommandPalette onClose={handleClose} />;
}
