import { baseBallStats, traitDefinitions, traitTypeLabels, validateBuildConfig } from "@ball-brawl/content";
import { createStatsForBuild, type WorldSnapshot } from "@ball-brawl/sim";
import {
  TRAITS_PER_BUILD,
  type BallStats,
  type BuildConfig,
  type BuildValidationResult,
  type Team,
  type TraitDefinition,
  type TraitId,
  type TraitType
} from "@ball-brawl/shared";
import { useCallback, useEffect, useMemo, useState } from "react";

import { BattleCanvas } from "../render/BattleCanvas";
import { createBuildConfig, createMatchConfig, defaultBlueTraits, defaultRedTraits, presetEnemies, type PresetEnemy } from "./match";

const traitTypes: TraitType[] = ["attribute", "collision", "projectile", "summon", "status", "rule"];
const traitById = new Map<TraitId, TraitDefinition>(traitDefinitions.map((trait) => [trait.id, trait]));
const defaultPresetEnemy = presetEnemies[0] as PresetEnemy;

type BattleMode = "free" | "challenge";

export function App() {
  const [battleMode, setBattleMode] = useState<BattleMode>("challenge");
  const [selectedPresetId, setSelectedPresetId] = useState(defaultPresetEnemy.id);
  const [blueTraits, setBlueTraits] = useState<TraitId[]>(defaultBlueTraits);
  const [redTraits, setRedTraits] = useState<TraitId[]>(defaultRedTraits);
  const [restartToken, setRestartToken] = useState(0);
  const [snapshot, setSnapshot] = useState<WorldSnapshot | null>(null);

  const selectedPreset = useMemo(
    () => presetEnemies.find((preset) => preset.id === selectedPresetId) ?? defaultPresetEnemy,
    [selectedPresetId]
  );
  const redTraitsForBattle = battleMode === "challenge" ? selectedPreset.traits : redTraits;
  const redBuildName = battleMode === "challenge" ? selectedPreset.name : "红方小球";
  const blueBuild = useMemo(() => createBuildConfig("蓝方小球", "default_blue", blueTraits), [blueTraits]);
  const redBuild = useMemo(() => createBuildConfig(redBuildName, "default_red", redTraitsForBattle), [redBuildName, redTraitsForBattle]);
  const blueValidation = useMemo(() => validateBuildConfig(blueBuild), [blueBuild]);
  const redValidation = useMemo(() => validateBuildConfig(redBuild), [redBuild]);
  const blueStats = useMemo(() => (blueValidation.ok ? createStatsForBuild(blueBuild) : null), [blueBuild, blueValidation.ok]);
  const redStats = useMemo(() => (redValidation.ok ? createStatsForBuild(redBuild) : null), [redBuild, redValidation.ok]);
  const canBattle = blueValidation.ok && redValidation.ok;
  const match = useMemo(() => (canBattle ? createMatchConfig(blueBuild, redBuild) : null), [blueBuild, canBattle, redBuild]);

  useEffect(() => {
    setSnapshot(null);
  }, [match]);

  const handleSnapshot = useCallback((nextSnapshot: WorldSnapshot) => {
    setSnapshot(nextSnapshot);
  }, []);

  const handleBlueTraitChange = useCallback((slotIndex: number, traitId: TraitId) => {
    setBlueTraits((current) => replaceTrait(current, slotIndex, traitId));
  }, []);

  const handleRedTraitChange = useCallback((slotIndex: number, traitId: TraitId) => {
    setRedTraits((current) => replaceTrait(current, slotIndex, traitId));
  }, []);

  const handleModeChange = useCallback((nextMode: BattleMode) => {
    setBattleMode(nextMode);
  }, []);

  const handlePresetChange = useCallback((presetId: string) => {
    setSelectedPresetId(presetId);
  }, []);

  const blue = snapshot?.balls.find((ball) => ball.team === "blue" && ball.role === "main");
  const red = snapshot?.balls.find((ball) => ball.team === "red" && ball.role === "main");
  const result = snapshot?.result;

  return (
    <main className="app-shell">
      <section className="dashboard">
        <aside className="builder-panel">
          <p className="eyebrow">Phase 9</p>
          <h1>小球乱斗</h1>
          <p className="summary">自由对战与挑战预设敌人已接入，双方固定装备 {TRAITS_PER_BUILD} 个词条。</p>

          <ModeSwitch mode={battleMode} onModeChange={handleModeChange} />

          {battleMode === "challenge" ? (
            <PresetSelector selectedPreset={selectedPreset} selectedPresetId={selectedPresetId} onPresetChange={handlePresetChange} />
          ) : null}

          <BuildEditor
            label="蓝方"
            team="blue"
            traits={blueTraits}
            stats={blueStats}
            validation={blueValidation}
            onTraitChange={handleBlueTraitChange}
          />

          <BuildEditor
            disabled={battleMode === "challenge"}
            label={battleMode === "challenge" ? selectedPreset.name : "红方"}
            team="red"
            traits={redTraitsForBattle}
            stats={redStats}
            validation={redValidation}
            onTraitChange={handleRedTraitChange}
          />

          <button className="primary-button" disabled={!canBattle} onClick={() => setRestartToken((value) => value + 1)} type="button">
            重新开始
          </button>
        </aside>

        <section className="battle-column">
          <section className="battle-panel">
            {match ? (
              <BattleCanvas match={match} onSnapshot={handleSnapshot} restartToken={restartToken} />
            ) : (
              <div className="battle-placeholder">
                <strong>构筑校验未通过</strong>
                <span>调整词条后恢复战斗</span>
              </div>
            )}
          </section>

          <section className="hud-panel">
            <div className="scoreboard">
              <CombatantPanel
                color="blue"
                label="蓝方"
                max={blue?.maxHp ?? blueStats?.maxHp ?? baseBallStats.maxHp}
                value={blue?.hp ?? blueStats?.maxHp ?? baseBallStats.maxHp}
              />
              <CombatantPanel
                color="red"
                label="红方"
                max={red?.maxHp ?? redStats?.maxHp ?? baseBallStats.maxHp}
                value={red?.hp ?? redStats?.maxHp ?? baseBallStats.maxHp}
              />
              <div className="result-panel">
                <span>战斗时间</span>
                <strong>{(snapshot?.time ?? 0).toFixed(1)}s</strong>
                {result ? <p>{result.winner === "draw" ? "平局" : `${result.winner === "blue" ? "蓝方" : "红方"}获胜`}</p> : <p>战斗中</p>}
              </div>
            </div>

            <dl className="base-grid">
              <div>
                <dt>基础生命</dt>
                <dd>{baseBallStats.maxHp}</dd>
              </div>
              <div>
                <dt>基础速度</dt>
                <dd>{baseBallStats.moveSpeed}</dd>
              </div>
              <div>
                <dt>碰撞伤害</dt>
                <dd>{baseBallStats.collisionDamage}</dd>
              </div>
            </dl>

            <MatchupSummary blueBuild={blueBuild} redBuild={redBuild} />

            {result ? <ResultSummary blueBuild={blueBuild} redBuild={redBuild} result={result} /> : null}
          </section>
        </section>

        <TraitLibrary />
      </section>
    </main>
  );
}

