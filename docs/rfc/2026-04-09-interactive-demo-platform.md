# RFC: Interactive Live Demo Platform

**날짜**: 2026-04-09  
**상태**: 기획 중  
**작성**: Jo

---

## 개요

p0의 정적 분석 엔진과 IDE 기능을 방문자가 직접 손으로 체험할 수 있는 인터랙티브 데모 플랫폼.  
"우리 이런 거 할 수 있어요"를 말로 설득하는 게 아니라, 방문자가 실제 코드베이스에서 작업하며 자연스럽게 경험하게 한다.

---

## 유저 플로우

```
랜딩페이지
  └─→ 레포 선택 (분석 결과 프리뷰)
        └─→ semi-IDE 진입 (세션 할당)
              ├─→ 코드 편집 / 빌드 / 테스트
              ├─→ 실시간 정적 분석 (그래프, 콜트리 등)
              ├─→ 타임머신 (스냅샷 되감기)
              └─→ 세션 만료 → 원상복구
```

---

## 핵심 기능

### 1. semi-IDE
- Monaco 에디터 기반, 코드는 원격 서버 — WebSocket 파일 브리지로 연결
- 빌드 / 테스트 / DB 접속 등 실제 개발 환경처럼 동작
- **Minimap에 분석 오버레이** — 복잡도 히트맵, taint zone, dead code 구간이 minimap 위에 색상으로 표시. 파일 전체 위험 지형을 한눈에
- **파일 트리 리스크 뱃지** — 각 파일 옆에 `⚠️ 3` `💀 12` `🔴` 뱃지. 어느 파일이 위험한지 열기 전에 파악
- **Split diff 뷰** — 내 변경과 분석 결과를 나란히. 왼쪽 원본 / 오른쪽 수정 후 blast radius 변화
- **터미널 통합** — 하단 터미널에서 빌드/테스트 실행, 에러 발생 시 해당 라인으로 점프 + 분석 컨텍스트 자동 로드
- 우클릭 컨텍스트 메뉴 p0 고유 기능 (Layer 2 참조)

### 2. 멀티유저 동시 편집
- Yjs + WebSocket 기반 CRDT 동시 편집
- 다른 유저 커서 실시간 표시 (Figma 스타일) + 유저별 색상
- **충돌 분석 오버레이** — 두 유저가 같은 함수를 동시에 수정하면 "blast radius 겹침" 경고. 단순 텍스트 충돌이 아니라 의미론적 충돌 감지
- **Live presence 패널** — 우측 상단에 지금 누가 어느 파일 보는지 아바타로 표시. 클릭하면 그 유저 커서로 점프
- **Follow mode** — 특정 유저 뒤따라가기. 관중 모드에서 발표자 따라가기에 활용
- **Annotation** — 코드 라인에 댓글 달기. 분석 결과 공유할 때 "이 taint path 봐봐" 핀 꽂기

### 3. 세션 / 브랜치 관리
- 유저 입장 시 `session/{userId}/{sessionId}` 브랜치 자동 생성
- `git worktree add` 로 세션별 독립 워킹 디렉토리 할당
- **세션 이어받기** — 세션 만료 전 "이어서 하기" 링크 생성. 동료에게 공유하면 같은 worktree에서 이어서 작업
- **세션 비교** — 두 세션의 변경사항을 diff + 분석 결과 비교. "A가 만든 변경 vs B가 만든 변경 — 어느 쪽이 더 안전한가"
- 주기적으로 main 기준으로 원상복구

### 4. 빌드 / 테스트 스케줄러
- 동시 빌드 요청을 큐로 관리, 세션별 worktree로 격리
- **빌드 로그 분석 연동** — 빌드 에러 발생 시 단순 로그가 아니라 "어떤 변경이 이 에러를 만들었는지" 정적 분석으로 역추적
- **테스트 영향 예측** — 빌드 전에 "이 변경이 어떤 테스트를 깰 것 같은지" 사전 예측 (change_impact_analysis)
- **빌드 타임라인** — 세션 내 빌드 히스토리를 타임라인으로. 어느 커밋에서 처음 깨졌는지 bisect
- **빌드 결과 공유** — 빌드 성공/실패를 관중 화면에 실시간 브로드캐스트. "저 사람 빌드 터졌다" 관람 포인트

### 5. 타임머신
- 주기적 `git commit` 스냅샷 자동 생성, 정적 분석 아티팩트 함께 저장
- **분석 타임라인** — 단순 코드 diff가 아니라 "이 시점에 blast radius가 얼마였는지", "taint path가 언제 생겼는지" 분석 상태 변화를 타임라인으로
- **위험 급증 포인트 하이라이트** — blast radius가 갑자기 늘어난 커밋, taint path가 새로 생긴 커밋을 타임라인에 자동 마킹
- **Before/After 분석 비교 뷰** — 두 스냅샷 선택 → 코드 diff + 콜 그래프 diff + taint 변화 동시에
- **"언제부터 위험해졌나"** — 특정 함수 선택 → 이 함수의 complexity / taint / blast radius 변화 그래프로

### 6. 동시 접속 제한 + 관중 모드
- 동시 세션 수 cap, 대기열: "N명 앞에 있어요, 예상 N분"
- **관중 모드 멀티뷰** — 여러 세션을 동시에 타일로 보기. 어느 세션이 제일 흥미로운지 골라서 집중
- **관중 반응** — 빌드 터지면 👀 이모지 반응 가능. 소셜 에너지 + 소셜 프루프 동시에
- **하이라이트 릴** — 세션 중 "와" 하는 순간 (blast radius 급증, CVE 발견, 빌드 터짐)을 자동 클립으로 저장. 나중에 공유 가능
- **관중 → 다음 플레이어 전환** — 대기 중 관람하다가 세션 열리면 즉시 알림 + 같은 파일 컨텍스트 이어받기
- 세션 타이머: 1인당 N분 제한 → 자동 순환

---

## 아키텍처

### 파일 브리지
```
Monaco (브라우저) ←WebSocket→ 파일브리지 서버 ←→ git worktree (실제 파일)
                                     ↕
                              incremental analyzer
                                     ↕
                           베이스 인덱스 + 세션 델타
```
- 파일 read / write / watch 3가지만 구현하면 Monaco 입장에서 로컬과 동일
- **파일 write 이벤트 → 즉시 incremental 분석 트리거** — 저장하지 않아도 타이핑 debounce(300ms)마다 델타 분석
- **watch 이벤트 → 멀티유저 동기화** — 다른 유저가 파일 수정하면 내 에디터에도 분석 결과 즉시 반영

### 브랜치 / Worktree 구조
```
main (원본, read-only)
  └── /workspaces/
        ├── session-abc123/   ← git worktree (브랜치: session/abc123)
        ├── session-def456/   ← git worktree (브랜치: session/def456)
        └── session-ghi789/   ← git worktree (브랜치: session/ghi789)
```

### 정적 분석 인덱스
```
베이스 인덱스 (main 기준, 공유) - 1개
  └── 세션 델타 인덱스 (변경 파일만 incremental) - 세션당 1개
```
- 정적엔진 incremental 분석 지원 → 세션별 메모리 부담 최소화
- 스냅샷 커밋 시 델타 인덱스 직렬화하여 함께 저장
- 타임머신 복원 시 인덱스도 함께 복원 → 그 시점 분석 결과 정확히 재현

### 세션 생명주기
```
진입 → worktree 생성 + 델타 인덱스 초기화
  → 작업 (편집 / 빌드 / 분석)
    → 주기적 스냅샷 커밋
      → 세션 만료 or 타이머 종료
        → 스냅샷 저장 → worktree 제거 → 브랜치 삭제
          → 다음 대기자 입장
```

---

## 데모 효과

| 기존 방식 | 이 플랫폼 |
|---|---|
| "우리 코드 분석 잘해요" 말로 설명 | 직접 코드 수정하고 그래프 바뀌는 거 눈으로 확인 |
| 세일즈 콜에서 화면 시연 | 방문자가 직접 손으로 체험 |
| 정적인 데모 영상 | 실시간 멀티유저, 빌드 터짐, 타임머신 직접 경험 |
| "도입하면 좋을 것 같다" | "우리 레포에 당장 붙이고 싶다" |
| 기능 설명 문서 | 실제 CVE 코드 만지면서 taint path 직접 제거 |
| 영업팀이 설득 | 유저가 스스로 "이거 우리 팀에 보여줘야 해" |

### 예상 경험 순서 (첫 방문자)

```
1. IDE 열림 → 코드에 뱃지/마커 이미 가득 → "어? 이거 다른데?"
2. 함수 클릭 → 콜 그래프 + blast radius 31 → "이게 이렇게 연결돼있어?"
3. 조건문 한 줄 바꿈 → blast radius 31→37, taint path +1 → "내가 친 게 이렇게 퍼지네"
4. CVE 있는 import 클릭 → "Fix safely" → 자동 버전 업 → "이게 원클릭이라고?"
5. 타임머신으로 5분 전으로 → 분석 결과도 그 시점으로 → "분석도 되감겨?"
6. 관중이 내 화면 보고 있다는 알림 → "공유하고 싶어짐"
```

---

## 인터랙션 철학

### 핵심 패러다임

기존 IDE:
> "코드를 써라 → 가끔 힌트를 줄게"

p0 IDE:
> "분석이 주인공 → 코드는 분석 결과를 확정하는 수단"

- **손코딩은 2급시민** — 타이핑은 "값 입력", "이름 확정" 수준으로만
- **타이핑 중 제공되는 정보는 1급시민** — 치는 순간마다 분석이 반응
- **딸깍으로 다 해결** — 분석이 제안하면 클릭 한 번으로 확정

---

### 레이아웃

```
┌──────────────┬──────────────────┬───────────────────┐
│  파일 트리    │   코드 에디터     │   분석 패널        │
│              │   (2급시민)       │                   │
│              │                  │   콜 그래프        │
│              │  ← 분석 오버레이  │   taint trace      │
│              │     코드 위에     │   blast radius     │
│              │     떠있는 느낌   │   실시간 업데이트   │
└──────────────┴──────────────────┴───────────────────┘
```

- 분석 패널이 에디터보다 **더 크고 선명하게**
- 코드 오버레이(CodeLens, taint 마커, 복잡도 배경)가 코드 자체보다 시각적으로 강조

---

### 경험 4단계 통합 흐름

```
1. 코드 열기  → ambient 정보 이미 보임 (클릭 없이)
2. 클릭       → 그래프 + 영향 범위 즉시 열림
3. 수정       → 미래 변화 실시간 표시
4. 질문       → 설명 / 시뮬레이션 / 해결책
```

---

## Layer 1 — Ambient (항상 보이는 경험)

**목표**: 아무것도 안 해도 "이 IDE 다르다"를 3초 안에 납득

원칙:
- 텍스트 옆에 붙인다 (멀리 보내지 않는다)
- 숫자 + 상태 중심 (설명 최소화)
- 읽게 하면 실패 — **보이는 UI**여야 함

### CodeLens (함수 첫 줄 위)
```typescript
// ⚡ complexity 8.2   💀 no tests   🔥 hotspot
async function processRefund(userId: string) {
```

| 심볼 | 표시 |
|---|---|
| 함수 | complexity / test coverage / hotspot |
| 클래스 | method 수 / 상속 depth |
| 파일 | change frequency |

### Inline Markers (라인 끝)
```typescript
const amount = req.body.amount   // 🔴 taint source
await db.update(...)             // ⚠️ 14 callers
```

### End-of-block Summary (함수 닫는 `}`)
```typescript
} // 📍 blast radius: 31 files
```
→ 클릭 없이 이 함수의 위험도 전달

### Import Inline
```typescript
import axios from "axios"  // 📦 +42kb  🚨 CVE-2025-30066
```

