import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useTerminalStore } from "@/entities/terminal";
import type { TerminalLineKind, TerminalSession } from "@/entities/terminal";

interface TerminalBufferProps {
  session: TerminalSession;
}

let lineCounter = 1000;
function nextId(): string {
  return `tm-${(lineCounter++).toString()}`;
}

/* ── Output line with kind ─────────────────────────────────────────── */
interface OutputLine {
  text: string;
  kind: TerminalLineKind;
}

function out(text: string): OutputLine { return { text, kind: "stdout" }; }
function err(text: string): OutputLine { return { text, kind: "stderr" }; }
function sys(text: string): OutputLine { return { text, kind: "system" }; }

/* ── p0 CLI commands ───────────────────────────────────────────────── */

function p0Blast(args: string): OutputLine[] {
  const target = args.trim() || "processRefund";
  return [
    sys(`⚡ ${target} → 31 files affected, 3 hot paths`),
    out(`  🔴 fee.ts:42         calculateFee       direct · risk 4`),
    out(`  🔴 webhook.ts:31     dispatchWebhook    direct · risk 4`),
    out(`  🟡 retry.ts:18       RetryScheduler     direct · risk 3`),
    out(`  🟡 ledger.ts:201     postEntry          direct · risk 3`),
    out(`  🔵 billing.ts:55     chargeCycle        2-hop  · risk 3`),
    out(`  ⚫ audit.ts:12       logAuditEvent      direct · risk 2`),
    sys(`  ... 25 more files (p0 blast ${target} --all)`),
  ];
}

function p0Risk(): OutputLine[] {
  return [
    sys(`⚠ Risk 78/100`),
    out(`  taint     ████████░░  3 paths    (source → sink without sanitize)`),
    out(`  coverage  ███████░░░  4 funcs    (blast zone, 0 tests)`),
    out(`  blast     █████████░  +18 files  (vs. yesterday)`),
    out(`  dead      ██░░░░░░░░  2 symbols  (_legacy_inference_bridge, OldRetryPolicy)`),
    out(`  churn     ██████░░░░  28 commits (orchestrator.py, 30d)`),
    out(`  cyclic    █░░░░░░░░░  1 cycle    (fee ↔ webhook)`),
    sys(`  run "p0 risk --history" for 7-day trend`),
  ];
}

function p0Safe(): OutputLine[] {
  return [
    err(`✕ NOT SAFE — 2 blockers found`),
    out(``),
    err(`  1. fee.ts:42 calculateFee()`),
    out(`     blast risk 4 · no test covers the new refund→fee path`),
    out(`     suggestion: add test for calculateFee(negativeAmount)`),
    out(``),
    err(`  2. webhook.ts:31 dispatchWebhook()`),
    out(`     taint: req.body.amount → DB write without sanitizeAmount()`),
    out(`     suggestion: p0 fix webhook.ts:31`),
    out(``),
    sys(`  run "p0 fix" to apply suggested fixes`),
  ];
}

function p0Why(args: string): OutputLine[] {
  const target = args.trim() || "orchestrator.py:318";
  return [
    sys(`🔍 Root cause analysis: ${target}`),
    out(``),
    out(`  entry       → handleRefundRequest     api/handler.py:42`),
    out(`  propagation → processRefund           orchestrator.py:315`),
    err(`  ★ root      → retryLoop               orchestrator.py:318`),
    out(`  propagation → chargeGateway           gateway/client.py:88`),
    out(`  propagation → postEntry               ledger.ts:201`),
    out(``),
    sys(`  Retry loop at L:318 re-invokes processRefund without`),
    sys(`  idempotency check. Transient 503 causes 3× charge.`),
    out(``),
    sys(`  confidence: high · INC-2024-0312 · P0`),
  ];
}

