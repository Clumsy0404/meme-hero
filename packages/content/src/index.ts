import type { BallStats, TraitDefinition } from "@ball-brawl/shared";

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

export const traitDefinitions: TraitDefinition[] = [
  {
    id: "hp_boost",
    name: "硬起来了",
    subtitle: "生命强化",
    mainType: "attribute",
    tags: ["hp", "survival"],
    repeatRule: { kind: "stackable" },
    description: "最大生命提高。"
  }
];
