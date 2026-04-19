import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { act } from "react";
import { DebugKillSwitchBanner } from "./DebugKillSwitchBanner";
import { debugSettingsStore } from "../store/debug-settings-store";

describe("DebugKillSwitchBanner", () => {
  beforeEach(() => {
    debugSettingsStore.resetDebugKnobs();
  });
  afterEach(() => {
    debugSettingsStore.resetDebugKnobs();
  });

  it("renders nothing when kill-switches are clean", () => {
    const { container } = render(<DebugKillSwitchBanner />);
    expect(container.firstChild).toBeNull();
  });

  it("surfaces the pinned LOD tier", () => {
    render(<DebugKillSwitchBanner />);
    act(() => debugSettingsStore.setForceLod("ground"));
    expect(screen.getByText(/LOD=ground/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /해제/ })).toBeInTheDocument();
  });

  it("surfaces scene freeze", () => {
    render(<DebugKillSwitchBanner />);
    act(() => debugSettingsStore.setFreezeScene(true));
    expect(screen.getByText(/scene frozen/)).toBeInTheDocument();
  });

  it("combines both kill-switches into one banner (not two)", () => {
    render(<DebugKillSwitchBanner />);
    act(() => {
      debugSettingsStore.setForceLod("city");
      debugSettingsStore.setFreezeScene(true);
    });
    const statuses = screen.getAllByRole("status");
    expect(statuses).toHaveLength(1);
    expect(statuses[0].textContent).toMatch(/LOD=city/);
    expect(statuses[0].textContent).toMatch(/scene frozen/);
  });

  it("reset button clears all kill-switches atomically", () => {
    render(<DebugKillSwitchBanner />);
    act(() => {
      debugSettingsStore.setForceLod("galaxy");
      debugSettingsStore.setFreezeScene(true);
    });
    const btn = screen.getByRole("button", { name: /해제/ });
    act(() => btn.click());
    expect(debugSettingsStore.getState().forceLod).toBe("auto");
    expect(debugSettingsStore.getState().freezeScene).toBe(false);
    // Banner unmounts itself.
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
