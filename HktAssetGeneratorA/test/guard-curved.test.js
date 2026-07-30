// Phase 6 검증 — 곡선 가드(휨·끝 벌어짐) 지원 (D-19)

import { describe, it, expect } from "vitest";
import { buildGuardMesh, makeGuardDesign, makeGuardOutline, GuardIsland } from "../src/mesh/guard.js";
import { makeSwordDesign, buildSword, buildSwordParts } from "../src/mesh/sword.js";
import { analyzeManifold, countDegenerate3DTriangles, signedVolume } from "../src/mesh/topology.js";
import { validateUVs } from "../src/uv/validate.js";
import { hashMesh } from "../src/core/hash.js";
import { projectSwordMask, silhouetteIoU } from "../src/eval/silhouette.js";
import { synthesizeTargetSpec } from "../src/eval/targetspec.js";
import { optimizeSword } from "../src/eval/optimize.js";
import { OPT_PARAM_DEFS, inputToVector, vectorToInput } from "../src/eval/paramspace.js";

const GUARD = { shape: "bar", width: 0.18, thickness: 0.025, depth: 0.02, bevel: 0.004 };
const SWORD_PARAMS = {
  blade: {
    length: 0.95, widthRoot: 0.055, widthMid: 0.048, widthTip: 0.03,
    thicknessRoot: 0.006, thicknessTip: 0.004,
    crossSection: "diamond", ridgeHeight: 0.5,
    tipType: "spear", tipStart: 0.8, tipEndScale: 0.05, segLong: 32, segCross: 16,
  },
  guard: { ...GUARD },
  grip: { length: 0.14, startRadius: 0.014, endRadius: 0.012 },
  pommel: { shape: "sphere", scale: 1.5 },
};
const METRIC_UNIT = 0.1; // guard.js 와 같은 규약 (1 UV 단위 = 10cm)

/** 아일랜드별 정점 인덱스 */
const islandVertices = (mesh, island) => {
  const out = [];
  for (let i = 0; i < mesh.attributes.islandId.length; i++) {
    if (mesh.attributes.islandId[i] === island) out.push(i);
  }
  return out;
};
const posOf = (mesh, i) => [mesh.positions[i * 3], mesh.positions[i * 3 + 1], mesh.positions[i * 3 + 2]];

describe("곡선 가드 하위 호환 (D-19 — golden 불변 보증)", () => {
  it("droop=0·endFlare=1 은 파라미터 생략과 비트 동일하다", () => {
    const base = buildGuardMesh(makeGuardDesign({ ...GUARD }));
    const explicit = buildGuardMesh(makeGuardDesign({ ...GUARD, droop: 0, endFlare: 1 }));
    expect(hashMesh(explicit)).toBe(hashMesh(base));
  });

  it("윤곽 4종 전부 하위 호환이다", () => {
    for (const shape of ["bar", "tapered", "oval", "diamond"]) {
      const p = { ...GUARD, shape };
      expect(hashMesh(buildGuardMesh(makeGuardDesign({ ...p, droop: 0, endFlare: 1 }))))
        .toBe(hashMesh(buildGuardMesh(makeGuardDesign(p))));
    }
  });

  it("droop 은 검 전체 해시를 바꾸고 소켓 Transform 은 바꾸지 않는다", () => {
    const straight = buildSwordParts(makeSwordDesign(SWORD_PARAMS));
    const drooped = buildSwordParts(makeSwordDesign({
      ...SWORD_PARAMS, guard: { ...GUARD, droop: 0.02 },
    }));
    const guardA = straight.parts.find((p) => p.name === "Guard");
    const guardB = drooped.parts.find((p) => p.name === "Guard");
    expect(hashMesh(guardB.mesh)).not.toBe(hashMesh(guardA.mesh));
    // 중앙 접합부 고정 → 조립 Transform 전부 불변 (D-19 ①)
    for (const name of ["Blade", "Guard", "Grip", "Pommel"]) {
      const a = straight.parts.find((p) => p.name === name).transform;
      const b = drooped.parts.find((p) => p.name === name).transform;
      expect(b).toEqual(a);
    }
  });
});

