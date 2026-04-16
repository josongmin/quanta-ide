# ADR-0005: Micro-Web Shell Architecture

**Status:** Accepted  
**Date:** 2026-04-16  
**Deciders:** Song Min

## Context

p0-ide-v2 was a monolithic FSD (Feature-Sliced Design) app where all pages, widgets, features, and stores lived under a single `src/` directory. Every tab shared global state, making it impossible to:

- Develop tab apps independently without risk of cross-contamination
- Isolate crashes (one tab error kills the entire app)
- Enforce architectural boundaries between unrelated features
- Add new tab types without modifying the shell

## Decision

Adopt a **monorepo micro-web shell architecture** where each tab renders an independent app package that receives shell context via a shared contract.

### Package structure

```
p0-ide-v2/
├── packages/
│   ├── shell-contract/    # Types + hooks all apps depend on (zero deps)
│   ├── ui-kit/            # Design system (icons, modal, toast, cn, risk, tokens)
│   ├── shell/             # Tab orchestrator (topbar, palette, stores, shortcuts)
│   ├── app-ide/           # IDE (editor, inspector, sidebar, 16 features, 21 entities)
│   ├── app-agent/         # Agent chat
│   ├── app-pr/            # PR review
│   ├── app-reviews/       # Reviews
│   ├── app-rules/         # Rules management
│   ├── app-scenario/      # Counterfactual scenario
│   ├── app-settings/      # Settings
│   └── app-home/          # Home + New Tab
├── src/
│   ├── main.tsx           # Vite entry (mounts Shell, registers apps)
│   └── app/App.tsx        # Compat re-export
└── vite.config.ts         # @quanta/* aliases
```

### Dependency rule

```
app-* → shell-contract, ui-kit    (allowed)
app-* → shell                     (via useShell() only, not direct store import)
app-* → app-*                     (FORBIDDEN)
shell → shell-contract, ui-kit    (allowed)
shell → app-*                     (FORBIDDEN — uses appRegistry + overlayRegistry)
ui-kit → shell-contract            (types only)
ui-kit → shell, app-*             (FORBIDDEN)
shell-contract → *                 (FORBIDDEN — zero external deps)
```

### Key contracts

**TabAppDescriptor** — each app exports one:
```ts
interface TabAppDescriptor {
  id: AppKind;
  label: string;
  icon?: () => ReactNode;
  Component: ComponentType<TabAppProps>;
}
```

**ShellAPI** — injected via `useShell()`:
```ts
interface ShellAPI {
  openTab(app: TabApp, label: string): void;
  closeTab(tabId: string): void;
  selectTab(tabId: string): void;
  toast: { success, error, info };
  togglePalette(): void;
  toggleSettings(): void;
  registerFeatures(manifests: FeatureManifest[]): () => void;
  registerShortcuts(bindings: ShortcutBinding[]): () => void;
  registerOverlay(id: string, component: ComponentType): () => void;
  theme: { current: "light" | "dark"; toggle(): void };
}
```

### Isolation mechanisms

- **ErrorBoundary + Suspense** per tab (crash isolation)
- **`display: none/contents`** for inactive tabs (state preservation)
- **Overlay registry** — apps register global overlays dynamically, shell renders them
- **Feature/shortcut registration** — apps register on mount, dispose on unmount

## Adding a new app

### Checklist

| # | Action | Files |
|---|--------|-------|
| 1 | Create `packages/app-{name}/src/` with `App.tsx`, `descriptor.ts`, `index.ts` | 3 new |
| 2 | Copy `tsconfig.json` from sibling package | 1 new |
| 3 | Add `@quanta/app-{name}` alias to `vite.config.ts` | 1 edit |
| 4 | Add `@quanta/app-{name}` + wildcard to `tsconfig.app.json` paths | 1 edit |
| 5 | Register descriptor in `src/main.tsx` via `appRegistry.register(...)` | 1 edit |
| 6 | Add the app's id to `TabApp` union in `shell-contract/src/types.ts` | 1 edit |
| 7 | (Optional) Create `seed.ts` with `FeatureManifest[]` for command palette | if needed |

### Minimal app (3 files)

```ts
// packages/app-{name}/src/App.tsx
import type { TabAppProps } from "@quanta/shell-contract";
export function MyApp(_props: TabAppProps) {
  return <div>Hello</div>;
}

// packages/app-{name}/src/descriptor.ts
import type { TabAppDescriptor } from "@quanta/shell-contract";
import { MyApp } from "./App";
export const myAppDescriptor: TabAppDescriptor = {
  id: "my-app",
  label: "My App",
  Component: MyApp,
};

// packages/app-{name}/src/index.ts
export { myAppDescriptor } from "./descriptor";
export { MyApp } from "./App";
```

### Using shell services

```ts
import { useShell } from "@quanta/shell-contract";

function MyFeature() {
  const shell = useShell();

  // Open another tab
  shell.openTab("agent", "New Agent Session");

  // Show toast
  shell.toast.success("Saved");

  // Register features on mount
  useEffect(() => {
    const dispose = shell.registerFeatures(MY_FEATURES);
    return dispose;
  }, []);

  // Register overlays on mount
  useEffect(() => {
    return shell.registerOverlay("my-dialog", MyDialog);
  }, []);
}
```

### Import rules for apps

```
OK:  import { cn } from "@quanta/ui-kit/lib";
OK:  import { useShell } from "@quanta/shell-contract";
OK:  import { Modal } from "@quanta/ui-kit/ui/modal";
OK:  import { MyComponent } from "./components/MyComponent";   // relative within app

BAD: import { focusStore } from "@quanta/app-ide/stores/...";  // app-to-app
BAD: import { toastStore } from "@quanta/shell/stores/...";    // bypass contract
```

## Consequences

### Positive

- Each app develops independently behind a stable contract
- Crash in one tab cannot propagate to others (ErrorBoundary)
- Clear ownership: each package has explicit file boundaries
- Feature registration is declarative and disposable
- New apps can be added in minutes (6-step checklist)

### Negative

- Shell still directly imports page components for non-registry apps (pageRegistry pattern) — migrate to full appRegistry in Phase C
- Duplicate entities exist in two packages (agent-rules, counterfactual) — extract to shared domain package when needed
- Single Vite build (no independent deployment per app) — acceptable for desktop IDE
- Code-splitting not yet implemented (all apps in one JS chunk)

### Trade-offs accepted

- **No iframe/webview isolation**: Same JS runtime, no process-level sandboxing. Acceptable because all apps are 1st-party.
- **No Module Federation**: Build-time resolution via aliases. Simpler, no Vite plugin risk.
- **shell-contract is copied types, not re-exported from stores**: Prevents accidental coupling but requires manual sync when store types change.
