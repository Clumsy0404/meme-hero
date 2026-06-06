import { describe, expect, it } from "vitest";

import { findPresetBuild, presetBuilds, runPresetMatrix, runSeries } from "./simulate";

describe("balance simulation", () => {
  it("runs mirrored preset series", () => {
    const report = runSeries(findPresetBuild("collision_bruiser"), findPresetBuild("projectile_rain"), {
      rounds: 3,
      seed: 100,
      mirrorSides: true
    });

    expect(report.totalBattles).toBe(6);
    expect(report.aWins + report.bWins + report.draws).toBe(report.totalBattles);
    expect(report.averageDuration).toBeGreaterThan(0);
  });

  it("builds a pairwise preset matrix", () => {
    const rows = runPresetMatrix({ rounds: 1, seed: 200, mirrorSides: true });

    expect(rows).toHaveLength((presetBuilds.length * (presetBuilds.length - 1)) / 2);
    expect(rows.every((row) => row.aWinRate + row.bWinRate + row.drawRate > 0)).toBe(true);
  });
});
