/// <reference types="vitest/globals" />
/// <reference types="@testing-library/jest-dom" />

// `@testing-library/jest-dom/vitest` does `import { expect } from "vitest"`
// from inside its own package directory. pnpm's isolated virtual store
// doesn't link `vitest` into jest-dom's node_modules (jest-dom doesn't
// declare it as a peer dep, for good reason — it's framework-agnostic),
// so that import resolves only by lucky hoisting. On machines where the
// virtual store is strict, the resolution fails and every test file in
// the repo errors out with `Cannot find package 'vitest'`.
//
// We inline the three-line wiring that `/vitest` does, and import the
// pure matchers entry instead — that one has no internal `vitest` import
// and resolves cleanly in every pnpm layout.
import { expect } from "vitest";
import * as matchers from "@testing-library/jest-dom/matchers";

expect.extend(matchers);
