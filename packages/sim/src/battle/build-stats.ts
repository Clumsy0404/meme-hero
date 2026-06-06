import { baseBallStats, getRequiredTraitDefinition, validateBuildConfig } from "@ball-brawl/content";
import type { BallStats, BuildConfig, StatKey, StatModifier } from "@ball-brawl/shared";

const statKeys: StatKey[] = [
  "maxHp",
  "radius",
  "moveSpeed",
  "collisionDamage",
  "collisionCooldown",
  "knockback",
  "damageReduction",
  "hpRegen"
];

type ModifierBucket = {
  add: number;
  percentAdd: number;
  multiplier: number;
};

export function createStatsForBuild(build: BuildConfig, baseStats: BallStats = baseBallStats): BallStats {
  const validation = validateBuildConfig(build);
  if (!validation.ok) {
    throw new Error(`Invalid build config: ${validation.issues.map((issue) => issue.message).join(" ")}`);
  }

  const buckets = createModifierBuckets();
  for (const traitId of build.traits) {
    const trait = getRequiredTraitDefinition(traitId);
    for (const modifier of trait.numeric.statModifiers ?? []) {
      addModifier(buckets[modifier.stat], modifier);
    }
  }

  const stats = clampStats(applyModifierBuckets(baseStats, buckets));
  if (hasProjectileTrait(build)) {
    stats.collisionDamage = 0;
  }
  return stats;
}

function hasProjectileTrait(build: BuildConfig): boolean {
  return build.traits.some((traitId) => getRequiredTraitDefinition(traitId).mainType === "projectile");
}

function createModifierBuckets(): Record<StatKey, ModifierBucket> {
  return Object.fromEntries(
    statKeys.map((key) => [
      key,
      {
        add: 0,
        percentAdd: 0,
        multiplier: 1
      }
    ])
  ) as Record<StatKey, ModifierBucket>;
}

function addModifier(bucket: ModifierBucket, modifier: StatModifier): void {
  if (modifier.op === "add") {
    bucket.add += modifier.value;
    return;
  }
  if (modifier.op === "percentAdd") {
    bucket.percentAdd += modifier.value;
    return;
  }
  bucket.multiplier *= modifier.value;
}

function applyModifierBuckets(baseStats: BallStats, buckets: Record<StatKey, ModifierBucket>): BallStats {
  const stats = { ...baseStats };
  for (const key of statKeys) {
    const bucket = buckets[key];
    stats[key] = (baseStats[key] + bucket.add) * (1 + bucket.percentAdd) * bucket.multiplier;
  }
  return stats;
}

function clampStats(stats: BallStats): BallStats {
  return {
    maxHp: Math.max(1, stats.maxHp),
    radius: clamp(stats.radius, 20, 108),
    moveSpeed: Math.max(20, stats.moveSpeed),
    collisionDamage: Math.max(0, stats.collisionDamage),
    collisionCooldown: Math.max(0.12, stats.collisionCooldown),
    knockback: Math.max(0, stats.knockback),
    damageReduction: clamp(stats.damageReduction, 0, 0.8),
    hpRegen: Math.max(0, stats.hpRegen)
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
