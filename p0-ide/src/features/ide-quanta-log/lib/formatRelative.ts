/**
 * Quanta log row time column — 상대 시간을 한 글자~세 글자로 압축한다.
 * Linear/Arc 스타일. 절대시간은 row hover 시 title에 표시.
 *
 *   < 5s   →  "now"
 *   < 60s  →  "12s"
 *   < 60m  →  "4m"
 *   < 24h  →  "3h"
 *   else   →  "2d"
 */
export function formatRelative(at: number, now = Date.now()): string {
  const delta = Math.max(0, now - at);
  const sec = Math.floor(delta / 1000);
  if (sec < 5) return "now";
  if (sec < 60) return `${String(sec)}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${String(min)}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${String(hr)}h`;
  const d = Math.floor(hr / 24);
  return `${String(d)}d`;
}

export function formatAbsolute(at: number): string {
  const d = new Date(at);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}
