// PNG snapshot export
// --------------------------------------------------------------------
// Capture the current Pixi canvas as a PNG and trigger a download.
// Uses the canvas's `toBlob` API rather than Pixi's own
// `renderer.extract` because we want exactly what's on screen
// (including the radial-gradient background painted via CSS) — the
// Pixi extract path would only include GL-rendered layers and miss
// the background entirely.
//
// File name: `code-universe-<tier>-<YYYYMMDD-HHMMSS>.png` so a day
// of zoom-explore generates a sortable, self-describing capture
// folder without extra metadata prompting.

export interface ExportSnapshotOpts {
  canvas: HTMLCanvasElement;
  /** Optional prefix to include the active tier name in the file. */
  tier?: string;
}

export async function exportSnapshot(opts: ExportSnapshotOpts): Promise<void> {
  const { canvas } = opts;
  const blob: Blob | null = await new Promise(resolve => {
    canvas.toBlob(b => resolve(b), "image/png");
  });
  if (!blob) {
    console.warn("[code-universe] snapshot capture failed — toBlob returned null");
    return;
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = buildFileName(opts.tier);
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Revoke after a tick so the browser's download pipeline has time
  // to read the blob. Skipping this leaks the object URL for the
  // lifetime of the tab.
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

function buildFileName(tier: string | undefined): string {
  const now = new Date();
  const pad = (n: number): string => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const tierBit = tier ? `-${tier}` : "";
  return `code-universe${tierBit}-${stamp}.png`;
}
