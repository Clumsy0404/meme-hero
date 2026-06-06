import type { BallStats, Team, Vec2 } from "@ball-brawl/shared";

import { add, clamp, distance, length, lengthSq, lerp, normalize, scale, sub } from "../math/vector";
import { createRuntimeState } from "./build-mechanics";
import type {
  BallMechanics,
  BallState,
  BattleResult,
  BattleWorldState,
  DamageTag,
  ProjectileKind,
  ProjectileState,
  StatusApplicationMechanics,
  TurretState
} from "./types";

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
  updateStatuses(world, dt);
  processDeaths(world);
  checkBattleEnd(world);
  if (world.result) {
    return world;
  }

  updateRules(world, dt);
  updateSpecials(world, dt);
  updateBalls(world, dt, chaseStrength);
  applySpecialBlackHandDrag(world, dt);
  updateSummons(world);
  fireProjectiles(world);
  fireSpecialBasketballs(world);
  fireSpecialHuaqiang(world);
  updateTurrets(world, dt);
  updateProjectiles(world, dt);
  resolveSpecialBladeShieldCollisions(world);
  resolveSpecialElbowCollisions(world);
  resolveBallCollisions(world);
  processDeaths(world);
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
    ball.runtime.cloneCooldown = Math.max(0, ball.runtime.cloneCooldown - dt);
    ball.runtime.turretCooldown = Math.max(0, ball.runtime.turretCooldown - dt);
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

