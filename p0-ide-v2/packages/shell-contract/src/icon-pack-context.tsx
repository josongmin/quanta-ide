import { createContext, useContext } from "react";
import type { IconPackId } from "./icon-types";

// ---------------------------------------------------------------------------
// Icon-pack context — shell provides the value, ui-kit consumes it.
// ---------------------------------------------------------------------------

const IconPackContext = createContext<IconPackId>("custom");

export const IconPackProvider = IconPackContext.Provider;

/** Read the active icon-pack id from context. */
export function useIconPackId(): IconPackId {
  return useContext(IconPackContext);
}
