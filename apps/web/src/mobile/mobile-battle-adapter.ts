import type { BattleEvent, ProjectileKind, StatusEffectId, WorldSnapshot } from "@ball-brawl/sim";
import type { BuildConfig, Team, TraitId } from "@ball-brawl/shared";

import type { MobileSfxKey } from "./mobile-audio";
import { resolveBallIconSrc, statusColors, statusLabels, teamColors, type CommonBallAvatarId } from "./mobile-assets";
import { getMobileTrait, type MobileOpponent } from "./mobile-data";

export type MobileBattleStatus = "fighting" | "win" | "lose" | "draw";

export type MobileBattleSnapshot = {
  matchId: string;
  mode: "pve" | "pvp";
  status: MobileBattleStatus;
  tick: number;
  elapsed: number;
  maxTime: number;
  arena: { w: number; h: number };
  combatants: MobileCombatant[];
  links: MobileBattleLink[];
  projectiles: MobileProjectile[];
  summons: MobileSummon[];
  explosions: MobileExplosion[];
  floaters: MobileFloater[];
  log: MobileLogLine[];
  sfx: MobileSfxKey[];
};

export type MobileBattleAvatarConfig = {
  blueAvatarId?: CommonBallAvatarId;
  redAvatarId?: CommonBallAvatarId;
};

export type MobileSpecialEffect = "elbowReady" | "hajimiGuard" | "bladeStance" | "shieldStance" | "tigerGaze" | "blackHandWarning" | "blackHandGrab";

export type MobileCombatant = {
  side: "me" | "foe";
  id: string;
  name: string;
  color: string;
  hp: number;
  maxHp: number;
  shield: number;
  x: number;
  y: number;
  r: number;
  build: TraitId[];
  statuses: Array<{ type: StatusEffectId; stacks: number }>;
  specialEffects: MobileSpecialEffect[];
  elbow:
    | {
        dx: number;
        dy: number;
        range: number;
        radius: number;
      }
    | undefined;
  iconSrc: string | undefined;
};

export type MobileProjectile = {
  id: string;
  kind: ProjectileKind;
  x: number;
  y: number;
  r: number;
  color: string;
  owner: "me" | "foe";
};

export type MobileBattleLink = {
  id: string;
  kind: "tigerGaze" | "blackHandWarning" | "blackHandGrab";
  from: { x: number; y: number };
  to: { x: number; y: number };
};

export type MobileSummon = {
  id: string;
  x: number;
  y: number;
  r: number;
  color: string;
  owner: "me" | "foe";
  kind: "clone" | "split" | "turret";
};

export type MobileFloater = {
  id: string;
  x: number;
  y: number;
  text: string;
  kind: "dmg" | "heal" | "crit";
};

export type MobileExplosion = {
  id: string;
  x: number;
  y: number;
  radius: number;
  kind: "white" | "melon";
};

export type MobileLogLine = {
  t: string;
  text: string;
  kind: "hit" | "kill" | "status" | "sys";
};

