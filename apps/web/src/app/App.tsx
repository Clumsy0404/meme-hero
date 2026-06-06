import { baseBallStats } from "@ball-brawl/content";

export function App() {
  return (
    <main className="app-shell">
      <section className="hero-panel">
        <p className="eyebrow">Phase 0</p>
        <h1>小球乱斗</h1>
        <p className="summary">
          词条构筑自动对战 Demo 工程已初始化。下一阶段会先跑通无词条小球战斗闭环。
        </p>
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
      </section>
    </main>
  );
}
