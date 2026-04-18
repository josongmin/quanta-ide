/** OWASP for LLMs — risks specific to model-driven code paths. */
export type LLMRiskKind =
  | "prompt-injection"      // user input → prompt verbatim
  | "model-output-trust"    // LLM output used as code/SQL/path/cmd
  | "token-budget-overrun"  // unbounded chain depth or context size
  | "cache-poisoning"       // cache key omits user/tenant/model context
  | "hallucination-floor";  // output used without confidence check

export interface LLMSignal {
  kind: LLMRiskKind;
  /** Where this signal triggers (Python source line). */
  line: number;
  /** OWASP-LLM mapping (e.g. "LLM01: Prompt Injection"). */
  owasp?: string;
  detail?: string;
}
