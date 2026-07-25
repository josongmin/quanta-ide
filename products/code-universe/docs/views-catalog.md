# Code Universe — 분석 뷰 카탈로그 (150)

**자동 생성** (`docs/generate-views-catalog.py`) — 2026-04-24.  
**행 소스:** 각 feature `view.tsx`의 `ViewDescriptor` 필드 — `hint`(목적), `usecase`(언제/의도), `tech`(기반).  
**개수**는 `view-mode/model/view-registry.tsx`의 `VIEW_DESCRIPTORS`와 일치해야 합니다.  
**참고:** `features/code-city/view.tsx`는 3D 씬 전용(Descriptor 없음)이며, 캔버스 모드 `code-city-3d`는 `code-city-3d/view.tsx`에 있습니다.

## 카테고리 요약

| 카테고리 | 개수 | 한 줄 목적 | 주로 쓰는 시점 |
|---|---:|---|---|
| ai | 57 | 에이전트/LLM 비용·품질·리스크·라우팅 | AI 도입·에이전트 운영·감사·게이트 |
| arch | 5 | 경계·API·패키지 구조 건강 | 아키텍처 리뷰·MS 분리·레이어 점검 |
| deps | 13 | 의존성·호출·흐름 | 핫픽스 영향, 리팩터 경로, 그래프 탐색 |
| explore | 14 | 구조/공간 시각으로 온보딩·스캔 | 새 팀원, 전체 맵, 유사 모듈 찾기 |
| history | 18 | 시간 축·진화·공동 변경 | 회고, 귀책, 트렌드, 히스토리 리뷰 |
| metrics | 18 | 정적 지표·테스트·복잡도 | 스프린트 품질·핫스팟·릴리즈 점검 |
| quality | 5 | DORA/부채/게이트/DevEx | 경영/릴리즈/파이프라인 건강 |
| refactor | 9 | 객체 지향/중복/시뮬/ROI | 리팩터 백로그·안전한 분리·사전 시뮬 |
| security | 4 | 취약점·의존성·SBOM | 보안 릴리즈·공급망 감사 |
| team | 7 | blame·리뷰·팀 리스크 | 담당자, 리뷰 라우팅, 버스 팩터 |

---

## ai (57)

