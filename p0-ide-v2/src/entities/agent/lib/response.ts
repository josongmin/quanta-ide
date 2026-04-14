import { RESPONSE_POOL, GENERIC_RESPONSES } from "../api/mock";

export const STREAM_SPEED = 12;

export function makeId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function pickResponse(userText: string): string {
  const lower = userText.toLowerCase();
  for (const [keyword, responses] of Object.entries(RESPONSE_POOL)) {
    if (lower.includes(keyword)) {
      return responses[Math.floor(Math.random() * responses.length)];
    }
  }
  return GENERIC_RESPONSES[Math.floor(Math.random() * GENERIC_RESPONSES.length)];
}
