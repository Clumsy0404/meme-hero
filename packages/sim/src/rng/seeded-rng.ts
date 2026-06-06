import type { Vec2 } from "@ball-brawl/shared";

import { normalize } from "../math/vector";

export class SeededRng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
    if (this.state === 0) {
      this.state = 0x6d2b79f5;
    }
  }

  next(): number {
    let value = this.state;
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    this.state = value >>> 0;
    return this.state / 0x100000000;
  }

  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  direction(): Vec2 {
    const angle = this.range(0, Math.PI * 2);
    return normalize({ x: Math.cos(angle), y: Math.sin(angle) });
  }

  getState(): number {
    return this.state;
  }
}
