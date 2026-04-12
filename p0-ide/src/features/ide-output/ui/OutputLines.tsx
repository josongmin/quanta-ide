import { useEffect, useRef } from "react";
import type { OutputChannel } from "@/entities/output-log";
import { formatHms } from "../lib/formatTime";

interface OutputLinesProps {
  channel: OutputChannel;
  wrap: boolean;
}

export function OutputLines({ channel, wrap }: OutputLinesProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el === null) return;
    el.scrollTop = el.scrollHeight;
  }, [channel.lines, channel.id]);

  if (channel.lines.length === 0) {
    return (
      <div className="op-empty" aria-live="polite">
        no output yet
      </div>
    );
  }

  return (
    <div className={`op-scroll${wrap ? " is-wrap" : ""}`} ref={scrollRef}>
      <ol className="op-lines" aria-label={`${channel.label} output`}>
        {channel.lines.map((l) => (
          <li key={l.id} className={`op-line op-line-${l.level}`}>
            <span className="op-line-time">{formatHms(l.at)}</span>
            <span className={`op-line-level op-line-level-${l.level}`}>
              {l.level}
            </span>
            <span className="op-line-text">{l.text}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
