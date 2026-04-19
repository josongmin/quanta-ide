import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { inlineEditorStore, resolveDocForFile } from "./inline-editor-store";

describe("inline-editor-store", () => {
  beforeEach(() => {
    inlineEditorStore.discardAllDrafts();
    inlineEditorStore.endEdit();
    inlineEditorStore.closeAiPrompt();
    inlineEditorStore.clearCommitSignal();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("beginEdit seeds a draft only when none exists", () => {
    inlineEditorStore.beginEdit("f1", "source-1");
    expect(inlineEditorStore.getState().editingFileId).toBe("f1");
    expect(inlineEditorStore.getState().draftByFileId["f1"]).toBe("source-1");
    inlineEditorStore.endEdit();
    // Simulate a prior typing session — seed again with different initial.
    inlineEditorStore.setDraft("f1", "user-typed");
    inlineEditorStore.endEdit();
    inlineEditorStore.beginEdit("f1", "source-2");
    expect(inlineEditorStore.getState().draftByFileId["f1"]).toBe("user-typed");
  });

  it("setDraft marks dirty and is a no-op for unchanged text", () => {
    vi.useFakeTimers();
    inlineEditorStore.beginEdit("f1", "hello");
    inlineEditorStore.setDraft("f1", "hello world");
    expect(inlineEditorStore.getState().dirtyByFileId["f1"]).toBe(true);
    let ticks = 0;
    const unsub = inlineEditorStore.subscribe(() => { ticks += 1; });
    inlineEditorStore.setDraft("f1", "hello world");
    expect(ticks).toBe(0);
    unsub();
    vi.runAllTimers();
  });

  it("commitDraft clears dirty and fires lastCommit; no-op without draft", () => {
    inlineEditorStore.commitDraft("ghost");
    expect(inlineEditorStore.getState().lastCommit).toBeNull();

    inlineEditorStore.beginEdit("f1", "src");
    inlineEditorStore.setDraft("f1", "src+1");
    inlineEditorStore.commitDraft("f1");
    const s = inlineEditorStore.getState();
    expect(s.dirtyByFileId["f1"]).toBe(false);
    expect(s.lastCommit?.fileId).toBe("f1");
    inlineEditorStore.clearCommitSignal();
    expect(inlineEditorStore.getState().lastCommit).toBeNull();
  });

  it("discardDraft removes draft + dirty entries", () => {
    inlineEditorStore.beginEdit("f1", "hi");
    inlineEditorStore.setDraft("f1", "hi2");
    inlineEditorStore.discardDraft("f1");
    const s = inlineEditorStore.getState();
    expect(s.draftByFileId["f1"]).toBeUndefined();
    expect(s.dirtyByFileId["f1"]).toBeUndefined();
  });

  it("AI prompt lifecycle — open, stream, append, ready", () => {
    inlineEditorStore.openAiPrompt("f1", { screenX: 10, screenY: 20, selFrom: 0, selTo: 3 });
    expect(inlineEditorStore.getState().ai.status).toBe("prompting");
    inlineEditorStore.setAiPrompt("rename x to y");
    inlineEditorStore.aiStreamStart();
    expect(inlineEditorStore.getState().ai.status).toBe("streaming");
    inlineEditorStore.aiStreamAppend("const ");
    inlineEditorStore.aiStreamAppend("y = 1;");
    expect(inlineEditorStore.getState().ai.suggestion).toBe("const y = 1;");
    inlineEditorStore.aiStreamReady();
    expect(inlineEditorStore.getState().ai.status).toBe("ready");
    inlineEditorStore.closeAiPrompt();
    expect(inlineEditorStore.getState().ai.fileId).toBeNull();
  });

  it("resolveDocForFile falls back to source when no draft exists", () => {
    expect(resolveDocForFile("missing", "fallback")).toBe("fallback");
    inlineEditorStore.beginEdit("f1", "src");
    inlineEditorStore.setDraft("f1", "draft-text");
    expect(resolveDocForFile("f1", "fallback")).toBe("draft-text");
  });
});
