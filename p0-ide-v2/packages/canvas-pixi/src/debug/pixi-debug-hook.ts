export interface PixiDebugHook {
  app?: {
    renderer?: {
      statistics?: { drawCalls?: number };
      texture?: { managedTextures?: unknown[] };
      buffer?: { managedBuffers?: unknown[] };
    };
  };
}

declare global {
  // eslint-disable-next-line no-var
  var __pixi: PixiDebugHook | undefined;
}

export function getPixiDebugHook(): PixiDebugHook | undefined {
  return globalThis.__pixi;
}
