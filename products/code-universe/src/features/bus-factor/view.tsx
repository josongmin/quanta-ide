// Bus Factor view descriptor — sole-ownership risk ranking.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { BusFactorView } from "./ui/BusFactorView";

function BusFactorModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  if (ctx.viewportSize.w <= 0 || ctx.viewportSize.h <= 0) return null;
  return <BusFactorView ctx={ctx} />;
}

export const busFactorViewDescriptor: ViewDescriptor = {
  id: "bus-factor",
  label: "Bus",
  glyph: "◍",
  hint: "버스 팩터 — 한 사람 의존 파일",
  tech: "git blame author 분포 집계",
  usecase:
    "팀 리스크 감지. '이 사람 나가면 아무도 못 만짐' 찾기.",
  category: "team",
  contexts: ["repo", "folder"],
  needs: { tree: true },
  order: 580,
  capabilityKinds: ["view", "decision-input", "workflow-step"],
  taxonomy: {
    primary: {
      domain: "se-ownership-team",
      scope: "folder",
      intent: "diagnose",
    },
    scopes: ["folder", "repo"],
    intents: ["diagnose", "govern"],
    personas: ["manager", "tech-lead", "developer"],
    surfaces: ["view", "tab", "dashboard-card"],
    maturity: "advanced",
    signal: {
      dataFreshness: "snapshot",
      confidence: "measured",
      actionability: "direct-action",
      cost: "medium",
      latency: "interactive",
      determinism: "deterministic",
      evidenceLevel: "strong",
      decisionGrade: "advisory",
    },
    domains: ["se-ownership-team", "productivity"],
    subdomain: "single-owner-risk",
    related: ["truck-factor", "ownership-sankey", "author-territory"],
    keywords: ["bus-factor", "owner", "risk", "single-point-of-failure", "team"],
  },
  decision: {
    grade: "advisory",
    supports: ["delegate", "escalate-review", "policy-audit"],
    evidenceClass: "strong",
  },
  actions: ["open-tab", "run-analysis", "attach-to-task-routing", "pin-dashboard"],
  workflow: {
    canBeAutoSuggested: true,
    canBeAutoAttached: true,
  },
  quality: {
    maturity: "advanced",
    owner: "team",
  },
  Component: BusFactorModeView,
};
