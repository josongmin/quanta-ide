import { useEffect } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/shared/lib";
import { ICON_PACKS, ICON_PACK_CATEGORIES } from "@/shared/ui/icons";
import {
  ICON_COLOR_OPTIONS,
  iconColorStore,
  iconPackStore,
  resolveIconColor,
  useIconColor,
  useIconPack,
} from "@/shared/model/icon-pack-store";

interface Props {
  onClose: () => void;
}

const PREVIEW_FILES = ["orchestrator.py", "Sidebar.tsx", "styles.css", "config.toml", "README.md"];

export function IconPackPicker({ onClose }: Props) {
  const current = useIconPack();
  const currentColor = useIconColor();
  const activePack = ICON_PACKS[current];
  const activeSupportsColor = activePack.supportsColor;

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const resolvedColor = resolveIconColor(currentColor);
  const colorVar = resolvedColor ? ({ "--files-icon-color": resolvedColor } as React.CSSProperties) : {};

  return createPortal(
    <div
      className="ide-iconpack-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Select icon pack"
      onMouseDown={onClose}
    >
      <div
        className="ide-iconpack-modal"
        style={colorVar}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="ide-iconpack-modal__head">
          <div className="ide-iconpack-modal__title-wrap">
            <span className="ide-iconpack-modal__title">Icon pack</span>
            <span className="ide-iconpack-modal__sub">Applies to file tree</span>
          </div>
          <button
            type="button"
            className="ide-iconpack-modal__close"
            onClick={onClose}
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </div>

        <div
          className={cn("ide-iconpack-modal__colors", !activeSupportsColor && "is-disabled")}
          role="group"
          aria-label="Icon color"
          aria-disabled={!activeSupportsColor}
        >
          <span className="ide-iconpack-modal__colors-label">Color</span>
          <div className="ide-iconpack-modal__swatches">
            {ICON_COLOR_OPTIONS.map((opt) => {
              const active = opt.id === currentColor;
              const isDefault = opt.value === null;
              return (
                <button
                  key={opt.id}
                  type="button"
                  className={cn("ide-iconpack-modal__swatch", active && "is-active", isDefault && "is-default")}
                  style={opt.value ? { background: opt.value } : undefined}
                  onClick={() => iconColorStore.set(opt.id)}
                  aria-label={opt.label}
                  aria-pressed={active}
                  title={opt.label}
                  disabled={!activeSupportsColor}
                />
              );
            })}
          </div>
          <span className="ide-iconpack-modal__colors-hint">
            {activeSupportsColor ? "Applies to the current pack" : "Current pack has fixed colors"}
          </span>
        </div>

        <div className="ide-iconpack-modal__body">
          {ICON_PACK_CATEGORIES.map((cat) => (
            <section key={cat.label} className="ide-iconpack-modal__section">
              <h3 className="ide-iconpack-modal__section-title">{cat.label}</h3>
              <div className="ide-iconpack-modal__grid">
                {cat.ids.map((id) => {
                  const pack = ICON_PACKS[id];
                  const active = id === current;
                  return (
                    <button
                      type="button"
                      key={id}
                      className={cn("ide-iconpack-modal__card", active && "is-active")}
                      aria-pressed={active}
                      onClick={() => iconPackStore.set(id)}
                    >
                      <div className="ide-iconpack-modal__card-head">
                        <span className="ide-iconpack-modal__card-name">{pack.label}</span>
                        {pack.supportsColor && (
                          <span className="ide-iconpack-modal__badge" title="Responds to selected color">
                            color
                          </span>
                        )}
                        {active && <span className="ide-iconpack-modal__check" aria-label="Selected">✓</span>}
                      </div>
                      <span className="ide-iconpack-modal__card-hint">{pack.hint}</span>
                      <div className="ide-iconpack-modal__preview" aria-hidden="true">
                        <pack.Folder open={true} />
                        {PREVIEW_FILES.map((f) => (
                          <span key={f} className="ide-iconpack-modal__preview-slot">
                            {pack.pickFile(f)}
                          </span>
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function CloseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}
