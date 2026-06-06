import type { Team, Vec2 } from "@ball-brawl/shared";

import { add, clamp, distance, length, lengthSq, lerp, normalize, scale, sub } from "../math/vector";
import type { BallState, BattleResult, BattleWorldState, DamageTag, ProjectileState } from "./types";

export const FIXED_DT = 1 / 60;
export const DEFAULT_CHASE_STRENGTH = 0.75;
export const DEFAULT_MAX_DURATION = 180;

export function stepBattle(
  world: BattleWorldState,
  dt: number = FIXED_DT,
  chaseStrength: number = DEFAULT_CHASE_STRENGTH
): BattleWorldState {
  world.events = [];
  if (world.result) {
    return world;
  }

  world.tick += 1;
  world.time += dt;

  updateCollisionTimers(world, dt);
  updateBalls(world, dt, chaseStrength);
  fireProjectiles(world);
  updateProjectiles(world, dt);
  resolveBallCollisions(world);
  checkBattleEnd(world);

  return world;
}

export function runBattle(world: BattleWorldState, maxTicks = DEFAULT_MAX_DURATION / FIXED_DT): BattleWorldState {
  for (let i = 0; i < maxTicks && !world.result; i += 1) {
    stepBattle(world);
  }
  if (!world.result) {
    setResult(world, {
      winner: "draw",
      reason: "timeout",
      duration: world.time,
      blueRemainingHp: remainingHp(world, "blue"),
      redRemainingHp: remainingHp(world, "red")
    });
  }
  return world;
}

function updateCollisionTimers(world: BattleWorldState, dt: number): void {
  for (const ball of world.balls) {
    for (const targetId of Object.keys(ball.collisionTimers)) {
      const next = (ball.collisionTimers[targetId] ?? 0) - dt;
      if (next <= 0) {
        delete ball.collisionTimers[targetId];
      } else {
        ball.collisionTimers[targetId] = next;
      }
    }

    ball.runtime.collisionExplosionCooldown = Math.max(0, ball.runtime.collisionExplosionCooldown - dt);
    ball.runtime.projectileCooldown = Math.max(0, ball.runtime.projectileCooldown - dt);
  }
}

function updateBalls(world: BattleWorldState, dt: number, chaseStrength: number): void {
  for (const ball of world.balls) {
    if (!ball.alive) {
      continue;
    }

    const target = findTarget(world, ball);
    if (target) {
      steerToward(ball, target, dt, chaseStrength);
    }

    ball.position = add(ball.position, scale(ball.velocity, dt));
    handleWallBounce(world, ball);
  }
}

function fireProjectiles(world: BattleWorldState): void {
  for (const ball of world.balls) {
    if (!ball.alive || !ball.mechanics.projectile.enabled || ball.runtime.projectileCooldown > 0) {
      continue;
    }

    const target = findTarget(world, ball);
    if (!target) {
      continue;
    }

    const mechanics = ball.mechanics.projectile;
    const projectileCount = 1 + mechanics.extraProjectiles;
    const direction = normalize(sub(target.position, ball.position), normalize(ball.velocity, { x: ball.team === "blue" ? 1 : -1, y: 0 }));
    const spreadStep = projectileCount > 1 ? mechanics.spreadAngleDeg / (projectileCount - 1) : 0;
    const startAngle = projectileCount > 1 ? -mechanics.spreadAngleDeg / 2 : 0;

    for (let i = 0; i < projectileCount; i += 1) {
      const shotDirection = rotate(direction, degreesToRadians(startAngle + spreadStep * i));
      spawnProjectile(world, ball, shotDirection, false);
    }

    ball.runtime.projectileCooldown = mechanics.cooldown;
    world.events.push({
      type: "trait_triggered",
      tick: world.tick,
      ballId: ball.id,
      traitId: "projectile_enable",
      trigger: "projectile_fire",
      position: { ...ball.position },
      value: projectileCount
    });
  }
}