describe("곡선 가드 기하 (D-19)", () => {
  it("휜 가드도 빌드 게이트를 통과한다 (매니폴드·닫힘·부피·degenerate)", () => {
    for (const shape of ["bar", "tapered", "oval", "diamond"]) {
      const mesh = buildGuardMesh(makeGuardDesign({
        ...GUARD, shape, droop: 0.025, endFlare: 1.8,
      }));
      const man = analyzeManifold(mesh);
      expect(man.nonManifoldEdges, shape).toBe(0);
      expect(man.boundaryEdges, shape).toBe(0); // 가드는 닫힌 솔리드
      expect(countDegenerate3DTriangles(mesh), shape).toBe(0);
      expect(signedVolume(mesh), shape).toBeGreaterThan(0);
    }
  });

  it("중앙은 고정되고 quillon 끝이 droop 만큼 축 방향으로 옮겨진다", () => {
    const droop = 0.02;
    // 정규 반폭 w 는 원본 윤곽 기준 — bevel inset 링은 그만큼 덜 휜다 (bevel 0 으로 분리 검사)
    const w = Math.max(...makeGuardOutline("bar", GUARD.width, GUARD.thickness)
      .map(([x]) => Math.abs(x)));
    const mesh = buildGuardMesh(makeGuardDesign({ ...GUARD, bevel: 0, droop }));
    const front = islandVertices(mesh, GuardIsland.Front);
    for (const i of front) {
      const [x, y] = posOf(mesh, i);
      const expected = droop * (Math.abs(x) / w) ** 2;
      expect(y).toBeCloseTo(expected, 8); // 앞면 기준 y=0, 위치는 Float32 저장
    }
    // 중앙(x≈0) 정점은 이동 없음 → 칼날 접합면 불변
    const centre = front.filter((i) => Math.abs(posOf(mesh, i)[0]) < 1e-9);
    for (const i of centre) expect(posOf(mesh, i)[1]).toBe(0);
  });

  it("휨이 평행이동이 아니다 — 윤곽 세분으로 2차 곡선이 실제로 나온다", () => {
    // 회귀 방지: 세분 전에는 bar 윤곽의 x 정점이 양 끝뿐이라 가드가 통째로 밀려 올라갔고
    // tapered 는 중앙이 V 로 꺾였다 (D-19 세분 도입 사유).
    const droop = 0.02;
    for (const shape of ["bar", "tapered", "oval", "diamond"]) {
      const mesh = buildGuardMesh(makeGuardDesign({ ...GUARD, shape, bevel: 0, droop }));
      const front = islandVertices(mesh, GuardIsland.Front);
      const w = Math.max(...front.map((i) => Math.abs(posOf(mesh, i)[0])));
      // 중간 지점(|x| ≈ w/2)의 변위가 끝 변위의 1/4 근처 = 2차 곡선의 서명
      const mid = front.filter((i) => Math.abs(Math.abs(posOf(mesh, i)[0]) - w / 2) < w / 24);
      expect(mid.length, `${shape}: |x|≈w/2 정점이 있어야 한다 (세분 확인)`).toBeGreaterThan(0);
      for (const i of mid) {
        const [x, y] = posOf(mesh, i);
        expect(y / droop, shape).toBeCloseTo((Math.abs(x) / w) ** 2, 3);
        expect(y, shape).toBeLessThan(droop * 0.35); // 평행이동이면 droop 에 가까웠을 값
      }
    }
  });

  it("endFlare 는 끝 두께만 키우고 폭·축 위치는 건드리지 않는다", () => {
    const plain = buildGuardMesh(makeGuardDesign({ ...GUARD, shape: "bar", bevel: 0 }));
    const flared = buildGuardMesh(makeGuardDesign({ ...GUARD, shape: "bar", bevel: 0, endFlare: 2 }));
    const maxAbs = (mesh, k) => Math.max(...islandVertices(mesh, GuardIsland.Front)
      .map((i) => Math.abs(posOf(mesh, i)[k])));
    expect(maxAbs(flared, 0)).toBeCloseTo(maxAbs(plain, 0), 12); // 폭 x 불변
    expect(maxAbs(flared, 1)).toBeCloseTo(maxAbs(plain, 1), 12); // 축 y 불변 (droop 0)
    // 끝(|x| = w)의 두께 z 가 2배 — 중앙은 그대로
    const w = maxAbs(plain, 0);
    const endZ = (mesh) => Math.max(...islandVertices(mesh, GuardIsland.Front)
      .filter((i) => Math.abs(Math.abs(posOf(mesh, i)[0]) - w) < 1e-9)
      .map((i) => Math.abs(posOf(mesh, i)[2])));
    expect(endZ(flared)).toBeCloseTo(endZ(plain) * 2, 9);
  });

  it("검 전체가 UV 검증 게이트를 통과한다 (overlap 0 · padding 유지)", () => {
    const sword = buildSword(makeSwordDesign({
      ...SWORD_PARAMS, guard: { ...GUARD, droop: 0.022, endFlare: 1.6 },
    }), 1024);
    const uv = validateUVs(sword.merged, 1024);
    expect(uv.overlaps).toBe(0);
    expect(uv.outOfBoundsVertices).toBe(0);
    expect(uv.degenerateTriangles).toBe(0);
    expect(uv.minimumPaddingPixels).toBeGreaterThanOrEqual(4);
    expect(sword.triangleCount).toBeLessThanOrEqual(15000);
  });
});

