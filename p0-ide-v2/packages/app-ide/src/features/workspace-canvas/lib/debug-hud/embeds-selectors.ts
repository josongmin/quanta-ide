// ------------
// Pure selectors used by the HUD's embed rows (tickets / PRs / slack):
// collect linked ids, apply source/state filters, count PR touches, and
// scope slack threads to the currently-selected file. No React, no store.
// ------------

import type { PR } from "../mock-prs";
import type { SlackThread } from "../mock-slack";
import { resolveSlackRelatedFileId } from "../mock-slack";
import type { Ticket, TicketSource, TicketState } from "../mock-tickets";

export function collectLinkedTicketIds(
  byFile: ReadonlyMap<string, readonly string[]>,
): ReadonlySet<string> {
  const s = new Set<string>();
  for (const ids of byFile.values()) for (const id of ids) s.add(id);
  return s;
}

export function filterLinkedTickets(
  tickets: readonly Ticket[],
  linkedIds: ReadonlySet<string>,
  source: TicketSource | "all",
  ticketState: TicketState | "all",
): readonly Ticket[] {
  return tickets.filter(t => {
    if (!linkedIds.has(t.id)) return false;
    if (source !== "all" && t.source !== source) return false;
    if (ticketState !== "all" && t.state !== ticketState) return false;
    return true;
  });
}

export function countPrTouches(
  prsByFile: ReadonlyMap<string, readonly PR[]>,
  prNumber: number,
): number {
  let n = 0;
  for (const row of prsByFile.values()) {
    if (row.some(p => p.number === prNumber)) n += 1;
  }
  return n;
}

export function filterSlackThreadsByFile(
  threads: readonly SlackThread[],
  fileIds: readonly string[],
  selectedFileId: string | null | undefined,
): readonly SlackThread[] {
  if (!selectedFileId) return threads;
  return threads.filter(t => {
    const fid = resolveSlackRelatedFileId(t, fileIds);
    return fid === selectedFileId;
  });
}
