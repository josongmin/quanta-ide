import type { FileFacts } from "@quanta/app-ide/entities/file";

export function IncidentsPane({ file }: { file: FileFacts }) {
  if (file.incidents.length === 0) {
    return <div className="empty-pane">No matched incidents.</div>;
  }

  return (
    <div className="incidents-pane">
      <div className="incidents-pane__head">
        <div className="incidents-pane__kicker">Incident DNA</div>
        <div className="incidents-pane__sub">
          patterns in this file that match prior incidents
        </div>
      </div>
      <ul className="incident-list">
        {file.incidents.map((inc) => (
          <li key={inc.id} className={`incident incident--${inc.patternKind}`}>
            <div className="incident__head">
              <span className={`incident__kind incident__kind--${inc.patternKind}`}>
                {inc.patternKind}
              </span>
              <span className="incident__id">{inc.id}</span>
              <span className="incident__date">{inc.date}</span>
              <span className="incident__conf" title="match confidence">
                {Math.round(inc.confidence * 100)}%
              </span>
            </div>
            <div className="incident__title">{inc.title}</div>
            <div className="incident__detail">{inc.matchDetail}</div>
            {inc.postmortemUrl && (
              <a className="incident__link" href={`#${inc.postmortemUrl}`}>
                postmortem →
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