### Gutter Signals (왼쪽 라인 마커)
| 색상 | 의미 |
|---|---|
| 🔴 | taint path 포함 |
| 🟠 | hotspot |
| 🟡 | untested |

### Subtle Background Heat
복잡도 높은 함수 배경 살짝 붉어짐 (opacity 10~15%). 강도가 지나치면 시각적 노이즈가 된다.

### 한 화면 통합 예시
```typescript
// ⚡ complexity 8.2   💀 no tests   🔥 hotspot
async function processRefund(userId: string) {

  const amount = req.body.amount   // 🔴 taint source

  await db.update(...)             // ⚠️ 14 callers

} // 📍 blast radius: 31 files
```
→ 클릭 안 해도: 위험함 / 테스트 없음 / user input 들어옴 / 영향 큼 — 전달 완료

---

## Layer 2 — Direct Manipulation (행동 기반 경험)

**목표**: "내 행동 → 시스템 반응 → 의미 변화 체감"

### A. Selection (클릭 / 커서 위치)

트리거: 함수 클릭, 변수 선택, 심볼 hover

즉시 반응 (100~200ms):
```
우측 패널:
  Call Graph 열림
  processRefund
    ├── validateUser  ✓ tested
    ├── db.update     ⚠️ taint
    │     └── ledger.write
    └── sendWebhook   💀 dead

상단 미니 상태:
  31 files affected · 128 calls · 2 taint paths

코드:
  호출자 라인 highlight + taint 연결선 표시
```

유저 인식: "이 함수 하나가 시스템 전체랑 연결돼있네"

### B. Edit (타이핑 / 수정)

트리거: 코드 수정 시작 (debounce 300~800ms)

반응 흐름:
```
즉시    → "Analyzing changes..."
0.5~1.5s → ⚠️ Impact updated
            - blast radius: 31 → 37
            - taint path: +1
            - behavior change: 2 paths

인라인 업데이트:
  await db.update(...)   // ⚠️ now 18 callers (↑4)

사이드 패널:
  새 노드 추가 / 색상 변경
```

유저 인식: "내가 친 코드 때문에 시스템 구조가 바뀌고 있다"  
→ **이게 핵심 경험**

### C. Pre-change Warning (고위험 수정 감지)

트리거: auth / db / serializer / API 등 고위험 함수 수정 시도  
(모든 수정에 표시하면 경고 피로를 유발한다 — 실제 고위험 구간에만 한정)

```
⚠️ This change may affect:

- 31 files
- 12 tests (4 uncovered)
- 2 taint paths

[Continue] [View impact]
```

### D. 우클릭 → 원클릭 해결

| 상황 | 원클릭 |
|---|---|
| 콜 그래프 노드 | 해당 함수 포커스 + 컨텍스트 전환 |
| taint 소스 | sanitizer 삽입 제안 |
| dead code 노드 | cascade 미리보기 → 전체 제거 |
| 복잡도 높은 함수 | extract 포인트 자동 제안 |
| race condition 경고 | 락 추가 위치 → 삽입 |
| spec 위반 경고 | 누락 호출 자동 삽입 |
| clone 감지 배지 | merge 미리보기 → 통합 |
| CVE 경고 | 안전 버전 업그레이드 제안 |
| 리소스 미닫힘 | close() 삽입 위치 제안 |

### E. Hover Card

```
┌─────────────────────────────────────────┐
│ processRefund()                          │
│ complexity  ████████░░  8.2             │
│ callers     14   ·   test coverage ✗   │
│ ⚠️  taint source — user input           │
└─────────────────────────────────────────┘
```

---

## Layer 3 — Prompt / Intent (의도 기반 경험)

**목표**: 사용자가 "하고 싶은 것"을 말하면 → 분석 시나리오가 실행된다

중요:
- ❌ 챗봇 아님, ❌ Q&A 아님
- ✅ capability 조합 실행 인터페이스
- ✅ 항상 deterministic한 분석 결과 — 근거 없는 답변 없음

내부 구조:
```
prompt → intent parser
       → capability planner
       → analysis engine 실행
       → result struct 생성
       → UI 카드 렌더링
```

### 진입점 3개

**1. Command Palette (⌘K)**
```
> What happens if I change this function?
> Show taint paths
> Why is this risky?
> Suggest safe refactor
```

**2. 우클릭 → AI 액션** (selection context 자동 포함)
```
Explain this
Simulate change
Refactor safely
Investigate usage
```

**3. Inline Prompt**
```typescript
processRefund()   // 💬 Ask
```

### 프롬프트 경험 4타입

#### Explain (이해)
입력: "왜 이 함수 위험해?"

출력 카드:
```
processRefund is risky because:

- receives user input (req.body.amount)
- writes directly to DB without sanitization
- affects 31 files

Taint path:
req.body → processRefund → db.update

[Jump to source] [Show taint path]
```

#### Simulate (미래 보기) ← 🔥 핵심
입력: "이 조건 >=로 바꾸면?"

출력 카드:
```
⚠️ Simulation Result

Behavior changes:
  amount == 0 case now executes refund

Impact:
  31 → 37 files affected

Security:
  taint path introduced (user → DB)
```
코드 인라인:
```typescript
if (amount >= 0)   // ⚠️ behavior change here
```
→ 실행 안 했는데 결과 보여줌 — **이게 "미래"**

#### Refactor (행동 제안)
입력: "이 함수 안전하게 분리해줘"

출력 카드:
```
Suggested Refactor:

Extract:
  validateAmount()
  processTransaction()

Behavior: ✓ equivalent
Impact: complexity 8.2 → 4.1

[Preview Changes] [Apply]
```
→ 단순 코드 생성 ❌ / 검증된 리팩토링 ✅

#### Investigate (디버깅)
입력: "이 값 어디서 왔지?"

출력 카드:
```
value originates from:
  req.body.amount

flows through:
  processRefund → calculate → db.update

[경로 하이라이트]
```

### UX 원칙: 대화 ❌ 결과 카드 ✅

```
❌ 나쁜 UX
User: 왜 위험해?
AI: 이 함수는...
User: 어디서?   ← 느림, 답답함

✅ 좋은 UX
[Result Card]
 Why risky: ...
 [Jump to source] [Show taint path] [Simulate fix]
← 한 번에 끝
```

### Killer Interaction 3개 (무조건)

1. **"Simulate Change"** — 수정 전에 미래 보여줌
2. **"Explain this warning"** — 경고 클릭 → 설명 + 경로 즉시
3. **"Fix this safely"** — 경고 옆에 항상 붙이기
   ```
   ⚠️ taint path   [Fix safely]
   ```

---

### 조용히 vs 크게 원칙

| 조용히 (항상성 높은 것) | 크게 (변화가 명확한 것) |
|---|---|
| 복잡도 | blast radius 증가 |
| 테스트 유무 | 새 taint path 생성 |
| hotspot | behavior change 후보 |
| import risk | resource leak |
| | protocol violation |

→ **상태는 잔잔하게, 변화는 dramatize**

---

## IDE 심볼 컨텍스트 액션

심볼 타입별로 우클릭 메뉴 / 호버 힌트를 다르게 제공한다.  
각 액션은 카탈로그 capability에 직접 매핑된다.

### 심볼별 액션 매핑

| 심볼 타입 | 우클릭 액션 | 호버 힌트 | capability |
|---|---|---|---|
| **함수 / 메서드** | 콜 그래프 보기, 호출자 목록, 영향 범위 분석, 리팩토링 제안, 테스트 커버리지 여부 | 복잡도 점수, 마지막 수정자, 테스트 유무 | `call_graph`, `find_references`, `change_impact_analysis`, `code_actions`, `dead_code` |
| **클래스** | 상속 트리, 인스턴스 생성 위치, 메서드 복잡도 히트맵 | 메서드 수, 상속 깊이 | `call_graph`, `find_references`, `program_dependence` |
| **변수 / 상수** | 참조 위치 전체, mutation point 목록 | 타입, 선언 위치 | `find_references`, `dataflow`, `def_use_facts` |
| **import / 의존성** | 실제 사용처, 제거 가능 여부, CVE 취약점 확인 | 번들 사이즈 기여도, 라이센스 | `import_graph`, `dead_code`, `vulnerability_scan`, `sca_vuln_report` |
| **API 엔드포인트** | 호출 체인 추적, 인증 여부 확인, 연결된 DB 쿼리 | 연결된 미들웨어, 인증 레이어 | `call_graph`, `taint_flow`, `dataflow` |
| **DB 쿼리** | 실행 경로, N+1 패턴 감지 | 영향 받는 테이블, 인덱스 사용 여부 | `dataflow`, `effect_analysis`, `taint_flow` |
| **타입 / 인터페이스** | 구현체 목록, 사용처, 변경 시 영향 범위 | 구현체 수, 변경 위험도 | `go_to_type_definition`, `find_references`, `change_impact_analysis` |
| **환경변수** | 실제 사용 위치, 누락된 .env 체크 | 사용 파일 수 | `find_references`, `taint_flow` |

### 호버 인라인 힌트 (모든 심볼 공통)

```
함수 위 호버  →  복잡도 점수 · 마지막 수정자 · 테스트 커버리지
import 위 호버 →  번들 기여 사이즈 · CVE 여부
긴 함수       →  "분리 가능" 뱃지 (code_actions)
수정 많은 파일 →  "핫스팟" 경고 인라인
```

### 기존 LSP와의 차이

| LSP (기존) | p0 IDE |
|---|---|
| "이 심볼 어디서 쓰여?" | "왜 위험한지, 어디까지 영향 가는지" |
| Go to Definition | 콜 그래프 전체 시각화 |
| Rename | Rename + 영향 범위 + 안전성 검증 |
| Find References | References + 데이터플로우 경로 |
| Diagnostics | Diagnostics + taint 경로 + 수정 제안 |

---

## IDE 코드 편집 화면 UX 상세

### 우클릭 컨텍스트 메뉴

**함수 / 메서드 선택 시**
```
├── 🔍 Trace call graph       → 콜 그래프 패널 오픈 (call_graph)
├── 💥 Blast radius           → "이거 바꾸면 N개 파일 영향" 즉시 표시 (change_impact_analysis)
├── 🔀 Show data flow         → 이 값이 어디서 와서 어디로 가는지 (dataflow)
├── 🛡️  Taint trace            → 소스→싱크 경로 에디터에 하이라이트 (taint_flow)
├── ✂️  Extract / Refactor     → 분리 제안 + 미리보기 (code_actions)
├── 🔬 Find all mutations     → 이 변수 어디서 바뀌는지 전체 목록 (def_use_facts)
└── 💀 Dead code check        → 이 함수 실제로 쓰이나 (dead_code)
```

**import / 의존성 선택 시**
```
├── 📦 Show bundle impact     → 번들 사이즈 기여도
├── 🚨 CVE scan               → 취약점 즉시 스캔 (sca_vuln_report)
└── 🗑️  Remove safely         → 실제 사용처 없으면 안전 제거 제안 (import_graph)
```

---

### 호버 힌트 (마우스 올렸을 때)

**함수 위 호버**
```
┌─────────────────────────────────────────┐
│ processRefund()                          │
│ ──────────────────────────────────────  │
│ 복잡도  ████████░░  8.2 / 10            │
│ 호출자  14곳  ·  테스트 커버 ✗          │
│ 마지막 수정  3일 전 · @kimdev           │
│                                          │
│ ⚠️  taint source 감지됨 — user input    │
└─────────────────────────────────────────┘
```

**import 위 호버**
```
┌─────────────────────────────────────────┐
│ axios  ^1.6.0                            │
│ 번들 기여  +42kb (gzip 14kb)            │
│ CVE-2025-30066  CRITICAL  ⚠️            │
│ 실제 사용  7파일 · 23곳                 │
└─────────────────────────────────────────┘
```

---

### 인라인 코드 레이어 (에디터 상시 표시)

CodeLens 스타일로 코드 위에 오버레이:

```typescript
async function processRefund(userId: string) {  // ⚡ 복잡도 8.2  💀 테스트 없음
  const data = req.body.amount                  // 🔴 taint source
  await db.update(...)                          // ⚠️  14 callers affected
}                                               // 📍 blast radius: 31 files
```

| 위치 | 표시 내용 |
|---|---|
| 함수 첫 줄 위 | 복잡도 점수 + 테스트 커버리지 유무 |
| taint source 라인 | 빨간 점 인라인 마커 |
| DB write 라인 | 영향 받는 caller 수 |
| 함수 닫는 `}` | blast radius (영향 파일 수) |
| 긴 함수 | "분리 가능" 뱃지 |

---

### 실시간 반응 (코드 수정 시)

incremental_analysis 기반으로 수정과 동시에 반응:

- 함수 수정 → 오른쪽 콜 그래프 패널 즉시 업데이트
- 새 변수 선언 → def-use 엣지 즉시 그려짐
- import 추가 → CVE 체크 자동 실행
- 복잡도 임계값 초과 → 함수 배경 점진적으로 붉어짐
- 타임머신 스냅샷 → 해당 시점 분석 결과도 함께 복원

---

### 사이드 패널 — 콜 그래프 뷰

```
┌─ Call Graph ──────────────────────┐
│  processRefund                    │
│    ├── validateUser     ✓ tested  │
│    ├── db.update        ⚠️ taint  │
│    │     └── ledger.write         │
│    └── sendWebhook      💀 dead   │
└───────────────────────────────────┘
```

- 노드 클릭 → 해당 코드 위치로 점프
- 코드 수정 → 그래프 실시간 업데이트
- 노드 색상: 정상(초록) / taint(빨강) / dead(회색) / 미테스트(주황)

---

### 데모 WOW 포인트 (우선순위 순)

1. **Blast radius 숫자** — 함수 하나 선택하면 "31개 파일 영향" 즉시 표시. 숫자 하나로 임팩트 전달
2. **Taint trace 하이라이트** — 소스→싱크 경로가 에디터에 빨간 선으로 그려짐. 시각적으로 가장 강렬
3. **실시간 콜 그래프 업데이트** — 코드 치는 순간 옆 그래프가 바뀜. "살아있는 분석" 느낌
4. **CVE 인라인 경고** — import 한 줄에 CVE 번호 즉시 뜨는 것. 개발자 반응 즉각적

---

## 편집 / 리팩토링 킬러 기능

### IntelliJ가 못하는 것들

#### Semantic-safe Rename
```
함수명 변경 시:
  ├── 정적 참조 전부 변경 (기존 IDE도 함)
  ├── reflection / string literal 로 쓰이는 곳 경고  ← p0만 가능
  ├── 직렬화 포맷에 이름이 박혀있는 곳 감지         ← p0만 가능
  └── rename 후 behavior diff로 "동작 동일" 검증    ← p0만 가능
```
> capability: `rename`, `find_references`, `behavior_diff`, `symbol_resolution`

---

#### Behavior-verified Refactoring
리팩토링 전후 **의미론적으로 동작이 같은지** 검증. 테스트 없어도.

```
Extract Method 실행
  → 리팩토링 전 dataflow 스냅샷
  → 리팩토링 후 dataflow 스냅샷
  → diff → "입출력 동일, 사이드이펙트 동일 ✓"
  or → "이 경로에서 side effect 달라짐 ⚠️"
```
> capability: `behavior_diff`, `effect_analysis`, `dataflow`, `program_dependence`

---

#### API Protocol Enforcement (spec_mining)
코드 패턴을 보고 호출 순서 규약을 자동으로 추론, 위반 감지.

```typescript
// p0가 패턴 학습: init() → connect() → send() 순서여야 함
// 아래 코드에서 connect() 빠진 걸 인라인으로 경고
const client = new Client()
client.init()
// ⚠️  connect() 호출 누락 — 다른 57곳에서 항상 호출됨
client.send(data)
```
> capability: `spec_mining`, `typestate_analysis`, `spec_verification`

---

#### Resource Lifecycle Tracker (typestate)
파일 핸들, DB 커넥션, 락 등 리소스 라이프사이클 에디터에서 실시간 추적.

```typescript
function processFile(path: string) {
  const fd = fs.open(path)           // 🟢 opened
  if (error) return                  // 🔴 fd never closed on this path
  fs.write(fd, data)
  fs.close(fd)                       // ✓ closed
}
```
인라인으로 각 경로의 리소스 상태 표시, 닫히지 않는 경로 즉시 하이라이트.

> capability: `typestate_analysis`, `control_flow`, `escape_analysis`

---

#### Race Condition Live Detector (concurrency)
멀티스레드 코드 편집 중 실시간 race condition 감지.

```typescript
let counter = 0
async function increment() {   // ⚠️  data race: counter
  const val = counter          // ← read
  await sleep(1)
  counter = val + 1            // ← write — 다른 스레드가 사이에 낄 수 있음
}
```
> capability: `concurrency_analysis`, `dataflow`, `effect_analysis`

---

#### Dead Code Cascade Removal
dead code 하나 제거할 때 연쇄적으로 죽는 코드까지 한 번에 제안.

```
sendWebhook() 사용처 없음 (dead)
  → 이걸 제거하면 WebhookBuilder도 dead
    → 이걸 제거하면 retryConfig도 dead
      → 총 3개 파일, 847줄 제거 가능
```
미리보기로 cascading removal 전체 보여주고 한 번에 적용.

> capability: `dead_code`, `call_graph`, `import_graph`, `change_impact_analysis`

---

#### Clone Detection + Smart Merge
중복 코드 감지 후 통합 제안. 의미론적으로 같으면 병합, 미묘하게 다르면 diff 보여줌.

```
processPayment() ──┐
                   ├── 87% 유사 → 파라미터로 추상화 제안
processRefund()  ──┘

차이점: line 34 — amount sign 반전 여부만 다름
→ processTransaction(type: 'payment' | 'refund') 로 통합 제안
```
> capability: `clone_detection`, `behavior_diff`, `code_actions`

---

#### Change Impact Preview (편집 전 경고)
코드 수정 **시작 전에** 영향 범위 미리 보여주기.

```
processRefund 수정 감지 →
┌─────────────────────────────────────────┐
│ ⚠️  수정 전 확인                         │
│                                          │
│ 영향 파일     31개                       │
│ 영향 테스트   12개 (4개 커버 안됨)       │
│ taint path    2개 통과                   │
│ 관련 PR       #234, #891 (열려있음)      │
│                                          │
│ [계속]  [blast radius 보기]              │
└─────────────────────────────────────────┘
```
> capability: `change_impact_analysis`, `call_graph`, `taint_flow`, `program_dependence`

---

### 리팩토링 액션 전체 목록

| 액션 | 설명 | capability |
|---|---|---|
| **Extract Method** | 선택 블록을 함수로 추출 + behavior 검증 | `code_actions`, `behavior_diff` |
| **Inline Method** | 함수 인라인 + 안전성 확인 | `code_actions`, `find_references` |
| **Move to Module** | 파일/모듈 간 이동 + import 전체 업데이트 | `rename`, `import_graph` |
| **Extract Interface** | 클래스에서 인터페이스 추출 | `code_actions`, `go_to_type_definition` |
| **Safe Delete** | 제거 전 참조 전수 확인 + cascade preview | `dead_code`, `find_references` |
| **Introduce Parameter** | 하드코딩 값을 파라미터로 | `code_actions`, `dataflow` |
| **Decompose Condition** | 복잡한 조건문 분해 | `code_actions`, `control_flow` |
| **Merge Duplicates** | 중복 코드 통합 | `clone_detection`, `behavior_diff` |
| **Fix Taint Path** | taint 경로 자동 sanitizer 삽입 제안 | `taint_flow`, `code_actions` |
| **Close Resource** | 닫히지 않는 리소스 경로에 close 삽입 | `typestate_analysis`, `code_actions` |

---

---

## Shock 순간 — 시각적 임팩트 설계

### Animated Blast Radius

함수 하나 클릭 → 영향 파일들이 노드로 튀어나오며 퍼져나가는 애니메이션.

```
processRefund 클릭
  → 0ms:   중앙 노드 붉어짐
  → 100ms: 1차 호출자 3개 노드 등장 (빨간 선으로 연결)
  → 250ms: 2차 호출자 9개 등장 (주황 선)
  → 500ms: 파일 트리에서 영향받는 파일들 순서대로 빨갛게 변함
  → 완료:  "31 files affected" 카운터 올라가며 확정
```

- 파일 트리가 위에서 아래로 빨갛게 물드는 효과
- 숫자 카운터 애니메이션 (0 → 31)
- 배경에 pulse 링 효과 — "퍼져나간다"는 느낌

### Flowing Taint Animation

Taint path를 정적 화살표가 아니라 흐르는 파티클로 표시.

```
req.body.amount  ●──────────────────────────→  db.update()
                 ↑ 빨간 점들이 왼→오 흐름
```

- 소스(🔴)에서 싱크(🔴)까지 작은 빨간 점들이 연속으로 흘러내려감
- 흐름 속도 = 코드 경로 길이에 비례
- taint 경로 제거 → 흐름이 멈추는 애니메이션으로 "해결됨" 표현

---

## 1초 이해 UI — Global Risk Meter

### System Risk Dashboard

에디터 상단에 항상 떠 있는 시스템 전체 위험도 바.

```
┌─────────────────────────────────────────────────────────┐
│  🔴 System Risk: HIGH                                    │
│  Taint paths: 3   Unsafe writes: 12   Affected: 31 files│
│  ████████████████░░░░  Risk Score: 78/100               │
└─────────────────────────────────────────────────────────┘
```

- 코드 수정 시 실시간 업데이트 (숫자 카운터 애니메이션)
- 위험도 낮아지면 초록으로, 높아지면 빨갛게 — 즉각 시각 피드백
- 클릭 → 세부 항목 드릴다운

### Instant File Summary (파일 열 때)

파일 열자마자 상단에 요약 카드 자동 노출:

```
┌───────────────────────────────────────────────────────┐
│ 📄 payment.ts                                          │
│ 주요 역할: refund 처리 + DB write                      │
│ 핵심 리스크: user input → DB  (taint)                 │
│ 복잡도: HIGH  ·  주요 호출: 14곳  ·  테스트 커버: 0%  │
│ [상세 보기]  [taint 추적]  [리팩토링 제안]             │
└───────────────────────────────────────────────────────┘
```

- 클릭 없이 바로 이해 — "Time-to-understand" 핵심 KPI
- 3초 안에 이 파일이 얼마나 위험한지 파악

---

## AI 보다 낫다 — LLM Fail Comparison Mode

### 사이드바이사이드 비교

```
┌────────────────────────┬──────────────────────────────┐
│  💬 ChatGPT에게 물어봄  │  🔬 p0에게 물어봄             │
├────────────────────────┼──────────────────────────────┤
│ "이 함수 안전한가요?"   │ "이 함수 안전한가요?"          │
│                        │                              │
│ "일반적으로 user input  │  ❌ 안전하지 않음             │
│  을 검증해야 합니다.    │                              │
│  sanitize 하세요."     │  근거:                        │
│                        │  • req.body.amount → db.update│
│                        │    (line 12 → line 34)       │
│                        │  • sanitizer 없음             │
│                        │  • 31 files 전파              │
│  ← 추측, 근거 없음      │  ← 실제 경로, 실제 라인       │
└────────────────────────┴──────────────────────────────┘
```

- 실제 코드베이스에서 동일한 질문을 LLM vs p0에 동시에
- LLM: 일반론 / p0: 이 코드베이스의 실제 경로
- "왜 p0가 다른가" 한 줄: "LLM은 코드를 모른다. p0는 읽는다."

### PR Disaster Preview

