import { useState } from "react";
import { Section, Sub } from "@/shared/ui/section";
import { riskBarStyle, riskColor } from "@/shared/lib/risk";
import {
  IconArrowIn,
  IconArrowOut,
  IconTaint,
  IconNoTests,
  IconComplexity,
  IconDead,
  Sparkline,
} from "@/shared/ui/icons";

type FolderTab =
  | "overview"
  | "structure"
  | "duplication"
  | "blast"
  | "incidents"
  | "ownership";

interface FolderFile { name: string; risk: number; loc: number; issues: number; }
interface FolderSub { name: string; files: number; risk: number; }
interface ArchViolation { kind: "layer" | "cycle" | "forbidden"; rule: string; detail: string; sev: 1 | 2 | 3; }
interface CycleEdge { from: string; to: string; via: string; }
interface CloneCluster { id: string; size: number; locs: number; sites: string[]; sim: number; }
interface BoundaryExport { name: string; kind: "fn" | "class" | "const"; usedBy: number; tag?: "unused" | "internal-only"; }
interface DepEdge { folder: string; weight: number; allowed: boolean; }
interface BlastCorridor { symbol: string; outFiles: number; outFolders: number; risk: number; }
interface IncidentMatch { id: string; date: string; pattern: string; matches: number; severity: 1 | 2 | 3; }
interface Contributor { name: string; commits: number; share: number; ownsRisk: number; }

const FOLDER_DATA = {
  files: 8,
  subfolders: 2,
  totalLoc: 2_140,
  avgRisk: 41,
  issues: 7,
  coverage: 42,

  // engineering intelligence signature metrics
  archViolations: 4,
  cycles: 1,
  cohesion: 0.38,           // 0..1 (LCOM-derived)
  coupling: 0.71,           // 0..1 (afferent+efferent normalized)
  boundaryExports: 24,
  boundaryUsedExternally: 6,
  duplicationPct: 18,        // % of LoC in clone clusters
  driftPct: 27,              // spec/observed divergence
  hotspotDensity: 0.5,       // |hot ∩ risky| / files
  spark: [32, 35, 38, 40, 42, 44, 46, 49],

  topFiles: [
    { name: "orchestrator.py", risk: 78, loc: 1974, issues: 5 },
    { name: "routing_policy.py", risk: 44, loc: 220, issues: 1 },
    { name: "base.py", risk: 18, loc: 96, issues: 0 },
    { name: "registry.py", risk: 12, loc: 84, issues: 0 },
    { name: "__init__.py", risk: 4, loc: 18, issues: 0 },
  ] as FolderFile[],
  subfoldersList: [
    { name: "tools/", files: 6, risk: 38 },
    { name: "plan_orchestration/", files: 4, risk: 24 },
  ] as FolderSub[],

  signals: [
    { Icon: IconTaint, label: "Boundary leak", detail: "experience_store.save reachable from agents/ without sanitizer", sev: 3 as const },
    { Icon: IconComplexity, label: "Layer break", detail: "domain/ imports infra/storage — should go through ports/", sev: 3 as const },
    { Icon: IconNoTests, label: "Coverage gap", detail: "orchestrator.py 0/12 tests on critical path", sev: 2 as const },
    { Icon: IconDead, label: "Dead surface", detail: "_select_strategy + 3 exports unreferenced", sev: 1 as const },
  ],

  archIssues: [
    { kind: "layer", rule: "domain → infra forbidden", detail: "orchestrator.py:84 imports infra.storage.s3", sev: 3 },
    { kind: "cycle", rule: "import cycle (len 3)", detail: "domain.orchestrator → tools.runner → domain.registry", sev: 3 },
    { kind: "forbidden", rule: "no direct ORM", detail: "routing_policy.py:31 calls Session.execute", sev: 2 },
    { kind: "layer", rule: "public-api leak", detail: "_internal_select exported via __init__.py", sev: 1 },
  ] as ArchViolation[],

  cycleEdges: [
    { from: "domain.orchestrator", to: "tools.runner", via: "execute → run_tool" },
    { from: "tools.runner", to: "domain.registry", via: "run_tool → resolve_strategy" },
    { from: "domain.registry", to: "domain.orchestrator", via: "resolve_strategy → Strategy" },
  ] as CycleEdge[],

  boundary: [
    { name: "Orchestrator", kind: "class", usedBy: 12 },
    { name: "execute", kind: "fn", usedBy: 8 },
    { name: "Strategy", kind: "class", usedBy: 4 },
    { name: "DEFAULT_POLICY", kind: "const", usedBy: 1, tag: "internal-only" },
    { name: "_select_strategy", kind: "fn", usedBy: 0, tag: "unused" },
    { name: "LegacyRouter", kind: "class", usedBy: 0, tag: "unused" },
  ] as BoundaryExport[],

  inbound: [
    { folder: "agents/", weight: 18, allowed: true },
    { folder: "api/", weight: 11, allowed: true },
    { folder: "tools/", weight: 7, allowed: true },
    { folder: "infra/", weight: 2, allowed: false },
  ] as DepEdge[],
  outbound: [
    { folder: "shared/", weight: 14, allowed: true },
    { folder: "ports/", weight: 9, allowed: true },
    { folder: "infra/storage/", weight: 4, allowed: false },
  ] as DepEdge[],

  clones: [
    { id: "cl-1", size: 4, locs: 38, sim: 0.94, sites: ["orchestrator.py:212", "tools/runner.py:88", "agents/exec.py:140", "plan_orchestration/run.py:55"] },
    { id: "cl-2", size: 3, locs: 22, sim: 0.88, sites: ["routing_policy.py:31", "tools/policy.py:14", "agents/router.py:60"] },
    { id: "cl-3", size: 2, locs: 14, sim: 0.81, sites: ["base.py:42", "registry.py:18"] },
  ] as CloneCluster[],

  blastCorridors: [
    { symbol: "Orchestrator.execute", outFiles: 38, outFolders: 6, risk: 78 },
    { symbol: "resolve_strategy",     outFiles: 21, outFolders: 4, risk: 52 },
    { symbol: "Strategy",             outFiles: 14, outFolders: 3, risk: 31 },
  ] as BlastCorridor[],
  blastBoundaryCrossings: 17,

  incidents: [
    { id: "INC-2031", date: "2026-03-22", pattern: "Unvalidated trace persisted to ledger", matches: 3, severity: 3 },
    { id: "INC-1987", date: "2026-02-14", pattern: "Strategy retried after irrecoverable error", matches: 2, severity: 2 },
    { id: "INC-1844", date: "2026-01-09", pattern: "Tool runner swallowed exception", matches: 1, severity: 2 },
  ] as IncidentMatch[],

  busFactor: 1,
  orphanedFiles: 1,
  staleFiles: 2,
  contributors: [
    { name: "@songmin", commits: 142, share: 0.62, ownsRisk: 78 },
    { name: "@carol", commits: 38, share: 0.21, ownsRisk: 22 },
    { name: "@devops-bot", commits: 24, share: 0.13, ownsRisk: 8 },
  ] as Contributor[],
};

