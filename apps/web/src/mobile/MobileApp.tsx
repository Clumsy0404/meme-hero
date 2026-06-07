import {
  createBattle,
  DEFAULT_ARENA,
  FIXED_DT,
  getSnapshot,
  stepBattle,
  type BattleWorldState
} from "@ball-brawl/sim";
import { validateBuildConfig } from "@ball-brawl/content";
import type { BuildConfig, TraitId } from "@ball-brawl/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { createBuildConfig, createMatchConfig } from "../app/match";
import { playMobileSfx } from "./mobile-audio";
import {
  normalizeCommonBallAvatarId,
  pickCommonBallAvatarId,
  resolveBallIconSrc,
  specialEffectColors,
  statusColors,
  statusLabels,
  type CommonBallAvatarId
} from "./mobile-assets";
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
type ChallengerMode = "enemy" | "player";

type PlayerBuildRecord = {
  id: string;
  name: string;
  style: string;
  desc: string;
  color: string;
  avatarId: CommonBallAvatarId;
  diff: number;
  wins: number;
  traits: TraitId[];
  createdAt: string;
  source: "local" | "imported";
};

type MobileOpponentLike = MobileOpponent | PlayerBuildRecord;

type ImportBuildResult =
  | { ok: true; record: PlayerBuildRecord }
  | { ok: false; message: string };

type MobileAppProps = {
  onOpenDeveloper: () => void;
};

