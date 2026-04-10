export interface CommentAuthor {
  id: string;
  name: string;
}

export interface Comment {
  id: string;
  author: CommentAuthor;
  body: string;
  createdAt: string; // ISO 8601
  parentId: string | null; // null = root, string = reply
}

/** Half-open [start, end): columns are UTF-16 offsets within each line’s `.ide-editor-code` text. */
export interface CodeRange {
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
}

export interface CommentThread {
  id: string;
  range: CodeRange;
  comments: Comment[];
  resolved: boolean;
}
