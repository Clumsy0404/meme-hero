import { describe, expect, it } from "vitest";

import { TRAITS_PER_BUILD, type BuildConfig } from "./index";

describe("shared models", () => {
  it("represents a three-trait build config", () => {
    const build: BuildConfig = {
      version: "0.1",
      name: "测试小球",
      skin: "default_blue",
      baseModel: "default",
      traits: ["hp_boost", "speed_boost", "collision_boost"]
    };

    expect(build.traits).toHaveLength(TRAITS_PER_BUILD);
  });
});
