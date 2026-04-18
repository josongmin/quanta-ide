import type { AiService } from "./ai-service";
import { createMockAiService } from "./mock-ai-service";

// Single mutable reference to the active AiService implementation.
// The mock is installed at module load; a real implementation can
// replace it at runtime (e.g. during app bootstrap) by calling
// `setAiService(realImpl)`. Every UI call site reads through
// `getAiService()` so the swap is transparent.

let service: AiService = createMockAiService();

export function getAiService(): AiService {
  return service;
}

export function setAiService(next: AiService): void {
  service = next;
}
