import { presetEnemies } from "@ball-brawl/content";
import { createBattle, runBattle } from "@ball-brawl/sim";
import type { BattleResult } from "@ball-brawl/sim";
import type { BuildConfig, MatchConfig, TraitId } from "@ball-brawl/shared";

export type BalanceBuild = {
  id: string;
  name: string;
  traits: TraitId[];
};

export type SeriesOptions = {
  rounds: number;
  seed: number;
  mirrorSides?: boolean;
};

export type SeriesReport = {
  a: BalanceBuild;
  b: BalanceBuild;
  rounds: number;
  totalBattles: number;
  mirrorSides: boolean;
  aWins: number;
  bWins: number;
  draws: number;
  averageDuration: number;
  averageARemainingHp: number;
  averageBRemainingHp: number;
};

export type MatrixRow = {
  aId: string;
  bId: string;
  aWinRate: number;
  bWinRate: number;
  drawRate: number;
  averageDuration: number;
};

export const defaultSeriesOptions: SeriesOptions = {
  rounds: 50,
  seed: 20260606,
  mirrorSides: true
};

export const presetBuilds: BalanceBuild[] = presetEnemies.map((preset) => ({
  id: preset.id,
  name: preset.name,
  traits: [...preset.traits]
}));

export function findPresetBuild(id: string): BalanceBuild {
  const preset = presetBuilds.find((build) => build.id === id);
  if (!preset) {
    throw new Error(`Unknown preset id: ${id}`);
  }
  return preset;
}

export function runSeries(a: BalanceBuild, b: BalanceBuild, options: Partial<SeriesOptions> = {}): SeriesReport {
  const resolved = { ...defaultSeriesOptions, ...options };
  const rounds = clampInteger(resolved.rounds, 1, 10000);
  const mirrorSides = resolved.mirrorSides ?? true;
  const stats = {
    aWins: 0,
    bWins: 0,
    draws: 0,
    duration: 0,
    aRemainingHp: 0,
    bRemainingHp: 0
  };

  for (let round = 0; round < rounds; round += 1) {
    const seed = resolved.seed + round;
    accumulateBattle(stats, runSingleBattle(a, b, seed), "normal");

    if (mirrorSides) {
      accumulateBattle(stats, runSingleBattle(b, a, seed + rounds), "mirrored");
    }
  }

  const totalBattles = rounds * (mirrorSides ? 2 : 1);
  return {
    a,
    b,
    rounds,
    totalBattles,
    mirrorSides,
    aWins: stats.aWins,
    bWins: stats.bWins,
    draws: stats.draws,
    averageDuration: stats.duration / totalBattles,
    averageARemainingHp: stats.aRemainingHp / totalBattles,
    averageBRemainingHp: stats.bRemainingHp / totalBattles
  };
}

export function runPresetMatrix(options: Partial<SeriesOptions> = {}): MatrixRow[] {
  const rows: MatrixRow[] = [];

  for (let i = 0; i < presetBuilds.length; i += 1) {
    for (let j = i + 1; j < presetBuilds.length; j += 1) {
      const a = presetBuilds[i];
      const b = presetBuilds[j];
      if (!a || !b) {
        continue;
      }
      const report = runSeries(a, b, options);
      rows.push({
        aId: a.id,
        bId: b.id,
        aWinRate: report.aWins / report.totalBattles,
        bWinRate: report.bWins / report.totalBattles,
        drawRate: report.draws / report.totalBattles,
        averageDuration: report.averageDuration
      });
    }
  }

  return rows;
}

export function formatSeriesReport(report: SeriesReport): string {
  const lines = [
    `${report.a.name} vs ${report.b.name}`,
    `battles: ${report.totalBattles} (${report.rounds} rounds${report.mirrorSides ? ", mirrored" : ""})`,
    `${report.a.id}: ${formatPercent(report.aWins / report.totalBattles)} win, avg hp ${formatNumber(report.averageARemainingHp)}`,
    `${report.b.id}: ${formatPercent(report.bWins / report.totalBattles)} win, avg hp ${formatNumber(report.averageBRemainingHp)}`,
    `draw: ${formatPercent(report.draws / report.totalBattles)}`,
    `avg duration: ${formatNumber(report.averageDuration)}s`
  ];
  return lines.join("\n");
}

export function formatMatrix(rows: MatrixRow[]): string {
  const header = "preset_a,preset_b,a_win,b_win,draw,avg_duration";
  const body = rows.map((row) =>
    [
      row.aId,
      row.bId,
      formatPercent(row.aWinRate),
      formatPercent(row.bWinRate),
      formatPercent(row.drawRate),
      `${formatNumber(row.averageDuration)}s`
    ].join(",")
  );
  return [header, ...body].join("\n");
}

function runSingleBattle(a: BalanceBuild, b: BalanceBuild, seed: number): BattleResult {
  const world = runBattle(
    createBattle({
      version: "0.1",
      seed,
      arenaId: "mvp_rect",
      blue: createBuild(a, "default_blue"),
      red: createBuild(b, "default_red")
    } satisfies MatchConfig)
  );
  if (!world.result) {
    throw new Error("Battle finished without result");
  }
  return world.result;
}

function createBuild(build: BalanceBuild, skin: string): BuildConfig {
  return {
    version: "0.1",
    name: build.name,
    skin,
    baseModel: "default",
    traits: [...build.traits]
  };
}

function accumulateBattle(
  stats: {
    aWins: number;
    bWins: number;
    draws: number;
    duration: number;
    aRemainingHp: number;
    bRemainingHp: number;
  },
  result: BattleResult,
  side: "normal" | "mirrored"
): void {
  if (result.winner === "draw") {
    stats.draws += 1;
  } else if ((side === "normal" && result.winner === "blue") || (side === "mirrored" && result.winner === "red")) {
    stats.aWins += 1;
  } else {
    stats.bWins += 1;
  }

  stats.duration += result.duration;
  stats.aRemainingHp += side === "normal" ? result.blueRemainingHp : result.redRemainingHp;
  stats.bRemainingHp += side === "normal" ? result.redRemainingHp : result.blueRemainingHp;
}

function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, Math.floor(value)));
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatNumber(value: number): string {
  return value.toFixed(1).replace(/\.0$/, "");
}
