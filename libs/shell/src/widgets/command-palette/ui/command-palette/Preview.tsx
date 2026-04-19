import { Fragment, type ReactNode } from "react";
import { CategoryIcon } from "./icons";
import { CATEGORY_LABELS } from "./command-palette.utils";
import type { CommandEntry } from "./command-palette.types";

function MetaRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="cp__prev-row">
      <span className="cp__prev-row-label">{label}</span>
      <span className="cp__prev-row-value">{children}</span>
    </div>
  );
}

export function Preview({ entry }: { entry: CommandEntry }) {
  const depsOn = entry.feature.dependsOn ?? [];
  return (
    <div className="cp__prev">
      <div className="cp__prev-head">
        <span className="cp__prev-icon" aria-hidden>
          <CategoryIcon category={entry.feature.category} size={20} />
        </span>
        <div className="cp__prev-title">
          <div className="cp__prev-title-main">{entry.command.title}</div>
          <div className="cp__prev-title-sub">
            {entry.feature.title} · {CATEGORY_LABELS[entry.feature.category]}
          </div>
        </div>
      </div>

      {entry.command.description && (
        <p className="cp__prev-desc">{entry.command.description}</p>
      )}

      <div className="cp__prev-meta">
        <MetaRow label="Feature">
          <code>{entry.feature.id}</code>
          <span className="cp__prev-ver">v{entry.feature.version}</span>
        </MetaRow>
        <MetaRow label="Category">
          {CATEGORY_LABELS[entry.feature.category]}
        </MetaRow>
        {entry.feature.badge && (
          <MetaRow label="Badge">
            <span className={`cp__prev-badge cp__prev-badge--${entry.feature.badge}`}>
              {entry.feature.badge}
            </span>
          </MetaRow>
        )}
        <MetaRow label="State">
          <span className={`cp__prev-state cp__prev-state--${entry.feature.state}`}>
            <span className="cp__prev-state-dot" aria-hidden />
            {entry.feature.state}
          </span>
        </MetaRow>
        {entry.command.keybinding && (
          <MetaRow label="Keybinding">
            <span className="cp__prev-kb">{entry.command.keybinding}</span>
          </MetaRow>
        )}
        {depsOn.length > 0 && (
          <MetaRow label="Depends on">
            <span className="cp__prev-deps">
              {depsOn.map((d, i) => (
                <Fragment key={d}>
                  {i > 0 && <span className="cp__prev-deps-sep">·</span>}
                  <code>{d}</code>
                </Fragment>
              ))}
            </span>
          </MetaRow>
        )}
      </div>

      <div className="cp__prev-run">
        <span className="cp__prev-run-kb">↵</span>
        <span className="cp__prev-run-label">press enter to run</span>
      </div>
    </div>
  );
}

export function PreviewEmpty() {
  return (
    <div className="cp__prev cp__prev--empty">
      <div className="cp__prev-empty-mark" aria-hidden>
        ∅
      </div>
      <div className="cp__prev-empty-title">No selection</div>
      <div className="cp__prev-empty-sub">
        type to filter — navigation and preview are keyboard-first
      </div>
    </div>
  );
}
