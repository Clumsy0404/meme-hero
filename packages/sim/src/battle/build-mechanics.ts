import { getRequiredTraitDefinition } from "@ball-brawl/content";
import type { BattleBalanceOverrides, BuildConfig } from "@ball-brawl/shared";

import type {
  BallMechanics,
  BallRuntimeState,
  CollisionMechanics,
  ProjectileMechanics,
  RuleMechanics,
  SpecialMechanics,
  StatusEffectId,
  StatusMechanics,
  SummonMechanics
} from "./types";
import { mergeTraitNumericConfig } from "./trait-overrides";

type ProjectileMechanicsConfig = Pick<ProjectileMechanics, "damage" | "cooldown" | "speed" | "radius" | "lifetime">;
type TurretMechanicsConfig = Pick<
  SummonMechanics,
  | "turretHp"
  | "turretRadius"
  | "turretProjectileDamage"
  | "turretProjectileCooldown"
  | "turretProjectileSpeed"
  | "turretProjectileRadius"
  | "turretProjectileLifetime"
>;

const emptyCollisionMechanics: CollisionMechanics = {
  lifestealRatio: 0,
  healPerSecondLimit: 0,
  reflectRatio: 0,
  explosionDamage: 0,
  explosionRadius: 0,
  explosionCooldown: 0,
  wallChargeMaxStacks: 0,
  wallChargeDamagePercentPerStack: 0
};

export const defaultProjectileMechanicsConfig: ProjectileMechanicsConfig = {
  damage: 2,
  cooldown: 1.1,
  speed: 280,
  radius: 12,
  lifetime: 3.2
};

const baseProjectileMechanics: ProjectileMechanics = {
  enabled: false,
  ...defaultProjectileMechanicsConfig,
  extraProjectiles: 0,
  spreadAngleDeg: 0,
  bounces: 0,
  homingStrength: 0,
  pierces: 0,
  splitCount: 0,
  childRadiusMultiplier: 0.72
};

export const defaultTurretMechanicsConfig: TurretMechanicsConfig = {
  turretHp: 18,
  turretRadius: 36,
  turretProjectileDamage: 1,
  turretProjectileCooldown: 1.8,
  turretProjectileSpeed: 280,
  turretProjectileRadius: 10,
  turretProjectileLifetime: 3
};

const emptySummonMechanics: SummonMechanics = {
  maxClones: 0,
  cloneCooldown: 0,
  cloneHpRatio: 0.35,
  splitCount: 0,
  splitHpRatio: 0.5,
  cloneDeathExplosionDamage: 0,
  cloneDeathExplosionRadius: 0,
  turretLimit: 0,
  turretCooldown: 0,
  turretLifetime: 0,
  ...defaultTurretMechanicsConfig
};

const emptyStatusMechanics: StatusMechanics = {
  onHit: [],
  shieldValue: 0,
  shieldCooldown: 0
};

const emptyRuleMechanics: RuleMechanics = {
  lowHpRageThreshold: 0.3,
  lowHpRageDuration: 0,
  lowHpRageSpeedMultiplier: 1.35,
  lowHpRageCollisionDamageMultiplier: 1.35,
  killGrowthMaxStacks: 0,
  killGrowthCollisionDamagePercentPerStack: 0.08,
  killGrowthMoveSpeedPercentPerStack: 0.02,
  timeGrowthMaxStacks: 0,
  timeGrowthInterval: 10,
  timeGrowthCollisionDamagePercentPerStack: 0.04,
  timeGrowthMoveSpeedPercentPerStack: 0.02,
  reviveHpRatio: 0
};

