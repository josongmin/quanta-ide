import type { CSSProperties, ReactElement } from "react";
import type { EntityKind } from "@quanta/canvas-engine";
import { color, kindColor, kindLabel, radius, transition } from "../../../shared/ui/tokens";
import { kindFilterStore, useKindFilter } from "../model/store";

// KindFilterPanel — dot-only visibility toggles, one per entity
// kind. Labels removed at rest (they're redundant when you see the
// same colored dots inside the Pixi canvas + Explorer tree); the
// tooltip still reveals them on hover. Tight visual footprint so
// the header's segmented controls stay the dominant chrome.

const ORDER: readonly EntityKind[] = [
  "universe",
  "galaxy",
  "street",
  "building",
  "floor",
  "room",
];

const TRACK: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: 2,
  gap: 1,
  background: color.bg2,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  lineHeight: 1,
};

const DOT_BUTTON: CSSProperties = {
  width: 22,
  height: 22,
  border: "1px solid transparent",
  background: "transparent",
  borderRadius: radius.sm,
  padding: 0,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  transition: `background ${transition.fast}`,
};

export function KindFilterPanel(): ReactElement {
  const visibility = useKindFilter(s => s.visibility);
  return (
    <div style={TRACK} role="group" aria-label="Entity kind visibility">
      {ORDER.map(kind => {
        const on = visibility[kind];
        return (
          <button
            key={kind}
            type="button"
            style={DOT_BUTTON}
            onClick={() => kindFilterStore.toggle(kind)}
            aria-pressed={on}
            title={`${on ? "Hide" : "Show"} ${kindLabel[kind]}s`}
            onMouseEnter={e => {
              e.currentTarget.style.background = color.hover;
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            <span
              aria-hidden
              style={{
                width: 10,
                height: 10,
                borderRadius: radius.pill,
                background: on ? kindColor[kind] : "transparent",
                border: `1.5px solid ${on ? kindColor[kind] : color.text3}`,
                opacity: on ? 1 : 0.55,
                transition: `background ${transition.fast}, opacity ${transition.fast}`,
              }}
            />
          </button>
        );
      })}
    </div>
  );
}
