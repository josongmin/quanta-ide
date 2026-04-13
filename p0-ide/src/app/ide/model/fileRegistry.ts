/** Single source of truth for demo file names */
export const FILE_NAMES = ["orchestrator.py", "routing_policy.py", "security.py", "audit_store.py"] as const;
export type FileName = (typeof FILE_NAMES)[number];
