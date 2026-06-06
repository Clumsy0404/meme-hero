import type { BattleWorldState, WorldSnapshot } from "./types";

export function getSnapshot(world: BattleWorldState): WorldSnapshot {
  const snapshot: WorldSnapshot = {
    tick: world.tick,
    time: world.time,
    arena: { ...world.arena },
    balls: world.balls.map((ball) => ({
      id: ball.id,
      team: ball.team,
      role: ball.role,
      alive: ball.alive,
      hp: ball.hp,
      maxHp: ball.stats.maxHp,
      radius: ball.stats.radius,
      wallChargeStacks: ball.runtime.wallChargeStacks,
      position: { ...ball.position }
    })),
    projectiles: world.projectiles.map((projectile) => ({
      id: projectile.id,
      team: projectile.team,
      radius: projectile.radius,
      position: { ...projectile.position }
    })),
    events: world.events.map((event) => ({ ...event }))
  };

  if (world.result) {
    snapshot.result = { ...world.result };
  }

  return snapshot;
}
