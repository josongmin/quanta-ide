import { useSyncExternalStore } from "react";

// Editor-target store
// --------------------------------------------------------------------
// Which file (if any) currently has the single edit-overlay open.
//
// Design is deliberately small: one id or null, no draft buffer here
// (draft lives inside the SourceCard while mounted), no stack / no
// multi-target. The canvas philosophy moved from "every visible card
// shows code" to "the canvas is a structural map; one file opens as
// an overlay when you want to read/edit it". This store is that seam.

let activeFileId: string | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of [...listeners]) l();
}

export function openEditor(fileId: string): void {
  if (activeFileId === fileId) return;
  activeFileId = fileId;
  emit();
}

export function closeEditor(): void {
  if (activeFileId === null) return;
  activeFileId = null;
  emit();
}

export function getEditorTarget(): string | null {
  return activeFileId;
}

export function useEditorTarget(): string | null {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    getEditorTarget,
    getEditorTarget,
  );
}
