import type { ComponentType, ReactNode } from "react";
/** App identifiers corresponding to tab-bus TabApp. */
export type TabApp = "new-tab" | "agent" | "pr" | "ide" | "workspace" | "scenario" | "reviews" | "policy" | "settings" | "demo";
/** Superset: every surface the shell can render, including non-tab pages. */
export type AppKind = TabApp | "home";
/** Serialisable tab descriptor stored by the shell tab manager. */
export interface TabDescriptor {
    id: string;
    app: AppKind;
    label: string;
}
/** Each micro-web app exports this to register itself with the shell. */
export interface TabAppDescriptor {
    id: AppKind;
    label: string;
    icon?: () => ReactNode;
    Component: ComponentType<TabAppProps>;
}
/** Props injected by the shell into every tab app component. */
export interface TabAppProps {
    tabId: string;
    isActive: boolean;
}
