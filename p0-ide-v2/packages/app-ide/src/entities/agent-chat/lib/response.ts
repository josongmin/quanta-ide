import { RESPONSES } from "../api/mock";

export const STREAM_SPEED = 14;

export function makeId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function pickResponse(): string {
  return RESPONSES[Math.floor(Math.random() * RESPONSES.length)];
}
