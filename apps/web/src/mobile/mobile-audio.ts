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
  | "special.hajimi_guard"
  | "special.blade_shield_hit"
  | "special.blade_shield_guard"
  | "special.dongbei_tiger_gaze"
  | "special.huaqiang_melon"
  | "special.shenying_black_hand";

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
  },
  "special.blade_shield_hit": {
    key: "special.blade_shield_hit",
    src: "/assets/special/special_blade_shield_stance_hit.mp3",
    volume: 0.64,
    throttleMs: 140
  },
  "special.blade_shield_guard": {
    key: "special.blade_shield_guard",
    src: "/assets/special/special_blade_shield_stance_guard.mp3",
    volume: 0.64,
    throttleMs: 180
  },
  "special.dongbei_tiger_gaze": {
    key: "special.dongbei_tiger_gaze",
    src: "/assets/special/special_dongbei_tiger_gaze.mp3",
    volume: 0.72,
    throttleMs: 250
  },
  "special.huaqiang_melon": {
    key: "special.huaqiang_melon",
    volume: 0.46,
    throttleMs: 120
  },
  "special.shenying_black_hand": {
    key: "special.shenying_black_hand",
    src: "/assets/special/special_shenying_black_hand.mp3",
    volume: 0.72,
    throttleMs: 250
  }
};

const lastPlayedAt = new Map<MobileSfxKey, number>();

export function playMobileSfx(key: MobileSfxKey): void {
  const ref = mobileSfxManifest[key];
  if (!ref) {
    return;
  }

  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  const last = lastPlayedAt.get(key) ?? Number.NEGATIVE_INFINITY;
  if (now - last < (ref.throttleMs ?? 0)) {
    return;
  }
  lastPlayedAt.set(key, now);

  if (key === "special.huaqiang_melon") {
    playHuaqiangSynth(ref.volume);
    return;
  }

  if (!ref.src || typeof Audio === "undefined") {
    return;
  }

  const audio = new Audio(ref.src);
  audio.volume = ref.volume;
  void audio.play().catch(() => undefined);
}

function playHuaqiangSynth(volume: number): void {
  if (typeof window === "undefined") {
    return;
  }
  const AudioContextCtor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) {
    return;
  }

  try {
    const ctx = new AudioContextCtor();
    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, volume), now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    gain.connect(ctx.destination);

    const tone = ctx.createOscillator();
    tone.type = "square";
    tone.frequency.setValueAtTime(280, now);
    tone.frequency.exponentialRampToValueAtTime(96, now + 0.12);
    tone.connect(gain);
    tone.start(now);
    tone.stop(now + 0.16);

    const snap = ctx.createOscillator();
    const snapGain = ctx.createGain();
    snap.type = "triangle";
    snap.frequency.setValueAtTime(740, now + 0.045);
    snap.frequency.exponentialRampToValueAtTime(220, now + 0.11);
    snapGain.gain.setValueAtTime(0.0001, now + 0.04);
    snapGain.gain.exponentialRampToValueAtTime(Math.max(0.001, volume * 0.7), now + 0.052);
    snapGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);
    snap.connect(snapGain);
    snapGain.connect(ctx.destination);
    snap.start(now + 0.04);
    snap.stop(now + 0.14);

    window.setTimeout(() => void ctx.close().catch(() => undefined), 260);
  } catch {
    // Ignore browsers that block synthesized audio before a user gesture.
  }
}
