import {
  createBattle,
  DEFAULT_ARENA,
  FIXED_DT,
  getSnapshot,
  stepBattle,
  type BattleWorldState
} from "@ball-brawl/sim";
import type { BuildConfig, TraitId } from "@ball-brawl/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { createBuildConfig, createMatchConfig } from "../app/match";
import { playMobileSfx } from "./mobile-audio";
import { statusColors, statusLabels } from "./mobile-assets";
import {
  getMobileCategory,
  getMobileTrait,
  mobileGameData,
  type MobileOpponent,
  type MobileTrait,
  type MobileTraitCategoryId
} from "./mobile-data";
import { toMobileBattleSnapshot, type MobileBattleSnapshot, type MobileBattleStatus } from "./mobile-battle-adapter";
import "./mobile.css";

type MobileScreen = "start" | "traits" | "challenger" | "battle";

type MobileAppProps = {
  onOpenDeveloper: () => void;
};

export function MobileApp({ onOpenDeveloper }: MobileAppProps) {
  const [screen, setScreen] = useState<MobileScreen>("start");
  const [selectedTraits, setSelectedTraits] = useState<MobileTrait[]>([]);
  const [opponent, setOpponent] = useState<MobileOpponent | null>(null);

  const blueBuild = useMemo(
    () => createBuildConfig("我方小球", "mobile_blue", selectedTraits.map((trait) => trait.id)),
    [selectedTraits]
  );
  const redBuild = useMemo(
    () => (opponent ? createBuildConfig(opponent.name, "mobile_red", opponent.traits) : null),
    [opponent]
  );

  const handleStart = useCallback(() => {
    playMobileSfx("ui.confirm");
    setScreen("traits");
  }, []);

  const handleConfirmTraits = useCallback(() => {
    playMobileSfx("ui.confirm");
    setScreen("challenger");
  }, []);

  const handleChallenge = useCallback((nextOpponent: MobileOpponent) => {
    playMobileSfx("battle.start");
    setOpponent(nextOpponent);
    setScreen("battle");
  }, []);

  const handleBackToTraits = useCallback(() => {
    playMobileSfx("ui.click");
    setScreen("traits");
  }, []);

  const handleBackToChallenger = useCallback(() => {
    playMobileSfx("ui.click");
    setScreen("challenger");
  }, []);

  return (
    <main className="mobile-shell">
      <div className="mobile-phone" data-screen={screen}>
        <div className="mobile-scan" />
        <div className="mobile-vignette" />
        {screen === "start" ? <StartScreen onOpenDeveloper={onOpenDeveloper} onStart={handleStart} /> : null}
        {screen === "traits" ? (
          <TraitSelectScreen selectedTraits={selectedTraits} onConfirm={handleConfirmTraits} onTraitsChange={setSelectedTraits} />
        ) : null}
        {screen === "challenger" ? (
          <ChallengerScreen
            opponent={opponent}
            selectedTraits={selectedTraits}
            onBack={handleBackToTraits}
            onChallenge={handleChallenge}
            onOpponentChange={setOpponent}
          />
        ) : null}
        {screen === "battle" && opponent && redBuild ? (
          <MobileBattleFlow blueBuild={blueBuild} opponent={opponent} redBuild={redBuild} onBack={handleBackToChallenger} />
        ) : null}
      </div>
    </main>
  );
}

type StartScreenProps = {
  onOpenDeveloper: () => void;
  onStart: () => void;
};

function StartScreen({ onOpenDeveloper, onStart }: StartScreenProps) {
  return (
    <section className="mobile-screen mobile-start">
      <div className="meme-cloud" aria-hidden="true">
        <PixelFace className="face-a" tone="#ffd23f" />
        <PixelFace className="face-b" tone="#22d3ff" />
        <PixelFace className="face-c" tone="#ff5db1" />
      </div>
      <header className="mobile-title-block">
        <p>MEME HERO</p>
        <h1>小球乱斗</h1>
        <span>词条构筑 · 自动对战</span>
      </header>
      <div className="start-actions">
        <button className="pixel-button primary" onClick={onStart} type="button">
          开始游戏
        </button>
        <button className="pixel-button ghost" onClick={onOpenDeveloper} type="button">
          开发者入口
        </button>
      </div>
    </section>
  );
}

type TraitSelectScreenProps = {
  selectedTraits: MobileTrait[];
  onConfirm: () => void;
  onTraitsChange: (traits: MobileTrait[]) => void;
};

