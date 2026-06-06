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
      statuses: ball.runtime.statuses.map((status) => ({
        id: status.id,
        remaining: status.remaining
      })),
      shield: ball.runtime.shield,
      maxShield: ball.mechanics.status.shieldValue,
      lowHpRageRemaining: ball.runtime.lowHpRageRemaining,
      killGrowthStacks: ball.runtime.killGrowthStacks,
      timeGrowthStacks: ball.runtime.timeGrowthStacks,
      reviveTriggered: ball.runtime.reviveTriggered,
      specialElbowReady: ball.runtime.specialElbowWindowRemaining > 0,
      specialElbowRemaining: ball.runtime.specialElbowWindowRemaining,
      specialElbowDirection: { ...ball.runtime.specialElbowDirection },
      specialElbowRange: ball.stats.radius * ball.mechanics.special.elbowHitboxRangeMultiplier,
      specialElbowRadius: ball.stats.radius * ball.mechanics.special.elbowHitboxRadiusMultiplier,
      specialHajimiGuardRemaining: ball.runtime.specialHajimiGuardRemaining,
      specialBladeShieldStance: ball.runtime.specialBladeShieldStance,
      specialBladeShieldRemaining: ball.runtime.specialBladeShieldRemaining,
      specialTigerGazeTargetId: ball.runtime.specialTigerGazeTargetId,
      specialBlackHandPhase: ball.runtime.specialBlackHandPhase,
      specialBlackHandTargetId: ball.runtime.specialBlackHandTargetId,
      position: { ...ball.position }
    })),
    projectiles: world.projectiles.map((projectile) => ({
      id: projectile.id,
      team: projectile.team,
      kind: projectile.kind,
      radius: projectile.radius,
      position: { ...projectile.position }
    })),
    turrets: world.turrets.map((turret) => ({
      id: turret.id,
      team: turret.team,
      hp: turret.hp,
      maxHp: turret.maxHp,
      radius: turret.radius,
      position: { ...turret.position }
    })),
    events: world.events.map((event) => ({ ...event }))
  };

  if (world.result) {
    snapshot.result = { ...world.result };
  }

  return snapshot;
}
