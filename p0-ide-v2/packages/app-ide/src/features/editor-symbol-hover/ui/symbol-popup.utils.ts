import type { CSSProperties } from "react";
import { tone } from "@quanta/app-ide/entities/risk";
import type { HoverAnchor } from "../model/symbol-hover";

export const KIND_LABEL: Record<string, string> = {
  class: "class",
  function: "function",
  method: "method",
  variable: "var",
  parameter: "param",
  module: "module",
};

export const KIND_GLYPH: Record<string, string> = {
  class: "C",
  function: "ƒ",
  method: "m",
  variable: "v",
  parameter: "p",
  module: "M",
};

export function riskTone(score: number): string {
  const t = tone(score);
  return t === "low" ? "" : `symtip__risk--${t}`;
}

export function churnState(n: number): string {
  if (n > 10) return "churning";
  if (n > 3) return "active";
  return "stable";
}

export const WIDTH = 340;
export const OVERLAP = 3;

export function computePos(rect: HoverAnchor["rect"]): CSSProperties {
  const vh = window.innerHeight;
  const vw = window.innerWidth;
  const estH = 380;
  const below = rect.bottom + estH + 8 < vh;
  const top = below ? rect.bottom - OVERLAP : rect.top - estH + OVERLAP;
  let left = rect.left;
  if (left + WIDTH + 8 > vw) left = vw - WIDTH - 8;
  if (left < 8) left = 8;
  return {
    position: "fixed",
    top: Math.max(8, top),
    left,
    width: WIDTH,
    zIndex: 1000,
  };
}
