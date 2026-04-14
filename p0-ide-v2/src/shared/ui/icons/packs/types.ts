import type { ReactElement } from "react";
import type { IconPackId } from "@/shared/model/icon-pack-store";

export interface IconPack {
  id: IconPackId;
  label: string;
  hint: string;
  Folder: (props: { open: boolean }) => ReactElement;
  pickFile: (name: string) => ReactElement;
}
