import { useMemo, useState } from "react";
import {
  Compass,
  Edit3,
  Globe,
  Layers,
  ShieldCheck,
  Sparkles,
  Users,
  Search,
} from "lucide-react";
import { DemoAppHero } from "../../internal/DemoAppHero";

type Platform = "macOS" | "Windows";

type Shortcut = {
  label: string;
  keys: string[];
};

type Group = {
  name: string;
  icon: typeof Compass;
  items: Shortcut[];
};

const GROUPS: Group[] = [
  {
    name: "Navigation",
    icon: Compass,
    items: [
      { label: "Command palette",     keys: ["⌘", "K"] },
      { label: "Go to file",          keys: ["⌘", "P"] },
      { label: "Go to symbol",        keys: ["⌘", "⇧", "O"] },
      { label: "Toggle sidebar",      keys: ["⌘", "B"] },
      { label: "Toggle home",         keys: ["⌘", "⇧", "H"] },
    ],
  },
  {
    name: "Editor",
    icon: Edit3,
    items: [
      { label: "Save",                keys: ["⌘", "S"] },
      { label: "Find in file",        keys: ["⌘", "F"] },
      { label: "Find in repo",        keys: ["⌘", "⇧", "F"] },
      { label: "Rename symbol",       keys: ["F2"] },
      { label: "Format document",     keys: ["⌘", "⇧", "I"] },
      { label: "Toggle comment",      keys: ["⌘", "/"] },
    ],
  },
  {
    name: "Code Universe",
    icon: Layers,
    items: [
      { label: "Open canvas",         keys: ["⌘", "⇧", "C"] },
      { label: "Zoom to fit",         keys: ["F"] },
      { label: "Increase LOD",        keys: ["]"] },
      { label: "Decrease LOD",        keys: ["["] },
      { label: "Cycle inspector modes", keys: ["⌥", "1..4"] },
    ],
  },
  {
    name: "Agent",
    icon: Sparkles,
    items: [
      { label: "Toggle agent",        keys: ["⌘", "J"] },
      { label: "New chat",            keys: ["⌘", "⇧", "J"] },
      { label: "Submit",              keys: ["⌘", "↵"] },
      { label: "Attach file",         keys: ["⌘", "U"] },
    ],
  },
  {
    name: "Policies",
    icon: ShieldCheck,
    items: [
      { label: "Open policy editor", keys: ["⌘", "⇧", "E"] },
      { label: "Run policy dry-run", keys: ["⌘", "R"] },
      { label: "Jump to violations", keys: ["V"] },
    ],
  },
  {
    name: "Workspace",
    icon: Users,
    items: [
      { label: "Switch workspace",    keys: ["⌘", "⇧", "O"] },
      { label: "Invite member",       keys: ["⌘", "⇧", "I"] },
      { label: "Open billing",        keys: ["⌘", "⇧", "B"] },
    ],
  },
  {
    name: "Global",
    icon: Globe,
    items: [
      { label: "Open settings",       keys: ["⌘", ","] },
      { label: "Help",                keys: ["⌘", "?"] },
      { label: "Dev console",         keys: ["⌘", "⌥", "⇧", "D"] },
      { label: "Try demo",            keys: ["⌘", "⇧", "D"] },
      { label: "Sign out",            keys: ["⌘", "⇧", "Q"] },
    ],
  },
];

const MAC_TO_WIN: Record<string, string> = {
  "⌘": "Ctrl",
  "⌥": "Alt",
  "⇧": "Shift",
  "↵": "Enter",
};

function keyForPlatform(k: string, platform: Platform) {
  if (platform === "macOS") return k;
  return MAC_TO_WIN[k] ?? k;
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 22,
        height: 22,
        padding: "0 6px",
        fontFamily: "var(--font-mono)",
        fontSize: "var(--fs-10)",
        fontWeight: "var(--fw-semibold)",
        color: "var(--fg)",
        background: "var(--bg)",
        border: "1px solid var(--border)",
        borderBottomWidth: 2,
        borderRadius: "var(--radius-xs)",
        boxShadow: "0 1px 0 rgba(0,0,0,0.04)",
      }}
    >
      {children}
    </kbd>
  );
}

