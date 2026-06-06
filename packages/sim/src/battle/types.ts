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
  ownerId?: string;
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
  summon: SummonMechanics;
  status: StatusMechanics;
  rule: RuleMechanics;
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

export type SummonMechanics = {
  maxClones: number;
  cloneCooldown: number;
  cloneHpRatio: number;
  splitCount: number;
  splitHpRatio: number;
  cloneDeathExplosionDamage: number;
  cloneDeathExplosionRadius: number;
  turretLimit: number;
  turretCooldown: number;
  turretLifetime: number;
  turretHp: number;
  turretRadius: number;
  turretProjectileDamage: number;
  turretProjectileCooldown: number;
  turretProjectileSpeed: number;
  turretProjectileRadius: number;
  turretProjectileLifetime: number;
};

export type StatusEffectId = "burn" | "poison" | "slow" | "vulnerable";

export type StatusApplicationMechanics = {
  traitId: string;
  statusId: StatusEffectId;
  chance: number;
  duration: number;
  tickDamage: number;
  slowPercent: number;
  vulnerablePercent: number;
};

export type StatusMechanics = {
  onHit: StatusApplicationMechanics[];
  shieldValue: number;
  shieldCooldown: number;
};

export type ActiveStatusEffect = {
  id: StatusEffectId;
  traitId: string;
  sourceId: string;
  remaining: number;
  tickDamage: number;
  slowPercent: number;
  vulnerablePercent: number;
};

export type RuleMechanics = {
  lowHpRageThreshold: number;
  lowHpRageDuration: number;
  lowHpRageSpeedMultiplier: number;
  lowHpRageCollisionDamageMultiplier: number;
  killGrowthMaxStacks: number;
  killGrowthCollisionDamagePercentPerStack: number;
  killGrowthMoveSpeedPercentPerStack: number;
  timeGrowthMaxStacks: number;
  timeGrowthInterval: number;
  timeGrowthCollisionDamagePercentPerStack: number;
  timeGrowthMoveSpeedPercentPerStack: number;
  reviveHpRatio: number;
};

export type BallRuntimeState = {
  lifestealWindowStart: number;
  lifestealHealedInWindow: number;
  collisionExplosionCooldown: number;
  wallChargeStacks: number;
  projectileCooldown: number;
  cloneCooldown: number;
  turretCooldown: number;
  deathSplitTriggered: boolean;
  deathHandled: boolean;
  deathDamageTags: DamageTag[];
  statuses: ActiveStatusEffect[];
  shield: number;
  shieldCooldown: number;
  lowHpRageTriggered: boolean;
  lowHpRageRemaining: number;
  killGrowthStacks: number;
  timeGrowthStacks: number;
  timeGrowthTimer: number;
  reviveTriggered: boolean;
  lastDamageSourceId: string | null;
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

export type TurretState = {
  id: string;
  team: Team;
  ownerId: string;
  alive: boolean;
  hp: number;
  maxHp: number;
  radius: number;
  lifetime: number;
  projectileCooldown: number;
  position: Vec2;
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
  turrets: TurretState[];
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
  statuses: RenderStatusEffect[];
  shield: number;
  maxShield: number;
  lowHpRageRemaining: number;
  killGrowthStacks: number;
  timeGrowthStacks: number;
  reviveTriggered: boolean;
  position: Vec2;
};

export type RenderStatusEffect = {
  id: StatusEffectId;
  remaining: number;
};

export type RenderProjectile = {
  id: string;
  team: Team;
  radius: number;
  position: Vec2;
};

export type RenderTurret = {
  id: string;
  team: Team;
  hp: number;
  maxHp: number;
  radius: number;
  position: Vec2;
};

export type WorldSnapshot = {
  tick: number;
  time: number;
  arena: ArenaState;
  balls: RenderBall[];
  projectiles: RenderProjectile[];
  turrets: RenderTurret[];
  events: BattleEvent[];
  result?: BattleResult;
};
