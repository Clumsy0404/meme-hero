import { describe, expect, it } from "vitest";

import { BUILD_STORAGE_KEY, normalizeSavedBuildState, readSavedBuildState, type SavedBuildState, writeSavedBuildState } from "./build-storage";

const fallback: SavedBuildState = {
  version: "0.1",
  battleMode: "challenge",
  selectedPresetId: "collision_bruiser",
  blueTraits: ["low_hp_rage", "kill_growth", "time_growth", "collision_boost"],
  redTraits: ["one_revive", "shield_cycle", "vulnerable_payload", "giant_body"]
};

describe("build storage", () => {
  it("normalizes a valid saved setup", () => {
    const saved = normalizeSavedBuildState(
      {
        version: "0.1",
        battleMode: "free",
        selectedPresetId: "projectile_rain",
        blueTraits: ["hp_boost", "speed_boost", "giant_body", "collision_boost"],
        redTraits: ["ranged_core", "pellet_barrage", "homing_shot", "pierce_shot"]
      },
      fallback
    );

    expect(saved.battleMode).toBe("free");
    expect(saved.selectedPresetId).toBe("projectile_rain");
    expect(saved.blueTraits).toEqual(["hp_boost", "speed_boost", "giant_body", "collision_boost"]);
    expect(saved.redTraits).toEqual(["ranged_core", "pellet_barrage", "homing_shot", "pierce_shot"]);
  });

  it("falls back when saved trait lists are malformed", () => {
    const saved = normalizeSavedBuildState(
      {
        battleMode: "free",
        selectedPresetId: "status_drain",
        blueTraits: ["unknown_trait", "speed_boost", "giant_body", "collision_boost"],
        redTraits: ["ranged_core"]
      },
      fallback
    );

    expect(saved.battleMode).toBe("free");
    expect(saved.blueTraits).toEqual(fallback.blueTraits);
    expect(saved.redTraits).toEqual(fallback.redTraits);
  });

  it("reads and writes using the storage key", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value)
    };

    const state: SavedBuildState = {
      ...fallback,
      battleMode: "free",
      selectedPresetId: "late_growth"
    };

    writeSavedBuildState(storage, state);

    expect(values.has(BUILD_STORAGE_KEY)).toBe(true);
    expect(readSavedBuildState(storage, fallback)).toEqual(state);
  });
});
