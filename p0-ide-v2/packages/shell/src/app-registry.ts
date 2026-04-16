import type { TabAppDescriptor, AppKind } from "@quanta/shell-contract";

const registry = new Map<AppKind, TabAppDescriptor>();

export const appRegistry = {
  register(descriptor: TabAppDescriptor): void {
    registry.set(descriptor.id, descriptor);
  },

  get(id: AppKind): TabAppDescriptor | undefined {
    return registry.get(id);
  },

  getAll(): TabAppDescriptor[] {
    return [...registry.values()];
  },
};
