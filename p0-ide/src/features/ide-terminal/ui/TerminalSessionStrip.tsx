import type { TerminalSession } from "@/entities/terminal";
import { IconPlus } from "@/shared/ui";

interface TerminalSessionStripProps {
  sessions: readonly TerminalSession[];
  activeId: string;
  onSelect: (id: string) => void;
  /** 새 세션 버튼. Phase 1.5 에선 no-op 이지만 affordance 만 노출. */
  onNew?: () => void;
  onClear: () => void;
}

/**
 * 상단 세션 strip — 탭 + 새 세션 + clear.
 * VSCode 터미널 strip의 저밀도 버전.
 */
export function TerminalSessionStrip({
  sessions,
  activeId,
  onSelect,
  onNew,
  onClear,
}: TerminalSessionStripProps) {
  return (
    <div className="tm-strip">
      <span className="bp-panel-title">Terminal</span>
      <span className="bp-toolbar-sep" aria-hidden />
      <div className="tm-strip-list" role="tablist" aria-label="Terminal sessions">
        {sessions.map((s) => {
          const isActive = s.id === activeId;
          return (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`tm-strip-tab${isActive ? " is-active" : ""}`}
              onClick={() => { onSelect(s.id); }}
              title={s.label}
            >
              <span className="tm-strip-dot" aria-hidden />
              <span className="tm-strip-label">{s.label}</span>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className="tm-strip-new"
        onClick={onNew}
        aria-label="New terminal session"
        title="New session"
        disabled={onNew === undefined}
      >
        <IconPlus size={12} />
      </button>
      <div className="tm-strip-spacer" />
      <button
        type="button"
        className="tm-strip-action"
        onClick={onClear}
        aria-label="Clear terminal"
        title="Clear"
      >
        clear
      </button>
    </div>
  );
}
