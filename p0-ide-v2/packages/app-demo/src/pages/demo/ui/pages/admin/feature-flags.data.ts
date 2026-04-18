// feature-flags.data.ts
// Static fixtures for FeatureFlagsPage. Split out so the component file stays under ~400 lines.

import type { LucideIcon } from "lucide-react";
import {
  Brain,
  DollarSign,
  FlaskConical,
  Layers,
  Moon,
  Skull,
  Zap,
  ShieldCheck,
} from "lucide-react";

export type Env = "prod" | "staging" | "local";
export type FlagStatus =
  | "on"
  | "rolling"
  | "experiment"
  | "canary"
  | "draft"
  | "targeted"
  | "killed";

export interface Variant {
  name: string;
  traffic: number; // 0..1
  cvr: number; // 0..1
  pValue: number;
}

export interface Flag {
  key: string;
  description: string;
  rollout: Record<Env, number>; // 0..100
  variants: string[];
  variantPerf?: Variant[];
  modified: string;
  status: FlagStatus;
  Icon: LucideIcon;
  tone: string;
  rules?: Array<{ when: string; serve: string }>;
  overrides?: Array<{ email: string; variant: string; since: string }>;
  evaluations?: number[];
  targetNote?: string;
}

export const FLAGS: Flag[] = [
  {
    key: "canvas.multi_file",
    description: "Multi-file Code Universe — all files in one canvas",
    rollout: { prod: 100, staging: 100, local: 100 },
    variants: ["on", "off"],
    modified: "3d ago",
    status: "on",
    Icon: Layers,
    tone: "var(--success)",
    rules: [
      { when: "workspace.plan IS Enterprise", serve: "on" },
      { when: "everyone else", serve: "on" },
    ],
    overrides: [],
    evaluations: [0.3, 0.35, 0.4, 0.45, 0.5, 0.52, 0.58, 0.6, 0.65, 0.7, 0.72, 0.8],
  },
  {
    key: "agent.screen_share",
    description: "Agent can stream your screen for debug sessions",
    rollout: { prod: 34, staging: 100, local: 100 },
    variants: ["on", "off"],
    variantPerf: [
      { name: "on", traffic: 0.34, cvr: 0.412, pValue: 0.018 },
      { name: "off (control)", traffic: 0.66, cvr: 0.296, pValue: 1 },
    ],
    modified: "8h ago",
    status: "rolling",
    Icon: Zap,
    tone: "var(--warn)",
    rules: [
      { when: "workspace.plan IS Enterprise", serve: "on" },
      { when: "workspace.plan IS Team AND workspace.created AFTER 2025-10-01", serve: "on" },
      { when: "everyone else", serve: "off" },
    ],
    overrides: [
      { email: "ada@acme.com", variant: "on", since: "2026-03-11" },
      { email: "alan@acme.com", variant: "on", since: "2026-03-12" },
      { email: "mia@beta.co", variant: "off", since: "2026-04-02" },
    ],
    evaluations: [0.4, 0.45, 0.42, 0.5, 0.55, 0.6, 0.58, 0.65, 0.7, 0.74, 0.8, 0.86],
  },
  {
    key: "policy.custom_dsl",
    description: "Custom policy DSL v2 — new syntax, faster evaluator",
    rollout: { prod: 12, staging: 50, local: 100 },
    variants: ["control", "v2", "v3"],
    variantPerf: [
      { name: "control", traffic: 0.88, cvr: 0.214, pValue: 1 },
      { name: "v2", traffic: 0.08, cvr: 0.261, pValue: 0.07 },
      { name: "v3", traffic: 0.04, cvr: 0.289, pValue: 0.012 },
    ],
    modified: "1d ago",
    status: "experiment",
    Icon: FlaskConical,
    tone: "var(--accent)",
    evaluations: [0.35, 0.4, 0.38, 0.42, 0.45, 0.5, 0.48, 0.52, 0.55, 0.58, 0.6, 0.62],
  },
  {
    key: "ai.auto_route",
    description: "Automatically route to the cheapest capable model",
    rollout: { prod: 5, staging: 100, local: 100 },
    variants: ["on", "off"],
    modified: "2h ago",
    status: "canary",
    Icon: Brain,
    tone: "var(--accent)",
    evaluations: [0.2, 0.25, 0.3, 0.28, 0.35, 0.4, 0.38, 0.45, 0.5, 0.52, 0.58, 0.6],
  },
  {
    key: "engine.risk.v4",
    description: "Risk engine v4 — graph-aware propagation",
    rollout: { prod: 0, staging: 20, local: 100 },
    variants: ["v3", "v4"],
    modified: "4d ago",
    status: "draft",
    Icon: ShieldCheck,
    tone: "var(--fg-muted)",
    evaluations: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
  {
    key: "ui.dark_mode_v2",
    description: "Refined dark palette with OLED black option",
    rollout: { prod: 100, staging: 100, local: 100 },
    variants: ["on", "off"],
    modified: "12d ago",
    status: "on",
    Icon: Moon,
    tone: "var(--success)",
    evaluations: [0.6, 0.65, 0.7, 0.72, 0.75, 0.78, 0.8, 0.82, 0.85, 0.86, 0.88, 0.9],
  },
  {
    key: "billing.yearly_only",
    description: "Hide monthly pricing for Enterprise org prospects",
    rollout: { prod: 100, staging: 100, local: 100 },
    variants: ["on", "off"],
    modified: "9d ago",
    status: "targeted",
    Icon: DollarSign,
    tone: "var(--accent)",
    targetNote: "Enterprise only",
    evaluations: [0.1, 0.12, 0.14, 0.13, 0.15, 0.16, 0.18, 0.2, 0.22, 0.25, 0.24, 0.28],
  },
  {
    key: "legacy.sso_v1",
    description: "Old SAML implementation (XML-only)",
    rollout: { prod: 0, staging: 0, local: 0 },
    variants: ["on", "off"],
    modified: "31d ago",
    status: "killed",
    Icon: Skull,
    tone: "var(--danger)",
    evaluations: [0.5, 0.4, 0.3, 0.2, 0.1, 0.05, 0.02, 0.01, 0, 0, 0, 0],
  },
];
