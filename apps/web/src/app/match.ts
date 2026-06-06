import type { BuildConfig, MatchConfig } from "@ball-brawl/shared";

const emptyBuild = (name: string, skin: string): BuildConfig => ({
  version: "0.1",
  name,
  skin,
  baseModel: "default",
  traits: []
});

export const demoMatchConfig: MatchConfig = {
  version: "0.1",
  seed: 20260606,
  arenaId: "mvp_rect",
  blue: emptyBuild("蓝方小球", "default_blue"),
  red: emptyBuild("红方小球", "default_red")
};
