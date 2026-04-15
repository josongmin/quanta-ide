import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { useFeatureRegistry } from "@/shared/model/feature-registry";
import { uiBus, useUiBus } from "@/shared/model/ui-bus";
import {
  CommandGroup,
  EmptyState,
  FooterHints,
  Preview,
  PreviewEmpty,
  SearchIcon,
  useCommandNavigation,
  useCommandSearch,
} from "./command-palette";
import "./command-palette.css";

interface CommandPaletteProps {
  onClose: () => void;
}

export function CommandPalette({ onClose }: CommandPaletteProps) {
  useFeatureRegistry((s) => s.features);

  const [rawQuery, setRawQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const { devMode, filter, grouped, visualOrder, indexOf } = useCommandSearch(rawQuery);

  const { selectedIndex, setSelectedIndex, listRef, runAt, handleKeyDown } =
    useCommandNavigation({ visualOrder, rawQuery, onClose });

  const selectedEntry = visualOrder[selectedIndex];

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setRawQuery(e.target.value);
  };

  const handleBackdropClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="cp__backdrop" onMouseDown={handleBackdropClick} role="presentation">
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
                  <CommandGroup
                    group={group}
                    selectedIndex={selectedIndex}
                    indexOf={indexOf}
                    onHover={setSelectedIndex}
                    onRun={runAt}
                  />
                </Fragment>
              ))
            )}
          </div>

          <div className="cp__preview" aria-live="polite">
            {selectedEntry ? <Preview entry={selectedEntry} /> : <PreviewEmpty />}
          </div>
        </div>

        <FooterHints resultCount={visualOrder.length} devMode={devMode} />
      </div>
    </div>
  );
}

export function CommandPaletteHost() {
  const open = useUiBus((s) => s.paletteOpen);
  const handleClose = useCallback(() => {
    uiBus.togglePalette(false);
  }, []);
  if (!open) return null;
  return <CommandPalette onClose={handleClose} />;
}