export const emptySpecialMechanics: SpecialMechanics = {
  elbowCooldown: 0,
  elbowWindow: 0,
  elbowDamageMultiplier: 1,
  elbowKnockbackMultiplier: 1,
  elbowDashSpeedMultiplier: 1,
  elbowDashTurnMultiplier: 1,
  elbowHitboxRangeMultiplier: 0,
  elbowHitboxRadiusMultiplier: 0,
  basketballCooldown: 0,
  basketballDamage: 0,
  basketballSpeed: 0,
  basketballRadius: 0,
  basketballLifetime: 0,
  basketballBounces: 0,
  basketballLimit: 0,
  hajimiCooldown: 0,
  hajimiDuration: 0,
  hajimiCollisionReduction: 0,
  hajimiSelfKnockbackMultiplier: 1,
  hajimiAttackerKnockbackMultiplier: 1,
  bladeShieldBladeDuration: 0,
  bladeShieldShieldDuration: 0,
  bladeShieldBladeDamageMultiplier: 1,
  bladeShieldRangeMultiplier: 1,
  bladeShieldDamageReduction: 0,
  bladeShieldKnockbackMultiplier: 1,
  bladeShieldMoveSpeedMultiplier: 1,
  tigerGazeCooldown: 0,
  tigerGazeDuration: 0,
  tigerGazeSlowPercent: 0,
  tigerGazeVulnerablePercent: 0,
  huaqiangCooldown: 0,
  huaqiangMelonDamage: 0,
  huaqiangMelonSplashDamage: 0,
  huaqiangMelonSplashRadius: 0,
  huaqiangMelonSpeed: 0,
  huaqiangMelonRadius: 0,
  huaqiangMelonLifetime: 0,
  huaqiangKnifeDamage: 0,
  huaqiangKnifeSpeed: 0,
  huaqiangKnifeRadius: 0,
  huaqiangKnifeLifetime: 0,
  blackHandCooldown: 0,
  blackHandWarningDuration: 0,
  blackHandGrabDuration: 0,
  blackHandDragStrength: 0,
  blackHandSlowPercent: 0,
  blackHandSlowDuration: 0
};