| id | label | 목적 (hint) | 언제 사용 (usecase) | 기반/데이터 (tech) |
|---|---|---|---|---|
| `agent-orchestra` | Orchestra | 다중 에이전트 파이프라인 | 단일 LLM보다 분업이 효과적인 복잡 태스크. 역할별 최적 모델 라우팅. | 5-role pipeline (planner→coder→reviewer→tester→documenter) |
| `agent-roi` | ROI | AI 투자 대비 수익 — 월별 누적 | 경영진 보고. 'AI 이 얼마 썼는데 얼마 벌었나' 수치화. | cost × PRs merged × bugs fixed 시계열 |
| `agent-success` | Agent | 에이전트 성공 확률 — 태스크 × 파일 | AI 에이전트에 맡겨도 되는 파일 vs 사람 개입 필요 파일 구분. | coverage × size × complexity × friendliness composite |
| `agent-trajectory` | Trace | 에이전트 실행 트레이스 — step-by-step | 에이전트가 뭘 했는지 재구성. 실패 스텝 디버깅. | Langsmith/Traceloop 스타일 agent trace |
| `agentability` | AgentFit | 이 파일/태스크를 agent에게 맡길지 말지 score로 판단 | AI-first / chunk-first / human-first 라우팅을 파일 단위에서 결정. | success × horizon × verification × blind-spot × context-load composite |
| `ai-authorship` | AIAuthor | AI 작성 비율 — 파일별 기원 | AI 의존도 감사. 리스크 있는 고AI 파일 identify. 팀 거버넌스. | commit co-author × style signature 휴리스틱 |
| `ai-friendliness` | Friendly | AI 친화도 × 토큰 비용 scatter | 'AI가 이 파일 못 읽을 것 같다' 직관을 수치화. 온보딩 순서 결정. | 토큰 추정 × 6-factor 친화도 composite |
| `anticipate` | Anticip | 선제 예측 액션 — 다음에 뭐 할지 | agent가 미리 준비한 액션 체감 latency 감소. 'just-in-time' 에이전트. | trigger detection × speculative compute × confidence |
| `attention-map` | Attention | 어텐션 맵 — 모델이 실제 주목한 라인 | 모델이 이 파일 어디를 '보고 있는지'. 수정 시 어떤 라인이 영향력 있는지. | mechanistic interpretability × per-line attention weight |
| `audit-trail` | Audit | 감사 로그 — 에이전트의 모든 액션 | 보안 감사. '에이전트가 뭘 건드렸나' 타임라인. 규제 대응. | SOC2 audit log × action kind × outcome |
| `benchmark-gap` | BenchGap | 우리 repo vs 공개 벤치마크 격차 | 'SWE-bench 60%' → '우리 repo 20%'. 에이전트 배포 기대치 현실화. | SWE-bench Verified × SWE-Lancer × agentSuccessProbability 대조 |
| `blast-radius-agent` | Scope | 에이전트 scope 위반 — 의도 vs 실제 | 에이전트가 지시 범위 벗어났나 감사. 안전성 지표. | intended file set × actual edit set diff |
| `blind-spot` | Blind | 모델이 모르는 걸 모르는 지역 | 에이전트가 confabulate할 지역 선제 식별. 리뷰 우선순위. | 독점 API × 신규 lib × 내부 DSL × 도메인 특수성 composite |
| `budget-console` | Budget | AI 예산 콘솔 — 월별 거버넌스 | AI 비용 통제. 초과 알림. 팀별 쿼터 관리. | FinOps × 카테고리별 breakdown × 프로젝션 |
| `cache-roi` | CacheROI | 프롬프트 캐싱 ROI 시뮬 | AI 에이전트 반복 호출 비용을 캐싱으로 얼마 줄일 수 있나. IDE 통합 ROI. | churn 기반 stable/volatile 분리 × 90일 비용 시뮬 |
| `catalog-admin` | Catalog | analysis catalog 메타데이터를 관리하는 범용 운영면 | 엔진이 등록한 분석 catalog의 커버리지, 게이트 적합성, hygiene debt를 한 번에 확인. | catalog metadata × domain/scope matrix × workflow-stack coverage |
| `compounding-error` | Compound | 체인 길어질수록 무너짐 — per-step × chain length | 왜 에이전트가 복잡한 태스크에서 망가지나. chain 줄이기 / per-step 높이기 결정. | p^k 합성 정확도 곡선 × 태스크별 관찰된 chain length |
| `context-curator` | Curate | 컨텍스트 큐레이터 — 수동 pin/exclude | 에이전트가 볼 파일 수동 통제. 노이즈 제거. 비용 최적화. | 파일별 상태 토글 × 슬라이스 로드 × 토큰 예산 |
| `context-footprint` | Context | 컨텍스트 footprint — transitive import 비용 | 이 파일 하나 AI가 이해하려면 몇 토큰 필요한가. 인터페이스만으로 줄이면? 비용 최소화. | BFS import graph × tiktoken 추정 |
| `context-rot` | Rot | 장기 컨텍스트 성능 감쇠 — Lost in the Middle | RAG/에이전트 컨텍스트 넣을 때 순서 최적화. 긴 컨텍스트 안에서 사라지는 파일 식별. | U-shape position bias 모델링 × 파일별 감도 |
| `context-shape` | Shape | 컨텍스트 shape — 프롬프트 구조 최적화 | Lost-in-Middle 회피 + prompt caching 최적화. 새 워크플로우 설계 시 가이드. | 순서 × 토큰 예산 × 위치 bias 인식 |
| `context-waste` | CtxWaste | 실제로 안 쓰인 토큰과 middle-loss 위험을 보여줌 | 긴 프롬프트가 왜 비싸고 왜 성능을 깎는지 slice 단위로 확인. | context slice utilization × minimum viable prompt × freshness risk |
| `context-window-fit` | ContextFit | 컨텍스트 윈도우 적합성 | 어떤 파일이 어떤 모델에 fit하는가. 모델 선택 가이드. | 파일 토큰 vs 128K/200K/1M/2M 한계 |
| `convergence-score` | Converge | 에이전트 수렴성 — 같은 태스크 반복 결과 일관성 | 자동화 후보 선별. 수렴 낮으면 사람 개입 필요. | 성공률 × 솔루션 다양성 composite |
| `counterfactual` | What-If | 대조 가정 — 'if X instead of Y' | 에이전트 결정의 민감도 파악. '왜 이 선택했는지' 역추론. | counterfactual prompt × 예측 결과 × confidence delta |
| `decision-log` | ADR | 아키 결정 로그 — ADR | 과거 결정 문서화. 에이전트가 이 규칙들을 준수하도록 컨텍스트. | Nygard ADR 2011 × MADR 포맷 |
| `determinism-drift` | Drift | 동일 프롬프트 출력 표류 — 주간 | 모델 업데이트가 내 워크플로우 망가뜨리는 순간 포착. | 12주 output hash bucket × drift 이벤트 감지 |
| `diff-evidence` | DiffProof | 각 diff hunk가 어떤 test / spec / trace에 기대는지 보여줌 | 코드 리뷰 때 '왜 이 수정이 정당한가'를 hunk 단위로 검증. | support score × evidence kind matrix × unsupported claim count |
| `eval-contamination` | Contam | 학습 데이터 contamination 감사 | 이 코드 모델이 봤을 확률. 벤치마크 허수 방지. | public repo × star × age × pattern popularity |
| `hallucination-risk` | Halluc | LLM 환각 리스크 — API 희귀도 × 문서 부재 | AI가 거짓 API 지어낼 가능성 높은 파일 식별. 문서화 우선순위. | API entropy × doc density × dynamic dispatch × generic types |
| `memory-vault` | Memory | 에이전트 메모리 금고 | 에이전트가 이 repo만의 규약/함정을 기억. 매 세션 재설명 불필요. | team-curated + agent-inferred facts × confidence × verification |
| `message-code-mismatch` | MsgCode | PR 설명과 실제 코드 변화가 얼마나 어긋나는지 추적 | AI가 설명은 그럴듯하지만 코드는 다른 방향으로 바꾼 경우를 빠르게 잡음. | statement-by-statement alignment × mismatch rationale |
| `model-router` | Router | 모델 라우팅 — task × 정확도 × 비용 최적화 | Sonnet으로 다 때리지 말고 싼 모델로 넘길 수 있는 태스크 식별. | FrugalGPT × RouteLLM 스타일 per-task model selection |
| `model-swap-sim` | ModelSwap | 모델 교체 시뮬레이션 | frontier 모델 deprecated 되기 전 이식성 확인. 비용/정확도 trade-off. | 태스크별 success × cost 교체 영향 분석 |
| `planning-horizon` | Horizon | 태스크별 계획 지평선 — 몇 step까지 reliable | 복잡 태스크 쪼개기 결정. 'refactor는 6 step 이하로 분해'. | per-step accuracy^k × task-specific curves |
| `prompt-injection` | Injection | 프롬프트 주입 공격면 | 2025 OWASP Top 1 LLM vuln. 보안 감사 필수. | untrusted source → LLM sink data-flow |
| `prompt-simulator` | Simulate | 프롬프트 시뮬레이터 — 태스크별 비용 예측 | AI 에이전트 작업 돌리기 전 비용 가늠. 어떤 task가 얼마나 비싼지 실시간. | hop-depth × task-dependent output-ratio × 2026 pricing |
| `readiness-score` | Ready | 에이전트 투입 준비도 | AI 대시보드 핵심. 'AI 돌리기 전 뭘 먼저 손봐야?' 답. | docs×tests×types×naming×commits×arch 6-factor composite |
| `red-team` | RedTeam | 적대적 프롬프트 안전성 테스트 | deploy 전 안전성 감사. 실패 테스트 = 즉시 fix. | OWASP LLM Top 10 × refusal/sanitize 예상 vs 실제 |
| `replay-theater` | Replay | 에이전트 세션 재생 극장 | 에이전트 과거 실행 재현. 왜 실패했나 타임라인 재연. | step timeline × scrubber × play controls |
| `review-burden` | RevLoad | AI PR 양과 인간 리뷰 capacity 간의 충돌을 보여줌 | AI 도입 후 팀이 실제로 리뷰 가능한 양을 넘었는지 판단. | review minutes × capacity × deep-review rate × auto-merge risk |
| `semantic-neighbors` | SemNeigh | 의미 임베딩 이웃 — 구조 유사 아닌 의미 유사 | 구조적 twin 못 잡는 의미 유사 발견. 중복 개념 clustering. | CodeBERT / ada-002 임베딩 × 코사인 거리 |
| `skill-atrophy` | Atrophy | 개발자 AI 과의존 트렌드 | 팀 건강성. 'AI 없으면 코딩 못 함' 단계 예방. | AI 비율 상승 × 인간 LoC 하락 composite 지수 |
| `skill-library` | Skills | 재사용 가능 agent skill 카탈로그 | skill 조합으로 복잡 태스크 구성. 재사용 + 테스트 가능. | composable skill 그래프 × 입출력 명세 |
| `spec-gaming` | Gaming | Reward Hacking 패턴 탐지 | 에이전트가 '통과만 시키는' 변경 탐지. 리뷰 critical. | test edit × mock 과다 × assertion 완화 × skip × loose types |
| `stuck-pattern` | Stuck | 에이전트 고립 패턴 — 반복 실패 | 에이전트 사용 불가능 상태 진입 조건 식별. 자동 개입 규칙 트리거. | 4-pattern 분류 × repeat count × escape verdict |
| `task-composer` | Compose | 태스크 작성기 — 자연어 → 에이전트 작업 | 태스크 만드는 시간 단축. 컨텍스트 자동 추천. | NL → task-kind 분류 × 파일 추천 × 비용 프리뷰 |
| `task-graph` | TaskGraph | 태스크 의존성 그래프 | 어떤 태스크 먼저 끝내야 하나. 병목 의존 시각화. | task dep DAG × 위상정렬 × critical path |
| `task-kanban` | Kanban | 에이전트 태스크 칸반 | 상태별 태스크 흐름. 병목 지점 가시화. | 4-column + WIP limit |
| `task-queue` | Queue | 에이전트 태스크 큐 | 실행 대기 / 진행 중 / 리뷰 대기 태스크 한 화면. 우선순위 관리. | status × priority × task-kind 필터 |
| `thinking-budget` | Thinking | 추론 토큰 예산 — o1 / Claude Extended | reasoning 모델 사용 시 thinking budget 최적화. plateau 넘으면 낭비. | thinking vs output 토큰 분해 × plateau 감지 |
| `token-economy` | Economy | LLM 토큰 경제 — repo 전체 비용 | AI 에이전트 월 비용 예측. 가장 비싼 파일 감사. '이 repo를 AI가 돌리려면 얼마?' 답. | tiktoken/claude 기반 추정 × 2026 모델 가격 |
| `tool-profile` | Tools | 도구 사용 프로파일 — 파일별 tool 분포 | 에이전트가 이 파일에 어떤 tool 많이 쓰나. bash 비중 높으면 테스트 driven. | AgentStep.toolName × 집계 (6 태스크 aggregated) |
| `trajectory-decompose` | TrajDx | search / read / edit / verify / recover 단계별 실패 분해 | 에이전트가 왜 망가졌는지 pass/fail 대신 단계별로 진단. | trajectory stage precision·recall × overread ratio × bottleneck detection |
| `turn-depth` | Turns | 턴 깊이 · 재계획 빈도 | 자주 재계획하면 brittle. 태스크 복잡도 현실 체크. | 태스크별 p50/p95 turn × replan rate |
| `uncertainty-map` | Uncert | 모델 신뢰도 캘리브레이션 | 'AI가 sure하다'를 얼마나 믿어야 하는가. overconfident 지역 식별. | claimed confidence vs measured accuracy |
| `verification-surface` | Verify | AI 검증 표면 — 테스트 × 심볼 밀도 | 에이전트가 자기 변경을 스스로 검증할 수 있는가. Self-correction 가능 여부 판단. | assertion/symbol 비율 × 커버 심볼 % |

