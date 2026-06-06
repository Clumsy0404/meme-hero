import { baseBallStats } from "@ball-brawl/content";
import type { WorldSnapshot } from "@ball-brawl/sim";
import { useCallback, useMemo, useState } from "react";

import { BattleCanvas } from "../render/BattleCanvas";
import { demoMatchConfig } from "./match";

export function App() {
  const [restartToken, setRestartToken] = useState(0);
  const [snapshot, setSnapshot] = useState<WorldSnapshot | null>(null);
  const match = useMemo(() => demoMatchConfig, []);
  const handleSnapshot = useCallback((nextSnapshot: WorldSnapshot) => {
    setSnapshot(nextSnapshot);
  }, []);
  const blue = snapshot?.balls.find((ball) => ball.team === "blue" && ball.role === "main");
  const red = snapshot?.balls.find((ball) => ball.team === "red" && ball.role === "main");
  const result = snapshot?.result;

  return (
    <main className="app-shell">
      <section className="dashboard">
        <aside className="control-panel">
          <p className="eyebrow">Phase 2</p>
          <h1>小球乱斗</h1>
          <p className="summary">无词条自动战斗闭环已接入渲染。当前双方使用基础数值进行碰撞对战。</p>

          <dl className="stat-grid">
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

          <div className="scoreboard">
            <CombatantPanel color="blue" label="蓝方" value={blue?.hp ?? baseBallStats.maxHp} />
            <CombatantPanel color="red" label="红方" value={red?.hp ?? baseBallStats.maxHp} />
          </div>

          <div className="result-panel">
            <span>战斗时间</span>
            <strong>{(snapshot?.time ?? 0).toFixed(1)}s</strong>
            {result ? <p>{result.winner === "draw" ? "平局" : `${result.winner === "blue" ? "蓝方" : "红方"}获胜`}</p> : <p>战斗中</p>}
          </div>

          <button className="primary-button" onClick={() => setRestartToken((value) => value + 1)} type="button">
            重新开始
          </button>
        </aside>

        <section className="battle-panel">
          <BattleCanvas match={match} onSnapshot={handleSnapshot} restartToken={restartToken} />
        </section>
      </section>
    </main>
  );
}

type CombatantPanelProps = {
  label: string;
  value: number;
  color: "blue" | "red";
};

function CombatantPanel({ label, value, color }: CombatantPanelProps) {
  return (
    <div className={`combatant-panel ${color}`}>
      <span>{label}</span>
      <strong>{Math.ceil(Math.max(0, value))}</strong>
    </div>
  );
}
