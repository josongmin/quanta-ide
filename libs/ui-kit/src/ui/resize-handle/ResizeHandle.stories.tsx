import { useState, useCallback } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { ResizeHandle } from "./ResizeHandle";

const meta = {
  title: "UI Kit/ResizeHandle",
  component: ResizeHandle,
  tags: ["autodocs"],
} satisfies Meta<typeof ResizeHandle>;

export default meta;
type Story = StoryObj<typeof meta>;

/* Interactive wrapper to demo real drag behavior. */
function VerticalDemo() {
  const [width, setWidth] = useState(200);
  const onResize = useCallback((d: number) => setWidth((w) => Math.max(80, w + d)), []);
  return (
    <div style={{ display: "flex", height: 200, fontFamily: "var(--font-sans)", fontSize: 12 }}>
      <div
        style={{
          width,
          minWidth: 80,
          background: "var(--bg-muted)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--fg-muted)",
          borderRadius: "var(--radius-sm) 0 0 var(--radius-sm)",
        }}
      >
        {width}px
      </div>
      <ResizeHandle onResize={onResize} ariaLabel="Resize sidebar" orientation="vertical" />
      <div
        style={{
          flex: 1,
          background: "var(--bg-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--fg-subtle)",
          borderRadius: "0 var(--radius-sm) var(--radius-sm) 0",
        }}
      >
        Main content
      </div>
    </div>
  );
}

function HorizontalDemo() {
  const [height, setHeight] = useState(120);
  const onResize = useCallback((d: number) => setHeight((h) => Math.max(40, h + d)), []);
  return (
    <div style={{ display: "flex", flexDirection: "column", width: 400, fontFamily: "var(--font-sans)", fontSize: 12 }}>
      <div
        style={{
          height,
          minHeight: 40,
          background: "var(--bg-muted)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--fg-muted)",
          borderRadius: "var(--radius-sm) var(--radius-sm) 0 0",
        }}
      >
        {height}px
      </div>
      <ResizeHandle onResize={onResize} ariaLabel="Resize panel" orientation="horizontal" />
      <div
        style={{
          height: 100,
          background: "var(--bg-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--fg-subtle)",
          borderRadius: "0 0 var(--radius-sm) var(--radius-sm)",
        }}
      >
        Bottom panel
      </div>
    </div>
  );
}

export const Vertical: Story = {
  render: () => <VerticalDemo />,
  args: { onResize: () => {}, ariaLabel: "Resize sidebar", orientation: "vertical" },
};

export const Horizontal: Story = {
  render: () => <HorizontalDemo />,
  args: { onResize: () => {}, ariaLabel: "Resize panel", orientation: "horizontal" },
};