## arch (5)

| id | label | 목적 (hint) | 언제 사용 (usecase) | 기반/데이터 (tech) |
|---|---|---|---|---|
| `api-surface` | API | 공개 API 표면 감사 | 안 쓰이는 public API 찾기. 인터페이스 축소 후보. | export 심볼 × 외부 import 교차 분석 |
| `arch-layers` | Layers | 아키텍처 레이어 간 의존 흐름 | 레이어 위반(하위가 상위를 import) 감지. FSD/클린 아키텍처 준수 여부 모니터링. 신규 파일 추가 시 레이어 배치 검증. | 레이어 분류 + 의존 방향 위반 감지 |
| `layer-audit` | Layer | 레이어 위반 감사 | 아키텍처 경계를 넘는 import 즉시 탐지. CI 대신 시각적 감사. | FSD 규칙 × 의존성 그래프 검증 |
| `package-instability` | I/A | Martin I/A — 불안정성 × 추상성 | 아키 건강도. Zone of Pain / Uselessness 식별. | Ca/Ce fan-in/fan-out × main-sequence distance |
| `service-topo` | Services | 패키지 간 서비스 토폴로지 | 마이크로서비스 경계와 실제 코드 구조 일치 여부 확인. API 의존 방향이 설계 의도와 맞는지 검토. 서비스 분리/통합 계획 수립. | 모듈 경계 + 공개 API 의존성 |

