import { AGENT_QUERIES } from "../model/useAgentWindow";
import type { ChatMsg } from "../model/types";

export function buildReply(question: string): ChatMsg[] {
  const q = AGENT_QUERIES.find((aq) =>
    question.toLowerCase().includes(aq.id.replace("-", " ")) ||
    question === aq.question
  ) ?? AGENT_QUERIES[0];

  const a = q.answer;

  return [
    {
      id: `agent-${Date.now()}`,
      role: "agent",
      parts: [
        { type: "text", text: a.body },
        {
          type: "metrics",
          items: [
            { label: "TRACE HOPS", value: a.traceHops },
            { label: "RISK SCORE", value: a.riskScore, risk: true },
            { label: "WRITERS",    value: a.writers },
          ],
        },
        { type: "text", text: `**${a.headline}**` },
        { type: "bullets", items: a.bullets },
        {
          type: "code",
          block: {
            lang: "typescript",
            file: "refund.ts:7-9",
            code: [
              `<span class="agw-code-cmt">// idempotency key dropped here ↓</span>`,
              `<span class="agw-code-kw">const</span> validated = <span class="agw-code-fn">parse</span>(amount);`,
              `<span class="agw-code-kw">const</span> tx = <span class="agw-code-fn">build</span>(validated); <span class="agw-code-cmt">// no key passed</span>`,
              `<span class="agw-code-kw">await</span> db.<span class="agw-code-fn">update</span>(tx); <span class="agw-code-cmt">// ← can run twice</span>`,
            ].join("\n"),
          },
        },
        { type: "artifacts", items: a.artifacts },
      ],
    },
  ];
}
