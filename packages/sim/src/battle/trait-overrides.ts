import type { BattleBalanceOverrides, TraitId, TraitNumericConfig } from "@ball-brawl/shared";

export function mergeTraitNumericConfig(
  traitId: TraitId,
  numeric: TraitNumericConfig,
  overrides: BattleBalanceOverrides | undefined
): TraitNumericConfig {
  const override = overrides?.traits?.[traitId];
  if (!override) {
    return numeric;
  }

  const merged: TraitNumericConfig = {};
  assignIfDefined(merged, "statModifiers", override.statModifiers ?? numeric.statModifiers);
  assignIfDefined(merged, "collision", mergeConfig(numeric.collision, override.collision));
  assignIfDefined(merged, "projectile", mergeConfig(numeric.projectile, override.projectile));
  assignIfDefined(merged, "summon", mergeConfig(numeric.summon, override.summon));
  assignIfDefined(merged, "status", mergeStatusConfig(numeric.status, override.status));
  assignIfDefined(merged, "rule", mergeConfig(numeric.rule, override.rule));
  return merged;
}

function mergeConfig<T extends object>(base: T | undefined, override: T | undefined): T | undefined {
  if (!base && !override) {
    return undefined;
  }
  return { ...base, ...override } as T;
}

function mergeStatusConfig(
  base: TraitNumericConfig["status"] | undefined,
  override: Partial<NonNullable<TraitNumericConfig["status"]>> | undefined
): TraitNumericConfig["status"] | undefined {
  if (!override) {
    return base;
  }
  if (base) {
    return { ...base, ...override };
  }
  return typeof override.statusId === "string" ? (override as TraitNumericConfig["status"]) : undefined;
}

function assignIfDefined<Key extends keyof TraitNumericConfig>(
  target: TraitNumericConfig,
  key: Key,
  value: TraitNumericConfig[Key] | undefined
): void {
  if (value !== undefined) {
    target[key] = value;
  }
}
