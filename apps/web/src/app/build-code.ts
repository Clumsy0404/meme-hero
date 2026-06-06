import { validateBuildConfig } from "@ball-brawl/content";
import type { BuildConfig, TraitId } from "@ball-brawl/shared";

const BUILD_ARCHIVE_KIND = "ball_build";
const BUILD_ARCHIVE_VERSION = "0.1";

export type BuildArchive = {
  kind: typeof BUILD_ARCHIVE_KIND;
  version: typeof BUILD_ARCHIVE_VERSION;
  build: BuildConfig;
};

export type DecodeBuildArchiveResult = { ok: true; build: BuildConfig } | { ok: false; message: string };

export function encodeBuildArchive(build: BuildConfig): string {
  const archive: BuildArchive = {
    kind: BUILD_ARCHIVE_KIND,
    version: BUILD_ARCHIVE_VERSION,
    build: {
      ...build,
      traits: [...build.traits]
    }
  };

  return JSON.stringify(archive, null, 2);
}

export function decodeBuildArchive(text: string): DecodeBuildArchiveResult {
  if (text.trim().length === 0) {
    return { ok: false, message: "构筑码为空" };
  }

  try {
    const parsed = JSON.parse(text) as unknown;
    const build = normalizeBuildConfig(parsed);
    if (!build) {
      return { ok: false, message: "构筑码格式不正确" };
    }

    const validation = validateBuildConfig(build);
    if (!validation.ok) {
      return { ok: false, message: validation.issues[0]?.message ?? "构筑校验未通过" };
    }

    return { ok: true, build };
  } catch {
    return { ok: false, message: "构筑码不是有效 JSON" };
  }
}

function normalizeBuildConfig(value: unknown): BuildConfig | null {
  const rawBuild = isRecord(value) && value.kind === BUILD_ARCHIVE_KIND ? value.build : value;
  if (!isRecord(rawBuild)) {
    return null;
  }

  const traits = normalizeTraits(rawBuild.traits);
  if (!traits) {
    return null;
  }

  return {
    version: typeof rawBuild.version === "string" ? rawBuild.version : BUILD_ARCHIVE_VERSION,
    name: typeof rawBuild.name === "string" && rawBuild.name.trim().length > 0 ? rawBuild.name : "导入构筑",
    skin: typeof rawBuild.skin === "string" && rawBuild.skin.trim().length > 0 ? rawBuild.skin : "default_blue",
    baseModel: typeof rawBuild.baseModel === "string" && rawBuild.baseModel.trim().length > 0 ? rawBuild.baseModel : "default",
    traits
  };
}

function normalizeTraits(value: unknown): TraitId[] | null {
  if (!Array.isArray(value) || !value.every((traitId) => typeof traitId === "string")) {
    return null;
  }

  return [...value];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
