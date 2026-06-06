import type { BallStats, MatchConfig, Team, Vec2 } from "@ball-brawl/shared";

import { normalize, vec } from "../math/vector";
import { SeededRng } from "../rng/seeded-rng";
import { createMechanicsForBuild, createRuntimeState } from "./build-mechanics";
import { createStatsForBuild } from "./build-stats";
import type { ArenaState, BallState, BattleWorldState } from "./types";

export const DEFAULT_ARENA: ArenaState = {
  id: "mvp_rect",
  width: 720,
  height: 920
};

export function createBattle(match: MatchConfig, arena: ArenaState = DEFAULT_ARENA): BattleWorldState {
  const rng = new SeededRng(match.seed);
  const centerY = arena.height / 2;
  const blueStats = createStatsForBuild(match.blue);
  const redStats = createStatsForBuild(match.red);
  const blueMechanics = createMechanicsForBuild(match.blue);
  const redMechanics = createMechanicsForBuild(match.red);
  const blue = createMainBall(
    "blue-main",
    "blue",
    blueStats,
    blueMechanics,
    vec(arena.width * 0.28, centerY),
    initialVelocity("blue", rng, blueStats.moveSpeed)
  );
  const red = createMainBall(
    "red-main",
    "red",
    redStats,
    redMechanics,
    vec(arena.width * 0.72, centerY),
    initialVelocity("red", rng, redStats.moveSpeed)
  );

  return {
    version: match.version,
    tick: 0,
    time: 0,
    rng,
    arena,
    balls: [blue, red],
    events: []
  };
}

function createMainBall(
  id: string,
  team: Team,
  stats: BallStats,
  mechanics: BallState["mechanics"],
  position: Vec2,
  velocity: Vec2
): BallState {
  return {
    id,
    team,
    role: "main",
    alive: true,
    hp: stats.maxHp,
    stats,
    mechanics,
    runtime: createRuntimeState(),
    position,
    velocity,
    collisionTimers: {}
  };
}

function initialVelocity(team: Team, rng: SeededRng, moveSpeed: number): Vec2 {
  const x = team === "blue" ? 1 : -1;
  const y = rng.range(-0.42, 0.42);
  const direction = normalize({ x, y });
  return { x: direction.x * moveSpeed, y: direction.y * moveSpeed };
}