PR 올리기 전에 "이 PR이 팀에 어떤 재앙을 가져오는지" 미리 보기.

```
┌─────────────────────────────────────────────────────┐
│  ☠️  PR #234 Disaster Preview                        │
│                                                      │
│  변경 파일: 3개                                      │
│  실제 영향: 47개 파일 (선형 의존)                    │
│  깨질 테스트: 8개 (4개는 커버 안됨)                  │
│  taint path 신규 생성: 2개                           │
│  팀원 작업 중인 파일 충돌: @kimdev (auth.ts)         │
│                                                      │
│  [상세 보기]  [안전한 수정 제안]                     │
└─────────────────────────────────────────────────────┘
```

- "내 3줄 변경이 47개 파일에 영향" — 팀 단위 임팩트 가시화
- 충돌 예정인 동료 이름까지 표시 → "이거 팀에 보여줘야 해" 반응

---

## 바이럴 — 1-click Share Replay

### 세션 하이라이트 공유

"내가 발견한 것"을 5초 짜리 클립으로 공유.

```
[발견 순간 자동 감지]
  → blast radius 급증 (31 → 47)
  → CVE 발견
  → 예상치 못한 taint path 등장
  → 빌드 터짐

→ [공유하기] 버튼 자동 노출
```

공유 링크 열면:
```
1. 그 순간 3초 전 상태부터 재생
2. 분석 오버레이 포함한 코드 + 그래프 변화
3. "이걸 직접 해보기" CTA → 새 세션 진입
```

- URL: `p0.dev/replay/abc123`
- 기술 트위터/슬랙에서 공유 → 직접 체험 funnel
- 공유된 세션에서 관중이 직접 체험 → 바이럴 루프

---

## 개발자 반응 유발 기능

### "Why does this code exist?"

Git 히스토리 + PR 의도 분석으로 "이 코드가 왜 존재하는가" 추적.

```typescript
// 우클릭 → "Why does this exist?"
const legacyPaymentFlag = process.env.LEGACY_PAYMENT

→ 결과 카드:
┌─────────────────────────────────────────────────┐
│  📜 이 코드의 역사                                │
│                                                  │
│  커밋 #4a7f: "hotfix: legacy payment fallback"  │
│  2024-03-12 · @parkdev                          │
│  PR #891: "결제 시스템 마이그레이션 중 임시 플래그"│
│                                                  │
│  현재 상태: 마이그레이션 완료 후에도 남아있음       │
│  판단: 제거 가능 (legacy path 이미 dead)          │
│                                                  │
│  [제거 미리보기]  [PR #891 보기]                  │
└─────────────────────────────────────────────────┘
```

> capability: `git_history`, `dead_code`, `change_impact_analysis`, `pr_intent_analysis`

### "You Missed This" — 분석 기반 누락 알림

개발자가 인지하지 못한 항목을 분석 근거와 함께 제시하는 알림.

```
✋ processRefund() 에서 놓친 것들:

  • 테스트 없음 (14곳에서 호출되는데)
  • edge case 누락: amount < 0 처리 없음
  • race condition 가능성: counter 동시 접근
  • 이미 90% 같은 함수 있음: processPayment()

[각각 확인하기]
```

- 분석 결과 기반이라 근거 있는 "도발"
- "이걸 놓치고 있었다고?" → 즉각 클릭 → 분석 체험 심화

---

## Flow 보존 IDE — 집중 방해 없는 UX

### Adaptive UI Noise Control

유저 상태에 따라 UI 밀도 자동 조절:

```
타이핑 중   → 거의 아무것도 안 띄움. 코드만.
멈추면      → 분석 오버레이 점진적 노출 (300ms 딜레이)
탐색 중     → 콜 그래프 / taint 그래프 풀 노출
집중 구간   → 경고 최소화 (Critical만 유지)
```

원칙: "정보는 많되, 방해는 없어야 한다"

- 타이핑 debounce 완료 후 분석 결과 노출
- 경고 팝업은 Critical만 즉시 — Warning/Info는 사이드바로
- 호버 시에만 상세 노출, 기본은 숫자 뱃지만

### Structural View — "읽는" IDE가 아닌 "보는" IDE

코드를 문장이 아니라 구조로 보여주는 요약 카드. 코드 오른쪽에 항상 표시.

```
function processRefund()

  Input:  user input (tainted)    🔴
  Transform: validate → compute
  Output: DB write                ⚠️
  Risk:   HIGH
```

- 함수 클릭 없이도 옆에 구조 카드 표시
- "코드 읽기" → "구조 파악" 으로 패러다임 전환

---

## Teleport Navigation — 이동이 아닌 순간이동

### Jump by Intent

```
⌘K → "이 값 어디서 바뀜?"
  → 즉시 해당 라인으로 순간이동
  → 경로 (A → B → C) 브레드크럼으로 표시
  → 돌아오기: ⌘[ 한 번
```

### Jump by Risk

```
⌘K → "가장 위험한 코드"
  → Risk Score 기준 상위 3개 파일/함수 즉시 표시
  → 클릭 → 해당 위치 + 분석 컨텍스트 함께 로드
```

- 기존 IDE: 파일트리 탐색 → 폴더 열기 → 파일 열기 → 스크롤
- p0: 의도 입력 → 즉시 도착

---

## Ghost Execution — 실행 없는 실행

### 코드 변경 시뮬레이션 (강화)

```
조건문 수정:
  if (amount >= 0)  ← 기존: >

→ Ghost Execution 결과:
  ┌──────────────────────────────────────┐
  │  샘플 케이스별 예측 결과              │
  │                                      │
  │  amount = 0:  기존 → 스킵, 수정 → 실행  ⚠️  │
  │  amount = -1: 기존 → 스킵, 수정 → 스킵     │
  │  amount = 100: 기존 → 실행, 수정 → 실행    │
  │                                      │
  │  행동 변화: 1 case  ·  영향 파일: 31 → 37  │
  └──────────────────────────────────────┘
```

- 실제 실행 없음 — 정적 분석 기반 예측
- "이 조건이면 이런 결과" 를 샘플 값으로 시각화
- "코드 실행 없이 실행한 느낌"

---

## 타임머신 강화 — "Why did this break?"

### 자동 버그 추적

현재 상태에서 문제 감지 → 과거 자동 추적.

```
현재: processRefund에 taint path 있음

→ 자동 추적:
  커밋 #4a7f (2024-03-12): 처음으로 taint path 등장
  
  diff:
    - const amount = sanitize(req.body.amount)
    + const amount = req.body.amount        ← 여기서 깨짐
  
  분석:
    이 커밋 이전: taint path 없음 ✓
    이 커밋 이후: taint path 있음 ✗
    
  [이 커밋으로 이동]  [수정 제안]
```

- 디버깅 시간 10배 단축
- "언제부터 위험해졌나" 질문에 커밋 레벨로 답변

---

## Trust UX — 분석 결과 신뢰 설계

### Confidence + Evidence 필수 표시

모든 분석 결과에 신뢰도 + 근거 표시:

```
⚠️  Taint Path Detected
Confidence: 92%

Evidence:
  • call graph path: req.body → processRefund → db.update
  • dataflow path:   line 12 → line 34 → line 67
  • no sanitizer in path: validated (3 checks)

[경로 하이라이트]  [반박하기]
```

- 근거 없는 경고 = 즉시 불신 → 근거 있는 경고 = 신뢰
- "반박하기" 버튼: 개발자가 "이건 의도적이야" 표시 가능
- False positive 누적 → 자동 confidence 조정

---

## 경고 시스템 설계

### Severity + Suppression

경고 피로를 막는 계층화된 경고 시스템.

```
🔴 Critical   → 항상 인라인 표시, 클릭 없이 보임
🟠 Warning    → 사이드바로, 뱃지 숫자만 인라인
🟡 Info       → 기본 숨김, 요청 시 노출
```

- "이 경고 무시" 기능 필수 — 이유 선택 (의도적 / 알고있음 / 나중에)
- 무시한 경고는 세션 내 기억
- 같은 패턴 반복 무시 → confidence 자동 조정

### Keyboard-first UX

개발자는 마우스 싫어함. 모든 기능 키보드로 가능.

```
⌘K         → 전체 Command Palette
⌘⇧T        → taint trace 토글
⌘⇧B        → blast radius 보기
⌘⇧R        → Risk Meter 열기
⌘[  /  ⌘] → Jump 히스토리 앞/뒤
⌘⇧X        → "Why does this exist?"
⌘⇧S        → Simulate change
```

- Zero mouse workflow 완전 지원
- Command Palette에서 자연어 입력 → 모든 분석 기능 접근

---

## 관제탑 IDE — Control Tower Mode

### 철학

이건 에디터가 아니다. **관제탑**이다.

```
기존 IDE:     개발자가 코드 안에 들어가서 줄 단위로 씀
Cursor:       AI가 코드를 대신 써줌
p0:           개발자가 시스템 위에서 내려다보고, 딸깍으로 제어한다
```

비유: 조종석 vs 관제탑
- 조종석(기존 IDE): 비행기 1대를 직접 조종. 시야 = 앞만.
- 관제탑(p0): 전체 활주로를 내려다봄. 모든 비행기 상태 실시간. 위험 즉시 감지. 명령 한 마디로 경로 변경.

---

### 관제탑 메인 뷰

에디터 위에 항상 떠있는 시스템 전체 조감도.

```
┌─────────────────────────────────────────────────────────────────┐
│  🗼 p0 Control Tower                                            │
│                                                                  │
│  ┌─ 시스템 상태 ───────┐  ┌─ 지금 위험한 것 ──────────────────┐│
│  │ Risk Score  72/100  │  │ 🔴 payment    taint×3 테스트0%    ││
│  │ Taint       5 paths │  │ 🔴 auth       복잡도 9.4 race    ││
│  │ Dead Code   12%     │  │ 🟠 webhook    dead 847줄         ││
│  │ Tech Debt   ↑+12%   │  │ 🟡 session    spec위반×2         ││
│  └─────────────────────┘  └───────────────────────────────────┘│
│                                                                  │
│  ┌─ 지금 일어나는 일 ──────────────────────────────────────────┐│
│  │ @kimdev   auth.ts 수정 중     blast +4  ⚠️                 ││
│  │ @parkdev  PR #234 리뷰 대기   taint +2  🔴                 ││
│  │ @leedev   빌드 실행 중        예상: 성공  🟢                ││
│  │ 마지막 장애  12일 전  payment  (P0)                        ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  [⌘K 무엇이든 질문]                                              │
└─────────────────────────────────────────────────────────────────┘
```

- 열자마자 시스템 전체가 보임
- "이 레포 지금 어때?" → 대답이 이미 화면에 있음
- 위험한 곳 클릭 → 즉시 텔레포트

---

### 즉시 네비게이션 — "원하는 위치로 바로 이동"

마우스 호버 / 키보드 단축키 / 프롬프트 입력 — 세 가지 경로로 즉시 도달.

#### 제스처 기반 탐색

```
관제탑 뷰에서:

🔴 payment 노드 위에 마우스 올림
  → 즉시: 연결된 모듈 하이라이트 (auth, db, webhook)
  → 연결선 위에 숫자: "14 calls", "taint path"

🔴 payment 노드 클릭
  → 줌 인: payment 모듈 내부 구조 펼쳐짐
  → 함수별 위험도 히트맵
  → 가장 위험한 함수 자동 하이라이트

더블 클릭
  → 해당 코드로 텔레포트 + 분석 컨텍스트 함께 로드

⌘ + 스크롤
  → 줌 인/아웃 — 시스템 전체 ↔ 모듈 ↔ 함수 ↔ 라인 레벨
```

#### 관제탑 ↔ 코드 즉시 전환

```
관제탑 뷰:
  시스템 전체 보다가 → 위험 노드 클릭 → 코드 뷰로 스무스 전환

코드 뷰:
  코드 보다가 → ⌘\ → 관제탑으로 줌 아웃 → "내가 지금 어디 있는지" 전체 맥락

→ 망원경 줌 인/아웃 느낌
```

