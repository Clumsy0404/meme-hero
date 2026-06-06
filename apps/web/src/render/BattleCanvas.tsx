import {
  createBattle,
  DEFAULT_ARENA,
  FIXED_DT,
  getSnapshot,
  stepBattle,
  type BattleEvent,
  type BattleWorldState,
  type WorldSnapshot
} from "@ball-brawl/sim";
import type { MatchConfig, Team } from "@ball-brawl/shared";
import { Application, Container, Graphics, Text } from "pixi.js";
import { useEffect, useRef } from "react";

type BattleCanvasProps = {
  match: MatchConfig;
  restartToken: number;
  onSnapshot: (snapshot: WorldSnapshot) => void;
};

const arenaScale = 0.72;
const ballColors: Record<Team, number> = {
  blue: 0x3394ff,
  red: 0xd12b35
};

export function BattleCanvas({ match, restartToken, onSnapshot }: BattleCanvasProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let disposed = false;
    let animationFrame = 0;
    let lastTime = performance.now();
    let accumulator = 0;
    let world: BattleWorldState | undefined;
    let app: Application | undefined;
    let mountedApp: Application | undefined;

    async function mount() {
      app = new Application();
      await app.init({
        width: Math.round(DEFAULT_ARENA.width * arenaScale),
        height: Math.round(DEFAULT_ARENA.height * arenaScale),
        backgroundAlpha: 0,
        antialias: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        autoDensity: true,
        autoStart: false
      });

      if (disposed || !hostRef.current) {
        disposeApplication(app);
        return;
      }

      mountedApp = app;
      hostRef.current.replaceChildren(app.canvas);
      world = createBattle(match);
      const initialSnapshot = getSnapshot(world);
      drawSnapshot(app.stage, initialSnapshot);
      app.render();
      onSnapshot(initialSnapshot);

      const loop = (now: number) => {
        if (disposed || !app || !world) {
          return;
        }

        const frameDt = Math.min(0.05, (now - lastTime) / 1000);
        lastTime = now;
        accumulator += frameDt;

        while (accumulator >= FIXED_DT && !world.result) {
          stepBattle(world, FIXED_DT);
          accumulator -= FIXED_DT;
        }

        const snapshot = getSnapshot(world);
        drawSnapshot(app.stage, snapshot);
        app.render();
        onSnapshot(snapshot);
        animationFrame = window.requestAnimationFrame(loop);
      };

      animationFrame = window.requestAnimationFrame(loop);
    }

    void mount();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(animationFrame);
      disposeApplication(mountedApp);
    };
  }, [match, onSnapshot, restartToken]);

  return <div className="battle-canvas" ref={hostRef} />;
}

function drawSnapshot(stage: Container, snapshot: WorldSnapshot): void {
  destroyChildren(stage);

  const graphics = new Graphics();
  drawArena(graphics, snapshot);
  drawEvents(graphics, snapshot.events);
  drawTurrets(graphics, snapshot);
  drawProjectiles(graphics, snapshot);
  drawBalls(graphics, snapshot);
  stage.addChild(graphics);

  for (const ball of snapshot.balls) {
    if (!ball.alive) {
      continue;
    }
    const text = new Text({
      text: `${Math.ceil(ball.hp)}`,
      style: {
        fill: 0xffffff,
        fontFamily: "Arial",
        fontSize: Math.max(14, Math.round(ball.radius * arenaScale * 0.75)),
        fontWeight: "800",
        stroke: { color: 0x101319, width: 4 }
      }
    });
    text.anchor.set(0.5);
    text.position.set(ball.position.x * arenaScale, ball.position.y * arenaScale);
    stage.addChild(text);
  }
}

function destroyChildren(stage: Container): void {
  const children = stage.removeChildren();
  for (const child of children) {
    child.destroy({ children: true });
  }
}

function disposeApplication(app: Application | undefined): void {
  if (!app) {
    return;
  }
  destroyChildren(app.stage);
  app.canvas.remove();
  app.renderer.destroy({ removeView: false });
}

function drawArena(graphics: Graphics, snapshot: WorldSnapshot): void {
  const width = snapshot.arena.width * arenaScale;
  const height = snapshot.arena.height * arenaScale;

  graphics.roundRect(0, 0, width, height, 8).fill(0x090b10).stroke({ color: 0xe2e8f0, width: 3 });
  graphics.rect(12, 12, width - 24, height - 24).stroke({ color: 0x263241, width: 1 });
}

