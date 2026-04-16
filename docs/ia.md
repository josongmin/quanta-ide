
# 1. 제품 정의

**제품 한 줄**

코드 구조 이해, 변경 영향 분석, 팀 규칙 강제, 보안 흐름 탐지, PR 판단, 지식 연결, AI 보조를 통합한 소프트웨어 엔지니어링 인텔리전스 플랫폼.

**핵심 가치**

이 플랫폼은 단순 코드 뷰어나 에디터가 아니라, 아래를 수행하는 판단 시스템이다.

- 이 코드가 왜 위험한지 이해
- 이 변경이 어디까지 퍼지는지 분석
- 팀 규칙/아키텍처 규칙을 강제
- 보안 위험 경로를 탐지
- PR merge 전 의사결정을 지원
- 위키/ADR/RFC를 코드와 연결
- AI가 엔진 결과를 근거로 설명/리뷰/제안

---

# 2. 최상위 IA

좌측 글로벌 네비 기준:

```
Home
Analysis
Review
Policy
Security
Knowledge
Agent
Reports
Settings
```

각 항목 한 줄 정의:

1. **Home** — 조직/리포 전체 상태 요약
2. **Analysis** — 파일/심볼/서비스/플로우 분석
3. **Review** — PR, change intelligence, merge 판단
4. **Policy** — 엔지니어링 규칙/아키텍처 제약 관리
5. **Security** — 보안 규칙, source/sink, finding 관리
6. **Knowledge** — 위키, RFC, ADR, 런북, 규칙 설명
7. **Agent** — Codex-style 독립 에이전트 작업공간
8. **Reports** — 품질/리스크/위반/추세 리포트
9. **Settings** — 워크스페이스, 인덱싱, 권한, 통합 설정

---

# 3. 정보 구조 트리

## A. Home

목적: 전체 시스템 상태를 한 화면에서 파악

**주요 섹션**
- Organization Overview
- Risk Hotspots
- Recent Critical Changes
- Policy Violations Summary
- Security Findings Summary
- PR Queue Health
- Repo Health Ranking
- Knowledge Freshness
- Agent Activity Snapshot

**주요 위젯**
- Overall engineering health score
- Critical files/services 카드
- 위험도 상위 PR 리스트
- 최근 새로 생긴 위반/취약점
- 팀별 ownership imbalance
- 최근 실패한 rule gate
- 문서-코드 불일치 경고

---

## B. Analysis

목적: 코드 구조와 영향/흐름을 분석

### B-1. File Intelligence

파일 단위 분석

**보여줄 것**
- file summary
- complexity
- churn/history
- ownership
- incoming callers / outgoing calls
- taint summary
- blast radius
- dead code
- policy/security 연관 항목
- 관련 위키/RFC

**주요 액션**
- 왜 위험한지 설명
- 영향받는 파일 보기
- taint flow 열기
- dead code 보기
- 관련 규칙 보기
- agent에게 질문

### B-2. Symbol Intelligence

함수/클래스/메서드/변수 단위 분석

**보여줄 것**
- symbol definition
- references
- callers/callees
- type/role
- side effects
- dependency position
- data flow in/out
- impact if changed
- refactor candidates

**주요 액션**
- call graph 열기
- flow graph 열기
- safe change preview
- rename/extract 후보 보기
- 테스트 영향 보기

### B-3. Service / Module Intelligence

서비스/모듈 단위 분석

**보여줄 것**
- module summary
- dependency map
- exposed APIs
- critical entry points
- unsafe boundaries
- shared data paths
- instability/hotspot
- ownership concentration
- architecture violations

**주요 액션**
- boundary violations 보기
- upstream/downstream 영향 보기
- 위험 경로 drill-down
- 관련 runbook/RFC 보기

### B-4. Flow Explorer

호출/데이터/taint/보안 흐름 통합 화면

**탭**
- Call Flow
- Data Flow
- Taint Flow
- Auth / Privilege Flow
- Security Path (source-sink 시각화, sanitizer/guard 확인)
- Propagation Trace

**보여줄 것**
- source
- intermediate nodes
- sink
- sanitizer/guard
- confidence/evidence
- reachable path
- transitive edges