---

### ⌘K — 만능 프롬프트

관제탑의 통합 인터페이스. 무엇을 입력해도 즉시 분석 결과를 반환한다.

#### 자연어 → 즉시 실행

```
⌘K  "가장 위험한 코드"
  → Top Risk Surface 즉시 표시 + 1위 파일로 텔레포트

⌘K  "이 함수 바꾸면 뭐 터져?"
  → blast radius + 깨질 테스트 + taint 변화 카드

⌘K  "payment랑 auth 관계가 뭐야?"
  → 두 모듈 간 의존 그래프 + 공유 데이터 경로

⌘K  "지난주에 뭐가 깨졌어?"
  → 장애/빌드 실패/hotfix 타임라인

⌘K  "이 PR 안전해?"
  → Deep Scan 결과 카드

⌘K  "테스트 없는 함수 전부"
  → 리스트 + 위험도 순 정렬 + 각각 [테스트 생성] 버튼

⌘K  "@kimdev가 뭐 하고 있어?"
  → 현재 수정 중인 파일 + blast radius + PR 상태

⌘K  "이 코드 왜 있어?"
  → git history + PR intent + dead 여부 분석

⌘K  "이번 스프린트 기술부채 얼마나 늘었어?"
  → 기간별 부채 그래프 + 주요 원인 파일
```

핵심: **모든 답이 분석 결과 카드** — 채팅 ❌ 대화 ❌ 결과 즉시 ✅

#### 프롬프트 자동 완성

타이핑 시작하면 자동으로 맥락 인식 제안:

```
⌘K  "이"
  → 이 함수 위험한 이유?
  → 이 파일 히스토리
  → 이 변수 어디서 바뀌어?
  → 이 PR 영향 범위

⌘K  "왜"
  → 왜 이 함수 위험해?
  → 왜 이 테스트가 깨져?
  → 왜 이 코드가 존재해?

⌘K  "누가"
  → 누가 이 파일 마지막으로 수정?
  → 누가 이 taint path 도입?
  → 누가 지금 이 모듈 작업 중?
```

- 2글자만 쳐도 의도 파악
- 현재 커서 위치 / 열린 파일 / 관제탑 포커스에 따라 제안이 달라짐

#### 연쇄 프롬프트 — 꼬리물기

```
⌘K  "이 함수 위험해?"
  → 결과 카드: taint path 2개, blast radius 31

카드 안에서 바로:
  ⌘K  "이 taint 어떻게 고쳐?"
    → sanitizer 삽입 제안 + 미리보기

  ⌘K  "고치면 blast radius 줄어?"
    → 시뮬레이션: 31 → 24  (-7)

  ⌘K  "그럼 바로 적용해"
    → [Apply] → 코드 변경 + 분석 재실행 → 확인
```

- 대화가 아니라 **드릴다운** — 깊이 파고들기
- 매 단계마다 결과 카드 → 다음 질문으로 이어짐
- 3번이면 문제 발견 → 원인 파악 → 수정까지 끝

---

### 관제탑 뷰 레이어

줌 레벨에 따라 보이는 정보가 달라짐.

#### Level 0 — 우주 (레포 전체)

```
┌─────────────────────────────────────────────┐
│                                              │
│     [payment] ←──→ [auth]                   │
│         ↓              ↓                     │
│     [db] ←────→ [webhook]                   │
│                     ↓                        │
│               [notification]                 │
│                                              │
│  각 노드 크기 = 위험도                       │
│  연결선 두께 = 의존도                        │
│  색상: 🔴위험 🟠경고 🟢안전                  │
└─────────────────────────────────────────────┘
```

#### Level 1 — 대륙 (모듈 내부)

```
payment 모듈 확대:

  processRefund ●── 🔴 taint, 복잡도 8.2
  processPayment ●── 🟡 87% 클론
  validateAmount ●── 🟢 safe
  sendReceipt ●── 💀 dead

  파일 간 연결선 + 데이터 흐름 방향
```

#### Level 2 — 도시 (파일 레벨)

```
payment.ts 확대:

  함수별 히트맵
  라인별 taint 경로
  CodeLens + 인라인 마커
  → 여기서부터 기존 에디터 경험
```

#### Level 3 — 거리 (라인 레벨)

```
코드 편집 모드
  → 모든 Layer 1/2/3 경험 활성화
  → 관제탑 미니맵은 우측 상단에 축소 표시
```

- **핵심: 줌만 하면 된다** — 우주에서 거리까지 끊김 없이
- 관제탑에서 시작해서 점점 파고들기
- 코드에서 시작해서 점점 확대해서 전체 맥락 보기

---

### 실시간 이벤트 피드

관제탑 하단에 흐르는 실시간 이벤트 스트림.

```
┌─ Live Feed ─────────────────────────────────────────────┐
│ 14:32  @kimdev   auth.ts:47 수정  blast +4  ⚠️         │
│ 14:31  빌드 #847  성공  @leedev                         │
│ 14:29  PR #234   taint path +2 감지  🔴                │
│ 14:27  @parkdev  processRefund  dead code 제거  -847줄  │
│ 14:25  Risk Score  74 → 72  ↓  🟢                      │
│ 14:22  @kimdev   auth.ts 열음                           │
└─────────────────────────────────────────────────────────┘
```

- 팀에서 지금 무슨 일이 일어나고 있는지 실시간
- 위험한 이벤트는 빨갛게 튀어올라옴
- 클릭 → 해당 컨텍스트로 즉시 텔레포트

### 알림 시스템 — 관제탑 경보

```
평소:   조용함. 아무 소리 없음.
주의:   🟡 사이드바에 뱃지 숫자만 올라감
경고:   🟠 관제탑 뷰에 노드 깜빡임 + 알림 카드
긴급:   🔴 화면 상단 배너 + 사운드

예:
┌─────────────────────────────────────────────────────────┐
│  🔴 ALERT: @kimdev의 변경으로 taint path 3 → 7 급증    │
│  영향 모듈: payment, auth, db                           │
│  [바로 보기]  [해당 커밋]  [무시]                       │
└─────────────────────────────────────────────────────────┘
```

- 실제 위험 이벤트에만 발생 — 경고 피로를 유발하는 빈도가 아님
- "이 사람이 방금 뭔가 위험한 걸 했다" → 팀 리드가 바로 개입 가능

---

### 시간 축 — 관제탑 타임라인

관제탑 뷰를 시간으로 슬라이드.

```
←  1주 전  ─────  3일 전  ─────  어제  ─────  지금  →

  Risk Score 그래프:   ─────╱──────╲──╱─────
  Taint paths:         2    3      5   3    5
  빌드 성공률:        100%  95%   88%  92%  90%
  
  📍 여기서 급증 → 클릭 → 해당 커밋/PR로 텔레포트
```

- "언제부터 이렇게 됐어?" → 타임라인 슬라이드로 즉시 답
- 특정 시점 클릭 → 그때의 관제탑 뷰 복원
- 타임머신 + 관제탑 결합

---

### 관제탑 퀵 액션 — 코드 진입 없이 즉시 실행

관제탑에서 바로 실행 가능한 원클릭 액션들:

```
🔴 payment 노드 우클릭:
  ├── 🔍 이 모듈 전체 스캔
  ├── 📊 위험도 추세 (1주/1달/3달)
  ├── 👤 누가 제일 많이 건드렸어?
  ├── 🔥 핫스팟 함수 TOP 5
  ├── 💀 이 모듈 dead code 전체 제거
  ├── 🛡️  taint path 전부 보기
  ├── 📋 이 모듈 리포트 생성 → 슬랙 공유
  └── ⚡ "이 모듈 건강하게 만들어" → 액션 플랜 생성

노드 간 연결선 우클릭:
  ├── 🔀 이 의존 관계 상세
  ├── ⚠️  이 연결 끊으면 뭐 터져?
  └── ✂️  이 의존 제거하는 리팩토링 제안
```

- 관제탑에서 코드로 내려가지 않고도 판단 + 행동 가능
- 팀 리드: "payment 모듈 상태 어때?" → 우클릭 → 리포트 → 슬랙 공유 → 끝

---

### 관제탑이 진짜 관제탑인 이유

```
기존 IDE        →  파일 하나 열고 줄 단위로 씀
                   "나무 하나"를 봄

Cursor/Copilot  →  파일 하나 열고 AI가 대신 써줌
                   "나무 하나"를 AI가 대신 깎아줌

p0 관제탑       →  숲 전체를 내려다봄
                   어떤 나무가 병들었는지 즉시 보임
                   클릭하면 그 나무로 줌 인
                   고치면 숲 전체에 미치는 영향 실시간
                   다시 줌 아웃하면 숲이 건강해졌는지 확인

→ "코드를 치는 도구"가 아니라 "시스템을 제어하는 도구"
```

---

## p0 vs Cursor — 이겨야 하는 지점

### 왜 다른가

| | Cursor / Copilot | p0 |
|---|---|---|
| 결과 신뢰도 | "이렇게 될 것 같아요" | "이렇게 됩니다 (근거 있음)" |
| 변경 영향 | 모름 | "이거 바꾸면 31파일 터짐" |
| 설명 방식 | 블랙박스 추론 | call graph + dataflow + evidence |
| 타이밍 | 문제 생기고 고침 | 문제 생기기 전에 막음 |

**확률 vs 사실** — LLM은 확률적 추측, p0는 정적 분석 사실.  
기업 도입 결정 기준: "설명 가능한가?" → p0만 가능.

### 4가지 차별화 포인트

**1. Deterministic Truth**  
`change_impact_analysis` 기반. 추측 없이 실제 경로 + 라인 번호.

**2. Impact Awareness**  
Blast radius 수치 하나. "31파일 영향" — 이 하나의 지표로 경쟁 제품과 명확히 차별화된다.

**3. Explainable System**  
콜 그래프 + 데이터플로우 + evidence 전부 노출. 블랙박스 ❌.

**4. Prevention > Generation**  
코드 생성이 아니라 "이 코드 치면 생기는 일" 을 먼저 보여줌.  
→ 기업 도입 ROI가 직접적으로 연결되는 영역.

---

## B2B 전환 핵심 UX — 반드시 포함할 5가지

### 1. PR Gate Killer (계약 클로저)

PR merge 전에 자동으로 위험 분석 리포트.

```
┌─────────────────────────────────────────────────────┐
│  ⚠️  PR #234 — Merge Risk Analysis                   │
│                                                      │
│  영향 파일:    31개                                  │
│  깨질 테스트:  12개 예상  (4개 커버 없음)            │
│  Security:    HIGH  (taint path × 2 신규)           │
│  팀 충돌:     @kimdev (auth.ts 동시 작업 중)         │
│                                                      │
│  [Block Merge]  [상세 분석]  [강제 진행]             │
└─────────────────────────────────────────────────────┘
```

- CI/CD 파이프라인에 p0 게이트 삽입
- 이거 하나로 B2B 계약 클로즈됨
- "merge 전에 알려줌" — ROI 설명 1초

### 2. 1-click Root Cause

버그 발생 → 클릭 한 번 → 원인 즉시.

```
버그: "refund 금액 이상함"

→ [Root Cause 찾기]

결과:
  원인 함수: processRefund() — line 34
  경로: req.body.amount → no sanitize → db.update
  최초 도입: 커밋 #4a7f (2024-03-12 @parkdev)
  
[해당 라인으로 이동]  [수정 제안]
```

- 디버깅 시간 10배 → 1배
- taint_flow + call_graph + git_history 조합
- 즉각적인 신뢰 반응 유발

### 3. Safe Change Guarantee

리팩토링 전후 behavior 동일성 보증.

