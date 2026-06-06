import type { BuildConfig, MatchConfig, TraitId } from "@ball-brawl/shared";

export const defaultBlueTraits: TraitId[] = ["burn_payload", "slow_payload", "ranged_core", "hp_boost"];
export const defaultRedTraits: TraitId[] = ["shield_cycle", "vulnerable_payload", "giant_body", "collision_boost"];

export function createBuildConfig(name: string, skin: string, traits: TraitId[]): BuildConfig {
  return {
    version: "0.1",
    name,
    skin,
    baseModel: "default",
    traits: [...traits]
  };
}

export function createMatchConfig(blue: BuildConfig, red: BuildConfig, seed = 20260606): MatchConfig {
  return {
    version: "0.1",
    seed,
    arenaId: "mvp_rect",
    blue,
    red
  };
}

export const demoMatchConfig = createMatchConfig(
  createBuildConfig("蓝方小球", "default_blue", defaultBlueTraits),
  createBuildConfig("红方小球", "default_red", defaultRedTraits)
);
