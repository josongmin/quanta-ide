import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Fresh store per test.
// ---------------------------------------------------------------------------

async function freshStore() {
  const mod = await import("../toast-store/toast-store");
  return { toastStore: mod.toastStore, toast: mod.toast };
}

describe("toastStore", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("push adds a toast and returns its id", async () => {
    const { toastStore } = await freshStore();
    const id = toastStore.push({ kind: "info", title: "Hello" });
    expect(typeof id).toBe("string");
    expect(toastStore.get().toasts).toHaveLength(1);
    expect(toastStore.get().toasts[0].title).toBe("Hello");
    expect(toastStore.get().toasts[0].id).toBe(id);
  });

  it("dismiss removes a toast by id", async () => {
    const { toastStore } = await freshStore();
    const id = toastStore.push({ kind: "success", title: "OK", ttlMs: 0 });
    expect(toastStore.get().toasts).toHaveLength(1);
    toastStore.dismiss(id);
    expect(toastStore.get().toasts).toHaveLength(0);
  });

  it("get returns current toasts", async () => {
    const { toastStore } = await freshStore();
    expect(toastStore.get().toasts).toEqual([]);
    toastStore.push({ kind: "warn", title: "A", ttlMs: 0 });
    toastStore.push({ kind: "danger", title: "B", ttlMs: 0 });
    expect(toastStore.get().toasts).toHaveLength(2);
    expect(toastStore.get().toasts.map((t) => t.title)).toEqual(["A", "B"]);
  });

  it("subscribe notifies on push and dismiss", async () => {
    const { toastStore } = await freshStore();
    const listener = vi.fn();
    toastStore.subscribe(listener);

    const id = toastStore.push({ kind: "info", title: "X", ttlMs: 0 });
    expect(listener).toHaveBeenCalledTimes(1);

    toastStore.dismiss(id);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("auto-dismisses after ttlMs (default 4000)", async () => {
    const { toastStore } = await freshStore();
    toastStore.push({ kind: "info", title: "Auto" });
    expect(toastStore.get().toasts).toHaveLength(1);

    vi.advanceTimersByTime(3999);
    expect(toastStore.get().toasts).toHaveLength(1);

    vi.advanceTimersByTime(1);
    expect(toastStore.get().toasts).toHaveLength(0);
  });

  it("clear removes all toasts at once", async () => {
    const { toastStore } = await freshStore();
    toastStore.push({ kind: "info", title: "A", ttlMs: 0 });
    toastStore.push({ kind: "warn", title: "B", ttlMs: 0 });
    expect(toastStore.get().toasts).toHaveLength(2);

    toastStore.clear();
    expect(toastStore.get().toasts).toHaveLength(0);
  });

  it("convenience wrappers (toast.info / success / warn / danger) work", async () => {
    const { toastStore, toast } = await freshStore();

    toast.info("i");
    toast.success("s");
    toast.warn("w");
    toast.danger("d");

    const toasts = toastStore.get().toasts;
    expect(toasts).toHaveLength(4);
    expect(toasts.map((t) => t.kind)).toEqual(["info", "success", "warn", "danger"]);
  });
});
