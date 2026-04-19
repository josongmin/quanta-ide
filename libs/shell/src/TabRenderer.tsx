import { Component, Suspense, type ReactNode } from "react";
import type { TabDescriptor } from "@quanta/shell-contract";
import { appRegistry } from "./app-registry";

// ---------------------------------------------------------------------------
// ErrorBoundary — React requires a class component for error boundaries.
// ---------------------------------------------------------------------------

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  override render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

// ---------------------------------------------------------------------------
// Skeleton / Crash fallbacks
// ---------------------------------------------------------------------------

function TabSkeleton() {
  return <div className="tab-skeleton">Loading...</div>;
}

function CrashFallback({ tabId }: { tabId: string }) {
  return (
    <div className="tab-crash">
      Tab <code>{tabId}</code> crashed. Close and reopen.
    </div>
  );
}

// ---------------------------------------------------------------------------
// TabRenderer
// ---------------------------------------------------------------------------

interface TabRendererProps {
  tabs: TabDescriptor[];
  activeId: string;
}

export function TabRenderer({ tabs, activeId }: TabRendererProps) {
  return (
    <>
      {tabs.map((tab) => {
        const descriptor = appRegistry.get(tab.app);
        if (!descriptor) return null;
        const Comp = descriptor.Component;
        return (
          <div
            key={tab.id}
            className="tab-container"
            style={{ display: tab.id === activeId ? "contents" : "none" }}
          >
            <ErrorBoundary fallback={<CrashFallback tabId={tab.id} />}>
              <Suspense fallback={<TabSkeleton />}>
                <Comp tabId={tab.id} isActive={tab.id === activeId} />
              </Suspense>
            </ErrorBoundary>
          </div>
        );
      })}
    </>
  );
}
