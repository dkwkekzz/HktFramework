// Phase 2 검증 — 가드·손잡이·폼멜·조립·Atlas (04-phase2 §2.1~2.5)

import { describe, it, expect } from "vitest";
import { buildGripMesh, makeStraightGripDesign } from "../src/mesh/grip.js";
import { buildGuardMesh, makeGuardDesign, GuardIsland } from "../src/mesh/guard.js";
import { buildPommelMesh, makePommelDesign } from "../src/mesh/pommel.js";
import { makeSwordDesign, buildSword, hashSword } from "../src/mesh/sword.js";
import { triangulatePolygon, isSimplePolygon, signedArea2D } from "../src/core/earclip.js";
import { analyzeManifold, countDegenerate3DTriangles, signedVolume } from "../src/mesh/topology.js";
import { validateUVs, assertValidUV } from "../src/uv/validate.js";
import { hashMesh } from "../src/core/hash.js";

const GRIP = { length: 0.14, startRadius: 0.014, endRadius: 0.012 };
const SWORD_PARAMS = {
  blade: {
    length: 0.95, widthRoot: 0.055, widthMid: 0.048, widthTip: 0.03,
    thicknessRoot: 0.006, thicknessTip: 0.004,
    crossSection: "diamond", ridgeHeight: 0.5,
    tipType: "spear", tipStart: 0.8, tipEndScale: 0.05, segLong: 32, segCross: 16,
  },
  guard: { shape: "bar", width: 0.18, thickness: 0.025, depth: 0.02, bevel: 0.004 },
  grip: GRIP,
  pommel: { shape: "sphere", scale: 1.5 },
};

describe("earclip", () => {
  it("볼록·오목 다각형을 정확한 삼각형 수로 분할한다", () => {
    const convex = [[0, 0], [1, 0], [1, 1], [0, 1]];
    expect(triangulatePolygon(convex).length).toBe(2);
    const concave = [[0, 0], [2, 0], [2, 2], [1, 0.5], [0, 2]];
    expect(triangulatePolygon(concave).length).toBe(3);
    expect(isSimplePolygon(concave)).toBe(true);
    expect(isSimplePolygon([[0, 0], [2, 2], [2, 0], [0, 2]])).toBe(false); // 자기 교차
  });
  it("CW 입력도 처리한다", () => {
    const cw = [[0, 0], [0, 1], [1, 1], [1, 0]];
    expect(signedArea2D(cw)).toBeLessThan(0);
    expect(triangulatePolygon(cw).length).toBe(2);
  });
});

describe("grip (§2.1)", () => {
  it("개방 원통 — 경계 엣지 = 2×radial, 바깥 노멀, 결정적", () => {
    const design = makeStraightGripDesign(GRIP);
    const mesh = buildGripMesh(design);
    const man = analyzeManifold(mesh);
    expect(man.nonManifoldEdges).toBe(0);
    expect(man.boundaryEdges).toBe(2 * design.segments.radial);
    expect(countDegenerate3DTriangles(mesh)).toBe(0);
    // 바깥 노멀: dot(normal, 반경 방향) 평균 ≈ 1
    let score = 0, count = 0;
    for (let i = 0; i < mesh.positions.length / 3; i++) {
      const rx = mesh.positions[i * 3], rz = mesh.positions[i * 3 + 2];
      const len = Math.hypot(rx, rz);
      if (len < 1e-9) continue;
      score += (mesh.normals[i * 3] * rx + mesh.normals[i * 3 + 2] * rz) / len;
      count++;
    }
    expect(score / count).toBeGreaterThan(0.99);
    expect(hashMesh(mesh)).toBe(hashMesh(buildGripMesh(design)));
  });

  // 단면 확장 (세션 결정 — STATE.md): ellipse / octagon / 감기 기하
  for (const variant of [
    { crossSection: "ellipse", flatten: 0.75 },
    { crossSection: "octagon" },
    { wrapGeometry: { enabled: true, turns: 9, depth: 0.0012 } },
  ]) {
    const label = variant.crossSection ?? "circle+wrap";
    it(`${label}: 위상·경계 기대치 유지`, () => {
      const design = makeStraightGripDesign({ ...GRIP, ...variant });
      const mesh = buildGripMesh(design);
      const man = analyzeManifold(mesh);
      expect(man.nonManifoldEdges).toBe(0);
      expect(man.boundaryEdges).toBe(2 * design.segments.radial);
      expect(countDegenerate3DTriangles(mesh)).toBe(0);
    });
  }

  it("octagon 은 crease 정점 복제로 모서리 노멀이 갈라진다", () => {
    const round = buildGripMesh(makeStraightGripDesign({ ...GRIP, crossSection: "circle" }));
    const octagon = buildGripMesh(makeStraightGripDesign({ ...GRIP, crossSection: "octagon" }));
    // crease 복제만큼 정점 수 증가 (8 crease × (L+1) 링)
    expect(octagon.positions.length).toBeGreaterThan(round.positions.length);
  });
});

