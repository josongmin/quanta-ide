export type OwnershipRole = "primary" | "contributor" | "orphan";

export interface OwnershipEntry {
  author: string;
  pct: number;
  role: OwnershipRole;
}