function TraitSelectScreen({ selectedTraits, onConfirm, onTraitsChange }: TraitSelectScreenProps) {
  const [categoryId, setCategoryId] = useState<MobileTraitCategoryId>(mobileGameData.cats[0]?.id ?? "survive");
  const selectedIds = selectedTraits.map((trait) => trait.id);
  const traits = mobileGameData.traits.filter((trait) => trait.cat === categoryId);
  const full = selectedTraits.length >= mobileGameData.pickCount;

  const countOf = useCallback(
    (traitId: TraitId) => selectedTraits.filter((trait) => trait.id === traitId).length,
    [selectedTraits]
  );

  const canAdd = useCallback(
    (trait: MobileTrait) => selectedTraits.length < mobileGameData.pickCount && (trait.repeat || !selectedIds.includes(trait.id)) && countOf(trait.id) < trait.maxStacks,
    [countOf, selectedIds, selectedTraits.length]
  );

  const addTrait = useCallback(
    (trait: MobileTrait) => {
      if (!canAdd(trait)) {
        return;
      }
      playMobileSfx("ui.click");
      onTraitsChange([...selectedTraits, trait]);
    },
    [canAdd, onTraitsChange, selectedTraits]
  );

  const removeTrait = useCallback(
    (slotIndex: number) => {
      playMobileSfx("ui.click");
      onTraitsChange(selectedTraits.filter((_, index) => index !== slotIndex));
    },
    [onTraitsChange, selectedTraits]
  );

  return (
    <section className="mobile-screen trait-screen">
      <header className="mobile-panel top-panel">
        <div>
          <p className="pixel-en">SELECT TRAITS</p>
          <h2>选择词条</h2>
        </div>
        <ProgressDots count={selectedTraits.length} total={mobileGameData.pickCount} />
      </header>

      <nav className="trait-tabs" aria-label="词条分类">
        {mobileGameData.cats.map((category) => {
          const selectedInCategory = selectedTraits.filter((trait) => trait.cat === category.id).length;
          return (
            <button
              aria-pressed={categoryId === category.id}
              className={`trait-tab ${categoryId === category.id ? "active" : ""}`}
              key={category.id}
              onClick={() => setCategoryId(category.id)}
              style={{ "--cat": category.color } as React.CSSProperties}
              type="button"
            >
              {selectedInCategory > 0 ? <span>{selectedInCategory}</span> : null}
              <PixelSprite color={category.color} rows={category.icon} size={2} />
              <em>{category.name}</em>
            </button>
          );
        })}
      </nav>

      <div className="trait-list">
        {traits.map((trait) => {
          const category = getMobileCategory(trait.cat);
          const disabled = !canAdd(trait);
          const selectedCount = countOf(trait.id);
          return (
            <button
              className={`trait-card ${disabled ? "disabled" : ""}`}
              disabled={disabled}
              key={trait.id}
              onClick={() => addTrait(trait)}
              style={{ "--cat": category.color } as React.CSSProperties}
              type="button"
            >
              <span className="trait-card-bar" />
              {selectedCount > 0 ? <strong className="trait-count">{trait.repeat ? `x${selectedCount}` : "✓"}</strong> : null}
              <span className="trait-card-head">
                <PixelSprite color={category.color} rows={category.icon} size={2} />
                <b>{trait.name}</b>
              </span>
              <small>{trait.sub}</small>
              <span className="trait-card-tags">
                <i>{trait.cost === "tradeoff" ? "有代价" : "纯正面"}</i>
                <i>{trait.repeat ? "可重复" : "唯一"}</i>
              </span>
            </button>
          );
        })}
      </div>

      <footer className="build-dock">
        <div className="build-dock-head">
          <span>我的构筑</span>
          <b>
            {selectedTraits.length}/{mobileGameData.pickCount}
          </b>
        </div>
        <div className="build-slots">
          {Array.from({ length: mobileGameData.pickCount }).map((_, index) => {
            const trait = selectedTraits[index];
            const category = trait ? getMobileCategory(trait.cat) : null;
            return trait && category ? (
              <button
                className="build-slot filled"
                key={index}
                onClick={() => removeTrait(index)}
                style={{ "--cat": category.color } as React.CSSProperties}
                type="button"
              >
                <span />
                {trait.name}
              </button>
            ) : (
              <div className="build-slot" key={index}>
                {index + 1}
              </div>
            );
          })}
        </div>
        <button className={`pixel-button primary ${full ? "pulse" : ""}`} disabled={!full} onClick={onConfirm} type="button">
          {full ? "进入挑战者选择" : `还需选择 ${mobileGameData.pickCount - selectedTraits.length} 个词条`}
        </button>
      </footer>
    </section>
  );
}