type ModeSwitchProps = {
  mode: BattleMode;
  onModeChange: (mode: BattleMode) => void;
};

function ModeSwitch({ mode, onModeChange }: ModeSwitchProps) {
  return (
    <div aria-label="对战模式" className="mode-switch">
      <button
        aria-pressed={mode === "challenge"}
        className={`mode-button ${mode === "challenge" ? "active" : ""}`}
        onClick={() => onModeChange("challenge")}
        type="button"
      >
        挑战预设
      </button>
      <button
        aria-pressed={mode === "free"}
        className={`mode-button ${mode === "free" ? "active" : ""}`}
        onClick={() => onModeChange("free")}
        type="button"
      >
        自由对战
      </button>
    </div>
  );
}

type PresetSelectorProps = {
  selectedPreset: PresetEnemy;
  selectedPresetId: string;
  onPresetChange: (presetId: string) => void;
};

function PresetSelector({ selectedPreset, selectedPresetId, onPresetChange }: PresetSelectorProps) {
  return (
    <section className="preset-selector">
      <label className="field-label" htmlFor="preset-enemy">
        预设敌人
      </label>
      <select id="preset-enemy" onChange={(event) => onPresetChange(event.currentTarget.value)} value={selectedPresetId}>
        {presetEnemies.map((preset) => (
          <option key={preset.id} value={preset.id}>
            {preset.name}
          </option>
        ))}
      </select>
      <div className="preset-copy">
        <strong>{selectedPreset.name}</strong>
        <span>{selectedPreset.subtitle}</span>
        <p>{selectedPreset.description}</p>
      </div>
      <TraitChipList traits={selectedPreset.traits} />
    </section>
  );
}

type BuildEditorProps = {
  disabled?: boolean;
  label: string;
  team: Team;
  traits: TraitId[];
  stats: BallStats | null;
  validation: BuildValidationResult;
  onTraitChange: (slotIndex: number, traitId: TraitId) => void;
};

