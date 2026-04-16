import type { InsDelta, InsTone } from "./insights-view.mock";

export function deltaClasses(delta: InsDelta | undefined, tone: InsTone) {
  if (!delta) return { isGood: false, isBad: false };
  const goodDirection =
    tone === "low" ? "up" : tone === "med" ? null : "down";
  const isGood = !!goodDirection && delta.dir === goodDirection;
  const isBad = !!goodDirection && delta.dir !== goodDirection && delta.dir !== "flat";
  return { isGood, isBad };
}
