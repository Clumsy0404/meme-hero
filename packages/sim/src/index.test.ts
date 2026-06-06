import { describe, expect, it } from "vitest";

import { createBaseStats } from "./index";

describe("sim bootstrap", () => {
  it("creates independent base stats copies", () => {
    const first = createBaseStats();
    const second = createBaseStats();

    first.maxHp = 1;

    expect(second.maxHp).toBe(100);
  });
});
