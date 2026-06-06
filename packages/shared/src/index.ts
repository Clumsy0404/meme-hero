export type Team = "blue" | "red";

export type Vec2 = {
  x: number;
  y: number;
};

export type TraitType = "attribute" | "collision" | "projectile" | "summon" | "status" | "rule";

export type RepeatRule = { kind: "unique" } | { kind: "stackable"; maxStacks?: number };

export type TraitDefinition = {
  id: string;
  name: string;
  subtitle: string;
  mainType: TraitType;
  tags: string[];
  repeatRule: RepeatRule;
  description: string;
};

export type BuildConfig = {
  version: string;
  name: string;
  skin: string;
  baseModel: string;
  traits: string[];
};

export type MatchConfig = {
  version: string;
  seed: number;
  arenaId: string;
  blue: BuildConfig;
  red: BuildConfig;
};

export type BallStats = {
  maxHp: number;
  radius: number;
  moveSpeed: number;
  collisionDamage: number;
  collisionCooldown: number;
  knockback: number;
  damageReduction: number;
  hpRegen: number;
};
