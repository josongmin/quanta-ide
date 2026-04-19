import type { Meta, StoryObj } from "@storybook/react";
import { Section, Sub } from "./Section";

const meta = {
  title: "UI Kit/Section",
  component: Section,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div
        style={{
          width: 320,
          background: "var(--bg)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-md)",
          fontFamily: "var(--font-sans)",
          fontSize: "var(--fs-sm)",
          color: "var(--fg)",
        }}
      >
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Section>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    label: "Signals",
    children: (
      <div style={{ display: "flex", gap: 12, padding: "8px 0" }}>
        <Sub k="taint" v="3" tone="danger" />
        <Sub k="dead" v="12" />
        <Sub k="complexity" v="8" tone="warn" />
      </div>
    ),
  },
};

export const WithCount: Story = {
  name: "With count badge",
  args: {
    label: "Incidents",
    count: 7,
    children: (
      <ul style={{ margin: 0, padding: "4px 0 4px 16px", listStyle: "disc", fontSize: 12 }}>
        <li>Null pointer in auth handler</li>
        <li>Unchecked SQL injection path</li>
        <li>Missing rate limit on /api/export</li>
      </ul>
    ),
  },
};

export const RichContent: Story = {
  name: "Rich content",
  args: {
    label: "Ownership",
    count: 3,
    children: (
      <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "8px 0", fontSize: 12 }}>
        {[
          { name: "Alice", area: "auth/", pct: "42%" },
          { name: "Bob", area: "api/", pct: "35%" },
          { name: "Carol", area: "infra/", pct: "23%" },
        ].map((o) => (
          <div key={o.name} style={{ display: "flex", justifyContent: "space-between" }}>
            <span>
              <strong>{o.name}</strong>{" "}
              <span style={{ color: "var(--fg-subtle)" }}>{o.area}</span>
            </span>
            <span style={{ fontFamily: "var(--font-mono)", color: "var(--fg-muted)" }}>{o.pct}</span>
          </div>
        ))}
      </div>
    ),
  },
};
