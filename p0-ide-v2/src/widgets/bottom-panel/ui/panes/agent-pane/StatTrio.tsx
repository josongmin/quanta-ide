export function StatTrio({
  k,
  v,
  tone = "default",
}: {
  k: string;
  v: string;
  tone?: "default" | "good" | "warn" | "danger";
}) {
  return (
    <div className={`agst-st agst-st--${tone}`}>
      <span className="agst-st__v">{v}</span>
      <span className="agst-st__k">{k}</span>
    </div>
  );
}