export function toMobileBattleSnapshot(
  snapshot: WorldSnapshot,
  blueBuild: BuildConfig,
  redBuild: BuildConfig,
  opponent: MobileOpponent,
  mode: "pve" | "pvp" = "pve",
  avatars: MobileBattleAvatarConfig = {}
): MobileBattleSnapshot {
  const mainBalls = snapshot.balls.filter((ball) => ball.role === "main");
  const blueMain = mainBalls.find((ball) => ball.team === "blue");
  const redMain = mainBalls.find((ball) => ball.team === "red");
  const status = toMobileBattleStatus(snapshot.result?.winner);

  return {
    matchId: `${blueBuild.name}-vs-${opponent.id}`,
    mode,
    status,
    tick: snapshot.tick,
    elapsed: snapshot.time,
    maxTime: 90,
    arena: { w: snapshot.arena.width, h: snapshot.arena.height },
    combatants: [
      blueMain
        ? {
            side: "me",
            id: blueMain.id,
            name: blueBuild.name,
            color: teamColors.blue,
            hp: blueMain.hp,
            maxHp: blueMain.maxHp,
            shield: blueMain.shield,
            x: blueMain.position.x,
            y: blueMain.position.y,
            r: blueMain.radius,
            build: blueBuild.traits,
            statuses: blueMain.statuses.map((statusEffect) => ({ type: statusEffect.id, stacks: 1 })),
            specialEffects: getSpecialEffects(blueMain),
            elbow: getSpecialElbow(blueMain),
            iconSrc: resolveBallIconSrc(blueBuild.traits, avatars.blueAvatarId)
          }
        : fallbackCombatant("me", blueBuild.name, teamColors.blue, blueBuild.traits, avatars.blueAvatarId),
      redMain
        ? {
            side: "foe",
            id: redMain.id,
            name: opponent.name,
            color: opponent.color,
            hp: redMain.hp,
            maxHp: redMain.maxHp,
            shield: redMain.shield,
            x: redMain.position.x,
            y: redMain.position.y,
            r: redMain.radius,
            build: redBuild.traits,
            statuses: redMain.statuses.map((statusEffect) => ({ type: statusEffect.id, stacks: 1 })),
            specialEffects: getSpecialEffects(redMain),
            elbow: getSpecialElbow(redMain),
            iconSrc: resolveBallIconSrc(redBuild.traits, avatars.redAvatarId)
          }
        : fallbackCombatant("foe", opponent.name, opponent.color, redBuild.traits, avatars.redAvatarId)
    ],
    links: getSpecialLinks(snapshot),
    projectiles: snapshot.projectiles.map((projectile) => ({
      id: projectile.id,
      kind: projectile.kind,
      x: projectile.position.x,
      y: projectile.position.y,
      r: projectile.radius,
      color: teamColors[projectile.team],
      owner: toOwner(projectile.team)
    })),
    summons: [
      ...snapshot.balls
        .filter((ball) => ball.role !== "main" && ball.alive)
        .map((ball) => ({
          id: ball.id,
          x: ball.position.x,
          y: ball.position.y,
          r: ball.radius,
          color: teamColors[ball.team],
          owner: toOwner(ball.team),
          kind: ball.role === "split" ? ("split" as const) : ("clone" as const)
        })),
      ...snapshot.turrets.map((turret) => ({
        id: turret.id,
        x: turret.position.x,
        y: turret.position.y,
        r: turret.radius,
        color: teamColors[turret.team],
        owner: toOwner(turret.team),
        kind: "turret" as const
      }))
    ],
    explosions: snapshot.events.map(eventToExplosion).filter((explosion): explosion is MobileExplosion => Boolean(explosion)),
    floaters: snapshot.events.map(eventToFloater).filter((floater): floater is MobileFloater => Boolean(floater)).slice(-8),
    log: snapshot.events.map(eventToLogLine).filter((line): line is MobileLogLine => Boolean(line)).slice(-5).reverse(),
    sfx: snapshot.events.map(eventToSfx).filter((key): key is MobileSfxKey => Boolean(key))
  };
}

function toMobileBattleStatus(winner: Team | "draw" | undefined): MobileBattleStatus {
  if (!winner) {
    return "fighting";
  }
  if (winner === "draw") {
    return "draw";
  }
  return winner === "blue" ? "win" : "lose";
}

function fallbackCombatant(side: "me" | "foe", name: string, color: string, build: TraitId[], avatarId?: CommonBallAvatarId): MobileCombatant {
  return {
    side,
    id: side,
    name,
    color,
    hp: 0,
    maxHp: 100,
    shield: 0,
    x: side === "me" ? 160 : 640,
    y: 300,
    r: 48,
    build,
    statuses: [],
    specialEffects: [],
    elbow: undefined,
    iconSrc: resolveBallIconSrc(build, avatarId)
  };
}