**주요 액션**
- 경로 축소/확장
- critical path만 보기
- new vs existing path 비교
- PR 기준 delta flow 보기

### B-5. Blast Radius

변경 영향 범위 분석

**보여줄 것**
- directly affected
- transitively affected
- critical path touched
- test impact
- service impact
- ownership impact
- deployment risk
- architecture score delta

**주요 액션**
- 영향 그룹핑
- 서비스 기준 보기
- risk basis 보기
- reviewer 추천 보기

### B-6. Code Health / Dead Code / Hotspots

건강도/정리 대상 화면

**보여줄 것**
- dead code candidates
- unused exports
- unstable hotspots
- high complexity zones
- ownership fragmentation
- duplicate logic
- flaky-risk area

---

## C. Review

목적: PR과 변경을 이해하고 merge 판단 지원

이건 초기 wedge이므로 가장 강해야 한다.

### C-1. PR Inbox

PR 목록과 상태

**주요 정보**
- risk score
- affected services
- new policy violations
- new security findings
- required reviewers
- merge readiness
- test gap
- change summary

### C-2. PR Detail / Review Workspace

핵심 화면

**상단**
- PR title / author / branch
- summary
- change size
- merge recommendation

**탭**

| 탭 | 주요 내용 |
|---|---|
| Overview | 변경 요약, 주요 위험 포인트, critical paths touched, review checklist, merge recommendation |
| Diff | 일반 diff, semantic diff, changed symbols/flows/contracts |
| Blast Radius | 영향받는 파일/서비스, transitive 영향, critical dependencies, runtime path 영향 |
| Policy | 새 위반/기존 위반, severity, owner, example fix, exception 여부 |
| Security | source-to-sink 경로, authz risk, PII/logging risk, injection/unsafe call, exploitability hints |
| Tests | 영향받는 테스트, 커버되지 않는 영역, 테스트 후보 추천, 회귀 위험 경로 |
| Knowledge | 관련 RFC/ADR/runbook, 팀 규칙 링크, 관련 incidents, past PRs |
| Agent Review | AI 리뷰 요약, 인라인 comment draft, reviewer 질문 추천, fix suggestion, PR description rewrite |

### C-3. Change Intelligence

PR이 아니어도 변경 세트 자체 분석

**객체**
- commit
- branch diff
- release candidate
- change proposal

### C-4. Merge Gate / Admission

최종 판단 영역

**보여줄 것**
- pass / hold / fail
- blocking reasons
- warnings
- required approvals
- policy blockers / security blockers
- missing tests
- unresolved questions

---

## D. Policy

목적: 팀의 엔지니어링/아키텍처 규칙을 정의하고 강제 (Policy Studio)

### D-1. Rule Library

규칙 목록

**분류**
- Architecture / Layering / Dependency / Ownership
- Reliability / Performance Guardrails
- Data Handling / Change Process

**카드 정보**
- rule name, type, severity, scope, owner
- active/inactive
- violations count, last triggered

### D-2. Rule Builder

규칙 생성 핵심 화면

**입력 방식**
- Natural Language
- Template
- Advanced DSL

**템플릿 예**
- forbidden dependency
- allowed-only path
- must-go-through abstraction
- no direct call to X from Y
- only team A can modify Z
- retry required before external call
- no write without idempotency
- no logging of sensitive payload

**빌더 요소**
- 대상 범위 (source scope / target scope)
- flow/path constraint
- allow/deny
- severity, owner
- exception policy
- PR gate toggle

### D-3. Rule Preview / Simulator

배포 전 미리보기

**보여줄 것**
- 예상 위반 수
- 예시 위반 코드
- false positive 샘플
- impacted repos/services
- diff vs previous rule version

### D-4. Violations

규칙 위반 탐지 결과

**기능**
- 필터 / triage
- assign owner
- mark accepted risk
- request exception
- link to PR

### D-5. Exceptions / Waivers

예외 관리

**포함**
- temporary / permanent waiver
- expiry date, approver, rationale
- linked incident or RFC

### D-6. Rule Docs

규칙 자체의 설명 문서

**포함**
- why this rule exists
- examples (bad/good patterns)
- related services / incidents
- enforcement timeline

---

## E. Security

