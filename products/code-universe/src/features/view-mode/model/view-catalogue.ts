// Flat projections of the view registry.
// --------------------------------------------------------------------
// Consumers that only need the metadata tables — picker label lookup,
// dropdown trigger glyph, URL validation — read these instead of the
// full descriptor array. Keeps their imports cheap and their coupling
// narrow (they don't pull every view's Component into their module
// graph just to format a label).
//
// Both tables are derived from `VIEW_DESCRIPTORS`; there is no
// parallel maintenance. Adding a new view = add a descriptor; these
// projections update automatically.

import type { ViewMode } from "./store";
import { VIEW_DESCRIPTORS } from "./view-registry";

export interface ViewModeOption {
  value: ViewMode;
  label: string;
  hint: string;
  tech: string;
  usecase: string;
}

export const VIEW_MODE_OPTIONS: readonly ViewModeOption[] = VIEW_DESCRIPTORS.map(
  d => ({
    value: d.id,
    label: d.label,
    hint: d.hint,
    tech: d.tech,
    usecase: d.usecase,
  }),
);

export const VIEW_GLYPH: Readonly<Record<ViewMode, string>> = Object.freeze(
  VIEW_DESCRIPTORS.reduce<Record<string, string>>((acc, d) => {
    acc[d.id] = d.glyph;
    return acc;
  }, {}) as Record<ViewMode, string>,
);
