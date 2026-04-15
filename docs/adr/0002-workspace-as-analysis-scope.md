# ADR 0002 — Workspace as Analysis Scope Boundary

**날짜**: 2026-04-15
**상태**: Accepted
**작성**: Jo + Claude

---

## Context

[ADR 0001](0001-workspace-as-work-unit.md) 에서 Workspace 를 최상위 작업 단위(공유/권한/탭 컨테이너)로 확정했다. 그러나 Workspace 가 갖는 의미는 "공유 단위" 에 머물지 않는다.

엔진이 내놓는 신호(taint flow, blast radius, arch rules, incident DNA, behavior diff, ownership)는 **"내 코드" 와 "외부" 의 경계** 를 안다는 전제에서만 의미를 가진다. 이 경계가 암묵적이면:

- **Taint** — 라이브러리 함수를 sink 로 볼지, 통과점으로 볼지, sanitizer 로 볼지 결정 불가. 보통 과소 분석(놓침) 또는 과잉 분석(노이즈)이 됨.
- **Blast** — node_modules 쪽으로 무한 전파되거나, 반대로 중요한 내부 서비스 호출에서 끊김.
- **Arch rules** — "UI 가 DB 를 직접 호출했다" 같은 룰을 검증하려면 "무엇이 DB 인가" 를 알아야 함.
- **Incident DNA** — 과거 장애가 특정 lib/service 와 연관될 때, 현재 코드가 그 lib 을 쓰는지 판별해야 함.

즉 분석 품질은 "외부 세계가 어디서 시작되는지" 를 명시적으로 모델링하는 데 달려 있다. 현재 이 경계는 어디에도 선언되어 있지 않다.

한편 이 경계는 **워크스페이스와 자연스럽게 정렬**된다:

- 의존성은 리포/프로젝트 단위로 관리됨 (package.json, go.mod, Cargo.toml, requirements.txt, …).
- 팀은 "우리 시스템" 의 경계를 공유 인식으로 갖는다 (어느 서비스가 우리 것, 어느 lib 이 우리 것).
- 내부 크로스-리포 의존(예: order-service → payment-service) 은 팀 수준에서만 정확히 알 수 있다.

따라서 Workspace 에 "외부 의존성 레지스트리" 를 1급 개념으로 얹는 것이 논리적 귀결이다.

## Decision

**Workspace 는 정적분석의 스코프 경계를 선언하는 단위다.** 모든 엔진 분석은 워크스페이스의 의존성 레지스트리 위에서 수행된다.

### 의존성 레지스트리

워크스페이스는 다음을 관리한다:

```
Workspace
 └── Dependencies
      ├── Auto-detected   — 빌드 매니페스트 / import 그래프 파싱 결과
      └── Manual          — 사용자/팀이 추가·덮어쓴 선언
```

각 의존성 엔트리는 **분석에 쓰이는 메타** 를 갖는다:

| 필드 | 의미 |
|------|------|
| `id` | 패키지/서비스 식별자 (예: `npm:express`, `internal:payment-service`) |
| `kind` | `library` / `service` / `datastore` / `runtime` |
| `scope` | `external` / `internal-cross-repo` / `vendored` |
| `taint_role` | `source` / `sink` / `sanitizer` / `passthrough` (함수 단위 세부 규칙 가능) |
| `arch_layer` | 해당 의존성이 속한 레이어 태그 (UI/Core/Infra/DB 등) |
| `incident_refs` | 연관된 과거 장애 패턴 ID |
| `notes` | 팀이 남기는 설명 |

### 감지 방식

1. **자동 감지 (Auto)**
   - 빌드 매니페스트 파싱: `package.json`, `go.mod`, `Cargo.toml`, `requirements.txt`, `pyproject.toml`, `pom.xml`, …
   - Import 그래프 분석: 실제 코드에서 참조되는 외부 심볼.
   - 엔진의 well-known DB: 흔한 lib(`express`, `pg`, `axios` 등)의 기본 taint 역할 프리셋 제공.

2. **수동 선언 (Manual)**
   - 자동 감지 결과를 **오버라이드**. 예: "우리 팀은 이 HTTP 클라이언트 래퍼를 통해서만 외부 호출한다 → sanitizer" 와 같은 팀-특유 규약.
   - **크로스-리포 연결**: "이 URL 로 나가는 호출은 사실 우리 payment-service 리포다" — 외부 호출을 내부 call graph 로 승격.
   - **신규 lib 추가**: 엔진이 모르는 lib 의 역할 선언.

수동 선언이 자동 감지를 항상 이긴다. 팀의 의도가 우선.

### 분석 파이프라인 연동

| 분석 | Workspace 레지스트리 사용 방식 |
|------|-------------------------------|
| Taint | source/sink/sanitizer 표시. 미지정 외부 호출은 보수적 passthrough + 경고 |
| Blast | `scope=external` 경계에서 전파 중단. `internal-cross-repo` 는 연결된 리포로 이어감 |
| Arch rules | `arch_layer` 태그로 레이어 위반 판정 |
| Incidents | `incident_refs` 로 현재 코드가 과거 장애 패턴과 매칭되는지 판정 |
| Cost / Big-O | 외부 호출의 비용 모델 lookup (런타임/네트워크/DB) |
| Dead code | 외부로 export 되는 경계 식별(dead 여부 판단의 기준점) |

