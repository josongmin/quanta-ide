import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { Modal } from "./Modal";

const meta = {
  title: "UI Kit/Modal",
  component: Modal,
  tags: ["autodocs"],
  args: { onClose: fn() },
  decorators: [
    (Story) => (
      <div style={{ minHeight: 400 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Modal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    open: true,
    children: (
      <div style={{ padding: 24 }}>
        <h2 id="modal-title" style={{ margin: "0 0 8px" }}>Modal title</h2>
        <p style={{ margin: 0, color: "var(--fg-muted)" }}>
          This is a default medium-sized modal.
        </p>
      </div>
    ),
    labelledBy: "modal-title",
  },
};

export const Closed: Story = {
  args: {
    open: false,
    children: <p>You should not see this.</p>,
  },
};

export const SizeSm: Story = {
  name: "Size: sm",
  args: {
    open: true,
    size: "sm",
    children: (
      <div style={{ padding: 24 }}>
        <h2 style={{ margin: "0 0 8px" }}>Small modal</h2>
        <p style={{ margin: 0, color: "var(--fg-muted)" }}>max-width 360px</p>
      </div>
    ),
  },
};

export const SizeLg: Story = {
  name: "Size: lg",
  args: {
    open: true,
    size: "lg",
    children: (
      <div style={{ padding: 24 }}>
        <h2 style={{ margin: "0 0 8px" }}>Large modal</h2>
        <p style={{ margin: 0, color: "var(--fg-muted)" }}>max-width 800px</p>
      </div>
    ),
  },
};

export const SizeFit: Story = {
  name: "Size: fit",
  args: {
    open: true,
    size: "fit",
    children: (
      <div style={{ padding: 24 }}>
        <h2 style={{ margin: "0 0 8px" }}>Fit-content modal</h2>
        <p style={{ margin: 0, color: "var(--fg-muted)" }}>Width adapts to content.</p>
      </div>
    ),
  },
};

export const WithFormContent: Story = {
  args: {
    open: true,
    children: (
      <form
        style={{ padding: 24, display: "flex", flexDirection: "column", gap: 12 }}
        onSubmit={(e) => e.preventDefault()}
      >
        <h2 style={{ margin: 0 }}>Create project</h2>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
          Name
          <input
            type="text"
            placeholder="my-project"
            style={{
              padding: "6px 8px",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              background: "var(--bg)",
              fontSize: 13,
            }}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
          Description
          <textarea
            rows={3}
            placeholder="Optional description..."
            style={{
              padding: "6px 8px",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              background: "var(--bg)",
              fontSize: 13,
              resize: "vertical",
            }}
          />
        </label>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
          <button
            type="button"
            style={{
              padding: "6px 14px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border)",
              fontSize: 12,
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            style={{
              padding: "6px 14px",
              borderRadius: "var(--radius-sm)",
              background: "var(--accent)",
              color: "var(--accent-fg)",
              border: "none",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            Create
          </button>
        </div>
      </form>
    ),
  },
};
