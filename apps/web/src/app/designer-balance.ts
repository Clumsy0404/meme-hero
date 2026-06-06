import { baseBallStats } from "@ball-brawl/content";
import { defaultProjectileMechanicsConfig, defaultTurretMechanicsConfig } from "@ball-brawl/sim";
import type { BallStats, BattleBalanceOverrides, ProjectileBalanceOverrides, TurretBalanceOverrides } from "@ball-brawl/shared";

export const DESIGNER_BALANCE_STORAGE_KEY = "small-ball-brawl.designer-balance.v1";

export type DesignerProjectileConfig = Required<ProjectileBalanceOverrides>;
export type DesignerTurretConfig = Required<TurretBalanceOverrides>;

export type DesignerBalanceConfig = {
  version: "0.1";
  baseStats: BallStats;
  projectile: DesignerProjectileConfig;
  turret: DesignerTurretConfig;
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

export function createDefaultDesignerBalanceConfig(): DesignerBalanceConfig {
  return {
    version: "0.1",
    baseStats: { ...baseBallStats },
    projectile: { ...defaultProjectileMechanicsConfig },
    turret: { ...defaultTurretMechanicsConfig }
  };
}

export function toBattleBalanceOverrides(config: DesignerBalanceConfig): BattleBalanceOverrides {
  return {
    baseStats: { ...config.baseStats },
    projectile: { ...config.projectile },
    turret: { ...config.turret }
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
    turret: normalizeNumberMap(value.turret, fallback.turret, turretBounds)
  };
}

function normalizeNumberMap<T extends Record<string, number>>(
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
    normalized[key] = readBoundedNumber(value[String(key)], fallback[key], bounds.min, bounds.max);
  }
  return normalized;
}

function readBoundedNumber(value: unknown, fallback: number, min: number, max = Number.POSITIVE_INFINITY): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
