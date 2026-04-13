import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useTerminalStore } from "@/entities/terminal";
import type { TerminalSession } from "@/entities/terminal";
import { mockExec, bridgeToGui } from "../model/p0-commands";

interface TerminalBufferProps {
  session: TerminalSession;
}

let lineCounter = 1000;
function nextId(): string {
  return `tm-${(lineCounter++).toString()}`;
}

/* ── Component ─────────────────────────────────────────────────────── */

export function TerminalBuffer({ session }: TerminalBufferProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const appendLine = useTerminalStore((s) => s.appendLine);
  const clearActive = useTerminalStore((s) => s.clearActive);

  useEffect(() => {
    const el = scrollRef.current;
    if (el === null) return;
    el.scrollTop = el.scrollHeight;
  }, [session.lines, input]);

  const focusInput = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = useCallback(() => {
    const cmd = input.trim();
    appendLine(session.id, { id: nextId(), kind: "prompt", text: cmd });

    if (cmd === "clear") {
      clearActive();
    } else {
      const output = mockExec(cmd);
      for (const line of output) {
        appendLine(session.id, { id: nextId(), kind: line.kind, text: line.text });
      }
      // Bridge p0 commands to GUI panels
      bridgeToGui(cmd);
    }

    if (cmd !== "") {
      setHistory((prev) => [...prev, cmd]);
    }
    setHistIdx(-1);
    setInput("");
  }, [input, session.id, appendLine, clearActive]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (history.length === 0) return;
      const next = histIdx === -1 ? history.length - 1 : Math.max(0, histIdx - 1);
      setHistIdx(next);
      setInput(history[next]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (histIdx === -1) return;
      const next = histIdx + 1;
      if (next >= history.length) {
        setHistIdx(-1);
        setInput("");
      } else {
        setHistIdx(next);
        setInput(history[next]);
      }
    } else if (e.key === "l" && e.ctrlKey) {
      e.preventDefault();
      clearActive();
    }
  }, [handleSubmit, history, histIdx, clearActive]);

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div className="tm-buffer" ref={scrollRef} onClick={focusInput}>
      <ol className="tm-lines" aria-label={`Terminal output for ${session.label}`}>
        {session.lines.map((line) => (
          <li key={line.id} className={`tm-line tm-line-${line.kind}`}>
            {line.kind === "prompt" ? (
              <>
                <span className="tm-line-prompt-head">{session.promptHead}</span>
                <span className="tm-line-prompt-sep">$</span>
                <span className="tm-line-text">{line.text}</span>
              </>
            ) : (
              <span className="tm-line-text">{line.text}</span>
            )}
          </li>
        ))}
      </ol>
      <div className="tm-input-row">
        <span className="tm-input-prompt-head">{session.promptHead}</span>
        <span className="tm-input-sep">$</span>
        <input
          ref={inputRef}
          className="tm-input"
          type="text"
          value={input}
          onChange={(e) => { setInput(e.target.value); }}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          autoComplete="off"
          aria-label="Terminal input"
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
        />
      </div>
    </div>
  );
}