const TABS: { id: FolderTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "structure", label: "Structure" },
  { id: "duplication", label: "Duplication" },
  { id: "blast", label: "Blast" },
  { id: "incidents", label: "Incidents" },
  { id: "ownership", label: "Ownership" },
];

const SEV_CLASS: Record<1 | 2 | 3, string> = { 3: "is-crit", 2: "is-warn", 1: "is-info" };

export function FolderInspectorView({ name }: { name: string }) {
  const d = FOLDER_DATA;
  const [tab, setTab] = useState<FolderTab>("overview");

  const tabCounts: Partial<Record<FolderTab, number>> = {
    structure: d.archViolations,
    duplication: d.clones.length,
    blast: d.blastCorridors.length,
    incidents: d.incidents.length,
    ownership: d.contributors.length,
  };

  return (
    <>
      <nav className="insp__modes" role="tablist" aria-label="Folder inspector tabs">
        {TABS.map((t) => {
          const active = t.id === tab;
          const count = tabCounts[t.id];
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              className={`insp__mode${active ? " is-active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              <span>{t.label}</span>
              {count !== undefined && count > 0 && (
                <span className="insp__mode-count">{count}</span>
              )}
            </button>
          );
        })}
      </nav>

      {tab === "overview" && <OverviewPane name={name} d={d} />}
      {tab === "structure" && <StructurePane d={d} />}
      {tab === "duplication" && <DuplicationPane d={d} />}
      {tab === "blast" && <BlastPane d={d} />}
      {tab === "incidents" && <IncidentsPane d={d} />}
      {tab === "ownership" && <OwnershipPane d={d} />}
    </>
  );
}

/* ───────────────────────── Overview ───────────────────────── */

function OverviewPane({ name, d }: { name: string; d: typeof FOLDER_DATA }) {
  const archCol = d.archViolations > 0 ? "danger" : "default";
  const exposureExcess = d.boundaryExports - d.boundaryUsedExternally;

  return (
    <>
      <div className="insp__hero insp__hero--folder">
        <div className="hero__name" title={name}>{name}/</div>

        <div className="hero__stats hero__stats--scale">
          <div className="hero__stat">
            <span className="hero__stat-head">
              <span className="hero__stat-glyph">▾</span>
              <span className="hero__stat-val">{d.files}</span>
            </span>
            <span className="hero__stat-key">files</span>
          </div>
          <div className="hero__stat">
            <span className="hero__stat-head">
              <span className="hero__stat-glyph">▣</span>
              <span className="hero__stat-val">{d.subfolders}</span>
            </span>
            <span className="hero__stat-key">subfolders</span>
          </div>
          <div className="hero__stat">
            <span className="hero__stat-head">
              <span className="hero__stat-glyph">☰</span>
              <span className="hero__stat-val">{d.totalLoc.toLocaleString()}</span>
            </span>
            <span className="hero__stat-key">lines</span>
          </div>
        </div>

        <div className="substats substats--3">
          <Sub k="Avg risk" v={String(d.avgRisk)} tone={d.avgRisk >= 60 ? "danger" : d.avgRisk >= 40 ? "warn" : "default"} />
          <Sub k="Issues" v={String(d.issues)} tone={d.issues > 0 ? "warn" : "default"} />
          <Sub k="Coverage" v={`${d.coverage}%`} tone={d.coverage < 50 ? "warn" : "default"} />
        </div>

        <div className="substats substats--3">
          <Sub k="Arch violations" v={String(d.archViolations)} tone={archCol} />
          <Sub k="Boundary surface" v={`${d.boundaryUsedExternally}/${d.boundaryExports}`} tone={exposureExcess > 10 ? "warn" : "default"} />
          <Sub k="Cohesion" v={d.cohesion.toFixed(2)} tone={d.cohesion < 0.5 ? "warn" : "default"} />
        </div>

        <div className="hero__trend">
          <span className="hero__trend-key">Risk trend · 8w</span>
          <Sparkline points={d.spark} className="hero__trend-spark" />
          <span className="hero__trend-val" style={{ color: riskColor(d.avgRisk) }}>+17</span>
        </div>
      </div>

      <Section label="Engine signals" count={d.signals.length}>
        <div className="rsig">
          {d.signals.map((s, i) => (
            <div key={i} className={`rsig__row ${SEV_CLASS[s.sev]}`}>
              <span className="rsig__icon"><s.Icon size={14} /></span>
              <div className="rsig__text">
                <span className="rsig__label">{s.label}</span>
                <span className="rsig__detail">{s.detail}</span>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section label="Top risk files" count={d.topFiles.length}>
        <div className="rheat">
          {d.topFiles.map((f) => (
            <div key={f.name} className="rheat__row">
              <span className="rheat__issues">{f.issues}</span>
              <span className="rheat__name">{f.name}</span>
              <div className="rheat__bar"><div className="rheat__fill" style={riskBarStyle(f.risk)} /></div>
              <span className="rheat__val">{f.risk}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section label="Subfolders" count={d.subfoldersList.length}>
        <div className="rheat">
          {d.subfoldersList.map((s) => (
            <div key={s.name} className="rheat__row">
              <span className="rheat__issues">{s.files}</span>
              <span className="rheat__name">{s.name}</span>
              <div className="rheat__bar"><div className="rheat__fill" style={riskBarStyle(s.risk)} /></div>
              <span className="rheat__val">{s.risk}</span>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}

/* ───────────────────────── Structure ───────────────────────── */

function StructurePane({ d }: { d: typeof FOLDER_DATA }) {
  const exposureExcess = d.boundaryExports - d.boundaryUsedExternally;

  return (
    <>
      <Section label="Architectural integrity">
        <div className="substats substats--3">
          <Sub k="Violations" v={String(d.archViolations)} tone={d.archViolations > 0 ? "danger" : "default"} />
          <Sub k="Cycles" v={String(d.cycles)} tone={d.cycles > 0 ? "warn" : "default"} />
          <Sub k="Coupling" v={d.coupling.toFixed(2)} tone={d.coupling > 0.6 ? "warn" : "default"} />
        </div>
        <div className="rsig" style={{ marginTop: 8 }}>
          {d.archIssues.map((a, i) => (
            <div key={i} className={`rsig__row ${SEV_CLASS[a.sev]}`}>
              <span className="rsig__icon"><span className="folder-arch__kind">{a.kind === "cycle" ? "↻" : a.kind === "layer" ? "⇅" : "⊘"}</span></span>
              <div className="rsig__text">
                <span className="rsig__label">{a.rule}</span>
                <span className="rsig__detail">{a.detail}</span>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section label="Import cycle" count={d.cycleEdges.length}>
        <ol className="folder-cycle">
          {d.cycleEdges.map((e, i) => (
            <li key={i} className="folder-cycle__row">
              <span className="folder-cycle__num">{i + 1}</span>
              <span className="folder-cycle__from">{e.from}</span>
              <span className="folder-cycle__arrow">→</span>
              <span className="folder-cycle__to">{e.to}</span>
              <span className="folder-cycle__via">{e.via}</span>
            </li>
          ))}
        </ol>
      </Section>

      <Section label="Boundary surface" count={d.boundaryExports}>
        <div className="substats substats--3">
          <Sub k="Exports" v={String(d.boundaryExports)} />
          <Sub k="Used externally" v={String(d.boundaryUsedExternally)} />
          <Sub k="Over-exposed" v={String(exposureExcess)} tone={exposureExcess > 10 ? "warn" : "default"} />
        </div>
        <ul className="folder-bound">
          {d.boundary.map((b) => (
            <li key={b.name} className="folder-bound__row">
              <span className="folder-bound__kind">{b.kind === "class" ? "C" : b.kind === "const" ? "k" : "ƒ"}</span>
              <span className="folder-bound__name">{b.name}</span>
              <span className="folder-bound__used">{b.usedBy}</span>
              {b.tag && <span className={`pill pill--conf-${b.tag === "unused" ? "high" : "med"}`}>{b.tag}</span>}
            </li>
          ))}
        </ul>
      </Section>

      <Section label="Dependency direction">
        <div className="folder-dep">
          <div className="folder-dep__col">
            <div className="folder-dep__head"><IconArrowIn size={12} /> Inbound</div>
            {d.inbound.map((e) => (
              <div key={e.folder} className={"folder-dep__row" + (e.allowed ? "" : " is-bad")}>
                <span className="folder-dep__name">{e.folder}</span>
                <span className="folder-dep__bar"><span className="folder-dep__fill" style={{ width: `${Math.min(100, e.weight * 4)}%` }} /></span>
                <span className="folder-dep__val">{e.weight}</span>
              </div>
            ))}
          </div>
          <div className="folder-dep__col">
            <div className="folder-dep__head"><IconArrowOut size={12} /> Outbound</div>
            {d.outbound.map((e) => (
              <div key={e.folder} className={"folder-dep__row" + (e.allowed ? "" : " is-bad")}>
                <span className="folder-dep__name">{e.folder}</span>
                <span className="folder-dep__bar"><span className="folder-dep__fill" style={{ width: `${Math.min(100, e.weight * 4)}%` }} /></span>
                <span className="folder-dep__val">{e.weight}</span>
              </div>
            ))}
          </div>
        </div>
      </Section>
    </>
  );
}

/* ───────────────────────── Duplication ───────────────────────── */

function DuplicationPane({ d }: { d: typeof FOLDER_DATA }) {
  return (
    <>
      <Section label="Clone debt">
        <div className="substats substats--3">
          <Sub k="Clusters" v={String(d.clones.length)} />
          <Sub k="Duplicated" v={`${d.duplicationPct}%`} tone={d.duplicationPct > 15 ? "warn" : "default"} />
          <Sub k="Sites" v={String(d.clones.reduce((a, c) => a + c.size, 0))} />
        </div>
      </Section>

      <Section label="Clone clusters" count={d.clones.length}>
        <ul className="folder-clone">
          {d.clones.map((c) => (
            <li key={c.id} className="folder-clone__cluster">
              <div className="folder-clone__head">
                <span className="folder-clone__id">{c.id}</span>
                <span className="folder-clone__meta">{c.size} sites · {c.locs} loc</span>
                <span className="folder-clone__sim">sim {c.sim.toFixed(2)}</span>
              </div>
              <ul className="folder-clone__sites">
                {c.sites.map((s, i) => (
                  <li key={i} className="folder-clone__site">{s}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}

/* ───────────────────────── Blast ───────────────────────── */

function BlastPane({ d }: { d: typeof FOLDER_DATA }) {
  return (
    <>
      <Section label="Change blast">
        <div className="substats substats--3">
          <Sub k="Boundary crossings" v={String(d.blastBoundaryCrossings)} tone="warn" />
          <Sub k="Hot corridors" v={String(d.blastCorridors.length)} />
          <Sub k="Hotspot density" v={`${Math.round(d.hotspotDensity * 100)}%`} tone={d.hotspotDensity > 0.4 ? "warn" : "default"} />
        </div>
      </Section>

      <Section label="Top corridors" count={d.blastCorridors.length}>
        <ul className="folder-corridor">
          {d.blastCorridors.map((c) => (
            <li key={c.symbol} className="folder-corridor__row">
              <span className="folder-corridor__sym">{c.symbol}</span>
              <span className="folder-corridor__meta">→ {c.outFiles}f · {c.outFolders}d</span>
              <div className="folder-corridor__bar">
                <span className="folder-corridor__fill" style={{ width: `${Math.min(100, c.outFiles * 2)}%`, background: riskColor(c.risk) }} />
              </div>
              <span className="folder-corridor__val" style={{ color: riskColor(c.risk) }}>{c.risk}</span>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}

/* ───────────────────────── Incidents ───────────────────────── */

function IncidentsPane({ d }: { d: typeof FOLDER_DATA }) {
  return (
    <>
      <Section label="Recurring patterns" count={d.incidents.length}>
        <ul className="folder-inc">
          {d.incidents.map((i) => (
            <li key={i.id} className={`folder-inc__row ${SEV_CLASS[i.severity]}`}>
              <span className="folder-inc__id">{i.id}</span>
              <div className="folder-inc__text">
                <span className="folder-inc__pat">{i.pattern}</span>
                <span className="folder-inc__meta">{i.date} · {i.matches} match{i.matches === 1 ? "" : "es"}</span>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section label="Spec drift">
        <div className="substats substats--2">
          <Sub k="Drift" v={`${d.driftPct}%`} tone={d.driftPct > 20 ? "warn" : "default"} />
          <Sub k="Files affected" v="3" />
        </div>
      </Section>
    </>
  );
}

/* ───────────────────────── Ownership ───────────────────────── */

function OwnershipPane({ d }: { d: typeof FOLDER_DATA }) {
  return (
    <>
      <Section label="Ownership health">
        <div className="substats substats--3">
          <Sub k="Bus factor" v={String(d.busFactor)} tone={d.busFactor <= 1 ? "danger" : "default"} />
          <Sub k="Orphaned" v={String(d.orphanedFiles)} tone={d.orphanedFiles > 0 ? "warn" : "default"} />
          <Sub k="Stale" v={String(d.staleFiles)} tone={d.staleFiles > 0 ? "warn" : "default"} />
        </div>
      </Section>

      <Section label="Contributors" count={d.contributors.length}>
        <div className="rown">
          {d.contributors.map((c) => (
            <div key={c.name} className="rown__row">
              <span className="rown__avatar">{c.name[1]?.toUpperCase() ?? c.name[0]}</span>
              <span className="rown__name">{c.name}</span>
              <div className="rown__bar"><div className="rown__fill" style={riskBarStyle(Math.round(c.share * 100))} /></div>
              <span className="rown__pct">{c.commits}c</span>
            </div>
          ))}
        </div>
      </Section>

      <Section label="Risk ownership">
        <ul className="folder-rown">
          {d.contributors.map((c) => (
            <li key={c.name} className="folder-rown__row">
              <span className="folder-rown__name">{c.name}</span>
              <div className="folder-rown__bar"><span className="folder-rown__fill" style={{ width: `${c.ownsRisk}%`, background: riskColor(c.ownsRisk) }} /></div>
              <span className="folder-rown__val">{c.ownsRisk}%</span>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}
