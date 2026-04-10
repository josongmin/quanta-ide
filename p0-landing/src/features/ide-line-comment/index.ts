export { useLineComment } from "./model/useLineComment";
export type { Comment, CommentThread, CommentAuthor, CodeRange } from "./model/types";
export { selectionToCodeRange, fullLineRangeFromDom, formatRangeLabel } from "./model/rangeFromSelection";
export { CommentThread as CommentThreadUI } from "./ui/CommentThread";
import "./styles/ide-line-comment.css";
