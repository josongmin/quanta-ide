// ViewModePicker — categorized tree list
//
// Layout: vertical scrollable panel
//   header  — current context (레포/폴더/파일)
//   groups  — 탐색 / 의존성 / 이력 / 계획 / 아키텍처 (always expanded)
//   leaf    — label + hint + tech + usecase

import {
  useMemo,
  type CSSProperties,
  type ReactElement,
} from "react";
import { useViewMode, viewModeStore, type ViewMode } from "../model/store";
import { entityStore, useEntityState } from "../../../entities/entity";
import { mindMapStore } from "../../mind-map";
import { color, font, radius, space } from "../../../shared/ui/tokens";

// ── View mode catalogue (exported for external label lookups) ─────────

export const VIEW_MODE_OPTIONS: readonly {
  value: ViewMode; label: string; hint: string; tech: string; usecase: string;
}[] = [
  {
    value: "treemap", label: "Universe",
    hint: "계층 구조를 공간으로 표현", tech: "파일 계층 트리 + LoC",
    usecase: "코드베이스 온보딩 첫날 전체 구조 파악. 어떤 패키지가 가장 큰지(LoC 기준) 한눈에 확인. PR 리뷰 전 변경 파일이 어느 영역에 있는지 위치 확인.",
  },
  {
    value: "mindmap", label: "Mind",
    hint: "선택 파일 중심의 방사형 관계도", tech: "AST 심볼 의존성 그래프",
    usecase: "파일 수정 전 '이게 뭘 쓰고 뭐한테 쓰이나' 즉시 파악. 의존성 체인 따라가기. 리팩터링 전 영향 범위 1차 확인.",
  },
  {
    value: "chord", label: "Chord",
    hint: "패키지 간 의존성 강도 시각화", tech: "패키지-레벨 의존성 집계",
    usecase: "패키지 간 결합도가 심한 곳 식별. 순환 의존 발생 위험 영역 조기 감지. 마이크로서비스 분리 전 경계 적합성 검토.",
  },
  {
    value: "matrix", label: "Matrix",
    hint: "DSM — 의존성 격자 행렬", tech: "Design Structure Matrix",
    usecase: "의존 방향이 올바른지(상위→하위) 셀 단위로 검토. 순환 의존을 정확한 파일 쌍으로 찾기. 아키텍처 리뷰 미팅 자료.",
  },
  {
    value: "quadrant", label: "Quad",
    hint: "변경 빈도 × 위험도 산점도", tech: "git churn × 순환 복잡도(CC)",
    usecase: "'자주 바뀌면서 복잡한' 파일 = 리팩터링 1순위. 스프린트 계획 시 기술 부채 우선순위 정량화. 안정 파일 vs 위험 파일 분류.",
  },
  {
    value: "arc-cycles", label: "Cycles",
    hint: "역방향 엣지(순환 의존) 아크 다이어그램", tech: "Tarjan SCC — 강결합 컴포넌트",
    usecase: "순환 의존이 어디서 발생하는지 시각적으로 추적. SCC 내 파일 한 번에 확인. 순환 끊기 작업 전 영향도 파악.",
  },
  {
    value: "embedding", label: "Embed",
    hint: "구조적 유사도 기반 2D 배치", tech: "구조 유사도 행렬 → UMAP 투영",
    usecase: "비슷한 역할/구조를 가진 모듈 클러스터 발견. 혼자 동떨어진 파일('이게 왜 여기?') 이상 탐지. 모듈 통합/재구성 시 후보군 식별.",
  },
  {
    value: "blast", label: "Blast",
    hint: "선택 파일의 변경 영향 범위", tech: "역방향 전이 의존성 BFS",
    usecase: "'이 파일 바꾸면 뭐가 깨지나' 즉시 확인. 핫픽스 전 영향 범위 검토. 테스트 범위 결정(어느 테스트까지 돌려야 하나).",
  },
  {
    value: "arch-layers", label: "Layers",
    hint: "아키텍처 레이어 간 의존 흐름", tech: "레이어 분류 + 의존 방향 위반 감지",
    usecase: "레이어 위반(하위가 상위를 import) 감지. FSD/클린 아키텍처 준수 여부 모니터링. 신규 파일 추가 시 레이어 배치 검증.",
  },
  {
    value: "debt-history", label: "Debt",
    hint: "기술 부채 누적 추이", tech: "순환 복잡도 + 부채 메트릭 × git 이력",
    usecase: "부채가 언제부터 쌓이기 시작했는지 타임라인 파악. 특정 시기 급증 원인 추적(어떤 PR/스프린트). 분기 회고 자료.",
  },
  {
    value: "refactor-terrain", label: "Refactor",
    hint: "ROI 순위 기반 리팩터링 목록", tech: "복잡도 × churn ROI 스코어링",
    usecase: "리팩터링 우선순위를 ROI 기준으로 정량화. 스프린트에 리팩터링 티켓 넣을 때 근거 자료. '감으로 고르기' 대신 데이터 기반 결정.",
  },
  {
    value: "cycle-genesis", label: "Cycles↗",
    hint: "순환 의존이 처음 생긴 시점 타임라인", tech: "SCC + git blame 최초 등장 시점",
    usecase: "순환이 언제 처음 도입됐는지 커밋 단위 추적. 어떤 PR에서 순환이 생겼는지 책임 소재 파악. 재발 방지 가이드 작성 근거.",
  },
  {
    value: "smell-history", label: "Smells",
    hint: "코드 스멜이 처음 등장한 시점", tech: "스멜 패턴 감지 + git 이력",
    usecase: "스멜 도입 시점과 원인 커밋 추적. 특정 스멜이 어떤 개발 패턴에서 반복 발생하는지 파악. 코드 리뷰 가이드라인 개선 근거.",
  },
  {
    value: "arch-drift", label: "Drift",
    hint: "베이스라인 대비 아키텍처 변화", tech: "레이어 분류 스냅샷 diff",
    usecase: "릴리즈 이후 아키텍처가 얼마나 변했나 확인. 스프린트 종료 후 의도치 않은 구조 변화 감지. 아키텍처 거버넌스 리포트.",
  },
  {
    value: "cochange", label: "CoChange",
    hint: "함께 자주 바뀌는 파일 히트맵", tech: "git 커밋 co-occurrence 마이닝",
    usecase: "논리적으로 묶여야 할 파일들 발견 → 모듈화 후보. 변경 시 빠뜨린 파일 없는지 체크. 숨겨진 커플링(의존성 그래프에 안 보이는 것) 탐지.",
  },
  {
    value: "refactor-sim", label: "Simulate",
    hint: "리팩터링 시뮬레이션 — 예상 효과", tech: "의존성 그래프 변이 시뮬레이션",
    usecase: "실제 코드 건드리기 전 '이걸 분리하면 의존성이 어떻게 바뀌나' 확인. 팀에 리팩터링 제안할 때 before/after 근거 자료. 리스크 없는 사전 검증.",
  },
  {
    value: "start-here", label: "StartHere",
    hint: "코드베이스 탐색 시작점 추천", tech: "의존성 PageRank + 진입점 중심성",
    usecase: "새 팀원 온보딩 시 '여기서부터 보세요' 가이드. 낯선 레포 코드리뷰 전 핵심 파일 파악. '이 코드베이스의 핵심이 뭐야?'에 대한 빠른 답.",
  },
  {
    value: "pathfinder", label: "Path",
    hint: "두 파일 사이 의존 경로 탐색", tech: "의존성 그래프 BFS 최단 경로",
    usecase: "'A가 B를 왜 알고 있지?' 의존 경로 추적. 의도치 않은 간접 의존 발견. 모듈 분리 시 끊어야 할 경로 확인.",
  },
  {
    value: "neighborhood", label: "Halo",
    hint: "N-홉 이웃 관계 링", tech: "N-홉 의존성 그래프 탐색",
    usecase: "특정 파일의 직접/간접 이웃 파악. '이 파일 주변 생태계' 이해. 격리 리팩터링 전 영향 경계 설정.",
  },
  {
    value: "author-territory", label: "Authors",
    hint: "blame 기반 작성자 소유 영역", tech: "git blame 소유권 분석",
    usecase: "PR 리뷰어 지정 시 누가 이 영역 담당인지 확인. 온보딩 시 도메인별 담당자 파악. 버스 팩터(한 명만 아는 영역) 위험 식별.",
  },
  {
    value: "service-topo", label: "Services",
    hint: "패키지 간 서비스 토폴로지", tech: "모듈 경계 + 공개 API 의존성",
    usecase: "마이크로서비스 경계와 실제 코드 구조 일치 여부 확인. API 의존 방향이 설계 의도와 맞는지 검토. 서비스 분리/통합 계획 수립.",
  },
  {
    value: "galaxy-3d", label: "Galaxy",
    hint: "3D 갤럭시 — 파일을 우주 공간에 배치", tech: "구조 유사도 임베딩 + 3D 포스 레이아웃",
    usecase: "전체 코드베이스를 우주처럼 자유 탐색(발견 모드). 데모/발표용 시각화. 구조 클러스터를 입체적으로 파악.",
  },
];

