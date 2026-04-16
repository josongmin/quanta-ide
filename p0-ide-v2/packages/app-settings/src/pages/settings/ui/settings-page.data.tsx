import type { ReactNode } from "react";
import {
  LayoutGrid,
  Waypoints,
  SquarePen,
  ShieldCheck,
  Blocks,
  Workflow,
} from "lucide-react";
import type { FeatureCategory } from "@quanta/shell/stores/feature-registry";

export type CategoryId = FeatureCategory | "all";

export type NavGroup = { id: string; label: string; items: FeatureCategory[] };

export const CATEGORY_LABEL: Record<FeatureCategory, string> = {
  intelligence: "Code intelligence",
  editing:      "Editing",
  rules:        "Rules & compliance",
  integration:  "Integrations",
  workflow:     "Workflow",
};

export const SECTION_DESC: Record<FeatureCategory, string> = {
  intelligence: "Code intelligence signals — risk, blast, taint, behavior, incidents.",
  editing:      "Editor-side overlays, hovers, and symbol tooling.",
  rules:        "Rule authoring, compliance verification, and evidence tokens.",
  integration:  "External integrations, firewall, and runtime tools.",
  workflow:     "Reviews, scenarios, tasks, and end-to-end flows.",
};

export const NAV_GROUPS: NavGroup[] = [
  { id: "signals",   label: "Signals",   items: ["intelligence"] },
  { id: "authoring", label: "Authoring", items: ["editing", "rules"] },
  { id: "delivery",  label: "Delivery",  items: ["integration", "workflow"] },
];

const NAV_ICON_SIZE = 15;
const NAV_ICON_STROKE = 1.5;

export const CATEGORY_ICON: Record<FeatureCategory, ReactNode> = {
  intelligence: <Waypoints  size={NAV_ICON_SIZE} strokeWidth={NAV_ICON_STROKE} />,
  editing:      <SquarePen  size={NAV_ICON_SIZE} strokeWidth={NAV_ICON_STROKE} />,
  rules:        <ShieldCheck size={NAV_ICON_SIZE} strokeWidth={NAV_ICON_STROKE} />,
  integration:  <Blocks     size={NAV_ICON_SIZE} strokeWidth={NAV_ICON_STROKE} />,
  workflow:     <Workflow   size={NAV_ICON_SIZE} strokeWidth={NAV_ICON_STROKE} />,
};

export const ALL_ICON: ReactNode = <LayoutGrid size={NAV_ICON_SIZE} strokeWidth={NAV_ICON_STROKE} />;
