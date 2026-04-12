import type { OutputChannel } from "@/entities/output-log";
import { Select, type SelectOption } from "@/shared/ui";

interface OutputToolbarProps {
  channels: readonly OutputChannel[];
  activeId: string;
  onSelect: (id: string) => void;
  wrap: boolean;
  onToggleWrap: () => void;
  onClear: () => void;
}

export function OutputToolbar({
  channels,
  activeId,
  onSelect,
  wrap,
  onToggleWrap,
  onClear,
}: OutputToolbarProps) {
  const options: SelectOption<string>[] = channels.map((c) => ({
    value: c.id,
    label: (
      <span className="op-channel-opt">
        <span className="op-channel-opt-label">{c.label}</span>
        <span className="op-channel-opt-count">{c.lines.length}</span>
      </span>
    ),
  }));

  return (
    <div className="op-toolbar">
      <span className="bp-panel-title">Output</span>
      <span className="bp-toolbar-sep" aria-hidden />
      <span className="op-toolbar-label">channel</span>
      <div className="op-toolbar-select">
        <Select
          value={activeId}
          options={options}
          onChange={onSelect}
          size="sm"
          aria-label="Output channel"
        />
      </div>
      <div className="op-toolbar-spacer" />
      <button
        type="button"
        className={`op-toolbar-toggle${wrap ? " is-on" : ""}`}
        onClick={onToggleWrap}
        aria-pressed={wrap}
        title="Toggle line wrap"
      >
        wrap
      </button>
      <button
        type="button"
        className="op-toolbar-action"
        onClick={onClear}
        aria-label="Clear channel"
        title="Clear"
      >
        clear
      </button>
    </div>
  );
}