function spawnProjectile(world: BattleWorldState, owner: BallState, direction: Vec2, isChild: boolean, addToWorld = true): ProjectileState {
  const mechanics = owner.mechanics.projectile;
  const radius = isChild ? mechanics.radius * mechanics.childRadiusMultiplier : mechanics.radius;
  const speed = isChild ? mechanics.speed * 0.82 : mechanics.speed;
  const projectile: ProjectileState = {
    id: `projectile-${world.nextEntityId}`,
    team: owner.team,
    ownerId: owner.id,
    position: add(owner.position, scale(direction, owner.stats.radius + radius + 2)),
    velocity: scale(direction, speed),
    radius,
    damage: isChild ? mechanics.damage * 0.55 : mechanics.damage,
    lifetime: isChild ? Math.min(1.4, mechanics.lifetime) : mechanics.lifetime,
    bouncesLeft: isChild ? Math.min(1, mechanics.bounces) : mechanics.bounces,
    piercesLeft: isChild ? 0 : mechanics.pierces,
    splitCount: isChild ? 0 : mechanics.splitCount,
    childRadiusMultiplier: mechanics.childRadiusMultiplier,
    homingStrength: isChild ? mechanics.homingStrength * 0.5 : mechanics.homingStrength,
    hitBallIds: [],
    isChild
  };
  world.nextEntityId += 1;
  if (addToWorld) {
    world.projectiles.push(projectile);
  }
  return projectile;
}

function updateProjectiles(world: BattleWorldState, dt: number): void {
  const activeProjectiles: ProjectileState[] = [];
  const spawnedProjectiles: ProjectileState[] = [];

  for (const projectile of world.projectiles) {
    projectile.lifetime -= dt;
    if (projectile.lifetime <= 0) {
      continue;
    }

    steerProjectile(world, projectile, dt);
    projectile.position = add(projectile.position, scale(projectile.velocity, dt));
    if (!handleProjectileWallBounce(world, projectile)) {
      continue;
    }

    const owner = world.balls.find((ball) => ball.id === projectile.ownerId);
    if (!owner) {
      continue;
    }

    let keepProjectile = true;
    for (const target of world.balls) {
      if (!keepProjectile) {
        break;
      }
      if (!canProjectileHit(projectile, target)) {
        continue;
      }

      const dealtDamage = applyDamage(world, owner, target, projectile.damage, ["projectile"]);
      if (dealtDamage <= 0) {
        continue;
      }

      projectile.hitBallIds.push(target.id);
      if (projectile.splitCount > 0 && !projectile.isChild) {
        spawnedProjectiles.push(...splitProjectile(world, owner, projectile));
      }

      if (projectile.piercesLeft > 0) {
        projectile.piercesLeft -= 1;
      } else {
        keepProjectile = false;
      }
    }

    if (keepProjectile) {
      activeProjectiles.push(projectile);
    }
  }

  world.projectiles = activeProjectiles.concat(spawnedProjectiles);
}

function steerProjectile(world: BattleWorldState, projectile: ProjectileState, dt: number): void {
  if (projectile.homingStrength <= 0) {
    return;
  }
  const target = findNearestEnemy(world, projectile.team, projectile.position);
  if (!target) {
    return;
  }
  const speed = length(projectile.velocity);
  const currentDirection = normalize(projectile.velocity);
  const targetDirection = normalize(sub(target.position, projectile.position), currentDirection);
  const nextDirection = normalize(lerp(currentDirection, targetDirection, clamp(projectile.homingStrength * dt, 0, 1)), currentDirection);
  projectile.velocity = scale(nextDirection, speed);
}

function handleProjectileWallBounce(world: BattleWorldState, projectile: ProjectileState): boolean {
  let bounced = false;

  if (projectile.position.x < projectile.radius) {
    projectile.position.x = projectile.radius;
    projectile.velocity.x = Math.abs(projectile.velocity.x);
    bounced = true;
  } else if (projectile.position.x > world.arena.width - projectile.radius) {
    projectile.position.x = world.arena.width - projectile.radius;
    projectile.velocity.x = -Math.abs(projectile.velocity.x);
    bounced = true;
  }

  if (projectile.position.y < projectile.radius) {
    projectile.position.y = projectile.radius;
    projectile.velocity.y = Math.abs(projectile.velocity.y);
    bounced = true;
  } else if (projectile.position.y > world.arena.height - projectile.radius) {
    projectile.position.y = world.arena.height - projectile.radius;
    projectile.velocity.y = -Math.abs(projectile.velocity.y);
    bounced = true;
  }

  if (!bounced) {
    return true;
  }
  if (projectile.bouncesLeft <= 0) {
    return false;
  }

  projectile.bouncesLeft -= 1;
  world.events.push({
    type: "trait_triggered",
    tick: world.tick,
    ballId: projectile.ownerId,
    traitId: "ricochet_shot",
    trigger: "projectile_bounce",
    position: { ...projectile.position },
    value: projectile.bouncesLeft
  });
  return true;
}

