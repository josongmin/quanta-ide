import { describe, it, expect, beforeEach } from "vitest";
import { ticketLinksStore } from "./ticket-links-store";
import { listMockTickets } from "../lib/mock-tickets";

describe("ticket-links-store", () => {
  beforeEach(() => {
    ticketLinksStore.reset();
  });

  it("link attaches a known ticket to a file; dup is a no-op", () => {
    const first = listMockTickets()[0]!;
    ticketLinksStore.link("f1", first.id);
    ticketLinksStore.link("f1", first.id);
    const list = ticketLinksStore.listFor("f1");
    expect(list.length).toBe(1);
    expect(list[0]!.id).toBe(first.id);
  });

  it("link with an unknown ticket id is rejected silently", () => {
    let ticks = 0;
    const unsub = ticketLinksStore.subscribe(() => { ticks += 1; });
    ticketLinksStore.link("f1", "not-a-real-ticket");
    expect(ticks).toBe(0);
    expect(ticketLinksStore.listFor("f1").length).toBe(0);
    unsub();
  });

  it("unlink removes the ticket; unknown pair is a no-op", () => {
    const [t1, t2] = listMockTickets();
    if (!t1 || !t2) throw new Error("need 2+ mock tickets");
    ticketLinksStore.link("f1", t1.id);
    ticketLinksStore.link("f1", t2.id);
    ticketLinksStore.unlink("f1", t1.id);
    const list = ticketLinksStore.listFor("f1");
    expect(list.map(t => t.id)).toEqual([t2.id]);
    let ticks = 0;
    const unsub = ticketLinksStore.subscribe(() => { ticks += 1; });
    ticketLinksStore.unlink("no-such-file", t1.id);
    expect(ticks).toBe(0);
    unsub();
  });

  it("seedFromFileIds guarantees index-0 file gets t-eng-142", () => {
    const fileIds = ["a.ts", "b.ts", "c.ts"];
    ticketLinksStore.seedFromFileIds(fileIds);
    const first = ticketLinksStore.listFor("a.ts");
    expect(first.some(t => t.id === "t-eng-142")).toBe(true);
  });

  it("seedFromFileIds with empty input does not emit", () => {
    let ticks = 0;
    const unsub = ticketLinksStore.subscribe(() => { ticks += 1; });
    ticketLinksStore.seedFromFileIds([]);
    expect(ticks).toBe(0);
    unsub();
  });
});