## deps (13)

| id | label | 목적 (hint) | 언제 사용 (usecase) | 기반/데이터 (tech) |
|---|---|---|---|---|
| `arc-cycles` | Cycles | 역방향 엣지(순환 의존) 아크 다이어그램 | 순환 의존이 어디서 발생하는지 시각적으로 추적. SCC 내 파일 한 번에 확인. 순환 끊기 작업 전 영향도 파악. | Tarjan SCC — 강결합 컴포넌트 |
| `blast` | Blast | 선택 파일의 변경 영향 범위 | '이 파일 바꾸면 뭐가 깨지나' 즉시 확인. 핫픽스 전 영향 범위 검토. 테스트 범위 결정(어느 테스트까지 돌려야 하나). | 역방향 전이 의존성 BFS |
| `call-graph` | Calls | 호출/임포트 그래프 — 전체 repo | 어디서 호출되고 어디로 호출하나 한눈에. IDE의 기본. | file-edges × layered layout |
| `change-impact` | Impact | 변경 영향 — 전이적 도달 집합 | 리팩터링 전 '이 파일 바꾸면 몇 개 파일 영향?' 정확한 closure. | BFS over 의존성 그래프 |
| `chord` | Chord | 패키지 간 의존성 강도 시각화 | 패키지 간 결합도가 심한 곳 식별. 순환 의존 발생 위험 영역 조기 감지. 마이크로서비스 분리 전 경계 적합성 검토. | 패키지-레벨 의존성 집계 |
| `control-flow` | CFG | 함수 제어흐름 그래프 | 복잡한 함수의 내부 구조 시각화. 리팩터 전 cognitive load 측정. | AST basic-block 분석 |
| `failure-flow` | Flow | 에러 전파 경로 | 잘못 흐르는 에러 / uncaught 식별. 안정성 감사. | throw/catch AST 스캔 × 함수 그래프 |
| `matrix` | Matrix | DSM — 의존성 격자 행렬 | 의존 방향이 올바른지(상위→하위) 셀 단위로 검토. 순환 의존을 정확한 파일 쌍으로 찾기. 아키텍처 리뷰 미팅 자료. | Design Structure Matrix |
| `neighborhood` | Halo | N-홉 이웃 관계 링 | 특정 파일의 직접/간접 이웃 파악. '이 파일 주변 생태계' 이해. 격리 리팩터링 전 영향 경계 설정. | N-홉 의존성 그래프 탐색 |
| `pathfinder` | Path | 두 파일 사이 의존 경로 탐색 | 'A가 B를 왜 알고 있지?' 의존 경로 추적. 의도치 않은 간접 의존 발견. 모듈 분리 시 끊어야 할 경로 확인. | 의존성 그래프 BFS 최단 경로 |
| `program-slice` | Slice | 프로그램 슬라이스 — 영향 역추적 | 버그 수정 시 '이 값 어디서 왔나/어디로 가나' 정확히. | 데이터플로우 역/정방향 도달 분석 |
| `symbol-fan` | SymFan | 심볼 부채꼴 — caller × callee | 이 함수 누가 부르고 누가 불리나 즉시 파악. 리팩터 전 체크. | ego call graph × 부채꼴 layout |
| `symbol-usage-map` | SymUsage | 심볼 사용 맵 — repo 전체 heatmap | 공개 API 심볼 영향 범위 시각화. 제거 전 실사용처 확인. | symbol reference index × per-file hit 집계 |