function updateSummons(world: BattleWorldState): void {
  const activeMainBalls = world.balls.filter((ball) => ball.alive && ball.role === "main");

  for (const ball of activeMainBalls) {
    const mechanics = ball.mechanics.summon;
    if (
      mechanics.maxClones > 0 &&
      mechanics.cloneCooldown > 0 &&
      ball.runtime.cloneCooldown <= 0 &&
      countOwnedBalls(world, ball, "clone") < mechanics.maxClones
    ) {
      spawnClone(world, ball);
      ball.runtime.cloneCooldown = mechanics.cloneCooldown;
    }

    if (
      mechanics.turretLimit > 0 &&
      mechanics.turretCooldown > 0 &&
      mechanics.turretLifetime > 0 &&
      ball.runtime.turretCooldown <= 0 &&
      countOwnedTurrets(world, ball) < mechanics.turretLimit
    ) {
      spawnTurret(world, ball);
      ball.runtime.turretCooldown = mechanics.turretCooldown;
    }
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

function updateTurrets(world: BattleWorldState, dt: number): void {
  const activeTurrets: TurretState[] = [];

  for (const turret of world.turrets) {
    if (!turret.alive) {
      continue;
    }

    turret.lifetime -= dt;
    turret.projectileCooldown = Math.max(0, turret.projectileCooldown - dt);
    if (turret.lifetime <= 0 || turret.hp <= 0) {
      continue;
    }

    const owner = world.balls.find((ball) => ball.id === turret.ownerId);
    if (owner && turret.projectileCooldown <= 0) {
      const target = findNearestEnemyCombatant(world, turret.team, turret.position);
      if (target) {
        spawnTurretProjectile(world, owner, turret, target);
        turret.projectileCooldown = owner.mechanics.summon.turretProjectileCooldown;
      }
    }

    activeTurrets.push(turret);
  }

  world.turrets = activeTurrets;
}

function spawnProjectile(
  world: BattleWorldState,
  owner: BallState,
  direction: Vec2,
  isChild: boolean,
  addToWorld = true,
  kind: ProjectileKind = isChild ? "child" : "basic"
): ProjectileState {
  const mechanics = owner.mechanics.projectile;
  const radius = isChild ? mechanics.radius * mechanics.childRadiusMultiplier : mechanics.radius;
  const speed = isChild ? mechanics.speed * 0.82 : mechanics.speed;
  const projectile: ProjectileState = {
    id: `projectile-${world.nextEntityId}`,
    team: owner.team,
    ownerId: owner.id,
    kind,
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

function spawnTurretProjectile(world: BattleWorldState, owner: BallState, turret: TurretState, target: BallState): ProjectileState {
  const mechanics = owner.mechanics.summon;
  const direction = normalize(sub(target.position, turret.position), { x: owner.team === "blue" ? 1 : -1, y: 0 });
  const projectile: ProjectileState = {
    id: `projectile-${world.nextEntityId}`,
    team: turret.team,
    ownerId: owner.id,
    kind: "turret",
    position: add(turret.position, scale(direction, turret.radius + mechanics.turretProjectileRadius + 2)),
    velocity: scale(direction, mechanics.turretProjectileSpeed),
    radius: mechanics.turretProjectileRadius,
    damage: mechanics.turretProjectileDamage,
    lifetime: mechanics.turretProjectileLifetime,
    bouncesLeft: 0,
    piercesLeft: 0,
    splitCount: 0,
    childRadiusMultiplier: 1,
    homingStrength: 0,
    hitBallIds: [],
    isChild: false
  };
  world.nextEntityId += 1;
  world.projectiles.push(projectile);
  world.events.push({
    type: "trait_triggered",
    tick: world.tick,
    ballId: owner.id,
    traitId: "auto_turret",
    trigger: "turret_fire",
    position: { ...turret.position }
  });
  return projectile;
}

function spawnBasketballProjectile(world: BattleWorldState, owner: BallState, direction: Vec2): ProjectileState {
  const mechanics = owner.mechanics.special;
  const radius = mechanics.basketballRadius;
  const projectile: ProjectileState = {
    id: `projectile-${world.nextEntityId}`,
    team: owner.team,
    ownerId: owner.id,
    kind: "basketball",
    position: add(owner.position, scale(direction, owner.stats.radius + radius + 2)),
    velocity: scale(direction, mechanics.basketballSpeed),
    radius,
    damage: mechanics.basketballDamage,
    lifetime: mechanics.basketballLifetime,
    bouncesLeft: mechanics.basketballBounces,
    piercesLeft: 0,
    splitCount: 0,
    childRadiusMultiplier: 1,
    homingStrength: 0,
    hitBallIds: [],
    isChild: false
  };
  world.nextEntityId += 1;
  world.projectiles.push(projectile);
  return projectile;
}

function spawnHuaqiangProjectile(
  world: BattleWorldState,
  owner: BallState,
  direction: Vec2,
  kind: "melon" | "melon_knife"
): ProjectileState {
  const mechanics = owner.mechanics.special;
  const isMelon = kind === "melon";
  const radius = isMelon ? mechanics.huaqiangMelonRadius : mechanics.huaqiangKnifeRadius;
  const projectile: ProjectileState = {
    id: `projectile-${world.nextEntityId}`,
    team: owner.team,
    ownerId: owner.id,
    kind,
    position: add(owner.position, scale(direction, owner.stats.radius + radius + 2)),
    velocity: scale(direction, isMelon ? mechanics.huaqiangMelonSpeed : mechanics.huaqiangKnifeSpeed),
    radius,
    damage: isMelon ? mechanics.huaqiangMelonDamage : mechanics.huaqiangKnifeDamage,
    lifetime: isMelon ? mechanics.huaqiangMelonLifetime : mechanics.huaqiangKnifeLifetime,
    bouncesLeft: 0,
    piercesLeft: 0,
    splitCount: 0,
    childRadiusMultiplier: 1,
    homingStrength: 0,
    hitBallIds: [],
    isChild: false
  };
  world.nextEntityId += 1;
  world.projectiles.push(projectile);
  return projectile;
}

function updateProjectiles(world: BattleWorldState, dt: number): void {
  const activeProjectiles: ProjectileState[] = [];
  const spawnedProjectiles: ProjectileState[] = [];

  for (const projectile of world.projectiles) {
    projectile.lifetime -= dt;
    if (projectile.lifetime <= 0) {
      if (projectile.kind === "melon") {
        triggerHuaqiangMelonSplash(world, projectile);
      }
      continue;
    }

    steerProjectile(world, projectile, dt);
    projectile.position = add(projectile.position, scale(projectile.velocity, dt));
    if (!handleProjectileWallBounce(world, projectile)) {
      if (projectile.kind === "melon") {
        triggerHuaqiangMelonSplash(world, projectile);
      }
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

      applyDamage(world, owner, target, projectile.damage, getProjectileDamageTags(projectile));
      if (shouldApplyProjectileOnHitStatuses(projectile)) {
        applyOnHitStatuses(world, owner, target);
      }
      triggerProjectileHitEvent(world, projectile);
      projectile.hitBallIds.push(target.id);
      if (projectile.kind === "melon") {
        triggerHuaqiangMelonSplash(world, projectile);
        keepProjectile = false;
        break;
      }
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

function getProjectileDamageTags(projectile: ProjectileState): DamageTag[] {
  return projectile.kind === "basketball" || projectile.kind === "melon" || projectile.kind === "melon_knife"
    ? ["projectile", "special"]
    : ["projectile"];
}

function shouldApplyProjectileOnHitStatuses(projectile: ProjectileState): boolean {
  return projectile.kind !== "basketball" && projectile.kind !== "melon" && projectile.kind !== "melon_knife";
}

function triggerProjectileHitEvent(world: BattleWorldState, projectile: ProjectileState): void {
  if (projectile.kind === "basketball") {
    world.events.push({
      type: "trait_triggered",
      tick: world.tick,
      ballId: projectile.ownerId,
      traitId: "special_bounce_basketball",
      trigger: "basketball_hit",
      position: { ...projectile.position },
      value: projectile.damage
    });
    return;
  }

  if (projectile.kind === "melon" || projectile.kind === "melon_knife") {
    world.events.push({
      type: "trait_triggered",
      tick: world.tick,
      ballId: projectile.ownerId,
      traitId: "special_huaqiang_melon",
      trigger: projectile.kind === "melon" ? "huaqiang_melon_hit" : "huaqiang_knife_hit",
      position: { ...projectile.position },
      value: projectile.damage
    });
  }
}

function triggerHuaqiangMelonSplash(world: BattleWorldState, projectile: ProjectileState): void {
  const owner = world.balls.find((ball) => ball.id === projectile.ownerId);
  const splashDamage = owner?.mechanics.special.huaqiangMelonSplashDamage ?? 0;
  const splashRadius = owner?.mechanics.special.huaqiangMelonSplashRadius ?? 0;
  if (!owner || splashDamage <= 0 || splashRadius <= 0) {
    return;
  }

  world.events.push({
    type: "trait_triggered",
    tick: world.tick,
    ballId: owner.id,
    traitId: "special_huaqiang_melon",
    trigger: "huaqiang_melon_crack",
    position: { ...projectile.position },
    value: splashDamage
  });

  for (const target of world.balls) {
    if (!target.alive || target.team === projectile.team || distance(target.position, projectile.position) > splashRadius + target.stats.radius) {
      continue;
    }
    applyDamage(world, owner, target, splashDamage, ["explosion", "special"]);
  }
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
    traitId: projectile.kind === "basketball" ? "special_bounce_basketball" : "ricochet_shot",
    trigger: projectile.kind === "basketball" ? "basketball_bounce" : "projectile_bounce",
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
  const elbowActive = isSpecialElbowActive(ball);
  if (elbowActive) {
    ball.runtime.specialElbowDirection = targetDirection;
  }
  const turnMultiplier = elbowActive ? Math.max(1, ball.mechanics.special.elbowDashTurnMultiplier) : 1;
  const turnStrength = elbowActive ? Math.max(chaseStrength, DEFAULT_CHASE_STRENGTH) : chaseStrength;
  const turn = clamp(turnStrength * turnMultiplier * dt, 0, 1);
  const nextDirection = normalize(lerp(currentDirection, targetDirection, turn), currentDirection);
  ball.velocity = scale(nextDirection, getEffectiveMoveSpeed(ball));
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

function resolveSpecialBladeShieldCollisions(world: BattleWorldState): void {
  for (const source of world.balls) {
    if (!isBladeShieldBladeActive(source) || source.stats.collisionDamage <= 0) {
      continue;
    }

    const bladeRange = source.stats.radius * source.mechanics.special.bladeShieldRangeMultiplier;
    if (bladeRange <= source.stats.radius) {
      continue;
    }

    let nearestTarget: BallState | undefined;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const target of world.balls) {
      if (!target.alive || target.team === source.team || !canDamagePair(source, target)) {
        continue;
      }
      const currentDistance = distance(source.position, target.position);
      const bodyCollisionDistance = source.stats.radius + target.stats.radius;
      const bladeHitDistance = bladeRange + target.stats.radius;
      if (currentDistance > bodyCollisionDistance && currentDistance <= bladeHitDistance && currentDistance < nearestDistance) {
        nearestTarget = target;
        nearestDistance = currentDistance;
      }
    }

    if (nearestTarget) {
      applySpecialBladeShieldHit(world, source, nearestTarget);
    }
  }
}

function resolveSpecialElbowCollisions(world: BattleWorldState): void {
  for (const source of world.balls) {
    if (!canSpecialElbowHit(source)) {
      continue;
    }

    const hitbox = getSpecialElbowHitbox(source);
    if (!hitbox) {
      continue;
    }

    let nearestTarget: BallState | undefined;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const target of world.balls) {
      if (!target.alive || target.team === source.team || !canDamagePair(source, target)) {
        continue;
      }
      const currentDistance = distanceToBentElbowHitbox(target.position, hitbox);
      if (currentDistance <= target.stats.radius + hitbox.radius && currentDistance < nearestDistance) {
        nearestTarget = target;
        nearestDistance = currentDistance;
      }
    }

    if (nearestTarget) {
      applySpecialElbowHit(world, source, nearestTarget);
    }
  }
}

function applySpecialBladeShieldHit(world: BattleWorldState, source: BallState, target: BallState): void {
  const attack = getSpecialCollisionAttack(world, source, getCollisionDamage(world, source));
  let defense = applyHajimiGuard(world, target, attack.damage);
  defense = applyBladeShieldCollisionDefense(world, target, defense);
  const damageToTarget = applyDamage(world, source, target, defense.damage, ["collision", "special"]);
  applyOnHitStatuses(world, source, target);
  applyLifesteal(world, source, damageToTarget);
  applyReflect(world, target, source, damageToTarget);
  triggerCollisionExplosion(world, source, { ...target.position });
  source.collisionTimers[target.id] = source.stats.collisionCooldown;
  target.collisionTimers[source.id] = target.stats.collisionCooldown;

  const direction = normalize(sub(target.position, source.position), normalize(source.velocity, { x: source.team === "blue" ? 1 : -1, y: 0 }));
  target.velocity = scale(direction, target.stats.knockback * attack.knockbackMultiplier * defense.selfKnockbackMultiplier);
  source.velocity = scale(direction, getEffectiveMoveSpeed(source) * 0.75);
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

  let attackA = { damage: 0, knockbackMultiplier: 1 };
  let attackB = { damage: 0, knockbackMultiplier: 1 };
  let defenseA = { damage: attackB.damage, selfKnockbackMultiplier: 1, attackerKnockbackMultiplier: 1 };
  let defenseB = { damage: attackA.damage, selfKnockbackMultiplier: 1, attackerKnockbackMultiplier: 1 };

  if (canDamagePair(a, b)) {
    attackA = getSpecialCollisionAttack(world, a, getCollisionDamage(world, a));
    attackB = getSpecialCollisionAttack(world, b, getCollisionDamage(world, b));
    defenseB = applyHajimiGuard(world, b, attackA.damage);
    defenseA = applyHajimiGuard(world, a, attackB.damage);
    defenseB = applyBladeShieldCollisionDefense(world, b, defenseB);
    defenseA = applyBladeShieldCollisionDefense(world, a, defenseA);
    const damageToB = applyDamage(world, a, b, defenseB.damage, ["collision"]);
    const damageToA = applyDamage(world, b, a, defenseA.damage, ["collision"]);
    applyOnHitStatuses(world, a, b);
    applyOnHitStatuses(world, b, a);
    applyLifesteal(world, a, damageToB);
    applyLifesteal(world, b, damageToA);
    applyReflect(world, b, a, damageToB);
    applyReflect(world, a, b, damageToA);
    triggerCollisionExplosion(world, a, midpoint(a.position, b.position));
    triggerCollisionExplosion(world, b, midpoint(a.position, b.position));
    a.collisionTimers[b.id] = a.stats.collisionCooldown;
    b.collisionTimers[a.id] = b.stats.collisionCooldown;
  }

  const knockbackToA = a.stats.knockback * attackB.knockbackMultiplier * defenseA.selfKnockbackMultiplier * defenseB.attackerKnockbackMultiplier;
  const knockbackToB = b.stats.knockback * attackA.knockbackMultiplier * defenseB.selfKnockbackMultiplier * defenseA.attackerKnockbackMultiplier;
  a.velocity = scale(normal, -knockbackToA);
  b.velocity = scale(normal, knockbackToB);
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
  const baseDamage = source.stats.collisionDamage * getRuleCollisionDamageMultiplier(source);
  const { wallChargeStacks } = source.runtime;
  const { wallChargeDamagePercentPerStack } = source.mechanics.collision;
  if (wallChargeStacks <= 0 || wallChargeDamagePercentPerStack <= 0) {
    return baseDamage;
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
  return baseDamage * (1 + wallChargeStacks * wallChargeDamagePercentPerStack);
}

function getSpecialCollisionAttack(
  world: BattleWorldState,
  source: BallState,
  damage: number
): { damage: number; knockbackMultiplier: number } {
  const { elbowCooldown, elbowDamageMultiplier, elbowKnockbackMultiplier } = source.mechanics.special;
  if (source.role !== "main" || damage <= 0) {
    return { damage, knockbackMultiplier: 1 };
  }

  if (elbowCooldown > 0 && canSpecialElbowHit(source)) {
    source.runtime.specialElbowHitAvailable = false;
    world.events.push({
      type: "trait_triggered",
      tick: world.tick,
      ballId: source.id,
      traitId: "special_elbow_strike",
      trigger: "elbow_hit",
      position: { ...source.position },
      value: elbowDamageMultiplier
    });

    return {
      damage: damage * elbowDamageMultiplier,
      knockbackMultiplier: elbowKnockbackMultiplier
    };
  }

  if (isBladeShieldBladeActive(source)) {
    const multiplier = source.mechanics.special.bladeShieldBladeDamageMultiplier;
    world.events.push({
      type: "trait_triggered",
      tick: world.tick,
      ballId: source.id,
      traitId: "special_blade_shield_stance",
      trigger: "blade_shield_hit",
      position: { ...source.position },
      value: multiplier
    });
    return {
      damage: damage * multiplier,
      knockbackMultiplier: 1
    };
  }

  return { damage, knockbackMultiplier: 1 };
}

function applySpecialElbowHit(world: BattleWorldState, source: BallState, target: BallState): void {
  const attack = getSpecialCollisionAttack(world, source, getCollisionDamage(world, source));
  let defense = applyHajimiGuard(world, target, attack.damage);
  defense = applyBladeShieldCollisionDefense(world, target, defense);
  const damageToTarget = applyDamage(world, source, target, defense.damage, ["collision", "special"]);
  applyOnHitStatuses(world, source, target);
  applyLifesteal(world, source, damageToTarget);
  applyReflect(world, target, source, damageToTarget);
  triggerCollisionExplosion(world, source, { ...target.position });
  source.collisionTimers[target.id] = source.stats.collisionCooldown;
  target.collisionTimers[source.id] = target.stats.collisionCooldown;

  const direction = normalize(sub(target.position, source.position), getSpecialElbowDirection(source));
  target.velocity = scale(direction, target.stats.knockback * attack.knockbackMultiplier * defense.selfKnockbackMultiplier);
  source.velocity =
    defense.attackerKnockbackMultiplier > 1
      ? scale(direction, -source.stats.knockback * defense.attackerKnockbackMultiplier)
      : scale(direction, getEffectiveMoveSpeed(source) * 0.85);
}

function applyHajimiGuard(
  world: BattleWorldState,
  target: BallState,
  incomingDamage: number
): { damage: number; selfKnockbackMultiplier: number; attackerKnockbackMultiplier: number } {
  const { hajimiCollisionReduction, hajimiSelfKnockbackMultiplier, hajimiAttackerKnockbackMultiplier } = target.mechanics.special;
  if (target.role !== "main" || incomingDamage <= 0 || hajimiCollisionReduction <= 0 || target.runtime.specialHajimiGuardRemaining <= 0) {
    return { damage: incomingDamage, selfKnockbackMultiplier: 1, attackerKnockbackMultiplier: 1 };
  }

  target.runtime.specialHajimiGuardRemaining = 0;
  world.events.push({
    type: "trait_triggered",
    tick: world.tick,
    ballId: target.id,
    traitId: "special_hajimi_guard",
    trigger: "hajimi_guard_consume",
    position: { ...target.position },
    value: incomingDamage * hajimiCollisionReduction
  });

  return {
    damage: incomingDamage * (1 - hajimiCollisionReduction),
    selfKnockbackMultiplier: hajimiSelfKnockbackMultiplier,
    attackerKnockbackMultiplier: hajimiAttackerKnockbackMultiplier
  };
}

function applyBladeShieldCollisionDefense(
  world: BattleWorldState,
  target: BallState,
  defense: { damage: number; selfKnockbackMultiplier: number; attackerKnockbackMultiplier: number }
): { damage: number; selfKnockbackMultiplier: number; attackerKnockbackMultiplier: number } {
  if (!isBladeShieldShieldActive(target)) {
    return defense;
  }

  const knockbackMultiplier = target.mechanics.special.bladeShieldKnockbackMultiplier;
  if (knockbackMultiplier > 1) {
    world.events.push({
      type: "trait_triggered",
      tick: world.tick,
      ballId: target.id,
      traitId: "special_blade_shield_stance",
      trigger: "blade_shield_guard_block",
      position: { ...target.position },
      value: knockbackMultiplier
    });
  }

  return {
    ...defense,
    attackerKnockbackMultiplier: defense.attackerKnockbackMultiplier * knockbackMultiplier
  };
}

function applyDamage(
  world: BattleWorldState,
  source: BallState | undefined,
  target: BallState,
  amount: number,
  tags: DamageTag[]
): number {
  if (!target.alive) {
    return 0;
  }
  const vulnerableMultiplier = 1 + getVulnerablePercent(target);
  const statReducedAmount = Math.max(0, amount * vulnerableMultiplier * (1 - clamp(target.stats.damageReduction, 0, 0.9)));
  const reducedAmount = applyBladeShieldDamageReduction(world, target, statReducedAmount, tags);
  const absorbedAmount = absorbShield(world, target, reducedAmount);
  const finalAmount = Math.max(0, reducedAmount - absorbedAmount);
  if (finalAmount <= 0) {
    return 0;
  }
  target.hp = Math.max(0, target.hp - finalAmount);
  world.events.push({
    type: "damage",
    tick: world.tick,
    ...(source ? { sourceId: source.id } : {}),
    targetId: target.id,
    amount: finalAmount,
    tags,
    position: { ...target.position }
  });
  if (target.hp <= 0) {
    target.alive = false;
    target.runtime.deathDamageTags = tags;
    target.runtime.lastDamageSourceId = source?.id ?? null;
  }
  return finalAmount;
}

function applyBladeShieldDamageReduction(world: BattleWorldState, target: BallState, amount: number, tags: DamageTag[]): number {
  const reduction = target.mechanics.special.bladeShieldDamageReduction;
  if (!isBladeShieldShieldActive(target) || reduction <= 0 || amount <= 0) {
    return amount;
  }

  const reducedAmount = amount * (1 - clamp(reduction, 0, 0.9));
  if (!tags.includes("dot")) {
    world.events.push({
      type: "trait_triggered",
      tick: world.tick,
      ballId: target.id,
      traitId: "special_blade_shield_stance",
      trigger: "blade_shield_guard_reduce",
      position: { ...target.position },
      value: amount - reducedAmount
    });
  }
  return reducedAmount;
}

function updateStatuses(world: BattleWorldState, dt: number): void {
  for (const ball of world.balls) {
    if (!ball.alive) {
      continue;
    }

    updateShieldCycle(world, ball, dt);

    const activeStatuses: BallState["runtime"]["statuses"] = [];
    for (const status of ball.runtime.statuses) {
      if (status.remaining <= 0) {
        continue;
      }

      if (status.tickDamage > 0) {
        const source = world.balls.find((candidate) => candidate.id === status.sourceId);
        applyDamage(world, source, ball, status.tickDamage * dt, ["dot"]);
      }

      status.remaining -= dt;
      if (status.remaining > 0 && ball.alive) {
        activeStatuses.push(status);
      }
      if (!ball.alive) {
        break;
      }
    }

    ball.runtime.statuses = activeStatuses;
  }
}

function updateShieldCycle(world: BattleWorldState, ball: BallState, dt: number): void {
  const { shieldValue, shieldCooldown } = ball.mechanics.status;
  if (shieldValue <= 0 || shieldCooldown <= 0) {
    return;
  }

  ball.runtime.shieldCooldown = Math.max(0, ball.runtime.shieldCooldown - dt);
  if (ball.runtime.shieldCooldown > 0) {
    return;
  }

  const previousShield = ball.runtime.shield;
  ball.runtime.shield = Math.max(ball.runtime.shield, shieldValue);
  ball.runtime.shieldCooldown = shieldCooldown;

  if (ball.runtime.shield > previousShield) {
    world.events.push({
      type: "trait_triggered",
      tick: world.tick,
      ballId: ball.id,
      traitId: "shield_cycle",
      trigger: "shield_refresh",
      position: { ...ball.position },
      value: ball.runtime.shield
    });
  }
}

function absorbShield(world: BattleWorldState, target: BallState, amount: number): number {
  if (target.runtime.shield <= 0 || amount <= 0) {
    return 0;
  }

  const absorbed = Math.min(target.runtime.shield, amount);
  target.runtime.shield -= absorbed;
  world.events.push({
    type: "trait_triggered",
    tick: world.tick,
    ballId: target.id,
    traitId: "shield_cycle",
    trigger: "shield_absorb",
    position: { ...target.position },
    value: absorbed
  });
  return absorbed;
}

function applyOnHitStatuses(world: BattleWorldState, source: BallState, target: BallState): void {
  if (!target.alive || source.mechanics.status.onHit.length === 0) {
    return;
  }

  for (const status of source.mechanics.status.onHit) {
    applyStatusEffect(world, source, target, status);
  }
}

function applyStatusEffect(
  world: BattleWorldState,
  source: BallState,
  target: BallState,
  status: StatusApplicationMechanics
): void {
  if (status.duration <= 0 || world.rng.next() > clamp(status.chance, 0, 1)) {
    return;
  }

  const existing = target.runtime.statuses.find((activeStatus) => activeStatus.id === status.statusId);
  if (existing) {
    existing.traitId = status.traitId;
    existing.sourceId = source.id;
    existing.remaining = Math.max(existing.remaining, status.duration);
    existing.tickDamage = Math.max(existing.tickDamage, status.tickDamage);
    existing.slowPercent = Math.max(existing.slowPercent, status.slowPercent);
    existing.vulnerablePercent = Math.max(existing.vulnerablePercent, status.vulnerablePercent);
  } else {
    target.runtime.statuses.push({
      id: status.statusId,
      traitId: status.traitId,
      sourceId: source.id,
      remaining: status.duration,
      tickDamage: status.tickDamage,
      slowPercent: status.slowPercent,
      vulnerablePercent: status.vulnerablePercent
    });
  }

  world.events.push({
    type: "trait_triggered",
    tick: world.tick,
    ballId: source.id,
    traitId: status.traitId,
    trigger: "status_apply",
    position: { ...target.position },
    value: status.duration
  });
}

function getEffectiveMoveSpeed(ball: BallState): number {
  const elbowSpeedMultiplier = isSpecialElbowActive(ball) ? Math.max(1, ball.mechanics.special.elbowDashSpeedMultiplier) : 1;
  const bladeShieldSpeedMultiplier = isBladeShieldShieldActive(ball) ? ball.mechanics.special.bladeShieldMoveSpeedMultiplier : 1;
  return ball.stats.moveSpeed * getRuleMoveSpeedMultiplier(ball) * (1 - getMaxStatusValue(ball, "slowPercent", 1)) * elbowSpeedMultiplier * bladeShieldSpeedMultiplier;
}

function isBladeShieldBladeActive(ball: BallState): boolean {
  return (
    ball.alive &&
    ball.role === "main" &&
    ball.runtime.specialBladeShieldStance === "blade" &&
    ball.mechanics.special.bladeShieldBladeDuration > 0 &&
    ball.mechanics.special.bladeShieldBladeDamageMultiplier > 1
  );
}

function isBladeShieldShieldActive(ball: BallState): boolean {
  return (
    ball.alive &&
    ball.role === "main" &&
    ball.runtime.specialBladeShieldStance === "shield" &&
    ball.mechanics.special.bladeShieldShieldDuration > 0
  );
}

function isSpecialElbowActive(ball: BallState): boolean {
  return (
    ball.alive &&
    ball.role === "main" &&
    ball.runtime.specialElbowWindowRemaining > 0 &&
    ball.mechanics.special.elbowCooldown > 0 &&
    ball.mechanics.special.elbowWindow > 0 &&
    ball.mechanics.special.elbowDamageMultiplier > 1
  );
}

function canSpecialElbowHit(ball: BallState): boolean {
  return isSpecialElbowActive(ball) && ball.runtime.specialElbowHitAvailable;
}

function refreshSpecialElbowDirection(world: BattleWorldState, ball: BallState): void {
  const target = findTarget(world, ball);
  if (!target) {
    return;
  }
  ball.runtime.specialElbowDirection = normalize(
    sub(target.position, ball.position),
    normalize(ball.velocity, { x: ball.team === "blue" ? 1 : -1, y: 0 })
  );
}

function getSpecialElbowDirection(ball: BallState): Vec2 {
  return normalize(ball.runtime.specialElbowDirection, normalize(ball.velocity, { x: ball.team === "blue" ? 1 : -1, y: 0 }));
}

function getSpecialElbowHitbox(ball: BallState): { root: Vec2; joint: Vec2; foldEnd: Vec2; radius: number } | undefined {
  const { elbowHitboxRangeMultiplier, elbowHitboxRadiusMultiplier } = ball.mechanics.special;
  const reach = ball.stats.radius * elbowHitboxRangeMultiplier;
  const radius = ball.stats.radius * elbowHitboxRadiusMultiplier;
  if (reach <= 0 || radius <= 0) {
    return undefined;
  }

  const direction = getSpecialElbowDirection(ball);
  const bendSide = ball.team === "blue" ? -1 : 1;
  const normal = scale({ x: -direction.y, y: direction.x }, bendSide);
  const root = add(ball.position, add(scale(direction, ball.stats.radius * 0.42), scale(normal, ball.stats.radius * 0.18)));
  const joint = add(ball.position, add(scale(direction, ball.stats.radius + reach * 0.72), scale(normal, ball.stats.radius * 0.52)));
  const foldEnd = add(ball.position, add(scale(direction, ball.stats.radius + reach * 0.34), scale(normal, ball.stats.radius * 1.18)));
  return {
    root,
    joint,
    foldEnd,
    radius
  };
}

function getVulnerablePercent(ball: BallState): number {
  return getMaxStatusValue(ball, "vulnerablePercent", 1);
}

function getMaxStatusValue(ball: BallState, key: "slowPercent" | "vulnerablePercent", maxValue: number): number {
  return clamp(
    ball.runtime.statuses.reduce((highest, status) => Math.max(highest, status[key]), 0),
    0,
    maxValue
  );
}

function updateRules(world: BattleWorldState, dt: number): void {
  for (const ball of world.balls) {
    if (!ball.alive) {
      continue;
    }

    if (ball.runtime.lowHpRageRemaining > 0) {
      ball.runtime.lowHpRageRemaining = Math.max(0, ball.runtime.lowHpRageRemaining - dt);
    }

    triggerLowHpRage(world, ball);
    updateTimeGrowth(world, ball, dt);
  }
}

function updateSpecials(world: BattleWorldState, dt: number): void {
  for (const ball of world.balls) {
    if (!ball.alive || ball.role !== "main") {
      continue;
    }

    updateSpecialBladeShield(world, ball, dt);
    updateSpecialElbow(world, ball, dt);
    updateSpecialHajimiGuard(world, ball, dt);
    updateSpecialTigerGaze(world, ball, dt);
    updateSpecialBlackHand(world, ball, dt);

    if (ball.mechanics.special.basketballCooldown > 0) {
      ball.runtime.specialBasketballCooldown = Math.max(0, ball.runtime.specialBasketballCooldown - dt);
    }
    if (ball.mechanics.special.huaqiangCooldown > 0) {
      ball.runtime.specialHuaqiangCooldown = Math.max(0, ball.runtime.specialHuaqiangCooldown - dt);
    }
  }
}

function updateSpecialBladeShield(world: BattleWorldState, ball: BallState, dt: number): void {
  const mechanics = ball.mechanics.special;
  if (mechanics.bladeShieldBladeDuration <= 0 || mechanics.bladeShieldShieldDuration <= 0) {
    ball.runtime.specialBladeShieldStance = "none";
    ball.runtime.specialBladeShieldRemaining = 0;
    return;
  }

  if (ball.runtime.specialBladeShieldStance === "none") {
    ball.runtime.specialBladeShieldStance = "blade";
    ball.runtime.specialBladeShieldRemaining = mechanics.bladeShieldBladeDuration;
  }

  ball.runtime.specialBladeShieldRemaining -= dt;
  while (ball.runtime.specialBladeShieldRemaining <= 0) {
    if (ball.runtime.specialBladeShieldStance === "blade") {
      ball.runtime.specialBladeShieldStance = "shield";
      ball.runtime.specialBladeShieldRemaining += mechanics.bladeShieldShieldDuration;
    } else {
      ball.runtime.specialBladeShieldStance = "blade";
      ball.runtime.specialBladeShieldRemaining += mechanics.bladeShieldBladeDuration;
    }
    world.events.push({
      type: "trait_triggered",
      tick: world.tick,
      ballId: ball.id,
      traitId: "special_blade_shield_stance",
      trigger: ball.runtime.specialBladeShieldStance === "blade" ? "blade_shield_enter_blade" : "blade_shield_enter_shield",
      position: { ...ball.position },
      value: ball.runtime.specialBladeShieldRemaining
    });
  }
}

function updateSpecialElbow(world: BattleWorldState, ball: BallState, dt: number): void {
  const { elbowCooldown, elbowWindow, elbowDamageMultiplier } = ball.mechanics.special;
  if (elbowCooldown <= 0 || elbowWindow <= 0 || elbowDamageMultiplier <= 1) {
    return;
  }

  if (ball.runtime.specialElbowWindowRemaining > 0) {
    refreshSpecialElbowDirection(world, ball);
    const previousWindow = ball.runtime.specialElbowWindowRemaining;
    ball.runtime.specialElbowWindowRemaining = Math.max(0, previousWindow - dt);
    if (previousWindow > 0 && ball.runtime.specialElbowWindowRemaining <= 0) {
      ball.runtime.specialElbowHitAvailable = false;
      ball.runtime.specialElbowCooldown = elbowCooldown;
      world.events.push({
        type: "trait_triggered",
        tick: world.tick,
        ballId: ball.id,
        traitId: "special_elbow_strike",
        trigger: "elbow_expire",
        position: { ...ball.position }
      });
    }
    return;
  }

  const previousCooldown = ball.runtime.specialElbowCooldown;
  ball.runtime.specialElbowCooldown = Math.max(0, previousCooldown - dt);
  if (previousCooldown > 0 && ball.runtime.specialElbowCooldown <= 0) {
    refreshSpecialElbowDirection(world, ball);
    ball.runtime.specialElbowWindowRemaining = elbowWindow;
    ball.runtime.specialElbowHitAvailable = true;
    world.events.push({
      type: "trait_triggered",
      tick: world.tick,
      ballId: ball.id,
      traitId: "special_elbow_strike",
      trigger: "elbow_ready",
      position: { ...ball.position },
      value: elbowWindow
    });
  }
}

function updateSpecialHajimiGuard(world: BattleWorldState, ball: BallState, dt: number): void {
  const { hajimiCooldown, hajimiDuration, hajimiCollisionReduction } = ball.mechanics.special;
  if (hajimiCooldown <= 0 || hajimiDuration <= 0 || hajimiCollisionReduction <= 0) {
    return;
  }

  if (ball.runtime.specialHajimiCooldown > 0) {
    ball.runtime.specialHajimiCooldown = Math.max(0, ball.runtime.specialHajimiCooldown - dt);
  }

  if (ball.runtime.specialHajimiGuardRemaining > 0) {
    const previousGuard = ball.runtime.specialHajimiGuardRemaining;
    ball.runtime.specialHajimiGuardRemaining = Math.max(0, previousGuard - dt);
    if (previousGuard > 0 && ball.runtime.specialHajimiGuardRemaining <= 0) {
      world.events.push({
        type: "trait_triggered",
        tick: world.tick,
        ballId: ball.id,
        traitId: "special_hajimi_guard",
        trigger: "hajimi_guard_expire",
        position: { ...ball.position }
      });
    }
    return;
  }

  if (ball.runtime.specialHajimiCooldown <= 0) {
    ball.runtime.specialHajimiGuardRemaining = hajimiDuration;
    ball.runtime.specialHajimiCooldown = hajimiCooldown;
    world.events.push({
      type: "trait_triggered",
      tick: world.tick,
      ballId: ball.id,
      traitId: "special_hajimi_guard",
      trigger: "hajimi_guard_ready",
      position: { ...ball.position },
      value: hajimiDuration
    });
  }
}

function updateSpecialTigerGaze(world: BattleWorldState, ball: BallState, dt: number): void {
  const { tigerGazeCooldown, tigerGazeDuration, tigerGazeSlowPercent, tigerGazeVulnerablePercent } = ball.mechanics.special;
  if (tigerGazeCooldown <= 0 || tigerGazeDuration <= 0 || (tigerGazeSlowPercent <= 0 && tigerGazeVulnerablePercent <= 0)) {
    ball.runtime.specialTigerGazeTargetId = null;
    return;
  }

  syncTigerGazeTarget(world, ball);
  ball.runtime.specialTigerGazeCooldown = Math.max(0, ball.runtime.specialTigerGazeCooldown - dt);
  if (ball.runtime.specialTigerGazeCooldown > 0) {
    return;
  }

  const target = findTarget(world, ball);
  if (!target) {
    return;
  }

  if (tigerGazeSlowPercent > 0) {
    applyStatusEffect(world, ball, target, {
      traitId: "special_dongbei_tiger_gaze",
      statusId: "slow",
      chance: 1,
      duration: tigerGazeDuration,
      tickDamage: 0,
      slowPercent: tigerGazeSlowPercent,
      vulnerablePercent: 0
    });
  }
  if (tigerGazeVulnerablePercent > 0) {
    applyStatusEffect(world, ball, target, {
      traitId: "special_dongbei_tiger_gaze",
      statusId: "vulnerable",
      chance: 1,
      duration: tigerGazeDuration,
      tickDamage: 0,
      slowPercent: 0,
      vulnerablePercent: tigerGazeVulnerablePercent
    });
  }

  ball.runtime.specialTigerGazeTargetId = target.id;
  ball.runtime.specialTigerGazeCooldown = tigerGazeCooldown;
  world.events.push({
    type: "trait_triggered",
    tick: world.tick,
    ballId: ball.id,
    traitId: "special_dongbei_tiger_gaze",
    trigger: "tiger_gaze_lock",
    position: { ...target.position },
    value: tigerGazeDuration
  });
}

function syncTigerGazeTarget(world: BattleWorldState, source: BallState): void {
  const targetId = source.runtime.specialTigerGazeTargetId;
  if (!targetId) {
    return;
  }
  const target = world.balls.find((ball) => ball.id === targetId);
  const active = target?.runtime.statuses.some((status) => status.traitId === "special_dongbei_tiger_gaze" && status.remaining > 0);
  if (!target?.alive || !active) {
    source.runtime.specialTigerGazeTargetId = null;
  }
}

function updateSpecialBlackHand(world: BattleWorldState, ball: BallState, dt: number): void {
  const mechanics = ball.mechanics.special;
  if (
    mechanics.blackHandCooldown <= 0 ||
    mechanics.blackHandWarningDuration <= 0 ||
    mechanics.blackHandGrabDuration <= 0 ||
    mechanics.blackHandDragStrength <= 0
  ) {
    ball.runtime.specialBlackHandPhase = "idle";
    ball.runtime.specialBlackHandTargetId = null;
    ball.runtime.specialBlackHandPhaseRemaining = 0;
    return;
  }

  if (ball.runtime.specialBlackHandPhase === "idle") {
    ball.runtime.specialBlackHandCooldown = Math.max(0, ball.runtime.specialBlackHandCooldown - dt);
    if (ball.runtime.specialBlackHandCooldown > 0) {
      return;
    }
    const target = findTarget(world, ball);
    if (!target) {
      return;
    }
    ball.runtime.specialBlackHandPhase = "warning";
    ball.runtime.specialBlackHandPhaseRemaining = mechanics.blackHandWarningDuration;
    ball.runtime.specialBlackHandTargetId = target.id;
    ball.runtime.specialBlackHandCooldown = mechanics.blackHandCooldown;
    world.events.push({
      type: "trait_triggered",
      tick: world.tick,
      ballId: ball.id,
      traitId: "special_shenying_black_hand",
      trigger: "black_hand_warning",
      position: { ...target.position },
      value: mechanics.blackHandWarningDuration
    });
    return;
  }

  const target = ball.runtime.specialBlackHandTargetId ? world.balls.find((candidate) => candidate.id === ball.runtime.specialBlackHandTargetId) : undefined;
  if (!target?.alive || target.team === ball.team) {
    resetBlackHandRuntime(ball);
    return;
  }

  ball.runtime.specialBlackHandPhaseRemaining = Math.max(0, ball.runtime.specialBlackHandPhaseRemaining - dt);
  if (ball.runtime.specialBlackHandPhase === "warning" && ball.runtime.specialBlackHandPhaseRemaining <= 0) {
    ball.runtime.specialBlackHandPhase = "grab";
    ball.runtime.specialBlackHandPhaseRemaining = mechanics.blackHandGrabDuration;
    world.events.push({
      type: "trait_triggered",
      tick: world.tick,
      ballId: ball.id,
      traitId: "special_shenying_black_hand",
      trigger: "black_hand_grab",
      position: { ...target.position },
      value: mechanics.blackHandGrabDuration
    });
    return;
  }

  if (ball.runtime.specialBlackHandPhase === "grab" && ball.runtime.specialBlackHandPhaseRemaining <= 0) {
    applyStatusEffect(world, ball, target, {
      traitId: "special_shenying_black_hand",
      statusId: "slow",
      chance: 1,
      duration: mechanics.blackHandSlowDuration,
      tickDamage: 0,
      slowPercent: mechanics.blackHandSlowPercent,
      vulnerablePercent: 0
    });
    world.events.push({
      type: "trait_triggered",
      tick: world.tick,
      ballId: ball.id,
      traitId: "special_shenying_black_hand",
      trigger: "black_hand_release",
      position: { ...target.position },
      value: mechanics.blackHandSlowDuration
    });
    resetBlackHandRuntime(ball);
  }
}

function resetBlackHandRuntime(ball: BallState): void {
  ball.runtime.specialBlackHandPhase = "idle";
  ball.runtime.specialBlackHandPhaseRemaining = 0;
  ball.runtime.specialBlackHandTargetId = null;
}

function applySpecialBlackHandDrag(world: BattleWorldState, dt: number): void {
  for (const source of world.balls) {
    if (!source.alive || source.runtime.specialBlackHandPhase !== "grab" || !source.runtime.specialBlackHandTargetId) {
      continue;
    }
    const target = world.balls.find((ball) => ball.id === source.runtime.specialBlackHandTargetId);
    if (!target?.alive || target.team === source.team) {
      resetBlackHandRuntime(source);
      continue;
    }
    const direction = normalize(sub(source.position, target.position), { x: source.team === "blue" ? -1 : 1, y: 0 });
    const pullDistance = Math.min(distance(source.position, target.position), source.mechanics.special.blackHandDragStrength * dt);
    target.position = add(target.position, scale(direction, pullDistance));
    target.velocity = scale(direction, source.mechanics.special.blackHandDragStrength * 0.45);
    clampBallToArena(world, target);
  }
}

function fireSpecialBasketballs(world: BattleWorldState): void {
  for (const ball of world.balls) {
    const mechanics = ball.mechanics.special;
    if (
      !ball.alive ||
      ball.role !== "main" ||
      mechanics.basketballCooldown <= 0 ||
      mechanics.basketballDamage <= 0 ||
      mechanics.basketballLimit <= 0 ||
      ball.runtime.specialBasketballCooldown > 0 ||
      countTeamBasketballs(world, ball.team) >= mechanics.basketballLimit
    ) {
      continue;
    }

    const target = findTarget(world, ball);
    if (!target) {
      continue;
    }

    const direction = normalize(sub(target.position, ball.position), normalize(ball.velocity, { x: ball.team === "blue" ? 1 : -1, y: 0 }));
    spawnBasketballProjectile(world, ball, direction);
    ball.runtime.specialBasketballCooldown = mechanics.basketballCooldown;
    world.events.push({
      type: "trait_triggered",
      tick: world.tick,
      ballId: ball.id,
      traitId: "special_bounce_basketball",
      trigger: "basketball_fire",
      position: { ...ball.position },
      value: countTeamBasketballs(world, ball.team)
    });
  }
}

function fireSpecialHuaqiang(world: BattleWorldState): void {
  for (const ball of world.balls) {
    const mechanics = ball.mechanics.special;
    if (
      !ball.alive ||
      ball.role !== "main" ||
      mechanics.huaqiangCooldown <= 0 ||
      ball.runtime.specialHuaqiangCooldown > 0 ||
      !canFireHuaqiang(ball)
    ) {
      continue;
    }

    const target = findTarget(world, ball);
    if (!target) {
      continue;
    }

    const kind = ball.runtime.specialHuaqiangNextKind;
    const direction = normalize(sub(target.position, ball.position), normalize(ball.velocity, { x: ball.team === "blue" ? 1 : -1, y: 0 }));
    spawnHuaqiangProjectile(world, ball, direction, kind);
    ball.runtime.specialHuaqiangCooldown = mechanics.huaqiangCooldown;
    ball.runtime.specialHuaqiangNextKind = kind === "melon" ? "melon_knife" : "melon";
    world.events.push({
      type: "trait_triggered",
      tick: world.tick,
      ballId: ball.id,
      traitId: "special_huaqiang_melon",
      trigger: kind === "melon" ? "huaqiang_melon_throw" : "huaqiang_knife_throw",
      position: { ...ball.position },
      value: kind === "melon" ? mechanics.huaqiangMelonDamage : mechanics.huaqiangKnifeDamage
    });
  }
}

function canFireHuaqiang(ball: BallState): boolean {
  const mechanics = ball.mechanics.special;
  return (
    mechanics.huaqiangMelonDamage > 0 &&
    mechanics.huaqiangMelonSpeed > 0 &&
    mechanics.huaqiangMelonRadius > 0 &&
    mechanics.huaqiangMelonLifetime > 0 &&
    mechanics.huaqiangKnifeDamage > 0 &&
    mechanics.huaqiangKnifeSpeed > 0 &&
    mechanics.huaqiangKnifeRadius > 0 &&
    mechanics.huaqiangKnifeLifetime > 0
  );
}

function triggerLowHpRage(world: BattleWorldState, ball: BallState): void {
  const { lowHpRageDuration, lowHpRageThreshold } = ball.mechanics.rule;
  if (lowHpRageDuration <= 0 || ball.runtime.lowHpRageTriggered || ball.hp / ball.stats.maxHp > lowHpRageThreshold) {
    return;
  }

  ball.runtime.lowHpRageTriggered = true;
  ball.runtime.lowHpRageRemaining = lowHpRageDuration;
  world.events.push({
    type: "trait_triggered",
    tick: world.tick,
    ballId: ball.id,
    traitId: "low_hp_rage",
    trigger: "low_hp_rage_trigger",
    position: { ...ball.position },
    value: lowHpRageDuration
  });
}

function updateTimeGrowth(world: BattleWorldState, ball: BallState, dt: number): void {
  const { timeGrowthInterval, timeGrowthMaxStacks } = ball.mechanics.rule;
  if (timeGrowthMaxStacks <= 0 || timeGrowthInterval <= 0 || ball.runtime.timeGrowthStacks >= timeGrowthMaxStacks) {
    return;
  }

  ball.runtime.timeGrowthTimer += dt;
  while (ball.runtime.timeGrowthTimer >= timeGrowthInterval && ball.runtime.timeGrowthStacks < timeGrowthMaxStacks) {
    ball.runtime.timeGrowthTimer -= timeGrowthInterval;
    ball.runtime.timeGrowthStacks += 1;
    world.events.push({
      type: "trait_triggered",
      tick: world.tick,
      ballId: ball.id,
      traitId: "time_growth",
      trigger: "time_growth_stack",
      position: { ...ball.position },
      value: ball.runtime.timeGrowthStacks
    });
  }
}

function getRuleMoveSpeedMultiplier(ball: BallState): number {
  const { rule } = ball.mechanics;
  let multiplier = 1;
  if (ball.runtime.lowHpRageRemaining > 0) {
    multiplier *= rule.lowHpRageSpeedMultiplier;
  }
  multiplier *= 1 + ball.runtime.killGrowthStacks * rule.killGrowthMoveSpeedPercentPerStack;
  multiplier *= 1 + ball.runtime.timeGrowthStacks * rule.timeGrowthMoveSpeedPercentPerStack;
  return multiplier;
}

function getRuleCollisionDamageMultiplier(ball: BallState): number {
  const { rule } = ball.mechanics;
  let multiplier = 1;
  if (ball.runtime.lowHpRageRemaining > 0) {
    multiplier *= rule.lowHpRageCollisionDamageMultiplier;
  }
  multiplier *= 1 + ball.runtime.killGrowthStacks * rule.killGrowthCollisionDamagePercentPerStack;
  multiplier *= 1 + ball.runtime.timeGrowthStacks * rule.timeGrowthCollisionDamagePercentPerStack;
  return multiplier;
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

function spawnClone(world: BattleWorldState, owner: BallState): BallState {
  const cloneStats = createChildStats(owner.stats, {
    hpRatio: owner.mechanics.summon.cloneHpRatio,
    radiusRatio: 0.72,
    speedRatio: 1.05,
    collisionDamageRatio: 0.45,
    knockbackRatio: 0.8
  });
  const direction = world.rng.direction();
  const clone = createChildBall(world, owner, "clone", cloneStats, direction);
  world.balls.push(clone);
  world.events.push({
    type: "trait_triggered",
    tick: world.tick,
    ballId: owner.id,
    traitId: "clone_spawn",
    trigger: "clone_spawn",
    position: { ...clone.position },
    value: countOwnedBalls(world, owner, "clone")
  });
  return clone;
}

function spawnSplitBalls(world: BattleWorldState, owner: BallState): BallState[] {
  const childCount = Math.max(0, owner.mechanics.summon.splitCount);
  const children: BallState[] = [];
  if (childCount <= 0) {
    return children;
  }

  const splitStats = createChildStats(owner.stats, {
    hpRatio: owner.mechanics.summon.splitHpRatio,
    radiusRatio: 0.75,
    speedRatio: 1.1,
    collisionDamageRatio: 0.5,
    knockbackRatio: 0.75
  });
  const baseAngle = Math.atan2(owner.velocity.y, owner.velocity.x);
  const angleStep = (Math.PI * 2) / childCount;

  for (let i = 0; i < childCount; i += 1) {
    const direction = rotate({ x: Math.cos(baseAngle), y: Math.sin(baseAngle) }, angleStep * i);
    const child = createChildBall(world, owner, "split", splitStats, direction);
    children.push(child);
  }

  world.balls.push(...children);
  world.events.push({
    type: "trait_triggered",
    tick: world.tick,
    ballId: owner.id,
    traitId: "death_split",
    trigger: "death_split",
    position: { ...owner.position },
    value: children.length
  });
  return children;
}

function spawnTurret(world: BattleWorldState, owner: BallState): TurretState {
  const mechanics = owner.mechanics.summon;
  const direction = world.rng.direction();
  const position = add(owner.position, scale(direction, owner.stats.radius + mechanics.turretRadius + 10));
  const turret: TurretState = {
    id: `turret-${world.nextEntityId}`,
    team: owner.team,
    ownerId: owner.id,
    alive: true,
    hp: mechanics.turretHp,
    maxHp: mechanics.turretHp,
    radius: mechanics.turretRadius,
    lifetime: mechanics.turretLifetime,
    projectileCooldown: 0,
    position: clampPositionToArena(world, position, mechanics.turretRadius)
  };
  world.nextEntityId += 1;
  world.turrets.push(turret);
  world.events.push({
    type: "trait_triggered",
    tick: world.tick,
    ballId: owner.id,
    traitId: "auto_turret",
    trigger: "turret_spawn",
    position: { ...turret.position },
    value: countOwnedTurrets(world, owner)
  });
  return turret;
}

function createChildBall(
  world: BattleWorldState,
  owner: BallState,
  role: "clone" | "split",
  stats: BallStats,
  direction: Vec2
): BallState {
  const radius = stats.radius;
  const position = clampPositionToArena(world, add(owner.position, scale(direction, owner.stats.radius + radius + 8)), radius);
  const child: BallState = {
    id: `ball-${world.nextEntityId}`,
    team: owner.team,
    role,
    ownerId: owner.id,
    alive: true,
    hp: stats.maxHp,
    stats,
    mechanics: createChildMechanics(owner.mechanics, role),
    runtime: createRuntimeState(),
    position,
    velocity: scale(direction, stats.moveSpeed),
    collisionTimers: {}
  };
  world.nextEntityId += 1;
  return child;
}

function createChildStats(
  baseStats: BallStats,
  ratios: {
    hpRatio: number;
    radiusRatio: number;
    speedRatio: number;
    collisionDamageRatio: number;
    knockbackRatio: number;
  }
): BallStats {
  return {
    ...baseStats,
    maxHp: Math.max(1, baseStats.maxHp * ratios.hpRatio),
    radius: Math.max(20, baseStats.radius * ratios.radiusRatio),
    moveSpeed: Math.max(20, baseStats.moveSpeed * ratios.speedRatio),
    collisionDamage: Math.max(0, baseStats.collisionDamage * ratios.collisionDamageRatio),
    knockback: Math.max(0, baseStats.knockback * ratios.knockbackRatio),
    damageReduction: Math.min(0.35, baseStats.damageReduction)
  };
}

function createChildMechanics(mechanics: BallMechanics, role: "clone" | "split"): BallMechanics {
  const keepsScoringRules = role === "split";
  return {
    collision: { ...mechanics.collision },
    projectile: { ...mechanics.projectile, enabled: false },
    summon: {
      ...mechanics.summon,
      maxClones: 0,
      cloneCooldown: 0,
      splitCount: 0,
      turretLimit: 0,
      turretCooldown: 0
    },
    status: {
      ...mechanics.status,
      onHit: mechanics.status.onHit.map((status) => ({ ...status })),
      shieldValue: role === "split" ? mechanics.status.shieldValue : 0,
      shieldCooldown: role === "split" ? mechanics.status.shieldCooldown : 0
    },
    rule: {
      ...mechanics.rule,
      lowHpRageDuration: keepsScoringRules ? mechanics.rule.lowHpRageDuration : 0,
      killGrowthMaxStacks: keepsScoringRules ? mechanics.rule.killGrowthMaxStacks : 0,
      timeGrowthMaxStacks: keepsScoringRules ? mechanics.rule.timeGrowthMaxStacks : 0,
      reviveHpRatio: 0
    },
    special: {
      ...mechanics.special,
      elbowCooldown: 0,
      elbowWindow: 0,
      elbowHitboxRangeMultiplier: 0,
      elbowHitboxRadiusMultiplier: 0,
      basketballCooldown: 0,
      basketballLimit: 0,
      hajimiCooldown: 0,
      hajimiDuration: 0,
      bladeShieldBladeDuration: 0,
      bladeShieldShieldDuration: 0,
      tigerGazeCooldown: 0,
      huaqiangCooldown: 0,
      blackHandCooldown: 0
    }
  };
}

function countOwnedBalls(world: BattleWorldState, owner: BallState, role: "clone" | "split"): number {
  return world.balls.filter((ball) => ball.alive && ball.ownerId === owner.id && ball.role === role).length;
}

function countOwnedTurrets(world: BattleWorldState, owner: BallState): number {
  return world.turrets.filter((turret) => turret.alive && turret.ownerId === owner.id).length;
}

function countTeamBasketballs(world: BattleWorldState, team: Team): number {
  return world.projectiles.filter((projectile) => projectile.team === team && projectile.kind === "basketball").length;
}

function processDeaths(world: BattleWorldState): void {
  let didHandleDeath = true;
  while (didHandleDeath) {
    didHandleDeath = false;
    const deadBalls = world.balls.filter((ball) => !ball.alive && !ball.runtime.deathHandled);
    for (const ball of deadBalls) {
      didHandleDeath = true;
      if (canRevive(ball)) {
        reviveBall(world, ball);
        continue;
      }

      if (ball.role === "main" && canDeathSplit(ball)) {
        ball.runtime.deathSplitTriggered = true;
        ball.runtime.deathHandled = true;
        spawnSplitBalls(world, ball);
        continue;
      }

      grantKillGrowth(world, ball);
      if (ball.role !== "main" && !ball.runtime.deathDamageTags.includes("explosion")) {
        triggerSummonDeathExplosion(world, ball);
      }
      ball.runtime.deathHandled = true;
    }
  }
}

function canDeathSplit(ball: BallState): boolean {
  return ball.mechanics.summon.splitCount > 0 && !ball.runtime.deathSplitTriggered;
}

function canRevive(ball: BallState): boolean {
  return ball.role === "main" && ball.mechanics.rule.reviveHpRatio > 0 && !ball.runtime.reviveTriggered;
}

function reviveBall(world: BattleWorldState, ball: BallState): void {
  ball.alive = true;
  ball.hp = Math.max(1, ball.stats.maxHp * ball.mechanics.rule.reviveHpRatio);
  ball.runtime.reviveTriggered = true;
  ball.runtime.deathDamageTags = [];
  ball.runtime.lastDamageSourceId = null;
  ball.runtime.statuses = [];
  ball.runtime.shield = 0;
  world.events.push({
    type: "trait_triggered",
    tick: world.tick,
    ballId: ball.id,
    traitId: "one_revive",
    trigger: "revive_once",
    position: { ...ball.position },
    value: ball.hp
  });
}

function grantKillGrowth(world: BattleWorldState, deadBall: BallState): void {
  const killer = findKillCreditBall(world, deadBall.runtime.lastDamageSourceId);
  if (!killer || killer.team === deadBall.team || !killer.alive || killer.mechanics.rule.killGrowthMaxStacks <= 0) {
    return;
  }

  const nextStacks = Math.min(killer.mechanics.rule.killGrowthMaxStacks, killer.runtime.killGrowthStacks + 1);
  if (nextStacks === killer.runtime.killGrowthStacks) {
    return;
  }

  killer.runtime.killGrowthStacks = nextStacks;
  world.events.push({
    type: "trait_triggered",
    tick: world.tick,
    ballId: killer.id,
    traitId: "kill_growth",
    trigger: "kill_growth_stack",
    position: { ...killer.position },
    value: nextStacks
  });
}

function findKillCreditBall(world: BattleWorldState, sourceId: string | null): BallState | undefined {
  if (!sourceId) {
    return undefined;
  }

  const source = world.balls.find((ball) => ball.id === sourceId);
  if (!source) {
    return undefined;
  }
  if (source.role === "clone" && source.ownerId) {
    return world.balls.find((ball) => ball.id === source.ownerId) ?? source;
  }
  return source;
}

function triggerSummonDeathExplosion(world: BattleWorldState, source: BallState): void {
  const { cloneDeathExplosionDamage, cloneDeathExplosionRadius } = source.mechanics.summon;
  if (cloneDeathExplosionDamage <= 0 || cloneDeathExplosionRadius <= 0) {
    return;
  }

  world.events.push({
    type: "trait_triggered",
    tick: world.tick,
    ballId: source.id,
    traitId: "clone_bomb",
    trigger: "summon_death_explosion",
    position: { ...source.position },
    value: cloneDeathExplosionDamage
  });

  for (const target of world.balls) {
    if (!target.alive || target.team === source.team || distance(target.position, source.position) > cloneDeathExplosionRadius) {
      continue;
    }
    applyDamage(world, source, target, cloneDeathExplosionDamage, ["explosion"]);
  }
}

function clampPositionToArena(world: BattleWorldState, position: Vec2, radius: number): Vec2 {
  return {
    x: clamp(position.x, radius, world.arena.width - radius),
    y: clamp(position.y, radius, world.arena.height - radius)
  };
}

function checkBattleEnd(world: BattleWorldState): void {
  if (world.result) {
    return;
  }
  const blueAlive = hasScoringCombatantAlive(world, "blue");
  const redAlive = hasScoringCombatantAlive(world, "red");

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
  return findNearestEnemyCombatant(world, ball.team, ball.position);
}

function findNearestEnemy(world: BattleWorldState, team: Team, position: Vec2): BallState | undefined {
  return findNearestEnemyCombatant(world, team, position);
}

function findNearestEnemyCombatant(world: BattleWorldState, team: Team, position: Vec2): BallState | undefined {
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

function hasScoringCombatantAlive(world: BattleWorldState, team: Team): boolean {
  return world.balls.some((ball) => ball.team === team && ball.alive && (ball.role === "main" || ball.role === "split"));
}

function remainingHp(world: BattleWorldState, team: Team): number {
  return world.balls
    .filter((ball) => ball.team === team && ball.alive)
    .reduce((total, ball) => total + ball.hp, 0);
}

function midpoint(a: Vec2, b: Vec2): Vec2 {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function distancePointToSegment(point: Vec2, a: Vec2, b: Vec2): number {
  const ab = sub(b, a);
  const abLengthSq = lengthSq(ab);
  if (abLengthSq <= 0.000001) {
    return distance(point, a);
  }

  const ap = sub(point, a);
  const t = clamp((ap.x * ab.x + ap.y * ab.y) / abLengthSq, 0, 1);
  return distance(point, add(a, scale(ab, t)));
}

function distanceToBentElbowHitbox(
  point: Vec2,
  hitbox: { root: Vec2; joint: Vec2; foldEnd: Vec2; radius: number }
): number {
  return Math.min(
    distancePointToSegment(point, hitbox.root, hitbox.joint),
    distancePointToSegment(point, hitbox.joint, hitbox.foldEnd),
    distance(point, hitbox.joint)
  );
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
