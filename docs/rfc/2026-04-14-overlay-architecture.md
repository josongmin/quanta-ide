# RFC: IDE Overlay Architecture (p0-ide-v2)

**날짜**: 2026-04-14
**상태**: 시행 중 (v2 shell에 반영)
**작성**: Jo + Claude

---

## 목적

엔진이 내놓는 신호(taint flow, blast radius, behavior diff, typestate, arch rules, cost, dead code, ownership, incident DNA)를 **개발자의 시선 안에서 무리 없이** 전달한다. 이 제품은 데모가 아니라 **실 제품**이며, 이 RFC는 오버레이 레이어링을 시행 중인 컨벤션으로 고정한다.

---

## 4-레이어 노출 모델

클릭 수와 시선 이동을 단계적으로 요구한다. 각 레이어는 엔진 신호의 하위집합을 담당한다.

### L1 — Passive (항상 표시, 클릭 0회)

| 요소 | 신호 | 구현 |
|------|------|------|
| 거터 글리프 | taint source/sink/through, arch violation, typestate, dead, incident match | `widgets/editor/gutter-marks.ts` |
| 함수 헤더 위젯 | blast, cpx (+ big-O, budget %), tests, taint, owner, risk score | `widgets/editor/fn-header.ts` |
| 탭 배너 | 파일 레벨 risk / blast / taint / cpx / arch / dead / incident count | `widgets/editor/TabBanner.tsx` |
| 우측 리스크 미니맵 | 라인 단위 severity × kind 밀도, 클릭 시 해당 라인 스크롤 | `widgets/editor/RiskMinimap.tsx` |

### L2 — Hover (클릭 0회, 마우스 1회)

| 요소 | 신호 | 구현 |
|------|------|------|
| 심볼 팝업 | 심볼 kind, risk, cpx + big-O, callers/callees, tests, taint 상태, flows-to 프리뷰 (L-jump), blame, tags, 키힌트 | `widgets/editor/SymbolPopup.tsx` |
| 호출-사이트 팝업 | callee 파일, 효과(io:read/write, persist, async), 연결된 taint path 전체 (hop별 dot + 설명), sanitizer 힌트 | `widgets/editor/CallSitePopup.tsx` |

### L3 — Focus / Mode pivot (클릭 1회)

Inspector에 모드 스위처 (`Overview / Flow / Blast / Incidents / Behavior / Ownership`). 에디터의 L1/L2 요소에서 해당 뷰로 점프.

| 모드 | 내용 |
|------|------|
| Flow | 선택된 taint path의 step-by-step (source → propagate → branch → sink), OWASP 카테고리, sanitizer 제안 |
| Blast | 영향받는 파일 랭킹 (risk순), call path, 관계 kind (direct/transitive/shared-data/test) |
| Incidents | 현재 파일 패턴이 매칭된 과거 장애 (DNA match), 신뢰도, postmortem 링크 |
| Behavior | 편집 변경을 syntax / semantic / runtime 3단계로 분리, before/after diff |
| Ownership | call-graph 가중 ownership 비율, role (primary/contrib/orphan), bus factor |

상태는 `entities/engine/focus-store.ts` — `useSyncExternalStore` 기반 경량 외부 스토어. 에디터 팝업 액션이 이 스토어를 통해 Inspector 모드를 전환.

### L4 — Active (키보드)

| 바인딩 | 동작 |
|--------|------|
| `⌘⇧S` | Simulate change — 표현식 뮤테이션, blast/taint/cpx delta + behavior diff + proof replay 예측 |
| `⌘E` | Ask agent — 현재 커서 심볼의 blast/taint/cpx/ownership/incident 카드를 자동 주입한 질문 창 |
| `⌘1–6` | Inspector 모드 직행 (Overview/Flow/Blast/Incidents/Behavior/Ownership) |
| `Esc` | 열린 overlay 닫기 |

구현: `app/shortcuts.ts`, `app/SimulateOverlay.tsx`, `app/ContextInjectOverlay.tsx`.

---

## 데이터 계약

모든 오버레이는 `src/entities/engine/`에서 데이터를 읽는다.

```
entities/engine/
├── types.ts          ← 엔진 신호의 타입 컨트랙트 (FileFacts, SymbolFacts, TaintPath, Incident, ...)
├── mock-engine.ts    ← 현재는 파일별 stand-in 데이터. 백엔드 연결 시 이 모듈만 교체
├── focus-store.ts    ← Inspector 모드 + scrollToLine + overlay open state
└── index.ts
```

위젯은 **직접 타입을 정의하지 않고** `@/entities/engine`에서 임포트한다. 이는 엔진 → UI 계약이며, UI를 건드리지 않고 backend를 연결할 수 있게 만드는 유일한 지점이다.

---

## 스타일 원칙

- **플랫** — 드롭 섀도우 최소, 1px border, `--border-strong` 강조, `--radius-sm|md`.
- **색은 의미로만** — `--warn` (#fdf8ee 페어), `--danger` (#fdf1f2 페어), `--accent` (blast/brand).
- **모노스페이스는 숫자/심볼** — 서수나 라벨은 sans, 측정값은 `--font-mono` + `tabular-nums`.
- **라벨은 작고 대문자** — 10px, `letter-spacing: 0.04em`, `--fg-subtle`.
- **애니메이션은 ≤140ms**, 호버 전이만 허용. 팝업 등장 애니메이션은 현재 off.

---

## 확장 지침

새 엔진 신호를 UI에 꽂을 때:

1. `entities/engine/types.ts`에 타입 확장 (또는 새 인터페이스).
2. `mock-engine.ts`에 stand-in 데이터 — 실제 엔진 출력 형태를 맞춘다.
3. L1~L4 중 맞는 레이어를 고르고 그 레이어의 컨벤션(파일 위치, 스타일 프리픽스, focus-store 연동)을 따른다.
4. 신호가 side-panel 깊이라면 Inspector에 모드를 추가하고 `focus-store.setMode`에 키를 등록.

**새 레이어를 만들지 말 것.** L1/L2/L3/L4 안에서 풀리지 않는 신호는 제품 범위 재검토가 먼저.
