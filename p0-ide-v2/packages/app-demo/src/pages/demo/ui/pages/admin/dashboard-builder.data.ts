// dashboard-builder.data.ts
// Static fixtures for DashboardBuilderPage. Split out so the component file stays under ~400 lines.

import type { ReactNode } from "react";
import { createElement } from "react";
import {
  BarChart3,
  Boxes,
  GaugeCircle,
  Layers,
  LineChart,
  ListTree,
  Table2,
  TrendingUp,
} from "lucide-react";

export type WidgetKind =
  | "stat"
  | "line"
  | "area"
  | "bar"
  | "table"
  | "list"
  | "heatmap"
  | "progress";

export type PlacedWidget = {
  id: string;
  kind: WidgetKind;
  title: string;
  colSpan: number;
  rowSpan: number;
};

const libIcon = (I: typeof GaugeCircle): ReactNode =>
  createElement(I, { size: 14, strokeWidth: 1.7, "aria-hidden": "true" });

export const LIBRARY: { kind: WidgetKind; label: string; icon: ReactNode }[] = [
  { kind: "stat",     label: "Stat tile",  icon: libIcon(GaugeCircle) },
  { kind: "line",     label: "Line chart", icon: libIcon(LineChart) },
  { kind: "area",     label: "Area chart", icon: libIcon(TrendingUp) },
  { kind: "bar",      label: "Bar chart",  icon: libIcon(BarChart3) },
  { kind: "table",    label: "Table",      icon: libIcon(Table2) },
  { kind: "list",     label: "List",       icon: libIcon(ListTree) },
  { kind: "heatmap",  label: "Heatmap",    icon: libIcon(Layers) },
  { kind: "progress", label: "Progress",   icon: libIcon(Boxes) },
];

export const DATA_SOURCES = [
  { id: "usage",    name: "Usage metrics", hint: "42 series" },
  { id: "engines",  name: "Engines",       hint: "7 tables" },
  { id: "policies", name: "Policies",      hint: "18 tables" },
  { id: "tickets",  name: "Tickets",       hint: "3 tables" },
  { id: "webhooks", name: "Webhooks",      hint: "2 streams" },
];

export const AREA_SERIES = [
  0.18, 0.22, 0.28, 0.24, 0.32, 0.36, 0.42, 0.38, 0.46, 0.52,
  0.48, 0.58, 0.62, 0.56, 0.64, 0.72, 0.68, 0.74, 0.82, 0.78,
  0.86, 0.82, 0.9, 0.86,
];

export const RISK_SPARK = [0.62, 0.58, 0.6, 0.64, 0.62, 0.66, 0.63, 0.68, 0.66, 0.64];
export const VIOL_SPARK = [0.12, 0.18, 0.14, 0.22, 0.26, 0.2, 0.28, 0.3, 0.24, 0.34];

export const TOP_REPOS = [
  { repo: "acme/order-service",    runs: 1284, risk: 0.68 },
  { repo: "acme/payment-gateway",  runs: 1021, risk: 0.74 },
  { repo: "acme/identity-core",    runs:  842, risk: 0.42 },
  { repo: "acme/notifier",         runs:  611, risk: 0.31 },
  { repo: "acme/ledger",           runs:  538, risk: 0.59 },
];

export const ENGINE_BARS = [
  { name: "risk",       ms: 162, tone: "var(--accent)" },
  { name: "blast",      ms: 248, tone: "var(--accent-purple)" },
  { name: "taint",      ms: 412, tone: "var(--warn)" },
  { name: "behavior",   ms: 188, tone: "var(--success)" },
  { name: "incidents",  ms: 104, tone: "var(--fg-muted)" },
  { name: "ownership",  ms:  78, tone: "var(--fg-muted)" },
];

export const PUBLISHED = [
  { id: "exec",    title: "Executive summary",   edited: "2d ago", views: 284 },
  { id: "sre",     title: "SRE on-call",         edited: "5h ago", views: 142 },
  { id: "sec",     title: "Security watchtower", edited: "1d ago", views:  97 },
  { id: "fin",     title: "Finance & usage",     edited: "3d ago", views:  61 },
];

export const INITIAL_WIDGETS: PlacedWidget[] = [
  { id: "w1", kind: "area",  title: "Analyses over time",       colSpan: 6, rowSpan: 2 },
  { id: "w2", kind: "stat",  title: "Risk score median",        colSpan: 3, rowSpan: 1 },
  { id: "w3", kind: "stat",  title: "Policy violations",        colSpan: 3, rowSpan: 1 },
  { id: "w4", kind: "table", title: "Top repos",                colSpan: 6, rowSpan: 2 },
  { id: "w5", kind: "bar",   title: "Engine latency (p95)",     colSpan: 6, rowSpan: 2 },
];

export const ACCENT_SWATCHES = [
  { id: "accent",  color: "var(--accent)" },
  { id: "purple",  color: "var(--accent-purple)" },
  { id: "success", color: "var(--success)" },
  { id: "warn",    color: "var(--warn)" },
  { id: "danger",  color: "var(--danger)" },
  { id: "muted",   color: "var(--fg-muted)" },
];
