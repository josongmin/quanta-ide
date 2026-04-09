import type { CodeLine } from "@/widgets/ide-editor";
import type { Metric } from "@/features/ide-metrics";
import type { Pill } from "@/features/ide-pills";
import type { CallNode } from "@/features/ide-call-graph";
import type { FlowStep } from "@/features/ide-data-flow";

export const LEDGER_LINES: CodeLine[] = [
  { no: 1, code: <><span className="kw">import</span> <span className="punct">{"{ "}</span><span className="var">db</span><span className="punct">{" }"}</span> <span className="kw">from</span> <span className="str">{'"@/infra/database"'}</span><span className="punct">;</span></> },
  { no: 2, code: <></> },
  { no: 3, code: <><span className="com">// write transaction to immutable ledger</span></> },
  { no: 4, risk: 2, code: <><span className="kw">export function</span> <span className="fn">appendLedger</span><span className="punct">(</span><span className="var">entry</span><span className="punct">: </span><span className="var">LedgerEntry</span><span className="punct">) {"{"}</span></>, inline: "complexity 2.4  ·  tested" },
  { no: 5, code: <>{"  "}<span className="kw">const</span> <span className="var">row</span> <span className="punct">=</span> <span className="var">db</span><span className="punct">.</span><span className="fn">insertLedger</span><span className="punct">(</span><span className="var">entry</span><span className="punct">);</span></> },
  { no: 6, code: <>{"  "}<span className="kw">return</span> <span className="var">row</span><span className="punct">;</span></> },
  { no: 7, risk: 2, code: <><span className="punct">{"}"}</span></>, inline: "blast 8 files" },
  { no: 8, code: <></> },
  { no: 9, code: <><span className="com">// dead — replaced by appendLedger</span></> },
  { no: 10, code: <><span className="kw">function</span> <span className="fn">writeLegacyLedger</span><span className="punct">() {"{ … }"}</span></>, inline: "dead code" },
];

export const LEDGER_METRICS: Metric[] = [
  { key: "cpx", v: "2.4" },
  { key: "tests", v: "6", delta: "/6" },
  { key: "callers", v: "4" },
  { key: "blast", v: "8" },
];

export const LEDGER_PILLS: Pill[] = [
  { pillKey: "ledger.tested", risk: "hot" },
  { pillKey: "ledger.immutableWrite", risk: 1 },
  { pillKey: "ledger.deadInFile", risk: 2 },
];

export const LEDGER_CALL_GRAPH: CallNode[] = [
  { name: "appendLedger", depth: 0 },
  { name: "db.insertLedger", depth: 1, tag: "write" },
  { name: "processRefund", depth: 1 },
  { name: "processCharge", depth: 1, isLast: true },
];

export const LEDGER_DATA_FLOW: FlowStep[] = [
  { group: "ledger", step: "entry", tag: "source" },
  { group: "ledger", step: "insert", tag: "sink", sink: true },
];
