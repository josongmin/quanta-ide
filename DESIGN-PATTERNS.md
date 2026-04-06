# Quanta Landing — 디자인 패턴

`index.html` 단일 페이지 기준으로 적용된 기술·UX·UI 패턴을 정리한다.

---

## 1. 배경 오로라

| 패턴 | 설명 |
|------|------|
| **CSS Keyframe Animation** | `@keyframes rush-up` + `animation`으로 블롭 이동 |
| **GPU Compositing** | `will-change: transform` + `transform`만 애니메이션 → 레이아웃/페인트 최소화, compositor 레이어 위주 처리 |
| **Gaussian Blur** | `filter: blur(90px)` 로 빛 번짐 |
| **Radial Gradient Masking** | `radial-gradient(..., transparent)` 로 블롭 가장자리 페이드 |
| **Ellipse 그라데이션** | `radial-gradient(ellipse at 50% 70%, ...)` |
| **이징** | `cubic-bezier(0.25, 0.1, 0.25, 1)` |
| **위상 분리** | 음수 `animation-delay`, 블롭마다 다른 `animation` 지속시간 |
| **루프 연출** | `top: 120vh` 시작 → `translateY(-320vh)` 로 화면 아래→위 이동 |
| **레이어** | `pointer-events: none` 으로 클릭 통과, `z-index: 0` |

---

## 2. 도트 그리드 + 마우스 이펙트

| 패턴 | 설명 |
|------|------|
| **Canvas 2D API** | `requestAnimationFrame` 루프로 매 프레임 직접 렌더링 |
| **Point Repulsion / Force Field** | 마우스 기준 거리 → 도트를 바깥으로 밀어냄 |
| **Lerp** | `mouse += (targetMouse - mouse) * 0.08` 로 포인터 추적 완화 |
| **Radial Vignette** | 화면 중심 기준 타원형 정규화로 가장자리 `alpha` 감소 |
| **거리 감쇠** | `infl = max(0, 1 - dist / RADIUS)` |
| **제곱 강도** | `push = infl * infl * STRENGTH` |
| **극좌표** | `Math.atan2` + `cos` / `sin` |
| **성능** | `alpha < 0.01` 이면 스킵; `resize` 시 그리드 재생성 |
| **포인터 해제** | `mouseleave` + 좌표 `-9999` |

---

## 3. UI / 카드

| 패턴 | 설명 |
|------|------|
| **Glassmorphism** | `backdrop-filter: blur` + 반투명 배경 + 얇은 흰 테두리 |
| **Inset Highlight** | `box-shadow: inset 0 1px 0 rgba(255,255,255,...)` |
| **Frosted Glass Border** | `border: 1px solid rgba(255,255,255,.22)` |
| **바깥 그림자** | 카드에 외곽 `box-shadow`로 elevation |
| **Safari** | `-webkit-backdrop-filter` |
| **Auto-resize Textarea** | `scrollHeight` 기반 높이 조절 |

---

## 4. 레이아웃·타이포·기타 CSS

| 패턴 | 설명 |
|------|------|
| **`clamp()`** | 예: `font-size: clamp(3rem, 7.5vw, 5.6rem)` |
| **글로벌 리셋** | `box-sizing`, margin/padding 0 |
| **Flexbox** | nav, hero, toolbar |
| **`overflow-x: hidden`** | 가로 스크롤 방지 |
| **`min-height: 100vh`** | body / page |
| **고정 레이어** | `position: fixed` + `inset: 0` |
| **스택** | 배경 0, `.page` 1 |
| **Micro Animation** | 버튼 `transition`, `:hover` 시 `translateY`·색·그림자 |
| **인라인 SVG** | 아이콘 stroke 기반 |
| **접근성** | `aria-label` (프롬프트 textarea) |

---

## 5. UX 패턴

| 패턴 | 적용 여부 | 비고 |
|------|-----------|------|
| **Hero Section** | ✅ | 중앙 정렬 헤드라인·서브카피·카드; 상단 `Try now` CTA |
| **Single Input Focus** | △ | 메인은 단일 `textarea`이나 네비에 별도 CTA 존재 |
| **Progressive Disclosure** | ❌ | 툴바는 항상 노출; 접기/단계 노출 없음. “입력 위·옵션 아래” 2단 구조에 가깝 |
| **Tab Switching (App / Web)** | ✅ | `active`/`inactive` + placeholder 전환 |
| **Dark Mode First** | ✅ | `#0d0d12` 기반 |
| **Floating Card** | ✅ | 그림자·글래스로 떠 있는 카드 |
| **Pill Button** | ✅ | `border-radius: 999px` |
| **Ghost Button** | ✅ | `.icon-btn` 투명 배경·아이콘 중심 |
| **Status Badge** | ✅ | `BETA` |
| **Ambient Animation** | ✅ | 오로라 + 도트 루프 |
| **Cursor Reactive UI** | ✅ | 도트 displacement |
| **Micro Animation** | ✅ | 호버 피드백 |

---

## 6. 인터랙션 (스크립트)

- **App / Web 탭**: `className`으로 탭 상태 변경, placeholder만 스위치.
- **텍스트영역**: `input` 시 높이 자동 확장.

---

*이 문서는 구현 분석용이며, 제품명·브랜딩은 `index.html` 내용을 따른다.*
