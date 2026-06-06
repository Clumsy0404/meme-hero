import { describe, expect, it } from "vitest";

import type { BuildConfig } from "@ball-brawl/shared";

import { decodeBuildArchive, encodeBuildArchive } from "./build-code";

const build: BuildConfig = {
  version: "0.1",
  name: "测试构筑",
  skin: "default_blue",
  baseModel: "default",
  traits: ["hp_boost", "speed_boost", "giant_body", "collision_boost"]
};

describe("build code", () => {
  it("round-trips an archived build", () => {
    const decoded = decodeBuildArchive(encodeBuildArchive(build));

    expect(decoded.ok).toBe(true);
    expect(decoded.ok ? decoded.build : null).toEqual(build);
  });

  it("accepts a raw build object for import", () => {
    const decoded = decodeBuildArchive(JSON.stringify(build));

    expect(decoded.ok).toBe(true);
    expect(decoded.ok ? decoded.build.traits : []).toEqual(build.traits);
  });

  it("rejects malformed or invalid build codes", () => {
    expect(decodeBuildArchive("not json").ok).toBe(false);
    expect(decodeBuildArchive(JSON.stringify({ traits: ["missing_trait"] })).ok).toBe(false);
  });
});
