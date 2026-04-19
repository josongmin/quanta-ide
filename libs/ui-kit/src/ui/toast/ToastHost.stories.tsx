import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import type { Toast } from "@quanta/shell-contract";
import { ToastHost } from "./ToastHost";

const meta = {
  title: "UI Kit/ToastHost",
  component: ToastHost,
  tags: ["autodocs"],
  args: { onDismiss: fn() },
  decorators: [
    (Story) => (
      <div style={{ minHeight: 300, position: "relative" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ToastHost>;

export default meta;
type Story = StoryObj<typeof meta>;

const toast = (overrides: Partial<Toast> & { id: string; kind: Toast["kind"]; title: string }): Toast => ({
  ...overrides,
});

export const Success: Story = {
  args: {
    toasts: [toast({ id: "1", kind: "success", title: "Analysis complete", detail: "3 files scanned in 1.2s" })],
  },
};

export const ErrorToast: Story = {
  name: "Error (danger)",
  args: {
    toasts: [toast({ id: "1", kind: "danger", title: "Connection lost", detail: "Retrying in 5s..." })],
  },
};

export const Info: Story = {
  args: {
    toasts: [toast({ id: "1", kind: "info", title: "New version available", detail: "v2.4.0 is ready to install." })],
  },
};

export const Warning: Story = {
  args: {
    toasts: [toast({ id: "1", kind: "warn", title: "High complexity detected", engine: "complexity" })],
  },
};

export const MultipleToasts: Story = {
  name: "Multiple toasts",
  args: {
    toasts: [
      toast({ id: "1", kind: "success", title: "Saved", detail: "Changes persisted." }),
      toast({ id: "2", kind: "info", title: "Sync started", engine: "taint-flow" }),
      toast({ id: "3", kind: "danger", title: "Build failed", detail: "Exit code 1" }),
      toast({ id: "4", kind: "warn", title: "Deprecation warning", detail: "API v1 will be removed in Q3." }),
    ],
  },
};

export const WithEngineTag: Story = {
  name: "With engine tag",
  args: {
    toasts: [
      toast({
        id: "1",
        kind: "info",
        title: "Taint path found",
        detail: "user_input -> db.query() via 3 hops",
        engine: "taint-flow",
      }),
    ],
  },
};