// ── Category groupings ────────────────────────────────────────────────

interface ViewCat {
  id: string;
  label: string;
  glyph: string;
  accent: string;
  modes: readonly ViewMode[];
}

const CATEGORIES: readonly ViewCat[] = [
  {
    id: "explore",  label: "탐색",    glyph: "◎", accent: "#0d99ff",
    modes: ["treemap", "mindmap", "embedding", "galaxy-3d"],
  },
  {
    id: "deps",     label: "의존성",  glyph: "⬡", accent: "#e09321",
    modes: ["chord", "matrix", "arc-cycles", "blast", "pathfinder", "neighborhood"],
  },
  {
    id: "history",  label: "이력",    glyph: "◈", accent: "#9e77ff",
    modes: ["debt-history", "cycle-genesis", "smell-history", "arch-drift", "cochange"],
  },
  {
    id: "plan",     label: "계획",    glyph: "◆", accent: "#22a06b",
    modes: ["quadrant", "refactor-terrain", "refactor-sim", "start-here"],
  },
  {
    id: "arch",     label: "아키텍처", glyph: "⊟", accent: "#e5484d",
    modes: ["author-territory", "service-topo", "arch-layers"],
  },
];

// ── Context → visible modes ───────────────────────────────────────────

type ViewCtx = "repo" | "folder" | "file";