function getSpecialEffects(ball: WorldSnapshot["balls"][number]): MobileSpecialEffect[] {
  const effects: MobileSpecialEffect[] = [];
  if (ball.specialElbowReady) {
    effects.push("elbowReady");
  }
  if (ball.specialHajimiGuardRemaining > 0) {
    effects.push("hajimiGuard");
  }
  if (ball.specialBladeShieldStance === "blade") {
    effects.push("bladeStance");
  }
  if (ball.specialBladeShieldStance === "shield") {
    effects.push("shieldStance");
  }
  if (ball.specialTigerGazeTargetId) {
    effects.push("tigerGaze");
  }
  if (ball.specialBlackHandPhase === "warning") {
    effects.push("blackHandWarning");
  }
  if (ball.specialBlackHandPhase === "grab") {
    effects.push("blackHandGrab");
  }
  return effects;
}

function getSpecialLinks(snapshot: WorldSnapshot): MobileBattleLink[] {
  const ballsById = new Map(snapshot.balls.map((ball) => [ball.id, ball]));
  const links: MobileBattleLink[] = [];
  for (const source of snapshot.balls) {
    if (!source.alive) {
      continue;
    }
    if (source.specialTigerGazeTargetId) {
      const target = ballsById.get(source.specialTigerGazeTargetId);
      if (target?.alive) {
        links.push({
          id: `gaze-${source.id}-${target.id}`,
          kind: "tigerGaze",
          from: { ...source.position },
          to: { ...target.position }
        });
      }
    }
    if (source.specialBlackHandTargetId && source.specialBlackHandPhase !== "idle") {
      const target = ballsById.get(source.specialBlackHandTargetId);
      if (target?.alive) {
        links.push({
          id: `blackhand-${source.id}-${target.id}`,
          kind: source.specialBlackHandPhase === "grab" ? "blackHandGrab" : "blackHandWarning",
          from: { ...source.position },
          to: { ...target.position }
        });
      }
    }
  }
  return links;
}

function getSpecialElbow(ball: WorldSnapshot["balls"][number]): MobileCombatant["elbow"] {
  if (ball.specialElbowRemaining <= 0 || ball.specialElbowRange <= 0 || ball.specialElbowRadius <= 0) {
    return undefined;
  }
  return {
    dx: ball.specialElbowDirection.x,
    dy: ball.specialElbowDirection.y,
    range: ball.specialElbowRange,
    radius: ball.specialElbowRadius
  };
}

function toOwner(team: Team): "me" | "foe" {
  return team === "blue" ? "me" : "foe";
}

function eventToExplosion(event: BattleEvent, index: number): MobileExplosion | undefined {
  if (event.type !== "trait_triggered") {
    return undefined;
  }
  if (
    event.trigger !== "collision_explosion" &&
    event.trigger !== "summon_death_explosion" &&
    event.trigger !== "huaqiang_melon_crack"
  ) {
    return undefined;
  }

  return {
    id: `boom-${event.tick}-${index}-${event.traitId}-${event.trigger}`,
    x: event.position.x,
    y: event.position.y,
    radius: Math.max(24, event.radius ?? defaultExplosionRadius(event.trigger)),
    kind: event.trigger === "huaqiang_melon_crack" ? "melon" : "white"
  };
}

function defaultExplosionRadius(trigger: string): number {
  if (trigger === "collision_explosion") {
    return 82;
  }
  return 70;
}

function eventToFloater(event: BattleEvent, index: number): MobileFloater | undefined {
  if (event.type === "damage") {
    return {
      id: `f-${event.tick}-${index}-${event.targetId}-${event.amount}`,
      x: event.position.x,
      y: event.position.y,
      text: `-${Math.round(event.amount)}`,
      kind: event.tags.includes("collision") ? "crit" : "dmg"
    };
  }
  if (event.type === "heal") {
    return {
      id: `f-${event.tick}-${index}-${event.targetId}-heal`,
      x: event.position.x,
      y: event.position.y,
      text: `+${Math.round(event.amount)}`,
      kind: "heal"
    };
  }
  return undefined;
}