```
Extract Method 완료
  ✓ behavior 동일  (dataflow 스냅샷 비교)
  ✓ side effect 없음  (effect_analysis)
  ✓ 모든 호출 경로 커버
  
  → "안전하게 적용됨"
```

- 테스트 없어도 검증
- "내가 뭔가 깨뜨린 게 아닌가" 불안 제거
- 개발자 신뢰의 핵심

### 4. Top Risk Surface

레포 전체에서 가장 위험한 영역 즉시 표시.

```
┌─────────────────────────────────────────────────────┐
│  🔥 Top Risk Surface                                 │
│                                                      │
│  #1  payment.ts      — taint × 3, 테스트 0%        │
│  #2  auth/validate   — 복잡도 9.4, race 가능성      │
│  #3  db/migrations   — 14 unsafe writes             │
│  #4  api/webhook     — dead code 847줄 포함         │
│  #5  user/session    — spec 위반 × 2                │
│                                                      │
│  [각각 분석하기]                                     │
└─────────────────────────────────────────────────────┘
```

- 팀장/CTO가 제일 좋아하는 뷰
- "우리 레포 어디가 제일 위험해?" → 즉시 답변
- 온보딩 데모 시작점으로 활용

### 5. What Will Break? (편집 전 예측)

코드 수정 시작 전에 "뭐가 깨지는지" 먼저 보여줌.

```
processRefund 수정 감지 →

┌─────────────────────────────────────────────────────┐
│  ❓ 이거 바꾸면 뭐 깨짐?                             │
│                                                      │
│  테스트:  PaymentTest.refund_flow  (높은 확신)       │
│           BillingIntegration.full_flow              │
│  파일:    31개 (직접 의존 14, 간접 17)               │
│  taint:   2 경로 통과 가능성                        │
│                                                      │
│  [계속 수정]  [blast radius 보기]  [취소]           │
└─────────────────────────────────────────────────────┘
```

- change_impact_analysis + taint_flow 조합
- 핵심 차별점 — 개발자가 가장 두려워하는 순간 커버
- 수정 전 경고 → "이거 없이 어떻게 개발했지?" 반응

---

## 온보딩 플로우 — 첫 방문자 경험

### 30초 WOW 시나리오

첫 방문자가 아무것도 모르고 들어와도 30초 안에 "이거 다르다" 납득하게.

```
0s   → IDE 열림. 코드 위에 뱃지/마커 가득. "어? 이거 다른데?"
5s   → 자동으로 processRefund 하이라이트 + "📍 blast: 31 files" 표시
10s  → 살짝 흔들리는 [클릭해봐] 힌트 → 클릭 → 콜 그래프 폭발 등장
15s  → "조건문 한 줄 바꿔봐" 가이드 → 수정 → blast 31→37, taint +1
25s  → "이게 방금 네가 친 코드 때문이야" 요약 카드
30s  → [직접 해보기 — 내 레포 연결] CTA
```

- "클릭해봐" 힌트는 처음 한 번만, 이후엔 안내 없이
- 강제 튜토리얼 ❌ — ambient 유도로 자연스럽게

### 감정 설계 순서

```
놀라움 → 이해 → 납득 → 공유욕
```

1. **놀라움**: 코드 열자마자 정보 가득 — "이게 다 뭐야?"
2. **이해**: 한 클릭으로 전체 연결 구조 보임 — "아 이렇게 돼있구나"
3. **납득**: 내가 친 코드가 시스템을 바꿈 — "와 이게 진짜 분석이네"
4. **공유욕**: 관중 알림 + 공유 버튼 — "팀에 보여줘야 해"

---

## "팀내 천재 개발자" 경험 — Developer Superpower Mode

핵심 컨셉: **p0 쓰는 사람이 팀에서 제일 똑똑해 보인다.**

PR 날릴 때 이미 "내가 다 알고 있음"을 증명하는 지표들. 코드 리뷰 시 "이 코드가 왜 문제인지"를 수치로 제시하는 근거 도구들.

---

### Code Health Dashboard — 내 PR의 건강검진표

PR 올리기 전에 p0가 자동으로 생성하는 코드 건강 리포트.

```
┌──────────────────────────────────────────────────────────┐
│  📋 PR #234 Code Health Report                           │
│                                                          │
│  리팩토링 지수      72 / 100  🟡  (낮을수록 복잡)        │
│  더러운 코드 지수   34 / 100  🟢  (낮을수록 깔끔)        │
│  기술부채 증가      +12점     🔴  (이 PR로 악화)         │
│  테스트 커버리지    18%       🔴  (평균 43% 대비 낮음)   │
│  중복 코드         3곳        🟡  (processPayment와 87%) │
│  blast radius      31 파일   🔴  (평균 PR의 3배)        │
│                                                          │
│  종합 점수:  C+   →  [개선 제안 보기]                    │
└──────────────────────────────────────────────────────────┘
```

- PR description에 자동 삽입 옵션 → 리뷰어가 열기도 전에 선제적으로 보여줌
- "나 다 알고 PR 올림" 시그널

---

### 코드 품질 지표 전체 목록

| 지표 | 설명 | capability |
|---|---|---|
| **리팩토링 지수** | 함수 추출 가능성, 응집도 낮은 구간, 파라미터 과다 | `code_actions`, `program_dependence` |
| **더러운 코드 지수** | 복잡도 × 중복도 × 테스트 부재 종합 | `clone_detection`, `dead_code`, `complexity` |
| **기술부채 점수** | 이 PR이 전체 부채를 얼마나 늘렸는지 | `change_impact_analysis`, `complexity` |
| **Blast Radius** | 내 변경이 얼마나 멀리 퍼지는지 | `change_impact_analysis` |
| **Taint Score** | user input이 얼마나 많은 싱크로 흐르는지 | `taint_flow` |
| **Dead Weight** | 쓰이지 않는 코드 비율 | `dead_code` |
| **Clone Density** | 중복 코드 밀도 | `clone_detection` |
| **Spec Compliance** | 호출 순서 규약 위반 건수 | `spec_mining`, `spec_verification` |
| **Concurrency Risk** | race condition 가능성 구간 | `concurrency_analysis` |
| **Resource Safety** | 닫히지 않는 리소스 경로 수 | `typestate_analysis` |

---

### PR 리뷰어 모드 — 직관이 아닌 수치로 코멘트

남의 PR 리뷰할 때 p0가 무기가 됨.

```
리뷰어 뷰:

processRefund() 변경 감지

  ❌ 리팩토링 지수  41 → 29  (악화)
  ❌ 더러운 코드   +18점 증가
  ❌ 기술부채      이 파일 이미 상위 10% 위험
  ⚠️  중복 코드    processPayment와 87% 유사
  ⚠️  테스트       추가한 코드 커버 0%

  자동 코멘트 초안:
  "processRefund의 복잡도가 8.2→11.4로 증가했습니다.
   processPayment와 87% 유사한 로직이 있어 통합을 권장합니다.
   [클론 비교 보기]"

[코멘트 삽입]  [수정 제안 첨부]
```

- 직관이 아니라 수치로 코멘트 → 반박 불가
- "근거 없이 이상해 보여요" → "p0 점수 기준으로 보시죠"

---

### My Code vs Team Average

팀 평균 대비 내 코드 품질 대시보드.

```
┌──────────────────────────────────────────────────────────┐
│  👤 내 코드 vs 팀 평균                                    │
│                                                          │
│  복잡도          나: 6.2   팀 평균: 4.8   🔴 +29%       │
│  테스트 커버      나: 31%   팀 평균: 58%   🔴 낮음        │
│  기술부채 기여    나: +24   팀 평균: +8    🔴 3배         │
│  중복 코드       나: 12%   팀 평균: 7%    🟡             │
│  리팩토링 제안    34건      (미처리)                      │
│                                                          │
│  → 이 달 내가 제일 개선해야 할 것: 테스트 커버리지        │
└──────────────────────────────────────────────────────────┘
```

- 내가 팀 평균 이상이면 → "이번 PR 깔끔하게 올렸네" 자신감
- 팀장은 팀 전체 뷰로 확인 → 누가 기술부채 제일 많이 만드는지

---

### PR 승인 빠르게 따내는 법 — "선제 방어"

리뷰어가 물어보기 전에 먼저 답하기.

```
PR description에 p0 리포트 자동 첨부:

---
## p0 분석 결과

✅ blast radius 31파일 — 의도된 변경 (결제 모듈 전면 개편)
✅ behavior diff 검증됨 — 기존 로직과 동일 동작
✅ 새 taint path 없음
⚠️  테스트 커버 18% — 다음 PR에서 보강 예정

[전체 분석 보기]
---
```

- 리뷰어가 "이거 영향 범위 어때?" 물어보기 전에 이미 답
- "이 사람 코드 잘 알고 있네" → 빠른 승인
- 팀 내 신뢰 적립

---

### PR 리뷰 모드 — "코드 읽지 말고 분석 읽어"

기존 PR 리뷰: 줄 하나하나 읽고 직관으로 코멘트  
p0 PR 리뷰: 분석 결과 보고 수치로 판단

#### 리뷰어 진입 화면

```
┌──────────────────────────────────────────────────────────┐
│  🔍 PR #234 리뷰 — p0 분석 완료                          │
│                                                          │
│  변경 파일  3개   →   실제 영향  31개 파일               │
│  리팩토링   악화  (72 → 58)                              │
│  더러운코드 +18점 증가                                   │
│  taint     신규 2개 경로                                 │
│  테스트     커버 0%  (새 코드 기준)                      │
│                                                          │
│  [⚠️ 위험 포인트만 보기]  [전체 diff]  [영향 그래프]     │
└──────────────────────────────────────────────────────────┘
```

#### 리뷰 집중 모드 — "중요한 것만 보여줘"

p0가 리뷰어 대신 "여기만 봐" 포인트 추려줌:

```
🎯 리뷰 필수 확인 3곳

1️⃣  payment.ts:34   ← taint path 신규 도입
     req.body.amount → db.update (sanitizer 없음)
     [라인으로 이동]  [taint 추적]

2️⃣  payment.ts:67   ← processPayment와 87% 중복
     → 통합 가능  [클론 비교]

3️⃣  auth/validate:12  ← blast radius 31 → 47로 증가
     → 이 변경이 auth 모듈 전체를 건드림
     [영향 파일 목록]
```

- 리뷰어가 100줄 읽는 대신 3곳만 집중
- 각 포인트마다 [승인] [요청] [질문] 버튼 인라인

#### 자동 코멘트 생성

p0 분석 기반으로 코멘트 초안 자동 작성. 리뷰어는 확인만.

```
p0 초안:

"req.body.amount가 sanitize 없이 db.update까지 전달됩니다.
line 12 → line 34 경로. taint_flow 분석 결과.
[경로 보기]"

[그대로 올리기]  [수정 후 올리기]  [건너뛰기]
```

#### Diff + 분석 나란히 보기

```
┌──────────────────────┬──────────────────────────────┐
│  코드 diff            │  분석 변화                    │
├──────────────────────┼──────────────────────────────┤
│ - const amount =     │  taint path: 없음             │
│     sanitize(...)    │                              │
│ + const amount =     │  taint path: 생김  🔴        │
│     req.body.amount  │  → db.update까지 전파        │
│                      │  → 31 파일 영향              │
└──────────────────────┴──────────────────────────────┘
```

- 왼쪽: 코드 변경 / 오른쪽: 그 변경이 분석에 미친 영향
- "이 줄 바꿨더니 taint 생겼구나" 즉시 이해

#### 리뷰 완료 체크리스트 자동 생성

```
✅ p0 리뷰 체크리스트  PR #234

  [ ] taint path 2개 — 의도된 변경인지 확인
  [ ] blast radius 31→47 — 이 범위 인지했는지
  [ ] 중복 코드 87% — 통합 필요 여부 논의
  [ ] 테스트 커버 0% — 추가 계획 있는지

→ 전부 확인 후 Approve
```

