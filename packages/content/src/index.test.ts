import { describe, expect, it } from "vitest";

import { TRAITS_PER_BUILD } from "@ball-brawl/shared";

import { baseBallStats, presetEnemies, traitDefinitions, validateBuildConfig } from "./index";

describe("content bootstrap", () => {
  it("exposes base ball stats", () => {
    expect(baseBallStats.maxHp).toBe(100);
    expect(baseBallStats.radius).toBe(48);
    expect(baseBallStats.collisionDamage).toBe(8);
  });

  it("has unique trait ids", () => {
    const ids = traitDefinitions.map((trait) => trait.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("ships the MVP trait library", () => {
    expect(traitDefinitions).toHaveLength(37);
    expect(traitDefinitions.filter((trait) => trait.mainType === "attribute")).toHaveLength(6);
    expect(traitDefinitions.every((trait) => trait.name.length > 0 && trait.description.length > 0)).toBe(true);
  });

  it("ships legal preset enemy builds", () => {
    expect(presetEnemies).toHaveLength(6);
    expect(new Set(presetEnemies.map((preset) => preset.id)).size).toBe(presetEnemies.length);

    for (const preset of presetEnemies) {
      const result = validateBuildConfig({
        version: "0.1",
        name: preset.name,
        skin: "default_red",
        baseModel: "default",
        traits: preset.traits
      });

      expect(result.ok).toBe(true);
    }
  });

  it("validates a legal three-trait build", () => {
    const result = validateBuildConfig({
      version: "0.1",
      name: "属性测试球",
      skin: "default_blue",
      baseModel: "default",
      traits: ["hp_boost", "speed_boost", "collision_boost"]
    });

    expect(result.ok).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("allows stackable stat traits to repeat", () => {
    const result = validateBuildConfig({
      version: "0.1",
      name: "四层生命球",
      skin: "default_blue",
      baseModel: "default",
      traits: ["hp_boost", "hp_boost", "hp_boost"]
    });

    expect(result.ok).toBe(true);
  });

  it("rejects unknown traits, wrong counts, and repeated unique traits", () => {
    const invalidCount = validateBuildConfig({
      version: "0.1",
      name: "少词条球",
      skin: "default_blue",
      baseModel: "default",
      traits: ["hp_boost"]
    });
    const unknownTrait = validateBuildConfig({
      version: "0.1",
      name: "未知词条球",
      skin: "default_blue",
      baseModel: "default",
      traits: ["hp_boost", "speed_boost", "missing_trait"]
    });
    const repeatedUnique = validateBuildConfig({
      version: "0.1",
      name: "重复唯一球",
      skin: "default_blue",
      baseModel: "default",
      traits: ["lifesteal_collision", "lifesteal_collision", "hp_boost"]
    });

    expect(invalidCount.issues.some((issue) => issue.code === "invalid_trait_count")).toBe(true);
    expect(unknownTrait.issues.some((issue) => issue.code === "unknown_trait")).toBe(true);
    expect(repeatedUnique.issues.some((issue) => issue.code === "unique_trait_repeated")).toBe(true);
  });

  it("limits each build to one legendary trait", () => {
    const result = validateBuildConfig({
      version: "0.1",
      name: "传说限制测试球",
      skin: "default_blue",
      baseModel: "default",
      traits: ["special_elbow_strike", "special_bounce_basketball", "hp_boost"]
    });

    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.code === "legendary_trait_limit_exceeded")).toBe(true);
  });

  it("uses the shared fixed trait slot count", () => {
    expect(TRAITS_PER_BUILD).toBe(3);
  });
});
