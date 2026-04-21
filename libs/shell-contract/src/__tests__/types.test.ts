import { describe, it, expectTypeOf } from "vitest";
import type {
  TabAppDescriptor,
  TabAppProps,
  ShellAPI,
  AppKind,
  TabDescriptor,
} from "../index";
import type { ComponentType } from "react";

describe("shell-contract type-level tests", () => {
  it("TabAppDescriptor.Component accepts TabAppProps", () => {
    expectTypeOf<TabAppDescriptor["Component"]>().toMatchTypeOf<ComponentType<TabAppProps>>();
  });

  it("ShellAPI has all required methods", () => {
    expectTypeOf<ShellAPI>().toHaveProperty("openTab");
    expectTypeOf<ShellAPI>().toHaveProperty("closeTab");
    expectTypeOf<ShellAPI>().toHaveProperty("selectTab");
    expectTypeOf<ShellAPI>().toHaveProperty("toast");
    expectTypeOf<ShellAPI>().toHaveProperty("togglePalette");
    expectTypeOf<ShellAPI>().toHaveProperty("toggleDevConsole");
    expectTypeOf<ShellAPI>().toHaveProperty("toggleSettings");
    expectTypeOf<ShellAPI>().toHaveProperty("toggleRules");
    expectTypeOf<ShellAPI>().toHaveProperty("theme");
    expectTypeOf<ShellAPI>().toHaveProperty("registerFeatures");
    expectTypeOf<ShellAPI>().toHaveProperty("registerShortcuts");
    expectTypeOf<ShellAPI>().toHaveProperty("registerOverlay");
  });

  it("AppKind includes all expected tab app values and home", () => {
    expectTypeOf<"new-tab">().toMatchTypeOf<AppKind>();
    expectTypeOf<"agent">().toMatchTypeOf<AppKind>();
    expectTypeOf<"pr">().toMatchTypeOf<AppKind>();
    expectTypeOf<"ide">().toMatchTypeOf<AppKind>();
    expectTypeOf<"scenario">().toMatchTypeOf<AppKind>();
    expectTypeOf<"reviews">().toMatchTypeOf<AppKind>();
    expectTypeOf<"settings">().toMatchTypeOf<AppKind>();
    expectTypeOf<"code-city">().toMatchTypeOf<AppKind>();
    expectTypeOf<"home">().toMatchTypeOf<AppKind>();
  });

  it("TabDescriptor requires id, app, and label", () => {
    expectTypeOf<TabDescriptor>().toHaveProperty("id");
    expectTypeOf<TabDescriptor>().toHaveProperty("app");
    expectTypeOf<TabDescriptor>().toHaveProperty("label");
    expectTypeOf<TabDescriptor["id"]>().toBeString();
    expectTypeOf<TabDescriptor["label"]>().toBeString();
  });
});
