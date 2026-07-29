// Step 1.4~1.5 검증 — 칼날 위상·결정성·정점 수·Metric UV (03-phase1 §1.4, §1.5, 원본 §31.1~31.3)

import { describe, it, expect } from "vitest";
import {
  buildBladeMesh, makeStraightBladeDesign, buildCrossSectionProfile, makeExpansionLayout,
} from "../src/mesh/blade.js";
import { analyzeManifold, countDegenerate3DTriangles, signedVolume } from "../src/mesh/topology.js";
import { hashMesh, hashArrays } from "../src/core/hash.js";

const BASE = {
  length: 1.0, widthRoot: 0.06, widthMid: 0.05, widthTip: 0.03,
  thicknessRoot: 0.008, thicknessTip: 0.005,
  ridgeHeight: 0.4, tipType: "spear", tipStart: 0.8, tipEndScale: 0.05,
  segLong: 32, segCross: 16,
};

const VARIANTS = [
  { crossSection: "diamond" },
  { crossSection: "lenticular" },
  { crossSection: "hexagonal" },
  { crossSection: "flat" },
  { crossSection: "diamond", fuller: { enabled: true, start: 0.05, end: 0.6, width: 0.02, depth: 0.004 } },
];

describe("blade topology", () => {
  for (const variant of VARIANTS) {
    const label = variant.crossSection + (variant.fuller ? "+fuller" : "");
    it(`${label}: 닫힌 매니폴드, degenerate 0, 감김 바깥(부피>0)`, () => {
      const mesh = buildBladeMesh(makeStraightBladeDesign({ ...BASE, ...variant }));
      const man = analyzeManifold(mesh);
      expect(man.nonManifoldEdges).toBe(0);
      expect(man.boundaryEdges).toBe(0); // 캡+폴로 완전히 닫힘 (03-phase1 §1.4)
      expect(countDegenerate3DTriangles(mesh)).toBe(0);
      expect(signedVolume(mesh)).toBeGreaterThan(0);
    });
  }
});

describe("blade determinism (원본 §31.1~31.2)", () => {
  it("같은 입력 → 같은 메시 해시", () => {
    const design = makeStraightBladeDesign({ ...BASE, crossSection: "diamond" });
    expect(hashMesh(buildBladeMesh(design))).toBe(hashMesh(buildBladeMesh(design)));
  });

  it("같은 입력 → 같은 uvLocal", () => {
    const design = makeStraightBladeDesign({ ...BASE, crossSection: "hexagonal" });
    const a = buildBladeMesh(design);
    const b = buildBladeMesh(design);
    expect(hashArrays([a.uvLocal])).toBe(hashArrays([b.uvLocal]));
  });
});

describe("blade vertex count (03-phase1 §1.4 검증 항목)", () => {
  it("정점 수 = ringCount × stride + 폴(n) + 캡(n+1)", () => {
    const design = makeStraightBladeDesign({ ...BASE, crossSection: "diamond" });
    const mesh = buildBladeMesh(design);
    const n = BASE.segCross;
    const profile = buildCrossSectionProfile("diamond", 0.06, 0.008, BASE.ridgeHeight, null, n);
    const { stride } = makeExpansionLayout(profile.map((p) => p.crease));
    const expected = BASE.segLong * stride + n + (n + 1);
    expect(mesh.positions.length / 3).toBe(expected);
  });
});

describe("metric UV (원본 §31.3)", () => {
  // 길이 방향 metric 밀도: 인접 링 간 uvMetric.u 증가량 / 실거리 = 1/0.1 = 10 (형상 크기 무관)
  function metricScaleAlongLength(mesh) {
    const { longitudinal, perimeter, islandId } = mesh.attributes;
    const rows = [];
    for (let i = 0; i < longitudinal.length; i++) {
      if (islandId[i] === 0 && perimeter[i] === 0) rows.push(i);
    }
    rows.sort((a, b) => longitudinal[a] - longitudinal[b]);
    const [i1, i2] = [rows[5], rows[6]];
    const du = mesh.uvMetric[i2 * 2] - mesh.uvMetric[i1 * 2];
    const dist = Math.hypot(
      mesh.positions[i2 * 3] - mesh.positions[i1 * 3],
      mesh.positions[i2 * 3 + 1] - mesh.positions[i1 * 3 + 1],
      mesh.positions[i2 * 3 + 2] - mesh.positions[i1 * 3 + 2],
    );
    return du / dist;
  }

  it("칼날 길이가 변해도 metric 패턴 스케일 유지", () => {
    const short = buildBladeMesh(makeStraightBladeDesign({ ...BASE, crossSection: "diamond", length: 0.8 }));
    const long = buildBladeMesh(makeStraightBladeDesign({ ...BASE, crossSection: "diamond", length: 1.6 }));
    const shortScale = metricScaleAlongLength(short);
    const longScale = metricScaleAlongLength(long);
    expect(shortScale).toBeCloseTo(longScale, 3);
    expect(shortScale).toBeCloseTo(10, 1); // 1 단위 = 10cm
  });
});
