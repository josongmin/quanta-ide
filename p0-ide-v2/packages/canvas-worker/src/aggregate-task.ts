import type { WorkspaceGraph, LodAggregateCache } from "@quanta/canvas-engine";

export function runAggregateTask(graph: WorkspaceGraph): LodAggregateCache {
  const commentsByFunction = new Map<string, number>();
  const commentsByFile = new Map<string, number>();
  const commentedLines = new Map<string, Set<number>>();

  for (const comment of graph.comments) {
    if (comment.resolved) continue;

    // commentsByFile
    commentsByFile.set(comment.fileId, (commentsByFile.get(comment.fileId) ?? 0) + 1);

    // commentedLines
    let lineSet = commentedLines.get(comment.fileId);
    if (!lineSet) {
      lineSet = new Set();
      commentedLines.set(comment.fileId, lineSet);
    }
    lineSet.add(comment.line);

    // commentsByFunction: find which function this line belongs to
    const file = graph.files.find(f => f.id === comment.fileId);
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
