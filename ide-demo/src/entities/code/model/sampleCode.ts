export const SAMPLE_FILES: Record<string, { code: string; language: string }> = {
  "src/payment/processRefund.ts": {
    language: "typescript",
    code: `import axios from "axios";
import { db } from "../db/client";
import { validateUser } from "../auth/validate";
import { sendWebhook } from "../webhooks/sender";
import { ledger } from "../billing/ledger";

interface RefundRequest {
  userId: string;
  orderId: string;
  reason?: string;
}

/**
 * Process a refund for a given order.
 * Handles validation, DB update, ledger entry, and webhook notification.
 */
async function processRefund(req: RefundRequest) {
  const amount = req.body.amount;

  const user = await validateUser(req.userId);
  if (!user.active) {
    throw new Error("User account is inactive");
  }

  const order = await db.orders.findUnique({ where: { id: req.orderId } });
  if (!order || order.userId !== req.userId) {
    throw new Error("Order not found or unauthorized");
  }

  if (amount > 0) {
    await db.transactions.create({
      data: {
        orderId: req.orderId,
        amount: -amount,
        type: "refund",
        status: "pending",
      },
    });

    await db.orders.update({
      where: { id: req.orderId },
      data: { status: "refunded", refundedAt: new Date() },
    });

    await ledger.write({
      account: user.billingAccount,
      amount: -amount,
      memo: \`Refund for order \${req.orderId}\`,
    });
  }

  await sendWebhook("refund.completed", {
    userId: req.userId,
    orderId: req.orderId,
    amount,
    timestamp: Date.now(),
  });

  return { success: true, refundedAmount: amount };
}

export { processRefund };
export type { RefundRequest };
`,
  },

  "src/auth/validate.ts": {
    language: "typescript",
    code: `import { db } from "../db/client";
import { cache } from "../shared/cache";

interface User {
  id: string;
  active: boolean;
  billingAccount: string;
  role: "admin" | "user" | "service";
}

export async function validateUser(userId: string): Promise<User> {
  const cached = cache.get<User>(\`user:\${userId}\`);
  if (cached) return cached;

  const user = await db.users.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");

  cache.set(\`user:\${userId}\`, user, { ttl: 300 });
  return user;
}
`,
  },

  "src/db/client.ts": {
    language: "typescript",
    code: `import { PrismaClient } from "@prisma/client";

export const db = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["query"] : [],
});
`,
  },
};

export const DEFAULT_FILE = "src/payment/processRefund.ts";
