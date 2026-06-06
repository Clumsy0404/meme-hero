import { traitDefinitions } from "@ball-brawl/content";
import { TRAITS_PER_BUILD, type TraitId } from "@ball-brawl/shared";

export const BUILD_STORAGE_KEY = "small-ball-brawl.saved-build.v1";

export type SavedBattleMode = "free" | "challenge";

export type SavedBuildState = {
  version: "0.1";
  battleMode: SavedBattleMode;
  selectedPresetId: string;
  blueTraits: TraitId[];
  redTraits: TraitId[];
};

type BuildStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

const knownTraitIds = new Set<TraitId>(traitDefinitions.map((trait) => trait.id));

export function readSavedBuildState(storage: BuildStorage | null, fallback: SavedBuildState): SavedBuildState {
  if (!storage) {
    return fallback;
  }

  try {
    const raw = storage.getItem(BUILD_STORAGE_KEY);
    if (!raw) {
      return fallback;
    }

    return normalizeSavedBuildState(JSON.parse(raw), fallback);
  } catch {
    return fallback;
  }
}

export function writeSavedBuildState(storage: BuildStorage | null, state: SavedBuildState): void {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(BUILD_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore quota or privacy-mode failures; battle setup should remain playable.
  }
}

export function getBrowserBuildStorage(): BuildStorage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function normalizeSavedBuildState(value: unknown, fallback: SavedBuildState): SavedBuildState {
  if (!isRecord(value)) {
    return fallback;
  }

  return {
    version: "0.1",
    battleMode: value.battleMode === "free" || value.battleMode === "challenge" ? value.battleMode : fallback.battleMode,
    selectedPresetId: typeof value.selectedPresetId === "string" ? value.selectedPresetId : fallback.selectedPresetId,
    blueTraits: normalizeTraitList(value.blueTraits, fallback.blueTraits),
    redTraits: normalizeTraitList(value.redTraits, fallback.redTraits)
  };
}

function normalizeTraitList(value: unknown, fallback: TraitId[]): TraitId[] {
  if (!Array.isArray(value) || value.length !== TRAITS_PER_BUILD) {
    return fallback;
  }

  const traits = value.filter((traitId): traitId is TraitId => typeof traitId === "string" && knownTraitIds.has(traitId));
  return traits.length === TRAITS_PER_BUILD ? traits : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