const VIEW_CTX: Readonly<Record<ViewMode, readonly ViewCtx[]>> = {
  "treemap":          ["repo", "folder", "file"],
  "mindmap":          ["repo", "folder", "file"],
  "chord":            ["repo", "folder"],
  "matrix":           ["repo", "folder"],
  "quadrant":         ["repo", "folder"],
  "arc-cycles":       ["repo", "folder"],
  "embedding":        ["repo", "folder", "file"],
  "blast":            ["folder", "file"],
  "arch-layers":      ["repo"],
  "debt-history":     ["repo"],
  "refactor-terrain": ["repo", "folder"],
  "cycle-genesis":    ["repo"],
  "smell-history":    ["repo"],
  "arch-drift":       ["repo"],
  "cochange":         ["repo", "folder"],
  "refactor-sim":     ["repo", "folder", "file"],
  "start-here":       ["repo", "folder", "file"],
  "pathfinder":       ["file"],
  "neighborhood":     ["folder", "file"],
  "author-territory": ["repo"],
  "service-topo":     ["repo"],
  "galaxy-3d":        ["repo", "folder", "file"],
};

// ── Disabled modes require a tree to be loaded ────────────────────────

const NEEDS_TREE = new Set<ViewMode>(["mindmap", "blast", "neighborhood", "pathfinder"]);

// ── Per-view-mode glyph (scannable identifier) ────────────────────────

const VIEW_GLYPH: Readonly<Record<ViewMode, string>> = {
  "treemap":          "◎",
  "mindmap":          "✸",
  "chord":            "⬡",
  "matrix":           "⊞",
  "quadrant":         "✕",
  "arc-cycles":       "⟳",
  "embedding":        "✦",
  "blast":            "⚡",
  "arch-layers":      "≡",
  "debt-history":     "▲",
  "refactor-terrain": "△",
  "cycle-genesis":    "↗",
  "smell-history":    "◉",
  "arch-drift":       "∿",
  "cochange":         "⧉",
  "refactor-sim":     "⊕",
  "start-here":       "★",
  "pathfinder":       "→",
  "neighborhood":     "○",
  "author-territory": "◐",
  "service-topo":     "⬢",
  "galaxy-3d":        "✹",
};