function eventToLogLine(event: BattleEvent): MobileLogLine | undefined {
  const t = formatTickTime(event.tick);
  if (event.type === "damage") {
    const tag = event.tags.includes("projectile") ? "子弹" : event.tags.includes("dot") ? "持续伤害" : "碰撞";
    return { t, text: `${tag}命中 ${event.targetId} -${event.amount.toFixed(1)}`, kind: "hit" };
  }
  if (event.type === "heal") {
    return { t, text: `${event.targetId} 回复 ${event.amount.toFixed(1)}`, kind: "sys" };
  }
  if (event.type === "collision") {
    return { t, text: "双方发生碰撞", kind: "hit" };
  }
  if (event.type === "trait_triggered") {
    const traitName = event.traitId ? getMobileTrait(event.traitId)?.name : undefined;
    const statusName = statusLabels[event.trigger as StatusEffectId] ?? event.trigger;
    const label = traitName ?? statusName;
    const color = statusColors[event.trigger as StatusEffectId];
    void color;
    return { t, text: `触发 ${label}`, kind: "status" };
  }
  if (event.type === "wall_bounce") {
    return { t, text: "撞墙反弹蓄势", kind: "sys" };
  }
  if (event.type === "match_end") {
    const result = event.result.winner === "draw" ? "平局" : event.result.winner === "blue" ? "我方获胜" : "挑战失败";
    return { t, text: result, kind: event.result.winner === "blue" ? "kill" : "sys" };
  }
  return undefined;
}

function eventToSfx(event: BattleEvent): MobileSfxKey | undefined {
  if (event.type === "collision") {
    return "battle.ball_hit";
  }
  if (event.type === "wall_bounce") {
    return "battle.wall_hit";
  }
  if (event.type === "damage") {
    if (event.tags.includes("explosion")) {
      return "battle.explosion";
    }
    if (event.tags.includes("projectile")) {
      return "battle.projectile_hit";
    }
    if (event.tags.includes("collision") && event.amount >= 10) {
      return "battle.heavy_hit";
    }
    return undefined;
  }
  if (event.type === "match_end") {
    if (event.result.winner === "draw") {
      return undefined;
    }
    return event.result.winner === "blue" ? "battle.win" : "battle.lose";
  }
  if (event.type !== "trait_triggered") {
    return undefined;
  }
  if (event.trigger === "projectile_fire" || event.trigger === "turret_fire" || event.trigger === "basketball_fire" || event.trigger === "projectile_split") {
    return "battle.projectile_fire";
  }
  if (event.trigger === "projectile_bounce") {
    return "battle.wall_hit";
  }
  if (event.trigger === "collision_explosion" || event.trigger === "summon_death_explosion") {
    return "battle.explosion";
  }
  if (event.trigger === "status_apply") {
    return "battle.status_apply";
  }
  if (event.trigger === "shield_refresh" || event.trigger === "shield_absorb") {
    return "battle.shield_gain";
  }
  if (event.trigger === "revive_once") {
    return "battle.revive";
  }
  if (event.trigger === "clone_spawn" || event.trigger === "turret_spawn" || event.trigger === "death_split") {
    return "battle.spawn";
  }
  if (event.trigger === "elbow_hit") {
    return "special.elbow_strike";
  }
  if (event.trigger === "basketball_hit" || event.trigger === "basketball_bounce") {
    return "special.bounce_basketball";
  }
  if (event.trigger === "hajimi_guard_ready" || event.trigger === "hajimi_guard_consume") {
    return "special.hajimi_guard";
  }
  if (event.trigger === "blade_shield_hit") {
    return "special.blade_shield_hit";
  }
  if (event.trigger === "blade_shield_guard_block" || event.trigger === "blade_shield_guard_reduce") {
    return "special.blade_shield_guard";
  }
  if (event.trigger === "tiger_gaze_lock") {
    return "special.dongbei_tiger_gaze";
  }
  if (
    event.trigger === "huaqiang_melon_throw" ||
    event.trigger === "huaqiang_knife_throw" ||
    event.trigger === "huaqiang_melon_crack" ||
    event.trigger === "huaqiang_melon_hit" ||
    event.trigger === "huaqiang_knife_hit"
  ) {
    return "special.huaqiang_melon";
  }
  if (event.trigger === "black_hand_grab") {
    return "special.shenying_black_hand";
  }
  return undefined;
}

function formatTickTime(tick: number): string {
  const seconds = Math.max(0, Math.floor(tick / 60));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
