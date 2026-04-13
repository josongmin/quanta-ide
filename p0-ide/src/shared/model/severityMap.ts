/** Maps severity/status strings to UI variant class names */
export const SEVERITY_VARIANT: Record<string, string> = {
  critical: "danger",
  high: "warn",
  medium: "info",
  low: "info",
  error: "danger",
  warn: "warn",
  info: "info",
  P0: "danger",
  P1: "warn",
  P2: "info",
};

export const STATUS_VARIANT: Record<string, string> = {
  open: "danger",
  investigating: "warn",
  resolved: "success",
  closed: "success",
};

export function severityVariant(severity: string): string {
  return SEVERITY_VARIANT[severity] ?? "info";
}

export function statusVariant(status: string): string {
  return STATUS_VARIANT[status] ?? "info";
}
