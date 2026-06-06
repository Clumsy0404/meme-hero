import { baseBallStats, traitDefinitions } from "@ball-brawl/content";
import { defaultProjectileMechanicsConfig, defaultTurretMechanicsConfig } from "@ball-brawl/sim";
import type {
  BallStats,
  BattleBalanceOverrides,
  CollisionTraitConfig,
  ProjectileBalanceOverrides,
  ProjectileTraitConfig,
  RuleTraitConfig,
  StatKey,
  StatModifier,
  StatModifierOperation,
  StatusTraitConfig,
  SummonTraitConfig,
  TraitBalanceOverrides,
  TraitId,
  TraitNumericBalanceOverrides,
  TurretBalanceOverrides
} from "@ball-brawl/shared";

export const DESIGNER_BALANCE_STORAGE_KEY = "small-ball-brawl.designer-balance.v1";

export type DesignerProjectileConfig = Required<ProjectileBalanceOverrides>;
export type DesignerTurretConfig = Required<TurretBalanceOverrides>;

export type DesignerBalanceConfig = {
  version: "0.1";
  baseStats: BallStats;
  projectile: DesignerProjectileConfig;
  turret: DesignerTurretConfig;
  traits: TraitBalanceOverrides;
};

type DesignerBalanceStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

type NumericBounds = {
  min: number;
  max?: number;
};

const baseStatBounds = {
  maxHp: { min: 1 },
  radius: { min: 1 },
  moveSpeed: { min: 1 },
  collisionDamage: { min: 0 },
  collisionCooldown: { min: 0.05 },
  knockback: { min: 0 },
  damageReduction: { min: 0, max: 0.95 },
  hpRegen: { min: 0 }
} satisfies Record<keyof BallStats, NumericBounds>;

const projectileBounds = {
  damage: { min: 0 },
  cooldown: { min: 0.05 },
  speed: { min: 1 },
  radius: { min: 1 },
  lifetime: { min: 0.05 }
} satisfies Record<keyof DesignerProjectileConfig, NumericBounds>;

const turretBounds = {
  turretHp: { min: 1 },
  turretRadius: { min: 1 },
  turretProjectileDamage: { min: 0 },
  turretProjectileCooldown: { min: 0.05 },
  turretProjectileSpeed: { min: 1 },
  turretProjectileRadius: { min: 1 },
  turretProjectileLifetime: { min: 0.05 }
} satisfies Record<keyof DesignerTurretConfig, NumericBounds>;

const knownTraitIds = new Set<TraitId>(traitDefinitions.map((trait) => trait.id));
const statKeys = new Set<StatKey>([
  "maxHp",
  "radius",
  "moveSpeed",
  "collisionDamage",
  "collisionCooldown",
  "knockback",
  "damageReduction",
  "hpRegen"
]);
const statModifierOperations = new Set<StatModifierOperation>(["add", "percentAdd", "multiplier"]);

const collisionTraitKeys = [
  "lifestealRatio",
  "healPerSecondLimit",
  "reflectRatio",
  "explosionDamage",
  "explosionRadius",
  "explosionCooldown",
  "wallChargeMaxStacks",
  "wallChargeDamagePercentPerStack"
] satisfies ReadonlyArray<keyof CollisionTraitConfig>;

const projectileTraitKeys = [
  "damageMultiplier",
  "fireRateMultiplier",
  "projectileSpeedMultiplier",
  "projectileRadiusMultiplier",
  "extraProjectiles",
  "spreadAngleDeg",
  "bounces",
  "homingStrength",
  "pierces",
  "splitCount"
] satisfies ReadonlyArray<keyof ProjectileTraitConfig>;

const summonTraitKeys = [
  "maxClones",
  "cloneCooldown",
  "cloneHpRatio",
  "splitCount",
  "splitHpRatio",
  "turretLimit",
  "turretCooldown",
  "turretLifetime"
] satisfies ReadonlyArray<keyof SummonTraitConfig>;

const statusNumberKeys = [
  "chance",
  "duration",
  "tickDamage",
  "slowPercent",
  "vulnerablePercent",
  "shieldValue",
  "shieldCooldown"
] satisfies ReadonlyArray<Exclude<keyof StatusTraitConfig, "statusId">>;