## explore (14)

| id | label | 목적 (hint) | 언제 사용 (usecase) | 기반/데이터 (tech) |
|---|---|---|---|---|
| `code-city-3d` | City | CodeCity 3D — 파일을 건물로 | 구조 overview. 팀 시연/포트폴리오용 시각 임팩트 큼. | Wettel/Lanza VISSOFT 2007 클래식 |
| `embedding` | Embed | 구조적 유사도 기반 2D 배치 | 비슷한 역할/구조를 가진 모듈 클러스터 발견. 혼자 동떨어진 파일('이게 왜 여기?') 이상 탐지. 모듈 통합/재구성 시 후보군 식별. | 구조 유사도 행렬 → UMAP 투영 |
| `file-twins` | Twins | 이 파일과 비슷한 5개 | 비슷한 파일에서 이미 해결된 패턴 찾기. '얘랑 똑같이 처리해' | 임베딩 × co-change × 구조 합성 유사도 |
| `galaxy-3d` | Galaxy | 3D 갤럭시 — 파일을 우주 공간에 배치 | 전체 코드베이스를 우주처럼 자유 탐색(발견 모드). 데모/발표용 시각화. 구조 클러스터를 입체적으로 파악. | 구조 유사도 임베딩 + 3D 포스 레이아웃 |
| `inner-city` | InnerCity | 파일 내부 시티 — 심볼 × 의존성 × 커밋 | 한 파일의 건강 상태 한 화면. 리팩터 전 내부 구조 파악. | AST 심볼 블록 × 의존성 × git log |
| `mindmap` | Mind | 선택 파일 중심의 방사형 관계도 | 파일 수정 전 '이게 뭘 쓰고 뭐한테 쓰이나' 즉시 파악. 의존성 체인 따라가기. 리팩터링 전 영향 범위 1차 확인. | AST 심볼 의존성 그래프 |
| `package-surface` | PkgSurface | 패키지 내부 treemap — 파일별 위험도 | 패키지 선택 후 가장 위험한 파일 즉시 스캔. | squarified treemap × bugProbability 히트 |
| `start-here` | StartHere | 코드베이스 탐색 시작점 추천 | 새 팀원 온보딩 시 '여기서부터 보세요' 가이드. 낯선 레포 코드리뷰 전 핵심 파일 파악. '이 코드베이스의 핵심이 뭐야?'에 대한 빠른 답. | 의존성 PageRank + 진입점 중심성 |
| `structure-outline` | Outline | 구조 아웃라인 — 파일 내 심볼 트리 | 파일 내부 구조 네비. 클래스 → 메소드 nested. | LSP DocumentSymbol × AST |
| `symbol-card` | Symbol | 심볼 카드 — 정의 × 호출처 × 테스트 | 심볼 한 개 완전 이해. IDE 피쳐의 시각화 버전. | AST symbol extraction × usage index × test linkage |
| `symbol-inventory` | Symbols | 심볼 인벤토리 — 파일 내 class/function/var | 이 파일에 뭐가 들어있나 스캔. visibility/복잡도 정렬. | AST symbol extraction × per-symbol metrics |
| `treemap` | Universe | 계층 구조를 공간으로 표현 | 코드베이스 온보딩 첫날 전체 구조 파악. 어떤 패키지가 가장 큰지(LoC 기준) 한눈에 확인. PR 리뷰 전 변경 파일이 어느 영역에 있는지 위치 확인. | 파일 계층 트리 + LoC |
| `voronoi-treemap` | Voronoi | Voronoi Treemap — 유기적 세포형 계층 시각화 | 직각 treemap 대안. 과학 포스터급 시각. 패키지 크기 유기적 인지. | Balzer & Deussen InfoVis 2005 centroidal Voronoi |
| `where-to` | Where? | 여기 추가하면 어디? | 새 기능 위치 찾기. 온보딩된 주니어한테도 친절. | 키워드 × 임베딩 (AST 요약 벡터) |

## history (18)

