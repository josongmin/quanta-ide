import type { CSSProperties, JSX, ReactNode } from "react";

const DP_BG = "#0a0a0a";
const DP_HEAD_BG = "#141414";
const DP_BORDER = "#1f1f1f";
const DP_FG = "#e4e4e4";

interface DarkPanelProps {
  children: ReactNode;
  padding?: string;
  borderRadius?: string;
  style?: CSSProperties;
}

export function DarkPanel({
  children,
  padding = "var(--space-4)",
  borderRadius = "0",
  style,
}: DarkPanelProps): JSX.Element {
  return (
    <div
      style={{
        background: DP_BG,
        color: DP_FG,
        fontFamily: "var(--font-mono)",
        fontSize: 12,
        padding,
        borderRadius,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

interface DarkPanelHeaderProps {
  children: ReactNode;
  right?: ReactNode;
}

export function DarkPanelHeader({ children, right }: DarkPanelHeaderProps): JSX.Element {
  return (
    <div
      style={{
        padding: "var(--space-2h) var(--space-4)",
        borderBottom: `1px solid ${DP_BORDER}`,
        display: "flex",
        alignItems: "center",
        gap: "var(--space-2h)",
        background: DP_HEAD_BG,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2h)", flex: 1, minWidth: 0 }}>
        {children}
      </div>
      {right ? <div style={{ marginLeft: "auto" }}>{right}</div> : null}
    </div>
  );
}

interface DarkPanelBodyProps {
  children: ReactNode;
  padding?: string;
}

export function DarkPanelBody({
  children,
  padding = "var(--space-4)",
}: DarkPanelBodyProps): JSX.Element {
  return (
    <div
      style={{
        padding,
        overflow: "auto",
      }}
    >
      {children}
    </div>
  );
}
