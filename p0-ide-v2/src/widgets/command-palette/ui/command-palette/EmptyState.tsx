export function EmptyState({ query }: { query: string }) {
  return (
    <div className="cp__empty">
      <div className="cp__empty-mark" aria-hidden>
        ⌁
      </div>
      <div className="cp__empty-title">
        {query ? `No commands match "${query}"` : "Start typing"}
      </div>
      <div className="cp__empty-hints">
        <span>try:</span>
        <kbd>agent rules</kbd>
        <kbd>flow</kbd>
        <kbd>dev console</kbd>
        <kbd>compliance</kbd>
      </div>
    </div>
  );
}