function p0Trace(args: string): OutputLine[] {
  const target = args.trim() || "processRefund";
  return [
    sys(`→ Execution trace: ${target}`),
    out(``),
    out(`  → api/handler.py:42      handleRefundRequest`),
    out(`    → orchestrator.py:315  processRefund`),
    out(`      → orchestrator.py:318  retryLoop          [taint: amount]`),
    out(`        → gateway/client.py:88  chargeGateway   [taint: amount → stripe_api]`),
    out(`        → ledger.ts:201  postEntry              [sink: DB write]`),
    out(`      → fee.ts:42  calculateFee                 [hot path]`),
    out(`    → audit.ts:12  logAuditEvent`),
    out(``),
    sys(`  7 nodes · 2 taint paths · 1 sink`),
  ];
}

function p0Ask(args: string): OutputLine[] {
  const q = args.trim();
  if (!q) return [err(`usage: p0 ask "your question"`)];
  return [
    sys(`🤖 p0 agent`),
    out(``),
    out(`  processRefund()를 변경하면 fee.ts와 webhook.ts가`),
    out(`  직접 영향을 받습니다. fee.ts:calculateFee()는 risk 4로`),
    out(`  가장 위험하며, 현재 테스트가 없습니다.`),
    out(``),
    out(`  webhook.ts:dispatchWebhook()에는 sanitize 없이`),
    out(`  user input이 DB write까지 도달하는 taint path가`),
    out(`  있습니다.`),
    out(``),
    sys(`  suggested actions:`),
    out(`    1. p0 fix fee.ts:42      — add test coverage`),
    out(`    2. p0 fix webhook.ts:31  — insert sanitizeAmount()`),
    out(`    3. p0 safe?              — re-check after fix`),
  ];
}

function p0Help(): OutputLine[] {
  return [
    sys(`p0 — code intelligence CLI`),
    out(``),
    out(`  p0 blast [symbol]    show blast radius for a function`),
    out(`  p0 risk              current change risk score + factors`),
    out(`  p0 safe?             can I deploy? blockers check`),
    out(`  p0 why [file:line]   root cause trace`),
    out(`  p0 trace [symbol]    execution path + taint flow`),
    out(`  p0 ask "question"    natural language query`),
    out(``),
    sys(`  built-in: ls, pwd, whoami, date, echo, clear, help`),
  ];
}

/* ── Mock shell executor ───────────────────────────────────────────── */

function mockExec(cmd: string): OutputLine[] {
  const trimmed = cmd.trim();
  if (trimmed === "") return [];
  if (trimmed === "clear") return [];

  // p0 CLI
  if (trimmed === "p0" || trimmed === "p0 help" || trimmed === "p0 --help") return p0Help();
  if (trimmed.startsWith("p0 blast")) return p0Blast(trimmed.slice(8));
  if (trimmed === "p0 risk") return p0Risk();
  if (trimmed === "p0 safe?" || trimmed === "p0 safe") return p0Safe();
  if (trimmed.startsWith("p0 why")) return p0Why(trimmed.slice(6));
  if (trimmed.startsWith("p0 trace")) return p0Trace(trimmed.slice(8));
  if (trimmed.startsWith("p0 ask")) return p0Ask(trimmed.slice(6));

  // Shell builtins
  if (trimmed === "ls") return [out("CLAUDE.md  p0-ide/  .ai/  .github/")];
  if (trimmed === "pwd") return [out("/Users/songmin/Documents/code-new/quanta-ide")];
  if (trimmed === "whoami") return [out("songmin")];
  if (trimmed === "date") return [out(new Date().toLocaleString())];
  if (trimmed.startsWith("echo ")) return [out(trimmed.slice(5))];
  if (trimmed === "help") return p0Help();
  if (trimmed === "git status") {
    return [
      out("On branch main"),
      out("Changes not staged for commit:"),
      out("  modified:   p0-ide/src/features/ide-terminal/ui/TerminalBuffer.tsx"),
      out(""),
      sys('use "git add" to update what will be committed'),
    ];
  }
  if (trimmed === "pnpm test") {
    return [
      sys("> quanta-ide@0.0.0 test"),
      out(""),
      out(" Test Files  7 passed (7)"),
      out("      Tests  20 passed (20)"),
      sys("   Duration  2.04s"),
    ];
  }

  return [err(`zsh: command not found: ${trimmed.split(" ")[0]}`)];
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