export function createMechanicsForBuild(build: BuildConfig, overrides?: BattleBalanceOverrides): BallMechanics {
  const collision = { ...emptyCollisionMechanics };
  const projectile = applyProjectileOverrides({ ...baseProjectileMechanics }, overrides?.projectile);
  const summon = applyTurretOverrides({ ...emptySummonMechanics }, overrides?.turret);
  const status: StatusMechanics = { ...emptyStatusMechanics, onHit: [] };
  const rule = { ...emptyRuleMechanics };
  const special = { ...emptySpecialMechanics };
  let fireRateMultiplier = 1;

  for (const traitId of build.traits) {
    const trait = getRequiredTraitDefinition(traitId);
    const numeric = mergeTraitNumericConfig(trait.id, trait.numeric, overrides);
    const collisionConfig = numeric.collision;
    if (collisionConfig && trait.mainType === "collision") {
      collision.lifestealRatio = Math.max(collision.lifestealRatio, collisionConfig.lifestealRatio ?? 0);
      collision.healPerSecondLimit = Math.max(collision.healPerSecondLimit, collisionConfig.healPerSecondLimit ?? 0);
      collision.reflectRatio = Math.max(collision.reflectRatio, collisionConfig.reflectRatio ?? 0);
      collision.explosionDamage = Math.max(collision.explosionDamage, collisionConfig.explosionDamage ?? 0);
      collision.explosionRadius = Math.max(collision.explosionRadius, collisionConfig.explosionRadius ?? 0);
      collision.explosionCooldown = Math.max(collision.explosionCooldown, collisionConfig.explosionCooldown ?? 0);
      collision.wallChargeMaxStacks = Math.max(collision.wallChargeMaxStacks, collisionConfig.wallChargeMaxStacks ?? 0);
      collision.wallChargeDamagePercentPerStack = Math.max(
        collision.wallChargeDamagePercentPerStack,
        collisionConfig.wallChargeDamagePercentPerStack ?? 0
      );
    }

    const projectileConfig = numeric.projectile;
    if (projectileConfig && trait.mainType === "projectile") {
      projectile.enabled = true;
      projectile.damage *= projectileConfig.damageMultiplier ?? 1;
      projectile.speed *= projectileConfig.projectileSpeedMultiplier ?? 1;
      projectile.radius *= projectileConfig.projectileRadiusMultiplier ?? 1;
      projectile.extraProjectiles += projectileConfig.extraProjectiles ?? 0;
      projectile.spreadAngleDeg = Math.max(projectile.spreadAngleDeg, projectileConfig.spreadAngleDeg ?? 0);
      projectile.bounces = Math.max(projectile.bounces, projectileConfig.bounces ?? 0);
      projectile.homingStrength = Math.max(projectile.homingStrength, projectileConfig.homingStrength ?? 0);
      projectile.pierces = Math.max(projectile.pierces, projectileConfig.pierces ?? 0);
      projectile.splitCount = Math.max(projectile.splitCount, projectileConfig.splitCount ?? 0);
      projectile.childRadiusMultiplier = Math.min(
        projectile.childRadiusMultiplier,
        projectileConfig.projectileRadiusMultiplier ?? projectile.childRadiusMultiplier
      );
      fireRateMultiplier *= projectileConfig.fireRateMultiplier ?? 1;
    }

    const summonConfig = numeric.summon;
    if (summonConfig && trait.mainType === "summon") {
      summon.maxClones = Math.max(summon.maxClones, summonConfig.maxClones ?? 0);
      summon.cloneCooldown = Math.max(summon.cloneCooldown, summonConfig.cloneCooldown ?? 0);
      summon.cloneHpRatio = Math.max(summon.cloneHpRatio, summonConfig.cloneHpRatio ?? summon.cloneHpRatio);
      summon.splitCount = Math.max(summon.splitCount, summonConfig.splitCount ?? 0);
      summon.splitHpRatio = Math.max(summon.splitHpRatio, summonConfig.splitHpRatio ?? summon.splitHpRatio);
      summon.turretLimit = Math.max(summon.turretLimit, summonConfig.turretLimit ?? 0);
      summon.turretCooldown = Math.max(summon.turretCooldown, summonConfig.turretCooldown ?? 0);
      summon.turretLifetime = Math.max(summon.turretLifetime, summonConfig.turretLifetime ?? 0);
    }

    if (trait.behaviorKeys.includes("summon_death_explosion") && collisionConfig) {
      summon.cloneDeathExplosionDamage = Math.max(summon.cloneDeathExplosionDamage, collisionConfig.explosionDamage ?? 0);
      summon.cloneDeathExplosionRadius = Math.max(summon.cloneDeathExplosionRadius, collisionConfig.explosionRadius ?? 0);
    }

    const statusConfig = numeric.status;
    if (statusConfig && trait.mainType === "status") {
      if (statusConfig.statusId === "shield") {
        status.shieldValue = Math.max(status.shieldValue, statusConfig.shieldValue ?? 0);
        status.shieldCooldown = Math.max(status.shieldCooldown, statusConfig.shieldCooldown ?? 0);
      } else if (isStatusEffectId(statusConfig.statusId)) {
        status.onHit.push({
          traitId: trait.id,
          statusId: statusConfig.statusId,
          chance: statusConfig.chance ?? 1,
          duration: statusConfig.duration ?? 0,
          tickDamage: statusConfig.tickDamage ?? 0,
          slowPercent: statusConfig.slowPercent ?? 0,
          vulnerablePercent: statusConfig.vulnerablePercent ?? 0
        });
      }
    }

    const ruleConfig = numeric.rule;
    if (ruleConfig && trait.mainType === "rule") {
      if (ruleConfig.trigger === "hp_below_30_percent") {
        rule.lowHpRageDuration = Math.max(rule.lowHpRageDuration, ruleConfig.duration ?? 0);
      }
      if (ruleConfig.trigger === "kill") {
        rule.killGrowthMaxStacks = Math.max(rule.killGrowthMaxStacks, ruleConfig.maxStacks ?? 0);
      }
      if (ruleConfig.trigger === "time") {
        rule.timeGrowthMaxStacks = Math.max(rule.timeGrowthMaxStacks, ruleConfig.maxStacks ?? 0);
      }
      if (ruleConfig.trigger === "death") {
        rule.reviveHpRatio = Math.max(rule.reviveHpRatio, ruleConfig.reviveHpRatio ?? 0);
      }
    }

    const specialConfig = numeric.special;
    if (specialConfig) {
      special.elbowCooldown = Math.max(special.elbowCooldown, specialConfig.elbowCooldown ?? 0);
      special.elbowWindow = Math.max(special.elbowWindow, specialConfig.elbowWindow ?? 0);
      special.elbowDamageMultiplier = Math.max(special.elbowDamageMultiplier, specialConfig.elbowDamageMultiplier ?? special.elbowDamageMultiplier);
      special.elbowKnockbackMultiplier = Math.max(
        special.elbowKnockbackMultiplier,
        specialConfig.elbowKnockbackMultiplier ?? special.elbowKnockbackMultiplier
      );
      special.elbowDashSpeedMultiplier = Math.max(
        special.elbowDashSpeedMultiplier,
        specialConfig.elbowDashSpeedMultiplier ?? special.elbowDashSpeedMultiplier
      );
      special.elbowDashTurnMultiplier = Math.max(
        special.elbowDashTurnMultiplier,
        specialConfig.elbowDashTurnMultiplier ?? special.elbowDashTurnMultiplier
      );
      special.elbowHitboxRangeMultiplier = Math.max(special.elbowHitboxRangeMultiplier, specialConfig.elbowHitboxRangeMultiplier ?? 0);
      special.elbowHitboxRadiusMultiplier = Math.max(special.elbowHitboxRadiusMultiplier, specialConfig.elbowHitboxRadiusMultiplier ?? 0);
      special.basketballCooldown = Math.max(special.basketballCooldown, specialConfig.basketballCooldown ?? 0);
      special.basketballDamage = Math.max(special.basketballDamage, specialConfig.basketballDamage ?? 0);
      special.basketballSpeed = Math.max(special.basketballSpeed, specialConfig.basketballSpeed ?? 0);
      special.basketballRadius = Math.max(special.basketballRadius, specialConfig.basketballRadius ?? 0);
      special.basketballLifetime = Math.max(special.basketballLifetime, specialConfig.basketballLifetime ?? 0);
      special.basketballBounces = Math.max(special.basketballBounces, specialConfig.basketballBounces ?? 0);
      special.basketballLimit = Math.max(special.basketballLimit, specialConfig.basketballLimit ?? 0);
      special.hajimiCooldown = Math.max(special.hajimiCooldown, specialConfig.hajimiCooldown ?? 0);
      special.hajimiDuration = Math.max(special.hajimiDuration, specialConfig.hajimiDuration ?? 0);
      special.hajimiCollisionReduction = Math.max(special.hajimiCollisionReduction, specialConfig.hajimiCollisionReduction ?? 0);
      special.hajimiSelfKnockbackMultiplier = Math.min(
        special.hajimiSelfKnockbackMultiplier,
        specialConfig.hajimiSelfKnockbackMultiplier ?? special.hajimiSelfKnockbackMultiplier
      );
      special.hajimiAttackerKnockbackMultiplier = Math.max(
        special.hajimiAttackerKnockbackMultiplier,
        specialConfig.hajimiAttackerKnockbackMultiplier ?? special.hajimiAttackerKnockbackMultiplier
      );
      special.bladeShieldBladeDuration = Math.max(special.bladeShieldBladeDuration, specialConfig.bladeShieldBladeDuration ?? 0);
      special.bladeShieldShieldDuration = Math.max(special.bladeShieldShieldDuration, specialConfig.bladeShieldShieldDuration ?? 0);
      special.bladeShieldBladeDamageMultiplier = Math.max(
        special.bladeShieldBladeDamageMultiplier,
        specialConfig.bladeShieldBladeDamageMultiplier ?? special.bladeShieldBladeDamageMultiplier
      );
      special.bladeShieldRangeMultiplier = Math.max(
        special.bladeShieldRangeMultiplier,
        specialConfig.bladeShieldRangeMultiplier ?? special.bladeShieldRangeMultiplier
      );
      special.bladeShieldDamageReduction = Math.max(special.bladeShieldDamageReduction, specialConfig.bladeShieldDamageReduction ?? 0);
      special.bladeShieldKnockbackMultiplier = Math.max(
        special.bladeShieldKnockbackMultiplier,
        specialConfig.bladeShieldKnockbackMultiplier ?? special.bladeShieldKnockbackMultiplier
      );
      special.bladeShieldMoveSpeedMultiplier = Math.min(
        special.bladeShieldMoveSpeedMultiplier,
        specialConfig.bladeShieldMoveSpeedMultiplier ?? special.bladeShieldMoveSpeedMultiplier
      );
      special.tigerGazeCooldown = Math.max(special.tigerGazeCooldown, specialConfig.tigerGazeCooldown ?? 0);
      special.tigerGazeDuration = Math.max(special.tigerGazeDuration, specialConfig.tigerGazeDuration ?? 0);
      special.tigerGazeSlowPercent = Math.max(special.tigerGazeSlowPercent, specialConfig.tigerGazeSlowPercent ?? 0);
      special.tigerGazeVulnerablePercent = Math.max(special.tigerGazeVulnerablePercent, specialConfig.tigerGazeVulnerablePercent ?? 0);
      special.huaqiangCooldown = Math.max(special.huaqiangCooldown, specialConfig.huaqiangCooldown ?? 0);
      special.huaqiangMelonDamage = Math.max(special.huaqiangMelonDamage, specialConfig.huaqiangMelonDamage ?? 0);
      special.huaqiangMelonSplashDamage = Math.max(special.huaqiangMelonSplashDamage, specialConfig.huaqiangMelonSplashDamage ?? 0);
      special.huaqiangMelonSplashRadius = Math.max(special.huaqiangMelonSplashRadius, specialConfig.huaqiangMelonSplashRadius ?? 0);
      special.huaqiangMelonSpeed = Math.max(special.huaqiangMelonSpeed, specialConfig.huaqiangMelonSpeed ?? 0);
      special.huaqiangMelonRadius = Math.max(special.huaqiangMelonRadius, specialConfig.huaqiangMelonRadius ?? 0);
      special.huaqiangMelonLifetime = Math.max(special.huaqiangMelonLifetime, specialConfig.huaqiangMelonLifetime ?? 0);
      special.huaqiangKnifeDamage = Math.max(special.huaqiangKnifeDamage, specialConfig.huaqiangKnifeDamage ?? 0);
      special.huaqiangKnifeSpeed = Math.max(special.huaqiangKnifeSpeed, specialConfig.huaqiangKnifeSpeed ?? 0);
      special.huaqiangKnifeRadius = Math.max(special.huaqiangKnifeRadius, specialConfig.huaqiangKnifeRadius ?? 0);
      special.huaqiangKnifeLifetime = Math.max(special.huaqiangKnifeLifetime, specialConfig.huaqiangKnifeLifetime ?? 0);
      special.blackHandCooldown = Math.max(special.blackHandCooldown, specialConfig.blackHandCooldown ?? 0);
      special.blackHandWarningDuration = Math.max(special.blackHandWarningDuration, specialConfig.blackHandWarningDuration ?? 0);
      special.blackHandGrabDuration = Math.max(special.blackHandGrabDuration, specialConfig.blackHandGrabDuration ?? 0);
      special.blackHandDragStrength = Math.max(special.blackHandDragStrength, specialConfig.blackHandDragStrength ?? 0);
      special.blackHandSlowPercent = Math.max(special.blackHandSlowPercent, specialConfig.blackHandSlowPercent ?? 0);
      special.blackHandSlowDuration = Math.max(special.blackHandSlowDuration, specialConfig.blackHandSlowDuration ?? 0);
    }
  }

  projectile.cooldown = projectile.enabled ? projectile.cooldown / Math.max(0.25, fireRateMultiplier) : projectile.cooldown;

  return { collision, projectile, summon, status, rule, special };
}

