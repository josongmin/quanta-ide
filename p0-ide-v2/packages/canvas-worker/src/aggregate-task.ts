import type { WorkspaceGraph, LodAggregateCache } from "@quanta/canvas-engine";

export function runAggregateTask(graph: WorkspaceGraph): LodAggregateCache {
  const commentsByFunction = new Map<string, number>();
  const commentsByFile = new Map<string, number>();
  const commentedLines = new Map<string, Set<number>>();

  // Index files by id so the function-bucket lookup is O(1) per comment.
  // Prior code ran graph.files.find(...) per comment → O(C × F) = 1.5M ops
  // at 5k files / 300 comments.
  const fileById = new Map<string, WorkspaceGraph["files"][number]>();
  for (const f of graph.files) fileById.set(f.id, f);

  for (const comment of graph.comments) {
    if (comment.resolved) continue;

    commentsByFile.set(comment.fileId, (commentsByFile.get(comment.fileId) ?? 0) + 1);

    let lineSet = commentedLines.get(comment.fileId);
    if (!lineSet) {
      lineSet = new Set();
      commentedLines.set(comment.fileId, lineSet);
    }
    lineSet.add(comment.line);

    const file = fileById.get(comment.fileId);
    if (file) {
      for (const fn of file.functions) {
        if (comment.line >= fn.startLine && comment.line <= fn.endLine) {
          const key = `${comment.fileId}:${fn.name}`;
          commentsByFunction.set(key, (commentsByFunction.get(key) ?? 0) + 1);
          break;
        }
      }
    }
  }

  return { commentsByFunction, commentsByFile, commentedLines };
}
