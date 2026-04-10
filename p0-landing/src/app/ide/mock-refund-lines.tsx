import { HoverSymbol, type CodeLine } from "@/widgets/ide-editor";
import type { LineHint } from "@/widgets/ide-editor";

export const REFUND_LINES: CodeLine[] = [
  {
    no: 1,
    code: (
      <>
        <span className="kw">import</span> <span className="punct">{"{ "}</span>
        <HoverSymbol info={{ name: "db", kind: "import", origin: "@/infra/database", callers: 47 }}>
          <span className="var">db</span>
        </HoverSymbol>
        <span className="punct">{" }"}</span> <span className="kw">from</span>{" "}
        <span className="str">{'"@/infra/database"'}</span>
        <span className="punct">;</span>
      </>
    ),
  },
  {
    no: 2,
    code: (
      <>
        <span className="kw">import</span> <span className="punct">{"{ "}</span>
        <span className="var">parse</span><span className="punct">{", "}</span>
        <span className="var">build</span>
        <span className="punct">{" }"}</span> <span className="kw">from</span>{" "}
        <span className="str">{'"./helpers"'}</span>
        <span className="punct">;</span>
      </>
    ),
  },
  { no: 3, code: <></> },
  { no: 4, code: <><span className="com">// retry refund — webhook entrypoint</span></> },
  {
    no: 5,
    risk: 4,
    context: { lineNo: 5, risk: 4, summary: "Function entrypoint — high complexity", detail: "complexity 8.2 · 0/14 tests · 14 callers · blast 31 files" },
    code: (
      <>
        <span className="kw">export async function</span>{" "}
        <HoverSymbol info={{ name: "processRefund", kind: "function", complexity: 8.2, callers: 14, blame: { author: "@kimdev", when: "3w ago" } }}>
          <span className="fn">processRefund</span>
        </HoverSymbol>
        <span className="punct">(</span><span className="var">userId</span><span className="punct">: </span><span className="kw">string</span><span className="punct">) {`{`}</span>
      </>
    ),
    hints: [
      { type: "complexity", value: 8.2 } as LineHint,
      { type: "coverage", passed: 0, total: 14 } as LineHint,
      { type: "author", name: "@kimdev", when: "3w" } as LineHint,
    ],
  },
  {
    no: 6,
    risk: 4,
    context: { lineNo: 6, risk: 4, summary: "Taint source — unsanitized user input", detail: "req.body.amount enters here and reaches db.update at line 9 without validation." },
    code: (
      <>
        {"  "}<span className="kw">const</span>{" "}
        <HoverSymbol info={{ name: "amount", kind: "variable", taint: "source", origin: "req.body.amount", flowsTo: "db.update (line 9)" }}>
          <span className="var">amount</span>
        </HoverSymbol>{" "}
        <span className="punct">=</span> <span className="var">req</span><span className="punct">.</span><span className="var">body</span><span className="punct">.</span><span className="var">amount</span><span className="punct">;</span>
      </>
    ),
    hints: [
      { type: "taint-flow", from: "req.body", to: "db.update" } as LineHint,
    ],
  },
  {
    no: 7,
    risk: 3,
    context: { lineNo: 7, risk: 3, summary: "Passthrough — parse() does not sanitize", detail: "parse() converts type but does not enforce range." },
    code: (
      <>
        {"  "}<span className="kw">const</span> <span className="var">validated</span>{" "}
        <span className="punct">=</span>{" "}
        <HoverSymbol info={{ name: "parse", kind: "function", complexity: 2.1, callers: 8 }}>
          <span className="fn">parse</span>
        </HoverSymbol>
        <span className="punct">(</span><span className="var">amount</span><span className="punct">);</span>
      </>
    ),
  },
  {
    no: 8,
    risk: 3,
    code: (
      <>
        {"  "}<span className="kw">const</span> <span className="var">tx</span>{" "}
        <span className="punct">=</span>{" "}
        <HoverSymbol info={{ name: "build", kind: "function", complexity: 1.4, callers: 5 }}>
          <span className="fn">build</span>
        </HoverSymbol>
        <span className="punct">(</span><span className="var">validated</span><span className="punct">);</span>
      </>
    ),
  },
  {
    no: 9,
    risk: 4,
    context: { lineNo: 9, risk: 4, summary: "Taint sink — DB write reaches 14 callers", detail: "Tainted value flows into db.update with no sanitizer. 14 callers; 4 lack tests." },
    code: (
      <>
        {"  "}<span className="kw">await</span>{" "}
        <HoverSymbol info={{ name: "db", kind: "variable", taint: "sink", callers: 47 }}>
          <span className="var">db</span>
        </HoverSymbol>
        <span className="punct">.</span>
        <HoverSymbol info={{ name: "db.update", kind: "function", taint: "sink", callers: 14, origin: "req.body.amount (line 6)" }}>
          <span className="fn">update</span>
        </HoverSymbol>
        <span className="punct">(</span><span className="var">tx</span><span className="punct">);</span>
      </>
    ),
    hints: [
      { type: "callers", count: 14, warn: true } as LineHint,
      { type: "warn-badge", label: "can run twice" } as LineHint,
    ],
  },
  {
    no: 10,
    risk: 2,
    code: (
      <>
        {"  "}<span className="kw">return</span> <span className="punct">{"{ "}</span><span className="var">ok</span><span className="punct">: </span><span className="kw">true</span><span className="punct">{" };"}</span>
      </>
    ),
  },
  {
    no: 11,
    risk: 4,
    context: { lineNo: 11, risk: 4, summary: "Function exit — blast radius 31 files", detail: "Modifying processRefund affects 31 files via direct + transitive references." },
    code: <><span className="punct">{`}`}</span></>,
    hints: [
      { type: "blast", files: 31 } as LineHint,
    ],
  },
  { no: 12, code: <></> },
  { no: 13, code: <><span className="com">// dead — last reference removed 6mo ago</span></> },
  {
    no: 14,
    code: (
      <>
        <span className="kw">function</span>{" "}
        <HoverSymbol info={{ name: "sendWebhook", kind: "function", callers: 0, blame: { author: "@parkdev", when: "8mo ago" } }}>
          <span className="fn">sendWebhook</span>
        </HoverSymbol>
        <span className="punct">() {`{ … }`}</span>
      </>
    ),
    hints: [
      { type: "stale", age: "stale 6mo" } as LineHint,
      { type: "callers", count: 0 } as LineHint,
    ],
  },
];