type ChallengerScreenProps = {
  opponent: MobileOpponent | null;
  selectedTraits: MobileTrait[];
  onBack: () => void;
  onChallenge: (opponent: MobileOpponent) => void;
  onOpponentChange: (opponent: MobileOpponent | null) => void;
};

function ChallengerScreen({ opponent, selectedTraits, onBack, onChallenge, onOpponentChange }: ChallengerScreenProps) {
  return (
    <section className="mobile-screen challenger-screen">
      <header className="mobile-panel top-panel challenger-top">
        <button className="pixel-icon-button" onClick={onBack} type="button">
          ‹
        </button>
        <div>
          <p className="pixel-en">SELECT CHALLENGER</p>
          <h2>选择挑战者</h2>
        </div>
      </header>

      <section className="my-build-strip">
        <span>我方构筑</span>
        <div>
          {selectedTraits.map((trait) => {
            const category = getMobileCategory(trait.cat);
            return (
              <i key={`${trait.id}-${trait.name}`} style={{ "--cat": category.color } as React.CSSProperties}>
                {trait.name}
              </i>
            );
          })}
        </div>
      </section>

      <div className="opponent-list">
        {mobileGameData.enemies.map((enemy) => {
          const active = opponent?.id === enemy.id;
          return (
            <button
              className={`opponent-card ${active ? "active" : ""}`}
              key={enemy.id}
              onClick={() => {
                playMobileSfx("ui.click");
                onOpponentChange(active ? null : enemy);
              }}
              style={{ "--foe": enemy.color } as React.CSSProperties}
              type="button"
            >
              <div className="opponent-avatar">
                <BallSprite color={enemy.color} size={5} />
                <span>
                  {Array.from({ length: 3 }).map((_, index) => (
                    <i className={index < enemy.diff ? "on" : ""} key={index} />
                  ))}
                </span>
              </div>
              <div className="opponent-copy">
                <strong>
                  {enemy.name}
                  <em>{enemy.style}</em>
                </strong>
                <p>{enemy.desc}</p>
                <div>
                  {enemy.traits.map((traitId) => {
                    const trait = getMobileTrait(traitId);
                    if (!trait) {
                      return null;
                    }
                    const category = getMobileCategory(trait.cat);
                    return (
                      <span key={traitId} style={{ "--cat": category.color } as React.CSSProperties}>
                        {trait.name}
                      </span>
                    );
                  })}
                </div>
              </div>
              {active ? <b>✓</b> : null}
            </button>
          );
        })}
      </div>

      <footer className="challenge-dock">
        <div>
          <span>我方</span>
          <strong>VS</strong>
          <span>{opponent?.name ?? "未选择"}</span>
        </div>
        <button className={`pixel-button danger ${opponent ? "pulse" : ""}`} disabled={!opponent} onClick={() => opponent && onChallenge(opponent)} type="button">
          {opponent ? `开始挑战 ${opponent.name}` : "选择一个挑战者"}
        </button>
      </footer>
    </section>
  );
}

type MobileBattleFlowProps = {
  blueBuild: BuildConfig;
  opponent: MobileOpponent;
  redBuild: BuildConfig;
  onBack: () => void;
};

function MobileBattleFlow({ blueBuild, opponent, redBuild, onBack }: MobileBattleFlowProps) {
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [restartToken, setRestartToken] = useState(0);
  const snapshot = useMobileBattleSnapshot(blueBuild, redBuild, opponent, paused, speed, restartToken);

  const handleSpeedChange = useCallback((nextSpeed: number) => {
    playMobileSfx("ui.click");
    setSpeed(nextSpeed);
  }, []);

  return (
    <BattleScreen
      onBack={onBack}
      onRestart={() => {
        playMobileSfx("battle.start");
        setRestartToken((value) => value + 1);
      }}
      onSpeedChange={handleSpeedChange}
      onTogglePause={() => {
        playMobileSfx("ui.click");
        setPaused((value) => !value);
      }}
      paused={paused}
      snapshot={snapshot}
      speed={speed}
    />
  );
}

