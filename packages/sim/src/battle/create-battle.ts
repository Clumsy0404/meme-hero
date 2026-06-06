import { baseBallStats } from "@ball-brawl/content";
import type { BallStats, MatchConfig, Team, Vec2 } from "@ball-brawl/shared";

import { normalize, vec } from "../math/vector";
import { SeededRng } from "../rng/seeded-rng";
import type { ArenaState, BallState, BattleWorldState } from "./types";

export const DEFAULT_ARENA: ArenaState = {
  id: "mvp_rect",
  width: 720,
  height: 920
};

export function createBattle(match: MatchConfig, arena: ArenaState = DEFAULT_ARENA): BattleWorldState {
  const rng = new SeededRng(match.seed);
  const centerY = arena.height / 2;
  const stats = createStatsCopy();
  const blue = createMainBall("blue-main", "blue", stats, vec(arena.width * 0.28, centerY), initialVelocity("blue", rng));
  const red = createMainBall("red-main", "red", createStatsCopy(), vec(arena.width * 0.72, centerY), initialVelocity("red", rng));

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

function createStatsCopy(): BallStats {
  return { ...baseBallStats };
}

function createMainBall(id: string, team: Team, stats: BallStats, position: Vec2, velocity: Vec2): BallState {
  return {
    id,
    team,
    role: "main",
    alive: true,
    hp: stats.maxHp,
    stats,
    position,
    velocity,
    collisionTimers: {}
  };
}

function initialVelocity(team: Team, rng: SeededRng): Vec2 {
  const x = team === "blue" ? 1 : -1;
  const y = rng.range(-0.42, 0.42);
  const direction = normalize({ x, y });
  return { x: direction.x * baseBallStats.moveSpeed, y: direction.y * baseBallStats.moveSpeed };
}