| id | label | 목적 (hint) | 언제 사용 (usecase) | 기반/데이터 (tech) |
|---|---|---|---|---|
| `arch-drift` | Drift | 베이스라인 대비 아키텍처 변화 | 릴리즈 이후 아키텍처가 얼마나 변했나 확인. 스프린트 종료 후 의도치 않은 구조 변화 감지. 아키텍처 거버넌스 리포트. | 레이어 분류 스냅샷 diff |
| `blame-clock` | Clock | 블레임 클럭 — 저자 × 나이 원형 | 도메인 오너십과 시대성을 한 눈에. | git blame × 작성일 방사형 매핑 |
| `churn-sparkline` | Churn | 파일별 90일 커밋 스파크라인 | '언제 터치됐나'를 파일 카드마다 일괄 표시. 정렬로 최근 바쁜 파일 스캔. | git log × 파일 × 시간 버킷 |
| `cochange` | CoChange | 함께 자주 바뀌는 파일 히트맵 | 논리적으로 묶여야 할 파일들 발견 → 모듈화 후보. 변경 시 빠뜨린 파일 없는지 체크. 숨겨진 커플링(의존성 그래프에 안 보이는 것) 탐지. | git 커밋 co-occurrence 마이닝 |
| `cycle-genesis` | Cycles↗ | 순환 의존이 처음 생긴 시점 타임라인 | 순환이 언제 처음 도입됐는지 커밋 단위 추적. 어떤 PR에서 순환이 생겼는지 책임 소재 파악. 재발 방지 가이드 작성 근거. | SCC + git blame 최초 등장 시점 |
| `evolution-dna` | DNA | 파일의 유전자 서열 — 커밋별 함수 진화 | 파일이 어떻게 진화했는지 역사 추적. 시연 임팩트 큼. | AST × git blame diff |
| `file-history` | FileLog | 파일 한 화면 git log | 이 파일이 언제 어떻게 진화했나. 최근 바쁜 구간 스캔. | git log × blame × LoC growth |
| `heat-rainfall` | Rain | 의존성 강우 — 최근 변경의 파급 | '어디가 비 맞고 있나'. 커밋 흐름 시각화. | git log stream × 의존성 전파 |
| `new-since` | Since | 이 시점 이후 바뀐 파일 | 코드리뷰 온보딩. '지난 스프린트에 뭐가 바뀌었지' 스캔. | git log 필터 × 파일 트리 |
| `package-evolution` | PkgEvo | 패키지 진화 — LoC × churn × team | 패키지가 언제 폭발 성장했나. 리팩터 타이밍 감지. | 12개월 LoC 성장 × 주간 churn × 월간 저자수 |
| `refactoring-miner` | RefHistory | 과거 리팩터링 자동 탐지 | 팀 스타일 분석. 온보딩 자료. '우리는 언제 Extract Method 많이 했나' 회고. | RefactoringMiner (Tsantalis ICSE 2018) 스타일 출력 |
| `semantic-diff` | Diff | 의미 단위 diff — 심볼 변화 버블 | line diff 대신 '무엇이 추가됐고 옮겨갔는지' 시각화. 리뷰 속도 가속. | AST × git blame 교차 — add / remove / rename / move |
| `smell-history` | Smells | 코드 스멜이 처음 등장한 시점 | 스멜 도입 시점과 원인 커밋 추적. 특정 스멜이 어떤 개발 패턴에서 반복 발생하는지 파악. 코드 리뷰 가이드라인 개선 근거. | 스멜 패턴 감지 + git 이력 |
| `strata` | Strata | 지층 — 파일 생성 시점별 분포 | 레거시 영역 식별. '가장 오래된 뼈대' 발굴. | git log 첫 커밋 타임스탬프 |
| `stream-graph` | Stream | Stream Graph — 패키지 LoC 시간 흐름 | '이 패키지 언제 폭발 성장했나' continuous overview. | Byron & Wattenberg InfoVis 2008 streamgraph layout |
| `temporal-coupling` | Coupling | 시간적 결합 — 동시 변경 코드를 chord로 | 항상 같이 바뀌는 파일 묶음 식별. 숨은 커플링을 음표 리듬으로 인지. | co-change × 악보 스타일 시각화 |
| `thought-trail` | Trail | 커밋 사고의 궤적 | '이 브랜치가 뭘 풀려고 했나' 회고. PR 설명 자동화 재료. | commit message 임베딩 × 파일 변경 |
| `timelapse` | Timelapse | 커밋 타임랩스 | 한 분기 동안 repo가 어떻게 숨쉬었나 시각화. 신규 프로젝트/시즌 감지. | git log × 파일 활성도 |

## metrics (18)

