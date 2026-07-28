import { describe, expect, it } from "vitest";
import { createRng, type RandomContext } from "./random";

const ctx: RandomContext = { worldSeed: 42, simulationStep: 100, entityId: "agent.rion" };

function take(context: RandomContext, n: number): number[] {
  const rng = createRng(context);
  return Array.from({ length: n }, () => rng.nextUint32());
}

describe("RandomContext RNG (§39)", () => {
  it("같은 컨텍스트면 같은 난수열", () => {
    expect(take(ctx, 32)).toEqual(take({ ...ctx }, 32));
  });

  it("entityId 가 다르면 다른 난수열 — 개체 처리 순서와 무관한 재현성의 근거", () => {
    expect(take(ctx, 8)).not.toEqual(take({ ...ctx, entityId: "agent.sera" }, 8));
  });

  it("simulationStep 이 다르면 다른 난수열", () => {
    expect(take(ctx, 8)).not.toEqual(take({ ...ctx, simulationStep: 101 }, 8));
  });

  it("worldSeed 가 다르면 다른 난수열", () => {
    expect(take(ctx, 8)).not.toEqual(take({ ...ctx, worldSeed: 43 }, 8));
  });

  it("entityId 생략도 유효한 스트림", () => {
    const noEntity: RandomContext = { worldSeed: 1, simulationStep: 0 };
    expect(take(noEntity, 8)).toEqual(take({ ...noEntity }, 8));
  });

  it("next() 는 [0,1) 범위, 대략 균등", () => {
    const rng = createRng(ctx);
    let sum = 0;
    const n = 10000;
    for (let i = 0; i < n; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      sum += v;
    }
    expect(sum / n).toBeGreaterThan(0.45);
    expect(sum / n).toBeLessThan(0.55);
  });

  it("nextInt 는 [0, max) 정수", () => {
    const rng = createRng(ctx);
    for (let i = 0; i < 1000; i++) {
      const v = rng.nextInt(7);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(7);
    }
  });
});
