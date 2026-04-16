export const SAMPLE_RULES_SOURCE = `---
name: Project Rules
version: 1
scope: repo
---

## Commands

빌드: \`pnpm -C p0-ide-v2 build\`
테스트: \`pnpm -C p0-ide-v2 test\`
Lint: \`pnpm -C p0-ide-v2 lint\`

## Style

- TypeScript strict. \`any\` 금지.
- 파일당 단일 책임.
- 컴포넌트는 FSD 레이어 규칙을 준수한다.
- 좌측 border-stripe에 카테고리 색을 넣지 않는다.

## Testing

- 단위 테스트는 mock 사용 가능.
- 통합 테스트는 실제 DB/파일시스템 사용. mock 금지.
- Snapshot 테스트는 의도가 명확할 때만.

## Tool Permissions  {capability: tool-permission}

- allow: read, edit, grep
- deny: shell-without-confirm
- ask-first: destructive-git (force-push, reset --hard)

## Engine Contract  {scope: src/entities/engine}

엔진 계층은 UI 타입을 import하지 않는다.
\`entities/engine/\`이 UI → backend 계약의 유일한 접점이다.
widgets는 직접 타입을 정의하지 않고 \`@/entities/engine\`에서 임포트한다.
`;
