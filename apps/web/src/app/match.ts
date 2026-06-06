import type { BuildConfig, MatchConfig, TraitId } from "@ball-brawl/shared";

export const defaultBlueTraits: TraitId[] = ["low_hp_rage", "kill_growth", "time_growth", "collision_boost"];
export const defaultRedTraits: TraitId[] = ["one_revive", "shield_cycle", "vulnerable_payload", "giant_body"];

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
    traits: ["giant_body", "collision_boost", "gravity_knockback", "wall_charge"]
  },
  {
    id: "lifesteal_shell",
    name: "吸血硬壳",
    subtitle: "续航防守",
    description: "靠吸血、减伤和高血量拖长战斗。",
    traits: ["lifesteal_collision", "hard_shell", "hp_boost", "giant_body"]
  },
  {
    id: "projectile_rain",
    name: "弹幕核心",
    subtitle: "远程弹道",
    description: "多弹、追踪和穿透组成远程压制。",
    traits: ["ranged_core", "pellet_barrage", "homing_shot", "pierce_shot"]
  },
  {
    id: "summon_swarm",
    name: "分身炮台",
    subtitle: "召唤压场",
    description: "分身牵制、死亡爆炸和炮台补伤害。",
    traits: ["clone_spawn", "clone_bomb", "auto_turret", "hp_boost"]
  },
  {
    id: "status_drain",
    name: "状态消耗",
    subtitle: "持续削弱",
    description: "灼烧、中毒和减速持续消耗对手。",
    traits: ["burn_payload", "poison_payload", "slow_payload", "ranged_core"]
  },
  {
    id: "late_growth",
    name: "后期成长",
    subtitle: "越打越强",
    description: "复活容错后依靠时间和击杀成长翻盘。",
    traits: ["one_revive", "time_growth", "kill_growth", "collision_boost"]
  }
];

export function createBuildConfig(name: string, skin: string, traits: TraitId[]): BuildConfig {
  return {
    version: "0.1",
    name,
    skin,
    baseModel: "default",
    traits: [...traits]
  };
}

export function createMatchConfig(blue: BuildConfig, red: BuildConfig, seed = 20260606): MatchConfig {
  return {
    version: "0.1",
    seed,
    arenaId: "mvp_rect",
    blue,
    red
  };
}

export const demoMatchConfig = createMatchConfig(
  createBuildConfig("蓝方小球", "default_blue", defaultBlueTraits),
  createBuildConfig("红方小球", "default_red", defaultRedTraits)
);
