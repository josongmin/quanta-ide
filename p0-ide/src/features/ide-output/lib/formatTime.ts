/** "HH:MM:SS" — Output 라인의 타임스탬프 머리글. */
export function formatHms(at: number): string {
  const d = new Date(at);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return `${h}:${m}:${s}`;
}
