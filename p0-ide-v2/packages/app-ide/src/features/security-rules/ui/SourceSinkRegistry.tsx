import type { RegistryEntry, RegistryEntryKind } from "@quanta/app-ide/entities/security-rules";
import { cn } from "@quanta/ui-kit/lib";

const KIND_ORDER: RegistryEntryKind[] = ["source", "sink", "sanitizer", "guard"];

const KIND_LABELS: Record<RegistryEntryKind, string> = {
  source: "Sources",
  sink: "Sinks",
  sanitizer: "Sanitizers",
  guard: "Guards",
};

const KIND_DESCRIPTIONS: Record<RegistryEntryKind, string> = {
  source: "Where tainted data enters the system",
  sink: "Dangerous destinations for tainted data",
  sanitizer: "Functions that neutralise tainted data",
  guard: "Authorisation and validation checks",
};

function EntryRow({ entry }: { entry: RegistryEntry }) {
  return (
    <div className="sr-reg-row">
      <div className="sr-reg-row__head">
        <span className={cn("sr-reg-row__tag", `sr-reg-row__tag--${entry.kind}`)}>
          {entry.tag}
        </span>
        <span className="sr-reg-row__label">{entry.label}</span>
      </div>
      <div className="sr-reg-row__pattern">
        <code>{entry.pattern}</code>
      </div>
      <div className="sr-reg-row__desc">{entry.description}</div>
    </div>
  );
}

interface Props {
  entries: RegistryEntry[];
}

export function SourceSinkRegistry({ entries }: Props) {
  return (
    <div className="sr-registry">
      {KIND_ORDER.map((kind) => {
        const items = entries.filter((e) => e.kind === kind);
        if (items.length === 0) return null;
        return (
          <section key={kind} className="sr-registry__section">
            <div className="sr-registry__section-head">
              <h3 className={cn("sr-registry__section-title", `sr-registry__section-title--${kind}`)}>
                {KIND_LABELS[kind]}
              </h3>
              <span className="sr-registry__section-count">{items.length}</span>
              <span className="sr-registry__section-desc">{KIND_DESCRIPTIONS[kind]}</span>
            </div>
            <div className="sr-registry__rows">
              {items.map((entry) => (
                <EntryRow key={entry.id} entry={entry} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
