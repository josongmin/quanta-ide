import { useGnbStore, type AppType } from "@/entities/gnb";

const APPS: { app: AppType; label: string; desc: string; icon: JSX.Element }[] = [
  { app: "ide", label: "IDE", desc: "Code editor with inspector",
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg> },
  { app: "review", label: "Review", desc: "Pull request & code review",
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8z" /><polyline points="14 3 14 8 21 8" /><path d="M9 15l2 2 4-4" /></svg> },
  { app: "agent", label: "Agent", desc: "AI coding assistant",
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /><circle cx="9" cy="16" r="1" fill="currentColor" stroke="none" /><circle cx="15" cy="16" r="1" fill="currentColor" stroke="none" /></svg> },
  { app: "quality", label: "Quality", desc: "Code quality dashboard",
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg> },
  { app: "security", label: "Security", desc: "Vulnerability scanner",
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg> },
  { app: "policy", label: "Policy", desc: "Rules & gate management",
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7V4a2 2 0 0 1 2-2h8.5L20 7.5V20a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3" /><polyline points="14 2 14 8 20 8" /><path d="M2 15h10" /><path d="M9 12l3 3-3 3" /></svg> },
];

export function HomePicker() {
  const { tabs, activeTabId, renameTab } = useGnbStore();
  const setActiveTab = useGnbStore((s) => s.setActiveTab);

  const handlePick = (app: AppType, label: string) => {
    // Change the current tab's app type + label
    const store = useGnbStore.getState();
    const updated = store.tabs.map(t =>
      t.id === activeTabId ? { ...t, app, label } : t
    );
    useGnbStore.setState({ tabs: updated });
  };

  return (
    <div className="home-picker">
      <div className="home-picker-grid">
        {APPS.map((a) => (
          <button
            key={a.app}
            type="button"
            className="home-picker-card"
            onClick={() => handlePick(a.app, a.label)}
          >
            <span className="home-picker-icon">{a.icon}</span>
            <span className="home-picker-label">{a.label}</span>
            <span className="home-picker-desc">{a.desc}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