목적: 보안 흐름과 취약 패턴을 쉽게 정의, 탐지, triage (Security Studio)

흐름 시각화는 Analysis > Flow Explorer (Security Path 탭) 에서 수행.

### E-1. Findings

탐지 결과 목록

**분류**
- Injection
- Auth / AuthZ
- Sensitive Data Exposure
- Logging Leakage
- SSRF / External Fetch
- Unsafe Deserialization
- Dangerous Exec
- Secret Handling
- Privilege Escalation
- Trust Boundary Violation

### E-2. Finding Detail

개별 finding 상세

**보여줄 것**
- summary, severity, confidence, reachability
- source, sink, sanitizer
- evidence path
- affected services / related PRs
- fix guidance

### E-3. Source / Sink Registry

보안 흐름 모델 정의

**구성**
- Sources / Sinks / Sanitizers / Guards
- Trust Boundaries
- Sensitive Types
- Privileged Operations

**예**
- HTTP request input → DB query execution
- logger / external fetch / shell exec
- token/PII classes / role guard functions

### E-4. Security Rule Builder

보안 규칙 생성

**입력 방식**
- 자연어 / 템플릿 / 고급 DSL

**템플릿 예**
- source to sink forbidden
- source to sink requires sanitizer
- privileged action requires guard
- sensitive data cannot enter logger
- external URL fetch must use allowlist wrapper

### E-5. Security Packs

CodeQL-style 팩 개념. 팀이 선택적으로 켜고 커스터마이징 가능.

**예**
- Web API pack / Payments pack / Auth pack
- PII pack / Logging pack / Infra pack

### E-6. Triage / Exceptions

정탐/오탐 처리

**상태**
- open / accepted risk / false positive / fixed / waived / needs review

---

## F. Knowledge

목적: 코드와 문서를 연결해 "살아있는 위키"를 만드는 영역

### F-1. Wiki Home
- 문서 검색
- 최근 변경 / stale docs / code-linked docs
- popular runbooks

### F-2. Architecture Docs
- system overview
- service boundaries / module relationships
- deployment topology / dependency rationale

### F-3. ADR / RFC
- architectural decisions / engineering RFCs
- status / impacted modules / linked rules / linked PRs

### F-4. Runbooks
- incidents / operations / recovery paths
- owning teams / linked services

### F-5. Rule Knowledge

Policy/Security 규칙 설명 영역

### F-6. Code-Linked Knowledge View

특정 파일/심볼/서비스 기준으로 관련 문서 표시

예 — `orchestrator.py`를 보고 있으면:
- 관련 architecture doc
- 관련 security playbook
- 관련 PR / incident / RFC

### F-7. Knowledge Freshness

문서가 실제 코드와 얼마나 맞는지 추적

**보여줄 것**
- stale knowledge
- code changed after doc
- doc references missing symbols
- undocumented critical paths

---

## G. Agent

목적: 엔진 결과를 컨텍스트로 삼는 Codex-style 독립 작업공간.
단순 Q&A가 아니라 멀티스텝 태스크를 실행하고 결과를 저장하는 전용 인터페이스.

### G-1. Ask

자연어 질의 및 멀티턴 대화

**예**
- 왜 이 파일이 위험하지?
- taint flow 설명해줘
- 이 PR의 핵심 리스크는 뭐야
- payment 쪽 팀 규칙 위반 찾아줘
- 이 서비스 구조 요약해줘

### G-2. Explain

엔진 결과 해설

**기능**
- rule violation explanation
- finding explanation
- blast radius explanation
- architecture violation reasoning

### G-3. Review Assistant

리뷰어 보조 태스크

**기능**
- PR 요약 작성
- comment draft
- reviewer questions
- 승인/보류 근거 정리
- 놓친 테스트 제안

### G-4. Refactor Assistant

분석 기반 리팩토링 제안

**기능**
- refactor candidates
- dependency cleanup
- dead code removal plan
- layering repair proposal
- abstraction extraction proposal

### G-5. Rule Assistant

규칙 초안 생성

**기능**
- 자연어 → policy rule
- 자연어 → security rule
- false positive 줄이기 제안
- scope tuning 제안

### G-6. Knowledge Assistant

