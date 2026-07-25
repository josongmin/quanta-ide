import { useMemo, useState } from "react";
import type { FileFacts } from "@quanta/app-ide/entities/file";
import { getAuthzMap, type AuthzGuard, type AuthzRoute, type GuardKind } from "@quanta/app-ide/entities/authz-map";
import { focusStore } from "@quanta/app-ide/stores/focus-store";

const REQUIRED_BY_ACTION: Record<AuthzRoute["action"], GuardKind[]> = {
  read: ["auth", "tenant"],
  write: ["auth", "tenant", "permission"],
  admin: ["auth", "role", "rate-limit"],
  destructive: ["auth", "role", "rate-limit"],
};

const KIND_ORDER: GuardKind[] = ["auth", "role", "permission", "tenant", "rate-limit"];
const KIND_LABEL: Record<GuardKind, string> = {
  auth: "Auth",
  role: "Role",
  permission: "Perm",
  tenant: "Tenant",
  "rate-limit": "Rate",
};

type Status = "guarded" | "missing" | "unused";

export function AuthzPane({ file }: { file: FileFacts }) {
  const map = useMemo(() => getAuthzMap(file.name), [file.name]);
  const [activeId, setActiveId] = useState(map.routes[0]?.id);
  const [showOnlyGaps, setShowOnlyGaps] = useState(false);

  const visible = useMemo(
    () => (showOnlyGaps ? map.routes.filter((r) => r.gaps.length > 0) : map.routes),
    [map.routes, showOnlyGaps],
  );

  const totalGaps = map.routes.reduce((s, r) => s + r.gaps.length, 0);
  const guarded = map.routes.length - map.routes.filter((r) => r.gaps.length > 0).length;

  return (
    <div className="authz-pane">
      <div className="authz-head">
        <div className="authz-head__stat">
          <div className="authz-head__stat-v">{map.routes.length}</div>
          <div className="authz-head__stat-k">routes</div>
        </div>
        <div className="authz-head__stat">
          <div className="authz-head__stat-v authz-head__stat-v--ok">{guarded}</div>
          <div className="authz-head__stat-k">guarded</div>
        </div>
        <div className="authz-head__stat">
          <div className="authz-head__stat-v authz-head__stat-v--bad">{totalGaps}</div>
          <div className="authz-head__stat-k">gaps</div>
        </div>
        <label className="authz-head__filter">
          <input
            type="checkbox"
            checked={showOnlyGaps}
            onChange={(e) => setShowOnlyGaps(e.currentTarget.checked)}
          />
          <span>only gaps</span>
        </label>
      </div>

      <div className="authz-matrix" role="table" aria-label="Route × guard kind matrix">
        <div className="authz-matrix__head" role="row">
          <div role="columnheader" className="authz-matrix__corner">route</div>
          {KIND_ORDER.map((k) => (
            <div key={k} role="columnheader" className="authz-matrix__col-h">
              {KIND_LABEL[k]}
            </div>
          ))}
        </div>
        {visible.map((r) => {
          const required = new Set(REQUIRED_BY_ACTION[r.action]);
          const present = new Set(r.guards.map((g) => g.kind));
          const isActive = r.id === activeId;
          return (
            <button
              key={r.id}
              type="button"
              role="row"
              className={`authz-matrix__row authz-matrix__row--${r.action}${isActive ? " is-active" : ""}`}
              onClick={() => setActiveId(r.id)}
            >
              <div role="cell" className="authz-matrix__route">
                <span className={`authz-matrix__method authz-matrix__method--${r.method.toLowerCase()}`}>{r.method}</span>
                <span className="authz-matrix__path">{r.path}</span>
              </div>
              {KIND_ORDER.map((k) => {
                const status: Status = present.has(k) ? "guarded" : required.has(k) ? "missing" : "unused";
                return (
                  <div key={k} role="cell" className={`authz-matrix__cell authz-matrix__cell--${status}`} title={status}>
                    {status === "guarded" && <span className="authz-matrix__check">✓</span>}
                    {status === "missing" && <span className="authz-matrix__x">×</span>}
                  </div>
                );
              })}
            </button>
          );
        })}
      </div>

      {map.routes.find((r) => r.id === activeId) && (
        <RouteDetail route={map.routes.find((r) => r.id === activeId)!} />
      )}
    </div>
  );
}

function RouteDetail({ route }: { route: AuthzRoute }) {
  return (
    <section className="authz-detail">
      <div className="authz-detail__h">
        <h3 className="authz-detail__title">
          <span className={`authz-detail__method authz-detail__method--${route.method.toLowerCase()}`}>{route.method}</span>
          <code className="authz-detail__path">{route.path}</code>
        </h3>
        <p className="authz-detail__handler">
          <button type="button" className="authz-detail__handler-btn" onClick={() => focusStore.jumpTo(route.handlerLine)}>
            {route.handler}
            <span className="authz-detail__handler-loc">{route.handlerFile}:{route.handlerLine}</span>
          </button>
        </p>
      </div>

      <div className="authz-detail__cols">
        <div className="authz-detail__col">
          <h4 className="authz-detail__sub">Guards</h4>
          {route.guards.length === 0 && (
            <p className="authz-detail__empty">no guards wrapped — public route</p>
          )}
          <ul className="authz-guards">
            {route.guards.map((g, i) => (
              <GuardRow key={i} guard={g} />
            ))}
          </ul>
        </div>
        <div className="authz-detail__col">
          <h4 className="authz-detail__sub">Findings</h4>
          {route.gaps.length === 0 && (
            <p className="authz-detail__empty authz-detail__empty--ok">no gaps detected</p>
          )}
          <ul className="authz-gaps">
            {route.gaps.map((g, i) => (
              <li key={i} className="authz-gap">
                <div className="authz-gap__head">
                  <span className="authz-gap__expected">missing {KIND_LABEL[g.expected]}</span>
                  {g.cwe && <span className="authz-gap__cwe">{g.cwe}</span>}
                </div>
                <div className="authz-gap__reason">{g.reason}</div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function GuardRow({ guard }: { guard: AuthzGuard }) {
  return (
    <li className={`authz-guard authz-guard--${guard.kind}`}>
      <span className="authz-guard__kind">{KIND_LABEL[guard.kind]}</span>
      <button type="button" className="authz-guard__sym" onClick={() => focusStore.jumpTo(guard.line)}>
        {guard.symbol}
      </button>
      <code className="authz-guard__pred">{guard.predicate}</code>
    </li>
  );
}
