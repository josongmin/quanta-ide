import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CITY_FONT_BOLD_NAME, CITY_FONT_NAME, CITY_MONO_FONT_NAME } from "./BitmapFontAtlas";
import { _msdfMode, _resetMsdfForTests, ensureMsdfFont, msdfText } from "./msdf-text";

// jsdom does not ship a GL context, so Pixi's real BitmapFont parser cannot
// run here. Stub `pixi.js` down to the surface `msdf-text.ts` actually uses:
//   - `Assets.load` — controlled per test to exercise success / failure.
//   - `BitmapText`  — captures the style bag so we can assert font routing.
// Anything unrelated (Graphics, Application, etc.) stays unshimmed.
vi.mock("pixi.js", () => {
  class BitmapText {
    readonly text: string;
    readonly style: { fontFamily: string; fontSize: number; fill?: number };
    constructor(opts: { text: string; style: { fontFamily: string; fontSize: number; fill?: number } }) {
      this.text = opts.text;
      this.style = opts.style;
    }
  }
  return {
    Assets: { load: vi.fn() },
    BitmapText,
    // Surfaced because `BitmapFontAtlas.ts` imports it at module load. The
    // raster-fallback path calls `BitmapFont.install`, so make it a no-op.
    BitmapFont: { install: vi.fn() },
  };
});

import { Assets } from "pixi.js";

const mockedLoad = Assets.load as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  _resetMsdfForTests();
  mockedLoad.mockReset();
});

afterEach(() => {
  _resetMsdfForTests();
});

describe("ensureMsdfFont", () => {
  it("resolves to msdf mode when both atlases load", async () => {
    mockedLoad.mockResolvedValue({});
    await ensureMsdfFont();
    expect(_msdfMode()).toBe("msdf");
    // One call per atlas (regular + bold).
    expect(mockedLoad).toHaveBeenCalledTimes(2);
  });

  it("falls back to raster when any atlas fails to load", async () => {
    mockedLoad.mockImplementation((url: string) =>
      url.includes("Bold") ? Promise.reject(new Error("404")) : Promise.resolve({}),
    );
    // Silence the expected [msdf-text] warn — assert it fires but don't bleed
    // the console output into the test report.
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await ensureMsdfFont();
    expect(_msdfMode()).toBe("raster");
    expect(warnSpy).toHaveBeenCalledOnce();
    warnSpy.mockRestore();
  });

  it("is single-flight — concurrent callers share one load", async () => {
    let resolveRegular: (v: unknown) => void = () => {};
    let resolveBold: (v: unknown) => void = () => {};
    mockedLoad.mockImplementation((url: string) => {
      return new Promise((resolve) => {
        if (url.includes("Bold")) resolveBold = resolve;
        else resolveRegular = resolve;
      });
    });

    const a = ensureMsdfFont();
    const b = ensureMsdfFont();
    const c = ensureMsdfFont();

    // Only the first call kicks off Assets.load; b and c await the same promise.
    expect(mockedLoad).toHaveBeenCalledTimes(2);

    resolveRegular({});
    resolveBold({});
    await Promise.all([a, b, c]);
    expect(_msdfMode()).toBe("msdf");
    expect(mockedLoad).toHaveBeenCalledTimes(2);
  });

  it("is idempotent once resolved", async () => {
    mockedLoad.mockResolvedValue({});
    await ensureMsdfFont();
    await ensureMsdfFont();
    await ensureMsdfFont();
    expect(mockedLoad).toHaveBeenCalledTimes(2);
  });
});

describe("msdfText routing", () => {
  it("returns MSDF regular when mode=msdf and rasterFamily is not bold", async () => {
    mockedLoad.mockResolvedValue({});
    await ensureMsdfFont();
    const t = msdfText("hello", 12);
    expect(t.style.fontFamily).toBe("Pretendard-Regular");
    expect(t.style.fontSize).toBe(12);
  });

  it("returns MSDF bold when rasterFamily signals bold", async () => {
    mockedLoad.mockResolvedValue({});
    await ensureMsdfFont();
    const t = msdfText("bold", 11, 0xff00ff, CITY_FONT_BOLD_NAME);
    expect(t.style.fontFamily).toBe("Pretendard-Bold");
    expect(t.style.fill).toBe(0xff00ff);
  });

  it("collapses mono raster family into MSDF regular", async () => {
    mockedLoad.mockResolvedValue({});
    await ensureMsdfFont();
    const t = msdfText("code", 10, undefined, CITY_MONO_FONT_NAME);
    expect(t.style.fontFamily).toBe("Pretendard-Regular");
  });

  it("uses raster family verbatim when MSDF fell back", async () => {
    mockedLoad.mockRejectedValue(new Error("network"));
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await ensureMsdfFont();
    warnSpy.mockRestore();

    const def = msdfText("fallback", 12);
    expect(def.style.fontFamily).toBe(CITY_FONT_NAME);

    const bold = msdfText("b", 12, undefined, CITY_FONT_BOLD_NAME);
    expect(bold.style.fontFamily).toBe(CITY_FONT_BOLD_NAME);
  });
});
