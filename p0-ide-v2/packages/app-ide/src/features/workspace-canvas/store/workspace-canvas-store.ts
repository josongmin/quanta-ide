import { viewportStore } from "./viewport-store";
import { sceneStore } from "./scene-store";
import { interactionStore } from "./interaction-store";
import { renderSettingsStore } from "./render-settings-store";
import { uxSettingsStore } from "./ux-settings-store";
import { debugSettingsStore } from "./debug-settings-store";

let _batchDepth = 0;
const _facadeListeners = new Set<() => void>();
let _pendingFlush = false;

function _flushFacadeEmit() {
  _pendingFlush = false;
  for (const l of [..._facadeListeners]) l();
}

function _notifyFacade() {
  if (_batchDepth > 0) {
    if (!_pendingFlush) {
      _pendingFlush = true;
      queueMicrotask(_flushFacadeEmit);
    }
    return;
  }
  for (const l of [..._facadeListeners]) l();
}

export function batch<T>(fn: () => T): T {
  _batchDepth++;
  try {
    return fn();
  } finally {
    _batchDepth--;
    if (_batchDepth === 0 && !_pendingFlush) {
      _pendingFlush = true;
      queueMicrotask(_flushFacadeEmit);
    }
  }
}

export function subscribeBatched(listener: () => void): () => void {
  _facadeListeners.add(listener);
  return () => { _facadeListeners.delete(listener); };
}

viewportStore.subscribe(_notifyFacade);
sceneStore.subscribe(_notifyFacade);
interactionStore.subscribe(_notifyFacade);
renderSettingsStore.subscribe(_notifyFacade);
uxSettingsStore.subscribe(_notifyFacade);
debugSettingsStore.subscribe(_notifyFacade);
