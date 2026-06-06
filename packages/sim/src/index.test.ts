import { describe, expect, it } from "vitest";

import type { BuildConfig, MatchConfig, TraitId } from "@ball-brawl/shared";

import { createBaseStats, createBattle, createStatsForBuild, getSnapshot, runBattle, stepBattle } from "./index";

const blueBuild: BuildConfig = {
  version: "0.1",
  name: "Blue",
  skin: "default_blue",
  baseModel: "default",
  traits: ["hp_boost", "speed_boost", "collision_boost", "hard_shell"]
};

const redBuild: BuildConfig = {
  version: "0.1",
  name: "Red",
  skin: "default_red",
  baseModel: "default",
  traits: ["giant_body", "collision_boost", "hard_shell", "wall_charge"]
};

const matchConfig: MatchConfig = {
  version: "0.1",
  seed: 12345,
  arenaId: "mvp_rect",
  blue: blueBuild,
  red: redBuild
};

const hpStackTraits: TraitId[] = ["hp_boost", "hp_boost", "hp_boost", "hp_boost"];

type TestWorld = ReturnType<typeof createBattle>;
type TestBall = NonNullable<TestWorld["balls"][number]>;

function makeBuild(name: string, traits: TraitId[]): BuildConfig {
  return {
    version: "0.1",
    name,
    skin: "default_blue",
    baseModel: "default",
    traits
  };
}

function makeMatch(blueTraits: TraitId[], redTraits: TraitId[]): MatchConfig {
  return {
    version: "0.1",
    seed: 12345,
    arenaId: "mvp_rect",
    blue: makeBuild("Blue", blueTraits),
    red: makeBuild("Red", redTraits)
  };
}

function placeOverlappingMainBalls(world: TestWorld): [TestBall, TestBall] {
  const [blue, red] = world.balls;
  if (!blue || !red) {
    throw new Error("Expected two battle balls");
  }
  blue.position = { x: 100, y: 90 };
  red.position = { x: 120, y: 90 };
  blue.velocity = { x: 0, y: 0 };
  red.velocity = { x: 0, y: 0 };
  return [blue, red];
}

