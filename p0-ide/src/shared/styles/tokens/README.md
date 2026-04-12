# Design Tokens — 3 Tier

순수 CSS 변수로 구현된 3-tier 디자인 시스템.

```
┌──────────────────────────────────────────────────────────┐
│ Tier 1: PRIMITIVE (primitive.css)                        │
│   값만. 의미 없음. 직접 참조 금지.                       │
│   --space-0..12, --radius-0..6, --font-size-0..9,        │
│   --duration-1..6, --ease-*, --z-*                       │
├──────────────────────────────────────────────────────────┤
│ Tier 2: SEMANTIC (semantic.css)                          │
│   의도 기반. feature/widget CSS는 이것만 참조.           │
│   --color-bg-{base,subtle,muted,emphasis,strong}         │
│   --color-fg-{default,muted,subtle,faint,on-accent}      │
│   --color-border-{subtle,default,strong,accent}          │
│   --color-feedback-{success,warn,danger,info}-{fg,bg,border} │
│   --space-inset-*, --space-stack-*, --space-inline-*     │
│   --radius-{xs,sm,md,lg,xl,pill}                         │
│   --shadow-{xs,sm,md,lg,xl}                              │
│   --motion-{fast,base,slow,enter,exit}                   │
│   --text-{caption,body,ui,title,display}-*               │
├──────────────────────────────────────────────────────────┤
│ Tier 3: COMPONENT (로컬 alias)                           │
│   각 컴포넌트 CSS 최상단 :where() 블록에 정의.          │
│   --button-bg, --panel-header-pt 등.                     │
└──────────────────────────────────────────────────────────┘
```

## 규칙

1. **primitive 직접 참조 금지** — 모든 컴포넌트는 semantic만 본다.
2. **hex/rgb 금지** — stylelint로 강제. 기존 `--paper-*`, `--ink-*`, `--line-*` 은 레거시로 유지되지만 새 코드는 `--color-*` alias 사용.
3. **magic number 금지** — px/rem 하드코딩 금지. `--space-*`, `--font-size-*`, `--radius-*` 토큰만 사용.
4. **테마 전환** — semantic만 교체하면 끝. primitive는 절대 변하지 않는다.

## 레거시 호환

- `overlay-tokens.css` 는 이미 의미론적 토큰이므로 semantic에 흡수되지 않고 **그대로 유지**.
- `ide-base.css` 의 `--paper-*`, `--ink-*`, `--line-*` 는 색상 primitive 역할을 하며, `--color-*` alias가 이 위에 얹혀있다. 마이그레이션이 끝나면 제거 검토.
