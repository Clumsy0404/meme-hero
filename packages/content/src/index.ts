import {
  TRAITS_PER_BUILD,
  type BallStats,
  type BuildConfig,
  type BuildValidationIssue,
  type BuildValidationResult,
  type TraitDefinition,
  type TraitId,
  type TraitType
} from "@ball-brawl/shared";

export const contentVersion = "0.1";

export const baseBallStats: BallStats = {
  maxHp: 100,
  radius: 24,
  moveSpeed: 180,
  collisionDamage: 8,
  collisionCooldown: 0.45,
  knockback: 220,
  damageReduction: 0,
  hpRegen: 0
};

export const traitTypeLabels: Record<TraitType, string> = {
  attribute: "基础数值",
  collision: "碰撞机制",
  projectile: "弹道机制",
  summon: "召唤机制",
  status: "状态机制",
  rule: "规则机制"
};

export const traitDefinitions: TraitDefinition[] = [
  {
    id: "hp_boost",
    name: "生命强化",
    subtitle: "提高生命上限",
    mainType: "attribute",
    tags: ["hp", "survival"],
    repeatRule: { kind: "stackable", maxStacks: 4 },
    description: "最大生命提高 20%。",
    numeric: { statModifiers: [{ stat: "maxHp", op: "percentAdd", value: 0.2 }] },
    behaviorKeys: ["stat_modifier"]
  },
  {
    id: "speed_boost",
    name: "高速移动",
    subtitle: "提高追击速度",
    mainType: "attribute",
    tags: ["speed", "movement"],
    repeatRule: { kind: "stackable", maxStacks: 4 },
    description: "移动速度提高 15%。",
    numeric: { statModifiers: [{ stat: "moveSpeed", op: "percentAdd", value: 0.15 }] },
    behaviorKeys: ["stat_modifier"]
  },
  {
    id: "giant_body",
    name: "巨型球体",
    subtitle: "更大更耐撞",
    mainType: "attribute",
    tags: ["size", "hp"],
    repeatRule: { kind: "stackable", maxStacks: 4 },
    description: "体型提高 18%，生命提高 8%，移动速度降低 6%。",
    numeric: {
      statModifiers: [
        { stat: "radius", op: "percentAdd", value: 0.18 },
        { stat: "maxHp", op: "percentAdd", value: 0.08 },
        { stat: "moveSpeed", op: "percentAdd", value: -0.06 }
      ]
    },
    behaviorKeys: ["stat_modifier"]
  },
  {
    id: "nimble_body",
    name: "小型灵巧",
    subtitle: "更小更灵活",
    mainType: "attribute",
    tags: ["size", "speed"],
    repeatRule: { kind: "stackable", maxStacks: 4 },
    description: "体型降低 12%，速度提高 12%，生命降低 8%。",
    numeric: {
      statModifiers: [
        { stat: "radius", op: "percentAdd", value: -0.12 },
        { stat: "moveSpeed", op: "percentAdd", value: 0.12 },
        { stat: "maxHp", op: "percentAdd", value: -0.08 }
      ]
    },
    behaviorKeys: ["stat_modifier"]
  },
  {
    id: "collision_boost",
    name: "撞击强化",
    subtitle: "提高碰撞伤害",
    mainType: "attribute",
    tags: ["collision", "damage", "knockback"],
    repeatRule: { kind: "stackable", maxStacks: 4 },
    description: "碰撞伤害提高 18%，击退提高 8%。",
    numeric: {
      statModifiers: [
        { stat: "collisionDamage", op: "percentAdd", value: 0.18 },
        { stat: "knockback", op: "percentAdd", value: 0.08 }
      ]
    },
    behaviorKeys: ["stat_modifier"]
  },
  {
    id: "hard_shell",
    name: "坚硬外壳",
    subtitle: "降低承受伤害",
    mainType: "attribute",
    tags: ["defense", "survival"],
    repeatRule: { kind: "stackable", maxStacks: 4 },
    description: "获得 8% 伤害减免，移动速度降低 4%。",
    numeric: {
      statModifiers: [
        { stat: "damageReduction", op: "add", value: 0.08 },
        { stat: "moveSpeed", op: "percentAdd", value: -0.04 }
      ]
    },
    behaviorKeys: ["stat_modifier"]
  },
  {
    id: "lifesteal_collision",
    name: "吸血碰撞",
    subtitle: "撞击后回复生命",
    mainType: "collision",
    tags: ["collision", "lifesteal", "survival"],
    repeatRule: { kind: "unique" },
    description: "碰撞造成伤害时回复部分生命，每秒有回复上限。",
    numeric: { collision: { lifestealRatio: 0.25, healPerSecondLimit: 8 } },
    behaviorKeys: ["collision_lifesteal"]
  },
  {
    id: "spike_reflect",
    name: "尖刺反伤",
    subtitle: "被撞时反弹伤害",
    mainType: "collision",
    tags: ["collision", "reflect", "damage"],
    repeatRule: { kind: "unique" },
    description: "受到碰撞伤害时，将部分伤害反弹给攻击者。",
    numeric: { collision: { reflectRatio: 0.25 } },
    behaviorKeys: ["collision_reflect"]
  },
  {
    id: "gravity_knockback",
    name: "重力击退",
    subtitle: "撞开对手",
    mainType: "collision",
    tags: ["collision", "knockback"],
    repeatRule: { kind: "unique" },
    description: "击退提高 25%，碰撞伤害小幅提高。",
    numeric: {
      statModifiers: [
        { stat: "knockback", op: "percentAdd", value: 0.25 },
        { stat: "collisionDamage", op: "percentAdd", value: 0.05 }
      ]
    },
    behaviorKeys: ["stat_modifier", "collision_knockback"]
  },
  {
    id: "collision_burst",
    name: "碰撞爆炸",
    subtitle: "碰撞触发范围爆发",
    mainType: "collision",
    tags: ["collision", "explosion", "damage"],
    repeatRule: { kind: "unique" },
    description: "碰撞时周期性触发小范围爆炸。",
    numeric: { collision: { explosionDamage: 8, explosionRadius: 82, explosionCooldown: 3 } },
    behaviorKeys: ["collision_explosion"]
  },
  {
    id: "wall_charge",
    name: "撞墙蓄力",
    subtitle: "反弹后强化下次撞击",
    mainType: "collision",
    tags: ["collision", "wall", "damage"],
    repeatRule: { kind: "unique" },
    description: "撞墙后获得蓄力层数，提高后续碰撞伤害。",
    numeric: { collision: { wallChargeMaxStacks: 3, wallChargeDamagePercentPerStack: 0.12 } },
    behaviorKeys: ["wall_charge"]
  },
  {
    id: "ranged_core",
    name: "远程核心",
    subtitle: "强化基础子弹",
    mainType: "projectile",
    tags: ["projectile", "damage"],
    repeatRule: { kind: "unique" },
    description: "提高远程子弹伤害。任意弹道词条都会启用较弱基础子弹。",
    numeric: { projectile: { damageMultiplier: 1.3 } },
    behaviorKeys: ["projectile_enable", "projectile_damage"]
  },
  {
    id: "pellet_barrage",
    name: "霰弹发射",
    subtitle: "一次发射多枚子弹",
    mainType: "projectile",
    tags: ["projectile", "scatter"],
    repeatRule: { kind: "unique" },
    description: "额外发射 2 枚散射子弹，但弹道更分散。",
    numeric: { projectile: { extraProjectiles: 2, spreadAngleDeg: 32, fireRateMultiplier: 0.85 } },
    behaviorKeys: ["projectile_enable", "projectile_scatter"]
  },
  {
    id: "ricochet_shot",
    name: "弹射子弹",
    subtitle: "子弹撞墙反弹",
    mainType: "projectile",
    tags: ["projectile", "bounce", "wall"],
    repeatRule: { kind: "unique" },
    description: "子弹可以额外弹射 2 次。",
    numeric: { projectile: { bounces: 2 } },
    behaviorKeys: ["projectile_enable", "projectile_bounce"]
  },
  {
    id: "homing_shot",
    name: "追踪子弹",
    subtitle: "子弹轻微追敌",
    mainType: "projectile",
    tags: ["projectile", "homing"],
    repeatRule: { kind: "unique" },
    description: "子弹获得轻微追踪能力。",
    numeric: { projectile: { homingStrength: 0.35 } },
    behaviorKeys: ["projectile_enable", "projectile_homing"]
  },
  {
    id: "pierce_shot",
    name: "穿透子弹",
    subtitle: "命中后继续飞行",
    mainType: "projectile",
    tags: ["projectile", "pierce"],
    repeatRule: { kind: "unique" },
    description: "子弹可以穿透 1 个目标。",
    numeric: { projectile: { pierces: 1 } },
    behaviorKeys: ["projectile_enable", "projectile_pierce"]
  },
  {
    id: "split_shot",
    name: "分裂子弹",
    subtitle: "命中后生成小子弹",
    mainType: "projectile",
    tags: ["projectile", "split"],
    repeatRule: { kind: "unique" },
    description: "主子弹命中后分裂为 2 枚小子弹，小子弹不会继续分裂。",
    numeric: { projectile: { splitCount: 2, projectileRadiusMultiplier: 0.8 } },
    behaviorKeys: ["projectile_enable", "projectile_split"]
  },
  {
    id: "clone_spawn",
    name: "克隆分身",
    subtitle: "周期生成辅助分身",
    mainType: "summon",
    tags: ["summon", "clone"],
    repeatRule: { kind: "unique" },
    description: "周期性生成 1 个低生命分身协助撞击。",
    numeric: { summon: { maxClones: 1, cloneCooldown: 7, cloneHpRatio: 0.35 } },
    behaviorKeys: ["summon_clone"]
  },
  {
    id: "death_split",
    name: "死亡分裂",
    subtitle: "低生命代价换一次分裂",
    mainType: "summon",
    tags: ["summon", "death", "split"],
    repeatRule: { kind: "unique" },
    description: "初始生命上限降低 50%，首次死亡时分裂为两个半血小球。",
    numeric: {
      statModifiers: [{ stat: "maxHp", op: "percentAdd", value: -0.5 }],
      summon: { splitCount: 2, splitHpRatio: 0.5 }
    },
    behaviorKeys: ["stat_modifier", "death_split"]
  },
  {
    id: "clone_bomb",
    name: "分身爆炸",
    subtitle: "召唤物死亡爆发",
    mainType: "summon",
    tags: ["summon", "clone", "explosion"],
    repeatRule: { kind: "unique" },
    description: "分身死亡时触发小范围爆炸。",
    numeric: { collision: { explosionDamage: 10, explosionRadius: 70 } },
    behaviorKeys: ["summon_death_explosion"]
  },
  {
    id: "auto_turret",
    name: "自动炮台",
    subtitle: "部署短时炮台",
    mainType: "summon",
    tags: ["summon", "turret", "projectile"],
    repeatRule: { kind: "unique" },
    description: "周期性部署短时存在的自动炮台。",
    numeric: { summon: { turretLimit: 1, turretCooldown: 10, turretLifetime: 6 } },
    behaviorKeys: ["summon_turret"]
  },
  {
    id: "burn_payload",
    name: "灼烧附着",
    subtitle: "命中后持续掉血",
    mainType: "status",
    tags: ["status", "burn", "damage"],
    repeatRule: { kind: "unique" },
    description: "碰撞或子弹命中时有概率施加灼烧。",
    numeric: { status: { statusId: "burn", chance: 0.35, duration: 3, tickDamage: 2 } },
    behaviorKeys: ["status_on_hit"]
  },
  {
    id: "poison_payload",
    name: "中毒附着",
    subtitle: "更久的持续消耗",
    mainType: "status",
    tags: ["status", "poison", "damage"],
    repeatRule: { kind: "unique" },
    description: "碰撞或子弹命中时有概率施加中毒。",
    numeric: { status: { statusId: "poison", chance: 0.3, duration: 5, tickDamage: 1.2 } },
    behaviorKeys: ["status_on_hit"]
  },
  {
    id: "slow_payload",
    name: "减速附着",
    subtitle: "限制敌方机动",
    mainType: "status",
    tags: ["status", "slow"],
    repeatRule: { kind: "unique" },
    description: "命中时有概率降低目标移动速度。",
    numeric: { status: { statusId: "slow", chance: 0.35, duration: 2.5, slowPercent: 0.28 } },
    behaviorKeys: ["status_on_hit"]
  },
  {
    id: "vulnerable_payload",
    name: "脆弱标记",
    subtitle: "放大后续伤害",
    mainType: "status",
    tags: ["status", "vulnerable", "damage"],
    repeatRule: { kind: "unique" },
    description: "命中时有概率让目标短时间受到更多伤害。",
    numeric: { status: { statusId: "vulnerable", chance: 0.25, duration: 3, vulnerablePercent: 0.18 } },
    behaviorKeys: ["status_on_hit"]
  },
  {
    id: "shield_cycle",
    name: "周期护盾",
    subtitle: "间歇吸收伤害",
    mainType: "status",
    tags: ["status", "shield", "survival"],
    repeatRule: { kind: "unique" },
    description: "周期性获得一个可吸收伤害的护盾。",
    numeric: { status: { statusId: "shield", shieldValue: 14, shieldCooldown: 7 } },
    behaviorKeys: ["status_shield_cycle"]
  },
  {
    id: "low_hp_rage",
    name: "低血狂暴",
    subtitle: "濒危时爆发",
    mainType: "rule",
    tags: ["rule", "rage", "damage", "speed"],
    repeatRule: { kind: "unique" },
    description: "生命首次低于阈值时短时间提高速度和碰撞伤害。",
    numeric: {
      statModifiers: [{ stat: "maxHp", op: "percentAdd", value: -0.05 }],
      rule: { trigger: "hp_below_30_percent", duration: 5 }
    },
    behaviorKeys: ["low_hp_rage"]
  },
  {
    id: "kill_growth",
    name: "击杀成长",
    subtitle: "击杀后永久变强",
    mainType: "rule",
    tags: ["rule", "growth", "damage"],
    repeatRule: { kind: "unique" },
    description: "击杀敌方单位后获得可叠加成长。",
    numeric: { rule: { trigger: "kill", maxStacks: 6 } },
    behaviorKeys: ["kill_growth"]
  },
  {
    id: "time_growth",
    name: "时间成长",
    subtitle: "拖到后期更强",
    mainType: "rule",
    tags: ["rule", "growth", "time"],
    repeatRule: { kind: "unique" },
    description: "战斗每过一段时间获得成长层数。",
    numeric: { rule: { trigger: "time", maxStacks: 8 } },
    behaviorKeys: ["time_growth"]
  },
  {
    id: "one_revive",
    name: "复活一次",
    subtitle: "牺牲上限换容错",
    mainType: "rule",
    tags: ["rule", "revive", "survival"],
    repeatRule: { kind: "unique" },
    description: "生命上限降低 15%，首次死亡时以部分生命复活。",
    numeric: {
      statModifiers: [{ stat: "maxHp", op: "percentAdd", value: -0.15 }],
      rule: { trigger: "death", reviveHpRatio: 0.35, hpCostPercent: 0.15 }
    },
    behaviorKeys: ["stat_modifier", "revive_once"]
  }
];