export function MobileApp({ onOpenDeveloper }: MobileAppProps) {
  const [screen, setScreen] = useState<MobileScreen>("start");
  const [selectedTraits, setSelectedTraits] = useState<MobileTrait[]>([]);
  const [opponent, setOpponent] = useState<MobileOpponentLike | null>(null);
  const [savedBuilds, setSavedBuilds] = useState<PlayerBuildRecord[]>(() => loadPlayerBuildRecords());
  const [blueAvatarId, setBlueAvatarId] = useState<CommonBallAvatarId>(() => pickCommonBallAvatarId("mobile-blue-initial"));
  const [activeBlueRecordId, setActiveBlueRecordId] = useState<string | null>(null);
  const selectedTraitKey = useMemo(() => selectedTraits.map((trait) => trait.id).join("|"), [selectedTraits]);

  const blueBuild = useMemo(
    () => createBuildConfig("我方小球", "mobile_blue", selectedTraits.map((trait) => trait.id)),
    [selectedTraits]
  );
  const redBuild = useMemo(
    () => (opponent ? createBuildConfig(opponent.name, "mobile_red", opponent.traits) : null),
    [opponent]
  );

  useEffect(() => {
    setActiveBlueRecordId(null);
  }, [blueAvatarId, selectedTraitKey]);

  const handleStart = useCallback(() => {
    playMobileSfx("ui.confirm");
    setScreen("traits");
  }, []);

  const handleConfirmTraits = useCallback(() => {
    playMobileSfx("ui.confirm");
    setBlueAvatarId(pickCommonBallAvatarId(`blue-${Date.now()}-${selectedTraits.map((trait) => trait.id).join("|")}`));
    setScreen("challenger");
  }, [selectedTraits]);

  const handleChallenge = useCallback((nextOpponent: MobileOpponentLike) => {
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

  const handleSavePlayerBuild = useCallback((name?: string) => {
    const traitIds = selectedTraits.map((trait) => trait.id);
    const validation = validateBuildTraitIds(traitIds);
    if (!validation.ok) {
      return null;
    }
    const record = createPlayerBuildRecord(validation.traits, "local", name, blueAvatarId);
    setSavedBuilds((records) => {
      const nextRecords = [record, ...records].slice(0, 24);
      savePlayerBuildRecords(nextRecords);
      return nextRecords;
    });
    setActiveBlueRecordId(record.id);
    return record;
  }, [blueAvatarId, selectedTraits]);

  const handleImportPlayerBuild = useCallback((code: string): ImportBuildResult => {
    const decoded = decodeBuildCode(code);
    if (!decoded.ok) {
      return decoded;
    }
    const record = createPlayerBuildRecord(decoded.traits, "imported", decoded.name, decoded.avatarId);
    setSavedBuilds((records) => {
      const nextRecords = [record, ...records].slice(0, 24);
      savePlayerBuildRecords(nextRecords);
      return nextRecords;
    });
    return { ok: true, record };
  }, []);

  const handleBattleResolved = useCallback(
    (status: MobileBattleStatus, battleOpponent: MobileOpponentLike) => {
      const winnerRecordId = status === "win" ? activeBlueRecordId : status === "lose" && isPlayerBuildRecord(battleOpponent) ? battleOpponent.id : null;
      if (!winnerRecordId) {
        return;
      }
      setSavedBuilds((records) => {
        const nextRecords = records.map((record) => (record.id === winnerRecordId ? { ...record, wins: record.wins + 1 } : record));
        savePlayerBuildRecords(nextRecords);
        return nextRecords;
      });
    },
    [activeBlueRecordId]
  );

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
            blueAvatarId={blueAvatarId}
            savedBuilds={savedBuilds}
            selectedTraits={selectedTraits}
            onBack={handleBackToTraits}
            onChallenge={handleChallenge}
            onImportBuild={handleImportPlayerBuild}
            onOpponentChange={setOpponent}
            onSaveBuild={handleSavePlayerBuild}
          />
        ) : null}
        {screen === "battle" && opponent && redBuild ? (
          <MobileBattleFlow
            blueAvatarId={blueAvatarId}
            blueBuild={blueBuild}
            opponent={opponent}
            redBuild={redBuild}
            onBack={handleBackToChallenger}
            onBattleResolved={(status) => handleBattleResolved(status, opponent)}
          />
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
  const hasLegendary = selectedTraits.some((trait) => trait.rarity === "legendary");

  const countOf = useCallback(
    (traitId: TraitId) => selectedTraits.filter((trait) => trait.id === traitId).length,
    [selectedTraits]
  );

  const canAdd = useCallback(
    (trait: MobileTrait) =>
      selectedTraits.length < mobileGameData.pickCount &&
      (trait.repeat || !selectedIds.includes(trait.id)) &&
      countOf(trait.id) < trait.maxStacks &&
      (trait.rarity !== "legendary" || !hasLegendary),
    [countOf, hasLegendary, selectedIds, selectedTraits.length]
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
          const legendary = trait.rarity === "legendary";
          const cost = trait.cost === "tradeoff" ? { cls: "cost-trade", text: "有代价" } : { cls: "cost-pure", text: "纯正面" };
          return (
            <button
              className={`va-card ${legendary ? "legendary" : ""} ${disabled ? "dis" : ""}`}
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
                {legendary ? <span className="va-chip va-legend">传说</span> : null}
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
              <div
                className={`va-slot ${trait.rarity === "legendary" ? "legendary" : ""}`}
                key={index}
                style={{ "--c": category.color } as React.CSSProperties}
              >
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
  opponent: MobileOpponentLike | null;
  blueAvatarId: CommonBallAvatarId;
  savedBuilds: PlayerBuildRecord[];
  selectedTraits: MobileTrait[];
  onBack: () => void;
  onChallenge: (opponent: MobileOpponentLike) => void;
  onImportBuild: (code: string) => ImportBuildResult;
  onOpponentChange: (opponent: MobileOpponentLike | null) => void;
  onSaveBuild: (name?: string) => PlayerBuildRecord | null;
};

function ChallengerScreen({
  opponent,
  blueAvatarId,
  savedBuilds,
  selectedTraits,
  onBack,
  onChallenge,
  onImportBuild,
  onOpponentChange,
  onSaveBuild
}: ChallengerScreenProps) {
  const [mode, setMode] = useState<ChallengerMode>("enemy");
  const [buildCode, setBuildCode] = useState("");
  const [buildMessage, setBuildMessage] = useState("保存或导入构筑后，可在过往玩家中挑战。");
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const currentBuildCode = selectedTraits.length === mobileGameData.pickCount ? encodeBuildCode(selectedTraits.map((trait) => trait.id), blueAvatarId) : "";
  const rankedSavedBuilds = useMemo(() => [...savedBuilds].sort(comparePlayerBuildRecords), [savedBuilds]);

  const handleModeChange = useCallback(
    (nextMode: ChallengerMode) => {
      playMobileSfx("ui.click");
      setMode(nextMode);
      onOpponentChange(null);
    },
    [onOpponentChange]
  );

  const handleOpenSaveDialog = useCallback(() => {
    playMobileSfx("ui.click");
    setSaveName(createDefaultBuildName());
    setSaveDialogOpen(true);
  }, []);

  const handleSave = useCallback(() => {
    playMobileSfx("ui.confirm");
    const record = onSaveBuild(saveName);
    if (!record) {
      setBuildMessage("当前构筑不完整，无法保存。");
      return;
    }
    setMode("player");
    onOpponentChange(record);
    setBuildMessage(`已保存：${record.name}`);
    setSaveDialogOpen(false);
  }, [onOpponentChange, onSaveBuild, saveName]);

  const handleExport = useCallback(() => {
    if (!currentBuildCode) {
      setBuildMessage("当前构筑不完整，无法导出。");
      return;
    }
    playMobileSfx("ui.click");
    setBuildCode(currentBuildCode);
    setBuildMessage("构筑码已生成，可手动复制。");
  }, [currentBuildCode]);

  const handleImport = useCallback(() => {
    playMobileSfx("ui.confirm");
    const result = onImportBuild(buildCode);
    if (!result.ok) {
      setBuildMessage(result.message);
      return;
    }
    setMode("player");
    onOpponentChange(result.record);
    setBuildMessage(`已导入：${result.record.name}`);
  }, [buildCode, onImportBuild, onOpponentChange]);

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
          <button className={`vch-modetab ${mode === "enemy" ? "on" : ""}`} onClick={() => handleModeChange("enemy")} type="button">
            预设敌人<span className="men">PVE</span>
          </button>
          <button className={`vch-modetab ${mode === "player" ? "on" : ""}`} onClick={() => handleModeChange("player")} type="button">
            过往玩家<span className="men">PVP</span>
          </button>
        </div>
        <div className="vch-build-tools">
          <div className="vch-tool-actions">
            <button disabled={selectedTraits.length !== mobileGameData.pickCount} onClick={handleOpenSaveDialog} type="button">
              保存构筑
            </button>
            <button disabled={!currentBuildCode} onClick={handleExport} type="button">
              导出
            </button>
            <button onClick={handleImport} type="button">
              导入
            </button>
          </div>
          <input
            aria-label="构筑码"
            onChange={(event) => setBuildCode(event.target.value)}
            placeholder="粘贴或生成构筑码"
            value={buildCode}
          />
          <span>{buildMessage}</span>
        </div>
      </div>

      <div className="vch-listwrap">
        <div className="vch-list">
          {mode === "enemy" ? mobileGameData.enemies.map((enemy) => {
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
                  <BuildAvatar avatarId={enemy.avatarId} color={enemy.color} traits={enemy.traits} />
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
          }) : null}
          {mode === "player" && savedBuilds.length === 0 ? (
            <div className="vch-empty">
              <strong>暂无过往玩家</strong>
              <span>保存当前构筑，或导入别人的构筑码。</span>
            </div>
          ) : null}
          {mode === "player"
            ? rankedSavedBuilds.map((record) => {
                const active = opponent?.id === record.id;
                return (
                  <button
                    className={`vch-en ${active ? "on" : ""}`}
                    key={record.id}
                    onClick={() => {
                      playMobileSfx("ui.click");
                      onOpponentChange(active ? null : record);
                    }}
                    style={{ "--ec": record.color } as React.CSSProperties}
                    type="button"
                  >
                    <div className="vch-ava">
                      <BuildAvatar avatarId={record.avatarId} color={record.color} traits={record.traits} />
                      <div className="vch-pmeta">{record.source === "imported" ? "导入" : "本地"}</div>
                    </div>
                    <div className="vch-body">
                      <div className="vch-head">
                        <span className="vch-name">{record.name}</span>
                        <span className="vch-style">{record.style}</span>
                        <span className="vch-wins">胜场 {record.wins}</span>
                        {active ? <span className="vch-check">✓</span> : null}
                      </div>
                      <div className="vch-desc">{record.desc}</div>
                      <div className="vch-tchips">
                        {record.traits.map((traitId, index) => {
                          const trait = getMobileTrait(traitId);
                          if (!trait) {
                            return null;
                          }
                          const category = getMobileCategory(trait.cat);
                          return (
                            <span className="vch-tchip" key={`${traitId}-${index}`} style={{ "--tc": category.color } as React.CSSProperties}>
                              <span className="d" />
                              {trait.name}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </button>
                );
              })
            : null}
        </div>
        <div className={`vch-more ${mode === "enemy" || rankedSavedBuilds.length > 3 ? "show" : ""}`}>
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
          {opponent ? `开始战斗 ▶ ${mode === "player" ? "决斗" : "挑战"} ${opponent.name}` : mode === "player" ? "选择一个过往玩家" : "选择一个挑战者"}
        </button>
      </div>

      {saveDialogOpen ? (
        <div className="vch-modalShade" role="presentation">
          <form
            aria-label="构筑命名"
            aria-modal="true"
            className="vch-saveModal"
            onSubmit={(event) => {
              event.preventDefault();
              handleSave();
            }}
            role="dialog"
          >
            <div className="vch-saveTitle">构筑命名</div>
            <input
              autoFocus
              maxLength={18}
              onChange={(event) => setSaveName(event.currentTarget.value)}
              placeholder="输入构筑名称"
              value={saveName}
            />
            <div className="vch-saveActions">
              <button
                onClick={() => {
                  playMobileSfx("ui.click");
                  setSaveDialogOpen(false);
                }}
                type="button"
              >
                取消
              </button>
              <button disabled={!saveName.trim()} type="submit">
                保存
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}

type MobileBattleFlowProps = {
  blueAvatarId: CommonBallAvatarId;
  blueBuild: BuildConfig;
  opponent: MobileOpponentLike;
  redBuild: BuildConfig;
  onBack: () => void;
  onBattleResolved: (status: MobileBattleStatus) => void;
};

function MobileBattleFlow({ blueAvatarId, blueBuild, opponent, redBuild, onBack, onBattleResolved }: MobileBattleFlowProps) {
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [restartToken, setRestartToken] = useState(0);
  const battleMode: MobileBattleSnapshot["mode"] = isPlayerBuildRecord(opponent) ? "pvp" : "pve";
  const redAvatarId = useMemo(() => pickOpponentAvatarId(opponent, redBuild.traits, blueAvatarId), [blueAvatarId, opponent, redBuild.traits]);
  const snapshot = useMobileBattleSnapshot(blueBuild, redBuild, opponent, battleMode, blueAvatarId, redAvatarId, paused, speed, restartToken);
  const lastSfxTickRef = useRef(-1);
  const reportedResultRef = useRef<number | null>(null);

  useEffect(() => {
    lastSfxTickRef.current = -1;
    reportedResultRef.current = null;
  }, [restartToken]);

  useEffect(() => {
    if (!snapshot || snapshot.sfx.length === 0 || snapshot.tick === lastSfxTickRef.current) {
      return;
    }
    for (const key of snapshot.sfx) {
      playMobileSfx(key);
    }
    lastSfxTickRef.current = snapshot.tick;
  }, [snapshot]);

  useEffect(() => {
    if (!snapshot || snapshot.status === "fighting" || reportedResultRef.current === restartToken) {
      return;
    }
    reportedResultRef.current = restartToken;
    onBattleResolved(snapshot.status);
  }, [onBattleResolved, restartToken, snapshot]);

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
  opponent: MobileOpponentLike,
  mode: MobileBattleSnapshot["mode"],
  blueAvatarId: CommonBallAvatarId,
  redAvatarId: CommonBallAvatarId,
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
      const nextSnapshot = toMobileBattleSnapshot(getSnapshot(world), blueBuild, redBuild, opponent, mode, { blueAvatarId, redAvatarId });
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
  }, [blueAvatarId, blueBuild, mode, opponent, redAvatarId, redBuild, restartToken]);

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
        {snapshot.links.length > 0 ? (
          <svg className="vbt-links" preserveAspectRatio="none" viewBox={`0 0 ${snapshot.arena.w} ${snapshot.arena.h}`}>
            {snapshot.links.map((link) => (
              <line className={link.kind} key={link.id} x1={link.from.x} x2={link.to.x} y1={link.from.y} y2={link.to.y} />
            ))}
          </svg>
        ) : null}
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
              {combatant.elbow ? <i className="vbt-elbow" style={elbowStyle(combatant)} /> : null}
              <CombatantBall combatant={combatant} />
              {combatant.statuses.some((status) => status.type === "burn") ? <BurnParticles radius={combatant.r} /> : null}
              {combatant.statuses.some((status) => status.type === "poison") ? <PoisonParticles radius={combatant.r} /> : null}
              {combatant.statuses.map((status) => (
                <i className="vbt-ball-ring" key={status.type} style={{ "--status": statusColors[status.type] } as React.CSSProperties} />
              ))}
              {combatant.specialEffects.map((effect) => (
                <i
                  className={`vbt-ball-ring special ${effect}`}
                  key={effect}
                  style={
                    {
                      "--status": getSpecialEffectColor(effect)
                    } as React.CSSProperties
                  }
                />
              ))}
            </div>
          </div>
        ))}
        {snapshot.projectiles.map((projectile) => (
          <div
            className={`vbt-proj ${projectile.kind}`}
            key={projectile.id}
            style={
              {
                ...arenaStyle(snapshot, projectile.x, projectile.y),
                "--pr": `${Math.max(6, projectile.r * 0.72)}px`,
                background: projectile.color,
                color: projectile.color
              } as React.CSSProperties
            }
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
          <div className="vbt-logline sys">
            <span className="lt">{formatTime(snapshot.elapsed)}</span>
            <span className="lx">战斗中</span>
          </div>
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

function CombatantBall({ combatant }: { combatant: MobileBattleSnapshot["combatants"][number] }) {
  if (combatant.iconSrc) {
    const size = getSpecialBallRenderSize(combatant.r);
    return <img alt="" className="vbt-ball-img" draggable={false} src={combatant.iconSrc} style={{ "--bs": `${size}px` } as React.CSSProperties} />;
  }
  return <BallSprite color={combatant.color} px={Math.max(4, combatant.r / 8)} />;
}

function BurnParticles({ radius }: { radius: number }) {
  const size = getBurnParticleRenderSize(radius);
  return (
    <span aria-hidden="true" className="vbt-burnParticles" style={{ "--burnSize": `${size}px` } as React.CSSProperties}>
      {burnParticleSpecs.map((particle, index) => (
        <i
          key={index}
          style={
            {
              "--fireX": `${particle.x}%`,
              "--fireY": `${particle.y}%`,
              "--dx": `${particle.dx}px`,
              "--dy": `${particle.dy}px`,
              "--dx18": `${particle.dx * 0.18}px`,
              "--dy18": `${particle.dy * 0.18}px`,
              "--dx62": `${particle.dx * 0.62}px`,
              "--dy62": `${particle.dy * 0.62}px`,
              "--ps": `${Math.max(3, size * particle.size)}px`,
              "--pc": particle.color,
              "--pd": `${particle.duration}s`,
              "--pdelay": `${particle.delay}s`
            } as React.CSSProperties
          }
        />
      ))}
    </span>
  );
}

function PoisonParticles({ radius }: { radius: number }) {
  const size = getPoisonParticleRenderSize(radius);
  return (
    <span aria-hidden="true" className="vbt-poisonParticles" style={{ "--poisonSize": `${size}px` } as React.CSSProperties}>
      {poisonParticleSpecs.map((particle, index) => (
        <i
          key={index}
          style={
            {
              "--poisonX": `${particle.x}%`,
              "--poisonY": `${particle.y}%`,
              "--pdx": `${particle.dx}px`,
              "--pdy": `${particle.dy}px`,
              "--pdx35": `${particle.dx * 0.35}px`,
              "--pdy35": `${particle.dy * 0.35}px`,
              "--pdx70": `${particle.dx * 0.7}px`,
              "--pdy70": `${particle.dy * 0.7}px`,
              "--pps": `${Math.max(4, size * particle.size * 1.3)}px`,
              "--ppc": particle.color,
              "--ppd": `${particle.duration}s`,
              "--ppdelay": `${particle.delay}s`
            } as React.CSSProperties
          }
        />
      ))}
    </span>
  );
}

function BuildAvatar({ avatarId, color, traits }: { avatarId: CommonBallAvatarId; color: string; traits: TraitId[] }) {
  const iconSrc = resolveBallIconSrc(traits, avatarId);
  if (iconSrc) {
    return <img alt="" className="vch-ava-img" draggable={false} src={iconSrc} />;
  }
  return <BallSprite color={color} px={5} />;
}

function FighterHud({ combatant, side }: { combatant: MobileBattleSnapshot["combatants"][number]; side: "me" | "foe" }) {
  const hpRatio = Math.max(0, Math.min(100, (combatant.hp / combatant.maxHp) * 100));
  return (
    <div className={`vbt-f ${side}`} style={{ "--fc": combatant.color } as React.CSSProperties}>
      <div className="vbt-fname">
        {combatant.iconSrc ? <img alt="" className="vbt-ficon" draggable={false} src={combatant.iconSrc} /> : <BallSprite color={combatant.color} px={3} />}
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

function getSpecialBallRenderSize(radius: number): number {
  return Math.max(34, Math.min(92, radius * 1.28));
}

function getBurnParticleRenderSize(radius: number): number {
  return Math.max(44, Math.min(112, radius * 1.55));
}

function getPoisonParticleRenderSize(radius: number): number {
  return Math.max(54, Math.min(124, radius * 1.75));
}

function getSpecialEffectColor(effect: MobileBattleSnapshot["combatants"][number]["specialEffects"][number]): string {
  return specialEffectColors[effect] ?? specialEffectColors.elbowReady;
}

function elbowStyle(combatant: MobileBattleSnapshot["combatants"][number]): React.CSSProperties {
  const elbow = combatant.elbow;
  if (!elbow) {
    return {};
  }

  return {
    "--angle": `${Math.atan2(elbow.dy, elbow.dx)}rad`,
    "--bendSign": combatant.side === "me" ? -1 : 1,
    "--elbowLen": `${Math.max(38, elbow.range * 1.02)}px`,
    "--elbowWidth": `${Math.max(13, elbow.radius * 0.88)}px`,
    "--elbowOffset": `${Math.max(16, combatant.r * 0.46)}px`
  } as React.CSSProperties;
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
    <button
      className={`tmini ${trait.rarity === "legendary" ? "legendary" : ""}`}
      onClick={onRemove}
      style={{ "--c": category.color } as React.CSSProperties}
      type="button"
    >
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
const PLAYER_BUILD_STORAGE_KEY = "meme-hero.mobile.player-builds.v1";
const PLAYER_BUILD_CODE_VERSION = 1;
const playerBuildColors = ["#22d3ff", "#ff2e63", "#3ddc84", "#ffb627", "#b14aff", "#ff5db1", "#7aa2ff"];
const burnParticleSpecs = [
  { x: 58, y: 37, dx: 14, dy: -22, size: 0.15, color: "#fff36b", duration: 0.72, delay: -0.1 },
  { x: 48, y: 42, dx: -8, dy: -26, size: 0.11, color: "#ffd23f", duration: 0.86, delay: -0.42 },
  { x: 68, y: 48, dx: 24, dy: -10, size: 0.13, color: "#ff9f1c", duration: 0.78, delay: -0.25 },
  { x: 35, y: 52, dx: -20, dy: -8, size: 0.1, color: "#ff6b00", duration: 0.9, delay: -0.62 },
  { x: 54, y: 62, dx: 10, dy: 15, size: 0.09, color: "#ff3d00", duration: 0.82, delay: -0.18 },
  { x: 42, y: 34, dx: -18, dy: -25, size: 0.08, color: "#ff4d00", duration: 0.76, delay: -0.55 },
  { x: 72, y: 34, dx: 22, dy: -28, size: 0.08, color: "#ff7a00", duration: 0.94, delay: -0.74 },
  { x: 28, y: 44, dx: -25, dy: -18, size: 0.07, color: "#ff3d00", duration: 0.68, delay: -0.32 },
  { x: 61, y: 26, dx: 8, dy: -32, size: 0.09, color: "#ffe66d", duration: 0.88, delay: -0.68 },
  { x: 50, y: 52, dx: 0, dy: -18, size: 0.2, color: "#ffcc00", duration: 0.7, delay: -0.02 },
  { x: 76, y: 58, dx: 28, dy: 4, size: 0.07, color: "#ff5a00", duration: 0.8, delay: -0.47 },
  { x: 38, y: 66, dx: -18, dy: 12, size: 0.06, color: "#ff2e00", duration: 0.74, delay: -0.8 },
  { x: 64, y: 70, dx: 18, dy: 18, size: 0.06, color: "#ff6b00", duration: 0.92, delay: -0.36 },
  { x: 46, y: 24, dx: -8, dy: -34, size: 0.07, color: "#ff9f1c", duration: 0.84, delay: -0.22 },
  { x: 32, y: 58, dx: -28, dy: 3, size: 0.06, color: "#ff3d00", duration: 0.78, delay: -0.91 },
  { x: 70, y: 44, dx: 30, dy: -16, size: 0.08, color: "#ff4d00", duration: 0.86, delay: -0.58 }
] as const;
const poisonParticleSpecs = [
  { x: 50, y: 34, dx: -7, dy: -28, size: 0.09, color: "#b6ff3d", duration: 1.72, delay: -0.22 },
  { x: 61, y: 42, dx: 13, dy: -24, size: 0.08, color: "#39ff14", duration: 1.96, delay: -0.8 },
  { x: 39, y: 46, dx: -15, dy: -18, size: 0.07, color: "#7cff00", duration: 1.84, delay: -1.1 },
  { x: 68, y: 55, dx: 18, dy: -10, size: 0.06, color: "#24d832", duration: 2.08, delay: -0.42 },
  { x: 32, y: 58, dx: -20, dy: -8, size: 0.06, color: "#58ff4d", duration: 1.64, delay: -1.34 },
  { x: 52, y: 66, dx: 4, dy: -16, size: 0.08, color: "#caff5a", duration: 2.18, delay: -0.66 },
  { x: 72, y: 38, dx: 20, dy: -22, size: 0.05, color: "#2ee85a", duration: 1.78, delay: -1.5 },
  { x: 28, y: 40, dx: -18, dy: -24, size: 0.05, color: "#91ff00", duration: 2.02, delay: -0.94 },
  { x: 44, y: 72, dx: -9, dy: -12, size: 0.06, color: "#39ff14", duration: 1.88, delay: -0.12 },
  { x: 63, y: 72, dx: 12, dy: -14, size: 0.06, color: "#a6ff4d", duration: 2.12, delay: -1.24 },
  { x: 74, y: 62, dx: 24, dy: -6, size: 0.05, color: "#1fcf3b", duration: 1.74, delay: -0.5 },
  { x: 36, y: 31, dx: -14, dy: -30, size: 0.05, color: "#d8ff72", duration: 2.2, delay: -1.72 },
  { x: 57, y: 25, dx: 5, dy: -34, size: 0.04, color: "#5aff2d", duration: 1.92, delay: -0.32 },
  { x: 46, y: 52, dx: -5, dy: -20, size: 0.11, color: "#88ff00", duration: 2.04, delay: -1.02 },
  { x: 58, y: 54, dx: 10, dy: -18, size: 0.1, color: "#ccff33", duration: 1.68, delay: -0.76 },
  { x: 42, y: 60, dx: -13, dy: -14, size: 0.09, color: "#44ff66", duration: 1.82, delay: -1.46 },
  { x: 69, y: 28, dx: 18, dy: -31, size: 0.06, color: "#ecff7a", duration: 2.08, delay: -0.18 },
  { x: 30, y: 70, dx: -22, dy: -7, size: 0.06, color: "#21ff48", duration: 1.9, delay: -1.62 },
  { x: 79, y: 48, dx: 28, dy: -16, size: 0.05, color: "#78ff00", duration: 1.74, delay: -0.98 },
  { x: 22, y: 52, dx: -26, dy: -15, size: 0.05, color: "#baff4f", duration: 2.16, delay: -0.58 }
] as const;

type BuildCodePayload = {
  v: number;
  name?: string;
  avatarId?: CommonBallAvatarId;
  traits: TraitId[];
};

function loadPlayerBuildRecords(): PlayerBuildRecord[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(PLAYER_BUILD_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.flatMap((item) => {
      const record = normalizePlayerBuildRecord(item);
      return record ? [record] : [];
    });
  } catch {
    return [];
  }
}

function savePlayerBuildRecords(records: PlayerBuildRecord[]): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(PLAYER_BUILD_STORAGE_KEY, JSON.stringify(records));
}

function normalizeWinCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function normalizePlayerBuildRecord(value: unknown): PlayerBuildRecord | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const candidate = value as Partial<PlayerBuildRecord>;
  if (typeof candidate.id !== "string" || typeof candidate.name !== "string" || !Array.isArray(candidate.traits)) {
    return null;
  }
  const validation = validateBuildTraitIds(candidate.traits);
  if (!validation.ok) {
    return null;
  }
  const createdAt = typeof candidate.createdAt === "string" ? candidate.createdAt : new Date().toISOString();
  return {
    id: candidate.id,
    name: candidate.name,
    style: typeof candidate.style === "string" ? candidate.style : "玩家构筑",
    desc: typeof candidate.desc === "string" ? candidate.desc : describeBuild(validation.traits),
    color: typeof candidate.color === "string" ? candidate.color : pickPlayerBuildColor(candidate.id),
    avatarId: normalizeCommonBallAvatarId(candidate.avatarId) ?? pickCommonBallAvatarId(candidate.id),
    diff: typeof candidate.diff === "number" ? Math.max(1, Math.min(3, Math.round(candidate.diff))) : 2,
    wins: normalizeWinCount(candidate.wins),
    traits: validation.traits,
    createdAt,
    source: candidate.source === "imported" ? "imported" : "local"
  };
}

function isPlayerBuildRecord(opponent: MobileOpponentLike): opponent is PlayerBuildRecord {
  return "source" in opponent;
}

function comparePlayerBuildRecords(a: PlayerBuildRecord, b: PlayerBuildRecord): number {
  if (b.wins !== a.wins) {
    return b.wins - a.wins;
  }
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

function pickOpponentAvatarId(opponent: MobileOpponentLike, traits: TraitId[], blueAvatarId: CommonBallAvatarId): CommonBallAvatarId {
  const preferred = opponent.avatarId ?? pickCommonBallAvatarId(`${opponent.id}-${traits.join("|")}`);
  if (preferred !== blueAvatarId) {
    return preferred;
  }
  return pickCommonBallAvatarId(`${opponent.id}-${traits.join("|")}-foe`, blueAvatarId);
}

function createPlayerBuildRecord(traits: TraitId[], source: "local" | "imported", preferredName?: string, preferredAvatarId?: CommonBallAvatarId): PlayerBuildRecord {
  const createdAt = new Date().toISOString();
  const id = `${source}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    name: preferredName?.trim() || `${source === "imported" ? "导入构筑" : "本地构筑"} ${formatRecordTime(createdAt)}`,
    style: source === "imported" ? "过往玩家" : "本地玩家",
    desc: describeBuild(traits),
    color: pickPlayerBuildColor(id),
    avatarId: preferredAvatarId ?? pickCommonBallAvatarId(id),
    diff: 2,
    wins: 0,
    traits,
    createdAt,
    source
  };
}

function validateBuildTraitIds(traits: unknown): { ok: true; traits: TraitId[] } | { ok: false; message: string } {
  if (!Array.isArray(traits)) {
    return { ok: false, message: "构筑格式不正确。" };
  }
  if (traits.length !== mobileGameData.pickCount) {
    return { ok: false, message: `构筑必须包含 ${mobileGameData.pickCount} 个词条。` };
  }
  const traitIds = traits.filter((trait): trait is TraitId => typeof trait === "string" && Boolean(getMobileTrait(trait as TraitId)));
  if (traitIds.length !== traits.length) {
    return { ok: false, message: "构筑里包含未知词条。" };
  }
  const validation = validateBuildConfig(createBuildConfig("移动端校验构筑", "mobile_blue", traitIds));
  if (!validation.ok) {
    return { ok: false, message: validation.issues[0]?.message ?? "构筑不符合当前规则。" };
  }
  return { ok: true, traits: traitIds };
}

function encodeBuildCode(traits: TraitId[], avatarId: CommonBallAvatarId, name = "玩家构筑"): string {
  const payload: BuildCodePayload = { v: PLAYER_BUILD_CODE_VERSION, name, avatarId, traits };
  const json = JSON.stringify(payload);
  return window.btoa(unescape(encodeURIComponent(json)));
}

function decodeBuildCode(code: string): { ok: true; name?: string; avatarId?: CommonBallAvatarId; traits: TraitId[] } | { ok: false; message: string } {
  const trimmed = code.trim();
  if (!trimmed) {
    return { ok: false, message: "请先粘贴构筑码。" };
  }
  try {
    const payload = JSON.parse(decodeURIComponent(escape(window.atob(trimmed)))) as Partial<BuildCodePayload>;
    if (payload.v !== PLAYER_BUILD_CODE_VERSION) {
      return { ok: false, message: "构筑码版本不兼容。" };
    }
    const validation = validateBuildTraitIds(payload.traits);
    if (!validation.ok) {
      return validation;
    }
    const name = typeof payload.name === "string" ? payload.name : undefined;
    const avatarId = normalizeCommonBallAvatarId(payload.avatarId);
    return {
      ok: true,
      ...(name ? { name } : {}),
      ...(avatarId ? { avatarId } : {}),
      traits: validation.traits
    };
  } catch {
    return { ok: false, message: "构筑码无法解析。" };
  }
}

function describeBuild(traits: TraitId[]): string {
  return traits
    .map((traitId) => getMobileTrait(traitId)?.name)
    .filter((name): name is string => Boolean(name))
    .join(" · ");
}

function createDefaultBuildName(): string {
  return `本地构筑 ${formatRecordTime(new Date().toISOString())}`;
}

function formatRecordTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${month}-${day} ${hour}:${minute}`;
}

function pickPlayerBuildColor(seed: string): string {
  const total = [...seed].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return playerBuildColors[total % playerBuildColors.length] ?? "#22d3ff";
}

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
