export type Team = "blue" | "red";

export type Vec2 = {
  x: number;
  y: number;
};

export const TRAITS_PER_BUILD = 3;

export type TraitId = string;

export type TraitType = "attribute" | "collision" | "projectile" | "summon" | "status" | "rule";
export type TraitRarity = "normal" | "legendary";

export type RepeatRule = { kind: "unique" } | { kind: "stackable"; maxStacks?: number };

export type StatKey =
  | "maxHp"
  | "radius"
  | "moveSpeed"
  | "collisionDamage"
  | "collisionCooldown"
  | "knockback"
  | "damageReduction"
  | "hpRegen";

export type StatModifierOperation = "add" | "percentAdd" | "multiplier";

export type StatModifier = {
  stat: StatKey;
  op: StatModifierOperation;
  value: number;
};

export type CollisionTraitConfig = {
  lifestealRatio?: number;
  healPerSecondLimit?: number;
  reflectRatio?: number;
  explosionDamage?: number;
  explosionRadius?: number;
  explosionCooldown?: number;
  wallChargeMaxStacks?: number;
  wallChargeDamagePercentPerStack?: number;
};

export type ProjectileTraitConfig = {
  damageMultiplier?: number;
  fireRateMultiplier?: number;
  projectileSpeedMultiplier?: number;
  projectileRadiusMultiplier?: number;
  extraProjectiles?: number;
  spreadAngleDeg?: number;
  bounces?: number;
  homingStrength?: number;
  pierces?: number;
  splitCount?: number;
};

export type SummonTraitConfig = {
  maxClones?: number;
  cloneCooldown?: number;
  cloneHpRatio?: number;
  splitCount?: number;
  splitHpRatio?: number;
  turretLimit?: number;
  turretCooldown?: number;
  turretLifetime?: number;
};

export type StatusTraitConfig = {
  statusId: string;
  chance?: number;
  duration?: number;
  tickDamage?: number;
  slowPercent?: number;
  vulnerablePercent?: number;
  shieldValue?: number;
  shieldCooldown?: number;
};

export type RuleTraitConfig = {
  trigger?: string;
  duration?: number;
  maxStacks?: number;
  reviveHpRatio?: number;
  hpCostPercent?: number;
};

export type SpecialTraitConfig = {
  elbowCooldown?: number;
  elbowWindow?: number;
  elbowDamageMultiplier?: number;
  elbowKnockbackMultiplier?: number;
  elbowDashSpeedMultiplier?: number;
  elbowDashTurnMultiplier?: number;
  elbowHitboxRangeMultiplier?: number;
  elbowHitboxRadiusMultiplier?: number;
  basketballCooldown?: number;
  basketballDamage?: number;
  basketballSpeed?: number;
  basketballRadius?: number;
  basketballLifetime?: number;
  basketballBounces?: number;
  basketballLimit?: number;
  hajimiCooldown?: number;
  hajimiDuration?: number;
  hajimiCollisionReduction?: number;
  hajimiSelfKnockbackMultiplier?: number;
  hajimiAttackerKnockbackMultiplier?: number;
  bladeShieldBladeDuration?: number;
  bladeShieldShieldDuration?: number;
  bladeShieldBladeDamageMultiplier?: number;
  bladeShieldRangeMultiplier?: number;
  bladeShieldDamageReduction?: number;
  bladeShieldKnockbackMultiplier?: number;
  bladeShieldMoveSpeedMultiplier?: number;
  tigerGazeCooldown?: number;
  tigerGazeDuration?: number;
  tigerGazeSlowPercent?: number;
  tigerGazeVulnerablePercent?: number;
  huaqiangCooldown?: number;
  huaqiangMelonDamage?: number;
  huaqiangMelonSplashDamage?: number;
  huaqiangMelonSplashRadius?: number;
  huaqiangMelonSpeed?: number;
  huaqiangMelonRadius?: number;
  huaqiangMelonLifetime?: number;
  huaqiangKnifeDamage?: number;
  huaqiangKnifeSpeed?: number;
  huaqiangKnifeRadius?: number;
  huaqiangKnifeLifetime?: number;
  blackHandCooldown?: number;
  blackHandWarningDuration?: number;
  blackHandGrabDuration?: number;
  blackHandDragStrength?: number;
  blackHandSlowPercent?: number;
  blackHandSlowDuration?: number;
};

export type TraitNumericConfig = {
  statModifiers?: StatModifier[];
  collision?: CollisionTraitConfig;
  projectile?: ProjectileTraitConfig;
  summon?: SummonTraitConfig;
  status?: StatusTraitConfig;
  rule?: RuleTraitConfig;
  special?: SpecialTraitConfig;
};

export type TraitDefinition = {
  id: TraitId;
  name: string;
  subtitle: string;
  mainType: TraitType;
  rarity?: TraitRarity;
  tags: string[];
  repeatRule: RepeatRule;
  description: string;
  numeric: TraitNumericConfig;
  behaviorKeys: string[];
};

export type BuildConfig = {
  version: string;
  name: string;
  skin: string;
  baseModel: string;
  traits: TraitId[];
};

export type MatchConfig = {
  version: string;
  seed: number;
  arenaId: string;
  blue: BuildConfig;
  red: BuildConfig;
};

export type BallStats = {
  maxHp: number;
  radius: number;
  moveSpeed: number;
  collisionDamage: number;
  collisionCooldown: number;
  knockback: number;
  damageReduction: number;
  hpRegen: number;
};

export type ProjectileBalanceOverrides = Partial<{
  damage: number;
  cooldown: number;
  speed: number;
  radius: number;
  lifetime: number;
}>;

export type TurretBalanceOverrides = Partial<{
  turretHp: number;
  turretRadius: number;
  turretProjectileDamage: number;
  turretProjectileCooldown: number;
  turretProjectileSpeed: number;
  turretProjectileRadius: number;
  turretProjectileLifetime: number;
}>;

export type TraitNumericBalanceOverrides = {
  statModifiers?: StatModifier[];
  collision?: CollisionTraitConfig;
  projectile?: ProjectileTraitConfig;
  summon?: SummonTraitConfig;
  status?: Partial<StatusTraitConfig>;
  rule?: RuleTraitConfig;
  special?: SpecialTraitConfig;
};

export type TraitBalanceOverrides = Partial<Record<TraitId, TraitNumericBalanceOverrides>>;

export type BattleBalanceOverrides = {
  baseStats?: Partial<BallStats>;
  projectile?: ProjectileBalanceOverrides;
  turret?: TurretBalanceOverrides;
  traits?: TraitBalanceOverrides;
};

export type BuildValidationIssueCode =
  | "missing_version"
  | "missing_base_model"
  | "invalid_trait_count"
  | "unknown_trait"
  | "unique_trait_repeated"
  | "stack_limit_exceeded"
  | "legendary_trait_limit_exceeded";

export type BuildValidationIssue = {
  code: BuildValidationIssueCode;
  message: string;
  traitId?: TraitId;
  slotIndex?: number;
};

export type BuildValidationResult = {
  ok: boolean;
  issues: BuildValidationIssue[];
};
