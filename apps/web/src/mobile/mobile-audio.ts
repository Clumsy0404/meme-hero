export type MobileSfxKey =
  | "ui.click"
  | "ui.tab"
  | "ui.back"
  | "ui.confirm"
  | "ui.select_trait"
  | "ui.remove_trait"
  | "ui.disabled"
  | "ui.pause"
  | "ui.resume"
  | "ui.speed"
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
  "ui.click": { key: "ui.click", volume: 0.34, throttleMs: 35 },
  "ui.tab": { key: "ui.tab", volume: 0.28, throttleMs: 45 },
  "ui.back": { key: "ui.back", volume: 0.32, throttleMs: 80 },
  "ui.confirm": { key: "ui.confirm", volume: 0.42, throttleMs: 80 },
  "ui.select_trait": { key: "ui.select_trait", volume: 0.38, throttleMs: 60 },
  "ui.remove_trait": { key: "ui.remove_trait", volume: 0.34, throttleMs: 80 },
  "ui.disabled": { key: "ui.disabled", volume: 0.26, throttleMs: 120 },
  "ui.pause": { key: "ui.pause", volume: 0.32, throttleMs: 100 },
  "ui.resume": { key: "ui.resume", volume: 0.36, throttleMs: 100 },
  "ui.speed": { key: "ui.speed", volume: 0.3, throttleMs: 80 },
  "battle.start": { key: "battle.start", volume: 0.55, throttleMs: 240 },
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

const MOBILE_BGM_SRC = "/assets/audio/bgm.mp3";
const MOBILE_BGM_VOLUME = 0.22;
const lastPlayedAt = new Map<MobileSfxKey, number>();
let bgmAudio: HTMLAudioElement | undefined;
let synthContext: AudioContext | undefined;

type SynthTone = {
  type: OscillatorType;
  start: number;
  duration: number;
  from: number;
  to?: number;
  volume: number;
};

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

  startMobileBgm();

  if (key === "special.huaqiang_melon") {
    playHuaqiangSynth(ref.volume);
    return;
  }

  if (!ref.src) {
    playSynthSfx(key, ref.volume);
    return;
  }

  if (typeof Audio === "undefined") {
    return;
  }
  const audio = new Audio(ref.src);
  audio.volume = ref.volume;
  void audio.play().catch(() => undefined);
}

export function startMobileBgm(): void {
  if (typeof Audio === "undefined") {
    return;
  }
  const audio = getMobileBgmAudio();
  if (!audio.paused) {
    return;
  }
  void audio.play().catch(() => undefined);
}

function getMobileBgmAudio(): HTMLAudioElement {
  if (!bgmAudio) {
    bgmAudio = new Audio(MOBILE_BGM_SRC);
    bgmAudio.loop = true;
    bgmAudio.preload = "auto";
    bgmAudio.volume = MOBILE_BGM_VOLUME;
  }
  return bgmAudio;
}

function playSynthSfx(key: MobileSfxKey, volume: number): void {
  switch (key) {
    case "ui.click":
      playTones([{ type: "square", start: 0, duration: 0.045, from: 720, to: 520, volume: 0.55 }], volume);
      return;
    case "ui.tab":
      playTones([{ type: "square", start: 0, duration: 0.04, from: 520, to: 680, volume: 0.48 }], volume);
      return;
    case "ui.back":
      playTones([{ type: "triangle", start: 0, duration: 0.075, from: 420, to: 220, volume: 0.62 }], volume);
      return;
    case "ui.confirm":
      playTones(
        [
          { type: "square", start: 0, duration: 0.055, from: 520, to: 700, volume: 0.5 },
          { type: "triangle", start: 0.045, duration: 0.09, from: 780, to: 1040, volume: 0.42 }
        ],
        volume
      );
      return;
    case "ui.select_trait":
      playTones(
        [
          { type: "square", start: 0, duration: 0.055, from: 580, to: 820, volume: 0.5 },
          { type: "triangle", start: 0.035, duration: 0.07, from: 1160, to: 940, volume: 0.26 }
        ],
        volume
      );
      return;
    case "ui.remove_trait":
      playTones([{ type: "square", start: 0, duration: 0.085, from: 520, to: 190, volume: 0.58 }], volume);
      return;
    case "ui.disabled":
      playTones([{ type: "sawtooth", start: 0, duration: 0.075, from: 150, to: 118, volume: 0.36 }], volume);
      return;
    case "ui.pause":
      playTones(
        [
          { type: "square", start: 0, duration: 0.045, from: 320, to: 260, volume: 0.45 },
          { type: "square", start: 0.045, duration: 0.045, from: 260, to: 190, volume: 0.38 }
        ],
        volume
      );
      return;
    case "ui.resume":
      playTones(
        [
          { type: "square", start: 0, duration: 0.045, from: 260, to: 360, volume: 0.42 },
          { type: "square", start: 0.045, duration: 0.055, from: 420, to: 620, volume: 0.42 }
        ],
        volume
      );
      return;
    case "ui.speed":
      playTones(
        [
          { type: "square", start: 0, duration: 0.035, from: 420, to: 520, volume: 0.36 },
          { type: "square", start: 0.032, duration: 0.035, from: 560, to: 700, volume: 0.32 }
        ],
        volume
      );
      return;
    case "battle.start":
      playTones(
        [
          { type: "sawtooth", start: 0, duration: 0.12, from: 180, to: 420, volume: 0.42 },
          { type: "square", start: 0.08, duration: 0.12, from: 640, to: 920, volume: 0.34 },
          { type: "triangle", start: 0.17, duration: 0.16, from: 960, to: 1280, volume: 0.24 }
        ],
        volume
      );
      return;
    default:
      return;
  }
}

function playTones(tones: SynthTone[], volume: number): void {
  const ctx = getSynthContext();
  if (!ctx) {
    return;
  }

  try {
    if (ctx.state === "suspended") {
      void ctx.resume().catch(() => undefined);
    }

    const now = ctx.currentTime;
    for (const tone of tones) {
      const start = now + tone.start;
      const stop = start + tone.duration;
      const gain = ctx.createGain();
      const osc = ctx.createOscillator();

      osc.type = tone.type;
      osc.frequency.setValueAtTime(tone.from, start);
      if (tone.to && tone.to > 0) {
        osc.frequency.exponentialRampToValueAtTime(tone.to, stop);
      }

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.001, volume * tone.volume), start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, stop);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(stop + 0.01);
    }
  } catch {
    // Ignore browsers that block synthesized audio before a user gesture.
  }
}

function getSynthContext(): AudioContext | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }
  const AudioContextCtor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) {
    return undefined;
  }
  if (!synthContext) {
    synthContext = new AudioContextCtor();
  }
  return synthContext;
}

function playHuaqiangSynth(volume: number): void {
  const ctx = getSynthContext();
  if (!ctx) {
    return;
  }

  try {
    if (ctx.state === "suspended") {
      void ctx.resume().catch(() => undefined);
    }
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
  } catch {
    // Ignore browsers that block synthesized audio before a user gesture.
  }
}