// ── Context palette ───────────────────────────────────────────────────

interface CtxPalette { glyph: string; ko: string; en: string; accent: string }

const CTX_PALETTE: Readonly<Record<ViewCtx, CtxPalette>> = {
  repo:   { glyph: "◎", ko: "레포",  en: "WORKSPACE", accent: "#7e4ed6" },
  folder: { glyph: "⊞", ko: "폴더",  en: "FOLDER",    accent: "#22a06b" },
  file:   { glyph: "⊟", ko: "파일",  en: "FILE",      accent: "#0d99ff" },
};

// ── Styles ────────────────────────────────────────────────────────────

const OUTER: CSSProperties = {
  width: 460,
  maxHeight: 620,
  display: "flex",
  flexDirection: "column",
  fontFamily: font.sans,
  background: color.bg1,
  borderRadius: radius.lg,
  overflow: "hidden",
};

// Context card — large, gradient, unmistakable
const CTX_CARD: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: space[2],
  padding: `${space[4]}px ${space[4]}px ${space[3]}px`,
  flexShrink: 0,
  position: "relative",
  overflow: "hidden",
};

const CTX_TOP_ROW: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[3],
};

const CTX_GLYPH_BADGE: CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: 12,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 20,
  fontWeight: font.weight.bold,
  flexShrink: 0,
  color: "#ffffff",
};

const CTX_NAME_COL: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
  minWidth: 0,
  flex: 1,
};

const CTX_KIND_PILL: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "3px 9px",
  borderRadius: 999,
  fontSize: 10,
  fontWeight: font.weight.semibold,
  letterSpacing: 0.4,
  fontFamily: font.sans,
  width: "fit-content",
};

const CTX_ENTITY_NAME: CSSProperties = {
  fontSize: font.size.xl,
  fontWeight: font.weight.semibold,
  color: color.text0,
  letterSpacing: font.letter.tight,
  lineHeight: 1.15,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const CTX_PATH: CSSProperties = {
  fontSize: 10.5,
  fontFamily: font.mono,
  color: color.text2,
  letterSpacing: -0.15,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const CTX_FOOTER: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  fontSize: font.size.xs,
  color: color.text2,
  paddingTop: space[1],
  borderTop: `1px dashed ${color.border}`,
  marginTop: space[1],
};

// Scroll
const SCROLL: CSSProperties = {
  flex: 1,
  overflowY: "auto",
  overscrollBehavior: "contain",
  padding: `${space[2]}px ${space[2]}px ${space[3]}px`,
};

// Category header
const CAT_HEADER: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[2],
  padding: `${space[3]}px ${space[2]}px ${space[2]}px`,
  marginTop: space[1],
};

const CAT_DOT: CSSProperties = {
  width: 6,
  height: 6,
  borderRadius: 999,
  flexShrink: 0,
};

const CAT_KO: CSSProperties = {
  fontSize: font.size.md,
  fontWeight: font.weight.semibold,
  color: color.text0,
  letterSpacing: font.letter.tight,
};

const CAT_EN: CSSProperties = {
  fontSize: 9,
  fontWeight: font.weight.semibold,
  color: color.text3,
  letterSpacing: 0.2,
  textTransform: "uppercase",
};

const CAT_LINE: CSSProperties = {
  flex: 1,
  height: 1,
  background: `linear-gradient(90deg, ${color.border}, transparent)`,
};

const CAT_COUNT: CSSProperties = {
  fontSize: 9.5,
  fontFamily: font.mono,
  color: color.text3,
  fontWeight: font.weight.semibold,
  padding: "1px 6px",
  borderRadius: 999,
  background: color.bg3,
};

// View-mode card (row)
const ROW_BASE: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: space[3],
  padding: `${space[2] + 2}px ${space[3]}px`,
  border: `1px solid transparent`,
  borderRadius: radius.lg + 2,
  background: "transparent",
  cursor: "pointer",
  textAlign: "left",
  width: "100%",
  boxSizing: "border-box",
  transition: "background 140ms, border-color 140ms, transform 140ms",
  fontFamily: font.sans,
  color: color.text0,
  position: "relative",
};