### 공유 단위 정렬

의존성 레지스트리는 **워크스페이스 자원** 이므로 팀과 공유된다. 개인 로컬 오버라이드는 별도 레이어로 (user-scoped override), 공유 레지스트리를 깨지 않는다.

### IDE 노출 (요약)

상세 UI는 별도 RFC로 다루되, 최소 진입점:

- **Dependencies 탭 타입** (Feature Registry 등록) — 워크스페이스 안의 탭으로 진입.
- **L2 hover 기여** — 외부 심볼 hover 시 "이 의존성은 `source`로 선언됨 / 감지됨" 뱃지.
- **L1 passive** — 호출-사이트 글리프에 의존성 분류 반영.

## Consequences

### 장점

- **분석 정밀도의 천장이 올라간다** — 경계가 선언되어야 taint/blast/arch 모두가 정확해진다. Workspace 가 이 선언을 담을 유일하게 자연스러운 위치.
- **"코드를 이해하는 인프라" 포지셔닝 강화** — Workspace 가 단순 UI 컨테이너가 아니라 **분석 컨텍스트의 루트** 임이 드러남.
- **팀 공유와 정렬** — 경계 인식은 팀 자산이다. 워크스페이스 공유와 같은 스코프로 공유됨.
- **크로스-리포 분석 가능성** — 내부 서비스 호출을 실 call-graph 로 이어 분석 가능 (마이크로서비스 환경에서 결정적).
- **과거 장애 재현 방지의 근거** — Incident DNA 매칭에 의존성 식별이 필수.

### 비용

- **레지스트리 스키마와 저장소 설계 필요** — 자동/수동/오버라이드 3층을 병합하는 규칙을 확정해야 함.
- **엔진 ↔ 레지스트리 인터페이스 정의** — 분석 실행 시 레지스트리를 로드/조회하는 경로.
- **well-known preset 큐레이션 비용** — 흔한 lib 의 기본 taint 역할 프리셋을 관리해야 유용. 초기엔 작게.
- **UI 작업** — Dependencies 탭/뷰 추가. 자동 감지 결과의 시각화, 수동 오버라이드 편집 UX.
- **성능** — 대규모 리포에서 import 그래프 파싱 비용. 증분 갱신 전략 필요.

### 비(非)영향

- [ADR 0001](0001-workspace-as-work-unit.md) 의 공유/탭 모델은 변경 없음. 이 ADR 은 Workspace 가 **추가로** 갖는 의미를 정의.
- [overlay architecture](../rfc/2026-04-14-overlay-architecture.md) 의 L1~L4 구조는 그대로. 의존성 메타는 기존 레이어에 주입될 데이터.
- [Agent Rules Manager](../rfc/2026-04-15-agent-rules-manager.md) 와 독립. 룰은 에이전트용, 레지스트리는 엔진용.

## 확정 사항

- **Workspace 는 분석 스코프의 루트다.** 엔진은 워크스페이스 컨텍스트 없이 분석을 수행하지 않는다.
- **의존성 레지스트리 = 자동 감지 + 수동 선언, 수동 우선.**
- **크로스-리포 내부 의존은 1급 대상.** 외부 호출로 취급하지 않는다.
- **레지스트리는 팀 공유 자원.** 개인 오버라이드는 별도 레이어.

## 열린 질문

1. **레지스트리 저장 위치** — 리포 내부(`.quanta/deps.toml`) vs. 워크스페이스 원격 저장소. 1차는 리포 내부, 팀 공유는 git 으로.
2. **자동 감지와 수동 선언의 diff UX** — 자동 결과가 바뀌었을 때 수동 오버라이드가 여전히 유효한지 표시하는 방식.
3. **well-known preset 배포 형태** — 엔진 번들 vs. 플러그인 vs. 원격 카탈로그.
4. **함수 단위 taint 역할** — 패키지 전체가 아니라 특정 함수만 sink 인 경우의 스키마 세분도.
5. **런타임 의존 감지** — 정적 매니페스트에 안 잡히는 런타임 로드(플러그인, DI 컨테이너) 를 어떻게 보완할지.
6. **외부 API 스펙 연동** — OpenAPI/gRPC proto 를 레지스트리에 통합해서 호출 시그니처까지 분석에 넣을지.

---

## 참고

- [ADR 0001 — Workspace as Top-Level Work Unit](0001-workspace-as-work-unit.md)
- [RFC — Overlay Architecture](../rfc/2026-04-14-overlay-architecture.md) — 분석 신호 노출 레이어
- [RFC — Flow-Aware Analysis Surfacing](../rfc/2026-04-12-flow-aware-analysis-surfacing.md)
- [RFC — Agent Rules Manager](../rfc/2026-04-15-agent-rules-manager.md) — Feature Registry 의 확장 드라이버
