import type { TelemetryEvent } from "./events";

/**
 * Listener invoked for every emitted event. Synchronous; throwing from
 * a listener will bubble up to the caller of `emit`.
 */
export type TelemetryListener = (e: TelemetryEvent) => void;

/**
 * In-memory fan-out for telemetry events.
 *
 * Zero-dependency, unordered dispatch. Listeners are stored in a `Set`
 * so subscribing the same function twice is a no-op. Call the returned
 * function to unsubscribe.
 */
export class TelemetryEmitter {
  readonly #listeners = new Set<TelemetryListener>();

  /**
   * Register a listener. Returns an unsubscribe function that removes
   * exactly this listener registration.
   */
  on(listener: TelemetryListener): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  /**
   * Deliver `event` to every registered listener in insertion order.
   */
  emit(event: TelemetryEvent): void {
    for (const listener of this.#listeners) {
      listener(event);
    }
  }

  /** Remove every listener. */
  clear(): void {
    this.#listeners.clear();
  }

  /** Current listener count — primarily for tests/diagnostics. */
  get size(): number {
    return this.#listeners.size;
  }
}
