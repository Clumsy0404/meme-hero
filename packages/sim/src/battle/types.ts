import type { BallStats, Team, Vec2 } from "@ball-brawl/shared";

import type { SeededRng } from "../rng/seeded-rng";

export type BallRole = "main" | "clone" | "split";

export type ArenaState = {
  id: string;
  width: number;
  height: number;
};

export type BallState = {
  id: string;
  team: Team;
  role: BallRole;
  alive: boolean;
  hp: number;
  stats: BallStats;
  position: Vec2;
  velocity: Vec2;
  collisionTimers: Record<string, number>;
};

export type DamageTag = "collision" | "projectile" | "dot" | "explosion" | "reflect";

export type DamageEvent = {
  type: "damage";
  tick: number;
  sourceId?: string;
  targetId: string;
  amount: number;
  tags: DamageTag[];
  position: Vec2;
};

export type CollisionEvent = {
  type: "collision";
  tick: number;
  aId: string;
  bId: string;
  position: Vec2;
};

export type WallBounceEvent = {
  type: "wall_bounce";
  tick: number;
  ballId: string;
  position: Vec2;
};

export type MatchEndEvent = {
  type: "match_end";
  tick: number;
  result: BattleResult;
};

export type BattleEvent = DamageEvent | CollisionEvent | WallBounceEvent | MatchEndEvent;

export type BattleEndReason = "main_ball_dead" | "double_ko" | "timeout";

export type BattleResult = {
  winner: Team | "draw";
  reason: BattleEndReason;
  duration: number;
  blueRemainingHp: number;
  redRemainingHp: number;
};

export type BattleWorldState = {
  version: string;
  tick: number;
  time: number;
  rng: SeededRng;
  arena: ArenaState;
  balls: BallState[];
  events: BattleEvent[];
  result?: BattleResult;
};

export type RenderBall = {
  id: string;
  team: Team;
  role: BallRole;
  alive: boolean;
  hp: number;
  maxHp: number;
  radius: number;
  position: Vec2;
};

export type WorldSnapshot = {
  tick: number;
  time: number;
  arena: ArenaState;
  balls: RenderBall[];
  events: BattleEvent[];
  result?: BattleResult;
};
