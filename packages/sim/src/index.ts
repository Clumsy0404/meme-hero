import { baseBallStats } from "@ball-brawl/content";
import type { BallStats } from "@ball-brawl/shared";

export { createStatsForBuild } from "./battle/build-stats";
export { defaultProjectileMechanicsConfig, defaultTurretMechanicsConfig } from "./battle/build-mechanics";
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
  BlackHandPhase,
  BladeShieldStance,
  CollisionMechanics,
  ActiveStatusEffect,
  HuaqiangProjectileKind,
  ProjectileKind,
  ProjectileMechanics,
  ProjectileState,
  RenderStatusEffect,
  RenderProjectile,
  RenderTurret,
  RuleMechanics,
  SpecialMechanics,
  StatusApplicationMechanics,
  StatusEffectId,
  StatusMechanics,
  SummonMechanics,
  TurretState,
  WorldSnapshot
} from "./battle/types";
export { SeededRng } from "./rng/seeded-rng";

export const simVersion = "0.1";

export function createBaseStats(): BallStats {
  return { ...baseBallStats };
}
