import type { ProjectileKind, StatusEffectId } from "@ball-brawl/sim";
import type { Team, TraitId } from "@ball-brawl/shared";

export type MobileAssetKey =
  | `ball.${string}`
  | `projectile.${string}`
  | `summon.${string}`
  | `vfx.${string}`
  | `trait.${string}`
  | `ui.${string}`;

export type MobileAssetRef = {
  key: MobileAssetKey;
  kind: "placeholder" | "image" | "spritesheet";
  src?: string;
};

export type MobileAssetManifest = {
  balls: Record<Team | "meme_placeholder", MobileAssetRef>;
  projectiles: Record<ProjectileKind, MobileAssetRef>;
  summons: Record<"clone" | "split" | "turret", MobileAssetRef>;
  statuses: Record<StatusEffectId | "shield", MobileAssetRef>;
  traits: Partial<Record<TraitId, MobileAssetRef>>;
};

export type SpecialTraitAsset = {
  traitId: TraitId;
  ballSrc: string;
  sfxSrc?: string;
  priority: number;
};

export const mobileAssetManifest: MobileAssetManifest = {
  balls: {
    blue: { key: "ball.default_blue", kind: "placeholder" },
    red: { key: "ball.default_red", kind: "placeholder" },
    meme_placeholder: { key: "ball.meme_placeholder", kind: "placeholder" }
  },
  projectiles: {
    basic: { key: "projectile.basic", kind: "placeholder" },
    child: { key: "projectile.child", kind: "placeholder" },
    turret: { key: "projectile.turret", kind: "placeholder" },
    basketball: { key: "projectile.basketball", kind: "placeholder" },
    melon: { key: "projectile.melon", kind: "placeholder" },
    melon_knife: { key: "projectile.melon_knife", kind: "placeholder" }
  },
  summons: {
    clone: { key: "summon.clone", kind: "placeholder" },
    split: { key: "summon.split", kind: "placeholder" },
    turret: { key: "summon.turret", kind: "placeholder" }
  },
  statuses: {
    burn: { key: "vfx.burn", kind: "placeholder" },
    poison: { key: "vfx.poison", kind: "placeholder" },
    slow: { key: "vfx.slow", kind: "placeholder" },
    vulnerable: { key: "vfx.vulnerable", kind: "placeholder" },
    shield: { key: "vfx.shield", kind: "placeholder" }
  },
  traits: {}
};

export const specialTraitAssets: Partial<Record<TraitId, SpecialTraitAsset>> = {
  special_elbow_strike: {
    traitId: "special_elbow_strike",
    ballSrc: "/assets/special/special_elbow_strike.png",
    sfxSrc: "/assets/special/special_elbow_strike.mp3",
    priority: 1
  },
  special_bounce_basketball: {
    traitId: "special_bounce_basketball",
    ballSrc: "/assets/special/special_bounce_basketball.png",
    sfxSrc: "/assets/special/special_bounce_basketball.mp3",
    priority: 2
  },
  special_hajimi_guard: {
    traitId: "special_hajimi_guard",
    ballSrc: "/assets/special/special_hajimi_guard.png",
    sfxSrc: "/assets/special/special_hajimi_guard.mp3",
    priority: 3
  },
  special_blade_shield_stance: {
    traitId: "special_blade_shield_stance",
    ballSrc: "/assets/special/special_blade_shield_stance.png",
    sfxSrc: "/assets/special/special_blade_shield_stance_hit.mp3",
    priority: 4
  },
  special_dongbei_tiger_gaze: {
    traitId: "special_dongbei_tiger_gaze",
    ballSrc: "/assets/special/special_dongbei_tiger_gaze.png",
    sfxSrc: "/assets/special/special_dongbei_tiger_gaze.mp3",
    priority: 5
  },
  special_huaqiang_melon: {
    traitId: "special_huaqiang_melon",
    ballSrc: "/assets/special/special_huaqiang_melon.png",
    priority: 6
  },
  special_shenying_black_hand: {
    traitId: "special_shenying_black_hand",
    ballSrc: "/assets/special/special_shenying_black_hand.png",
    sfxSrc: "/assets/special/special_shenying_black_hand.mp3",
    priority: 7
  }
};

export function getSpecialTraitAsset(traits: TraitId[]): SpecialTraitAsset | undefined {
  return traits
    .map((traitId) => specialTraitAssets[traitId])
    .filter((asset): asset is SpecialTraitAsset => Boolean(asset))
    .sort((a, b) => a.priority - b.priority)[0];
}

export const teamColors: Record<Team, string> = {
  blue: "#22d3ff",
  red: "#ff4d5e"
};

export const statusColors: Record<StatusEffectId | "shield", string> = {
  burn: "#fb923c",
  poison: "#3ddc84",
  slow: "#60a5fa",
  vulnerable: "#ff5db1",
  shield: "#93c5fd"
};

export const statusLabels: Record<StatusEffectId | "shield", string> = {
  burn: "燃烧",
  poison: "中毒",
  slow: "减速",
  vulnerable: "脆弱",
  shield: "护盾"
};

export const specialEffectColors = {
  elbowReady: "#ffd23f",
  hajimiGuard: "#ff8bd1",
  bladeStance: "#ffe066",
  shieldStance: "#93c5fd",
  tigerGaze: "#ffb627",
  blackHandWarning: "#7c3aed",
  blackHandGrab: "#111827"
} as const;