const ruleNumberKeys = ["duration", "maxStacks", "reviveHpRatio", "hpCostPercent"] satisfies ReadonlyArray<
  Exclude<keyof RuleTraitConfig, "trigger">
>;

export function createDefaultDesignerBalanceConfig(): DesignerBalanceConfig {
  return {
    version: "0.1",
    baseStats: { ...baseBallStats },
    projectile: { ...defaultProjectileMechanicsConfig },
    turret: { ...defaultTurretMechanicsConfig },
    traits: {}
  };
}

export function toBattleBalanceOverrides(config: DesignerBalanceConfig): BattleBalanceOverrides {
  return {
    baseStats: { ...config.baseStats },
    projectile: { ...config.projectile },
    turret: { ...config.turret },
    traits: { ...config.traits }
  };
}

export function readDesignerBalanceConfig(
  storage: DesignerBalanceStorage | null,
  fallback: DesignerBalanceConfig = createDefaultDesignerBalanceConfig()
): DesignerBalanceConfig {
  if (!storage) {
    return fallback;
  }

  try {
    const raw = storage.getItem(DESIGNER_BALANCE_STORAGE_KEY);
    if (!raw) {
      return fallback;
    }

    return normalizeDesignerBalanceConfig(JSON.parse(raw), fallback);
  } catch {
    return fallback;
  }
}

export function writeDesignerBalanceConfig(storage: DesignerBalanceStorage | null, config: DesignerBalanceConfig): void {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(DESIGNER_BALANCE_STORAGE_KEY, encodeDesignerBalanceConfig(config));
  } catch {
    // Ignore quota or privacy-mode failures; the current tuning session should remain playable.
  }
}

export function getBrowserDesignerBalanceStorage(): DesignerBalanceStorage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function encodeDesignerBalanceConfig(config: DesignerBalanceConfig): string {
  return JSON.stringify(config, null, 2);
}

export function encodeTraitBalanceOverrides(traits: TraitBalanceOverrides): string {
  return JSON.stringify(traits, null, 2);
}

export function decodeDesignerBalanceConfig(
  text: string,
  fallback: DesignerBalanceConfig = createDefaultDesignerBalanceConfig()
): { ok: true; config: DesignerBalanceConfig } | { ok: false; message: string } {
  try {
    return { ok: true, config: normalizeDesignerBalanceConfig(JSON.parse(text), fallback) };
  } catch {
    return { ok: false, message: "配置 JSON 解析失败" };
  }
}

export function decodeTraitBalanceOverrides(
  text: string
): { ok: true; traits: TraitBalanceOverrides } | { ok: false; message: string } {
  try {
    const parsed = JSON.parse(text.trim().length > 0 ? text : "{}");
    if (!isRecord(parsed) || Array.isArray(parsed)) {
      return { ok: false, message: "词条覆盖 JSON 必须是对象" };
    }
    return { ok: true, traits: normalizeTraitBalanceOverrides(parsed) };
  } catch {
    return { ok: false, message: "词条覆盖 JSON 解析失败" };
  }
}

export function normalizeDesignerBalanceConfig(
  value: unknown,
  fallback: DesignerBalanceConfig = createDefaultDesignerBalanceConfig()
): DesignerBalanceConfig {
  if (!isRecord(value)) {
    return fallback;
  }

  return {
    version: "0.1",
    baseStats: normalizeNumberMap(value.baseStats, fallback.baseStats, baseStatBounds),
    projectile: normalizeNumberMap(value.projectile, fallback.projectile, projectileBounds),
    turret: normalizeNumberMap(value.turret, fallback.turret, turretBounds),
    traits: normalizeTraitBalanceOverrides(value.traits, fallback.traits)
  };
}

export function normalizeTraitBalanceOverrides(value: unknown, fallback: TraitBalanceOverrides = {}): TraitBalanceOverrides {
  if (!isRecord(value)) {
    return fallback;
  }

  const normalized: TraitBalanceOverrides = {};
  for (const [traitId, rawNumeric] of Object.entries(value)) {
    if (!knownTraitIds.has(traitId) || !isRecord(rawNumeric)) {
      continue;
    }

    const numeric = normalizeTraitNumericBalanceOverride(rawNumeric);
    if (Object.keys(numeric).length > 0) {
      normalized[traitId] = numeric;
    }
  }
  return normalized;
}

