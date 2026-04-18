import { describe, it, expect } from "vitest";
import type { GutterMark } from "@quanta/app-ide/entities/gutter";
import type { RiskPoint } from "@quanta/app-ide/entities/risk";
import { deriveMinimap, gutterToRiskPoint } from "../lib/derive";

describe("editor-risk-minimap / derive", () => {
  describe("gutterToRiskPoint", () => {
    it("maps taint glyphs to taint kind", () => {
      expect(gutterToRiskPoint({ line: 10, glyph: "taint-source", title: "" }).kind).toBe("taint");
      expect(gutterToRiskPoint({ line: 10, glyph: "taint-sink", title: "" }).kind).toBe("taint");
      expect(gutterToRiskPoint({ line: 10, glyph: "taint-through", title: "" }).kind).toBe("taint");
      expect(gutterToRiskPoint({ line: 10, glyph: "taint-sanitized", title: "" }).kind).toBe("taint");
    });

    it("maps arch + ownership glyphs to arch kind", () => {
      expect(gutterToRiskPoint({ line: 1, glyph: "arch-violation", title: "" }).kind).toBe("arch");
      expect(gutterToRiskPoint({ line: 1, glyph: "cycle", title: "" }).kind).toBe("arch");
      expect(gutterToRiskPoint({ line: 1, glyph: "god", title: "" }).kind).toBe("arch");
      expect(gutterToRiskPoint({ line: 1, glyph: "silo", title: "" }).kind).toBe("arch");
    });

    it("maps behavior glyphs to typestate kind", () => {
      expect(gutterToRiskPoint({ line: 1, glyph: "typestate", title: "" }).kind).toBe("typestate");
      expect(gutterToRiskPoint({ line: 1, glyph: "flaky", title: "" }).kind).toBe("typestate");
    });

    it("maps incident-match to taint (travels with the data path)", () => {
      expect(gutterToRiskPoint({ line: 1, glyph: "incident-match", title: "" }).kind).toBe("taint");
    });

    it("maps dead glyph to dead kind", () => {
      expect(gutterToRiskPoint({ line: 1, glyph: "dead", title: "" }).kind).toBe("dead");
    });

    it("maps GLYPH_META.severity → numeric severity (info=1, warn=3, danger=4)", () => {
      // taint-source is "warn"
      expect(gutterToRiskPoint({ line: 1, glyph: "taint-source", title: "" }).severity).toBe(3);
      // taint-sink is "danger"
      expect(gutterToRiskPoint({ line: 1, glyph: "taint-sink", title: "" }).severity).toBe(4);
      // taint-through is "info"
      expect(gutterToRiskPoint({ line: 1, glyph: "taint-through", title: "" }).severity).toBe(1);
      // dead is "info"
      expect(gutterToRiskPoint({ line: 1, glyph: "dead", title: "" }).severity).toBe(1);
    });
  });

  describe("deriveMinimap", () => {
    it("projects every gutter glyph to a minimap point", () => {
      const gutter: GutterMark[] = [
        { line: 10, glyph: "taint-sink", title: "" },
        { line: 20, glyph: "dead", title: "" },
      ];
      const out = deriveMinimap(gutter);
      expect(out).toHaveLength(2);
      expect(out[0]).toEqual({ line: 10, kind: "taint", severity: 4 });
      expect(out[1]).toEqual({ line: 20, kind: "dead", severity: 1 });
    });

    it("sorts ascending by line", () => {
      const gutter: GutterMark[] = [
        { line: 30, glyph: "dead", title: "" },
        { line: 5, glyph: "taint-sink", title: "" },
        { line: 12, glyph: "arch-violation", title: "" },
      ];
      const out = deriveMinimap(gutter);
      expect(out.map((p) => p.line)).toEqual([5, 12, 30]);
    });

    it("merges auxiliary extras on top of gutter", () => {
      const gutter: GutterMark[] = [{ line: 10, glyph: "taint-sink", title: "" }];
      const extras: RiskPoint[] = [
        { line: 50, kind: "blast", severity: 4 },
      ];
      const out = deriveMinimap(gutter, extras);
      expect(out.map((p) => `${p.line}:${p.kind}`)).toEqual([
        "10:taint",
        "50:blast",
      ]);
    });

    it("dedupe key is (line, kind) — different kinds at same line both render", () => {
      const gutter: GutterMark[] = [
        { line: 100, glyph: "god", title: "" }, // → arch
      ];
      const extras: RiskPoint[] = [
        { line: 100, kind: "blast", severity: 4 }, // separate kind
      ];
      const out = deriveMinimap(gutter, extras);
      expect(out).toHaveLength(2);
      expect(out.map((p) => p.kind).sort()).toEqual(["arch", "blast"]);
    });

    it("same (line, kind): higher severity wins", () => {
      const gutter: GutterMark[] = [
        { line: 50, glyph: "taint-through", title: "" }, // taint sev 1
      ];
      const extras: RiskPoint[] = [
        { line: 50, kind: "taint", severity: 4 }, // override
      ];
      const out = deriveMinimap(gutter, extras);
      expect(out).toHaveLength(1);
      expect(out[0].severity).toBe(4);
    });

    it("multi-kind same line is sorted alphabetically by kind for stable rendering", () => {
      const gutter: GutterMark[] = [
        { line: 200, glyph: "god", title: "" }, // → arch
      ];
      const extras: RiskPoint[] = [
        { line: 200, kind: "blast", severity: 3 },
        { line: 200, kind: "taint", severity: 4 },
      ];
      const out = deriveMinimap(gutter, extras).filter((p) => p.line === 200);
      expect(out.map((p) => p.kind)).toEqual(["arch", "blast", "taint"]);
    });
  });
});