const ROW_GLYPH_BASE: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 9,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 15,
  fontWeight: font.weight.semibold,
  flexShrink: 0,
  transition: "background 140ms, color 140ms, box-shadow 140ms",
};

const ROW_CONTENT: CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: 2,
};

const ROW_LABEL_LINE: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  gap: space[2],
};

const ROW_LABEL: CSSProperties = {
  fontSize: font.size.md,
  fontWeight: font.weight.semibold,
  color: color.text0,
  letterSpacing: font.letter.tight,
  lineHeight: 1.2,
};

const ROW_HINT: CSSProperties = {
  fontSize: font.size.xs,
  color: color.text1,
  lineHeight: 1.35,
  letterSpacing: -0.01,
};

const ROW_TECH: CSSProperties = {
  fontSize: 9.5,
  fontFamily: font.mono,
  color: color.text3,
  lineHeight: 1.4,
  letterSpacing: -0.1,
  marginTop: 1,
};

const ACTIVE_MARK: CSSProperties = {
  width: 18,
  height: 18,
  borderRadius: 999,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 11,
  fontWeight: font.weight.bold,
  color: "#ffffff",
  flexShrink: 0,
  alignSelf: "center",
};

// ── Component ─────────────────────────────────────────────────────────

export function ViewModePicker(): ReactElement {
  const mode       = useViewMode(s => s.mode);
  const selectedId = useEntityState(s => s.interaction.selectedId);
  const anchorId   = useEntityState(s => s.interaction.anchorId);
  const tree       = useEntityState(s => s.tree);

  const contextId   = anchorId ?? selectedId;
  const contextKind = contextId ? tree?.byId.get(contextId)?.kind : undefined;
  const ctx: ViewCtx =
    contextKind === "building" || contextKind === "floor" || contextKind === "room"
      ? "file"
      : contextKind === "street"
        ? "folder"
        : "repo";

  const optionMap = useMemo(
    () => new Map(VIEW_MODE_OPTIONS.map(o => [o.value, o])),
    [],
  );

  const visCats = useMemo(
    () => CATEGORIES
      .map(cat => ({
        ...cat,
        vis: cat.modes.filter(m => VIEW_CTX[m].includes(ctx)),
      }))
      .filter(cat => cat.vis.length > 0),
    [ctx],
  );

  const pick = (next: ViewMode): void => {
    viewModeStore.setMode(next);
    if (next === "mindmap") {
      const sel = selectedId ?? entityStore.getState().interaction.selectedId;
      const target = sel ?? tree?.rootId ?? null;
      if (target) mindMapStore.openOn(target);
    } else {
      mindMapStore.close();
    }
  };

  const ctxPal = CTX_PALETTE[ctx];
  const totalModes = visCats.reduce((acc, c) => acc + c.vis.length, 0);

  // Entity info for the context card — name + path for selected/anchor entity
  const ctxEntity = contextId ? tree?.byId.get(contextId) : undefined;
  const ctxName = ctxEntity?.name ?? "Workspace";
  const ctxPath = ctxEntity?.path || "";

  return (
    <div style={OUTER} role="radiogroup" aria-label="시각화 모드 선택">
      {/* Context card — massive, unmistakable */}
      <div style={{
        ...CTX_CARD,
        background: `linear-gradient(135deg, ${ctxPal.accent}14 0%, ${ctxPal.accent}03 55%, transparent 100%)`,
        borderBottom: `1px solid ${color.border}`,
      }}>
        {/* subtle accent glow top-right */}
        <div style={{
          position: "absolute", top: -40, right: -40,
          width: 140, height: 140, borderRadius: 999,
          background: `radial-gradient(circle, ${ctxPal.accent}22 0%, transparent 70%)`,
          pointerEvents: "none",
        }} />

        <div style={CTX_TOP_ROW}>
          <div style={{
            ...CTX_GLYPH_BADGE,
            background: ctxPal.accent,
            boxShadow: `0 4px 14px ${ctxPal.accent}55, inset 0 1px 0 rgba(255,255,255,0.25)`,
          }}>
            {ctxPal.glyph}
          </div>
          <div style={CTX_NAME_COL}>
            <span style={{
              ...CTX_KIND_PILL,
              background: `${ctxPal.accent}18`,
              color: ctxPal.accent,
            }}>
              <span style={{ width: 5, height: 5, borderRadius: 999, background: ctxPal.accent }} />
              {ctxPal.en}
              <span style={{ opacity: 0.6, marginLeft: 2 }}>· {ctxPal.ko}</span>
            </span>
            <span style={CTX_ENTITY_NAME} title={ctxName}>{ctxName}</span>
          </div>
        </div>

        {ctxPath ? (
          <div style={CTX_PATH} title={ctxPath}>{ctxPath}</div>
        ) : null}

        <div style={CTX_FOOTER}>
          <span style={{ color: ctxPal.accent, fontWeight: font.weight.semibold, fontSize: font.size.sm }}>
            {totalModes}
          </span>
          <span>개 시각화</span>
          <span style={{ margin: "0 4px", color: color.text3 }}>·</span>
          <span style={{ color: color.text3 }}>이 {ctxPal.ko} 컨텍스트에서 사용 가능</span>
        </div>
      </div>

      {/* Scrollable mode list */}
      <div style={SCROLL}>
        {visCats.map(cat => (
          <div key={cat.id}>
            <div style={CAT_HEADER}>
              <span style={{ ...CAT_DOT, background: cat.accent }} />
              <span style={CAT_KO}>{cat.label}</span>
              <span style={CAT_EN}>{cat.id.toUpperCase()}</span>
              <span style={CAT_LINE} />
              <span style={CAT_COUNT}>{cat.vis.length}</span>
            </div>

            {cat.vis.map(m => {
              const opt = optionMap.get(m);
              if (!opt) return null;
              const active   = mode === m;
              const disabled = NEEDS_TREE.has(m) && !tree;

              return (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-label={`${opt.label} — ${opt.hint}`}
                  disabled={disabled}
                  onClick={() => !disabled && pick(m)}
                  onMouseEnter={e => {
                    if (!active && !disabled) {
                      e.currentTarget.style.background = color.bg2;
                      e.currentTarget.style.borderColor = color.border;
                      e.currentTarget.style.transform = "translateY(-1px)";
                    }
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = active
                      ? `linear-gradient(135deg, ${cat.accent}14 0%, ${cat.accent}06 100%)`
                      : "transparent";
                    e.currentTarget.style.borderColor = active ? `${cat.accent}44` : "transparent";
                    e.currentTarget.style.transform = "translateY(0)";
                  }}
                  style={{
                    ...ROW_BASE,
                    background: active
                      ? `linear-gradient(135deg, ${cat.accent}14 0%, ${cat.accent}06 100%)`
                      : "transparent",
                    borderColor: active ? `${cat.accent}44` : "transparent",
                    opacity: disabled ? 0.38 : 1,
                    cursor: disabled ? "not-allowed" : "pointer",
                    boxShadow: active ? `0 1px 6px ${cat.accent}22` : "none",
                  }}
                >
                  <div style={{
                    ...ROW_GLYPH_BASE,
                    background: active ? cat.accent : `${cat.accent}14`,
                    color: active ? "#ffffff" : cat.accent,
                    boxShadow: active ? `0 2px 8px ${cat.accent}55` : "none",
                  }}>
                    {VIEW_GLYPH[m]}
                  </div>

                  <div style={ROW_CONTENT}>
                    <div style={ROW_LABEL_LINE}>
                      <span style={ROW_LABEL}>{opt.label}</span>
                      {disabled ? (
                        <span style={{
                          fontSize: 9, color: color.text3, fontStyle: "italic",
                          fontFamily: font.sans, fontWeight: font.weight.medium,
                        }}>
                          워크스페이스 로딩중
                        </span>
                      ) : null}
                    </div>
                    <div style={ROW_HINT}>{opt.hint}</div>
                    <div style={{ ...ROW_TECH, color: active ? cat.accent : color.text3 }}>
                      {opt.tech}
                    </div>
                  </div>

                  {active ? (
                    <div style={{ ...ACTIVE_MARK, background: cat.accent }}>✓</div>
                  ) : null}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
