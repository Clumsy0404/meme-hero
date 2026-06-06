import { describe, expect, it } from "vitest";

import { TRAITS_PER_BUILD } from "@ball-brawl/shared";

import { baseBallStats, traitDefinitions, validateBuildConfig } from "./index";

describe("content bootstrap", () => {
  it("exposes base ball stats", () => {
    expect(baseBallStats.maxHp).toBe(100);
    expect(baseBallStats.collisionDamage).toBe(8);
  });

  it("has unique trait ids", () => {
    const ids = traitDefinitions.map((trait) => trait.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("ships the MVP trait library", () => {
    expect(traitDefinitions).toHaveLength(30);
    expect(traitDefinitions.filter((trait) => trait.mainType === "attribute")).toHaveLength(6);
    expect(traitDefinitions.every((trait) => trait.name.length > 0 && trait.description.length > 0)).toBe(true);
  });

  it("validates a legal four-trait build", () => {
    const result = validateBuildConfig({
      version: "0.1",
      name: "属性测试球",
      skin: "default_blue",
      baseModel: "default",
      traits: ["hp_boost", "speed_boost", "collision_boost", "hard_shell"]
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
      traits: ["hp_boost", "hp_boost", "hp_boost", "hp_boost"]
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
      traits: ["hp_boost", "speed_boost", "collision_boost", "missing_trait"]
    });
    const repeatedUnique = validateBuildConfig({
      version: "0.1",
      name: "重复唯一球",
      skin: "default_blue",
      baseModel: "default",
      traits: ["lifesteal_collision", "lifesteal_collision", "hp_boost", "speed_boost"]
    });

    expect(invalidCount.issues.some((issue) => issue.code === "invalid_trait_count")).toBe(true);
    expect(unknownTrait.issues.some((issue) => issue.code === "unknown_trait")).toBe(true);
    expect(repeatedUnique.issues.some((issue) => issue.code === "unique_trait_repeated")).toBe(true);
  });

  it("uses the shared fixed trait slot count", () => {
    expect(TRAITS_PER_BUILD).toBe(4);
  });
});
