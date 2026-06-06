import type { StatusEffectId } from "@ball-brawl/sim";
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
  projectiles: Record<"basic" | "child", MobileAssetRef>;
  summons: Record<"clone" | "split" | "turret", MobileAssetRef>;
  statuses: Record<StatusEffectId | "shield", MobileAssetRef>;
  traits: Partial<Record<TraitId, MobileAssetRef>>;
};

export const mobileAssetManifest: MobileAssetManifest = {
  balls: {
    blue: { key: "ball.default_blue", kind: "placeholder" },
    red: { key: "ball.default_red", kind: "placeholder" },
    meme_placeholder: { key: "ball.meme_placeholder", kind: "placeholder" }
  },
  projectiles: {
    basic: { key: "projectile.basic", kind: "placeholder" },
    child: { key: "projectile.child", kind: "placeholder" }
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