function applyProjectileOverrides(
  mechanics: ProjectileMechanics,
  overrides: BattleBalanceOverrides["projectile"] | undefined
): ProjectileMechanics {
  if (!overrides) {
    return mechanics;
  }

  mechanics.damage = readNumberAtLeast(overrides.damage, mechanics.damage, 0);
  mechanics.cooldown = readNumberAtLeast(overrides.cooldown, mechanics.cooldown, 0.05);
  mechanics.speed = readNumberAtLeast(overrides.speed, mechanics.speed, 1);
  mechanics.radius = readNumberAtLeast(overrides.radius, mechanics.radius, 1);
  mechanics.lifetime = readNumberAtLeast(overrides.lifetime, mechanics.lifetime, 0.05);
  return mechanics;
}

function applyTurretOverrides(
  mechanics: SummonMechanics,
  overrides: BattleBalanceOverrides["turret"] | undefined
): SummonMechanics {
  if (!overrides) {
    return mechanics;
  }

  mechanics.turretHp = readNumberAtLeast(overrides.turretHp, mechanics.turretHp, 1);
  mechanics.turretRadius = readNumberAtLeast(overrides.turretRadius, mechanics.turretRadius, 1);
  mechanics.turretProjectileDamage = readNumberAtLeast(overrides.turretProjectileDamage, mechanics.turretProjectileDamage, 0);
  mechanics.turretProjectileCooldown = readNumberAtLeast(overrides.turretProjectileCooldown, mechanics.turretProjectileCooldown, 0.05);
  mechanics.turretProjectileSpeed = readNumberAtLeast(overrides.turretProjectileSpeed, mechanics.turretProjectileSpeed, 1);
  mechanics.turretProjectileRadius = readNumberAtLeast(overrides.turretProjectileRadius, mechanics.turretProjectileRadius, 1);
  mechanics.turretProjectileLifetime = readNumberAtLeast(overrides.turretProjectileLifetime, mechanics.turretProjectileLifetime, 0.05);
  return mechanics;
}