- 리뷰어가 "뭘 봐야 하나" 고민 없이 체크리스트 따라가면 됨
- PR 작성자가 미리 답변 첨부 가능

#### "이 PR 진짜 괜찮아?" — 1-click Deep Scan

리뷰어가 직관적으로 불안함을 느낄 때. "명확한 근거는 없지만 확인이 필요하다" → 클릭 한 번.

```
[🔬 Deep Scan 실행]

결과:
┌──────────────────────────────────────────────────────────┐
│  🔬 Deep Scan — PR #234                                  │
│                                                          │
│  🟢 behavior diff       기존 로직과 동일 동작           │
│  🔴 hidden dependency   config.yaml 변경 시 깨짐        │
│  🔴 implicit contract   processRefund → sendWebhook     │
│       호출 순서 변경됨 (기존: validate → send → log)    │
│       (이 PR 후: validate → log → send)                 │
│  🟡 perf regression     루프 안 DB query — N+1 가능성   │
│  🟢 concurrency safe    race condition 없음             │
│                                                          │
│  총평: "동작은 같지만, 숨은 의존성 2개 확인 필요"        │
└──────────────────────────────────────────────────────────┘
```

- `behavior_diff` + `spec_mining` + `effect_analysis` + `concurrency_analysis` 풀 조합
- 코드 읽어서는 절대 못 찾는 것들 → p0만 잡아줌
- 리뷰어가 10년차여도 놓치는 implicit contract 위반을 기계가 잡음

#### 히스토리 트래킹 — "이 파일의 장애/리젝 이력"

이 PR이 건드리는 파일들의 과거 사고 이력 자동 표시:

```
⚠️  이 PR이 건드리는 파일 전과 기록

payment.ts
  • 3달 전  — P0 장애 원인  (sanitizer 빠져서 DB 오염)
  • 1달 전  — hotfix 2건  (@parkdev)
  • 지난주  — 리뷰 리젝 1건  (복잡도 초과)

auth/validate.ts
  • 2달 전  — 보안 취약점 발견  (taint path)
  • 매주 평균 2.3건 수정  ← 핫스팟

→ "이 파일 건드릴 때는 특히 조심"
```

- git blame + commit history + PR history + 장애 기록 종합
- "이 파일 원래 문제 많아" → 리뷰 강도 자동 조절
- 처음 보는 코드도 "아 여기 위험한 데구나" 즉시 인지

#### 리뷰어 학습 모드 — "나도 이 코드 이해하고 싶어"

리뷰어가 코드 처음 볼 때. "이게 뭐 하는 건지 모르겠음" 상황.

```
🧠 Reviewer Context — payment.ts

이 파일이 하는 일:
  환불 처리 → DB 기록 → 웹훅 전송

핵심 구조:
  Input:  req.body (user input, tainted)  🔴
  Transform: validate → calculate → apply
  Output: db.update + sendWebhook
  
의존 관계:
  이 파일 ← 14곳에서 호출
  이 파일 → DB, webhook, ledger 3곳에 영향

주의점:
  • user input이 DB까지 직통 — sanitizer 필수
  • sendWebhook은 실제로 dead code (호출자 없음)
```

- 리뷰어가 파일 열자마자 "아 이게 이런 파일이구나" 즉시 파악
- 코드 100줄 읽는 대신 구조 카드 5초 보면 됨
- Structural View (앞 섹션)의 리뷰 특화 버전

#### 크로스 PR 영향 분석 — "다른 PR이랑 겹치는데?"

동시에 열려있는 PR들 사이의 충돌 / 겹침 자동 감지:

```
⚠️  PR 간 충돌 감지

PR #234 (이 PR)  ←→  PR #241 (@kimdev)
  겹치는 파일:  auth/validate.ts
  의미론적 충돌:  validate() 함수 동시 수정
  
PR #234 (이 PR)  ←→  PR #239 (@leedev)
  간접 충돌:  blast radius 겹침
  이 PR의 변경 → payment 모듈 영향
  #239의 변경 → 같은 payment 모듈 다른 경로에서 영향
  
  → 둘 다 merge되면 예상치 못한 조합 효과 가능

[PR #241 비교]  [PR #239 비교]  [안전한 merge 순서 제안]
```

- 텍스트 충돌이 아니라 **의미론적 충돌** 감지 — git은 못 잡는 것
- "둘 다 merge하면 뭐가 터짐?" 에 대한 답
- merge 순서 추천: "이거 먼저 머지하면 충돌 안 남"

#### 리뷰 속도 부스터 — "안전한 파일은 넘겨"

```
PR #234 — 변경 파일 12개

p0 자동 분류:
  🟢 안전 (5개) — 포맷팅, 타입 수정, import 정리
     → [일괄 승인]

  🟡 확인 필요 (4개) — 로직 변경이지만 behavior 동일
     → 각 파일 1-line 요약 보기

  🔴 집중 리뷰 (3개) — taint 변화, 복잡도 증가, 테스트 없음
     → 이것만 열어서 보기

→ 12개 파일 리뷰 = 실질적으로 3개만 집중
```

- 파일 12개짜리 PR도 3개만 보면 됨
- 안전한 변경은 p0가 보증 → 리뷰어 시간 75% 절약
- "어떤 파일부터 봐야 하지?" 없음 — p0가 정렬해줌

#### 리뷰 끝나고 — Approve 전 최종 확인

```
┌──────────────────────────────────────────────────────────┐
│  ✅ Approve 전 p0 최종 확인                               │
│                                                          │
│  이 PR merge 후 예상 변화:                               │
│                                                          │
│  시스템 리스크   68 → 72  (+4점)  🟡                     │
│  기술부채       +12점                                    │
│  taint path    3 → 5개  (+2)    🔴                      │
│  테스트 커버    43% → 41%       🟡                       │
│                                                          │
│  이 PR로 인해 팀에 생기는 부담:                          │
│  "다음에 payment 건드리는 사람이 taint 2개 더 신경써야 함"│
│                                                          │
│  [Approve anyway]  [Request changes]  [팀에 공유]        │
└──────────────────────────────────────────────────────────┘
```

- Approve 누르기 전에 "이게 팀에 어떤 영향인지" 한 장으로
- "다음 사람한테 부담 떠넘기는 거 아닌가?" 의식하게 만듦
- 근거 없는 Approve 방지

---

### Leaderboard (옵션) — 게임화

팀 내 코드 품질 리더보드. 선택적 활성화.

```
🏆 이번 달 코드 품질 TOP

1위  @leedev   기술부채 -48점 (가장 많이 줄임)
2위  @kimdev   테스트 커버 +31% 향상
3위  @parkdev  중복 코드 -12% 제거

최하위 오명: taint path 제일 많이 만든 사람 👀
```

- 자발적 코드 품질 경쟁 → 팀 문화 변화
- "p0 점수 올리려고" 리팩토링 자연스럽게 발생

---

## UX 감각 설계 — "기능"이 아니라 "느낌"

### 문제 인식

지금 RFC에 기능은 100개. 근데 기능 100개 = 좋은 UX 아님.
좋은 UX = **"와"가 3초 안에 터지고, 그 후엔 중독되는 것.**

```
나쁜 UX:  기능이 많다 → 어디 눌러야 하지? → 포기
좋은 UX:  아무것도 안 했는데 이미 "와" → 만지고 싶다 → 중독
```

---

### 1. 첫 인상 3초 — "뭔가 다르다"

IDE 열리는 순간. 코드가 로딩되기 전에 이미 다른 느낌.

#### 로딩 시퀀스

```
0.0s  다크 화면 + p0 로고 pulse
0.3s  파일 트리 슥 밀려들어옴 (왼쪽에서)
0.5s  코드 라인 위에서 아래로 타이핑되듯 나타남
0.8s  분석 오버레이 스르르 올라옴 — 복잡도 배경, taint 마커
1.2s  콜 그래프 패널 오른쪽에서 스무스하게 슬라이드 인
1.5s  Risk Score 바가 숫자 카운팅하며 올라감 (0 → 72)
2.0s  전체 안착. 완성.
```

- 기존 IDE: 흰 화면 → 텍스트 뿅 → 끝
- p0: **시스템이 깨어나는 느낌**. 분석이 살아있다는 첫 신호.
- 모든 요소가 stagger animation으로 순차 등장 — 영화 오프닝처럼

#### 분석 오버레이 "숨쉬기"

분석 오버레이가 정적으로 고정되면 시스템이 응답하지 않는다는 인상을 준다.

```
복잡도 배경색    → 아주 미세하게 pulse (opacity 10% ↔ 15%, 4초 주기)
taint 마커      → 빨간 점이 미세하게 깜빡 (800ms 주기)
blast radius 숫자 → hover하면 살짝 커졌다 돌아옴 (scale 1.0 → 1.05)
```

- "살아있는 시스템" 느낌. 정적 = 죽음, 미세한 움직임 = 생명.
- 너무 세면 산만 → **간신히 인지되는 수준**이 핵심

---

### 2. 마이크로인터랙션 — 손끝 반응

#### 클릭 피드백

모든 클릭에 즉각 시각 반응. 0ms 체감.

```
함수 클릭:
  → 클릭 순간: 해당 라인 배경 flash (50ms 밝아졌다 돌아옴)
  → 동시에: 사이드 패널 콜 그래프 노드에 ring pulse
  → 0.1s 후: 그래프 펼쳐지기 시작

taint 마커 클릭:
  → 클릭 순간: 빨간 ripple 이펙트 (물결 퍼지듯)
  → 경로 하이라이트가 소스에서 싱크까지 빠르게 "달려감"

숫자 뱃지 클릭:
  → 숫자가 잠깐 bounce (위로 살짝 올라갔다 내려옴)
  → 세부 패널 slide-up
```

- 모든 클릭이 "응답했다"는 느낌 → 반응 없으면 죽은 UI

#### hover 연출

```
함수 위 hover:
  → 0ms: 함수 블록 전체 살짝 밝아짐 (배경 +5% brightness)
  → 50ms: 호버 카드 fade-in (아래에서 위로 4px 슬라이드)
  → 카드 내 프로그레스 바 채워지는 애니메이션

파일 트리 hover:
  → 파일명 옆 리스크 뱃지가 숫자에서 상세로 확장
  → "⚠️ 3" → "⚠️ taint×2, dead×1" (300ms transition)

그래프 노드 hover:
  → 연결선이 밝아지면서 두꺼워짐 (1px → 2px, 150ms)
  → 연결된 다른 노드들도 살짝 glow
```

#### 스크롤 반응

```
코드 스크롤:
  → 새 함수 영역 진입 시 CodeLens가 fade-in (위에서 내려옴)
  → 벗어난 함수의 CodeLens는 fade-out
  → "지금 보고 있는 함수"만 분석이 활성화된 느낌

관제탑 줌:
  → 핀치/스크롤로 줌 → 노드들이 smooth하게 재배치
  → 줌 인 할수록 노드 안에 텍스트가 점진적으로 나타남
  → 줌 아웃하면 텍스트 사라지고 색상 + 크기만 남음
```

---

### 3. 상태 변화 연출 — "내가 만든 변화"

코드 수정했을 때 → 분석이 바뀌는 그 순간이 가장 중요한 UX.

#### blast radius 변화

```
수정 전: blast radius 31  (조용히 있음)

수정 후:
  → 숫자 31이 잠깐 흔들림 (shake 200ms)
  → 31 → 37로 카운팅 애니메이션 (300ms, ease-out)
  → 색상 전환: 주황 → 빨강 (gradient transition)
  → 동시에: 콜 그래프에서 새 노드 6개가 pop-in
  → 파일 트리에서 영향받는 파일 6개 순차적으로 빨갛게 물듦 (stagger 50ms)
```

- "내가 뭔가 한 줄 쳤는데 시스템이 반응했다" → **이 느낌이 핵심**
- 숫자만 바뀌면 약함, 숫자 + 그래프 + 파일 트리가 **동시에 반응**해야 강렬

