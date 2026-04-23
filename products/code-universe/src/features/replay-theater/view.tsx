// ReplayTheater view descriptor — agent session playback theater.
// --------------------------------------------------------------------
// Reference: Session-replay pattern popularized by LogRocket and
// FullStory for web apps, adapted here for AI agent runs; time-travel
// debugging literature (Microsoft Time Travel Debugging, rr 2017).

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { ReplayTheaterView } from "./ui/ReplayTheaterView";

function ReplayTheaterModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  if (ctx.viewportSize.w <= 0 || ctx.viewportSize.h <= 0) return null;
  return <ReplayTheaterView ctx={ctx} />;
}

export const replayTheaterViewDescriptor: ViewDescriptor = {
  id: "replay-theater",
  label: "Replay",
  glyph: "▶",
  hint: "에이전트 세션 재생 극장",
  tech: "step timeline × scrubber × play controls",
  usecase:
    "에이전트 과거 실행 재현. 왜 실패했나 타임라인 재연.",
  category: "ai",
  contexts: ["repo"],
  needs: { tree: true },
  order: 895,
  capabilityKinds: ["view", "decision-input", "workflow-step"],
  taxonomy: {
    primary: {
      domain: "ai-agent",
      scope: "agent-run",
      intent: "verify",
    },
    scopes: ["file", "agent-run", "task"],
    intents: ["explain", "diagnose", "verify"],
    subdomain: "run-replay",
    personas: ["developer", "reviewer", "ai-operator"],
    surfaces: ["view", "tab", "command"],
    maturity: "advanced",
    signal: {
      dataFreshness: "snapshot",
      confidence: "measured",
      actionability: "triage",
      cost: "medium",
      latency: "interactive",
      determinism: "deterministic",
      evidenceLevel: "strong",
      decisionGrade: "triage",
    },
    related: ["agent-trajectory", "trajectory-decompose", "stuck-pattern"],
    keywords: ["replay", "theater", "run", "trace", "debug"],
  },
  decision: {
    grade: "triage",
    supports: ["approve-agent-run", "escalate-review"],
    evidenceClass: "strong",
    failClosedEligible: false,
    humanReviewRequired: true,
  },
  actions: ["open-tab", "run-analysis", "compare-related"],
  workflow: {
    usableInStacks: ["agent-failure-stack"],
    canBeAutoSuggested: true,
    canBeAutoAttached: true,
    requiresOrderedExecution: false,
  },
  quality: {
    maturity: "advanced",
    owner: "ai-platform",
  },
  Component: ReplayTheaterModeView,
};