describe("곡선 가드 uvMetric 보정 (D-19 ③ — 1단위 = 10cm 계약)", () => {
  /** 독립 구현: 변위 경로 x ↦ (x, droop·(x/w)²) 의 [0,x] 호길이 (고밀도 적분) */
  const arcLength = (x, w, droop, samples = 4096) => {
    const dy = (t) => droop * (t / w) ** 2;
    let len = 0;
    for (let i = 1; i <= samples; i++) {
      const a = (x * (i - 1)) / samples;
      const b = (x * i) / samples;
      len += Math.hypot(b - a, dy(b) - dy(a));
    }
    return len;
  };

  it("앞면 uvMetric u 가 기하 x 가 아니라 변위 경로 호길이를 따른다", () => {
    const droop = 0.03;
    const outline = makeGuardOutline("bar", GUARD.width, GUARD.thickness);
    const w = Math.max(...outline.map(([x]) => Math.abs(x)));
    const mesh = buildGuardMesh(makeGuardDesign({ ...GUARD, bevel: 0, droop }));
    const front = islandVertices(mesh, GuardIsland.Front);
    let checked = 0;
    for (const i of front) {
      const [x] = posOf(mesh, i);
      const metricU = mesh.uvMetric[i * 2] * METRIC_UNIT;
      const expected = Math.sign(x) * arcLength(Math.abs(x), w, droop);
      expect(metricU).toBeCloseTo(expected, 5);
      if (Math.abs(x) > w * 0.9) {
        expect(Math.abs(metricU)).toBeGreaterThan(Math.abs(x)); // 늘어난 만큼 커진다
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("측면 uvMetric u 가 변위된 3D 둘레를 따른다", () => {
    const droop = 0.03, endFlare = 1.5;
    const outline = makeGuardOutline("bar", GUARD.width, GUARD.thickness);
    const w = Math.max(...outline.map(([x]) => Math.abs(x)));
    const place = ([x, z]) => [
      x, droop * (Math.abs(x) / w) ** 2, z * (1 + (endFlare - 1) * (Math.abs(x) / w) ** 2),
    ];
    // 독립 기준: 변위된 경계 곡선을 변마다 고밀도 샘플 → 참 호길이 (수렴값)
    const trueLen = (() => {
      const SAMPLES = 4000;
      let len = 0;
      for (let i = 0; i < outline.length; i++) {
        const a = outline[i], b = outline[(i + 1) % outline.length];
        let prev = place(a);
        for (let k = 1; k <= SAMPLES; k++) {
          const t = k / SAMPLES;
          const cur = place([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
          len += Math.hypot(cur[0] - prev[0], cur[1] - prev[1], cur[2] - prev[2]);
          prev = cur;
        }
      }
      return len;
    })();
    const flatPerim = outline.reduce((sum, a, i) => {
      const b = outline[(i + 1) % outline.length];
      return sum + Math.hypot(b[0] - a[0], b[1] - a[1]);
    }, 0);

    const mesh = buildGuardMesh(makeGuardDesign({ ...GUARD, bevel: 0, droop, endFlare }));
    const side = islandVertices(mesh, GuardIsland.Side);
    const maxU = Math.max(...side.map((i) => mesh.uvMetric[i * 2])) * METRIC_UNIT;
    // 변위로 늘어난 만큼 커지고(직선 둘레 초과), 세분 다각형이라 참 호길이 이하로 수렴
    expect(maxU).toBeGreaterThan(flatPerim);
    expect(maxU).toBeLessThanOrEqual(trueLen * (1 + 1e-6));
    expect(Math.abs(maxU / trueLen - 1)).toBeLessThan(1e-3);

  });
});

describe("곡선 가드 맞춤 (D-19 ④ — 13차원 최적화)", () => {
  it("최적화 벡터가 13차원이고 앞 12차원 인덱스가 불변이다", () => {
    expect(OPT_PARAM_DEFS.length).toBe(13);
    expect(OPT_PARAM_DEFS.map((d) => d.key).slice(0, 13)).toEqual([
      "bladeLength", "bladeWidthRoot", "bladeWidthMiddle", "bladeWidthTip",
      "bladeThicknessRoot", "bladeThicknessTip", "taperStart", "tipEndScale",
      "guardWidth", "gripLength", "bladeCurve", "gripTilt", "guardDroop",
    ]);
  });

  it("guardDroop 이 벡터 왕복에서 보존된다", () => {
    const input = structuredClone(SWORD_PARAMS);
    input.guard.droop = 0.018;
    const back = vectorToInput(input, inputToVector(input));
    expect(back.guard.droop).toBeCloseTo(0.018, 9);
  });

  it("휨이 side 실루엣을 바꾼다 — 최적화가 볼 수 있다", () => {
    const straight = projectSwordMask(makeSwordDesign(SWORD_PARAMS), 256);
    const drooped = projectSwordMask(makeSwordDesign({
      ...SWORD_PARAMS, guard: { ...GUARD, droop: 0.025 },
    }), 256);
    expect(silhouetteIoU(straight, drooped)).toBeLessThan(0.99);
  });

  it("endFlare 는 side 실루엣에 나타나지 않는다 — 최적화 제외의 근거", () => {
    const plain = projectSwordMask(makeSwordDesign(SWORD_PARAMS), 256);
    const flared = projectSwordMask(makeSwordDesign({
      ...SWORD_PARAMS, guard: { ...GUARD, endFlare: 2.2 },
    }), 256);
    expect(silhouetteIoU(plain, flared)).toBe(1);
  });

  it("라운드트립: 합성 곡선 가드 검에서 IoU ≥ 0.95 회복", () => {
    const truth = structuredClone(SWORD_PARAMS);
    truth.guard.droop = 0.022;
    truth.guard.width = 0.22;
    const target = synthesizeTargetSpec(makeSwordDesign(truth));
    const initial = structuredClone(SWORD_PARAMS);
    const result = optimizeSword(target, initial, { maxEvals: 200, targetIoU: 0.97, seed: 909 });
    expect(result.iou).toBeGreaterThanOrEqual(0.95);
  });
});
