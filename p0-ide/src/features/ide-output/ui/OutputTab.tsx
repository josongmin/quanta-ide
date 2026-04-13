import { useEffect, useMemo, useRef, useState } from "react";
import {
  MOCK_OUTPUT,
  selectActiveChannelId,
  selectOutputChannels,
  useOutputLogStore,
  type OutputChannel,
} from "@/entities/output-log";
import { OutputToolbar } from "./OutputToolbar";
import { OutputLines } from "./OutputLines";

/**
 * Output 탭 조립.
 *
 * 채널 드롭다운은 shared Select 재활용. wrap toggle은 로컬 ui state.
 */
export function OutputTab() {
  const channels = useOutputLogStore(selectOutputChannels);
  const activeId = useOutputLogStore(selectActiveChannelId);
  const setSnapshot = useOutputLogStore((s) => s.setSnapshot);
  const setActiveChannel = useOutputLogStore((s) => s.setActiveChannel);
  const clearActive = useOutputLogStore((s) => s.clearActive);

  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    if (channels.length === 0) {
      setSnapshot(MOCK_OUTPUT);
    }
  }, [channels, setSnapshot]);

  const [wrap, setWrap] = useState(false);

  const active: OutputChannel | undefined = useMemo(() => {
    if (channels.length === 0) return undefined;
    const byId = channels.find((c) => c.id === activeId);
    return byId ?? channels[0];
  }, [channels, activeId]);

  return (
    <div className="op-root">
      <OutputToolbar
        channels={channels}
        activeId={active === undefined ? "" : active.id}
        onSelect={setActiveChannel}
        wrap={wrap}
        onToggleWrap={() => { setWrap((w) => !w); }}
        onClear={clearActive}
      />
      {active === undefined ? (
        <div className="op-empty" aria-live="polite">
          no channel
        </div>
      ) : (
        <OutputLines channel={active} wrap={wrap} />
      )}
    </div>
  );
}
