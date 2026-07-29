// Phase 5 검증 — 참조 마스크(RLE·폴리곤 래스터)와 TargetSpec 생성 (07-phase5 §5.1·§5.2)

import { describe, it, expect } from "vitest";
import { mulberry32 } from "../src/core/rng.js";
import {
  rasterizePolygonMask, encodeMaskRLE, decodeMaskRLE, buildReferenceSpec,
} from "../src/eval/refmask.js";
import {
  buildTargetSpec, synthesizeTargetSpec, createInitialSwordDesign, LANDMARK_NAMES,
} from "../src/eval/targetspec.js";
import { makeSwordDesign } from "../src/mesh/sword.js";
import {
  projectSwordMask, getMaskBit, silhouetteIoU, designLandmarks,
} from "../src/eval/silhouette.js";

const SWORD_PARAMS = {
  blade: {
    length: 0.95, widthRoot: 0.055, widthMid: 0.048, widthTip: 0.03,
    thicknessRoot: 0.006, thicknessTip: 0.004,
    crossSection: "diamond", ridgeHeight: 0.5,
    tipType: "spear", tipStart: 0.8, tipEndScale: 0.05, segLong: 32, segCross: 16,
  },
  guard: { shape: "bar", width: 0.18, thickness: 0.025, depth: 0.02, bevel: 0.004 },
  grip: { length: 0.14, startRadius: 0.014, endRadius: 0.012 },
  pommel: { shape: "sphere", scale: 1.5 },
};

describe("RLE 마스크 (07-phase5 §5.1)", () => {
  it("경계 패턴 왕복이 보존된다", () => {
    for (const mask of [
      new Uint8Array(16), // 전부 0
      new Uint8Array(16).fill(1), // 전부 1
      Uint8Array.from([1, 0, 1, 0, 1]), // 교대
    ]) {
      const runs = encodeMaskRLE(mask);
      expect(Array.from(decodeMaskRLE(runs, mask.length))).toEqual(Array.from(mask));
    }
  });

  it("무작위 패턴 왕복이 보존된다 (seeded)", () => {
    const rand = mulberry32(42);
    const mask = Uint8Array.from({ length: 4096 }, () => (rand() < 0.3 ? 1 : 0));
    const runs = encodeMaskRLE(mask);
    expect(Array.from(decodeMaskRLE(runs, mask.length))).toEqual(Array.from(mask));
    expect(runs.length).toBeLessThan(mask.length); // 압축이 실제로 일어난다
  });

  it("길이 불일치는 오류다", () => {
    expect(() => decodeMaskRLE([2, 3], 10)).toThrow(/길이/);
  });
});

describe("폴리곤 라소 래스터 (07-phase5 §5.1)", () => {
  it("직사각형 폴리곤이 정확한 픽셀 수를 채운다", () => {
    const mask = rasterizePolygonMask([[2, 2], [8, 2], [8, 6], [2, 6]], 10, 10);
    let count = 0;
    for (const v of mask) count += v;
    expect(count).toBe(6 * 4); // 픽셀 중심 (2.5..7.5) × (2.5..5.5)
    expect(mask[3 * 10 + 3]).toBe(1);
    expect(mask[1 * 10 + 3]).toBe(0);
  });

  it("삼각형은 절반 면적을 채운다 (±픽셀 오차)", () => {
    const mask = rasterizePolygonMask([[0, 0], [20, 0], [0, 20]], 20, 20);
    let count = 0;
    for (const v of mask) count += v;
    expect(Math.abs(count - 200)).toBeLessThan(20);
  });

  it("정점 3개 미만이면 빈 마스크", () => {
    const mask = rasterizePolygonMask([[1, 1], [5, 5]], 8, 8);
    expect(mask.every((v) => v === 0)).toBe(true);
  });
});

describe("referenceSpec (07-phase5 §5.1)", () => {
  it("manuallyConfirmed 4항목이 어노테이션 상태를 반영한다", () => {
    const landmarks = LANDMARK_NAMES.map((name, i) => ({ name, x: 5, y: i * 10 }));
    const spec = buildReferenceSpec({
      image: { width: 32, height: 64, view: "side", name: "test.png" },
      maskPolygon: [[10, 5], [20, 5], [20, 60], [10, 60]],
      landmarks,
    });
    expect(spec.manuallyConfirmed).toEqual({
      objectMask: true, bladeEndpoints: true, partBoundaries: true, camera: true,
    });
    const partial = buildReferenceSpec({
      image: { width: 32, height: 64, view: "three_quarter" },
      maskPolygon: [],
      landmarks: landmarks.slice(0, 2), // tip·root 만
    });
    expect(partial.manuallyConfirmed.objectMask).toBe(false);
    expect(partial.manuallyConfirmed.partBoundaries).toBe(false);
    expect(partial.manuallyConfirmed.camera).toBe(false); // side 가 아님 — 경고 대상
  });
});

