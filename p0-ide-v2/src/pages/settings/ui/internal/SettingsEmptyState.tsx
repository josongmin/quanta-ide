export function SettingsEmptyState({ query }: { query: string }) {
  return (
    <div className="settings-empty">
      <div className="settings-empty__icon" aria-hidden>⌕</div>
      <div className="settings-empty__title">
        {query ? `No settings match "${query}"` : "No features in this category"}
      </div>
      <div className="settings-empty__hint">
        Features and their settings are registered through the Feature Registry.
      </div>
    </div>
  );
}
