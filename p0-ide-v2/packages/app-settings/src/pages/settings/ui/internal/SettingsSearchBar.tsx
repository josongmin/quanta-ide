import { Search } from "lucide-react";

export function SettingsSearchBar({
  query,
  onChange,
}: {
  query: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="settings-topbar" role="search">
      <Search className="settings-topbar__icon" size={18} strokeWidth={2} aria-hidden />
      <input
        type="search"
        className="settings-topbar__input"
        placeholder="Search every feature, setting, or key across the IDE…"
        value={query}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Global settings search"
      />
      {query ? (
        <button
          type="button"
          className="settings-topbar__clear"
          onClick={() => onChange("")}
          aria-label="Clear search"
        >
          ✕
        </button>
      ) : (
        <kbd className="settings-topbar__kbd">⌘ K</kbd>
      )}
    </div>
  );
}
