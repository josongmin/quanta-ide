import { cn } from "@quanta/ui-kit/lib";
import { layoutPrefs, useLayoutPrefs, type TabStyle } from "@quanta/shell/stores/layout-prefs";

interface TabStyleOption {
  id: TabStyle;
  title: string;
  desc: string;
}

const OPTIONS: TabStyleOption[] = [
  {
    id: "linear",
    title: "Linear",
    desc: "Floating pills with gaps — modern, relaxed. Each tab is an independent surface.",
  },
  {
    id: "chrome",
    title: "Browser",
    desc: "Classic connected tabs — active tab continues into the workspace. Dense and familiar.",
  },
];

export function SettingsLayoutSection() {
  const tabStyle = useLayoutPrefs((s) => s.tabStyle);

  return (
    <section className="settings-layout">
      <div className="settings-layout__group">
        <div className="settings-layout__group-head">
          <h3 className="settings-layout__group-title">Tab design</h3>
          <p className="settings-layout__group-desc">
            How workspace tabs render in the top bar.
          </p>
        </div>

        <div className="settings-layout__options" role="radiogroup" aria-label="Tab design">
          {OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={tabStyle === opt.id}
              className={cn(
                "settings-layout__option",
                tabStyle === opt.id && "is-selected",
              )}
              onClick={() => layoutPrefs.setTabStyle(opt.id)}
            >
              <TabStylePreview style={opt.id} />
              <div className="settings-layout__option-body">
                <div className="settings-layout__option-title">{opt.title}</div>
                <div className="settings-layout__option-desc">{opt.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function TabStylePreview({ style }: { style: TabStyle }) {
  return (
    <div className={cn("settings-layout__preview", `settings-layout__preview--${style}`)} aria-hidden>
      <div className="settings-layout__preview-bar">
        <span className="settings-layout__preview-tab is-active" />
        <span className="settings-layout__preview-tab" />
        <span className="settings-layout__preview-tab" />
      </div>
      <div className="settings-layout__preview-body" />
    </div>
  );
}
