import { memo, useMemo, useState } from "react";
import type { CSSProperties, ReactElement } from "react";

import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import { color, font, radius, shadow, space } from "../../../shared/ui/tokens";
import { benchmarkGaps, type BenchmarkGap } from "../../../shared/analytics/synth-metrics";

interface Props {
  ctx: ViewContextValue;
}

const TASK_KOREAN: Record<BenchmarkGap["task"], string> = {
  explain: "설명",
  "fix-bug": "버그 수정",
  "add-feature": "기능 추가",
  refactor: "리팩터",
  test: "테스트 작성",
  review: "코드 리뷰",
};

function verdictTint(verdict: BenchmarkGap["verdict"]): string {
  if (verdict === "harder") return color.danger;
  if (verdict === "typical") return color.warn;
  return color.success;
}

function BenchmarkGapViewImpl({ ctx }: Props): ReactElement | null {
  const [sortByGap, setSortByGap] = useState(true);
  const data = useMemo(() => benchmarkGaps(ctx.tree), [ctx.tree]);

  const rows = useMemo(() => {
    const list = [...data];
    list.sort((a, b) => sortByGap ? a.gap - b.gap : a.task.localeCompare(b.task));
    return list;
  }, [data, sortByGap]);

  if (rows.length === 0) {
    return <div style={emptyStyle}>벤치마크 비교 데이터가 없습니다.</div>;
  }

  const avgRepo = rows.reduce((sum, row) => sum + row.thisRepo, 0) / rows.length;
  const avgSWE = rows.reduce((sum, row) => sum + row.swebenchVerified, 0) / rows.length;
  const hardest = rows[0]!;

  return (
    <div style={rootStyle}>
      <header style={headerStyle}>
        <div>
          <div style={titleStyle}>Benchmark Gap · <span style={{ color: color.danger }}>reality check</span></div>
          <div style={subtitleStyle}>SWE-bench Verified / SWE-Lancer 대비 내부 repo 난이도</div>
        </div>
        <div style={refStyle}>Jimenez 2024 · SWE-Lancer 2025 · SWE-Agent</div>
      </header>

      <section style={heroGrid}>
        <div style={heroCard}>
          <div style={heroLabel}>이 repo 평균 성공률</div>
          <div style={{ ...heroValue, color: color.text0 }}>{(avgRepo * 100).toFixed(0)}%</div>
          <div style={heroSub}>agentSuccessProbability average</div>
        </div>
        <div style={heroCard}>
          <div style={heroLabel}>SWE-bench Verified</div>
          <div style={{ ...heroValue, color: color.accent }}>{(avgSWE * 100).toFixed(0)}%</div>
          <div style={heroSub}>public benchmark baseline</div>
        </div>
        <div style={heroCard}>
          <div style={heroLabel}>largest negative gap</div>
          <div style={{ ...heroValue, color: verdictTint(hardest.verdict) }}>{(hardest.gap * 100).toFixed(0)}pt</div>
          <div style={heroSub}>{TASK_KOREAN[hardest.task]} · {hardest.verdict}</div>
        </div>
      </section>

      <section style={bodyGrid}>
        <div style={panelStyle}>
          <div style={panelHead}>
            <span style={sectionTitle}>Per-task comparison</span>
            <button type="button" onClick={() => setSortByGap(v => !v)} style={sortButton}>
              {sortByGap ? "gap 정렬" : "task 정렬"}
            </button>
          </div>
          <div style={tableHeader}>
            <span style={{ ...headCell, flex: 1 }}>task</span>
            <span style={{ ...headCell, width: 72, textAlign: "right" }}>SWE-V</span>
            <span style={{ ...headCell, width: 72, textAlign: "right" }}>Lancer</span>
            <span style={{ ...headCell, width: 72, textAlign: "right" }}>repo</span>
            <span style={{ ...headCell, width: 72, textAlign: "right" }}>gap</span>
            <span style={{ ...headCell, width: 96, textAlign: "right" }}>verdict</span>
          </div>
          {rows.map(row => {
            const tint = verdictTint(row.verdict);
            return (
              <div key={row.task} style={tableRow}>
                <span style={{ ...rowName, flex: 1 }}>{TASK_KOREAN[row.task]}</span>
                <span style={numCell}>{(row.swebenchVerified * 100).toFixed(0)}%</span>
                <span style={numCell}>{(row.swebLancer * 100).toFixed(0)}%</span>
                <span style={numCell}>{(row.thisRepo * 100).toFixed(0)}%</span>
                <span style={{ ...numCell, color: tint }}>{row.gap > 0 ? "+" : ""}{(row.gap * 100).toFixed(0)}pt</span>
                <span style={{ display: "flex", justifyContent: "flex-end", width: 96 }}><span style={chipStyle(tint)}>{row.verdict}</span></span>
              </div>
            );
          })}
        </div>

        <aside style={sidebarStyle}>
          <div style={panelStyle}>
            <div style={panelHead}><span style={sectionTitle}>Hardest tasks</span><span style={mutedMono}>negative gap first</span></div>
            <div style={{ padding: space[4], display: "grid", gap: space[3] }}>
              {rows.slice(0, 3).map(row => (
                <div key={`hard-${row.task}`} style={miniCard}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: space[2] }}>
                    <span style={rowName}>{TASK_KOREAN[row.task]}</span>
                    <span style={chipStyle(verdictTint(row.verdict))}>{(row.gap * 100).toFixed(0)}pt</span>
                  </div>
                  <div style={miniText}>SWE-V {(row.swebenchVerified * 100).toFixed(0)}% → repo {(row.thisRepo * 100).toFixed(0)}%</div>
                </div>
              ))}
            </div>
          </div>
          <div style={panelStyle}>
            <div style={panelHead}><span style={sectionTitle}>Reality check</span></div>
            <div style={{ padding: space[4], ...miniText }}>
              SWE-bench Verified는 공개 이슈 기반입니다. 내부 repo는 도메인 규칙, private API,
              변경 히스토리까지 얽혀 있어 대부분 더 어렵습니다. 공개 벤치 수치를 운영 기대치로
              그대로 쓰면 과신합니다.
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}

