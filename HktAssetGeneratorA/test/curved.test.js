// Phase 6 Step 6.1 검증 — 곡선 검(휨) 지원 (D-18, 08-phase6 §착수 구체화)

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildBladeMesh, makeStraightBladeDesign } from "../src/mesh/blade.js";
import { buildGripMesh, makeStraightGripDesign } from "../src/mesh/grip.js";
import { makeSwordDesign, buildSword } from "../src/mesh/sword.js";
import { analyzeManifold, countDegenerate3DTriangles, signedVolume } from "../src/mesh/topology.js";
import { hashMesh } from "../src/core/hash.js";
import { projectSwordMask, getMaskBit, evaluateSilhouette } from "../src/eval/silhouette.js";
import {
  buildTargetSpec, synthesizeTargetSpec, createInitialSwordDesign,
} from "../src/eval/targetspec.js";
import { optimizeSword } from "../src/eval/optimize.js";

const DIR = dirname(fileURLToPath(import.meta.url));

const BLADE = {
  length: 0.95, widthRoot: 0.055, widthMid: 0.048, widthTip: 0.03,
  thicknessRoot: 0.006, thicknessTip: 0.004,
  crossSection: "diamond", ridgeHeight: 0.5,
  tipType: "spear", tipStart: 0.8, tipEndScale: 0.05, segLong: 32, segCross: 16,
};
const SWORD_PARAMS = {
  blade: BLADE,
  guard: { shape: "bar", width: 0.18, thickness: 0.025, depth: 0.02, bevel: 0.004 },
  grip: { length: 0.14, startRadius: 0.014, endRadius: 0.012 },
  pommel: { shape: "sphere", scale: 1.5 },
};

describe("곡선 파라미터 하위 호환 (D-18 — golden 불변 보증)", () => {
  it("curve=0 칼날은 파라미터 생략과 비트 동일하다", () => {
    const straight = buildBladeMesh(makeStraightBladeDesign({ ...BLADE }));
    const zeroCurve = buildBladeMesh(makeStraightBladeDesign({ ...BLADE, curve: 0 }));
    expect(hashMesh(zeroCurve)).toBe(hashMesh(straight));
  });

  it("tilt=0 손잡이는 파라미터 생략과 비트 동일하고, 소켓도 기존과 같다", () => {
    const base = { length: 0.14, startRadius: 0.014, endRadius: 0.012 };
    const a = buildGripMesh(makeStraightGripDesign({ ...base }));
    const b = buildGripMesh(makeStraightGripDesign({ ...base, tilt: 0 }));
    expect(hashMesh(b)).toBe(hashMesh(a));
    const design = makeStraightGripDesign({ ...base });
    expect(design.curvature.points.at(-1)).toEqual([0, -0.14, 0]);
  });
});

describe("곡선 검 기하 (D-18)", () => {
  const curvedParams = () => {
    const p = structuredClone(SWORD_PARAMS);
    p.blade.curve = 0.018;
    p.grip.tilt = 0.025;
    return p;
  };

  it("휜 칼날도 빌드 게이트를 통과한다 (매니폴드·부피·degenerate)", () => {
    const mesh = buildBladeMesh(makeStraightBladeDesign({ ...BLADE, curve: 0.02 }));
    const man = analyzeManifold(mesh);
    expect(man.nonManifoldEdges).toBe(0);
    expect(man.boundaryEdges).toBe(0);
    expect(countDegenerate3DTriangles(mesh)).toBe(0);
    expect(signedVolume(mesh)).toBeGreaterThan(0);
  });

  it("휨의 부호가 실루엣 중심선 이탈 방향과 일치한다", () => {
    const size = 256;
    const centroidAtMid = (curve) => {
      const p = structuredClone(SWORD_PARAMS);
      p.blade.curve = curve;
      const design = makeSwordDesign(p);
      const mask = projectSwordMask(design, size);
      const target = synthesizeTargetSpec(design, size);
      // 칼날 중간 행의 무게중심 x
      const row = Math.floor((target.parts.blade.start + target.parts.blade.span * 0.5) * size);
      let sum = 0, count = 0;
      for (let x = 0; x < size; x++) {
        if (getMaskBit(mask, x, row)) { sum += x; count++; }
      }
      return sum / count - size / 2;
    };
    expect(centroidAtMid(0.02)).toBeGreaterThan(1); // +curve → +x 이탈
    expect(centroidAtMid(-0.02)).toBeLessThan(-1);
    expect(Math.abs(centroidAtMid(0))).toBeLessThan(1);
  });

  it("기울어진 손잡이의 폼멜 소켓이 곡선 끝점을 따라간다", () => {
    const sword = buildSword(makeSwordDesign(curvedParams()));
    const pommel = sword.parts.find((p) => p.name === "Pommel");
    expect(pommel.transform[0]).toBeCloseTo(0.025, 10);
  });

  it("곡선 검 전체가 검증 게이트를 통과한다", () => {
    const sword = buildSword(makeSwordDesign(curvedParams()));
    for (const part of sword.parts) {
      expect(analyzeManifold(part.mesh).nonManifoldEdges).toBe(0);
      expect(countDegenerate3DTriangles(part.mesh)).toBe(0);
    }
    expect(sword.triangleCount).toBeLessThanOrEqual(15000);
  });
});

describe("곡선 검 맞춤 (D-18 — 초기 추정 + 12차원 최적화)", () => {
  it("초기 추정이 중심선 프로파일에서 휨·기울임을 읽는다", () => {
    const truth = structuredClone(SWORD_PARAMS);
    truth.blade.curve = 0.018;
    truth.grip.tilt = 0.025;
    const target = synthesizeTargetSpec(makeSwordDesign(truth));
    const { input } = createInitialSwordDesign(target, { bladeLength: truth.blade.length });
    expect(Math.abs(input.blade.curve - 0.018)).toBeLessThan(0.008);
    expect(Math.abs(input.grip.tilt - 0.025)).toBeLessThan(0.012);
  });

  it("라운드트립: 합성 곡선 검에서 IoU ≥ 0.95 회복 (08-phase6 게이트 ③)", () => {
    const truth = structuredClone(SWORD_PARAMS);
    truth.blade.curve = 0.02;
    truth.blade.widthRoot = 0.06;
    truth.grip.tilt = 0.03;
    truth.grip.length = 0.2;
    const target = synthesizeTargetSpec(makeSwordDesign(truth));
    const { input: initial } = createInitialSwordDesign(target, { bladeLength: truth.blade.length });
    const result = optimizeSword(target, initial, { maxEvals: 150, targetIoU: 0.96, seed: 4242 });
    expect(result.iou).toBeGreaterThanOrEqual(0.95);
  });

  it("실사진 평가 1호(카타나)가 직선 결과(0.586)를 뚜렷이 넘는다 (08-phase6 게이트 ④)", () => {
    const spec = JSON.parse(
      readFileSync(join(DIR, "golden", "references", "katana-curved.referenceSpec.json"), "utf8"));
    const target = buildTargetSpec(spec);
    const { input } = createInitialSwordDesign(target, { bladeLength: 0.72 });
    const result = optimizeSword(target, input, { maxEvals: 200, targetIoU: 0.99, seed: 12345 });
    expect(result.iou).toBeGreaterThan(0.7);
  });
});
