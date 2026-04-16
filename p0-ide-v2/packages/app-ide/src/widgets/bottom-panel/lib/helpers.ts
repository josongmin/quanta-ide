import type { TodayEvent } from "@quanta/app-ide/entities/watcher";

export function eventLabel(e: TodayEvent): string {
  if (e === "break") return "contract break";
  if (e === "drift") return "shape drift";
  if (e === "dead") return "dead symbol born";
  if (e === "testbroke") return "test broken";
  return "fix landed";
}

export function bucketTime(i: number): string {
  const minutes = 12 * 60 + i * 30;
  const hh = Math.floor(minutes / 60);
  const mm = minutes % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}
