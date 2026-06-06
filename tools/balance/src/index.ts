import { findPresetBuild, formatMatrix, formatSeriesReport, presetBuilds, runPresetMatrix, runSeries } from "./simulate";

type CliOptions = {
  blueId: string;
  redId: string;
  rounds: number;
  seed: number;
  matrix: boolean;
  json: boolean;
  mirrorSides: boolean;
  help: boolean;
};

const defaultOptions: CliOptions = {
  blueId: "collision_bruiser",
  redId: "projectile_rain",
  rounds: 50,
  seed: 20260606,
  matrix: false,
  json: false,
  mirrorSides: true,
  help: false
};

function main(argv: string[]): void {
  const options = parseArgs(argv);
  if (options.help) {
    printHelp();
    return;
  }

  if (options.matrix) {
    const rows = runPresetMatrix({ rounds: options.rounds, seed: options.seed, mirrorSides: options.mirrorSides });
    console.log(options.json ? JSON.stringify(rows, null, 2) : formatMatrix(rows));
    return;
  }

  const blue = findPresetBuild(options.blueId);
  const red = findPresetBuild(options.redId);
  const report = runSeries(blue, red, {
    rounds: options.rounds,
    seed: options.seed,
    mirrorSides: options.mirrorSides
  });
  console.log(options.json ? JSON.stringify(report, null, 2) : formatSeriesReport(report));
}

function parseArgs(argv: string[]): CliOptions {
  const options = { ...defaultOptions };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg) {
      continue;
    }
    switch (arg) {
      case "--blue":
        options.blueId = readValue(argv, index, arg);
        index += 1;
        break;
      case "--red":
        options.redId = readValue(argv, index, arg);
        index += 1;
        break;
      case "--rounds":
        options.rounds = readPositiveInteger(argv, index, arg);
        index += 1;
        break;
      case "--seed":
        options.seed = readPositiveInteger(argv, index, arg);
        index += 1;
        break;
      case "--matrix":
        options.matrix = true;
        break;
      case "--json":
        options.json = true;
        break;
      case "--no-mirror":
        options.mirrorSides = false;
        break;
      case "--help":
      case "-h":
        options.help = true;
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }

  return options;
}

function readValue(argv: string[], index: number, optionName: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${optionName}`);
  }
  return value;
}

function readPositiveInteger(argv: string[], index: number, optionName: string): number {
  const value = Number(readValue(argv, index, optionName));
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${optionName} must be a positive integer`);
  }
  return value;
}

function printHelp(): void {
  const presets = presetBuilds.map((build) => `  ${build.id}: ${build.name}`).join("\n");
  console.log(`Usage:
  pnpm --filter @ball-brawl/balance simulate
  pnpm --filter @ball-brawl/balance simulate --blue collision_bruiser --red projectile_rain --rounds 100
  pnpm --filter @ball-brawl/balance simulate --matrix --rounds 20

Options:
  --blue <id>       preset id for build A
  --red <id>        preset id for build B
  --rounds <n>      mirrored rounds, default 50
  --seed <n>        base random seed, default 20260606
  --matrix          run every preset pair
  --json            print JSON instead of table text
  --no-mirror       do not swap sides for each round
  --help            show this help

Preset ids:
${presets}`);
}

try {
  main(process.argv.slice(2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