describe("sim bootstrap", () => {
  it("creates independent base stats copies", () => {
    const first = createBaseStats();
    const second = createBaseStats();

    first.maxHp = 1;

    expect(second.maxHp).toBe(100);
  });

  it("applies build traits to base stats", () => {
    const stats = createStatsForBuild({
      version: "0.1",
      name: "Stacked HP",
      skin: "default_blue",
      baseModel: "default",
      traits: ["hp_boost", "hp_boost", "hp_boost", "hp_boost"]
    });

    expect(stats.maxHp).toBe(180);
    expect(stats.moveSpeed).toBe(180);
  });

  it("rejects invalid builds before simulation starts", () => {
    expect(() =>
      createStatsForBuild({
        version: "0.1",
        name: "Invalid",
        skin: "default_blue",
        baseModel: "default",
        traits: ["ranged_core", "ranged_core", "hp_boost", "speed_boost"]
      })
    ).toThrow(/Invalid build config/);
  });

  it("runs a trait battle to completion", () => {
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

  it("initializes battle balls with compiled stats", () => {
    const world = createBattle({
      ...matchConfig,
      blue: {
        ...blueBuild,
        traits: ["hp_boost", "hp_boost", "hp_boost", "hp_boost"]
      }
    });
    const blue = world.balls[0];
    if (!blue) {
      throw new Error("Expected a blue ball");
    }

    expect(blue.stats.maxHp).toBe(180);
    expect(blue.hp).toBe(180);
  });

  it("applies collision cooldown between the same pair", () => {
    const world = createBattle(matchConfig, { id: "test", width: 240, height: 180 });
    const [blue, red] = placeOverlappingMainBalls(world);

    stepBattle(world, 1 / 60, 0);
    const hpAfterFirstCollision = blue.hp;

    blue.position = { x: 100, y: 90 };
    red.position = { x: 120, y: 90 };
    blue.velocity = { x: 0, y: 0 };
    red.velocity = { x: 0, y: 0 };
    stepBattle(world, 1 / 60, 0);

    expect(blue.hp).toBe(hpAfterFirstCollision);
  });

  it("heals lifesteal collision damage with a per-second cap", () => {
    const world = createBattle(
      makeMatch(["lifesteal_collision", "hp_boost", "hp_boost", "hp_boost"], hpStackTraits),
      { id: "test", width: 240, height: 180 }
    );
    const [blue, red] = placeOverlappingMainBalls(world);
    blue.hp = 100;
    red.stats.collisionDamage = 0;

    stepBattle(world, 1 / 60, 0);
    const healEvent = world.events.find((event) => event.type === "heal");

    expect(healEvent?.type).toBe("heal");
    expect(blue.hp).toBeGreaterThan(100);
    expect(blue.runtime.lifestealHealedInWindow).toBeLessThanOrEqual(8);
  });

  it("reflects collision damage without chaining reflect effects", () => {
    const world = createBattle(
      makeMatch(hpStackTraits, ["spike_reflect", "hp_boost", "hp_boost", "hp_boost"]),
      { id: "test", width: 240, height: 180 }
    );
    const [blue, red] = placeOverlappingMainBalls(world);
    red.stats.collisionDamage = 0;

    stepBattle(world, 1 / 60, 0);
    const reflectEvent = world.events.find((event) => event.type === "damage" && event.tags.includes("reflect"));

    if (!reflectEvent || reflectEvent.type !== "damage") {
      throw new Error("Expected reflect damage");
    }
    expect(reflectEvent.amount).toBeCloseTo(2);
    expect(blue.hp).toBeCloseTo(blue.stats.maxHp - 2);
  });

  it("triggers collision explosions with damage events", () => {
    const world = createBattle(
      makeMatch(["collision_burst", "hp_boost", "hp_boost", "hp_boost"], hpStackTraits),
      { id: "test", width: 240, height: 180 }
    );
    const [, red] = placeOverlappingMainBalls(world);
    red.stats.collisionDamage = 0;

    stepBattle(world, 1 / 60, 0);
    const explosionEvent = world.events.find((event) => event.type === "damage" && event.tags.includes("explosion"));
    const triggerEvent = world.events.find((event) => event.type === "trait_triggered" && event.traitId === "collision_burst");

    if (!explosionEvent || explosionEvent.type !== "damage") {
      throw new Error("Expected explosion damage");
    }
    expect(triggerEvent?.type).toBe("trait_triggered");
    expect(explosionEvent.amount).toBeCloseTo(8);
    expect(red.hp).toBeCloseTo(red.stats.maxHp - 16);
  });

  it("charges collision damage after wall bounces", () => {
    const world = createBattle(
      makeMatch(["wall_charge", "hp_boost", "hp_boost", "hp_boost"], hpStackTraits),
      { id: "test", width: 240, height: 180 }
    );
    const [blue, red] = placeOverlappingMainBalls(world);
    blue.position = { x: blue.stats.radius + 1, y: 90 };
    blue.velocity = { x: -blue.stats.moveSpeed, y: 0 };
    red.position = { x: 210, y: 90 };
    red.velocity = { x: 0, y: 0 };

    stepBattle(world, 1 / 60, 0);

    expect(blue.runtime.wallChargeStacks).toBe(1);
    expect(world.events.some((event) => event.type === "trait_triggered" && event.traitId === "wall_charge")).toBe(true);

    red.stats.collisionDamage = 0;
    placeOverlappingMainBalls(world);
    const hpBeforeCollision = red.hp;

    stepBattle(world, 1 / 60, 0);

    expect(hpBeforeCollision - red.hp).toBeCloseTo(8 * 1.12);
    expect(blue.runtime.wallChargeStacks).toBe(0);
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
