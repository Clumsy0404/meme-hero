import { describe, expect, it } from "vitest";

import {
  DESIGNER_BALANCE_STORAGE_KEY,
  createDefaultDesignerBalanceConfig,
  decodeDesignerBalanceConfig,
  decodeTraitBalanceOverrides,
  encodeDesignerBalanceConfig,
  encodeTraitBalanceOverrides,
  normalizeDesignerBalanceConfig,
  normalizeTraitBalanceOverrides,
  readDesignerBalanceConfig,
  toBattleBalanceOverrides,
  type DesignerBalanceConfig,
  writeDesignerBalanceConfig
} from "./designer-balance";

const fallback: DesignerBalanceConfig = {
  version: "0.1",
  baseStats: {
    maxHp: 100,
    radius: 48,
    moveSpeed: 180,
    collisionDamage: 8,
    collisionCooldown: 0.45,
    knockback: 220,
    damageReduction: 0,
    hpRegen: 0
  },
  projectile: {
    damage: 2,
    cooldown: 1.1,
    speed: 280,
    radius: 12,
    lifetime: 3.2
  },
  turret: {
    turretHp: 18,
    turretRadius: 36,
    turretProjectileDamage: 1,
    turretProjectileCooldown: 1.8,
    turretProjectileSpeed: 280,
    turretProjectileRadius: 10,
    turretProjectileLifetime: 3
  },
  traits: {}
};

