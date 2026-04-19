import type { ReactElement } from "react";
import type { IconPackId } from "@quanta/shell-contract";

export interface IconPack {
  id: IconPackId;
  label: string;
  hint: string;
  supportsColor: boolean;
  Folder: (props: { open: boolean }) => ReactElement;
  pickFile: (name: string) => ReactElement;
}
