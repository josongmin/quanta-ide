import { DEMO_PAGES } from "./pages";
import type { CategoryId, DemoPageMeta } from "./types";

export const findPage = (id: string): DemoPageMeta =>
  DEMO_PAGES.find((p) => p.id === id) ?? DEMO_PAGES[0]!;

export const pagesByCategory = (cat: CategoryId): DemoPageMeta[] =>
  DEMO_PAGES.filter((p) => p.category === cat);