describe("designer balance config", () => {
  it("creates defaults from current battle baselines", () => {
    const config = createDefaultDesignerBalanceConfig();

    expect(config.baseStats.radius).toBe(48);
    expect(config.projectile.damage).toBe(2);
    expect(config.projectile.speed).toBe(280);
    expect(config.turret.turretProjectileDamage).toBe(1);
    expect(config.traits).toEqual({});
  });

  it("normalizes valid partial saved values and keeps missing fields from fallback", () => {
    const config = normalizeDesignerBalanceConfig(
      {
        version: "0.1",
        baseStats: {
          maxHp: 120,
          radius: 64,
          damageReduction: 0.2
        },
        projectile: {
          damage: 3,
          speed: 180
        },
        turret: {
          turretProjectileDamage: 2
        },
        traits: {
          pellet_barrage: {
            projectile: {
              damageMultiplier: 0.5,
              extraProjectiles: 1
            }
          },
          burn_payload: {
            status: {
              chance: 1
            }
          }
        }
      },
      fallback
    );

    expect(config.baseStats.maxHp).toBe(120);
    expect(config.baseStats.radius).toBe(64);
    expect(config.baseStats.moveSpeed).toBe(fallback.baseStats.moveSpeed);
    expect(config.baseStats.damageReduction).toBe(0.2);
    expect(config.projectile.damage).toBe(3);
    expect(config.projectile.speed).toBe(180);
    expect(config.projectile.cooldown).toBe(fallback.projectile.cooldown);
    expect(config.turret.turretProjectileDamage).toBe(2);
    expect(config.turret.turretHp).toBe(fallback.turret.turretHp);
    expect(config.traits.pellet_barrage?.projectile?.damageMultiplier).toBe(0.5);
    expect(config.traits.pellet_barrage?.projectile?.extraProjectiles).toBe(1);
    expect(config.traits.burn_payload?.status?.chance).toBe(1);
  });

  it("clamps invalid numeric values", () => {
    const config = normalizeDesignerBalanceConfig(
      {
        baseStats: {
          maxHp: -10,
          collisionDamage: -1,
          damageReduction: 2,
          hpRegen: Number.NaN
        },
        projectile: {
          cooldown: 0,
          radius: -6
        },
        turret: {
          turretHp: 0,
          turretProjectileLifetime: -2
        }
      },
      fallback
    );

    expect(config.baseStats.maxHp).toBe(1);
    expect(config.baseStats.collisionDamage).toBe(0);
    expect(config.baseStats.damageReduction).toBe(0.95);
    expect(config.baseStats.hpRegen).toBe(fallback.baseStats.hpRegen);
    expect(config.projectile.cooldown).toBe(0.05);
    expect(config.projectile.radius).toBe(1);
    expect(config.turret.turretHp).toBe(1);
    expect(config.turret.turretProjectileLifetime).toBe(0.05);
  });

  it("normalizes trait overrides and drops unsafe values", () => {
    const traits = normalizeTraitBalanceOverrides({
      hp_boost: {
        statModifiers: [
          { stat: "maxHp", op: "percentAdd", value: 0.35 },
          { stat: "unknown", op: "percentAdd", value: 1 },
          { stat: "moveSpeed", op: "bad", value: 1 },
          { stat: "radius", op: "add", value: Number.NaN }
        ]
      },
      pellet_barrage: {
        projectile: {
          damageMultiplier: 0.6,
          extraProjectiles: 1,
          ignoredField: 999
        }
      },
      unknown_trait: {
        projectile: {
          damageMultiplier: 99
        }
      }
    });

    expect(traits.hp_boost?.statModifiers).toEqual([{ stat: "maxHp", op: "percentAdd", value: 0.35 }]);
    expect(traits.pellet_barrage?.projectile).toEqual({ damageMultiplier: 0.6, extraProjectiles: 1 });
    expect(traits.unknown_trait).toBeUndefined();
  });

  it("reads and writes using the storage key", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value)
    };
    const config: DesignerBalanceConfig = {
      ...fallback,
      baseStats: { ...fallback.baseStats, radius: 72 },
      projectile: { ...fallback.projectile, speed: 150 },
      traits: {
        pellet_barrage: {
          projectile: {
            damageMultiplier: 0.5
          }
        }
      }
    };

    writeDesignerBalanceConfig(storage, config);

    expect(values.has(DESIGNER_BALANCE_STORAGE_KEY)).toBe(true);
    expect(readDesignerBalanceConfig(storage, fallback)).toEqual(config);
  });

  it("encodes and decodes JSON configs", () => {
    const text = encodeDesignerBalanceConfig({
      ...fallback,
      projectile: { ...fallback.projectile, damage: 4 }
    });
    const result = decodeDesignerBalanceConfig(text, fallback);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config.projectile.damage).toBe(4);
    }
    expect(decodeDesignerBalanceConfig("{", fallback)).toEqual({
      ok: false,
      message: "配置 JSON 解析失败"
    });
  });

  it("encodes and decodes trait override JSON", () => {
    const text = encodeTraitBalanceOverrides({
      pellet_barrage: {
        projectile: {
          damageMultiplier: 0.55,
          extraProjectiles: 1
        }
      }
    });
    const result = decodeTraitBalanceOverrides(text);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.traits.pellet_barrage?.projectile?.damageMultiplier).toBe(0.55);
      expect(result.traits.pellet_barrage?.projectile?.extraProjectiles).toBe(1);
    }
    expect(decodeTraitBalanceOverrides("[1,2]")).toEqual({
      ok: false,
      message: "词条覆盖 JSON 必须是对象"
    });
    expect(decodeTraitBalanceOverrides("{")).toEqual({
      ok: false,
      message: "词条覆盖 JSON 解析失败"
    });
  });

  it("converts full config to battle overrides", () => {
    const overrides = toBattleBalanceOverrides({
      ...fallback,
      baseStats: { ...fallback.baseStats, moveSpeed: 220 },
      turret: { ...fallback.turret, turretProjectileDamage: 5 },
      traits: {
        ranged_core: {
          projectile: {
            damageMultiplier: 0.8
          }
        }
      }
    });

    expect(overrides.baseStats?.moveSpeed).toBe(220);
    expect(overrides.projectile?.damage).toBe(2);
    expect(overrides.turret?.turretProjectileDamage).toBe(5);
    expect(overrides.traits?.ranged_core?.projectile?.damageMultiplier).toBe(0.8);
  });
});
