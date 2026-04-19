#!/usr/bin/env node
/**
 * Generate pre-built MSDF bitmap font atlases for the canvas renderer.
 *
 * Inputs:   p0-ide-v2/scripts/fonts-source/*.otf
 * Outputs:  p0-ide-v2/public/fonts/<name>.fnt + <name>(-<page>).png
 *
 * The runtime loader ([packages/canvas-pixi/src/renderers/shared/msdf-text.ts])
 * calls `Assets.load()` on the generated .fnt at app boot. Shipping the atlas
 * as a static asset trades build-time cost for zero main-thread stall at
 * runtime — the prior `BitmapFont.install` path rasterized 11,267 Hangul
 * glyphs synchronously during `coldInit` and hung the Code Universe tab.
 *
 * Run: `pnpm build:fonts` (hooked into `prebuild` so `pnpm build` regenerates
 * automatically when the source OTF or charset hash changes).
 */

import generateBMFont from "msdf-bmfont-xml";
import { promises as fs } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..");

const SOURCE_DIR = path.join(REPO, "scripts/fonts-source");
const OUTPUT_DIR = path.join(REPO, "public/fonts");
const CACHE_FILE = path.join(OUTPUT_DIR, ".build-cache.json");

// Charset — ASCII printable + Korean Hangul syllables. Matches the label
// surface area the canvas renderers currently emit.
const CHARSET_RANGES = [
  [0x0020, 0x007e], // ASCII printable  (95)
  [0x00a0, 0x00ff], // Latin-1 supplement for curly quotes / nbsp / ©  (96)
  [0xac00, 0xd7a3], // Hangul syllables  (11,172)
];

function buildCharset() {
  const chars = [];
  for (const [lo, hi] of CHARSET_RANGES) {
    for (let c = lo; c <= hi; c++) chars.push(String.fromCodePoint(c));
  }
  return chars.join("");
}

// Source OTF → output atlas name. The runtime references these names via
// `MSDF_FONT_REGULAR` / `MSDF_FONT_BOLD` constants in msdf-text.ts.
const FONTS = [
  { src: "Pretendard-Regular.otf", name: "pretendard-regular-msdf" },
  { src: "Pretendard-Bold.otf",    name: "pretendard-bold-msdf"    },
];

// Atlas knobs. 42pt at 4096² with MSDF distanceRange=4 typically fits
// ~11.5k Hangul glyphs in 2 pages. Increase textureSize before font-size
// if you need fewer pages.
const BMFONT_OPTS = {
  outputType: "xml",
  fontSize: 42,
  textureSize: [4096, 4096],
  texturePadding: 2,
  distanceRange: 4,
  fieldType: "msdf",
  roundDecimal: 2,
  // smartSize crops unused atlas area per page. Without it, each page is
  // the full 4096² even if glyphs only fill the top-left corner — that was
  // ~17 MB per underfilled page on the initial generation.
  smartSize: true,
};

async function hashFile(p) {
  return createHash("sha256").update(await fs.readFile(p)).digest("hex");
}

function optionsHash(opts, charset) {
  return createHash("sha256")
    .update(JSON.stringify(opts) + charset)
    .digest("hex")
    .slice(0, 16);
}

async function readCache() {
  try {
    return JSON.parse(await fs.readFile(CACHE_FILE, "utf8"));
  } catch {
    return {};
  }
}

async function writeCache(data) {
  await fs.writeFile(CACHE_FILE, JSON.stringify(data, null, 2) + "\n");
}

async function removeStaleOutputs(name) {
  const entries = await fs.readdir(OUTPUT_DIR).catch(() => []);
  await Promise.all(
    entries
      .filter((e) => e.startsWith(name + ".") && (e.endsWith(".fnt") || e.endsWith(".png")))
      .map((e) => fs.rm(path.join(OUTPUT_DIR, e), { force: true })),
  );
}

async function buildOne({ src, name }, charset, commonOpts, cache) {
  const srcPath = path.join(SOURCE_DIR, src);
  const srcHash = await hashFile(srcPath);
  const optHash = optionsHash(commonOpts, charset);
  const prev = cache[name];
  if (prev?.srcHash === srcHash && prev?.optHash === optHash) {
    // Sanity-check: if the cached hash matches but the output files are
    // missing (someone deleted public/fonts/), fall through and regenerate.
    try {
      await fs.access(path.join(OUTPUT_DIR, `${name}.fnt`));
      console.log(`[build-msdf-font] cache hit — ${name} (skip)`);
      return;
    } catch {
      // fall through to regenerate
    }
  }

  console.log(`[build-msdf-font] generating ${name} (${charset.length} glyphs) from ${src}`);
  await removeStaleOutputs(name);

  const outputBase = path.join(OUTPUT_DIR, name);
  const t0 = Date.now();

  await new Promise((resolve, reject) => {
    generateBMFont(
      srcPath,
      { ...commonOpts, filename: outputBase, charset },
      async (err, textures, font) => {
        if (err) return reject(err);
        try {
          for (const tex of textures) {
            const pngPath = tex.filename.endsWith(".png") ? tex.filename : `${tex.filename}.png`;
            await fs.writeFile(pngPath, tex.texture);
          }
          const fntPath = font.filename.endsWith(".fnt") ? font.filename : `${font.filename}.fnt`;
          await fs.writeFile(fntPath, font.data);
          resolve();
        } catch (e) {
          reject(e);
        }
      },
    );
  });

  cache[name] = {
    srcHash,
    optHash,
    generatedAt: new Date().toISOString(),
  };
  console.log(`[build-msdf-font] ${name} done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const charset = buildCharset();
  console.log(`[build-msdf-font] charset: ${charset.length} glyphs (ASCII + Latin-1 + Hangul)`);
  const cache = await readCache();
  for (const font of FONTS) {
    await buildOne(font, charset, BMFONT_OPTS, cache);
  }
  await writeCache(cache);
  console.log("[build-msdf-font] all done ✓");
}

main().catch((err) => {
  console.error("[build-msdf-font] FAIL:", err?.stack ?? err);
  process.exit(1);
});
