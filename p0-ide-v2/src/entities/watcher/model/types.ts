export type TodayEvent = "break" | "drift" | "dead" | "testbroke" | "fix";

export interface TodayBucket {
  turns: number;
  locAdd: number;
  locDel: number;
  events: TodayEvent[];
}

export interface DayBucket {
  turns: number;
  netLoc: number;
}

export const RANGES = ["24h", "7d", "30d", "90d"] as const;
export type Range = (typeof RANGES)[number];