function canProjectileHit(projectile: ProjectileState, target: BallState): boolean {
  return (
    target.alive &&
    target.team !== projectile.team &&
    !projectile.hitBallIds.includes(target.id) &&
    distance(projectile.position, target.position) <= projectile.radius + target.stats.radius
  );
}

function splitProjectile(world: BattleWorldState, owner: BallState, projectile: ProjectileState): ProjectileState[] {
  const childCount = Math.max(0, projectile.splitCount);
  if (childCount <= 0) {
    return [];
  }

  const children: ProjectileState[] = [];
  const baseDirection = normalize(projectile.velocity);
  const spreadDeg = 38;
  const spreadStep = childCount > 1 ? spreadDeg / (childCount - 1) : 0;
  const startAngle = childCount > 1 ? -spreadDeg / 2 : 0;

  for (let i = 0; i < childCount; i += 1) {
    const direction = rotate(baseDirection, degreesToRadians(startAngle + spreadStep * i));
    const child = spawnProjectile(world, owner, direction, true, false);
    child.position = { ...projectile.position };
    child.hitBallIds = [...projectile.hitBallIds];
    children.push(child);
  }

  world.events.push({
    type: "trait_triggered",
    tick: world.tick,
    ballId: owner.id,
    traitId: "split_shot",
    trigger: "projectile_split",
    position: { ...projectile.position },
    value: childCount
  });
  return children;
}

function steerToward(ball: BallState, target: BallState, dt: number, chaseStrength: number): void {
  const currentDirection = normalize(ball.velocity, { x: ball.team === "blue" ? 1 : -1, y: 0 });
  const targetDirection = normalize(sub(target.position, ball.position), currentDirection);
  const turn = clamp(chaseStrength * dt, 0, 1);
  const nextDirection = normalize(lerp(currentDirection, targetDirection, turn), currentDirection);
  ball.velocity = scale(nextDirection, ball.stats.moveSpeed);
}

function handleWallBounce(world: BattleWorldState, ball: BallState): void {
  const { arena } = world;
  let bounced = false;
  const minX = ball.stats.radius;
  const maxX = arena.width - ball.stats.radius;
  const minY = ball.stats.radius;
  const maxY = arena.height - ball.stats.radius;

  if (ball.position.x < minX) {
    ball.position.x = minX;
    ball.velocity.x = Math.abs(ball.velocity.x);
    bounced = true;
  } else if (ball.position.x > maxX) {
    ball.position.x = maxX;
    ball.velocity.x = -Math.abs(ball.velocity.x);
    bounced = true;
  }

  if (ball.position.y < minY) {
    ball.position.y = minY;
    ball.velocity.y = Math.abs(ball.velocity.y);
    bounced = true;
  } else if (ball.position.y > maxY) {
    ball.position.y = maxY;
    ball.velocity.y = -Math.abs(ball.velocity.y);
    bounced = true;
  }

  if (bounced) {
    world.events.push({
      type: "wall_bounce",
      tick: world.tick,
      ballId: ball.id,
      position: { ...ball.position }
    });
    gainWallCharge(world, ball);
  }
}

function resolveBallCollisions(world: BattleWorldState): void {
  for (let i = 0; i < world.balls.length; i += 1) {
    const a = world.balls[i];
    if (!a?.alive) {
      continue;
    }
    for (let j = i + 1; j < world.balls.length; j += 1) {
      const b = world.balls[j];
      if (!b?.alive || a.team === b.team) {
        continue;
      }
      resolvePairCollision(world, a, b);
    }
  }
}

function resolvePairCollision(world: BattleWorldState, a: BallState, b: BallState): void {
  const delta = sub(b.position, a.position);
  const minDistance = a.stats.radius + b.stats.radius;
  const currentDistance = Math.max(distance(a.position, b.position), 0.0001);
  if (currentDistance > minDistance) {
    return;
  }

  const normal = lengthSq(delta) <= 0.000001 ? world.rng.direction() : scale(delta, 1 / currentDistance);
  separateBalls(world, a, b, normal, minDistance - currentDistance);

  world.events.push({
    type: "collision",
    tick: world.tick,
    aId: a.id,
    bId: b.id,
    position: midpoint(a.position, b.position)
  });

  if (canDamagePair(a, b)) {
    const damageToB = applyDamage(world, a, b, getCollisionDamage(world, a), ["collision"]);
    const damageToA = applyDamage(world, b, a, getCollisionDamage(world, b), ["collision"]);
    applyLifesteal(world, a, damageToB);
    applyLifesteal(world, b, damageToA);
    applyReflect(world, b, a, damageToB);
    applyReflect(world, a, b, damageToA);
    triggerCollisionExplosion(world, a, midpoint(a.position, b.position));
    triggerCollisionExplosion(world, b, midpoint(a.position, b.position));
    a.collisionTimers[b.id] = a.stats.collisionCooldown;
    b.collisionTimers[a.id] = b.stats.collisionCooldown;
  }

  a.velocity = scale(normal, -a.stats.knockback);
  b.velocity = scale(normal, b.stats.knockback);
}

