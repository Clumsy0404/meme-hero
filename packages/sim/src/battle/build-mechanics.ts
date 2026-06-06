import { getRequiredTraitDefinition } from "@ball-brawl/content";
import type { BuildConfig } from "@ball-brawl/shared";

import type { BallMechanics, BallRuntimeState, CollisionMechanics } from "./types";

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

export function createMechanicsForBuild(build: BuildConfig): BallMechanics {
  const collision = { ...emptyCollisionMechanics };

  for (const traitId of build.traits) {
    const trait = getRequiredTraitDefinition(traitId);
    const config = trait.numeric.collision;
    if (!config || trait.mainType !== "collision") {
      continue;
    }

    collision.lifestealRatio = Math.max(collision.lifestealRatio, config.lifestealRatio ?? 0);
    collision.healPerSecondLimit = Math.max(collision.healPerSecondLimit, config.healPerSecondLimit ?? 0);
    collision.reflectRatio = Math.max(collision.reflectRatio, config.reflectRatio ?? 0);
    collision.explosionDamage = Math.max(collision.explosionDamage, config.explosionDamage ?? 0);
    collision.explosionRadius = Math.max(collision.explosionRadius, config.explosionRadius ?? 0);
    collision.explosionCooldown = Math.max(collision.explosionCooldown, config.explosionCooldown ?? 0);
    collision.wallChargeMaxStacks = Math.max(collision.wallChargeMaxStacks, config.wallChargeMaxStacks ?? 0);
    collision.wallChargeDamagePercentPerStack = Math.max(
      collision.wallChargeDamagePercentPerStack,
      config.wallChargeDamagePercentPerStack ?? 0
    );
  }

  return { collision };
}

export function createRuntimeState(): BallRuntimeState {
  return {
    lifestealWindowStart: 0,
    lifestealHealedInWindow: 0,
    collisionExplosionCooldown: 0,
    wallChargeStacks: 0
  };
}
