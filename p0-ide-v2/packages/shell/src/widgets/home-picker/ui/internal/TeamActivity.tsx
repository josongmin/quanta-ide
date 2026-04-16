import { teamActivityItems, type ActivityAction } from "../../lib/home-picker.mock";

const ACTION_VERB: Record<ActivityAction, string> = {
  merged: "merged",
  opened: "opened",
  commented: "commented on",
  deployed: "deployed",
  pushed: "pushed",
  resolved: "resolved",
};

const ACTION_CLS: Record<ActivityAction, string> = {
  merged: "hp__feed-action--merged",
  opened: "hp__feed-action--opened",
  commented: "",
  deployed: "hp__feed-action--deployed",
  pushed: "",
  resolved: "hp__feed-action--resolved",
};

export function TeamActivity() {
  return (
    <section className="hp__panel hp__panel--feed">
      <div className="hp__panel-head">
        <span className="hp__panel-label">Team activity</span>
      </div>
      <ul className="hp__feed-list">
        {teamActivityItems.map((item) => (
          <li key={item.id} className="hp__feed-item">
            <span className="hp__feed-avatar" aria-hidden>{item.authorInitial}</span>
            <span className="hp__feed-body">
              <span className="hp__feed-text">
                <strong className="hp__feed-author">{item.author}</strong>
                {" "}
                <span className={`hp__feed-action ${ACTION_CLS[item.action]}`}>{ACTION_VERB[item.action]}</span>
                {" "}
                <span className="hp__feed-target">{item.target}</span>
              </span>
              <span className="hp__feed-meta">
                <span>{item.repo}</span>
                <span className="hp__attn-sep" aria-hidden>&middot;</span>
                <span>{item.time}</span>
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