function BuildEditor({ disabled = false, label, team, traits, stats, validation, onTraitChange }: BuildEditorProps) {
  return (
    <section className={`build-editor ${team} ${disabled ? "locked" : ""}`}>
      <header className="section-header">
        <h2>{label}构筑</h2>
        <span>{validation.ok ? "可出战" : "需调整"}</span>
      </header>

      <div className="trait-slots">
        {traits.map((traitId, index) => {
          const selectedTrait = traitById.get(traitId);
          return (
            <label className="trait-slot" key={`${team}-${index}`}>
              <span>词条 {index + 1}</span>
              <select disabled={disabled} onChange={(event) => onTraitChange(index, event.currentTarget.value)} value={traitId}>
                {traitTypes.map((type) => (
                  <optgroup key={type} label={traitTypeLabels[type]}>
                    {traitDefinitions
                      .filter((trait) => trait.mainType === type)
                      .map((trait) => (
                        <option key={trait.id} value={trait.id}>
                          {trait.name}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
              <em>{selectedTrait ? traitTypeLabels[selectedTrait.mainType] : "未知词条"}</em>
            </label>
          );
        })}
      </div>

      <StatPreview stats={stats} />

      {!validation.ok ? (
        <ul className="validation-list">
          {validation.issues.map((issue, index) => (
            <li key={`${issue.code}-${issue.traitId ?? index}`}>{issue.message}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

type MatchupSummaryProps = {
  blueBuild: BuildConfig;
  redBuild: BuildConfig;
};

function MatchupSummary({ blueBuild, redBuild }: MatchupSummaryProps) {
  return (
    <section className="matchup-summary">
      <header className="section-header compact">
        <h2>出战构筑</h2>
        <span>{TRAITS_PER_BUILD} 词条</span>
      </header>
      <div className="matchup-grid">
        <BuildTraitSummary build={blueBuild} label="蓝方" team="blue" />
        <BuildTraitSummary build={redBuild} label="红方" team="red" />
      </div>
    </section>
  );
}

type BuildTraitSummaryProps = {
  build: BuildConfig;
  label: string;
  team: Team;
};

function BuildTraitSummary({ build, label, team }: BuildTraitSummaryProps) {
  return (
    <section className={`build-trait-summary ${team}`}>
      <h3>{label}</h3>
      <strong>{build.name}</strong>
      <TraitChipList traits={build.traits} />
    </section>
  );
}

type ResultSummaryProps = {
  blueBuild: BuildConfig;
  redBuild: BuildConfig;
  result: NonNullable<WorldSnapshot["result"]>;
};

function ResultSummary({ blueBuild, redBuild, result }: ResultSummaryProps) {
  const winnerLabel = result.winner === "draw" ? "平局" : result.winner === "blue" ? `${blueBuild.name} 获胜` : `${redBuild.name} 获胜`;
  return (
    <section className="result-summary">
      <header className="section-header compact">
        <h2>结算</h2>
        <span>{winnerLabel}</span>
      </header>
      <dl className="result-grid">
        <div>
          <dt>时长</dt>
          <dd>{result.duration.toFixed(1)}s</dd>
        </div>
        <div>
          <dt>蓝方剩余</dt>
          <dd>{formatNumber(result.blueRemainingHp, 1)}</dd>
        </div>
        <div>
          <dt>红方剩余</dt>
          <dd>{formatNumber(result.redRemainingHp, 1)}</dd>
        </div>
      </dl>
    </section>
  );
}

function TraitChipList({ traits }: { traits: TraitId[] }) {
  return (
    <div className="trait-chip-list">
      {traits.map((traitId, index) => (
        <span className="trait-chip" key={`${traitId}-${index}`}>
          {getTraitName(traitId)}
        </span>
      ))}
    </div>
  );
}

function StatPreview({ stats }: { stats: BallStats | null }) {
  const values = stats
    ? [
        ["生命", formatNumber(stats.maxHp)],
        ["速度", formatNumber(stats.moveSpeed)],
        ["体型", formatNumber(stats.radius, 1)],
        ["撞伤", formatNumber(stats.collisionDamage, 1)],
        ["减伤", `${formatNumber(stats.damageReduction * 100)}%`]
      ]
    : [
        ["生命", "--"],
        ["速度", "--"],
        ["体型", "--"],
        ["撞伤", "--"],
        ["减伤", "--"]
      ];

  return (
    <dl className="stat-preview">
      {values.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

type CombatantPanelProps = {
  label: string;
  value: number;
  max: number;
  color: Team;
};

function CombatantPanel({ label, value, max, color }: CombatantPanelProps) {
  return (
    <div className={`combatant-panel ${color}`}>
      <span>{label}</span>
      <strong>
        {Math.ceil(Math.max(0, value))}
        <small>/{Math.ceil(max)}</small>
      </strong>
    </div>
  );
}

function TraitLibrary() {
  return (
    <aside className="library-panel">
      <header className="section-header">
        <h2>词条库</h2>
        <span>{traitDefinitions.length}</span>
      </header>

      <div className="trait-list">
        {traitTypes.map((type) => (
          <section className="trait-group" key={type}>
            <h3>{traitTypeLabels[type]}</h3>
            {traitDefinitions
              .filter((trait) => trait.mainType === type)
              .map((trait) => (
                <article className="trait-card" key={trait.id}>
                  <div>
                    <strong>{trait.name}</strong>
                    <span>{trait.subtitle}</span>
                  </div>
                  <p>{trait.description}</p>
                </article>
              ))}
          </section>
        ))}
      </div>
    </aside>
  );
}

function replaceTrait(traits: TraitId[], slotIndex: number, traitId: TraitId): TraitId[] {
  return traits.map((current, index) => (index === slotIndex ? traitId : current));
}

function getTraitName(traitId: TraitId): string {
  return traitById.get(traitId)?.name ?? traitId;
}

function formatNumber(value: number, precision = 0): string {
  return value.toFixed(precision).replace(/\.0$/, "");
}
