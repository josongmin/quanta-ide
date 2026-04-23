import type { MetricDefinition, MetricUnit } from "../model/types";

export function formatMetricValue(value: number, unit: MetricUnit): string {
  switch (unit) {
    case "percent":
      return `${(value * 100).toFixed(1)}%`;
    case "ratio":
      return value.toFixed(2);
    case "ms":
      return `${Math.round(value)}ms`;
    case "loc":
      return `${Math.round(value).toLocaleString()} LoC`;
    case "score":
      return value.toFixed(1);
    case "count":
    default:
      return Math.round(value).toString();
  }
}

export function formatMetricDelta(
  before: number,
  after: number,
  metric?: MetricDefinition,
): { text: string; tone: "good" | "bad" | "flat" } {
  const delta = after - before;
  if (Math.abs(delta) < 1e-9) return { text: "±0", tone: "flat" };
  const sign = delta > 0 ? "+" : "−";
  const unit = metric?.unit ?? "count";
  const body = formatMetricValue(Math.abs(delta), unit);
  const dir = metric?.direction ?? "lower-better";
  let tone: "good" | "bad" | "flat";
  if (dir === "neutral") tone = "flat";
  else if (dir === "lower-better") tone = delta < 0 ? "good" : "bad";
  else tone = delta > 0 ? "good" : "bad";
  return { text: `${sign}${body}`, tone };
}
