import type { BallStats, Team, Vec2 } from "@ball-brawl/shared";

import type { SeededRng } from "../rng/seeded-rng";

export type BallRole = "main" | "clone" | "split";

export type ArenaState = {
  id: string;
  width: number;
  height: number;
};

export type BallState = {
  id: string;
  team: Team;
  role: BallRole;
  alive: boolean;
  hp: number;
  stats: BallStats;
  mechanics: BallMechanics;
  runtime: BallRuntimeState;
  position: Vec2;
  velocity: Vec2;
  collisionTimers: Record<string, number>;
};

export type BallMechanics = {
  collision: CollisionMechanics;
  projectile: ProjectileMechanics;
};

export type CollisionMechanics = {
  lifestealRatio: number;
  healPerSecondLimit: number;
  reflectRatio: number;
  explosionDamage: number;
  explosionRadius: number;
  explosionCooldown: number;
  wallChargeMaxStacks: number;
  wallChargeDamagePercentPerStack: number;
};

export type ProjectileMechanics = {
  enabled: boolean;
  damage: number;
  cooldown: number;
  speed: number;
  radius: number;
  lifetime: number;
  extraProjectiles: number;
  spreadAngleDeg: number;
  bounces: number;
  homingStrength: number;
  pierces: number;
  splitCount: number;
  childRadiusMultiplier: number;
};

export type BallRuntimeState = {
  lifestealWindowStart: number;
  lifestealHealedInWindow: number;
  collisionExplosionCooldown: number;
  wallChargeStacks: number;
  projectileCooldown: number;
};

export type DamageTag = "collision" | "projectile" | "dot" | "explosion" | "reflect";

export type ProjectileState = {
  id: string;
  team: Team;
  ownerId: string;
  position: Vec2;
  velocity: Vec2;
  radius: number;
  damage: number;
  lifetime: number;
  bouncesLeft: number;
  piercesLeft: number;
  splitCount: number;
  childRadiusMultiplier: number;
  homingStrength: number;
  hitBallIds: string[];
  isChild: boolean;
};

export type DamageEvent = {
  type: "damage";
  tick: number;
  sourceId?: string;
  targetId: string;
  amount: number;
  tags: DamageTag[];
  position: Vec2;
};

export type CollisionEvent = {
  type: "collision";
  tick: number;
  aId: string;
  bId: string;
  position: Vec2;
};

export type WallBounceEvent = {
  type: "wall_bounce";
  tick: number;
  ballId: string;
  position: Vec2;
};

export type HealEvent = {
  type: "heal";
  tick: number;
  sourceId?: string;
  targetId: string;
  amount: number;
  position: Vec2;
};

export type TraitTriggeredEvent = {
  type: "trait_triggered";
  tick: number;
  ballId: string;
  traitId: string;
  trigger: string;
  position: Vec2;
  value?: number;
};

export type MatchEndEvent = {
  type: "match_end";
  tick: number;
  result: BattleResult;
};

export type BattleEvent = DamageEvent | CollisionEvent | WallBounceEvent | HealEvent | TraitTriggeredEvent | MatchEndEvent;

export type BattleEndReason = "main_ball_dead" | "double_ko" | "timeout";

export type BattleResult = {
  winner: Team | "draw";
  reason: BattleEndReason;
  duration: number;
  blueRemainingHp: number;
  redRemainingHp: number;
};

export type BattleWorldState = {
  version: string;
  tick: number;
  time: number;
  rng: SeededRng;
  arena: ArenaState;
  balls: BallState[];
  projectiles: ProjectileState[];
  events: BattleEvent[];
  nextEntityId: number;
  result?: BattleResult;
};

export type RenderBall = {
  id: string;
  team: Team;
  role: BallRole;
  alive: boolean;
  hp: number;
  maxHp: number;
  radius: number;
  wallChargeStacks: number;
  position: Vec2;
};

export type RenderProjectile = {
  id: string;
  team: Team;
  radius: number;
  position: Vec2;
};

export type WorldSnapshot = {
  tick: number;
  time: number;
  arena: ArenaState;
  balls: RenderBall[];
  projectiles: RenderProjectile[];
  events: BattleEvent[];
  result?: BattleResult;
};
