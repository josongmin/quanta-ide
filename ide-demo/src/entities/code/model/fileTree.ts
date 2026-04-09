export interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
  risk?: { level: "critical" | "warning" | "info"; count: number };
  language?: string;
}

export const FILE_TREE: FileNode[] = [
  {
    name: "src",
    path: "src",
    type: "directory",
    children: [
      {
        name: "payment",
        path: "src/payment",
        type: "directory",
        children: [
          { name: "processRefund.ts", path: "src/payment/processRefund.ts", type: "file", language: "typescript", risk: { level: "critical", count: 5 } },
          { name: "processPayment.ts", path: "src/payment/processPayment.ts", type: "file", language: "typescript", risk: { level: "warning", count: 2 } },
          { name: "types.ts", path: "src/payment/types.ts", type: "file", language: "typescript" },
        ],
      },
      {
        name: "auth",
        path: "src/auth",
        type: "directory",
        children: [
          { name: "validate.ts", path: "src/auth/validate.ts", type: "file", language: "typescript", risk: { level: "warning", count: 3 } },
          { name: "middleware.ts", path: "src/auth/middleware.ts", type: "file", language: "typescript", risk: { level: "critical", count: 2 } },
        ],
      },
      {
        name: "db",
        path: "src/db",
        type: "directory",
        children: [
          { name: "client.ts", path: "src/db/client.ts", type: "file", language: "typescript" },
          { name: "migrations.ts", path: "src/db/migrations.ts", type: "file", language: "typescript", risk: { level: "warning", count: 4 } },
        ],
      },
      {
        name: "webhooks",
        path: "src/webhooks",
        type: "directory",
        children: [
          { name: "sender.ts", path: "src/webhooks/sender.ts", type: "file", language: "typescript", risk: { level: "info", count: 1 } },
        ],
      },
      {
        name: "billing",
        path: "src/billing",
        type: "directory",
        children: [
          { name: "ledger.ts", path: "src/billing/ledger.ts", type: "file", language: "typescript" },
        ],
      },
    ],
  },
];
