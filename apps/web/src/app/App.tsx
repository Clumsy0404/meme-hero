import { baseBallStats, traitDefinitions, traitTypeLabels, validateBuildConfig } from "@ball-brawl/content";
import { createStatsForBuild, type WorldSnapshot } from "@ball-brawl/sim";
import {
  TRAITS_PER_BUILD,
  type BallStats,
  type BuildValidationResult,
  type Team,
  type TraitDefinition,
  type TraitId,
  type TraitType
} from "@ball-brawl/shared";
import { useCallback, useEffect, useMemo, useState } from "react";

import { BattleCanvas } from "../render/BattleCanvas";
import { createBuildConfig, createMatchConfig, defaultBlueTraits, defaultRedTraits } from "./match";

const traitTypes: TraitType[] = ["attribute", "collision", "projectile", "summon", "status", "rule"];
const traitById = new Map<TraitId, TraitDefinition>(traitDefinitions.map((trait) => [trait.id, trait]));

export function App() {
  const [blueTraits, setBlueTraits] = useState<TraitId[]>(defaultBlueTraits);
  const [redTraits, setRedTraits] = useState<TraitId[]>(defaultRedTraits);
  const [restartToken, setRestartToken] = useState(0);
  const [snapshot, setSnapshot] = useState<WorldSnapshot | null>(null);

  const blueBuild = useMemo(() => createBuildConfig("蓝方小球", "default_blue", blueTraits), [blueTraits]);
  const redBuild = useMemo(() => createBuildConfig("红方小球", "default_red", redTraits), [redTraits]);
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

  const blue = snapshot?.balls.find((ball) => ball.team === "blue" && ball.role === "main");
  const red = snapshot?.balls.find((ball) => ball.team === "red" && ball.role === "main");
  const result = snapshot?.result;

  return (
    <main className="app-shell">
      <section className="dashboard">
        <aside className="builder-panel">
          <p className="eyebrow">Phase 5</p>
          <h1>小球乱斗</h1>
          <p className="summary">双方固定装备 {TRAITS_PER_BUILD} 个词条，属性、碰撞与弹道机制已接入战斗结算。</p>

          <BuildEditor
            label="蓝方"
            team="blue"
            traits={blueTraits}
            stats={blueStats}
            validation={blueValidation}
            onTraitChange={handleBlueTraitChange}
          />

          <BuildEditor
            label="红方"
            team="red"
            traits={redTraits}
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
          </section>
        </section>

        <TraitLibrary />
      </section>
    </main>
  );
}

type BuildEditorProps = {
  label: string;
  team: Team;
  traits: TraitId[];
  stats: BallStats | null;
  validation: BuildValidationResult;
  onTraitChange: (slotIndex: number, traitId: TraitId) => void;
};

function BuildEditor({ label, team, traits, stats, validation, onTraitChange }: BuildEditorProps) {
  return (
    <section className={`build-editor ${team}`}>
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
              <select onChange={(event) => onTraitChange(index, event.currentTarget.value)} value={traitId}>
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

function formatNumber(value: number, precision = 0): string {
  return value.toFixed(precision).replace(/\.0$/, "");
}
