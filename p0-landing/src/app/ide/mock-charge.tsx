import type { CodeLine } from "@/widgets/ide-editor";
import type { Metric } from "@/features/ide-metrics";
import type { Pill } from "@/features/ide-pills";
import type { CallNode } from "@/features/ide-call-graph";
import type { FlowStep } from "@/features/ide-data-flow";

export const CHARGE_LINES: CodeLine[] = [
  { no: 1, code: <><span className="kw">import</span> <span className="punct">{"{ "}</span><span className="var">stripe</span><span className="punct">{" }"}</span> <span className="kw">from</span> <span className="str">{'"@/adapters/stripe"'}</span><span className="punct">;</span></> },
  { no: 2, code: <><span className="kw">import</span> <span className="punct">{"{ "}</span><span className="var">db</span><span className="punct">{" }"}</span> <span className="kw">from</span> <span className="str">{'"@/infra/database"'}</span><span className="punct">;</span></> },
  { no: 3, code: <></> },
  { no: 4, code: <><span className="com">// process a new charge via Stripe</span></> },
  { no: 5, risk: 3, code: <><span className="kw">export async function</span> <span className="fn">processCharge</span><span className="punct">(</span><span className="var">customerId</span><span className="punct">: </span><span className="kw">string</span><span className="punct">, </span><span className="var">amount</span><span className="punct">: </span><span className="kw">number</span><span className="punct">) {"{"}</span></>, inline: "complexity 5.1  ·  tested" },
  { no: 6, risk: 2, code: <>{"  "}<span className="kw">const</span> <span className="var">intent</span> <span className="punct">=</span> <span className="kw">await</span> <span className="var">stripe</span><span className="punct">.</span><span className="fn">createIntent</span><span className="punct">(</span><span className="var">customerId</span><span className="punct">, </span><span className="var">amount</span><span className="punct">);</span></>, inline: "external call" },
  { no: 7, code: <>{"  "}<span className="kw">const</span> <span className="var">tx</span> <span className="punct">=</span> <span className="kw">await</span> <span className="var">db</span><span className="punct">.</span><span className="fn">insert</span><span className="punct">({"{ "}</span><span className="var">customerId</span><span className="punct">, </span><span className="var">amount</span><span className="punct">, </span><span className="var">intentId</span><span className="punct">: </span><span className="var">intent</span><span className="punct">.</span><span className="var">id</span><span className="punct">{" });"}</span></> },
  { no: 8, code: <>{"  "}<span className="kw">return</span> <span className="var">tx</span><span className="punct">;</span></> },
  { no: 9, risk: 3, code: <><span className="punct">{"}"}</span></>, inline: "blast 18 files" },
];

export const CHARGE_METRICS: Metric[] = [
  { key: "cpx", v: "5.1" },
  { key: "tests", v: "8", delta: "/12" },
  { key: "callers", v: "12" },
  { key: "blast", v: "18" },
];

export const CHARGE_PILLS: Pill[] = [
  { pillKey: "charge.externalApi", risk: 2 },
  { pillKey: "charge.tested", risk: "hot" },
  { pillKey: "charge.callers", pillParams: { count: 12 }, risk: 1 },
];

export const CHARGE_CALL_GRAPH: CallNode[] = [
  { name: "processCharge", depth: 0 },
  { name: "stripe.createIntent", depth: 1, tag: "external" },
  { name: "db.insert", depth: 1, tag: "write" },
  { name: "emitEvent", depth: 1, tag: "async", isLast: true },
];

export const CHARGE_DATA_FLOW: FlowStep[] = [
  { group: "charge", step: "param", tag: "source" },
  { group: "charge", step: "stripe" },
  { group: "charge", step: "insert", tag: "sink", sink: true },
];
