import { gutter, GutterMarker } from "@codemirror/view";
import { RangeSet } from "@codemirror/state";
import type { GutterGlyph, GutterMark } from "@quanta/app-ide/entities/gutter";

const GLYPH_SVG: Record<GutterGlyph, string> = {
  "taint-source":
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"><path d="M9.2 1.8 L3.5 8.7 L7.4 8.7 L6.4 14.2 L12.5 7.2 L8.6 7.2 Z"/></svg>',
  "taint-sink":
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><circle cx="8" cy="8" r="5.6"/><line x1="4.6" y1="8" x2="11.4" y2="8"/></svg>',
  "taint-through":
    '<svg viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="8" r="1.7"/></svg>',
  "taint-sanitized":
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polyline points="3.5 8.5 6.5 11.5 12.5 4.8"/></svg>',
  "arch-violation":
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4.2 4.2 L11.8 11.8 M11.8 4.2 L4.2 11.8"/></svg>',
  "cycle":
    // Two arrows forming a circle (cyclic dep). 16x16 viewBox.
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M3 8a5 5 0 0 1 9-3"/><polyline points="11.5 2.8 12 5 9.7 5.3"/><path d="M13 8a5 5 0 0 1-9 3"/><polyline points="4.5 13.2 4 11 6.3 10.7"/></svg>',
  "god":
    // Crown/spike rays (responsibility overload). Stroke only.
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11 L4 5 L8 9 L12 5 L13 11 Z"/><line x1="3" y1="13.2" x2="13" y2="13.2"/></svg>',
  "dead":
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="4.5 5 11 5 4.5 11 11 11"/></svg>',
  "typestate":
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M8 2.5 L13.2 8 L8 13.5 L2.8 8 Z"/></svg>',
  "silo":
    // Single user silhouette (bus factor 1). Solid fill for emphasis.
    '<svg viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="5" r="2.4"/><path d="M3.5 13c0-2.5 2-4.2 4.5-4.2s4.5 1.7 4.5 4.2v.5h-9z"/></svg>',
  "flaky":
    // Wave/zigzag (non-deterministic). Stroke only.
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="2.5 11 5 5 8 11 11 5 13.5 11"/></svg>',
  "incident-match":
    '<svg viewBox="0 0 16 16" fill="currentColor"><rect x="7.1" y="3.5" width="1.8" height="6" rx="0.5"/><circle cx="8" cy="11.6" r="1"/></svg>',
};

class GlyphMarker extends GutterMarker {
  constructor(readonly glyph: GutterGlyph, readonly title: string) {
    super();
  }
  override eq(other: GutterMarker) {
    return other instanceof GlyphMarker && other.glyph === this.glyph;
  }
  override toDOM() {
    const el = document.createElement("span");
    el.className = `cm-gm cm-gm--${this.glyph}`;
    el.innerHTML = GLYPH_SVG[this.glyph];
    el.title = this.title;
    return el;
  }
}

export function engineGutter(marks: GutterMark[]) {
  const byLine = new Map<number, GutterMark>();
  for (const m of marks) {
    const prev = byLine.get(m.line);
    if (!prev || priority(m.glyph) > priority(prev.glyph)) byLine.set(m.line, m);
  }

  return gutter({
    class: "cm-engine-gutter",
    markers: (view) => {
      const builder: { from: number; value: GlyphMarker }[] = [];
      const doc = view.state.doc;
      for (const [line, mark] of byLine) {
        if (line < 1 || line > doc.lines) continue;
        const lineObj = doc.line(line);
        builder.push({
          from: lineObj.from,
          value: new GlyphMarker(mark.glyph, mark.title),
        });
      }
      builder.sort((a, b) => a.from - b.from);
      return RangeSet.of(builder.map((b) => b.value.range(b.from)));
    },
    initialSpacer: () => new GlyphMarker("taint-through", ""),
  });
}

function priority(g: GutterGlyph): number {
  switch (g) {
    case "taint-sink": return 100;
    case "incident-match": return 90;
    case "arch-violation": return 80;
    case "cycle": return 75;
    case "typestate": return 70;
    case "god": return 65;
    case "taint-source": return 60;
    case "dead": return 40;
    case "silo": return 30;
    case "flaky": return 25;
    case "taint-through": return 20;
    case "taint-sanitized": return 10;
  }
}