describe("guard (§2.2)", () => {
  for (const shape of ["bar", "tapered", "oval", "diamond"]) {
    it(`${shape}: 닫힌 솔리드, 감김 바깥, 아일랜드 3종`, () => {
      const mesh = buildGuardMesh(makeGuardDesign({
        shape, width: 0.18, thickness: 0.025, depth: 0.02, bevel: shape === "bar" ? 0.004 : 0,
      }));
      const man = analyzeManifold(mesh);
      expect(man.nonManifoldEdges).toBe(0);
      expect(man.boundaryEdges).toBe(0);
      expect(countDegenerate3DTriangles(mesh)).toBe(0);
      expect(signedVolume(mesh)).toBeGreaterThan(0);
      const islands = new Set(mesh.attributes.islandId);
      expect(islands).toEqual(new Set([GuardIsland.Front, GuardIsland.Back, GuardIsland.Side]));
    });
  }
  it("자기 교차 outline 은 거부한다", () => {
    expect(() => buildGuardMesh({
      outline: [[0, 0], [2, 2], [2, 0], [0, 2]], depth: 0.02, bevel: 0, symmetry: "bilateral",
    })).toThrow(/자기 교차/);
  });
  it("앞면은 +Y, 뒷면은 -Y 를 향한다", () => {
    const mesh = buildGuardMesh(makeGuardDesign({ shape: "oval", width: 0.15, thickness: 0.03, depth: 0.02, bevel: 0 }));
    const { islandId } = mesh.attributes;
    for (let i = 0; i < islandId.length; i++) {
      if (islandId[i] === GuardIsland.Front) expect(mesh.normals[i * 3 + 1]).toBeGreaterThan(0.9);
      if (islandId[i] === GuardIsland.Back) expect(mesh.normals[i * 3 + 1]).toBeLessThan(-0.9);
    }
  });
});

describe("pommel (§2.3)", () => {
  for (const shape of ["sphere", "disc", "teardrop", "scent-stopper"]) {
    it(`${shape}: 위만 개방(경계=radial), 폴 닫힘, degenerate 0`, () => {
      const design = makePommelDesign({ shape, scale: 1.5 });
      const mesh = buildPommelMesh(design);
      const man = analyzeManifold(mesh);
      expect(man.nonManifoldEdges).toBe(0);
      expect(man.boundaryEdges).toBe(design.radialSegments);
      expect(countDegenerate3DTriangles(mesh)).toBe(0);
    });
  }
});

describe("sword assembly + atlas (§2.4~2.6)", () => {
  const design = makeSwordDesign(SWORD_PARAMS);
  const sword = buildSword(design, 1024);

  it("소켓 체인 Transform — guard=blade 뿌리, grip=-depth, pommel=-depth-length", () => {
    const t = Object.fromEntries(sword.parts.map((p) => [p.name, p.transform]));
    expect(t.Blade).toEqual([0, 0, 0]);
    expect(t.Guard).toEqual([0, 0, 0]);
    expect(t.Grip[1]).toBeCloseTo(-0.02, 9);
    expect(t.Pommel[1]).toBeCloseTo(-0.02 - 0.14, 9);
  });

  it("병합 Atlas 가 전체 검증을 통과한다 (아일랜드 7종, overlap 0, padding ≥ 4px)", () => {
    const uv = validateUVs(sword.merged, 1024);
    assertValidUV(uv);
    const keys = new Set();
    const { partId, islandId } = sword.merged.attributes;
    for (let i = 0; i < partId.length; i++) keys.add(`${partId[i]}/${islandId[i]}`);
    expect(keys.size).toBe(7);
  });

  it("삼각형 예산 ≤ 15,000 (원본 §27)", () => {
    expect(sword.triangleCount).toBeLessThanOrEqual(15000);
  });

  it("검 전체 해시 결정성", () => {
    expect(hashSword(sword)).toBe(hashSword(buildSword(design, 1024)));
  });
});
