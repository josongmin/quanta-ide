import { HeroAsciiFlame } from "./HeroAsciiFlame";
import { useSettingsPage } from "./use-settings-page";
import { SettingsNav } from "./internal/SettingsNav";
import { SettingsSearchBar } from "./internal/SettingsSearchBar";
import { SettingsFeatureCard } from "./internal/SettingsFeatureCard";
import { SettingsEmptyState } from "./internal/SettingsEmptyState";
import "./settings-page.css";

export function SettingsPage() {
  const s = useSettingsPage();

  return (
    <div className="settings-page">
      <div className="settings-shell">
        <header className="settings-hero">
          <HeroAsciiFlame />
          <div className="settings-hero__content">
            <div className="settings-hero__kicker">
              Feature Control Plane
            </div>

            <h1 className="settings-hero__title">
              Configure, extend, <span className="settings-hero__accent">govern.</span>
            </h1>
            <p className="settings-hero__sub">
              One registry. Every capability in the IDE surfaces here, with its commands, settings, and dependencies.
            </p>
          </div>
        </header>

        <SettingsSearchBar query={s.query} onChange={s.setQuery} />

        <div className="settings-body">
          <SettingsNav
            selected={s.selected}
            counts={s.counts}
            onSelect={s.setSelected}
            onReset={s.resetAll}
          />

          <main className="settings-main">
            <header className="settings-title">
              <div className="settings-title__text">
                <div className="settings-title__row">
                  <h2 className="settings-title__h">{s.titleLabel}</h2>
                  <span className="settings-title__count">{s.visible.length}</span>
                </div>
                <p className="settings-title__desc">{s.titleDesc}</p>
              </div>
            </header>

            {s.visible.length === 0 ? (
              <SettingsEmptyState query={s.query} />
            ) : (
              <ul className="settings-feature-list">
                {s.visible.map((f) => (
                  <SettingsFeatureCard
                    key={f.id}
                    feature={f}
                    values={s.values}
                    onChange={s.updateValue}
                  />
                ))}
              </ul>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