| id | label | 목적 (hint) | 언제 사용 (usecase) | 기반/데이터 (tech) |
|---|---|---|---|---|
| `bug-prediction` | BugRisk | 결함 예측 — 복잡도+churn+결합도 모델 | 어디서 다음 버그 터질지 사전 경고. 코드리뷰 우선순위. | Zimmermann/Nagappan defect prediction weighted sum |
| `ck-matrix` | CK | CK 메트릭 — 결합도 × 응집도 | OO 설계 감사. '결합 많고 응집 낮은' 클래스가 리팩터 1순위. | Chidamber-Kemerer CBO × LCOM (1994) |
| `cognitive-complexity` | CogC | 인지 복잡도 — 읽기 어려운 파일 | cyclomatic이 놓치는 '읽기 힘든' 코드 식별. 리팩터 onboarding 용. | SonarQube Cognitive Complexity 모델 (중첩/재귀 가중치) |
| `comment-atlas` | Comments | 주석 지도 — 밀도 × 품질 | '주석 많음=좋음' 거짓 반박. 저품질 TODO 밀집 지역 탐지. | 주석 라인 비율 × NLP 품질 분류 |
| `coverage-holes` | Coverage | 테스트 커버리지 구멍 | 테스트 안 걸린 핵심 파일 스캔. | 커버리지 리포트 × 파일 트리 |
| `dit` | DIT | 상속 깊이 (DIT) 분포 | 깊은 상속 트리 감지. 베이스 수정 시 파급 큰 클래스 식별. | Chidamber & Kemerer DIT, VS 문서 기준 |
| `file-gauge` | FileGauge | 단일 파일 헬스 대시보드 | 이 파일 얼마나 건강한가 한 눈에. 코드리뷰 컨텍스트 브리프. | Sonar file-detail × per-file synth metrics |
| `hotspot` | Hotspot | 변경 빈도 × 복잡도 핫스팟 | 리팩터링 우선순위. 자주 터치되고 복잡한 파일이 테크부채 1번 후보. | 90일 churn + cyclomatic 스캔 |
| `hub-score` | Hub | 연결 중심성 — 바꾸면 파급이 큰 파일 | 인터페이스 감사. '이거 바꾸면 터짐' 후보 파일 식별. | import/call 그래프의 fan-in × fan-out |
| `language-breakdown` | Langs | 언어 분포 — repo 내 LoC 비율 | polyglot repo의 언어 구성 한 눈에. 온보딩용. | 파일 확장자 × LoC 집계 |
| `maintainability-index` | MI | Maintainability Index — 헬스 스코어 | 전체 repo 건강도 단일 수치. 임원/PM 보고용. VS/MS 표준. | 171 - 5.2·ln(V) - 0.23·CC - 16.2·ln(LoC) |
| `mutation-score` | Mutation | 뮤테이션 테스트 — 테스트가 실제로 뭘 잡냐 | 커버리지는 높은데 버그가 나오는 이유. '테스트 의미 있나' 검증. | PIT / Stryker mutation survival |
| `problems-panel` | Problems | 통합 문제 패널 — 컴파일러/린터 출력 | IDE 기본. 에러 몇 개 있는지 한 눈에, 소스별 필터. | tsc / eslint / biome / semgrep 통합 diagnostic |
| `quadrant` | Quad | 변경 빈도 × 위험도 산점도 | '자주 바뀌면서 복잡한' 파일 = 리팩터링 1순위. 스프린트 계획 시 기술 부채 우선순위 정량화. 안정 파일 vs 위험 파일 분류. | git churn × 순환 복잡도(CC) |
| `seesoft` | Seesoft | Seesoft — 파일을 픽셀 스트립으로 | huge repo를 한 이미지로. 핫라인/오래된 영역 한눈에. | Eick et al. TSE 1992 line-oriented viz |
| `smell-radar` | Smell | 코드 스멜 레이더 | 전체 repo의 '건강 상태'를 한 차트로. 주간 트렌드. | AST 패턴 스캐너 × 주간 집계 |
| `test-pyramid` | Pyramid | 테스트 피라미드 — unit / integration / e2e | 테스트 전략 건강도. 아이스크림콘/다이아몬드 모양 경고. | 테스트 파일 분류 × LoC 비율 |
| `xray-hotspot` | X-Ray | X-Ray — 파일 내부 함수별 핫스팟 | 핫파일 선택 후 실제 위험 함수 정확히 짚기. 리팩터 목표 좁히기. | 파일 churn × 심볼 복잡도 분해 |

## quality (5)

| id | label | 목적 (hint) | 언제 사용 (usecase) | 기반/데이터 (tech) |
|---|---|---|---|---|
| `debt-history` | Debt | 기술 부채 누적 추이 | 부채가 언제부터 쌓이기 시작했는지 타임라인 파악. 특정 시기 급증 원인 추적(어떤 PR/스프린트). 분기 회고 자료. | 순환 복잡도 + 부채 메트릭 × git 이력 |
| `debt-ratio` | Debt% | 기술 부채 비율 — Sonar SQALE | 현재 부채 비율 한 숫자로. 릴리즈 게이트 (≤5% A) 달성 여부 체크. | debt hours / dev cost (0.06d per LoC) → A-E |
| `devex-health` | DevEx | 개발자 경험 + CI 건강 | 팀 병목 진단. '왜 릴리즈가 느리지' 답. DORA 보완. | 빌드시간 · CI 큐 · PR wait · SPACE framework |
| `dora-metrics` | DORA | DORA 4대 지표 대시보드 | 엔지니어링 성과 표준 지표. 임원 주간 보고. | Deploy Frequency / Lead Time / MTTR / Change Fail Rate |
| `quality-gate` | Gate | Sonar식 Quality Gate — 핵심 지표 합격/불합격 | 임원/PM 주간 보고. 핵심 품질 지표 한 화면. 릴리즈 게이트 체크. | Reliability/Security/Maintainability A-E × 커버리지 × 중복 × 부채 비율 |

## refactor (9)

