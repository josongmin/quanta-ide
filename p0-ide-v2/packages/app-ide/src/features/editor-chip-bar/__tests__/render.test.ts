import { describe, it, expect } from "vitest";
import {
  createChip,
  createMeta,
  createRisk,
  signature,
  taintChipKind,
  tone,
} from "../model/render";
import type { ChipKind } from "../model/render";

const ALL_CHIP_KINDS: ChipKind[] = [
  "default",
  "bad",
  "warn",
  "muted",
  "taint-source",
  "taint-sink",
  "taint-passthrough",
  "taint-sanitized",
];

describe("editor-chip-bar / render", () => {
  describe("createChip", () => {
    it("emits chip with ico, value, em, sub", () => {
      const el = createChip({ ico: "blast", value: 38, em: "3 crit", sub: "n=12" });
      expect(el.tagName).toBe("SPAN");
      expect(el.className).toBe("cm-chip");
      expect(el.querySelector(".cm-chip__ico")?.textContent).toBe("blast");
      expect(el.querySelector(".cm-chip__sub")?.textContent).toBe(" n=12");
      expect(el.querySelector("em")?.textContent).toBe("·3 crit");
      expect(el.textContent).toContain("38");
    });

    it("emits label-only chip (no ico) when ico is omitted", () => {
      const el = createChip({ value: "dead", kind: "muted" });
      expect(el.className).toBe("cm-chip is-muted");
      expect(el.querySelector(".cm-chip__ico")).toBeNull();
      expect(el.textContent).toBe("dead");
    });

    it("applies kind suffix correctly via the registry", () => {
      expect(createChip({ ico: "x", value: 1, kind: "bad" }).className).toBe("cm-chip is-bad");
      expect(createChip({ ico: "x", value: 1, kind: "warn" }).className).toBe("cm-chip is-warn");
      expect(createChip({ ico: "x", value: 1, kind: "taint-sink" }).className).toBe("cm-chip cm-chip--taint-sink");
      expect(createChip({ ico: "x", value: 1, kind: "taint-sanitized" }).className).toBe("cm-chip cm-chip--taint-sanitized");
      expect(createChip({ ico: "x", value: 1 }).className).toBe("cm-chip");
    });

    it("registry covers every ChipKind exhaustively", () => {
      // Every ChipKind value must produce a className that starts with `cm-chip`
      // and is unique (no two kinds map to the same class — except "default"
      // which intentionally has no suffix).
      const seen = new Set<string>();
      for (const kind of ALL_CHIP_KINDS) {
        const cn = createChip({ ico: "x", value: 1, kind }).className;
        expect(cn.startsWith("cm-chip")).toBe(true);
        expect(seen.has(cn)).toBe(false);
        seen.add(cn);
      }
      expect(seen.size).toBe(ALL_CHIP_KINDS.length);
    });

    it("never emits unparsed HTML — XSS-safe via textContent", () => {
      const malicious = "<script>alert(1)</script>";
      const el = createChip({ ico: malicious, value: malicious, em: malicious, sub: malicious });
      // No <script> element materialises anywhere in the subtree.
      expect(el.querySelector("script")).toBeNull();
      // The literal angle brackets round-trip as text, not as a parsed tag.
      expect(el.querySelector(".cm-chip__ico")?.textContent).toBe(malicious);
      // Only the spans/em we built — no surprise children.
      const tags = Array.from(el.querySelectorAll("*")).map((n) => n.tagName);
      expect(tags.every((t) => t === "SPAN" || t === "EM")).toBe(true);
    });

    it("coerces numeric value via String()", () => {
      expect(createChip({ ico: "x", value: 0 }).textContent).toContain("0");
      expect(createChip({ ico: "x", value: 42 }).textContent).toContain("42");
    });

    it("sets aria-label from concatenated parts", () => {
      const full = createChip({ ico: "blast", value: 38, em: "3 crit", sub: "91%" });
      expect(full.getAttribute("aria-label")).toBe("blast 38 3 crit 91%");

      const labelOnly = createChip({ value: "dead", kind: "muted" });
      expect(labelOnly.getAttribute("aria-label")).toBe("dead");

      const numericValueOnly = createChip({ ico: "cpx", value: 9 });
      expect(numericValueOnly.getAttribute("aria-label")).toBe("cpx 9");
    });
  });

  describe("createMeta", () => {
    it("emits meta span with text content + aria-label", () => {
      const el = createMeta("@songmin · 2w");
      expect(el.className).toBe("cm-chip-bar__meta");
      expect(el.textContent).toBe("@songmin · 2w");
      expect(el.getAttribute("aria-label")).toBe("@songmin · 2w");
      expect(el.children.length).toBe(0);
    });

    it("XSS-safe", () => {
      const el = createMeta("<img src=x onerror=alert(1)>");
      expect(el.querySelector("img")).toBeNull();
      expect(el.textContent).toBe("<img src=x onerror=alert(1)>");
    });
  });

  describe("createRisk", () => {
    it("bare pill (no ico)", () => {
      const el = createRisk(78);
      expect(el.className).toBe("cm-chip-bar__risk");
      expect(el.querySelector(".cm-chip__ico")).toBeNull();
      expect(el.textContent).toBe("78");
      expect(el.getAttribute("aria-label")).toBe("risk score 78");
    });

    it("with ico when icoLabel is given", () => {
      const el = createRisk(78, "risk");
      expect(el.className).toBe("cm-chip-bar__risk");
      const ico = el.querySelector(".cm-chip__ico");
      expect(ico).not.toBeNull();
      expect(ico?.textContent).toBe("risk");
      expect(el.textContent).toBe("risk78");
      expect(el.getAttribute("aria-label")).toBe("risk score 78");
    });

    it("XSS-safe ico label", () => {
      const el = createRisk(78, "<script>alert(1)</script>");
      expect(el.querySelector("script")).toBeNull();
      expect(el.querySelector(".cm-chip__ico")?.textContent).toBe("<script>alert(1)</script>");
    });
  });

  describe("taintChipKind", () => {
    it("maps every Taint value to a distinct kind", () => {
      expect(taintChipKind("source")).toBe("taint-source");
      expect(taintChipKind("sink")).toBe("taint-sink");
      expect(taintChipKind("passthrough")).toBe("taint-passthrough");
      expect(taintChipKind("sanitized")).toBe("taint-sanitized");
    });

    it("falls back to default for undefined", () => {
      expect(taintChipKind(undefined)).toBe("default");
    });
  });

  describe("tone", () => {
    it("respects RISK_HIGH (70) and RISK_MID (40) cutoffs", () => {
      expect(tone(0)).toBe("low");
      expect(tone(39)).toBe("low");
      expect(tone(40)).toBe("mid");
      expect(tone(69)).toBe("mid");
      expect(tone(70)).toBe("high");
      expect(tone(100)).toBe("high");
    });
  });

  describe("signature", () => {
    it("joins parts deterministically", () => {
      expect(signature("a", 1, true)).toBe(signature("a", 1, true));
    });

    it("treats nullish as empty string", () => {
      expect(signature("a", null, "b")).toBe(signature("a", undefined, "b"));
    });

    it("uses U+001F separator — distinguishes string-with-pipe from split parts", () => {
      // Without a control-char separator, ('a|b', 'c') and ('a', 'b|c') would collide.
      expect(signature("a|b", "c")).not.toBe(signature("a", "b|c"));
    });

    it("changes when any part changes", () => {
      const base = signature("file.py", 78, 38);
      expect(signature("file.py", 78, 39)).not.toBe(base);
      expect(signature("file.py", 79, 38)).not.toBe(base);
      expect(signature("other.py", 78, 38)).not.toBe(base);
    });
  });
});
