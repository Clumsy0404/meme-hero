import { describe, expect, it } from "vitest";

import type { BuildConfig, MatchConfig, TraitId } from "@ball-brawl/shared";

import { createBaseStats, createBattle, createStatsForBuild, getSnapshot, runBattle, stepBattle } from "./index";

const blueBuild: BuildConfig = {
  version: "0.1",
  name: "Blue",
  skin: "default_blue",
  baseModel: "default",
  traits: ["hp_boost", "speed_boost", "collision_boost"]
};

const redBuild: BuildConfig = {
  version: "0.1",
  name: "Red",
  skin: "default_red",
  baseModel: "default",
  traits: ["giant_body", "collision_boost", "wall_charge"]
};

const matchConfig: MatchConfig = {
  version: "0.1",
  seed: 12345,
  arenaId: "mvp_rect",
  blue: blueBuild,
  red: redBuild
};

const hpStackTraits: TraitId[] = ["hp_boost", "hp_boost", "hp_boost"];

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

function placeSeparatedMainBalls(world: TestWorld, blueX = 60, redX = 180, y = 90): [TestBall, TestBall] {
  const [blue, red] = world.balls;
  if (!blue || !red) {
    throw new Error("Expected two battle balls");
  }
  blue.position = { x: blueX, y };
  red.position = { x: redX, y };
  blue.velocity = { x: 0, y: 0 };
  red.velocity = { x: 0, y: 0 };
  blue.collisionTimers = {};
  red.collisionTimers = {};
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
      traits: ["hp_boost", "hp_boost", "hp_boost"]
    });

    expect(stats.maxHp).toBe(160);
    expect(stats.moveSpeed).toBe(180);
  });

  it("rejects invalid builds before simulation starts", () => {
    expect(() =>
      createStatsForBuild({
        version: "0.1",
        name: "Invalid",
        skin: "default_blue",
        baseModel: "default",
        traits: ["ranged_core", "ranged_core", "hp_boost"]
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
        traits: ["hp_boost", "hp_boost", "hp_boost"]
      }
    });
    const blue = world.balls[0];
    if (!blue) {
      throw new Error("Expected a blue ball");
    }

    expect(blue.stats.maxHp).toBe(160);
    expect(blue.hp).toBe(160);
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
      makeMatch(["lifesteal_collision", "hp_boost", "hp_boost"], hpStackTraits),
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
      makeMatch(hpStackTraits, ["spike_reflect", "hp_boost", "hp_boost"]),
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
      makeMatch(["collision_burst", "hp_boost", "hp_boost"], hpStackTraits),
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
      makeMatch(["wall_charge", "hp_boost", "hp_boost"], hpStackTraits),
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

  it("fires a weak base projectile when a projectile trait is equipped", () => {
    const world = createBattle(
      makeMatch(["ranged_core", "hp_boost", "hp_boost"], hpStackTraits),
      { id: "test", width: 480, height: 240 }
    );
    placeSeparatedMainBalls(world, 100, 380, 120);

    stepBattle(world, 1 / 60, 0);

    expect(world.projectiles).toHaveLength(1);
    expect(world.projectiles[0]?.team).toBe("blue");
    expect(world.events.some((event) => event.type === "trait_triggered" && event.trigger === "projectile_fire")).toBe(true);
  });

  it("damages enemies with projectile hit events", () => {
    const world = createBattle(
      makeMatch(["ranged_core", "hp_boost", "hp_boost"], hpStackTraits),
      { id: "test", width: 360, height: 240 }
    );
    const [, red] = placeSeparatedMainBalls(world, 100, 225, 120);

    stepBattle(world, 1 / 60, 0);
    const damageEvent = world.events.find((event) => event.type === "damage" && event.tags.includes("projectile"));

    if (!damageEvent || damageEvent.type !== "damage") {
      throw new Error("Expected projectile damage");
    }
    expect(damageEvent.amount).toBeCloseTo(2.6);
    expect(red.hp).toBeCloseTo(red.stats.maxHp - 2.6);
    expect(world.projectiles).toHaveLength(0);
  });

  it("fires three projectiles with pellet barrage", () => {
    const world = createBattle(
      makeMatch(["pellet_barrage", "hp_boost", "hp_boost"], hpStackTraits),
      { id: "test", width: 480, height: 240 }
    );
    placeSeparatedMainBalls(world, 100, 380, 120);

    stepBattle(world, 1 / 60, 0);
    const fireEvent = world.events.find((event) => event.type === "trait_triggered" && event.trigger === "projectile_fire");

    expect(world.projectiles).toHaveLength(3);
    if (!fireEvent || fireEvent.type !== "trait_triggered") {
      throw new Error("Expected projectile fire trigger");
    }
    expect(fireEvent.value).toBe(3);
  });

  it("keeps ricochet projectiles alive after a wall bounce", () => {
    const world = createBattle(
      makeMatch(["ricochet_shot", "hp_boost", "hp_boost"], hpStackTraits),
      { id: "test", width: 420, height: 240 }
    );
    placeSeparatedMainBalls(world, 100, 320, 120);

    stepBattle(world, 1 / 60, 0);
    const projectile = world.projectiles[0];
    if (!projectile) {
      throw new Error("Expected a projectile before bounce");
    }
    projectile.position = { x: world.arena.width - projectile.radius - 1, y: 24 };
    projectile.velocity = { x: 100, y: 0 };

    stepBattle(world, 1 / 60, 0);

    expect(world.projectiles).toHaveLength(1);
    expect(world.projectiles[0]?.velocity.x).toBeLessThan(0);
    expect(world.events.some((event) => event.type === "trait_triggered" && event.traitId === "ricochet_shot")).toBe(true);
  });

  it("keeps pierce projectiles after the first hit", () => {
    const world = createBattle(
      makeMatch(["pierce_shot", "hp_boost", "hp_boost"], hpStackTraits),
      { id: "test", width: 360, height: 240 }
    );
    const [, red] = placeSeparatedMainBalls(world, 100, 225, 120);

    stepBattle(world, 1 / 60, 0);

    expect(red.hp).toBeCloseTo(red.stats.maxHp - 2);
    expect(world.projectiles).toHaveLength(1);
    expect(world.projectiles[0]?.hitBallIds).toContain(red.id);
  });

  it("splits projectiles into child shots on hit", () => {
    const world = createBattle(
      makeMatch(["split_shot", "hp_boost", "hp_boost"], hpStackTraits),
      { id: "test", width: 360, height: 240 }
    );
    placeSeparatedMainBalls(world, 100, 225, 120);

    stepBattle(world, 1 / 60, 0);
    const splitEvent = world.events.find((event) => event.type === "trait_triggered" && event.traitId === "split_shot");

    expect(world.projectiles).toHaveLength(2);
    expect(world.projectiles.every((projectile) => projectile.isChild)).toBe(true);
    if (!splitEvent || splitEvent.type !== "trait_triggered") {
      throw new Error("Expected projectile split trigger");
    }
    expect(splitEvent.value).toBe(2);
  });

  it("spawns clone balls without exceeding the configured clone limit", () => {
    const world = createBattle(
      makeMatch(["clone_spawn", "hp_boost", "hp_boost"], hpStackTraits),
      { id: "test", width: 240, height: 180 }
    );
    placeSeparatedMainBalls(world, 60, 180);

    stepBattle(world, 1 / 60, 0);

    const clones = world.balls.filter((ball) => ball.team === "blue" && ball.role === "clone" && ball.alive);
    expect(clones).toHaveLength(1);
    expect(clones[0]?.hp).toBeCloseTo(world.balls[0]!.stats.maxHp * 0.35);
    expect(world.events.some((event) => event.type === "trait_triggered" && event.traitId === "clone_spawn")).toBe(true);

    for (let i = 0; i < 30; i += 1) {
      stepBattle(world, 1 / 60, 0);
    }

    expect(world.balls.filter((ball) => ball.team === "blue" && ball.role === "clone" && ball.alive)).toHaveLength(1);
  });

  it("splits a dead main ball before deciding the winner", () => {
    const world = createBattle(
      makeMatch(hpStackTraits, ["death_split", "hp_boost", "hp_boost"]),
      { id: "test", width: 240, height: 180 }
    );
    const red = world.balls[1];
    if (!red) {
      throw new Error("Expected a red ball");
    }
    red.hp = 0;
    red.alive = false;

    stepBattle(world, 1 / 60, 0);

    const splitBalls = world.balls.filter((ball) => ball.team === "red" && ball.role === "split" && ball.alive);
    expect(splitBalls).toHaveLength(2);
    expect(world.result).toBeUndefined();
    expect(world.events.some((event) => event.type === "trait_triggered" && event.traitId === "death_split")).toBe(true);

    for (const split of splitBalls) {
      split.hp = 0;
      split.alive = false;
    }
    stepBattle(world, 1 / 60, 0);

    expect(world.result?.winner).toBe("blue");
  });

  it("explodes clone deaths when clone bomb is equipped", () => {
    const world = createBattle(
      makeMatch(["clone_spawn", "clone_bomb", "hp_boost"], hpStackTraits),
      { id: "test", width: 240, height: 180 }
    );
    const [, red] = placeSeparatedMainBalls(world, 60, 150);

    stepBattle(world, 1 / 60, 0);
    const clone = world.balls.find((ball) => ball.team === "blue" && ball.role === "clone");
    if (!clone) {
      throw new Error("Expected a clone");
    }
    clone.position = { ...red.position };
    clone.hp = 0;
    clone.alive = false;
    red.velocity = { x: 0, y: 0 };

    stepBattle(world, 1 / 60, 0);

    const explosionEvent = world.events.find((event) => event.type === "damage" && event.tags.includes("explosion"));
    if (!explosionEvent || explosionEvent.type !== "damage") {
      throw new Error("Expected clone death explosion damage");
    }
    expect(explosionEvent.amount).toBeCloseTo(10);
    expect(world.events.some((event) => event.type === "trait_triggered" && event.traitId === "clone_bomb")).toBe(true);
  });

  it("spawns auto turrets that fire projectile shots", () => {
    const world = createBattle(
      makeMatch(["auto_turret", "hp_boost", "hp_boost"], hpStackTraits),
      { id: "test", width: 260, height: 180 }
    );
    placeSeparatedMainBalls(world, 60, 220);

    stepBattle(world, 1 / 60, 0);

    expect(world.turrets).toHaveLength(1);
    expect(world.turrets[0]?.team).toBe("blue");
    expect(world.projectiles.some((projectile) => projectile.ownerId === "blue-main")).toBe(true);
    expect(world.events.some((event) => event.type === "trait_triggered" && event.trigger === "turret_spawn")).toBe(true);
    expect(world.events.some((event) => event.type === "trait_triggered" && event.trigger === "turret_fire")).toBe(true);
  });

  it("applies on-hit status payloads and resolves dot damage", () => {
    const world = createBattle(
      makeMatch(["burn_payload", "poison_payload", "hp_boost"], hpStackTraits),
      { id: "test", width: 240, height: 180 }
    );
    const [blue, red] = placeOverlappingMainBalls(world);
    for (const status of blue.mechanics.status.onHit) {
      status.chance = 1;
    }
    red.stats.collisionDamage = 0;

    stepBattle(world, 1 / 60, 0);

    expect(red.runtime.statuses.map((status) => status.id).sort()).toEqual(["burn", "poison"]);
    expect(world.events.some((event) => event.type === "trait_triggered" && event.trigger === "status_apply")).toBe(true);

    blue.position = { x: 60, y: 90 };
    red.position = { x: 180, y: 90 };
    blue.velocity = { x: 0, y: 0 };
    red.velocity = { x: 0, y: 0 };
    const hpAfterHit = red.hp;

    stepBattle(world, 1, 0);

    expect(red.hp).toBeCloseTo(hpAfterHit - 3.2);
    expect(world.events.some((event) => event.type === "damage" && event.tags.includes("dot"))).toBe(true);
  });

  it("slows target movement while the slow status is active", () => {
    const world = createBattle(
      makeMatch(["slow_payload", "hp_boost", "hp_boost"], hpStackTraits),
      { id: "test", width: 240, height: 180 }
    );
    const [blue, red] = placeOverlappingMainBalls(world);
    blue.mechanics.status.onHit[0]!.chance = 1;
    red.stats.collisionDamage = 0;

    stepBattle(world, 1 / 60, 0);
    blue.position = { x: 60, y: 90 };
    red.position = { x: 180, y: 90 };
    blue.velocity = { x: 0, y: 0 };
    red.velocity = { x: 0, y: 0 };

    stepBattle(world, 1 / 60, 1);

    expect(Math.hypot(red.velocity.x, red.velocity.y)).toBeCloseTo(red.stats.moveSpeed * 0.72);
  });

  it("amplifies incoming damage while vulnerable", () => {
    const world = createBattle(makeMatch(hpStackTraits, hpStackTraits), { id: "test", width: 240, height: 180 });
    const [blue, red] = placeOverlappingMainBalls(world);
    red.stats.collisionDamage = 0;
    red.runtime.statuses.push({
      id: "vulnerable",
      traitId: "vulnerable_payload",
      sourceId: blue.id,
      remaining: 3,
      tickDamage: 0,
      slowPercent: 0,
      vulnerablePercent: 0.18
    });

    const hpBefore = red.hp;
    stepBattle(world, 1 / 60, 0);

    expect(hpBefore - red.hp).toBeCloseTo(8 * 1.18);
  });

  it("refreshes periodic shields and absorbs incoming damage", () => {
    const world = createBattle(
      makeMatch(hpStackTraits, ["shield_cycle", "hp_boost", "hp_boost"]),
      { id: "test", width: 240, height: 180 }
    );
    const [, red] = placeOverlappingMainBalls(world);
    red.stats.collisionDamage = 0;
    const hpBefore = red.hp;

    stepBattle(world, 1 / 60, 0);

    expect(red.hp).toBeCloseTo(hpBefore);
    expect(red.runtime.shield).toBeCloseTo(6);
    expect(world.events.some((event) => event.type === "trait_triggered" && event.trigger === "shield_refresh")).toBe(true);
    expect(world.events.some((event) => event.type === "trait_triggered" && event.trigger === "shield_absorb")).toBe(true);
  });

  it("triggers low hp rage and temporarily increases movement speed", () => {
    const world = createBattle(
      makeMatch(["low_hp_rage", "hp_boost", "hp_boost"], hpStackTraits),
      { id: "test", width: 360, height: 180 }
    );
    const [blue] = placeSeparatedMainBalls(world, 60, 300);
    blue.hp = blue.stats.maxHp * 0.25;

    stepBattle(world, 1 / 60, 1);

    expect(blue.runtime.lowHpRageRemaining).toBeGreaterThan(4.9);
    expect(Math.hypot(blue.velocity.x, blue.velocity.y)).toBeCloseTo(blue.stats.moveSpeed * 1.35);
    expect(world.events.some((event) => event.type === "trait_triggered" && event.trigger === "low_hp_rage_trigger")).toBe(true);
  });

  it("revives once before the battle can end", () => {
    const world = createBattle(
      makeMatch(hpStackTraits, ["one_revive", "hp_boost", "hp_boost"]),
      { id: "test", width: 240, height: 180 }
    );
    const red = world.balls[1];
    if (!red) {
      throw new Error("Expected a red ball");
    }
    red.hp = 0;
    red.alive = false;

    stepBattle(world, 1 / 60, 0);

    expect(red.alive).toBe(true);
    expect(red.hp).toBeCloseTo(red.stats.maxHp * 0.35);
    expect(red.runtime.reviveTriggered).toBe(true);
    expect(world.result).toBeUndefined();
    expect(world.events.some((event) => event.type === "trait_triggered" && event.trigger === "revive_once")).toBe(true);
  });

  it("adds kill growth stacks when an enemy unit finally dies", () => {
    const world = createBattle(
      makeMatch(["kill_growth", "hp_boost", "hp_boost"], hpStackTraits),
      { id: "test", width: 240, height: 180 }
    );
    const [blue, red] = placeOverlappingMainBalls(world);
    red.hp = 1;
    red.stats.collisionDamage = 0;

    stepBattle(world, 1 / 60, 0);

    expect(blue.runtime.killGrowthStacks).toBe(1);
    expect(world.events.some((event) => event.type === "trait_triggered" && event.trigger === "kill_growth_stack")).toBe(true);
  });

  it("adds time growth stacks after the configured interval", () => {
    const world = createBattle(
      makeMatch(["time_growth", "hp_boost", "hp_boost"], hpStackTraits),
      { id: "test", width: 400, height: 180 }
    );
    const [blue] = placeSeparatedMainBalls(world, 60, 340);
    blue.mechanics.rule.timeGrowthInterval = 1;

    stepBattle(world, 1, 0);

    expect(blue.runtime.timeGrowthStacks).toBe(1);
    expect(world.events.some((event) => event.type === "trait_triggered" && event.trigger === "time_growth_stack")).toBe(true);
  });

  it("returns render snapshots without exposing the rng", () => {
    const world = createBattle(matchConfig);
    stepBattle(world);
    const snapshot = getSnapshot(world);

    expect(snapshot.tick).toBe(1);
    expect(snapshot.balls).toHaveLength(2);
    expect(snapshot.projectiles).toHaveLength(0);
    expect(snapshot.turrets).toHaveLength(0);
    expect("rng" in snapshot).toBe(false);
  });

  it("includes projectiles in render snapshots", () => {
    const world = createBattle(
      makeMatch(["ranged_core", "hp_boost", "hp_boost"], hpStackTraits),
      { id: "test", width: 480, height: 240 }
    );
    placeSeparatedMainBalls(world, 100, 380, 120);

    stepBattle(world, 1 / 60, 0);
    const snapshot = getSnapshot(world);

    expect(snapshot.projectiles).toHaveLength(1);
    expect(snapshot.projectiles[0]).toMatchObject({
      id: world.projectiles[0]?.id,
      team: "blue"
    });
  });

  it("includes turrets in render snapshots", () => {
    const world = createBattle(
      makeMatch(["auto_turret", "hp_boost", "hp_boost"], hpStackTraits),
      { id: "test", width: 260, height: 180 }
    );
    placeSeparatedMainBalls(world, 60, 220);

    stepBattle(world, 1 / 60, 0);
    const snapshot = getSnapshot(world);

    expect(snapshot.turrets).toHaveLength(1);
    expect(snapshot.turrets[0]).toMatchObject({
      id: world.turrets[0]?.id,
      team: "blue"
    });
  });

  it("includes active statuses and shields in render snapshots", () => {
    const world = createBattle(
      makeMatch(["burn_payload", "hp_boost", "hp_boost"], ["shield_cycle", "hp_boost", "hp_boost"]),
      { id: "test", width: 240, height: 180 }
    );
    const [blue, red] = placeSeparatedMainBalls(world, 60, 180);
    red.runtime.statuses.push({
      id: "burn",
      traitId: "burn_payload",
      sourceId: blue.id,
      remaining: 2,
      tickDamage: 2,
      slowPercent: 0,
      vulnerablePercent: 0
    });
    red.runtime.shield = 5;
    red.runtime.lowHpRageRemaining = 2;
    red.runtime.killGrowthStacks = 3;
    red.runtime.timeGrowthStacks = 1;
    red.runtime.reviveTriggered = true;

    const snapshot = getSnapshot(world);
    const redSnapshot = snapshot.balls.find((ball) => ball.id === red.id);

    expect(redSnapshot?.statuses).toEqual([{ id: "burn", remaining: 2 }]);
    expect(redSnapshot?.shield).toBe(5);
    expect(redSnapshot?.maxShield).toBe(14);
    expect(redSnapshot?.lowHpRageRemaining).toBe(2);
    expect(redSnapshot?.killGrowthStacks).toBe(3);
    expect(redSnapshot?.timeGrowthStacks).toBe(1);
    expect(redSnapshot?.reviveTriggered).toBe(true);
  });
});