function separateBalls(world: BattleWorldState, a: BallState, b: BallState, normal: Vec2, overlap: number): void {
  const push = Math.max(0, overlap) / 2;
  a.position = add(a.position, scale(normal, -push));
  b.position = add(b.position, scale(normal, push));
  clampBallToArena(world, a);
  clampBallToArena(world, b);
}

function clampBallToArena(world: BattleWorldState, ball: BallState): void {
  ball.position.x = clamp(ball.position.x, ball.stats.radius, world.arena.width - ball.stats.radius);
  ball.position.y = clamp(ball.position.y, ball.stats.radius, world.arena.height - ball.stats.radius);
}

function canDamagePair(a: BallState, b: BallState): boolean {
  return (a.collisionTimers[b.id] ?? 0) <= 0 && (b.collisionTimers[a.id] ?? 0) <= 0;
}

function getCollisionDamage(world: BattleWorldState, source: BallState): number {
  const { wallChargeStacks } = source.runtime;
  const { wallChargeDamagePercentPerStack } = source.mechanics.collision;
  if (wallChargeStacks <= 0 || wallChargeDamagePercentPerStack <= 0) {
    return source.stats.collisionDamage;
  }

  world.events.push({
    type: "trait_triggered",
    tick: world.tick,
    ballId: source.id,
    traitId: "wall_charge",
    trigger: "collision_damage_bonus",
    position: { ...source.position },
    value: wallChargeStacks
  });
  source.runtime.wallChargeStacks = 0;
  return source.stats.collisionDamage * (1 + wallChargeStacks * wallChargeDamagePercentPerStack);
}

function applyDamage(
  world: BattleWorldState,
  source: BallState,
  target: BallState,
  amount: number,
  tags: DamageTag[]
): number {
  if (!target.alive) {
    return 0;
  }
  const finalAmount = Math.max(0, amount * (1 - clamp(target.stats.damageReduction, 0, 0.9)));
  if (finalAmount <= 0) {
    return 0;
  }
  target.hp = Math.max(0, target.hp - finalAmount);
  world.events.push({
    type: "damage",
    tick: world.tick,
    sourceId: source.id,
    targetId: target.id,
    amount: finalAmount,
    tags,
    position: { ...target.position }
  });
  if (target.hp <= 0) {
    target.alive = false;
  }
  return finalAmount;
}

function applyHeal(world: BattleWorldState, source: BallState, target: BallState, amount: number): number {
  if (!target.alive || amount <= 0) {
    return 0;
  }
  const finalAmount = Math.min(amount, target.stats.maxHp - target.hp);
  if (finalAmount <= 0) {
    return 0;
  }
  target.hp += finalAmount;
  world.events.push({
    type: "heal",
    tick: world.tick,
    sourceId: source.id,
    targetId: target.id,
    amount: finalAmount,
    position: { ...target.position }
  });
  return finalAmount;
}

function applyLifesteal(world: BattleWorldState, source: BallState, dealtDamage: number): void {
  const { lifestealRatio, healPerSecondLimit } = source.mechanics.collision;
  if (lifestealRatio <= 0 || healPerSecondLimit <= 0 || dealtDamage <= 0) {
    return;
  }

  if (world.time - source.runtime.lifestealWindowStart >= 1) {
    source.runtime.lifestealWindowStart = world.time;
    source.runtime.lifestealHealedInWindow = 0;
  }

  const remainingWindowHeal = Math.max(0, healPerSecondLimit - source.runtime.lifestealHealedInWindow);
  const healed = applyHeal(world, source, source, Math.min(dealtDamage * lifestealRatio, remainingWindowHeal));
  if (healed > 0) {
    source.runtime.lifestealHealedInWindow += healed;
    world.events.push({
      type: "trait_triggered",
      tick: world.tick,
      ballId: source.id,
      traitId: "lifesteal_collision",
      trigger: "collision_lifesteal",
      position: { ...source.position },
      value: healed
    });
  }
}

