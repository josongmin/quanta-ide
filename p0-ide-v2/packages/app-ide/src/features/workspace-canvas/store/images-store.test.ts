import { describe, it, expect, beforeEach } from "vitest";
import { imagesStore, IMAGE_MAX_COUNT, approxDataUrlBytes } from "./images-store";

const TINY_DATA_URL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

function makeFakeLargeDataUrl(approxBytes: number): string {
  // Each base64 char ~ 0.75 bytes; padding to exceed the cap.
  const neededChars = Math.ceil((approxBytes * 4) / 3) + 16;
  return "data:image/png;base64," + "A".repeat(neededChars);
}

describe("images-store", () => {
  beforeEach(() => {
    imagesStore.reset();
  });

  it("tryAdd stores an image and reports ok", () => {
    const r = imagesStore.tryAdd({ x: 10, y: 20, w: 100, h: 80, dataUrl: TINY_DATA_URL });
    expect(r.ok).toBe(true);
    const s = imagesStore.getState();
    expect(s.images.length).toBe(1);
    expect(s.activeId).toBe(s.images[0]!.id);
  });

  it("tryAdd rejects over-1MB payloads with too-large", () => {
    const r = imagesStore.tryAdd({
      x: 0, y: 0, w: 10, h: 10,
      dataUrl: makeFakeLargeDataUrl(2 * 1024 * 1024),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("too-large");
    expect(imagesStore.getState().images.length).toBe(0);
  });

  it("tryAdd enforces IMAGE_MAX_COUNT", () => {
    for (let i = 0; i < IMAGE_MAX_COUNT; i++) {
      const r = imagesStore.tryAdd({ x: 0, y: 0, w: 10, h: 10, dataUrl: TINY_DATA_URL });
      expect(r.ok).toBe(true);
    }
    const overflow = imagesStore.tryAdd({ x: 0, y: 0, w: 10, h: 10, dataUrl: TINY_DATA_URL });
    expect(overflow.ok).toBe(false);
    if (!overflow.ok) expect(overflow.reason).toBe("too-many");
  });

  it("update respects locked; toggleLocked flips flag", () => {
    const r = imagesStore.tryAdd({ x: 0, y: 0, w: 100, h: 100, dataUrl: TINY_DATA_URL });
    if (!r.ok || !r.id) throw new Error("add should succeed");
    const id = r.id;
    imagesStore.toggleLocked(id);
    imagesStore.setPosition(id, 50, 50);
    const locked = imagesStore.getState().images.find(i => i.id === id);
    expect(locked?.locked).toBe(true);
    expect(locked?.x).toBe(0);
    expect(locked?.y).toBe(0);
    imagesStore.setCaption(id, "hi"); // caption is not position/size — should apply
    expect(imagesStore.getState().images.find(i => i.id === id)?.caption).toBe("hi");
  });

  it("setSize enforces 40px minimum", () => {
    const r = imagesStore.tryAdd({ x: 0, y: 0, w: 100, h: 100, dataUrl: TINY_DATA_URL });
    if (!r.ok || !r.id) throw new Error("add should succeed");
    imagesStore.setSize(r.id, 10, 10);
    const img = imagesStore.getState().images.find(i => i.id === r.id);
    expect(img?.w).toBe(40);
    expect(img?.h).toBe(40);
  });

  it("remove clears activeId when removing the active image", () => {
    const r = imagesStore.tryAdd({ x: 0, y: 0, w: 10, h: 10, dataUrl: TINY_DATA_URL });
    if (!r.ok || !r.id) throw new Error("add should succeed");
    imagesStore.remove(r.id);
    expect(imagesStore.getState().activeId).toBeNull();
    expect(imagesStore.getState().images.length).toBe(0);
  });

  it("approxDataUrlBytes approximates payload size", () => {
    const bytes = approxDataUrlBytes("data:image/png;base64,AAAA");
    expect(bytes).toBe(3);
  });
});