export function createRuntimeState(mechanics?: BallMechanics): BallRuntimeState {
  const special = mechanics?.special;
  return {
    lifestealWindowStart: 0,
    lifestealHealedInWindow: 0,
    collisionExplosionCooldown: 0,
    wallChargeStacks: 0,
    projectileCooldown: 0,
    cloneCooldown: 0,
    turretCooldown: 0,
    deathSplitTriggered: false,
    deathHandled: false,
    deathDamageTags: [],
    statuses: [],
    shield: 0,
    shieldCooldown: 0,
    lowHpRageTriggered: false,
    lowHpRageRemaining: 0,
    killGrowthStacks: 0,
    timeGrowthStacks: 0,
    timeGrowthTimer: 0,
    reviveTriggered: false,
    lastDamageSourceId: null,
    specialElbowCooldown: special?.elbowCooldown ?? 0,
    specialElbowWindowRemaining: 0,
    specialElbowDirection: { x: 1, y: 0 },
    specialElbowHitAvailable: false,
    specialBasketballCooldown: special?.basketballCooldown ?? 0,
    specialHajimiCooldown: special?.hajimiCooldown ?? 0,
    specialHajimiGuardRemaining: 0,
    specialBladeShieldStance: special && special.bladeShieldBladeDuration > 0 ? "blade" : "none",
    specialBladeShieldRemaining: special?.bladeShieldBladeDuration ?? 0,
    specialTigerGazeCooldown: special?.tigerGazeCooldown ?? 0,
    specialTigerGazeTargetId: null,
    specialHuaqiangCooldown: special?.huaqiangCooldown ?? 0,
    specialHuaqiangNextKind: "melon",
    specialBlackHandCooldown: special?.blackHandCooldown ?? 0,
    specialBlackHandPhase: "idle",
    specialBlackHandPhaseRemaining: 0,
    specialBlackHandTargetId: null
  };
}

function isStatusEffectId(statusId: string): statusId is StatusEffectId {
  return statusId === "burn" || statusId === "poison" || statusId === "slow" || statusId === "vulnerable";
}

function readNumberAtLeast(value: number | undefined, fallback: number, min: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(min, value) : fallback;
}
