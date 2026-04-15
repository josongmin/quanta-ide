import {
  IconClass,
  IconFunction,
  IconTrendDown,
  IconTrendFlat,
  IconTrendUp,
} from "@/shared/ui/icons";
import type { ChurnTrend } from "./FileInspectorView.mock";

export function trendIcon(t: ChurnTrend) {
  if (t === "up") return <IconTrendUp size={13} />;
  if (t === "down") return <IconTrendDown size={13} />;
  return <IconTrendFlat size={13} />;
}

export function symbolGlyph(kind: "fn" | "class" | "const") {
  if (kind === "class") return <IconClass size={13} />;
  if (kind === "const") return <span className="dead__kchar">k</span>;
  return <IconFunction size={13} />;
}
