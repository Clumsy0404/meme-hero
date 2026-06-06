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
  | "battle.lose"
  | "special.elbow_strike"
  | "special.bounce_basketball"
  | "special.hajimi_guard";

export type MobileSfxRef = {
  key: MobileSfxKey;
  src?: string;
  volume: number;
  throttleMs?: number;
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
  "battle.lose": { key: "battle.lose", volume: 0.8 },
  "special.elbow_strike": {
    key: "special.elbow_strike",
    src: "/assets/special/special_elbow_strike.mp3",
    volume: 0.72,
    throttleMs: 150
  },
  "special.bounce_basketball": {
    key: "special.bounce_basketball",
    src: "/assets/special/special_bounce_basketball.mp3",
    volume: 0.62,
    throttleMs: 150
  },
  "special.hajimi_guard": {
    key: "special.hajimi_guard",
    src: "/assets/special/special_hajimi_guard.mp3",
    volume: 0.68,
    throttleMs: 150
  }
};

const lastPlayedAt = new Map<MobileSfxKey, number>();

export function playMobileSfx(key: MobileSfxKey): void {
  const ref = mobileSfxManifest[key];
  if (!ref?.src || typeof Audio === "undefined") {
    return;
  }

  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  const last = lastPlayedAt.get(key) ?? Number.NEGATIVE_INFINITY;
  if (now - last < (ref.throttleMs ?? 0)) {
    return;
  }
  lastPlayedAt.set(key, now);

  const audio = new Audio(ref.src);
  audio.volume = ref.volume;
  void audio.play().catch(() => undefined);
}
