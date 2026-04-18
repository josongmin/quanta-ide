import type { AiService } from "./ai-service";
import { createMockAiService } from "./mock-ai-service";
import { AnthropicAiService } from "./anthropic-ai-service";

// Factory for the active AiService. The app mounts the default (mock)
// at boot; real deployments flip the mode by passing { mode: "anthropic",
// apiKey: "…" } here, typically from a build-time env var.
//
// The factory centralizes the "missing key" and "disabled-in-dev" rules:
// every unknown or incomplete config degrades to the mock so the UI
// never breaks because of a bad env.

export interface CreateAiServiceOptions {
  mode?: "mock" | "anthropic";
  apiKey?: string;
  model?: string;
  endpoint?: string;
}

export function createAiService(opts: CreateAiServiceOptions = {}): AiService {
  const mode = opts.mode ?? "mock";
  if (mode === "anthropic") {
    // AnthropicAiService is itself defensive — if apiKey is missing it
    // falls back per-call — but we still return the mock when the app
    // has no business making network requests at all (e.g. unit tests
    // that pass `{ mode: "anthropic" }` without a key by accident).
    if (!opts.apiKey || opts.apiKey.length === 0) {
      console.warn(
        "[ai-service-factory] mode=anthropic but no apiKey supplied — using mock.",
      );
      return createMockAiService();
    }
    return new AnthropicAiService({
      apiKey: opts.apiKey,
      model: opts.model,
      endpoint: opts.endpoint,
    });
  }
  return createMockAiService();
}
