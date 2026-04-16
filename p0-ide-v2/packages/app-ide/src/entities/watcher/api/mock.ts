import type { TodayBucket, DayBucket } from "../model/types";

export const TODAY: TodayBucket[] = [
  { turns: 2,  locAdd: 14, locDel:  4, events: [] },
  { turns: 5,  locAdd: 32, locDel:  8, events: [] },
  { turns: 8,  locAdd: 52, locDel: 14, events: ["drift"] },
  { turns: 11, locAdd: 68, locDel: 22, events: [] },
  { turns: 7,  locAdd: 38, locDel: 28, events: ["break"] },
  { turns: 9,  locAdd: 48, locDel: 18, events: [] },
  { turns: 12, locAdd: 72, locDel: 14, events: ["fix"] },
  { turns: 14, locAdd: 84, locDel: 20, events: ["dead"] },
  { turns: 6,  locAdd: 22, locDel: 54, events: ["testbroke"] },
  { turns: 3,  locAdd: 10, locDel: 38, events: [] },
  { turns: 7,  locAdd: 28, locDel: 46, events: ["fix"] },
  { turns: 10, locAdd: 52, locDel: 24, events: [] },
  { turns: 13, locAdd: 76, locDel: 18, events: ["drift", "break"] },
  { turns: 9,  locAdd: 48, locDel: 32, events: [] },
  { turns: 5,  locAdd: 22, locDel: 12, events: [] },
  { turns: 4,  locAdd: 18, locDel:  8, events: [] },
];

export const MONTH: DayBucket[] = [
  { turns: 12, netLoc:  -20 }, { turns: 28, netLoc:   68 }, { turns: 45, netLoc:  110 },
  { turns: 32, netLoc:   86 }, { turns: 54, netLoc:  142 }, { turns: 48, netLoc:  168 },
  { turns: 38, netLoc:   92 }, { turns: 22, netLoc:   18 }, { turns: 31, netLoc:   54 },
  { turns: 19, netLoc:   -8 }, { turns: 28, netLoc:   22 }, { turns: 42, netLoc:   72 },
  { turns: 36, netLoc:   48 }, { turns: 51, netLoc:  -68 }, { turns: 44, netLoc: -120 },
  { turns: 39, netLoc:  -38 }, { turns: 52, netLoc: -142 }, { turns: 28, netLoc:  -52 },
  { turns: 48, netLoc:  -88 }, { turns: 34, netLoc:   12 }, { turns: 56, netLoc:  -42 },
  { turns: 62, netLoc: -112 }, { turns: 38, netLoc:  -38 }, { turns: 44, netLoc:  -72 },
  { turns: 58, netLoc:   28 }, { turns: 48, netLoc:  -94 }, { turns: 52, netLoc:  -18 },
  { turns: 66, netLoc:   48 }, { turns: 72, netLoc:  -28 }, { turns: 84, netLoc:  -62 },
];