function normalizeNumberMap<T extends { [K in keyof T]: number }>(
  value: unknown,
  fallback: T,
  boundsByKey: Record<keyof T, NumericBounds>
): T {
  if (!isRecord(value)) {
    return fallback;
  }

  const normalized = { ...fallback };
  for (const key of Object.keys(boundsByKey) as Array<keyof T>) {
    const bounds = boundsByKey[key];
    normalized[key] = readBoundedNumber(value[String(key)], fallback[key], bounds.min, bounds.max) as T[typeof key];
  }
  return normalized;
}

function normalizeTraitNumericBalanceOverride(value: Record<string, unknown>): TraitNumericBalanceOverrides {
  const normalized: TraitNumericBalanceOverrides = {};

  assignTraitOverrideField(normalized, "statModifiers", normalizeStatModifiers(value.statModifiers));
  assignTraitOverrideField(normalized, "collision", normalizeNumberConfig<CollisionTraitConfig>(value.collision, collisionTraitKeys));
  assignTraitOverrideField(normalized, "projectile", normalizeNumberConfig<ProjectileTraitConfig>(value.projectile, projectileTraitKeys));
  assignTraitOverrideField(normalized, "summon", normalizeNumberConfig<SummonTraitConfig>(value.summon, summonTraitKeys));
  assignTraitOverrideField(normalized, "status", normalizeStatusConfig(value.status));
  assignTraitOverrideField(normalized, "rule", normalizeRuleConfig(value.rule));

  return normalized;
}

function normalizeStatModifiers(value: unknown): StatModifier[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const modifiers: StatModifier[] = [];
  for (const item of value) {
    if (!isRecord(item) || !isStatKey(item.stat) || !isStatModifierOperation(item.op)) {
      continue;
    }
    const modifierValue = readFiniteNumber(item.value);
    if (modifierValue === undefined) {
      continue;
    }
    modifiers.push({
      stat: item.stat,
      op: item.op,
      value: modifierValue
    });
  }

  return modifiers.length > 0 ? modifiers : undefined;
}

function normalizeNumberConfig<T extends object>(value: unknown, keys: ReadonlyArray<keyof T>): T | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const normalized: Partial<Record<keyof T, number>> = {};
  for (const key of keys) {
    const numberValue = readFiniteNumber(value[String(key)]);
    if (numberValue !== undefined) {
      normalized[key] = numberValue;
    }
  }

  return Object.keys(normalized).length > 0 ? (normalized as T) : undefined;
}

function normalizeStatusConfig(value: unknown): Partial<StatusTraitConfig> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const normalized: Partial<StatusTraitConfig> = {};
  if (typeof value.statusId === "string") {
    normalized.statusId = value.statusId;
  }
  for (const key of statusNumberKeys) {
    const numberValue = readFiniteNumber(value[String(key)]);
    if (numberValue !== undefined) {
      (normalized as Record<string, unknown>)[key] = numberValue;
    }
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeRuleConfig(value: unknown): RuleTraitConfig | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const normalized: RuleTraitConfig = {};
  if (typeof value.trigger === "string") {
    normalized.trigger = value.trigger;
  }
  for (const key of ruleNumberKeys) {
    const numberValue = readFiniteNumber(value[String(key)]);
    if (numberValue !== undefined) {
      (normalized as Record<string, unknown>)[key] = numberValue;
    }
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function assignTraitOverrideField<Key extends keyof TraitNumericBalanceOverrides>(
  target: TraitNumericBalanceOverrides,
  key: Key,
  value: TraitNumericBalanceOverrides[Key] | undefined
): void {
  if (value !== undefined) {
    target[key] = value;
  }
}

function isStatKey(value: unknown): value is StatKey {
  return typeof value === "string" && statKeys.has(value as StatKey);
}

function isStatModifierOperation(value: unknown): value is StatModifierOperation {
  return typeof value === "string" && statModifierOperations.has(value as StatModifierOperation);
}

function readBoundedNumber(value: unknown, fallback: number, min: number, max = Number.POSITIVE_INFINITY): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, value));
}

function readFiniteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
