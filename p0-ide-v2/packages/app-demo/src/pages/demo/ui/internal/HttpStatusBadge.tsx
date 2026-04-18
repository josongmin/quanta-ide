interface HttpStatusBadgeProps {
  code: number;
}

export function HttpStatusBadge({ code }: HttpStatusBadgeProps) {
  if (code >= 500) return <span className="demo-badge demo-badge--danger">{code}</span>;
  if (code === 401 || code === 403 || code === 429) {
    return <span className="demo-badge demo-badge--warn">{code}</span>;
  }
  if (code >= 400) return <span className="demo-badge demo-badge--warn">{code}</span>;
  return <span className="demo-badge demo-badge--success">{code}</span>;
}