function useMobileBattleSnapshot(
  blueBuild: BuildConfig,
  redBuild: BuildConfig,
  opponent: MobileOpponent,
  paused: boolean,
  speed: number,
  restartToken: number
): MobileBattleSnapshot | null {
  const [snapshot, setSnapshot] = useState<MobileBattleSnapshot | null>(null);
  const pausedRef = useRef(paused);
  const speedRef = useRef(speed);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  useEffect(() => {
    let disposed = false;
    let animationFrame = 0;
    let lastTime = performance.now();
    let accumulator = 0;
    let world: BattleWorldState = createBattle(createMatchConfig(blueBuild, redBuild, 20260607 + restartToken), DEFAULT_ARENA);

    const publish = () => {
      const nextSnapshot = toMobileBattleSnapshot(getSnapshot(world), blueBuild, redBuild, opponent);
      setSnapshot(nextSnapshot);
    };

    publish();

    const loop = (now: number) => {
      if (disposed) {
        return;
      }
      if (pausedRef.current || world.result) {
        lastTime = now;
        accumulator = 0;
        animationFrame = window.requestAnimationFrame(loop);
        return;
      }

      const frameDt = Math.min(0.05, (now - lastTime) / 1000) * speedRef.current;
      lastTime = now;
      accumulator += frameDt;

      while (accumulator >= FIXED_DT && !world.result) {
        stepBattle(world, FIXED_DT);
        accumulator -= FIXED_DT;
      }

      publish();
      animationFrame = window.requestAnimationFrame(loop);
    };

    animationFrame = window.requestAnimationFrame(loop);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(animationFrame);
    };
  }, [blueBuild, opponent, redBuild, restartToken]);

  return snapshot;
}

type BattleScreenProps = {
  snapshot: MobileBattleSnapshot | null;
  paused: boolean;
  speed: number;
  onBack: () => void;
  onRestart: () => void;
  onSpeedChange: (speed: number) => void;
  onTogglePause: () => void;
};

function BattleScreen({ snapshot, paused, speed, onBack, onRestart, onSpeedChange, onTogglePause }: BattleScreenProps) {
  if (!snapshot) {
    return <section className="mobile-screen battle-screen" />;
  }
  const me = snapshot.combatants.find((combatant) => combatant.side === "me") ?? snapshot.combatants[0];
  const foe = snapshot.combatants.find((combatant) => combatant.side === "foe") ?? snapshot.combatants[1];
  if (!me || !foe) {
    return <section className="mobile-screen battle-screen" />;
  }

  return (
    <section className="mobile-screen battle-screen">
      <header className="battle-hud">
        <div className="battle-hud-top">
          <button className="pixel-icon-button" onClick={onBack} type="button">
            ‹
          </button>
          <div className="battle-timer">
            {formatTime(snapshot.elapsed)}
            <span>/ {formatTime(snapshot.maxTime)} · {snapshot.status === "fighting" ? "LIVE" : resultLabel(snapshot.status)}</span>
          </div>
          <button className="pixel-icon-button" onClick={onTogglePause} type="button">
            {paused ? "▶" : "Ⅱ"}
          </button>
        </div>

        <div className="fighters">
          <FighterHud combatant={me} side="me" />
          <FighterHud combatant={foe} side="foe" />
        </div>
      </header>

      <div className="battle-arena">
        <div className="arena-grid" />
        <strong className="arena-vs">VS</strong>
        {snapshot.summons.map((summon) => (
          <div className={`arena-entity summon ${summon.kind}`} key={summon.id} style={arenaStyle(snapshot, summon.x, summon.y)}>
            <BallSprite color={summon.color} size={Math.max(2, summon.r / 8)} />
          </div>
        ))}
        {snapshot.combatants.map((combatant) => (
          <div className="arena-entity combatant" key={combatant.id} style={arenaStyle(snapshot, combatant.x, combatant.y)}>
            <span>{combatant.name}</span>
            <BallSprite color={combatant.color} size={Math.max(4, combatant.r / 8)} />
            {combatant.statuses.map((status) => (
              <i
                className={`status-aura ${status.type}`}
                key={status.type}
                style={{ "--status": statusColors[status.type] } as React.CSSProperties}
              />
            ))}
          </div>
        ))}
        {snapshot.projectiles.map((projectile) => (
          <i
            className="arena-projectile"
            key={projectile.id}
            style={{ ...arenaStyle(snapshot, projectile.x, projectile.y), "--proj": projectile.color } as React.CSSProperties}
          />
        ))}
        {snapshot.floaters.map((floater) => (
          <b className={`arena-floater ${floater.kind}`} key={floater.id} style={arenaStyle(snapshot, floater.x, floater.y)}>
            {floater.text}
          </b>
        ))}
        {snapshot.status !== "fighting" ? <ResultOverlay status={snapshot.status} /> : null}
      </div>

      <footer className="battle-log-panel">
        <div className="battle-actions-row">
          {[1, 2, 4].map((value) => (
            <button className={speed === value ? "active" : ""} key={value} onClick={() => onSpeedChange(value)} type="button">
              {value}x
            </button>
          ))}
          <button onClick={onRestart} type="button">
            重开
          </button>
        </div>
        <div className="battle-log-head">
          <span>战斗日志</span>
          <em>服务端裁定预留</em>
        </div>
        <div className="battle-log">
          {snapshot.log.length > 0 ? (
            snapshot.log.map((line, index) => (
              <p className={line.kind} key={`${line.t}-${index}`}>
                <span>{line.t}</span>
                {line.text}
              </p>
            ))
          ) : (
            <p className="sys">
              <span>00:00</span>
              战斗开始
            </p>
          )}
        </div>
      </footer>
    </section>
  );
}