export const BenchmarkGapView = memo(BenchmarkGapViewImpl);

const rootStyle: CSSProperties = { width: "100%", height: "100%", overflowY: "auto", background: color.bg0, color: color.text0, fontFamily: font.sans, padding: `${space[5]}px ${space[6]}px`, boxSizing: "border-box", display: "grid", gap: space[4] };
const headerStyle: CSSProperties = { display: "flex", justifyContent: "space-between", gap: space[4], alignItems: "flex-start" };
const titleStyle: CSSProperties = { fontSize: font.size.display, fontWeight: font.weight.semibold };
const subtitleStyle: CSSProperties = { marginTop: 4, color: color.text2, fontSize: font.size.sm };
const refStyle: CSSProperties = { color: color.text2, fontSize: font.size.xs, fontFamily: font.mono, textAlign: "right", lineHeight: 1.5 };
const heroGrid: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: space[3] };
const heroCard: CSSProperties = { border: `1px solid ${color.border}`, borderRadius: radius.lg, background: color.bg1, boxShadow: shadow.sm, padding: space[4], display: "grid", gap: space[2] };
const heroLabel: CSSProperties = { fontSize: font.size.xs, color: color.text2, fontFamily: font.mono, textTransform: "uppercase", letterSpacing: font.letter.wide };
const heroValue: CSSProperties = { fontSize: 32, lineHeight: 1, fontWeight: font.weight.semibold };
const heroSub: CSSProperties = { fontSize: font.size.sm, color: color.text2 };
const bodyGrid: CSSProperties = { display: "grid", gridTemplateColumns: "minmax(0, 1.55fr) minmax(280px, 0.85fr)", gap: space[4], alignItems: "start" };
const panelStyle: CSSProperties = { border: `1px solid ${color.border}`, borderRadius: radius.lg, background: color.bg1, boxShadow: shadow.sm, overflow: "hidden" };
const panelHead: CSSProperties = { display: "flex", justifyContent: "space-between", gap: space[2], alignItems: "center", padding: `${space[3]}px ${space[4]}px`, borderBottom: `1px solid ${color.borderSoft}` };
const sectionTitle: CSSProperties = { fontSize: font.size.md, fontWeight: font.weight.semibold };
const sortButton: CSSProperties = { border: `1px solid ${color.border}`, background: color.bg0, color: color.text1, borderRadius: radius.pill, padding: `4px ${space[2]}px`, fontSize: font.size.xs, cursor: "pointer", fontFamily: font.sans };
const tableHeader: CSSProperties = { display: "flex", gap: space[2], alignItems: "center", padding: `${space[2]}px ${space[4]}px`, background: color.bg2, borderBottom: `1px solid ${color.borderSoft}` };
const headCell: CSSProperties = { fontSize: font.size.xs, color: color.text2, fontFamily: font.mono, textTransform: "uppercase" };
const tableRow: CSSProperties = { display: "flex", gap: space[2], alignItems: "center", padding: `${space[3]}px ${space[4]}px`, borderBottom: `1px solid ${color.borderSoft}` };
const rowName: CSSProperties = { fontSize: font.size.md, fontWeight: font.weight.medium };
const numCell: CSSProperties = { width: 72, textAlign: "right", fontFamily: font.mono, fontSize: font.size.sm };
const sidebarStyle: CSSProperties = { display: "grid", gap: space[3] };
const mutedMono: CSSProperties = { fontSize: font.size.xs, color: color.text2, fontFamily: font.mono };
const miniCard: CSSProperties = { border: `1px solid ${color.border}`, borderRadius: radius.md, padding: space[3], display: "grid", gap: space[2] };
const miniText: CSSProperties = { fontSize: font.size.sm, color: color.text1, lineHeight: 1.6 };
const emptyStyle: CSSProperties = { width: "100%", height: "100%", display: "grid", placeItems: "center", color: color.text3, fontSize: font.size.md };
function chipStyle(tint: string): CSSProperties { return { display: "inline-flex", alignItems: "center", padding: `4px ${space[2]}px`, borderRadius: radius.pill, background: `${tint}16`, color: tint, fontFamily: font.mono, fontSize: font.size.xs, fontWeight: font.weight.semibold, textTransform: "uppercase" }; }