| id | label | 목적 (hint) | 언제 사용 (usecase) | 기반/데이터 (tech) |
|---|---|---|---|---|
| `dead-code` | Dead | 참조 없는 죽은 코드 | 즉시 지울 수 있는 코드 청소. 번들 다이어트. | 심볼 그래프 도달불가 분석 |
| `dupe-clusters` | Dupes | 중복 코드 클러스터 | 리팩터링 후보. 공통 추출. | AST 지문 기반 유사도 |
| `feature-envy` | Envy | Feature Envy — 남의 클래스 데이터만 쓰는 메소드 | Move Method 리팩터 후보 식별. Fowler 클래식. | AST 메소드 접근 카운팅 × 자기 vs 타 클래스 |
| `god-file` | God | 신(神)급 파일 — 너무 많은 책임 | 분리 리팩터링 후보. 한 파일에 도메인 2~3개. | LoC + 응집도 클러스터링 |
| `move-hint` | Move | 잘못 놓인 파일 감지 | 폴더 구조 정리. '여기 있으면 안 되는 파일' 찾기. | 의존성 중심성 × 현 위치 불일치 |
| `refactor-sim` | Simulate | 리팩터링 시뮬레이션 — 예상 효과 | 실제 코드 건드리기 전 '이걸 분리하면 의존성이 어떻게 바뀌나' 확인. 팀에 리팩터링 제안할 때 before/after 근거 자료. 리스크 없는 사전 검증. | 의존성 그래프 변이 시뮬레이션 |
| `refactor-terrain` | Refactor | ROI 순위 기반 리팩터링 목록 | 리팩터링 우선순위를 ROI 기준으로 정량화. 스프린트에 리팩터링 티켓 넣을 때 근거 자료. '감으로 고르기' 대신 데이터 기반 결정. | 복잡도 × churn ROI 스코어링 |
| `refactor-weather` | Weather | 리팩터링 기상 예보 | 전체 패키지의 리팩터 '날씨' 한 눈에. 폭풍 지역부터 손대자. | 복잡도 × 결합도 × churn 집계 기상도 |
| `shotgun-surgery` | Shotgun | Shotgun Surgery — 한 변경이 여러 파일에 흩뿌려짐 | 강한 결합 탐지. Extract Class / Move Feature 후보. | co-change 빈도 × 변경당 영향 파일 수 |

## security (4)

| id | label | 목적 (hint) | 언제 사용 (usecase) | 기반/데이터 (tech) |
|---|---|---|---|---|
| `dep-fossil` | Fossil | 화석 — 살아남은 deprecated API | 청소 우선순위. 오래되고 지금도 쓰이는 legacy 식별. | import 스캔 × deprecated 목록 |
| `dependency-health` | DepHealth | 의존성 건강 — version/update/vuln/license/size | supply chain 감사. critical vuln 0 달성 여부. '업데이트 할 것' 스캔. | package registry × npm audit × license scan |
| `sbom` | SBOM | SBOM — 공급망 계보 + provenance | 공급망 보안. 서명/검증 상태 감사. 규제(EO 14028) 대응. | Sigstore × CycloneDX × SPDX 2.3 |
| `vulnerabilities` | Vulns | 보안 취약점 대시보드 | 보안 리뷰 작업. 릴리즈 전 critical 0 검증. CVE 대응 현황 추적. | SAST 스캔 룰 × severity × hotspot review |

## team (7)

| id | label | 목적 (hint) | 언제 사용 (usecase) | 기반/데이터 (tech) |
|---|---|---|---|---|
| `author-territory` | Authors | blame 기반 작성자 소유 영역 | PR 리뷰어 지정 시 누가 이 영역 담당인지 확인. 온보딩 시 도메인별 담당자 파악. 버스 팩터(한 명만 아는 영역) 위험 식별. | git blame 소유권 분석 |
| `bus-factor` | Bus | 버스 팩터 — 한 사람 의존 파일 | 팀 리스크 감지. '이 사람 나가면 아무도 못 만짐' 찾기. | git blame author 분포 집계 |
| `mitosis` | Mitosis | 소유권 분열 경고 | 다가오는 merge conflict / 팀 겹침 예측. | 최근 commits의 저자 교차 빈도 |
| `ownership-sankey` | Handoff | 소유권 핸드오프 — 누가 누구한테 넘겼나 | 지식 흐름 시각. 오너십 전환, 팀 간 권한 이동 분석. | git blame 시간별 primary author 추적 |
| `review-heat` | Review | 코드리뷰 병목 — cycle time × comment 밀도 | 리뷰 지연 원인 시각화. DevOps 개선 데이터. | PR lifecycle × review discussion 분석 |
| `review-recommender` | Review? | 리뷰어 추천 — 과거 기여 기반 | PR 리뷰어 라우팅 자동화. truck-factor 보완 (누구한테 맡기면 좋냐). | past blame × 영역 전문성 × 최근 활성도 |
| `truck-factor` | Truck | Truck Factor — 팀 리스크 | N명 나가면 유지보수 못함. 팀 리스크 지표. | 파일별 유일 전문가 집계 (Avelino FSE 2016) |

