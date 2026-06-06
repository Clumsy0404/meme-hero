import type { Team, Vec2 } from "@ball-brawl/shared";

import { add, clamp, distance, lengthSq, lerp, normalize, scale, sub } from "../math/vector";
import type { BallState, BattleResult, BattleWorldState } from "./types";

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
    applyDamage(world, a, b, a.stats.collisionDamage);
    applyDamage(world, b, a, b.stats.collisionDamage);
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

function applyDamage(world: BattleWorldState, source: BallState, target: BallState, amount: number): void {
  if (!target.alive) {
    return;
  }
  const finalAmount = Math.max(0, amount * (1 - clamp(target.stats.damageReduction, 0, 0.9)));
  target.hp = Math.max(0, target.hp - finalAmount);
  world.events.push({
    type: "damage",
    tick: world.tick,
    sourceId: source.id,
    targetId: target.id,
    amount: finalAmount,
    tags: ["collision"],
    position: { ...target.position }
  });
  if (target.hp <= 0) {
    target.alive = false;
  }
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
