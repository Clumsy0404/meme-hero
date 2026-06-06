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
  const fieldRef = useRef<HTMLDivElement | null>(null);
  const nodeRefs = useRef<Array<HTMLDivElement | null>>([]);
  const bubbles = useRef<Array<{ x: number; y: number; vx: number; vy: number; rot: number; rv: number; s: number }>>([]);

  useEffect(() => {
    const field = fieldRef.current;
    if (!field) {
      return;
    }

    const size = (index: number) => 9 * (MEME_PX[index % MEME_PX.length] ?? 6);
    let width = field.clientWidth;
    let height = field.clientHeight;

    bubbles.current = startMemes.map((_, index) => {
      const side = size(index);
      const angle = Math.random() * Math.PI * 2;
      const speed = 14 + Math.random() * 16;
      return {
        x: Math.random() * Math.max(1, width - side),
        y: Math.random() * Math.max(1, height - side),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        rot: Math.random() * 16 - 8,
        rv: (Math.random() * 2 - 1) * 0.4,
        s: side
      };
    });

    const applyPositions = () => {
      bubbles.current.forEach((bubble, index) => {
        const node = nodeRefs.current[index];
        if (node) {
          node.style.transform = `translate(${bubble.x}px, ${bubble.y}px) rotate(${bubble.rot}deg)`;
        }
      });
    };

    applyPositions();

    let animationFrame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      width = field.clientWidth;
      height = field.clientHeight;

      bubbles.current.forEach((bubble) => {
        bubble.x += bubble.vx * dt;
        bubble.y += bubble.vy * dt;

        if (bubble.x <= 0) {
          bubble.x = 0;
          bubble.vx = Math.abs(bubble.vx);
        }
        if (bubble.x >= width - bubble.s) {
          bubble.x = width - bubble.s;
          bubble.vx = -Math.abs(bubble.vx);
        }
        if (bubble.y <= 0) {
          bubble.y = 0;
          bubble.vy = Math.abs(bubble.vy);
        }
        if (bubble.y >= height - bubble.s) {
          bubble.y = height - bubble.s;
          bubble.vy = -Math.abs(bubble.vy);
        }

        bubble.rot += bubble.rv;
        if (bubble.rot > 10 || bubble.rot < -10) {
          bubble.rv *= -1;
        }
      });

      applyPositions();
      animationFrame = window.requestAnimationFrame(tick);
    };

    animationFrame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(animationFrame);
  }, []);

  return (
    <section className="mobile-screen vst">
      <div className="vst-memes" ref={fieldRef}>
        {startMemes.map((meme, index) => {
          const px = MEME_PX[index % MEME_PX.length] ?? 6;
          return (
            <div
              className="vst-meme"
              key={meme.id}
              ref={(element) => {
                nodeRefs.current[index] = element;
              }}
            >
              <PixelArt palette={meme.palette} rows={meme.rows} px={px} />
            </div>
          );
        })}
      </div>
      <div className="vst-main">
        <div className="vst-kicker">小球肉鸽自动对战</div>
        <h1 className="vst-title">
          <span className="l1">MEME</span>
          <span className="l2">HERO</span>
        </h1>
        <p className="vst-sub">
          组合词条 · 打造你的小球英雄
          <br />
          挑战梗王，登顶榜单
        </p>
      </div>
      <div className="vst-spacer" />
      <div className="vst-foot">
        <button className="vst-start" onClick={onStart} type="button">
          ▶ 开始游戏
        </button>
        <div className="vst-press">PRESS START</div>
        <button className="vst-dev" onClick={onOpenDeveloper} type="button">
          开发者入口
        </button>
      </div>
      <div className="vst-ver">v0.1</div>
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
    <section className="mobile-screen va">
      <div className="va-top">
        <div className="va-titlerow">
          <div>
            <div className="va-title">SELECT TRAITS</div>
            <div className="va-zh">选择词条</div>
          </div>
          <div className="va-progress">
            <ProgressDots count={selectedTraits.length} total={mobileGameData.pickCount} />
            <div className="va-count">
              {selectedTraits.length} / {mobileGameData.pickCount}
            </div>
          </div>
        </div>

        <nav className="va-tabs" aria-label="词条分类">
          {mobileGameData.cats.map((category) => {
            const selectedInCategory = selectedTraits.filter((trait) => trait.cat === category.id).length;
            const active = categoryId === category.id;
            return (
              <button
                aria-pressed={active}
                className={`va-tab ${active ? "on" : ""}`}
                key={category.id}
                onClick={() => setCategoryId(category.id)}
                style={{ "--tc": category.color } as React.CSSProperties}
                type="button"
              >
                {selectedInCategory > 0 ? <span className="tabpip">{selectedInCategory}</span> : null}
                <PixelSprite color={active ? "#0b0f1f" : category.color} rows={category.icon} px={2} />
                {category.name}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="va-pool">
        {traits.map((trait) => {
          const category = getMobileCategory(trait.cat);
          const disabled = !canAdd(trait);
          const selectedCount = countOf(trait.id);
          const cost = trait.cost === "tradeoff" ? { cls: "cost-trade", text: "有代价" } : { cls: "cost-pure", text: "纯正面" };
          return (
            <button
              className={`va-card ${disabled ? "dis" : ""}`}
              disabled={disabled}
              key={trait.id}
              onClick={() => addTrait(trait)}
              style={{ "--c": category.color } as React.CSSProperties}
              type="button"
            >
              <span className="va-catbar" />
              {selectedCount > 0 ? <span className="va-badge">{trait.repeat ? `×${selectedCount}` : "✓"}</span> : null}
              <div className="va-card-top">
                <PixelSprite color={category.color} rows={category.icon} px={2} />
                <span className="va-card-name">{trait.name}</span>
              </div>
              <div className="va-card-sub">{trait.sub}</div>
              <div className="va-card-foot">
                <span className={`va-chip ${cost.cls}`} style={{ "--c": category.color } as React.CSSProperties}>
                  {cost.text}
                </span>
                <span className="va-chip">{trait.repeat ? "REPEAT" : "UNIQUE"}</span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="va-build">
        <div className="va-build-head">
          <div className="va-build-label">我的构筑</div>
          <div className="va-count">MY BUILD</div>
        </div>
        <div className="va-slots">
          {Array.from({ length: mobileGameData.pickCount }).map((_, index) => {
            const trait = selectedTraits[index];
            const category = trait ? getMobileCategory(trait.cat) : null;
            return trait && category ? (
              <div className="va-slot" key={index} style={{ "--c": category.color } as React.CSSProperties}>
                <TraitMini trait={trait} onRemove={() => removeTrait(index)} />
              </div>
            ) : (
              <div className="va-slot empty" data-i={index + 1} key={index} />
            );
          })}
        </div>
        <button className={`va-cta ${full ? "go" : ""}`} disabled={!full} onClick={onConfirm} type="button">
          {full ? "进入挑战者选择 ▶" : `还需选择 ${mobileGameData.pickCount - selectedTraits.length} 个词条`}
        </button>
      </div>
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
    <section className="mobile-screen vch">
      <div className="vch-top">
        <div className="vch-trow">
          <button className="vch-back" onClick={onBack} type="button">
            ‹ 返回
          </button>
          <div>
            <div className="vch-title">SELECT CHALLENGER</div>
            <div className="vch-zh">选择挑战者</div>
          </div>
        </div>
        <div className="vch-mybuild">
          <span className="vch-mylabel">我方构筑</span>
          {selectedTraits.length === 0 ? (
            <span className="vch-myempty">未配置词条</span>
          ) : (
            selectedTraits.map((trait, index) => {
              const category = getMobileCategory(trait.cat);
              return (
                <span className="vch-mychip" key={`${trait.id}-${index}`} style={{ "--c": category.color } as React.CSSProperties}>
                  <span className="bar" />
                  {trait.name}
                </span>
              );
            })
          )}
        </div>
        <div className="vch-modetabs">
          <button className="vch-modetab on" type="button">
            预设敌人<span className="men">PVE</span>
          </button>
          <button className="vch-modetab locked" disabled type="button">
            过往玩家<span className="men">PVP</span>
          </button>
        </div>
      </div>

      <div className="vch-listwrap">
        <div className="vch-list">
          {mobileGameData.enemies.map((enemy) => {
            const active = opponent?.id === enemy.id;
            return (
              <button
                className={`vch-en ${active ? "on" : ""}`}
                key={enemy.id}
                onClick={() => {
                  playMobileSfx("ui.click");
                  onOpponentChange(active ? null : enemy);
                }}
                style={{ "--ec": enemy.color } as React.CSSProperties}
                type="button"
              >
                <div className="vch-ava">
                  <BallSprite color={enemy.color} px={5} />
                  <div className="vch-diff">
                    {Array.from({ length: 3 }).map((_, index) => (
                      <i className={index < enemy.diff ? "on" : ""} key={index} style={{ "--ec": enemy.color } as React.CSSProperties} />
                    ))}
                  </div>
                </div>
                <div className="vch-body">
                  <div className="vch-head">
                    <span className="vch-name">{enemy.name}</span>
                    <span className="vch-style">{enemy.style}</span>
                    {active ? <span className="vch-check">✓</span> : null}
                  </div>
                  <div className="vch-desc">{enemy.desc}</div>
                  <div className="vch-tchips">
                    {enemy.traits.map((traitId) => {
                      const trait = getMobileTrait(traitId);
                      if (!trait) {
                        return null;
                      }
                      const category = getMobileCategory(trait.cat);
                      return (
                        <span className="vch-tchip" key={traitId} style={{ "--tc": category.color } as React.CSSProperties}>
                          <span className="d" />
                          {trait.name}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        <div className="vch-more show">
          <span>▼ 下滑查看更多</span>
        </div>
      </div>

      <div className="vch-foot">
        <div className="vch-vs">
          <span className="me">
            我方 · {selectedTraits.length}/{mobileGameData.pickCount} 词条
          </span>
          <span className="vs">VS</span>
          <span className="op">{opponent?.name ?? "— 未选对手 —"}</span>
        </div>
        <button className={`vch-cta ${opponent ? "go" : ""}`} disabled={!opponent} onClick={() => opponent && onChallenge(opponent)} type="button">
          {opponent ? `开始战斗 ▶ 挑战 ${opponent.name}` : "选择一个挑战者"}
        </button>
      </div>
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
    return <section className="mobile-screen vbt" />;
  }
  const me = snapshot.combatants.find((combatant) => combatant.side === "me") ?? snapshot.combatants[0];
  const foe = snapshot.combatants.find((combatant) => combatant.side === "foe") ?? snapshot.combatants[1];
  if (!me || !foe) {
    return <section className="mobile-screen vbt" />;
  }

  return (
    <section className="mobile-screen vbt">
      <div className="vbt-hud">
        <div className="vbt-hrow">
          <button className="vbt-back" onClick={onBack} type="button">
            ‹ 撤退
          </button>
          <div className="vbt-timer">
            {formatTime(snapshot.elapsed)} <small>/ {formatTime(snapshot.maxTime)} · {snapshot.status === "fighting" ? snapshot.mode.toUpperCase() : resultLabel(snapshot.status)}</small>
          </div>
          <div className="vbt-speed">
            <button className={`vbt-sp ${paused ? "on" : ""}`} onClick={onTogglePause} type="button">
              {paused ? "▶" : "Ⅱ"}
            </button>
            {[1, 2, 4].map((value) => (
              <button className={`vbt-sp ${speed === value ? "on" : ""}`} key={value} onClick={() => onSpeedChange(value)} type="button">
                {value}×
              </button>
            ))}
          </div>
        </div>

        <div className="vbt-fighters">
          <FighterHud combatant={me} side="me" />
          <FighterHud combatant={foe} side="foe" />
        </div>
      </div>

      <div className="vbt-arena">
        <div className="vbt-grid" />
        <div className="vbt-vs">VS</div>
        {snapshot.summons.map((summon) => (
          <div className="vbt-ent" key={summon.id} style={arenaStyle(snapshot, summon.x, summon.y)}>
            <div className="vbt-summon">
              <BallSprite color={summon.color} px={Math.max(2, summon.r / 8)} />
            </div>
          </div>
        ))}
        {snapshot.combatants.map((combatant) => (
          <div className="vbt-ent" key={combatant.id} style={arenaStyle(snapshot, combatant.x, combatant.y)}>
            <div className="vbt-entbox" style={{ "--ec": combatant.color } as React.CSSProperties}>
              <span className="vbt-nameTag">{combatant.name}</span>
              <BallSprite color={combatant.color} px={Math.max(4, combatant.r / 8)} />
              {combatant.statuses.map((status) => (
                <i className="vbt-ball-ring" key={status.type} style={{ "--status": statusColors[status.type] } as React.CSSProperties} />
              ))}
            </div>
          </div>
        ))}
        {snapshot.projectiles.map((projectile) => (
          <div
            className="vbt-proj"
            key={projectile.id}
            style={{ ...arenaStyle(snapshot, projectile.x, projectile.y), background: projectile.color, color: projectile.color } as React.CSSProperties}
          />
        ))}
        {snapshot.floaters.map((floater) => (
          <div className={`vbt-float ${floater.kind}`} key={floater.id} style={arenaStyle(snapshot, floater.x, floater.y)}>
            {floater.text}
          </div>
        ))}
        {snapshot.status !== "fighting" ? <ResultOverlay status={snapshot.status} /> : null}
      </div>

      <div className="vbt-log">
        <div className="vbt-loghead">
          <span>战斗日志</span>
          <span className="live">
            <i />
            LIVE · 服务端裁定
          </span>
        </div>
        <div className="vbt-logbox">
          {snapshot.log.length > 0 ? (
            snapshot.log.map((line, index) => (
              <div className={`vbt-logline ${line.kind}`} key={`${line.t}-${index}`}>
                <span className="lt">{line.t}</span>
                <span className="lx">{line.text}</span>
              </div>
            ))
          ) : (
            <div className="vbt-logline sys">
              <span className="lt">00:00</span>
              <span className="lx">战斗开始</span>
            </div>
          )}
        </div>
        <div className="vbt-actions">
          <button onClick={onRestart} type="button">
            重开
          </button>
        </div>
      </div>
    </section>
  );
}

function FighterHud({ combatant, side }: { combatant: MobileBattleSnapshot["combatants"][number]; side: "me" | "foe" }) {
  const hpRatio = Math.max(0, Math.min(100, (combatant.hp / combatant.maxHp) * 100));
  return (
    <div className={`vbt-f ${side}`} style={{ "--fc": combatant.color } as React.CSSProperties}>
      <div className="vbt-fname">
        <BallSprite color={combatant.color} px={3} />
        <span>{combatant.name}</span>
      </div>
      <div className="vbt-bar">
        <i style={{ width: `${hpRatio}%` }} />
        {combatant.shield > 0 ? <span className="shield" style={{ width: `${Math.min(100, combatant.shield)}%` }} /> : null}
        <span className="vbt-hp">
          {Math.ceil(combatant.hp)}/{Math.ceil(combatant.maxHp)}
          {combatant.shield > 0 ? ` +${Math.ceil(combatant.shield)}` : ""}
        </span>
      </div>
      <div className="vbt-fbuild">
        {combatant.build.map((traitId, index) => {
          const trait = getMobileTrait(traitId);
          const category = trait ? getMobileCategory(trait.cat) : null;
          return <span className="d" key={`${traitId}-${index}`} style={{ background: category?.color ?? "#8892a6" }} title={trait?.name} />;
        })}
      </div>
      {combatant.statuses.length > 0 ? (
        <div className="vbt-fstat">
          {combatant.statuses.map((status) => (
            <span className="s" key={status.type} style={{ background: statusColors[status.type] }}>
              {statusLabels[status.type]}
              {status.stacks > 1 ? ` ${status.stacks}` : ""}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ResultOverlay({ status }: { status: Exclude<MobileBattleStatus, "fighting"> }) {
  return (
    <div className="vbt-result">
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

function PixelArt({
  rows,
  palette,
  px = 4,
  style
}: {
  rows: string[];
  palette: Record<string, string | null>;
  px?: number;
  style?: React.CSSProperties;
}) {
  const shadows = rows.flatMap((row, y) =>
    [...row].flatMap((cell, x) => {
      const color = palette[cell];
      return color ? [`${x * px}px ${y * px}px 0 ${color}`] : [];
    })
  );
  const width = (rows[0]?.length ?? 0) * px;
  return (
    <span className="pixel-art" style={{ width, height: rows.length * px, ...style }}>
      <i style={{ width: px, height: px, boxShadow: shadows.join(",") }} />
    </span>
  );
}

function PixelSprite({
  rows,
  color,
  px,
  size,
  style
}: {
  rows: string[];
  color: string;
  px?: number;
  size?: number;
  style?: React.CSSProperties;
}) {
  const unit = px ?? size ?? 3;
  const shadows = rows.flatMap((row, y) =>
    [...row].flatMap((cell, x) => (cell === "1" ? [`${x * unit}px ${y * unit}px 0 ${color}`] : []))
  );
  const width = (rows[0]?.length ?? 0) * unit;
  return (
    <span className="pixel-sprite" style={{ width, height: rows.length * unit, ...style }}>
      <i style={{ width: unit, height: unit, boxShadow: shadows.join(",") }} />
    </span>
  );
}

function BallSprite({ color, px, size, hi = "rgba(255,255,255,.7)" }: { color: string; px?: number; size?: number; hi?: string }) {
  const unit = px ?? size ?? 4;
  const rows = ["001110", "011111", "111111", "111111", "011111", "001110"];
  const shadows = rows.flatMap((row, y) =>
    [...row].flatMap((cell, x) => {
      if (cell !== "1") {
        return [];
      }
      const highlight = (y === 1 && x === 2) || (y === 0 && x === 2) || (y === 1 && x === 3);
      return [`${x * unit}px ${y * unit}px 0 ${highlight ? hi : color}`];
    })
  );
  return (
    <span className="ball-sprite" style={{ width: 6 * unit, height: 6 * unit }}>
      <i style={{ width: unit, height: unit, boxShadow: shadows.join(",") }} />
    </span>
  );
}

function TraitMini({ trait, onRemove }: { trait: MobileTrait; onRemove: () => void }) {
  const category = getMobileCategory(trait.cat);
  return (
    <button className="tmini" onClick={onRemove} style={{ "--c": category.color } as React.CSSProperties} type="button">
      <span className="tmini-bar" />
      <span className="tmini-name">{trait.name}</span>
      <span className="tmini-x">✕</span>
    </button>
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

const MEME_PX = [7, 6, 7, 6, 5, 5];

const startMemes = [
  {
    id: "m_grin",
    name: "笑脸",
    palette: { ".": null, o: "#15131f", y: "#ffd23f", e: "#2a2233" },
    rows: ["..ooooo..", ".oyyyyyo.", "oyyyyyyyo", "oyeyyyeyo", "oyyyyyyyo", "oeyyyyyeo", "oyeeeeeyo", ".oyyyyyo.", "..ooooo.."]
  },
  {
    id: "m_cool",
    name: "墨镜",
    palette: { ".": null, o: "#15131f", y: "#ffd23f", s: "#15131f", w: "#22d3ff", e: "#2a2233" },
    rows: ["..ooooo..", ".oyyyyyo.", "oyyyyyyyo", "ossssssso", "owsssswyo", "oyyyyyyyo", "oyyeeeyyo", ".oyyyyyo.", "..ooooo.."]
  },
  {
    id: "m_laugh",
    name: "狂笑",
    palette: { ".": null, o: "#15131f", y: "#ffd23f", e: "#2a2233", b: "#22d3ff" },
    rows: ["..ooooo..", ".oyyyyyo.", "oyeyyyeyo", "byyyyyyyb", "oyeeeeeyo", "oyeeeeeyo", "oyyeeeyyo", ".oyyyyyo.", "..ooooo.."]
  },
  {
    id: "m_cry",
    name: "大哭",
    palette: { ".": null, o: "#15131f", y: "#ffd23f", e: "#2a2233", b: "#22d3ff" },
    rows: ["..ooooo..", ".oyyyyyo.", "oyeyyyeyo", "oybyyybyo", "oybyyybyo", "oyyyyyyyo", "oyeeeeeyo", ".oyyyyyo.", "..ooooo.."]
  },
  {
    id: "m_angry",
    name: "暴怒",
    palette: { ".": null, o: "#15131f", r: "#ff4d4d", e: "#2a2233" },
    rows: ["..ooooo..", ".orrrrro.", "orrrrrrro", "oeerrreeo", "orerrrero", "orrrrrrro", "orreeerro", ".orrrrro.", "..ooooo.."]
  },
  {
    id: "m_skull",
    name: "骷髅",
    palette: { ".": null, o: "#15131f", k: "#f4f8ff", e: "#2a2233" },
    rows: ["..ooooo..", ".okkkkko.", "okkkkkkko", "okeekeeko", "okeekeeko", "okkkekkko", ".okekeko.", ".okkkkko.", "..ooooo.."]
  }
] satisfies Array<{ id: string; name: string; palette: Record<string, string | null>; rows: string[] }>;
