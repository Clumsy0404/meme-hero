import { getRequiredTraitDefinition } from "@ball-brawl/content";
import type { BuildConfig } from "@ball-brawl/shared";

import type {
  BallMechanics,
  BallRuntimeState,
  CollisionMechanics,
  ProjectileMechanics,
  RuleMechanics,
  StatusEffectId,
  StatusMechanics,
  SummonMechanics
} from "./types";

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

const baseProjectileMechanics: ProjectileMechanics = {
  enabled: false,
  damage: 2,
  cooldown: 1.1,
  speed: 280,
  radius: 12,
  lifetime: 3.2,
  extraProjectiles: 0,
  spreadAngleDeg: 0,
  bounces: 0,
  homingStrength: 0,
  pierces: 0,
  splitCount: 0,
  childRadiusMultiplier: 0.72
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
  turretHp: 18,
  turretRadius: 36,
  turretProjectileDamage: 1,
  turretProjectileCooldown: 1.8,
  turretProjectileSpeed: 280,
  turretProjectileRadius: 10,
  turretProjectileLifetime: 3
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

export function createMechanicsForBuild(build: BuildConfig): BallMechanics {
  const collision = { ...emptyCollisionMechanics };
  const projectile = { ...baseProjectileMechanics };
  const summon = { ...emptySummonMechanics };
  const status: StatusMechanics = { ...emptyStatusMechanics, onHit: [] };
  const rule = { ...emptyRuleMechanics };
  let fireRateMultiplier = 1;

  for (const traitId of build.traits) {
    const trait = getRequiredTraitDefinition(traitId);
    const collisionConfig = trait.numeric.collision;
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

    const projectileConfig = trait.numeric.projectile;
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

    const summonConfig = trait.numeric.summon;
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

    const statusConfig = trait.numeric.status;
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

    const ruleConfig = trait.numeric.rule;
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
  }

  projectile.cooldown = projectile.enabled ? projectile.cooldown / Math.max(0.25, fireRateMultiplier) : projectile.cooldown;

  return { collision, projectile, summon, status, rule };
}

export function createRuntimeState(): BallRuntimeState {
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
    lastDamageSourceId: null
  };
}

function isStatusEffectId(statusId: string): statusId is StatusEffectId {
  return statusId === "burn" || statusId === "poison" || statusId === "slow" || statusId === "vulnerable";
}
