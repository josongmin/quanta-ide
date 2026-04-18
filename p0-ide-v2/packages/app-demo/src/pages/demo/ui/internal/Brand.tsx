export function Brand({ size = "md" }: { size?: "sm" | "md" }) {
  return (
    <div className="demo-brand" style={size === "sm" ? { marginBottom: 0 } : undefined}>
      <span className="demo-brand__glyph" aria-hidden>q</span>
      <span className="demo-brand__name">Quanta</span>
    </div>
  );
}