function applyReflect(world: BattleWorldState, defender: BallState, attacker: BallState, receivedDamage: number): void {
  const { reflectRatio } = defender.mechanics.collision;
  if (reflectRatio <= 0 || receivedDamage <= 0) {
    return;
  }

  const reflected = applyDamage(world, defender, attacker, receivedDamage * reflectRatio, ["reflect"]);
  if (reflected > 0) {
    world.events.push({
      type: "trait_triggered",
      tick: world.tick,
      ballId: defender.id,
      traitId: "spike_reflect",
      trigger: "collision_reflect",
      position: { ...defender.position },
      value: reflected
    });
  }
}

function triggerCollisionExplosion(world: BattleWorldState, source: BallState, position: Vec2): void {
  const { explosionDamage, explosionRadius, explosionCooldown } = source.mechanics.collision;
  if (explosionDamage <= 0 || explosionRadius <= 0 || source.runtime.collisionExplosionCooldown > 0) {
    return;
  }

  source.runtime.collisionExplosionCooldown = explosionCooldown;
  world.events.push({
    type: "trait_triggered",
    tick: world.tick,
    ballId: source.id,
    traitId: "collision_burst",
    trigger: "collision_explosion",
    position: { ...position },
    value: explosionDamage
  });

  for (const target of world.balls) {
    if (!target.alive || target.team === source.team || distance(target.position, position) > explosionRadius) {
      continue;
    }
    applyDamage(world, source, target, explosionDamage, ["explosion"]);
  }
}

function gainWallCharge(world: BattleWorldState, ball: BallState): void {
  const { wallChargeMaxStacks } = ball.mechanics.collision;
  if (wallChargeMaxStacks <= 0) {
    return;
  }
  const nextStacks = Math.min(wallChargeMaxStacks, ball.runtime.wallChargeStacks + 1);
  if (nextStacks === ball.runtime.wallChargeStacks) {
    return;
  }
  ball.runtime.wallChargeStacks = nextStacks;
  world.events.push({
    type: "trait_triggered",
    tick: world.tick,
    ballId: ball.id,
    traitId: "wall_charge",
    trigger: "wall_bounce_charge",
    position: { ...ball.position },
    value: nextStacks
  });
}

function checkBattleEnd(world: BattleWorldState): void {
  if (world.result) {
    return;
  }
  const blueAlive = hasMainAlive(world, "blue");
  const redAlive = hasMainAlive(world, "red");

  if (blueAlive && redAlive) {
    return;
  }

  if (!blueAlive && !redAlive) {
    setResult(world, {
      winner: "draw",
      reason: "double_ko",
      duration: world.time,
      blueRemainingHp: remainingHp(world, "blue"),
      redRemainingHp: remainingHp(world, "red")
    });
    return;
  }

  setResult(world, {
    winner: blueAlive ? "blue" : "red",
    reason: "main_ball_dead",
    duration: world.time,
    blueRemainingHp: remainingHp(world, "blue"),
    redRemainingHp: remainingHp(world, "red")
  });
}

function setResult(world: BattleWorldState, result: BattleResult): void {
  world.result = result;
  world.events.push({
    type: "match_end",
    tick: world.tick,
    result
  });
}

function findTarget(world: BattleWorldState, ball: BallState): BallState | undefined {
  return world.balls.find((candidate) => candidate.alive && candidate.team !== ball.team && candidate.role === "main");
}

function findNearestEnemy(world: BattleWorldState, team: Team, position: Vec2): BallState | undefined {
  let nearest: BallState | undefined;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of world.balls) {
    if (!candidate.alive || candidate.team === team) {
      continue;
    }
    const currentDistance = distance(position, candidate.position);
    if (currentDistance < nearestDistance) {
      nearest = candidate;
      nearestDistance = currentDistance;
    }
  }
  return nearest;
}

function hasMainAlive(world: BattleWorldState, team: Team): boolean {
  return world.balls.some((ball) => ball.team === team && ball.role === "main" && ball.alive);
}

function remainingHp(world: BattleWorldState, team: Team): number {
  return world.balls
    .filter((ball) => ball.team === team && ball.alive)
    .reduce((total, ball) => total + ball.hp, 0);
}

function midpoint(a: Vec2, b: Vec2): Vec2 {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function rotate(v: Vec2, radians: number): Vec2 {
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return {
    x: v.x * cos - v.y * sin,
    y: v.x * sin + v.y * cos
  };
}

function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}
