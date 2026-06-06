import { describe, expect, it } from "vitest";

import { baseBallStats, traitDefinitions } from "./index";

describe("content bootstrap", () => {
  it("exposes base ball stats", () => {
    expect(baseBallStats.maxHp).toBe(100);
    expect(baseBallStats.collisionDamage).toBe(8);
  });

  it("has unique trait ids", () => {
    const ids = traitDefinitions.map((trait) => trait.id);

    expect(new Set(ids).size).toBe(ids.length);
  });
});
