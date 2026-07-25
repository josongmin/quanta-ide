import type { AuthzMap } from "../model/types";

const defaultMap: AuthzMap = {
  routes: [
    {
      id: "orders-list",
      method: "GET",
      path: "/api/orders",
      handler: "OrdersController.list",
      handlerFile: "src/api/orders/controller.ts",
      handlerLine: 18,
      resource: "Order",
      action: "read",
      guards: [
        { kind: "auth", symbol: "AuthGuard", file: "src/api/auth/guard.ts", line: 22, predicate: "session.valid" },
        { kind: "tenant", symbol: "TenantScope", file: "src/api/middleware/tenant.ts", line: 14, predicate: "tenant.id === session.tenant" },
      ],
      gaps: [],
    },
    {
      id: "orders-submit",
      method: "POST",
      path: "/api/orders",
      handler: "OrdersController.submit",
      handlerFile: "src/api/orders/controller.ts",
      handlerLine: 41,
      resource: "Order",
      action: "write",
      guards: [
        { kind: "auth", symbol: "AuthGuard", file: "src/api/auth/guard.ts", line: 22, predicate: "session.valid" },
        { kind: "permission", symbol: "RequireScope", file: "src/api/middleware/scope.ts", line: 9, predicate: "scope:orders.write" },
      ],
      gaps: [
        { reason: "Cross-tenant write — caller can submit orders for other tenants if `tenantId` body field is trusted", expected: "tenant", cwe: "CWE-639" },
      ],
    },
    {
      id: "orders-refund",
      method: "POST",
      path: "/api/orders/:id/refund",
      handler: "OrdersController.refund",
      handlerFile: "src/api/orders/controller.ts",
      handlerLine: 92,
      resource: "Refund",
      action: "destructive",
      guards: [
        { kind: "auth", symbol: "AuthGuard", file: "src/api/auth/guard.ts", line: 22, predicate: "session.valid" },
      ],
      gaps: [
        { reason: "Privileged refund route lacks role check — any authenticated session can refund", expected: "role", cwe: "CWE-862" },
        { reason: "No rate limit — repeated refunds can drain ledger", expected: "rate-limit" },
      ],
    },
    {
      id: "admin-flush",
      method: "POST",
      path: "/api/admin/cache/flush",
      handler: "AdminController.flushCache",
      handlerFile: "src/api/admin/controller.ts",
      handlerLine: 54,
      resource: "Cache",
      action: "admin",
      guards: [
        { kind: "auth", symbol: "AuthGuard", file: "src/api/auth/guard.ts", line: 22, predicate: "session.valid" },
        { kind: "role", symbol: "RequireRole", file: "src/api/middleware/role.ts", line: 11, predicate: "role === 'admin'" },
        { kind: "rate-limit", symbol: "RateLimit(1/min)", file: "src/api/middleware/rate.ts", line: 33, predicate: "1/min/admin" },
      ],
      gaps: [],
    },
  ],
};

export const AUTHZ_MAPS: Record<string, AuthzMap> = {
  __default: defaultMap,
};

export function getAuthzMap(fileName: string | undefined): AuthzMap {
  if (!fileName) return AUTHZ_MAPS.__default;
  return AUTHZ_MAPS[fileName] ?? AUTHZ_MAPS.__default;
}
