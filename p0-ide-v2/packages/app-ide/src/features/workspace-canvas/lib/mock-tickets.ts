// Mock tickets — Batch 8 (embeds.tickets)
// ---------------------------------------------------------------------
// Fixture data that represents the shape an issue-tracker adapter will
// return in production. No network calls; the data is deterministic so
// the demo canvas renders the same tickets across refreshes.
//
// Linking to real file IDs is done in `ticket-links-store.ts` during
// graph bootstrap; this module only defines the ticket bodies.

export type TicketSource = "linear" | "jira" | "github";
export type TicketState = "todo" | "in-progress" | "in-review" | "done";

export interface Ticket {
  readonly id: string;
  readonly source: TicketSource;
  readonly externalId: string;
  readonly title: string;
  readonly state: TicketState;
  readonly assignee?: string;
  readonly url: string;
}

const TICKETS: readonly Ticket[] = [
  {
    id: "t-eng-142",
    source: "linear",
    externalId: "ENG-142",
    title: "Refactor auth flow — split taint source from sink",
    state: "in-progress",
    assignee: "alice",
    url: "https://linear.app/quanta/issue/ENG-142",
  },
  {
    id: "t-eng-155",
    source: "linear",
    externalId: "ENG-155",
    title: "Reduce cyclomatic complexity on hot file",
    state: "todo",
    assignee: "bob",
    url: "https://linear.app/quanta/issue/ENG-155",
  },
  {
    id: "t-eng-158",
    source: "linear",
    externalId: "ENG-158",
    title: "Add trace overlay smoke test",
    state: "in-review",
    assignee: "carol",
    url: "https://linear.app/quanta/issue/ENG-158",
  },
  {
    id: "t-proj-401",
    source: "jira",
    externalId: "PROJ-401",
    title: "Dead import cleanup in canvas-pixi",
    state: "done",
    assignee: "dan",
    url: "https://quanta.atlassian.net/browse/PROJ-401",
  },
  {
    id: "t-proj-456",
    source: "jira",
    externalId: "PROJ-456",
    title: "Agent presence flicker on zoom change",
    state: "todo",
    url: "https://quanta.atlassian.net/browse/PROJ-456",
  },
  {
    id: "t-gh-2345",
    source: "github",
    externalId: "#2345",
    title: "Worker RTT spikes on large graphs",
    state: "in-progress",
    assignee: "erin",
    url: "https://github.com/quanta/quanta-ide/issues/2345",
  },
  {
    id: "t-gh-2378",
    source: "github",
    externalId: "#2378",
    title: "Minimap heatmap tint regression",
    state: "in-review",
    url: "https://github.com/quanta/quanta-ide/issues/2378",
  },
  {
    id: "t-gh-2410",
    source: "github",
    externalId: "#2410",
    title: "Elevation mode 3D shadow artefact",
    state: "done",
    assignee: "frank",
    url: "https://github.com/quanta/quanta-ide/issues/2410",
  },
];

/** Immutable access to the demo ticket list. */
export function listMockTickets(): readonly Ticket[] {
  return TICKETS;
}

/** Fast id → ticket lookup. */
export const MOCK_TICKETS_BY_ID: ReadonlyMap<string, Ticket> = new Map(
  TICKETS.map(t => [t.id, t]),
);

export function findTicket(id: string): Ticket | undefined {
  return MOCK_TICKETS_BY_ID.get(id);
}
