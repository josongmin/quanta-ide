import { todos } from "./agent-pane.mock";
import { LogButton } from "./LogButton";

export function TodoPanel({ onOpenLog }: { onOpenLog: () => void }) {
  const pending = todos.filter((t) => t.state === "pending").length;
  const doing   = todos.filter((t) => t.state === "doing").length;
  const done    = todos.filter((t) => t.state === "done").length;
  return (
    <section className="agst-col agst-col--todo">
      <div className="agst-col__h">
        <span className="agst-col__label">Todo</span>
        <span className="agst-col__count">{todos.length}</span>
        <span className="agst-col__right">
          {doing} doing · {pending} pending · {done} done
        </span>
        <LogButton label="Todo" onClick={onOpenLog} />
      </div>
      <ul className="agst-todo">
        {todos.map((t, i) => (
          <li key={i} className={`agst-todo__row agst-todo__row--${t.state}`}>
            <span className="agst-todo__glyph" aria-hidden>
              {t.state === "done" ? "✓" : t.state === "doing" ? "●" : "○"}
            </span>
            <span className="agst-todo__content">{t.content}</span>
            {t.source && <span className="agst-todo__src">{t.source}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
