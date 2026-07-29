// Step 3.1 검증 — 결정적 노이즈 (05-phase3 §3.1)

import { describe, it, expect } from "vitest";
import { hash21, valueNoise2, periodicValueNoise2, fbm, directionalNoise } from "../src/core/noise.js";

describe("noise determinism", () => {
  it("같은 인자 → 같은 값", () => {
    expect(hash21(1.5, 2.5, 7)).toBe(hash21(1.5, 2.5, 7));
    expect(valueNoise2(3.7, 8.1, 42)).toBe(valueNoise2(3.7, 8.1, 42));
    expect(fbm(1.1, 2.2, { seed: 5 })).toBe(fbm(1.1, 2.2, { seed: 5 }));
    expect(directionalNoise(1, 2, { seed: 3, stretch: 8 }))
      .toBe(directionalNoise(1, 2, { seed: 3, stretch: 8 }));
  });

  it("seed 가 다르면 값이 다르다", () => {
    expect(valueNoise2(3.7, 8.1, 42)).not.toBe(valueNoise2(3.7, 8.1, 43));
  });

  it("값 범위 [0,1]", () => {
    for (let i = 0; i < 200; i++) {
      const v = valueNoise2(i * 0.37, i * 0.71, 9);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});

describe("periodic noise (D-10)", () => {
  it("y=0 과 y=period 에서 연속이다", () => {
    const period = 8;
    for (let i = 0; i < 50; i++) {
      const x = i * 0.61;
      expect(periodicValueNoise2(x, 0.25, period, 11))
        .toBeCloseTo(periodicValueNoise2(x, period + 0.25, period, 11), 10);
    }
  });
});
