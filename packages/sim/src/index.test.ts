import { describe, expect, it } from "vitest";

import type { MatchConfig } from "@ball-brawl/shared";

import { createBaseStats, createBattle, getSnapshot, runBattle, stepBattle } from "./index";

const matchConfig: MatchConfig = {
  version: "0.1",
  seed: 12345,
  arenaId: "mvp_rect",
  blue: {
    version: "0.1",
    name: "Blue",
    skin: "default_blue",
    baseModel: "default",
    traits: []
  },
  red: {
    version: "0.1",
    name: "Red",
    skin: "default_red",
    baseModel: "default",
    traits: []
  }
};

describe("sim bootstrap", () => {
  it("creates independent base stats copies", () => {
    const first = createBaseStats();
    const second = createBaseStats();

    first.maxHp = 1;

    expect(second.maxHp).toBe(100);
  });

  it("runs a no-trait battle to completion", () => {
    const world = runBattle(createBattle(matchConfig));

    expect(world.result).toBeDefined();
    expect(world.result?.winner).toMatch(/blue|red|draw/);
    expect(world.result?.duration).toBeGreaterThan(0);
  });

  it("is deterministic for the same seed and builds", () => {
    const first = runBattle(createBattle(matchConfig));
    const second = runBattle(createBattle(matchConfig));

    expect(first.result).toEqual(second.result);
    expect(first.balls.map((ball) => ({ hp: ball.hp, alive: ball.alive, position: ball.position }))).toEqual(
      second.balls.map((ball) => ({ hp: ball.hp, alive: ball.alive, position: ball.position }))
    );
  });

  it("applies collision cooldown between the same pair", () => {
    const world = createBattle(matchConfig, { id: "test", width: 240, height: 180 });
    const [blue, red] = world.balls;
    if (!blue || !red) {
      throw new Error("Expected two battle balls");
    }
    blue.position = { x: 100, y: 90 };
    red.position = { x: 120, y: 90 };
    blue.velocity = { x: 0, y: 0 };
    red.velocity = { x: 0, y: 0 };

    stepBattle(world, 1 / 60, 0);
    const hpAfterFirstCollision = blue.hp;

    blue.position = { x: 100, y: 90 };
    red.position = { x: 120, y: 90 };
    blue.velocity = { x: 0, y: 0 };
    red.velocity = { x: 0, y: 0 };
    stepBattle(world, 1 / 60, 0);

    expect(blue.hp).toBe(hpAfterFirstCollision);
  });

  it("emits wall bounce events", () => {
    const world = createBattle(matchConfig, { id: "test", width: 240, height: 180 });
    const blue = world.balls[0];
    if (!blue) {
      throw new Error("Expected a blue ball");
    }
    blue.position = { x: blue.stats.radius + 1, y: 90 };
    blue.velocity = { x: -blue.stats.moveSpeed, y: 0 };

    stepBattle(world, 1 / 60, 0);

    expect(world.events.some((event) => event.type === "wall_bounce" && event.ballId === blue.id)).toBe(true);
  });

  it("returns render snapshots without exposing the rng", () => {
    const world = createBattle(matchConfig);
    stepBattle(world);
    const snapshot = getSnapshot(world);

    expect(snapshot.tick).toBe(1);
    expect(snapshot.balls).toHaveLength(2);
    expect("rng" in snapshot).toBe(false);
  });
});