function drawBalls(graphics: Graphics, snapshot: WorldSnapshot): void {
  for (const ball of snapshot.balls) {
    if (!ball.alive) {
      continue;
    }
    const x = ball.position.x * arenaScale;
    const y = ball.position.y * arenaScale;
    const radius = ball.radius * arenaScale;
    const hpRatio = Math.max(0, ball.hp / ball.maxHp);
    const color = ballColors[ball.team];
    const fillAlpha = ball.role === "main" ? 1 : 0.66;
    const roleRing = ball.role === "clone" ? 0xa7f3d0 : ball.role === "split" ? 0xfde68a : 0xffffff;

    graphics.circle(x + 5, y + 7, radius).fill({ color: 0x000000, alpha: 0.28 });
    graphics.circle(x, y, radius).fill({ color, alpha: fillAlpha }).stroke({ color: roleRing, width: 2, alpha: 0.36 });
    graphics.circle(x, y, radius + 5).stroke({
      color: hpRatio > 0.35 ? 0x6ee7b7 : 0xfbbf24,
      width: 4
    });
    if (ball.wallChargeStacks > 0) {
      graphics.circle(x, y, radius + 9 + ball.wallChargeStacks * 2).stroke({
        color: 0x67e8f9,
        width: 2 + ball.wallChargeStacks,
        alpha: 0.72
      });
    }
  }
}

function drawTurrets(graphics: Graphics, snapshot: WorldSnapshot): void {
  for (const turret of snapshot.turrets) {
    const x = turret.position.x * arenaScale;
    const y = turret.position.y * arenaScale;
    const radius = turret.radius * arenaScale;
    const color = ballColors[turret.team];
    const hpRatio = Math.max(0, turret.hp / turret.maxHp);

    graphics.roundRect(x - radius, y - radius, radius * 2, radius * 2, 4).fill({ color: 0x000000, alpha: 0.24 });
    graphics
      .roundRect(x - radius + 2, y - radius + 2, radius * 2 - 4, radius * 2 - 4, 4)
      .fill({ color, alpha: 0.34 })
      .stroke({ color, width: 2, alpha: 0.82 });
    graphics.circle(x, y, Math.max(4, radius * 0.42)).fill(0xf8fafc).stroke({ color, width: 2, alpha: 0.9 });
    graphics.rect(x - radius * 0.18, y - radius * 1.25, radius * 0.36, radius * 0.86).fill({ color: 0xf8fafc, alpha: 0.78 });
    graphics.rect(x - radius, y + radius + 4, radius * 2 * hpRatio, 4).fill(hpRatio > 0.35 ? 0x6ee7b7 : 0xfbbf24);
  }
}

function drawProjectiles(graphics: Graphics, snapshot: WorldSnapshot): void {
  for (const projectile of snapshot.projectiles) {
    const x = projectile.position.x * arenaScale;
    const y = projectile.position.y * arenaScale;
    const radius = Math.max(3, projectile.radius * arenaScale);
    const color = ballColors[projectile.team];

    graphics.circle(x + 3, y + 4, radius).fill({ color: 0x000000, alpha: 0.28 });
    graphics.circle(x, y, radius + 3).stroke({ color, width: 2, alpha: 0.58 });
    graphics.circle(x, y, radius).fill(0xf8fafc).stroke({ color, width: 2, alpha: 0.85 });
  }
}

function drawEvents(graphics: Graphics, events: BattleEvent[]): void {
  for (const event of events) {
    if (event.type === "collision") {
      graphics
        .circle(event.position.x * arenaScale, event.position.y * arenaScale, 34)
        .stroke({ color: 0xffffff, width: 3, alpha: 0.3 });
    }
    if (event.type === "damage") {
      const isExplosion = event.tags.includes("explosion");
      const isReflect = event.tags.includes("reflect");
      graphics
        .circle(event.position.x * arenaScale, event.position.y * arenaScale, (isExplosion ? 28 : 12) + event.amount * 1.2)
        .stroke({ color: isExplosion ? 0xfb923c : isReflect ? 0xf472b6 : 0xfff06a, width: isExplosion ? 3 : 2, alpha: 0.42 });
    }
    if (event.type === "heal") {
      graphics
        .circle(event.position.x * arenaScale, event.position.y * arenaScale, 10 + event.amount * 1.4)
        .stroke({ color: 0x6ee7b7, width: 2, alpha: 0.62 });
    }
    if (event.type === "trait_triggered") {
      const color = event.traitId === "collision_burst" ? 0xfb923c : event.traitId === "spike_reflect" ? 0xf472b6 : 0x67e8f9;
      graphics
        .circle(event.position.x * arenaScale, event.position.y * arenaScale, 22 + (event.value ?? 1) * 2)
        .stroke({ color, width: 2, alpha: 0.5 });
    }
  }
}