const traitDefinitionMap = new Map<TraitId, TraitDefinition>(traitDefinitions.map((trait) => [trait.id, trait]));

export function getTraitDefinition(id: TraitId): TraitDefinition | undefined {
  return traitDefinitionMap.get(id);
}

export function getRequiredTraitDefinition(id: TraitId): TraitDefinition {
  const trait = getTraitDefinition(id);
  if (!trait) {
    throw new Error(`Unknown trait id: ${id}`);
  }
  return trait;
}

export function getTraitDefinitionsByType(type: TraitType): TraitDefinition[] {
  return traitDefinitions.filter((trait) => trait.mainType === type);
}

export function validateBuildConfig(build: BuildConfig, definitions: TraitDefinition[] = traitDefinitions): BuildValidationResult {
  const issues: BuildValidationIssue[] = [];
  const definitionsById = new Map<TraitId, TraitDefinition>(definitions.map((trait) => [trait.id, trait]));
  const counts = new Map<TraitId, number>();

  if (build.version.trim().length === 0) {
    issues.push({
      code: "missing_version",
      message: "构筑缺少版本号。"
    });
  }

  if (build.baseModel.trim().length === 0) {
    issues.push({
      code: "missing_base_model",
      message: "构筑缺少基础模型。"
    });
  }

  if (build.traits.length !== TRAITS_PER_BUILD) {
    issues.push({
      code: "invalid_trait_count",
      message: `构筑必须装备 ${TRAITS_PER_BUILD} 个词条。`
    });
  }

  build.traits.forEach((traitId, slotIndex) => {
    if (!definitionsById.has(traitId)) {
      issues.push({
        code: "unknown_trait",
        message: `第 ${slotIndex + 1} 个词条不存在：${traitId}`,
        traitId,
        slotIndex
      });
      return;
    }
    counts.set(traitId, (counts.get(traitId) ?? 0) + 1);
  });

  for (const [traitId, count] of counts) {
    const definition = definitionsById.get(traitId);
    if (!definition) {
      continue;
    }
    if (definition.repeatRule.kind === "unique" && count > 1) {
      issues.push({
        code: "unique_trait_repeated",
        message: `词条“${definition.name}”不可重复选择。`,
        traitId
      });
    }
    if (definition.repeatRule.kind === "stackable" && definition.repeatRule.maxStacks && count > definition.repeatRule.maxStacks) {
      issues.push({
        code: "stack_limit_exceeded",
        message: `词条“${definition.name}”最多可重复 ${definition.repeatRule.maxStacks} 次。`,
        traitId
      });
    }
  }

  return {
    ok: issues.length === 0,
    issues
  };
}
