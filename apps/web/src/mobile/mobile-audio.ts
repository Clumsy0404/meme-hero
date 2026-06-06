export type MobileSfxKey =
  | "ui.click"
  | "ui.confirm"
  | "battle.start"
  | "battle.collision_hit"
  | "battle.projectile_fire"
  | "battle.projectile_hit"
  | "battle.status_apply"
  | "battle.shield_gain"
  | "battle.shield_break"
  | "battle.death"
  | "battle.revive"
  | "battle.win"
  | "battle.lose";

export type MobileSfxRef = {
  key: MobileSfxKey;
  src?: string;
  volume: number;
};

export const mobileSfxManifest: Record<MobileSfxKey, MobileSfxRef> = {
  "ui.click": { key: "ui.click", volume: 0.45 },
  "ui.confirm": { key: "ui.confirm", volume: 0.55 },
  "battle.start": { key: "battle.start", volume: 0.65 },
  "battle.collision_hit": { key: "battle.collision_hit", volume: 0.7 },
  "battle.projectile_fire": { key: "battle.projectile_fire", volume: 0.48 },
  "battle.projectile_hit": { key: "battle.projectile_hit", volume: 0.62 },
  "battle.status_apply": { key: "battle.status_apply", volume: 0.55 },
  "battle.shield_gain": { key: "battle.shield_gain", volume: 0.5 },
  "battle.shield_break": { key: "battle.shield_break", volume: 0.68 },
  "battle.death": { key: "battle.death", volume: 0.8 },
  "battle.revive": { key: "battle.revive", volume: 0.75 },
  "battle.win": { key: "battle.win", volume: 0.8 },
  "battle.lose": { key: "battle.lose", volume: 0.8 }
};

export function playMobileSfx(key: MobileSfxKey): void {
  void mobileSfxManifest[key];
}
