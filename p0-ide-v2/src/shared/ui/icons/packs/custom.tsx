import { FolderIcon as CustomFolderIcon, pickFileIcon as customPickFileIcon } from "../FileIcons";
import type { IconPack } from "./types";

export const customPack: IconPack = {
  id: "custom",
  label: "Custom",
  hint: "Custom color icons",
  Folder: ({ open }) => <CustomFolderIcon open={open} />,
  pickFile: (name) => customPickFileIcon(name),
};
