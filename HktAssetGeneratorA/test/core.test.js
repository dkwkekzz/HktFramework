// Step 1.1 검증 — RMF·호길이·RNG·해시 (03-phase1 §1.1)

import { describe, it, expect } from "vitest";
import { createCurve3, buildArcLengthTable, evaluateCurve1 } from "../src/core/curve.js";
import { mulberry32, deriveSeed } from "../src/core/rng.js";
import { fnv1a64, hashArrays } from "../src/core/hash.js";
import { dot3 } from "../src/core/math.js";

describe("curve", () => {
  it("직선에서 RMF 가 뒤틀리지 않는다 — 모든 t 에서 normal/binormal 일정", () => {
    const curve = createCurve3({ points: [[0, 0, 0], [0, 0.5, 0], [0, 1, 0]] }, 32);
    const f0 = curve.frame(0);
    for (const t of [0.1, 0.25, 0.5, 0.75, 0.99]) {
      const f = curve.frame(t);
      expect(dot3(f.normal, f0.normal)).toBeGreaterThan(0.9999);
      expect(dot3(f.binormal, f0.binormal)).toBeGreaterThan(0.9999);
      // 프레임 직교성
      expect(Math.abs(dot3(f.tangent, f.normal))).toBeLessThan(1e-6);
      expect(Math.abs(dot3(f.tangent, f.binormal))).toBeLessThan(1e-6);
    }
  });

  it("곡선에서도 프레임이 연속이다 (인접 샘플 간 급회전 없음)", () => {
    const curve = createCurve3({ points: [[0, 0, 0], [0.1, 0.5, 0], [0, 1, 0.1]] }, 64);
    let prev = curve.frame(0);
    for (let i = 1; i <= 100; i++) {
      const f = curve.frame(i / 100);
      expect(dot3(f.normal, prev.normal)).toBeGreaterThan(0.99);
      prev = f;
    }
  });

  it("호길이 테이블은 단조 증가하고 총 길이가 맞다", () => {
    const curve = createCurve3({ points: [[0, 0, 0], [0, 0.5, 0], [0, 1, 0]] });
    const table = buildArcLengthTable(curve, 32);
    for (let i = 1; i < table.length; i++) expect(table[i]).toBeGreaterThan(table[i - 1]);
    expect(table[32]).toBeCloseTo(1.0, 3);
  });

  it("Curve1 은 제어점을 통과한다", () => {
    const spec = { points: [{ t: 0, value: 2 }, { t: 0.5, value: 5 }, { t: 1, value: 3 }] };
    expect(evaluateCurve1(spec, 0)).toBeCloseTo(2, 6);
    expect(evaluateCurve1(spec, 0.5)).toBeCloseTo(5, 6);
    expect(evaluateCurve1(spec, 1)).toBeCloseTo(3, 6);
  });
});

describe("rng / hash", () => {
  it("같은 seed 는 같은 스트림", () => {
    const a = mulberry32(1234);
    const b = mulberry32(1234);
    for (let i = 0; i < 100; i++) expect(a()).toBe(b());
  });

  it("deriveSeed 는 scope 별로 안정적으로 다르다", () => {
    expect(deriveSeed(42, "blade")).toBe(deriveSeed(42, "blade"));
    expect(deriveSeed(42, "blade")).not.toBe(deriveSeed(42, "guard"));
  });

  it("fnv1a64 는 결정적이고 입력에 민감하다", () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    expect(fnv1a64(bytes)).toBe(fnv1a64(new Uint8Array([1, 2, 3, 4])));
    expect(fnv1a64(bytes)).not.toBe(fnv1a64(new Uint8Array([1, 2, 3, 5])));
    expect(hashArrays([new Float32Array([1.5]), new Uint32Array([7])]))
      .toBe(hashArrays([new Float32Array([1.5]), new Uint32Array([7])]));
  });
});
