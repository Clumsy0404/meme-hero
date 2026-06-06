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

  it("removes body collision damage from projectile builds", () => {
    const stats = createStatsForBuild({
      version: "0.1",
      name: "Ranged Body",
      skin: "default_blue",
      baseModel: "default",
      traits: ["ranged_core", "collision_boost", "hp_boost"]
    });

    expect(stats.collisionDamage).toBe(0);
  });

  it("applies base stat balance overrides before trait modifiers", () => {
    const stats = createStatsForBuild(
      {
        version: "0.1",
        name: "Tuned HP",
        skin: "default_blue",
        baseModel: "default",
        traits: ["hp_boost", "speed_boost", "collision_boost"]
      },
      undefined,
      {
        baseStats: {
          maxHp: 80,
          moveSpeed: 200,
          radius: 60
        }
      }
    );

    expect(stats.maxHp).toBe(96);
    expect(stats.moveSpeed).toBeCloseTo(230);
    expect(stats.radius).toBe(60);
  });

  it("applies trait stat modifier overrides", () => {
    const stats = createStatsForBuild(
      {
        version: "0.1",
        name: "Tuned Trait",
        skin: "default_blue",
        baseModel: "default",
        traits: ["hp_boost", "speed_boost", "collision_boost"]
      },
      undefined,
      {
        traits: {
          hp_boost: {
            statModifiers: [{ stat: "maxHp", op: "percentAdd", value: 0.5 }]
          }
        }
      }
    );

    expect(stats.maxHp).toBe(150);
    expect(stats.moveSpeed).toBeCloseTo(180 * 1.15);
  });

  it("keeps body collision damage for non-projectile builds", () => {
    const stats = createStatsForBuild({
      version: "0.1",
      name: "Melee Body",
      skin: "default_blue",
      baseModel: "default",
      traits: ["collision_boost", "hp_boost", "speed_boost"]
    });

    expect(stats.collisionDamage).toBeCloseTo(8 * 1.18);
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
    expect(Math.hypot(world.projectiles[0]!.velocity.x, world.projectiles[0]!.velocity.y)).toBeCloseTo(280);
    expect(world.events.some((event) => event.type === "trait_triggered" && event.trigger === "projectile_fire")).toBe(true);
  });

  it("applies projectile balance overrides to fired shots", () => {
    const world = createBattle(
      makeMatch(["ranged_core", "hp_boost", "hp_boost"], hpStackTraits),
      { id: "test", width: 480, height: 240 },
      {
        projectile: {
          damage: 3,
          speed: 160,
          radius: 18,
          lifetime: 2.2,
          cooldown: 0.8
        }
      }
    );
    placeSeparatedMainBalls(world, 100, 380, 120);

    stepBattle(world, 1 / 60, 0);
    const projectile = world.projectiles[0];

    expect(projectile?.damage).toBeCloseTo(3.9);
    expect(Math.hypot(projectile!.velocity.x, projectile!.velocity.y)).toBeCloseTo(160);
    expect(projectile?.radius).toBe(18);
    expect(projectile?.lifetime).toBeCloseTo(2.2 - 1 / 60);
    expect(world.balls[0]?.runtime.projectileCooldown).toBeCloseTo(0.8);
  });

  it("applies trait projectile overrides to fired shots", () => {
    const world = createBattle(
      makeMatch(["pellet_barrage", "hp_boost", "hp_boost"], hpStackTraits),
      { id: "test", width: 480, height: 240 },
      {
        traits: {
          pellet_barrage: {
            projectile: {
              damageMultiplier: 0.5,
              extraProjectiles: 1,
              spreadAngleDeg: 10,
              fireRateMultiplier: 1
            }
          }
        }
      }
    );
    placeSeparatedMainBalls(world, 100, 380, 120);

    stepBattle(world, 1 / 60, 0);
    const fireEvent = world.events.find((event) => event.type === "trait_triggered" && event.trigger === "projectile_fire");

    expect(world.projectiles).toHaveLength(2);
    expect(world.projectiles.every((projectile) => projectile.damage === 1)).toBe(true);
    if (!fireEvent || fireEvent.type !== "trait_triggered") {
      throw new Error("Expected projectile fire trigger");
    }
    expect(fireEvent.value).toBe(2);
    expect(world.balls[0]?.runtime.projectileCooldown).toBeCloseTo(1.1);
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
    expect(world.projectiles.every((projectile) => projectile.damage === 1.4)).toBe(true);
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

  it("readies and expires special elbow strike windows", () => {
    const world = createBattle(
      makeMatch(["special_elbow_strike", "hp_boost", "hp_boost"], hpStackTraits),
      { id: "test", width: 480, height: 240 }
    );
    placeSeparatedMainBalls(world, 100, 380, 120);

    stepBattle(world, 10, 0);

    const blue = world.balls[0]!;
    expect(blue.runtime.specialElbowWindowRemaining).toBeCloseTo(2);
    expect(blue.runtime.specialElbowHitAvailable).toBe(true);
    expect(world.events.some((event) => event.type === "trait_triggered" && event.trigger === "elbow_ready")).toBe(true);

    stepBattle(world, 2, 0);

    expect(blue.runtime.specialElbowWindowRemaining).toBe(0);
    expect(blue.runtime.specialElbowHitAvailable).toBe(false);
    expect(blue.runtime.specialElbowCooldown).toBeCloseTo(10);
    expect(world.events.some((event) => event.type === "trait_triggered" && event.trigger === "elbow_expire")).toBe(true);
  });

  it("dashes toward the enemy during special elbow strike windows", () => {
    const world = createBattle(
      makeMatch(["special_elbow_strike", "hp_boost", "hp_boost"], hpStackTraits),
      { id: "test", width: 480, height: 240 }
    );
    const [blue] = placeSeparatedMainBalls(world, 100, 380, 120);
    blue.velocity = { x: 0, y: 0 };
    blue.runtime.specialElbowCooldown = 0;
    blue.runtime.specialElbowWindowRemaining = 2;
    blue.runtime.specialElbowHitAvailable = true;

    stepBattle(world, 1 / 60, 0);

    expect(blue.velocity.x).toBeGreaterThan(0);
    expect(Math.hypot(blue.velocity.x, blue.velocity.y)).toBeCloseTo(blue.stats.moveSpeed * 3);
    const snapshot = getSnapshot(world);
    expect(snapshot.balls[0]?.specialElbowRemaining).toBeGreaterThan(0);
    expect(snapshot.balls[0]?.specialElbowRange).toBeGreaterThan(0);
  });

  it("amplifies collision damage with special elbow strike", () => {
    const world = createBattle(
      makeMatch(["special_elbow_strike", "hp_boost", "hp_boost"], hpStackTraits),
      { id: "test", width: 240, height: 180 }
    );
    const [blue, red] = placeOverlappingMainBalls(world);
    blue.runtime.specialElbowCooldown = 0;
    blue.runtime.specialElbowWindowRemaining = 2;
    blue.runtime.specialElbowHitAvailable = true;
    red.stats.collisionDamage = 0;
    const hpBefore = red.hp;

    stepBattle(world, 1 / 60, 0);

    expect(hpBefore - red.hp).toBeCloseTo(12);
    expect(blue.runtime.specialElbowWindowRemaining).toBeGreaterThan(0);
    expect(blue.runtime.specialElbowHitAvailable).toBe(false);
    expect(world.events.some((event) => event.type === "trait_triggered" && event.trigger === "elbow_hit")).toBe(true);
  });

  it("hits with the special elbow hitbox before body contact", () => {
    const world = createBattle(
      makeMatch(["special_elbow_strike", "hp_boost", "hp_boost"], hpStackTraits),
      { id: "test", width: 360, height: 180 }
    );
    const [blue, red] = placeSeparatedMainBalls(world, 60, 180, 90);
    blue.runtime.specialElbowCooldown = 0;
    blue.runtime.specialElbowWindowRemaining = 2;
    blue.runtime.specialElbowDirection = { x: 1, y: 0 };
    blue.runtime.specialElbowHitAvailable = true;
    red.stats.collisionDamage = 0;
    const hpBefore = red.hp;

    stepBattle(world, 1 / 60, 0);

    expect(hpBefore - red.hp).toBeCloseTo(12);
    expect(blue.runtime.specialElbowWindowRemaining).toBeGreaterThan(0);
    expect(blue.runtime.specialElbowHitAvailable).toBe(false);
    expect(world.events.some((event) => event.type === "trait_triggered" && event.trigger === "elbow_hit")).toBe(true);
  });

  it("only applies special elbow strike damage once per window", () => {
    const world = createBattle(
      makeMatch(["special_elbow_strike", "hp_boost", "hp_boost"], hpStackTraits),
      { id: "test", width: 360, height: 180 }
    );
    const [blue, red] = placeSeparatedMainBalls(world, 60, 180, 90);
    blue.runtime.specialElbowCooldown = 0;
    blue.runtime.specialElbowWindowRemaining = 2;
    blue.runtime.specialElbowDirection = { x: 1, y: 0 };
    blue.runtime.specialElbowHitAvailable = true;
    red.stats.collisionDamage = 0;

    stepBattle(world, 1 / 60, 0);
    const hpAfterFirstHit = red.hp;
    blue.position = { x: 60, y: 90 };
    red.position = { x: 180, y: 90 };
    blue.velocity = { x: 0, y: 0 };
    red.velocity = { x: 0, y: 0 };
    blue.collisionTimers = {};
    red.collisionTimers = {};

    stepBattle(world, 1 / 60, 0);

    expect(red.hp).toBeCloseTo(hpAfterFirstHit);
    expect(blue.runtime.specialElbowWindowRemaining).toBeGreaterThan(0);
    expect(blue.runtime.specialElbowHitAvailable).toBe(false);
    expect(world.events.some((event) => event.type === "trait_triggered" && event.trigger === "elbow_hit")).toBe(false);
  });

  it("fires special basketball projectiles after their cooldown", () => {
    const world = createBattle(
      makeMatch(["special_bounce_basketball", "hp_boost", "hp_boost"], hpStackTraits),
      { id: "test", width: 720, height: 240 }
    );
    placeSeparatedMainBalls(world, 100, 620, 120);

    for (let i = 0; i < 133; i += 1) {
      stepBattle(world, 1 / 60, 0);
    }

    const basketball = world.projectiles.find((projectile) => projectile.kind === "basketball");
    expect(basketball).toBeDefined();
    expect(basketball?.damage).toBe(5);
    expect(basketball?.bouncesLeft).toBe(3);
    expect(world.events.some((event) => event.type === "trait_triggered" && event.trigger === "basketball_fire")).toBe(true);
  });

  it("does not exceed the special basketball per-team limit", () => {
    const world = createBattle(
      makeMatch(["special_bounce_basketball", "hp_boost", "hp_boost"], hpStackTraits),
      { id: "test", width: 720, height: 240 }
    );
    placeSeparatedMainBalls(world, 100, 620, 120);
    const blue = world.balls[0]!;
    blue.runtime.specialBasketballCooldown = 0;

    stepBattle(world, 1 / 60, 0);
    const first = world.projectiles.find((projectile) => projectile.kind === "basketball");
    if (!first) {
      throw new Error("Expected first basketball");
    }
    world.projectiles.push({ ...first, id: "manual-basketball-1" }, { ...first, id: "manual-basketball-2" });
    blue.runtime.specialBasketballCooldown = 0;

    stepBattle(world, 1 / 60, 0);

    expect(world.projectiles.filter((projectile) => projectile.team === "blue" && projectile.kind === "basketball")).toHaveLength(3);
  });

  it("emits special basketball wall bounce events", () => {
    const world = createBattle(
      makeMatch(["special_bounce_basketball", "hp_boost", "hp_boost"], hpStackTraits),
      { id: "test", width: 420, height: 240 }
    );
    placeSeparatedMainBalls(world, 100, 320, 120);
    const blue = world.balls[0]!;
    blue.runtime.specialBasketballCooldown = 0;

    stepBattle(world, 1 / 60, 0);
    const basketball = world.projectiles.find((projectile) => projectile.kind === "basketball");
    if (!basketball) {
      throw new Error("Expected a basketball before bounce");
    }
    basketball.position = { x: world.arena.width - basketball.radius - 1, y: 24 };
    basketball.velocity = { x: 100, y: 0 };

    stepBattle(world, 1 / 60, 0);

    expect(basketball.velocity.x).toBeLessThan(0);
    expect(basketball.bouncesLeft).toBe(2);
    expect(world.events.some((event) => event.type === "trait_triggered" && event.trigger === "basketball_bounce")).toBe(true);
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

  it("applies turret balance overrides to spawned turrets and shots", () => {
    const world = createBattle(
      makeMatch(["auto_turret", "hp_boost", "hp_boost"], hpStackTraits),
      { id: "test", width: 260, height: 180 },
      {
        turret: {
          turretHp: 24,
          turretRadius: 42,
          turretProjectileDamage: 4,
          turretProjectileCooldown: 0.75,
          turretProjectileSpeed: 190,
          turretProjectileRadius: 16,
          turretProjectileLifetime: 1.7
        }
      }
    );
    placeSeparatedMainBalls(world, 60, 220);

    stepBattle(world, 1 / 60, 0);
    const turret = world.turrets[0];
    const projectile = world.projectiles.find((shot) => shot.ownerId === "blue-main");

    expect(turret?.hp).toBe(24);
    expect(turret?.radius).toBe(42);
    expect(projectile?.damage).toBe(4);
    expect(projectile?.radius).toBe(16);
    expect(projectile?.lifetime).toBeCloseTo(1.7 - 1 / 60);
    expect(Math.hypot(projectile!.velocity.x, projectile!.velocity.y)).toBeCloseTo(190);
    expect(turret?.projectileCooldown).toBeCloseTo(0.75);
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

  it("readies and expires special hajimi guard", () => {
    const world = createBattle(
      makeMatch(["special_hajimi_guard", "hp_boost", "hp_boost"], hpStackTraits),
      { id: "test", width: 480, height: 240 }
    );
    placeSeparatedMainBalls(world, 100, 380, 120);

    stepBattle(world, 15, 0);

    const blue = world.balls[0]!;
    expect(blue.runtime.specialHajimiGuardRemaining).toBeCloseTo(3.5);
    expect(world.events.some((event) => event.type === "trait_triggered" && event.trigger === "hajimi_guard_ready")).toBe(true);

    stepBattle(world, 3.5, 0);

    expect(blue.runtime.specialHajimiGuardRemaining).toBe(0);
    expect(world.events.some((event) => event.type === "trait_triggered" && event.trigger === "hajimi_guard_expire")).toBe(true);
  });

  it("reduces the next collision damage with special hajimi guard", () => {
    const world = createBattle(
      makeMatch(hpStackTraits, ["special_hajimi_guard", "hp_boost", "hp_boost"]),
      { id: "test", width: 240, height: 180 }
    );
    const [blue, red] = placeOverlappingMainBalls(world);
    red.runtime.specialHajimiGuardRemaining = 3.5;
    red.stats.collisionDamage = 0;
    const hpBefore = red.hp;

    stepBattle(world, 1 / 60, 0);

    expect(hpBefore - red.hp).toBeCloseTo(8 * 0.4);
    expect(red.runtime.specialHajimiGuardRemaining).toBe(0);
    expect(Math.hypot(blue.velocity.x, blue.velocity.y)).toBeCloseTo(blue.stats.knockback * 1.35);
    expect(world.events.some((event) => event.type === "trait_triggered" && event.trigger === "hajimi_guard_consume")).toBe(true);
  });

  it("does not reduce projectile damage with special hajimi guard", () => {
    const world = createBattle(
      makeMatch(["ranged_core", "hp_boost", "hp_boost"], ["special_hajimi_guard", "hp_boost", "hp_boost"]),
      { id: "test", width: 360, height: 240 }
    );
    const [, red] = placeSeparatedMainBalls(world, 100, 225, 120);
    red.runtime.specialHajimiGuardRemaining = 3.5;
    const hpBefore = red.hp;

    stepBattle(world, 1 / 60, 0);

    expect(hpBefore - red.hp).toBeCloseTo(2.6);
    expect(red.runtime.specialHajimiGuardRemaining).toBeGreaterThan(0);
    expect(world.events.some((event) => event.type === "trait_triggered" && event.trigger === "hajimi_guard_consume")).toBe(false);
  });

  it("cycles special blade shield stances and expands blade hits", () => {
    const world = createBattle(
      makeMatch(["special_blade_shield_stance", "hp_boost", "hp_boost"], hpStackTraits),
      { id: "test", width: 360, height: 180 }
    );
    const [blue, red] = placeSeparatedMainBalls(world, 60, 180, 90);
    blue.stats.moveSpeed = 0;
    red.stats.moveSpeed = 0;
    red.stats.collisionDamage = 0;
    const hpBefore = red.hp;

    stepBattle(world, 1 / 60, 0);

    expect(hpBefore - red.hp).toBeCloseTo(10);
    expect(world.events.some((event) => event.type === "trait_triggered" && event.trigger === "blade_shield_hit")).toBe(true);

    stepBattle(world, 5, 0);
    expect(blue.runtime.specialBladeShieldStance).toBe("shield");

    stepBattle(world, 5, 0);
    expect(blue.runtime.specialBladeShieldStance).toBe("blade");
  });

  it("reduces all damage and rebounds collision in special blade shield guard stance", () => {
    const world = createBattle(
      makeMatch(hpStackTraits, ["special_blade_shield_stance", "hp_boost", "hp_boost"]),
      { id: "test", width: 240, height: 180 }
    );
    const [blue, red] = placeOverlappingMainBalls(world);
    red.runtime.specialBladeShieldStance = "shield";
    red.runtime.specialBladeShieldRemaining = 5;
    red.stats.collisionDamage = 0;
    const hpBefore = red.hp;

    stepBattle(world, 1 / 60, 0);

    expect(hpBefore - red.hp).toBeCloseTo(8 * 0.7);
    expect(Math.hypot(blue.velocity.x, blue.velocity.y)).toBeCloseTo(blue.stats.knockback * 1.25);
    expect(world.events.some((event) => event.type === "trait_triggered" && event.trigger === "blade_shield_guard_reduce")).toBe(true);
  });

  it("locks the nearest enemy with special tiger gaze", () => {
    const world = createBattle(
      makeMatch(["special_dongbei_tiger_gaze", "hp_boost", "hp_boost"], hpStackTraits),
      { id: "test", width: 480, height: 240 }
    );
    const [blue, red] = placeSeparatedMainBalls(world, 100, 380, 120);
    blue.runtime.specialTigerGazeCooldown = 0;

    stepBattle(world, 1 / 60, 1);

    expect(blue.runtime.specialTigerGazeTargetId).toBe(red.id);
    expect(red.runtime.statuses.some((status) => status.id === "slow" && status.slowPercent === 1)).toBe(true);
    expect(red.runtime.statuses.some((status) => status.id === "vulnerable" && status.vulnerablePercent === 0.1)).toBe(true);
    expect(Math.hypot(red.velocity.x, red.velocity.y)).toBeCloseTo(0);
    expect(world.events.some((event) => event.type === "trait_triggered" && event.trigger === "tiger_gaze_lock")).toBe(true);
  });

  it("fires special huaqiang melon and knife projectiles", () => {
    const world = createBattle(
      makeMatch(["special_huaqiang_melon", "hp_boost", "hp_boost"], hpStackTraits),
      { id: "test", width: 720, height: 240 }
    );
    const [blue] = placeSeparatedMainBalls(world, 100, 620, 120);
    blue.runtime.specialHuaqiangCooldown = 0;

    stepBattle(world, 1 / 60, 0);

    expect(world.projectiles.some((projectile) => projectile.kind === "melon" && projectile.damage === 2)).toBe(true);
    expect(world.events.some((event) => event.type === "trait_triggered" && event.trigger === "huaqiang_melon_throw")).toBe(true);

    blue.runtime.specialHuaqiangCooldown = 0;
    stepBattle(world, 1 / 60, 0);

    const knife = world.projectiles.find((projectile) => projectile.kind === "melon_knife");
    expect(knife?.damage).toBe(3);
    expect(Math.hypot(knife!.velocity.x, knife!.velocity.y)).toBeCloseTo(480);
    expect(world.events.some((event) => event.type === "trait_triggered" && event.trigger === "huaqiang_knife_throw")).toBe(true);
  });

  it("cracks special huaqiang melon for splash damage", () => {
    const world = createBattle(
      makeMatch(["special_huaqiang_melon", "hp_boost", "hp_boost"], hpStackTraits),
      { id: "test", width: 360, height: 240 }
    );
    const [blue, red] = placeSeparatedMainBalls(world, 100, 235, 120);
    blue.stats.moveSpeed = 0;
    red.stats.moveSpeed = 0;
    blue.runtime.specialHuaqiangCooldown = 0;
    const hpBefore = red.hp;

    stepBattle(world, 1 / 60, 0);

    expect(hpBefore - red.hp).toBeCloseTo(4);
    expect(world.projectiles.filter((projectile) => projectile.kind === "melon")).toHaveLength(0);
    expect(world.events.some((event) => event.type === "trait_triggered" && event.trigger === "huaqiang_melon_crack")).toBe(true);
  });

  it("warns, grabs, drags, and slows with special black hand", () => {
    const world = createBattle(
      makeMatch(["special_shenying_black_hand", "hp_boost", "hp_boost"], hpStackTraits),
      { id: "test", width: 480, height: 240 }
    );
    const [blue, red] = placeSeparatedMainBalls(world, 100, 380, 120);
    blue.stats.moveSpeed = 0;
    red.stats.moveSpeed = 0;
    blue.runtime.specialBlackHandCooldown = 0;

    stepBattle(world, 1 / 60, 0);
    expect(blue.runtime.specialBlackHandPhase).toBe("warning");
    expect(blue.runtime.specialBlackHandTargetId).toBe(red.id);

    stepBattle(world, 0.5, 0);
    expect(blue.runtime.specialBlackHandPhase).toBe("grab");
    expect(world.events.some((event) => event.type === "trait_triggered" && event.trigger === "black_hand_grab")).toBe(true);

    const xBeforeDrag = red.position.x;
    stepBattle(world, 0.2, 0);
    expect(red.position.x).toBeLessThan(xBeforeDrag);

    stepBattle(world, 1.1, 0);
    expect(blue.runtime.specialBlackHandPhase).toBe("idle");
    expect(red.runtime.statuses.some((status) => status.id === "slow" && status.slowPercent === 0.5)).toBe(true);
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