위키/RFC 문서화 보조

**기능**
- architecture note draft
- runbook draft
- rule explanation doc
- PR description rewrite

---

## H. Reports

목적: 리더/플랫폼팀/보안팀용 관제와 추세

### H-1. Engineering Health
- complexity trend / hotspot trend
- ownership imbalance / dead code trend / architecture drift

### H-2. Policy Compliance
- violations over time
- top broken rules
- teams with most violations
- waived vs fixed ratio

### H-3. Security Posture
- findings over time
- severe flows / open critical items
- most exposed services

### H-4. Review Efficiency
- review time
- false positive burden
- PR risk vs outcome / blocked merges

### H-5. Knowledge Coverage
- documented critical systems
- stale docs / undocumented hotspots

---

## I. Settings

**하위 영역**
- Workspace Settings
- Repo Integrations
- Indexing / Snapshot
- Teams / Ownership
- Policies / Security Defaults
- Notification / Gate Settings
- Roles / Permissions
- Audit Logs

---

# 4. 핵심 객체 모델

이 제품은 화면보다 객체가 중요하다.

**Core Entities**
- Repository / Service / Module / File / Symbol
- Flow / Rule / Violation / Security Finding
- PR / Change Set / Blast Radius / Test Impact
- Knowledge Doc / Incident
- Team / Owner / Exception-Waiver
- Agent Session

---

# 5. 주요 사용자별 진입 흐름

**1) 리뷰어**
Review → PR Detail
→ summary → blast radius → policy/security 탭 → 테스트 갭 → agent review → 승인/보류 판단

**2) 플랫폼/아키텍처 팀**
Policy → Rule Builder
→ 규칙 생성 → preview → false positive 점검 → rollout → violations 모니터링

**3) 보안팀**
Security → Findings / Source-Sink Registry
→ security pack 활성화 → source/sink 모델링 → finding triage → PR gate 연동

**4) 시니어 엔지니어**
Analysis → File / Symbol / Flow Explorer
→ 특정 파일 위험성 분석 → 영향 범위 파악 → 리팩토링 포인트 확인 → 관련 knowledge 확인

**5) 엔지니어링 리더**
Home / Reports
→ 리포/팀 health → hotspot → 위반 추세 → 보안 posture 확인

**6) AI 집중 작업자**
Agent
→ 태스크 정의 → 멀티스텝 실행 → 결과 저장 → 후속 질의

---

# 6. 공통 레이아웃 구조

모든 주요 화면에 공통 적용되는 4-영역 구조:

| 영역 | 역할 | 주요 내용 |
|---|---|---|
| 좌측 | 탐색 | repo tree, file tree, entity filters, saved views |
| 중앙 | 주 분석 대상 | 코드, symbol, flow, diff, 문서 본문 |
| 우측 | 판단/근거 인스펙터 | risk, violations, findings, ownership, related docs, recommended actions |
| 하단 | agent / evidence | ask agent, current analysis state, prior reasoning steps, saved insights |

이 구조면 IDE처럼 보여도, 본질은 분석/판단 UI가 된다.

---

# 7. MVP 범위

IA는 크게 잡되, 실제 빌드는 단계적으로.

**Phase 1**
- Analysis: File Intelligence, Flow Explorer, Blast Radius
- Review: PR Detail (Risk Summary + Policy/Security/Test 탭)
- Policy: Rule Library, Rule Builder, Violations
- Security: Findings, Source/Sink Registry
- Agent: Explain, Review Assistant

**Phase 2**
- Service/Module Intelligence
- Exceptions/Waivers
- Security Packs
- Knowledge code linking
- Reports

**Phase 3**
- Advanced DSL
- Rule simulator sophistication
- Change trend analytics
- Refactor assistant
- Living wiki freshness model

---

# 8. 핵심 철학

이 제품은 "에디터 대체물"이 아니다.

**본질**
코드를 편집하는 UI가 아니라
코드와 변경을 **이해**하고
리스크를 **판단**하고
팀 규칙/보안을 **강제**하고
지식을 **연결**하고
AI가 그것을 **증폭**하는 플랫폼.

**중심 5축**
```
Analysis → Governance (Policy + Security) → Review → Knowledge → Agent
```
