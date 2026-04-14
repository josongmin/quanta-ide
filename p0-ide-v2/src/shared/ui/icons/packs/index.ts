import type { IconPackId } from "@/shared/model/icon-pack-store";
import { useIconPack } from "@/shared/model/icon-pack-store";
import { customPack } from "./custom";
import { lucidePack } from "./lucide";
import { phosphorPack, phosphorDuotonePack } from "./phosphor";
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
  lucide: lucidePack,
  tabler: tablerPack,
  phosphor: phosphorPack,
  "phosphor-duotone": phosphorDuotonePack,
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

export const ICON_PACK_ORDER: IconPackId[] = [
  "custom",
  "lucide",
  "tabler",
  "phosphor",
  "phosphor-duotone",
  "heroicons-outline",
  "heroicons-solid",
  "remix-line",
  "remix-fill",
  "carbon",
  "mono",
  "feather",
  "iconoir",
  "radix",
];

export function useActivePack(): IconPack {
  const id = useIconPack();
  return ICON_PACKS[id];
}

export type { IconPack } from "./types";