function FighterHud({ combatant, side }: { combatant: MobileBattleSnapshot["combatants"][number]; side: "me" | "foe" }) {
  const hpRatio = Math.max(0, Math.min(100, (combatant.hp / combatant.maxHp) * 100));
  return (
    <div className={`fighter ${side}`} style={{ "--fighter": combatant.color } as React.CSSProperties}>
      <div>
        <BallSprite color={combatant.color} size={2} />
        <span>{combatant.name}</span>
      </div>
      <div className="hp-bar">
        <i style={{ width: `${hpRatio}%` }} />
        {combatant.shield > 0 ? <b style={{ width: `${Math.min(100, combatant.shield)}%` }} /> : null}
        <em>
          {Math.ceil(combatant.hp)}/{Math.ceil(combatant.maxHp)}
        </em>
      </div>
      <div className="fighter-build">
        {combatant.build.map((traitId, index) => {
          const trait = getMobileTrait(traitId);
          const category = trait ? getMobileCategory(trait.cat) : null;
          return <span key={`${traitId}-${index}`} style={{ "--cat": category?.color ?? "#8892a6" } as React.CSSProperties} title={trait?.name} />;
        })}
      </div>
      {combatant.statuses.length > 0 ? (
        <div className="fighter-status">
          {combatant.statuses.map((status) => (
            <span key={status.type} style={{ "--status": statusColors[status.type] } as React.CSSProperties}>
              {statusLabels[status.type]}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ResultOverlay({ status }: { status: Exclude<MobileBattleStatus, "fighting"> }) {
  return (
    <div className="result-overlay">
      <strong>{resultLabel(status)}</strong>
    </div>
  );
}

function resultLabel(status: MobileBattleSnapshot["status"]): string {
  if (status === "win") {
    return "挑战成功";
  }
  if (status === "lose") {
    return "挑战失败";
  }
  if (status === "draw") {
    return "平局";
  }
  return "战斗中";
}

function arenaStyle(snapshot: MobileBattleSnapshot, x: number, y: number): React.CSSProperties {
  return {
    left: `${(x / snapshot.arena.w) * 100}%`,
    top: `${(y / snapshot.arena.h) * 100}%`
  };
}

function PixelSprite({ rows, color, size = 3 }: { rows: string[]; color: string; size?: number }) {
  const shadows = rows.flatMap((row, y) =>
    [...row].flatMap((cell, x) => (cell === "1" ? [`${x * size}px ${y * size}px 0 ${color}`] : []))
  );
  const width = (rows[0]?.length ?? 0) * size;
  return (
    <span className="pixel-sprite" style={{ width, height: rows.length * size }}>
      <i style={{ width: size, height: size, boxShadow: shadows.join(",") }} />
    </span>
  );
}

function BallSprite({ color, size = 4 }: { color: string; size?: number }) {
  return <PixelSprite color={color} rows={["001110", "011111", "111111", "111111", "011111", "001110"]} size={size} />;
}

function PixelFace({ className, tone }: { className: string; tone: string }) {
  return (
    <span className={`pixel-face ${className}`} style={{ "--tone": tone } as React.CSSProperties}>
      <BallSprite color={tone} size={7} />
      <i />
    </span>
  );
}

function ProgressDots({ count, total }: { count: number; total: number }) {
  return (
    <div className="progress-dots">
      {Array.from({ length: total }).map((_, index) => (
        <span className={index < count ? "on" : ""} key={index} />
      ))}
    </div>
  );
}

function formatTime(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(safeSeconds / 60)).padStart(2, "0")}:${String(safeSeconds % 60).padStart(2, "0")}`;
}