// ── 합성 참조 이미지: 알려진 검의 투영을 "사진" 으로 위장해 왕복 검증 ────────
// 정규 마스크(y-up)를 이미지(y-down)로 뒤집고 랜드마크를 이미지 px 로 환산한다.
function makeSyntheticReference(design, size = 256) {
  const mask = projectSwordMask(design, size);
  const imageMask = new Uint8Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (getMaskBit(mask, x, y)) imageMask[(size - 1 - y) * size + x] = 1;
    }
  }
  const lm = designLandmarks(design);
  const toImage = (tn) => ({ x: size / 2, y: size - tn * size });
  const landmarks = [
    { name: "tip", ...toImage(1) },
    { name: "root", ...toImage(lm.root) },
    { name: "guardTop", ...toImage(lm.guardTop) },
    { name: "guardBottom", ...toImage(lm.guardBottom) },
    { name: "gripBottom", ...toImage(lm.gripBottom) },
  ];
  // 폴리곤 없이 직접 마스크를 넣는다 (RLE 경로는 위에서 검증)
  return {
    version: 1,
    image: { name: "synthetic", width: size, height: size, view: "side" },
    camera: { projection: "orthographic", view: "side", axisFrom: "root", axisTo: "tip" },
    objectMask: { encoding: "rle", runs: encodeMaskRLE(imageMask), width: size, height: size },
    landmarks,
    manuallyConfirmed: { objectMask: true, bladeEndpoints: true, partBoundaries: true, camera: true },
  };
}

describe("TargetSpec 생성 (07-phase5 §5.2)", () => {
  it("합성 참조 → TargetSpec 이 직접 합성본과 일치한다 (재샘플 오차 내)", () => {
    const design = makeSwordDesign(structuredClone(SWORD_PARAMS));
    const direct = synthesizeTargetSpec(design);
    const viaImage = buildTargetSpec(makeSyntheticReference(design));

    expect(silhouetteIoU(direct.mask, viaImage.mask)).toBeGreaterThan(0.95);
    for (const name of ["blade", "guard", "grip", "pommel"]) {
      expect(Math.abs(viaImage.parts[name].span - direct.parts[name].span)).toBeLessThan(0.02);
    }
    expect(viaImage.materialTargets).toEqual([]);
    expect(viaImage.hiddenStructureHypotheses[0].crossSection).toBe("diamond");
  });

  it("랜드마크가 빠지면 오류다", () => {
    const design = makeSwordDesign(structuredClone(SWORD_PARAMS));
    const ref = makeSyntheticReference(design);
    ref.landmarks = ref.landmarks.filter((l) => l.name !== "gripBottom");
    expect(() => buildTargetSpec(ref)).toThrow(/gripBottom/);
  });

  it("초기 설계가 프로파일에서 진값 근처 파라미터를 읽는다", () => {
    const truth = structuredClone(SWORD_PARAMS);
    const design = makeSwordDesign(truth);
    const target = buildTargetSpec(makeSyntheticReference(design));
    const { input } = createInitialSwordDesign(target, { bladeLength: truth.blade.length });

    // 프로파일 직접 읽기 항목 (07-phase5 §5.2) — 각 30% 이내
    const within = (got, want, tol) => Math.abs(got - want) <= want * tol;
    expect(within(input.blade.length, 0.95, 0.001)).toBe(true); // 앵커 그대로
    expect(within(input.blade.widthRoot, truth.blade.widthRoot, 0.3)).toBe(true);
    expect(within(input.blade.widthMid, truth.blade.widthMid, 0.3)).toBe(true);
    expect(within(input.guard.width, truth.guard.width, 0.3)).toBe(true);
    expect(within(input.grip.length, truth.grip.length, 0.3)).toBe(true);
    // 파생 설계가 실제로 빌드된다
    expect(() => makeSwordDesign(input)).not.toThrow();
  });
});
