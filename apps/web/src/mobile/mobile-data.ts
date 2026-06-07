import { presetEnemies, traitDefinitions, traitTypeLabels } from "@ball-brawl/content";
import { TRAITS_PER_BUILD, type TraitDefinition, type TraitId, type TraitRarity, type TraitType } from "@ball-brawl/shared";
import { pickCommonBallAvatarId, type CommonBallAvatarId } from "./mobile-assets";

export type MobileTraitCategoryId = "survive" | "move" | "damage" | "range" | "summon" | "status" | "rule";

export type MobileTraitCategory = {
  id: MobileTraitCategoryId;
  name: string;
  en: string;
  color: string;
  icon: string[];
};

export type MobileTrait = {
  id: TraitId;
  name: string;
  sub: string;
  description: string;
  cat: MobileTraitCategoryId;
  tags: string[];
  rarity: TraitRarity;
  repeat: boolean;
  maxStacks: number;
  cost: "pure" | "tradeoff";
  definition: TraitDefinition;
};

export type MobileOpponent = {
  id: string;
  name: string;
  style: string;
  desc: string;
  color: string;
  avatarId: CommonBallAvatarId;
  diff: number;
  traits: TraitId[];
};

export type MobileGameData = {
  pickCount: number;
  cats: MobileTraitCategory[];
  traits: MobileTrait[];
  enemies: MobileOpponent[];
};

const typeToCategory: Record<TraitType, MobileTraitCategoryId> = {
  attribute: "survive",
  collision: "damage",
  projectile: "range",
  summon: "summon",
  status: "status",
  rule: "rule"
};

const categoryByStatTag: Partial<Record<string, MobileTraitCategoryId>> = {
  speed: "move",
  movement: "move",
  size: "move",
  damage: "damage",
  collision: "damage",
  defense: "survive",
  survival: "survive",
  hp: "survive"
};

export const mobileCategories: MobileTraitCategory[] = [
  { id: "survive", name: "生存", en: "SURVIVE", color: "#3ddc84", icon: ["01010", "11111", "11111", "01110", "00100"] },
  { id: "move", name: "运动", en: "MOVE", color: "#22d3ff", icon: ["00100", "01100", "11100", "01100", "00100"] },
  { id: "damage", name: "伤害", en: "DAMAGE", color: "#ff4d4d", icon: ["00100", "10101", "01110", "10101", "00100"] },
  { id: "range", name: "弹道", en: "RANGED", color: "#ffb627", icon: ["00100", "01110", "00100", "00100", "00100"] },
  { id: "summon", name: "召唤", en: "SUMMON", color: "#b14aff", icon: ["11011", "11011", "00000", "11011", "11011"] },
  { id: "status", name: "状态", en: "STATUS", color: "#ff5db1", icon: ["00100", "00100", "01110", "11111", "01110"] },
  { id: "rule", name: "规则", en: "RULE", color: "#7aa2ff", icon: ["11111", "10001", "10101", "10001", "11111"] }
];

export const mobileCategoryById = new Map<MobileTraitCategoryId, MobileTraitCategory>(
  mobileCategories.map((category) => [category.id, category])
);

export const mobileTraits: MobileTrait[] = traitDefinitions.map((trait) => {
  const cat = getMobileCategoryForTrait(trait);
  return {
    id: trait.id,
    name: trait.name,
    sub: trait.description,
    description: `${trait.subtitle} · ${traitTypeLabels[trait.mainType]}`,
    cat,
    tags: trait.tags,
    rarity: trait.rarity ?? "normal",
    repeat: trait.repeatRule.kind === "stackable",
    maxStacks: trait.repeatRule.kind === "stackable" ? trait.repeatRule.maxStacks ?? TRAITS_PER_BUILD : 1,
    cost: hasTradeoff(trait) ? "tradeoff" : "pure",
    definition: trait
  };
});

export const mobileTraitById = new Map<TraitId, MobileTrait>(mobileTraits.map((trait) => [trait.id, trait]));

const opponentColors = ["#ff4d4d", "#3ddc84", "#ffb627", "#b14aff", "#ff5db1", "#7aa2ff"];

export const mobileOpponents: MobileOpponent[] = presetEnemies.map((enemy, index) => ({
  id: enemy.id,
  name: enemy.name,
  style: enemy.subtitle,
  desc: enemy.description,
  color: getOpponentColor(index),
  avatarId: pickCommonBallAvatarId(enemy.id),
  diff: Math.min(3, 1 + Math.floor(index / 2)),
  traits: enemy.traits
}));

export const mobileGameData: MobileGameData = {
  pickCount: TRAITS_PER_BUILD,
  cats: mobileCategories,
  traits: mobileTraits,
  enemies: mobileOpponents
};

export function getMobileTrait(id: TraitId): MobileTrait | undefined {
  return mobileTraitById.get(id);
}

export function getMobileCategoryForTrait(trait: TraitDefinition): MobileTraitCategoryId {
  if (trait.mainType === "attribute") {
    for (const tag of trait.tags) {
      const category = categoryByStatTag[tag];
      if (category) {
        return category;
      }
    }
  }
  return typeToCategory[trait.mainType];
}

export function getMobileCategory(id: MobileTraitCategoryId): MobileTraitCategory {
  const category = mobileCategoryById.get(id);
  if (!category) {
    throw new Error(`Unknown mobile category: ${id}`);
  }
  return category;
}

function hasTradeoff(trait: TraitDefinition): boolean {
  const modifiers = trait.numeric.statModifiers ?? [];
  return modifiers.some((modifier) => modifier.value < 0) || trait.id === "death_split" || trait.id === "one_revive";
}

function getOpponentColor(index: number): string {
  return opponentColors[index % opponentColors.length] ?? "#ff4d4d";
}
