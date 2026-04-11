import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, it, expect, vi } from "vitest";
import { App } from "./App";

vi.mock("./ide", () => ({
  IdePage: () => createElement("div", { "data-testid": "ide-page" }, "ide"),
}));

describe("App", () => {
  it("renders the ide page entry", () => {
    const html = renderToString(createElement(App));
    expect(html).toContain("data-testid=\"ide-page\"");
  });
});
