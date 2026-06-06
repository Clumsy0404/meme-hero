import { baseBallStats } from "@ball-brawl/content";
import type { BallStats } from "@ball-brawl/shared";

export const simVersion = "0.1";

export function createBaseStats(): BallStats {
  return { ...baseBallStats };
}
