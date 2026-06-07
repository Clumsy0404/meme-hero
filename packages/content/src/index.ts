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
  radius: 48,
  moveSpeed: 180,
  collisionDamage: 8,
  collisionCooldown: 0.45,
  knockback: 220,
  damageReduction: 0,
  hpRegen: 0
};

export type PresetEnemy = {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  traits: TraitId[];
};

export const presetEnemies: PresetEnemy[] = [
  {
    id: "collision_bruiser",
    name: "碰撞铁球",
    subtitle: "近战压制",
    description: "更大体型、墙反蓄力和强击退。",
    traits: ["giant_body", "collision_boost", "wall_charge"]
  },
  {
    id: "lifesteal_shell",
    name: "吸血硬壳",
    subtitle: "续航防守",
    description: "靠吸血、减伤和高血量拖长战斗。",
    traits: ["lifesteal_collision", "hard_shell", "giant_body"]
  },
  {
    id: "projectile_rain",
    name: "弹幕核心",
    subtitle: "远程弹道",
    description: "多弹、追踪和穿透组成远程压制。",
    traits: ["ranged_core", "pellet_barrage", "homing_shot"]
  },
  {
    id: "summon_swarm",
    name: "分身炮台",
    subtitle: "召唤压场",
    description: "分身牵制、死亡爆炸和炮台补伤害。",
    traits: ["clone_spawn", "clone_bomb", "auto_turret"]
  },
  {
    id: "status_drain",
    name: "状态消耗",
    subtitle: "持续削弱",
    description: "灼烧、中毒和减速持续消耗对手。",
    traits: ["burn_payload", "poison_payload", "ranged_core"]
  },
  {
    id: "late_growth",
    name: "后期成长",
    subtitle: "越打越强",
    description: "复活容错后依靠时间和击杀成长翻盘。",
    traits: ["one_revive", "time_growth", "kill_growth"]
  }
];

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
    name: "一只酱板鸭",
    subtitle: "提高生命上限",
    mainType: "attribute",
    tags: ["hp", "survival"],
    repeatRule: { kind: "stackable", maxStacks: 3 },
    description: "生命强化：最大生命提高 20%。",
    numeric: { statModifiers: [{ stat: "maxHp", op: "percentAdd", value: 0.2 }] },
    behaviorKeys: ["stat_modifier"]
  },
  {
    id: "speed_boost",
    name: "熊大快跑",
    subtitle: "提高追击速度",
    mainType: "attribute",
    tags: ["speed", "movement"],
    repeatRule: { kind: "stackable", maxStacks: 3 },
    description: "高速移动：移动速度提高 15%。",
    numeric: { statModifiers: [{ stat: "moveSpeed", op: "percentAdd", value: 0.15 }] },
    behaviorKeys: ["stat_modifier"]
  },
  {
    id: "giant_body",
    name: "坦克引擎",
    subtitle: "更大更耐撞",
    mainType: "attribute",
    tags: ["size", "hp"],
    repeatRule: { kind: "stackable", maxStacks: 3 },
    description: "巨型球体：体型提高 18%，生命提高 8%，移动速度降低 6%。",
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
    name: "缩小引擎",
    subtitle: "更小更灵活",
    mainType: "attribute",
    tags: ["size", "speed"],
    repeatRule: { kind: "stackable", maxStacks: 3 },
    description: "小型灵巧：体型降低 12%，速度提高 12%，生命降低 8%。",
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
    name: "大运来喽",
    subtitle: "提高碰撞伤害",
    mainType: "attribute",
    tags: ["collision", "damage", "knockback"],
    repeatRule: { kind: "stackable", maxStacks: 3 },
    description: "碰撞强化：碰撞伤害提高 18%，击退提高 8%。",
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
    name: "接！化！发！",
    subtitle: "降低承受伤害",
    mainType: "attribute",
    tags: ["defense", "survival"],
    repeatRule: { kind: "stackable", maxStacks: 3 },
    description: "坚硬外壳：获得 8% 伤害减免，移动速度降低 4%。",
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
    name: "吸人汁儿",
    subtitle: "撞击后回复生命",
    mainType: "collision",
    tags: ["collision", "lifesteal", "survival"],
    repeatRule: { kind: "unique" },
    description: "吸血碰撞：碰撞造成伤害时回复部分生命，每秒有回复上限。",
    numeric: { collision: { lifestealRatio: 0.25, healPerSecondLimit: 8 } },
    behaviorKeys: ["collision_lifesteal"]
  },
  {
    id: "spike_reflect",
    name: "带刺玫瑰",
    subtitle: "被撞时反弹伤害",
    mainType: "collision",
    tags: ["collision", "reflect", "damage"],
    repeatRule: { kind: "unique" },
    description: "尖刺反伤：受到碰撞伤害时，将部分伤害反弹给攻击者。",
    numeric: { collision: { reflectRatio: 0.25 } },
    behaviorKeys: ["collision_reflect"]
  },
  {
    id: "gravity_knockback",
    name: "退退退",
    subtitle: "撞开对手",
    mainType: "collision",
    tags: ["collision", "knockback"],
    repeatRule: { kind: "unique" },
    description: "重力击退：击退提高 25%，碰撞伤害小幅提高。",
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
    name: "老贝炸",
    subtitle: "碰撞触发范围爆发",
    mainType: "collision",
    tags: ["collision", "explosion", "damage"],
    repeatRule: { kind: "unique" },
    description: "碰撞爆炸：碰撞时周期性触发小范围爆炸。",
    numeric: { collision: { explosionDamage: 8, explosionRadius: 82, explosionCooldown: 3 } },
    behaviorKeys: ["collision_explosion"]
  },
  {
    id: "wall_charge",
    name: "我早已麻痹",
    subtitle: "反弹后强化下次撞击",
    mainType: "collision",
    tags: ["collision", "wall", "damage"],
    repeatRule: { kind: "unique" },
    description: "撞墙蓄力：撞墙后获得蓄力层数，提高后续碰撞伤害。",
    numeric: { collision: { wallChargeMaxStacks: 3, wallChargeDamagePercentPerStack: 0.12 } },
    behaviorKeys: ["wall_charge"]
  },
  {
    id: "ranged_core",
    name: "武装升级",
    subtitle: "强化基础子弹",
    mainType: "projectile",
    tags: ["projectile", "damage"],
    repeatRule: { kind: "unique" },
    description: "远程核心：提高远程子弹伤害。任意弹道词条都会启用较弱基础子弹。",
    numeric: { projectile: { damageMultiplier: 1.3 } },
    behaviorKeys: ["projectile_enable", "projectile_damage"]
  },
  {
    id: "pellet_barrage",
    name: "穿上草鞋，飞一般的感觉",
    subtitle: "一次发射多枚子弹",
    mainType: "projectile",
    tags: ["projectile", "scatter"],
    repeatRule: { kind: "unique" },
    description: "霰弹发射：额外发射 2 枚散射子弹，但单发伤害降低且弹道更分散。",
    numeric: { projectile: { damageMultiplier: 0.7, extraProjectiles: 2, spreadAngleDeg: 32, fireRateMultiplier: 0.85 } },
    behaviorKeys: ["projectile_enable", "projectile_scatter"]
  },
  {
    id: "ricochet_shot",
    name: "三维弹球",
    subtitle: "子弹撞墙反弹",
    mainType: "projectile",
    tags: ["projectile", "bounce", "wall"],
    repeatRule: { kind: "unique" },
    description: "弹射子弹：子弹可以额外弹射 2 次。",
    numeric: { projectile: { bounces: 2 } },
    behaviorKeys: ["projectile_enable", "projectile_bounce"]
  },
  {
    id: "homing_shot",
    name: "让子弹飞一会",
    subtitle: "子弹轻微追敌",
    mainType: "projectile",
    tags: ["projectile", "homing"],
    repeatRule: { kind: "unique" },
    description: "追踪子弹：子弹获得轻微追踪能力。",
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
    name: "有丝分裂",
    subtitle: "命中后生成小子弹",
    mainType: "projectile",
    tags: ["projectile", "split"],
    repeatRule: { kind: "unique" },
    description: "分裂子弹：主子弹命中后分裂为 2 枚小子弹，小子弹不会继续分裂。",
    numeric: { projectile: { splitCount: 2, projectileRadiusMultiplier: 0.8 } },
    behaviorKeys: ["projectile_enable", "projectile_split"]
  },
  {
    id: "clone_spawn",
    name: "替身使者",
    subtitle: "周期生成辅助分身",
    mainType: "summon",
    tags: ["summon", "clone"],
    repeatRule: { kind: "unique" },
    description: "克隆分身：生成 1 个 1 点生命的继承分身；分身死亡后 10 秒刷新，分身造成的伤害降低 30%。",
    numeric: { summon: { maxClones: 1, cloneCooldown: 10 } },
    behaviorKeys: ["summon_clone"]
  },
  {
    id: "death_split",
    name: "2.5条悟",
    subtitle: "低生命代价换一次分裂",
    mainType: "summon",
    tags: ["summon", "death", "split"],
    repeatRule: { kind: "unique" },
    description: "死亡分裂：初始生命上限降低 50%，首次死亡时分裂为两个半血小球。",
    numeric: {
      statModifiers: [{ stat: "maxHp", op: "percentAdd", value: -0.5 }],
      summon: { splitCount: 2, splitHpRatio: 0.5 }
    },
    behaviorKeys: ["stat_modifier", "death_split"]
  },
  {
    id: "clone_bomb",
    name: "塔利班",
    subtitle: "召唤物死亡爆发",
    mainType: "summon",
    tags: ["summon", "clone", "explosion"],
    repeatRule: { kind: "unique" },
    description: "分身爆炸：分身死亡时触发小范围爆炸。",
    numeric: { collision: { explosionDamage: 10, explosionRadius: 70 } },
    behaviorKeys: ["summon_death_explosion"]
  },
  {
    id: "auto_turret",
    name: "意大利炮",
    subtitle: "部署短时炮台",
    mainType: "summon",
    tags: ["summon", "turret", "projectile"],
    repeatRule: { kind: "unique" },
    description: "自动炮台：周期性部署短时存在的自动炮台。",
    numeric: { summon: { turretLimit: 1, turretCooldown: 10, turretLifetime: 6 } },
    behaviorKeys: ["summon_turret"]
  },
  {
    id: "burn_payload",
    name: "燃起来了",
    subtitle: "命中后持续掉血",
    mainType: "status",
    tags: ["status", "burn", "damage"],
    repeatRule: { kind: "unique" },
    description: "燃烧：碰撞或子弹命中时有概率施加灼烧。",
    numeric: { status: { statusId: "burn", chance: 0.35, duration: 3, tickDamage: 2 } },
    behaviorKeys: ["status_on_hit"]
  },
  {
    id: "poison_payload",
    name: "菌子攻势",
    subtitle: "更久的持续消耗",
    mainType: "status",
    tags: ["status", "poison", "damage"],
    repeatRule: { kind: "unique" },
    description: "中毒：碰撞或子弹命中时有概率施加中毒。",
    numeric: { status: { statusId: "poison", chance: 0.3, duration: 5, tickDamage: 1.2 } },
    behaviorKeys: ["status_on_hit"]
  },
  {
    id: "slow_payload",
    name: "没病走两步",
    subtitle: "限制敌方机动",
    mainType: "status",
    tags: ["status", "slow"],
    repeatRule: { kind: "unique" },
    description: "减速：命中时有概率降低目标移动速度。",
    numeric: { status: { statusId: "slow", chance: 0.35, duration: 2.5, slowPercent: 0.28 } },
    behaviorKeys: ["status_on_hit"]
  },
  {
    id: "vulnerable_payload",
    name: "这里没有厕所",
    subtitle: "放大后续伤害",
    mainType: "status",
    tags: ["status", "vulnerable", "damage"],
    repeatRule: { kind: "unique" },
    description: "脆弱：命中时有概率让目标短时间受到更多伤害。",
    numeric: { status: { statusId: "vulnerable", chance: 0.25, duration: 3, vulnerablePercent: 0.18 } },
    behaviorKeys: ["status_on_hit"]
  },
  {
    id: "shield_cycle",
    name: "心之壁",
    subtitle: "间歇吸收伤害",
    mainType: "status",
    tags: ["status", "shield", "survival"],
    repeatRule: { kind: "unique" },
    description: "护盾：周期性获得一个可吸收伤害的护盾。",
    numeric: { status: { statusId: "shield", shieldValue: 14, shieldCooldown: 7 } },
    behaviorKeys: ["status_shield_cycle"]
  },
  {
    id: "special_elbow_strike",
    name: "黑曼巴肘击",
    subtitle: "近身爆发碰撞",
    mainType: "collision",
    rarity: "legendary",
    tags: ["special", "collision", "damage", "knockback"],
    repeatRule: { kind: "unique" },
    description: "每 10 秒进入 2 秒弯肘突进，朝敌人冲刺并伸出黑色手肘，窗口内只判定 1 次强化碰撞伤害。",
    numeric: {
      special: {
        elbowCooldown: 10,
        elbowWindow: 2,
        elbowDamageMultiplier: 1.5,
        elbowKnockbackMultiplier: 1.35,
        elbowDashSpeedMultiplier: 3,
        elbowDashTurnMultiplier: 4,
        elbowHitboxRangeMultiplier: 1.35,
        elbowHitboxRadiusMultiplier: 0.5
      }
    },
    behaviorKeys: ["special_elbow_strike"]
  },
  {
    id: "special_bounce_basketball",
    name: "唱跳篮球",
    subtitle: "可反弹弹道",
    mainType: "projectile",
    rarity: "legendary",
    tags: ["special", "projectile", "bounce"],
    repeatRule: { kind: "unique" },
    description: "每 2.2 秒发射 1 个篮球弹道，命中造成 5 点伤害，撞墙可反弹 3 次。",
    numeric: {
      special: {
        basketballCooldown: 2.2,
        basketballDamage: 5,
        basketballSpeed: 300,
        basketballRadius: 16,
        basketballLifetime: 6,
        basketballBounces: 3,
        basketballLimit: 3
      }
    },
    behaviorKeys: ["special_bounce_basketball"]
  },
  {
    id: "special_hajimi_guard",
    name: "哈基米护体",
    subtitle: "软弹护盾",
    mainType: "status",
    rarity: "legendary",
    tags: ["special", "guard", "collision", "survival"],
    repeatRule: { kind: "unique" },
    description: "每 15 秒获得 1 次护体状态，持续 3.5 秒；下一次受到碰撞伤害降低 60% 并软弹反弹。",
    numeric: {
      special: {
        hajimiCooldown: 15,
        hajimiDuration: 3.5,
        hajimiCollisionReduction: 0.6,
        hajimiSelfKnockbackMultiplier: 0.65,
        hajimiAttackerKnockbackMultiplier: 1.35
      }
    },
    behaviorKeys: ["special_hajimi_guard"]
  },
  {
    id: "special_blade_shield_stance",
    name: "我的刀盾",
    subtitle: "攻防形态切换",
    mainType: "collision",
    rarity: "legendary",
    tags: ["special", "collision", "stance", "survival"],
    repeatRule: { kind: "unique" },
    description: "刀形态扩大碰撞判定并提高碰撞伤害；盾形态获得全伤害减免、反弹击退和小幅移速代价。",
    numeric: {
      special: {
        bladeShieldBladeDuration: 5,
        bladeShieldShieldDuration: 5,
        bladeShieldBladeDamageMultiplier: 1.25,
        bladeShieldRangeMultiplier: 2,
        bladeShieldDamageReduction: 0.3,
        bladeShieldKnockbackMultiplier: 1.25,
        bladeShieldMoveSpeedMultiplier: 0.92
      }
    },
    behaviorKeys: ["special_blade_shield_stance"]
  },
  {
    id: "special_dongbei_tiger_gaze",
    name: "虎哥一眼万年",
    subtitle: "凝视定身压迫",
    mainType: "status",
    rarity: "legendary",
    tags: ["special", "control", "slow", "vulnerable"],
    repeatRule: { kind: "unique" },
    description: "每 8 秒凝视最近敌人 2 秒，使其移速降至 0% 且受到伤害提高 10%。",
    numeric: {
      special: {
        tigerGazeCooldown: 8,
        tigerGazeDuration: 2,
        tigerGazeSlowPercent: 1,
        tigerGazeVulnerablePercent: 0.1
      }
    },
    behaviorKeys: ["special_dongbei_tiger_gaze"]
  },
  {
    id: "special_huaqiang_melon",
    name: "华强买瓜",
    subtitle: "西瓜与刀交替弹道",
    mainType: "projectile",
    rarity: "legendary",
    tags: ["special", "projectile", "splash"],
    repeatRule: { kind: "unique" },
    description: "每 5 秒交替发射西瓜和西瓜刀；西瓜碎裂造成范围伤害，西瓜刀高速单体命中。",
    numeric: {
      special: {
        huaqiangCooldown: 5,
        huaqiangMelonDamage: 2,
        huaqiangMelonSplashDamage: 2,
        huaqiangMelonSplashRadius: 70,
        huaqiangMelonSpeed: 330,
        huaqiangMelonRadius: 18,
        huaqiangMelonLifetime: 4,
        huaqiangKnifeDamage: 3,
        huaqiangKnifeSpeed: 480,
        huaqiangKnifeRadius: 10,
        huaqiangKnifeLifetime: 3.2
      }
    },
    behaviorKeys: ["special_huaqiang_melon"]
  },
  {
    id: "special_shenying_black_hand",
    name: "神鹰哥黑手",
    subtitle: "预警抓取拖拽",
    mainType: "status",
    rarity: "legendary",
    tags: ["special", "control", "slow"],
    repeatRule: { kind: "unique" },
    description: "每 10 秒锁定最近敌人，短暂预警后抓取拖向自身，并在结束后施加减速。",
    numeric: {
      special: {
        blackHandCooldown: 10,
        blackHandWarningDuration: 0.5,
        blackHandGrabDuration: 1.2,
        blackHandDragStrength: 520,
        blackHandSlowPercent: 0.5,
        blackHandSlowDuration: 2
      }
    },
    behaviorKeys: ["special_shenying_black_hand"]
  },
  {
    id: "low_hp_rage",
    name: "红温时刻",
    subtitle: "濒危时爆发",
    mainType: "rule",
    tags: ["rule", "rage", "damage", "speed"],
    repeatRule: { kind: "unique" },
    description: "低血狂暴：生命首次低于阈值时短时间提高速度和碰撞伤害。",
    numeric: {
      statModifiers: [{ stat: "maxHp", op: "percentAdd", value: -0.05 }],
      rule: { trigger: "hp_below_30_percent", duration: 5 }
    },
    behaviorKeys: ["low_hp_rage"]
  },
  {
    id: "kill_growth",
    name: "5星好市民",
    subtitle: "击杀后永久变强",
    mainType: "rule",
    tags: ["rule", "growth", "damage"],
    repeatRule: { kind: "unique" },
    description: "击杀成长：击杀敌方单位后获得可叠加成长。",
    numeric: { rule: { trigger: "kill", maxStacks: 6 } },
    behaviorKeys: ["kill_growth"]
  },
  {
    id: "time_growth",
    name: "生命成长幸福",
    subtitle: "拖到后期更强",
    mainType: "rule",
    tags: ["rule", "growth", "time"],
    repeatRule: { kind: "unique" },
    description: "时间成长：战斗每过一段时间获得成长层数。",
    numeric: { rule: { trigger: "time", maxStacks: 8 } },
    behaviorKeys: ["time_growth"]
  },
  {
    id: "one_revive",
    name: "你的使命还没有结束",
    subtitle: "牺牲上限换容错",
    mainType: "rule",
    tags: ["rule", "revive", "survival"],
    repeatRule: { kind: "unique" },
    description: "复活一次：生命上限降低 15%，首次死亡时以部分生命复活。",
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

  const legendaryTraitIds = build.traits.filter((traitId) => definitionsById.get(traitId)?.rarity === "legendary");
  if (legendaryTraitIds.length > 1) {
    const overflowTraitId = legendaryTraitIds[1]!;
    issues.push({
      code: "legendary_trait_limit_exceeded",
      message: "每套构筑最多只能选择 1 个传说词条。",
      traitId: overflowTraitId
    });
  }

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