export function KeyboardShortcutsPage() {
  const [platform, setPlatform] = useState<Platform>("macOS");
  const [q, setQ] = useState("");

  const totalShortcuts = useMemo(
    () => GROUPS.reduce((sum, g) => sum + g.items.length, 0),
    [],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return GROUPS;
    return GROUPS.map((g) => ({
      ...g,
      items: g.items.filter(
        (i) =>
          i.label.toLowerCase().includes(needle) ||
          i.keys.some((k) => k.toLowerCase().includes(needle)),
      ),
    })).filter((g) => g.items.length > 0);
  }, [q]);

  return (
    <div className="demo-app">
      <DemoAppHero
        kicker="Developers"
        title="Keyboard shortcuts"
        sub="Every command. Search to find, or press ⌘/ anywhere in the app to pull this up."
      />
      <div className="demo-app__body">
        <div className="demo-sectionbar">
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              border: "1px solid var(--border)",
              padding: "0 14px",
              height: 40,
              borderRadius: "var(--radius-md)",
              background: "var(--bg)",
              color: "var(--fg-subtle)",
              fontSize: "var(--fs-sm)",
              flex: 1,
              maxWidth: 440,
            }}
          >
            <Search size={16} strokeWidth={2} />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search shortcuts"
              style={{
                border: 0,
                outline: "none",
                background: "transparent",
                color: "var(--fg)",
                font: "inherit",
                fontSize: "var(--fs-sm)",
                flex: 1,
                minWidth: 0,
              }}
            />
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "var(--fs-10)",
                color: "var(--fg-subtle)",
                padding: "2px 6px",
                borderRadius: "var(--radius-xs)",
                border: "1px solid var(--border)",
              }}
            >
              ⌘ /
            </span>
          </div>
          <span className="demo-sectionbar__spacer" />
          <div className="demo-billing-toggle" style={{ marginBottom: 0 }}>
            {(["macOS", "Windows"] as Platform[]).map((p) => (
              <button
                key={p}
                type="button"
                className={platform === p ? "is-active" : ""}
                onClick={() => setPlatform(p)}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div
          style={{
            marginBottom: "var(--space-4)",
            fontSize: "var(--fs-xs)",
            color: "var(--fg-subtle)",
          }}
        >
          {totalShortcuts} shortcuts across {GROUPS.length} groups ·{" "}
          {platform === "macOS" ? "Mac bindings" : "Windows bindings"}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))",
            gap: "var(--space-4)",
          }}
        >
          {filtered.map((group) => {
            const Icon = group.icon;
            return (
              <section
                key={group.name}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  background: "var(--bg)",
                  padding: "var(--space-3h) var(--space-3)",
                }}
              >
                <header
                  style={{
                    marginBottom: "var(--space-2h)",
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-2)",
                    padding: "0 var(--space-1)",
                  }}
                >
                  <span
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 6,
                      background: "var(--bg-muted)",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--fg-muted)",
                    }}
                  >
                    <Icon size={13} strokeWidth={2} />
                  </span>
                  <h3
                    style={{
                      margin: 0,
                      fontSize: "var(--fs-sm)",
                      fontWeight: "var(--fw-semibold)",
                      letterSpacing: "-0.005em",
                      color: "var(--fg)",
                    }}
                  >
                    {group.name}
                  </h3>
                  <span
                    style={{
                      marginLeft: "auto",
                      fontSize: "var(--fs-10)",
                      color: "var(--fg-subtle)",
                    }}
                  >
                    {group.items.length} shortcuts
                  </span>
                </header>
                <ul
                  style={{
                    listStyle: "none",
                    padding: 0,
                    margin: 0,
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  {group.items.map((item, i) => (
                    <li
                      key={item.label}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "minmax(0, 1fr) auto",
                        alignItems: "center",
                        padding: "var(--space-2) var(--space-3)",
                        borderRadius: "var(--radius-sm)",
                        gap: "var(--space-3)",
                        background: i % 2 === 0 ? "var(--bg-subtle)" : "transparent",
                      }}
                    >
                      <span style={{ fontSize: "var(--fs-sm)", color: "var(--fg)" }}>
                        {item.label}
                      </span>
                      <span style={{ display: "inline-flex", gap: 3, flexWrap: "wrap", justifyContent: "flex-end" }}>
                        {item.keys.map((k, ki) => (
                          <Kbd key={ki}>{keyForPlatform(k, platform)}</Kbd>
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="demo-empty">
            <div className="demo-empty__title">No shortcuts match</div>
            <div className="demo-empty__hint">Try a different query or clear the search.</div>
          </div>
        )}
      </div>
    </div>
  );
}
