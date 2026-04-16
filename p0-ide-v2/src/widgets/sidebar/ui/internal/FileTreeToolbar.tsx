import { cn } from "@/shared/lib";
import { ChevronDownTiny, CollapseAllIcon, ExpandAllIcon, PaletteIcon } from "../../lib/icons";
import { IconPackPicker } from "../IconPackPicker";

interface FileTreeToolbarProps {
  fileCount: number;
  packLabel: string;
  pickerOpen: boolean;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onOpenPicker: () => void;
  onClosePicker: () => void;
}

export function FileTreeToolbar({
  fileCount,
  packLabel,
  pickerOpen,
  onExpandAll,
  onCollapseAll,
  onOpenPicker,
  onClosePicker,
}: FileTreeToolbarProps) {
  return (
    <div className="ide-files-toolbar">
      <button type="button" className="ide-files-tool-btn" onClick={onExpandAll} title="Expand all" aria-label="Expand all">
        <ExpandAllIcon />
      </button>
      <button type="button" className="ide-files-tool-btn" onClick={onCollapseAll} title="Collapse all" aria-label="Collapse all">
        <CollapseAllIcon />
      </button>
      <div className="ide-files-tool-sep" />
      <span className="ide-files-count">{fileCount} files</span>
      <button
        type="button"
        className={cn("ide-files-iconpack-btn", pickerOpen && "is-open")}
        onClick={onOpenPicker}
        title={`Icon pack: ${packLabel}`}
        aria-label={`Icon pack: ${packLabel}`}
        aria-haspopup="dialog"
        aria-expanded={pickerOpen}
      >
        <PaletteIcon />
        <ChevronDownTiny />
      </button>
      {pickerOpen && <IconPackPicker onClose={onClosePicker} />}
    </div>
  );
}
