import { baseBallStats } from "@ball-brawl/content";
import type { BallStats } from "@ball-brawl/shared";

export { createStatsForBuild } from "./battle/build-stats";
export { createBattle, DEFAULT_ARENA } from "./battle/create-battle";
export { FIXED_DT, runBattle, stepBattle } from "./battle/step-battle";
export { getSnapshot } from "./battle/snapshot";
export type {
  ArenaState,
  BallMechanics,
  BallRole,
  BallRuntimeState,
  BallState,
  BattleEvent,
  BattleResult,
  BattleWorldState,
  CollisionMechanics,
  WorldSnapshot
} from "./battle/types";
export { SeededRng } from "./rng/seeded-rng";

export const simVersion = "0.1";

export function createBaseStats(): BallStats {
  return { ...baseBallStats };
}
