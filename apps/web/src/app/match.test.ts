import { describe, expect, it } from "vitest";

import { validateBuildConfig } from "@ball-brawl/content";
import { TRAITS_PER_BUILD } from "@ball-brawl/shared";

import { createBuildConfig, presetEnemies } from "./match";

describe("preset enemies", () => {
  it("ships six legal challenge builds", () => {
    expect(presetEnemies).toHaveLength(6);
    expect(new Set(presetEnemies.map((preset) => preset.id)).size).toBe(presetEnemies.length);

    for (const preset of presetEnemies) {
      expect(preset.traits).toHaveLength(TRAITS_PER_BUILD);
      expect(validateBuildConfig(createBuildConfig(preset.name, "default_red", preset.traits)).ok).toBe(true);
    }
  });
});
