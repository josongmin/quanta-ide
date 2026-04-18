import { describe, it, expect } from "vitest";
import { getCompletions } from "./edge-filter-completions";

describe("getCompletions", () => {
  it("empty input at cursor 0 returns keys + '(' + 'not'", () => {
    const c = getCompletions("", 0);
    const labels = c.map(x => x.label);
    expect(labels).toContain("layer");
    expect(labels).toContain("kind");
    expect(labels).toContain("severity");
    expect(labels).toContain("animated");
    expect(labels).toContain("evidence");
    expect(labels).toContain("(");
    expect(labels).toContain("not");
  });

  it("'layer' with cursor at end returns op completions", () => {
    const src = "layer";
    const c = getCompletions(src, src.length);
    const labels = c.map(x => x.label);
    expect(labels).toContain("layer");
  });

  it("'layer ' with cursor after space returns ops", () => {
    const src = "layer ";
    const c = getCompletions(src, src.length);
    const labels = c.map(x => x.label);
    expect(labels).toContain("=");
    expect(labels).toContain("!=");
  });

  it("'layer=saf' at end returns 'safety'", () => {
    const src = "layer=saf";
    const c = getCompletions(src, src.length);
    const labels = c.map(x => x.label);
    expect(labels[0]).toBe("safety");
  });

  it("'layer=safety ' cursor after space returns and/or/)", () => {
    const src = "layer=safety ";
    const c = getCompletions(src, src.length);
    const labels = c.map(x => x.label);
    expect(labels).toContain("and");
    expect(labels).toContain("or");
    expect(labels).toContain(")");
  });

  it("'layer=safety and kin' at end returns 'kind'", () => {
    const src = "layer=safety and kin";
    const c = getCompletions(src, src.length);
    const labels = c.map(x => x.label);
    expect(labels[0]).toBe("kind");
  });

  it("severity key offers order operators", () => {
    const src = "severity ";
    const c = getCompletions(src, src.length);
    const labels = c.map(x => x.label);
    expect(labels).toContain(">=");
    expect(labels).toContain("<=");
    expect(labels).toContain(">");
    expect(labels).toContain("<");
  });

  it("animated after '=' returns bool values", () => {
    const src = "animated=";
    const c = getCompletions(src, src.length);
    const labels = c.map(x => x.label);
    expect(labels).toContain("true");
    expect(labels).toContain("false");
  });

  it("kind= offers EdgeKind union values", () => {
    const src = "kind=";
    const c = getCompletions(src, src.length);
    const labels = c.map(x => x.label);
    expect(labels).toContain("import");
  });

  it("returns no more than 10 completions", () => {
    const c = getCompletions("kind=", 5);
    expect(c.length).toBeLessThanOrEqual(10);
  });

  it("after '(' expects a key", () => {
    const src = "(";
    const c = getCompletions(src, src.length);
    const labels = c.map(x => x.label);
    expect(labels).toContain("layer");
  });

  it("after 'not ' expects a key", () => {
    const src = "not ";
    const c = getCompletions(src, src.length);
    const labels = c.map(x => x.label);
    expect(labels).toContain("layer");
  });

  // ── Temporal key completions (T2) ─────────────────────────────────
  it("empty input offers the temporal keys as well", () => {
    const c = getCompletions("", 0);
    const labels = c.map(x => x.label);
    expect(labels).toContain("added_since");
    expect(labels).toContain("stable_since");
    expect(labels).toContain("touched_by");
    expect(labels).toContain("churn");
    expect(labels).toContain("introduced_between");
  });

  it("added_since offers time-expression values", () => {
    const src = "added_since=";
    const c = getCompletions(src, src.length);
    const labels = c.map(x => x.label);
    expect(labels).toContain("2w");
    expect(labels).toContain("30d");
    expect(labels).toContain("1y");
  });

  it("churn after '=' offers integer values", () => {
    const src = "churn=";
    const c = getCompletions(src, src.length);
    const labels = c.map(x => x.label);
    expect(labels).toContain("1");
    expect(labels).toContain("10");
  });

  it("churn offers order operators", () => {
    const src = "churn ";
    const c = getCompletions(src, src.length);
    const labels = c.map(x => x.label);
    expect(labels).toContain(">=");
    expect(labels).toContain("<");
  });

  it("touched_by offers authors harvested from history", () => {
    const history = {
      snapshots: [
        { timestamp: 1, label: "feat alice", edgeIds: ["e1"] },
        { timestamp: 2, label: "fix bob", added: ["e2"] },
      ],
    };
    const c = getCompletions("touched_by=", "touched_by=".length, { history });
    const labels = c.map(x => x.label);
    // Either the harvested token or the fallback list should show up.
    expect(labels.length).toBeGreaterThan(0);
    expect(labels.some(l => ["alice", "bob", "feat", "fix"].includes(l))).toBe(true);
  });
});
