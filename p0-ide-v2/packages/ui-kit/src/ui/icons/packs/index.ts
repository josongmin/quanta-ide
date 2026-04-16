// TODO: boundary violation — ui-kit should not import store; extract IconPackId type + useIconPack hook
import type { IconPackId } from "@quanta/shell/stores/icon-pack-store";
import { useIconPack } from "@quanta/shell/stores/icon-pack-store";
import { customPack } from "./custom";
import { materialPack } from "./material";
import { setiPack } from "./seti";
import { lucidePack } from "./lucide";
import {
  phosphorPack,
  phosphorDuotonePack,
  phosphorBoldPack,
  phosphorFillPack,
} from "./phosphor";
import { tablerPack } from "./tabler";
import { heroiconsOutlinePack, heroiconsSolidPack } from "./heroicons";
import { remixLinePack, remixFillPack } from "./remix";
import { carbonPack } from "./carbon";
import { monoPack } from "./mono";
import { featherPack } from "./feather";
import { iconoirPack } from "./iconoir";
import { radixPack } from "./radix";
import type { IconPack } from "./types";

export const ICON_PACKS: Record<IconPackId, IconPack> = {
  custom: customPack,
  material: materialPack,
  seti: setiPack,
  lucide: lucidePack,
  tabler: tablerPack,
  phosphor: phosphorPack,
  "phosphor-duotone": phosphorDuotonePack,
  "phosphor-bold": phosphorBoldPack,
  "phosphor-fill": phosphorFillPack,
  "heroicons-outline": heroiconsOutlinePack,
  "heroicons-solid": heroiconsSolidPack,
  "remix-line": remixLinePack,
  "remix-fill": remixFillPack,
  carbon: carbonPack,
  mono: monoPack,
  feather: featherPack,
  iconoir: iconoirPack,
  radix: radixPack,
};

export const ICON_PACK_CATEGORIES: { label: string; ids: IconPackId[] }[] = [
  {
    label: "Colored (developer)",
    ids: ["custom", "material", "lucide", "tabler", "phosphor", "phosphor-duotone", "phosphor-fill", "remix-fill"],
  },
  {
    label: "Stroke",
    ids: ["phosphor-bold", "heroicons-outline", "remix-line", "feather", "iconoir"],
  },
  {
    label: "Solid",
    ids: ["heroicons-solid"],
  },
  {
    label: "Monochrome",
    ids: ["seti", "carbon", "mono", "radix"],
  },
];

export const ICON_PACK_ORDER: IconPackId[] = ICON_PACK_CATEGORIES.flatMap((c) => c.ids);

export function useActivePack(): IconPack {
  const id = useIconPack();
  return ICON_PACKS[id];
}

export type { IconPack } from "./types";
