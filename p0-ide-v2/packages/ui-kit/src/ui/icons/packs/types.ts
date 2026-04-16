import type { ReactElement } from "react";
// TODO: boundary violation — ui-kit should not import store; extract IconPackId type to ui-kit
import type { IconPackId } from "@quanta/shell/stores/icon-pack-store";

export interface IconPack {
  id: IconPackId;
  label: string;
  hint: string;
  supportsColor: boolean;
  Folder: (props: { open: boolean }) => ReactElement;
  pickFile: (name: string) => ReactElement;
}