#### taint path 생성 순간

```
새 taint path 감지 시:
  → 소스 라인에서 빨간 pulse 방출 (동심원 1회)
  → 경로를 따라 빨간 빛이 "흘러감" (200ms per hop)
  → 싱크 라인 도착 시 flash
  → 사이드 패널에 "Taint Path +1" 카운터 bounce
  → 상단 Risk Meter 바가 한 칸 채워짐
```

#### Risk Score 변화

```
Risk Score 변화 시:
  → 숫자 morphing 애니메이션 (72 → 78, digit 각각 롤링)
  → 바 색상 gradient shift
  → 점수가 올라가면: 바 오른쪽이 "차오르는" 느낌 (liquid fill)
  → 점수가 내려가면: 바 오른쪽이 "빠져나가는" 느낌 + 초록 flash
```

- "위험해졌다" = 빨갛게 차오름
- "안전해졌다" = 초록으로 빠져나감
- **감정적 피드백** — 좋은 행동은 보상, 나쁜 행동은 경고

---

### 4. 정보 밀도 제어 — "많지만 지저분하지 않게"

#### Progressive Disclosure

정보를 한꺼번에 표시하면 인지 과부하가 발생한다. 단계적으로 공개.

```
Level 0 (기본):  숫자 뱃지만  →  "⚡ 8.2"
Level 1 (hover): 1줄 요약    →  "⚡ complexity 8.2 — 10점 만점"
Level 2 (click): 카드 열림   →  복잡도 분포 + 세부 점수 + 추세
Level 3 (⌘K):   풀 분석     →  관련 함수 전체 + 리팩토링 제안
```

- 기본은 숫자 하나 — 깔끔함
- 궁금하면 파고들기 — 깊이 무한

#### 시각적 계층

```
┌── 가장 눈에 띄는 것 ──────────────────────────────────┐
│  🔴 taint path    빨간색 + 흐르는 파티클               │
│  💥 blast radius  큰 숫자 + bounce 애니메이션          │
├── 중간 ──────────────────────────────────────────────┤
│  ⚡ complexity    CodeLens 텍스트                     │
│  ⚠️  callers      라인 끝 주석                        │
├── 배경 ──────────────────────────────────────────────┤
│  배경 히트맵      opacity 10% 색상                    │
│  gutter 마커      작은 점                              │
└────────────────────────────────────────────────────────┘
```

- **위험할수록 시각적으로 강렬** — 안전한 건 배경으로
- 에디터가 크리스마스 트리가 되면 실패

#### 컬러 시스템

```
🔴 빨강 (#FF4444)  — "지금 당장 위험"
     taint path, CVE critical, security risk

🟠 주황 (#FF8844)  — "주의 필요"
     높은 복잡도, 핫스팟, 테스트 없음

🟡 노랑 (#FFBB33)  — "알아는 두자"
     spec 위반 가능, clone 감지

🟢 초록 (#44BB44)  — "안전"
     behavior 동일 검증, 테스트 통과

🔵 파랑 (#4488FF)  — "정보"
     callers 수, blast radius (증가 없을 때)

⬜ 회색 (#666666)  — "죽은 것"
     dead code, unused import
```

- 6색 시스템 — 이 이상이면 인지 과부하
- 빨강은 아껴 써야 무서움 — 남발하면 무감각

---

### 5. 사운드 디자인 (선택적)

소리는 선택이지만, 있으면 경험 레벨이 달라짐.

```
taint path 감지:     낮은 톤 "둥" (subtle warning)
blast radius 급증:   긴장감 있는 "틱틱틱" (카운팅)
위험 해소:           맑은 "띵" (resolution)
빌드 성공:           짧은 "딩동" (success chime)
빌드 실패:           둔탁한 "퍽" (impact)
Deep Scan 완료:      스캐너 느낌 "쒸이잉" (scan complete)
```

- 기본은 OFF — 설정에서 활성화
- 해커/SF 영화 감성 — "분석하는 시스템" 느낌
- 볼륨 극소, 앰비언스 수준

---

### 6. 다크 모드 설계 — 기본이자 유일

p0 IDE는 **다크 모드 온리**가 맞다.

```
배경:        #0D0D0F  (거의 순검정, 살짝 파란기)
코드 영역:   #13131A  (배경보다 한 톤 밝게)
패널:        #1A1A24  (코드보다 한 톤 더 밝게)
선/구분선:   #2A2A3A  (미세하게만)

포인트 컬러:
  위험:  #FF4444 → 어두운 배경에서 존재감 극대화
  안전:  #44BB44 → 안도감
  정보:  #4488FF → 차분함
```

- 다크 배경에서 빨간 taint 경로가 **불 붙은 것처럼** 보임
- 밝은 모드에서는 이 효과 안 나옴
- 관제탑 뷰에서 노드 glow가 우주 관제 느낌

#### glow 효과

```
🔴 위험 노드:  box-shadow: 0 0 20px rgba(255,68,68,0.3)
🟢 안전 노드:  box-shadow: 0 0 12px rgba(68,187,68,0.2)
🔵 정보 노드:  box-shadow: 0 0 8px rgba(68,136,255,0.15)

taint 경로:  filter: drop-shadow(0 0 4px #FF4444)
```

- 다크 배경 위의 glow = 관제탑 레이더 느낌
- 밝은 화면에서는 절대 못 내는 분위기

---

### 7. 전환 애니메이션 — 끊김 없는 흐름

#### 뷰 전환

```
관제탑 → 코드:
  관제탑 노드가 점점 커지면서 코드 뷰로 morphing
  (zoom-in 느낌, 300ms ease-in-out)

코드 → 관제탑:
  코드가 점점 작아지면서 관제탑 노드로 수렴
  (zoom-out, 300ms)

파일 전환:
  현재 코드 fade-out (150ms) → 새 코드 fade-in (150ms)
  사이드 패널은 cross-fade (분석이 "바뀌는" 느낌, 즉시 사라지는 게 아님)

PR 리뷰 모드 진입:
  일반 뷰에서 리뷰 패널이 overlay로 슬라이드 다운
  배경 코드는 blur + dim (focus 전환 명확)
```

- **모든 전환에 목적이 있다** — "여기서 여기로 갔다"를 시각으로 이해
- 뚝 끊기면 맥락 잃음, 스무스하면 맥락 유지

#### 결과 카드 등장

```
⌘K 프롬프트 결과:
  → 카드가 아래에서 위로 slide-up (200ms)
  → 카드 안 내용은 stagger fade-in (각 줄 50ms 딜레이)
  → 숫자는 카운팅 애니메이션으로 올라감
  → 버튼은 마지막에 fade-in (사용자가 읽고 나서 행동)

경고 카드:
  → 화면 상단에서 drop-down (200ms, spring 느낌)
  → 살짝 bounce하고 안착
  → 3초 후 자동 축소 (배너 → 뱃지)
```

---

### 8. 빈 상태 (Empty State) 설계

아무것도 없을 때가 제일 중요.

```
분석 결과 없을 때:
  "이 파일은 깨끗합니다 ✨"
  (빈 패널에 작은 체크마크 + 미세한 sparkle 애니메이션)

콜 그래프 비어있을 때:
  "이 함수는 독립적입니다 — 어디서도 호출하지 않음"
  (고립된 노드 하나 + 점선 원)

taint path 없을 때:
  "깨끗한 데이터 흐름 ✓"
  (초록색 체크 + 흐르는 초록 파티클)

검색 결과 없을 때:
  "일치하는 결과 없음 — 다른 키워드?"
  (검색창 아래 미세한 흔들림)
```

- "없다"도 의미가 있다 — 안전하다는 확인
- 빈 화면 = 불안 → 빈 화면 + 설명 = 안도

---

### 9. 에러 / 로딩 UX

#### 분석 로딩

```
분석 실행 중:
  → 해당 영역 배경에 미세한 shimmer (skeleton 느낌)
  → 프로그레스가 아니라 "분석 중..." 텍스트 + pulse dot
  → 완료 순간: shimmer가 결과 색상으로 resolve

느린 분석 (2초+):
  → "깊은 분석 중..." + 프로그레스 바 (예상 시간 표시)
  → 부분 결과 먼저 보여줌 (call graph → 나중에 taint 추가)
```

#### 에러 발생

```
분석 실패:
  → 해당 영역 회색 점선 테두리 + "분석 실패 — 재시도?"
  → 버튼 한 번 누르면 재실행
  → 전체 시스템 안 멈춤 — 실패한 부분만 표시

WebSocket 끊김:
  → 상단에 연결 상태 표시 (얇은 바)
  → 끊기면 노란색 바 + "재연결 중..."
  → 복구되면 초록 flash 후 사라짐
```

---

### 10. 개발자 심리 조작 — 감정 UX

#### "위험 만들었다" 죄책감

```
수정으로 taint path 추가 시:
  → 빨간 flash + Risk Score 올라감
  → "위험이 증가했습니다" — 약간 도발적 어조
  → [되돌리기] 버튼이 눈에 잘 띄게

→ 예상 반응: "내가 어떤 변경을 만든 건지" → 클릭 → 학습
```

#### "위험 해소" 보상감

```
taint path 수정 완료 시:
  → 빨간 경로가 초록으로 변하면서 fade-out
  → Risk Score 내려감 + 초록 flash
  → "✨ 위험 해소됨" — 칭찬 어조
  → 숫자 내려가는 카운팅 애니메이션

→ 예상 반응: 해소 만족감 → 추가 위험 항목으로 자연스럽게 이동
```

#### "중독 루프"

```
위험 발견 → "이거 고쳐야 하나?" → [Fix safely] 클릭
  → 수정 적용 → Risk Score 내려감 → 보상감
    → "또 뭐 있나?" → 다른 위험 클릭
      → 반복

이게 바로 p0 중독 루프.
```

- 게임의 보상 시스템과 동일
- 위험 발견 = 퀘스트 발견
- 위험 해소 = 퀘스트 완료 + 보상(점수 하락)
- "하나만 더..." = 게임 중독과 동일한 심리

---

### UX 원칙 요약

```
1. 3초 안에 "다르다"       — 로딩 시퀀스 + 살아있는 오버레이
2. 모든 클릭에 즉각 반응    — 0ms 체감, flash/ripple/bounce
3. 변화는 dramatize        — 숫자 카운팅 + 색상 전환 + 그래프 동시 반응
4. 많지만 지저분하지 않게   — progressive disclosure + 시각 계층
5. 끊김 없는 흐름          — 모든 전환 스무스, 맥락 유지
6. 감정을 건드려           — 죄책감 → 보상 루프 = 중독
7. 빈 상태도 설계          — "없다" = "안전하다" 확인
8. 소리는 앰비언스         — SF 관제탑 분위기, 극소 볼륨
```

**한 줄 요약: "기능이 뛰어난 게 아니라, 기능이 뛰어나 보이게 만드는 것"**

---

## 미결 사항

- [ ] 동시 세션 cap 수치 결정 (서버 스펙 확인 후)
- [ ] 세션 타이머 시간 결정
- [ ] 스냅샷 델타 인덱스 직렬화 포맷
- [ ] 관중 모드 WebSocket 브로드캐스트 구조
- [ ] 빌드 큐 최대 대기 수 / 타임아웃 정책
- [ ] 원상복구 스케줄 주기
- [ ] Blast radius 애니메이션 프레임레이트 / 성능 최적화
- [ ] Ghost Execution 샘플 값 생성 전략 (타입 기반 자동 생성)
- [ ] "Why does this exist?" PR intent 분석 모델 설계
- [ ] Confidence score 계산 방식 정의
- [ ] Severity 기준 정의 (Critical/Warning/Info 경계)
- [ ] Keyboard shortcut 충돌 방지 (기존 Monaco 단축키와)
