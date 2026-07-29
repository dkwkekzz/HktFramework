// Phase 4 검증 — Operation 로그의 모델·재생·결정성·실측 크기 (06-phase4 §4.5)

import { describe, it, expect } from "vitest";
import swordPresets from "./golden/sword-presets.json";
import bakeHashes from "./golden/bake-hashes.json";
import agedHashes from "./golden/aged-hashes.json";
import { makeSwordDesign, buildSword } from "../src/mesh/sword.js";
import { bakeSword } from "../src/bake/bake.js";
import { rasterizeUV } from "../src/bake/raster.js";
import { makeMaterialGraph } from "../src/material/primitives.js";
import { AGED_PRESETS } from "../src/material/presets.js";
import {
  normalizeOperation, serializeOperations, parseOperations,
  replayOperations, computePartMetricBounds, sampleField, FIELD_SIZE,
} from "../src/material/operations.js";
import { sampleScratchDepth } from "../src/material/scratch.js";
import { getMask, sampleMask, MASK_IDS } from "../src/material/masks.js";

const preset = swordPresets.find((p) => p.name === "knight-arming");
const graph = makeMaterialGraph();
const SIZE = 256;
const SEED = 12345;

const sword = buildSword(preset.design, SIZE);

function bake(operations, size = SIZE, seed = SEED) {
  const s = size === SIZE ? sword : buildSword(preset.design, size);
  return bakeSword({
    merged: s.merged, design: preset.design, materialGraph: graph, seed, size, operations,
  });
}

/** 채워진 픽셀의 채널 평균 — "표면이 실제로 바뀌었는가" 의 정량 지표. */
function channelMeans(result, size = SIZE) {
  let n = 0, lum = 0, rough = 0, nz = 0;
  for (let i = 0; i < size * size; i++) {
    if (!result.coverage[i]) continue;
    n++;
    lum += result.baseColor[i * 4] + result.baseColor[i * 4 + 1] + result.baseColor[i * 4 + 2];
    rough += result.orm[i * 4 + 1];
    nz += result.normal[i * 4 + 2];
  }
  return { lum: lum / (3 * n), rough: rough / n, nz: nz / n };
}

// ── Step 4.1 — 모델·직렬화 ────────────────────────────────────────────────

describe("Operation 모델 (06 §4.1)", () => {
  it("operations.json 직렬화 왕복이 안정", () => {
    const ops = AGED_PRESETS.flatMap((p) => p.operations);
    const round = parseOperations(serializeOperations(ops));
    expect(round).toEqual(ops.map(normalizeOperation));
    // 두 번 감았다 풀어도 같다 (기본값 채움이 멱등)
    expect(parseOperations(serializeOperations(round))).toEqual(round);
  });

  it("알 수 없는 타입·부품·selector 는 거부한다", () => {
    expect(() => normalizeOperation({ type: "melt", targetPartId: 0 })).toThrow();
    expect(() => normalizeOperation({ type: "polish", targetPartId: 9 })).toThrow();
    expect(() => normalizeOperation({ type: "polish", targetPartId: 0, selector: { type: "hole" } })).toThrow();
    expect(() => normalizeOperation({ type: "polish", targetPartId: 0, selector: { type: "local_uv" } })).toThrow();
    expect(() => normalizeOperation({ type: "engrave", targetPartId: 0, maskId: "없음" })).toThrow();
  });

  it("AssignMaterialOperation 은 그래프의 물질 배정을 덮어쓴다", () => {
    const assign = [{ type: "assign_material", targetPartId: 0, primitiveId: "bronze" }];
    expect(bake(assign).hash).not.toBe(bake([]).hash);
    // 마지막 배정이 이긴다
    const twice = [...assign, { type: "assign_material", targetPartId: 0, primitiveId: "carbon_steel" }];
    expect(bake(twice).hash).toBe(bake([]).hash);
  });
});

// ── 결정성 계약 ───────────────────────────────────────────────────────────

describe("로그 결정성 (06 §4.5)", () => {
  const log = AGED_PRESETS[0].operations;

  it("빈 로그 → Phase 3 텍스처와 비트 동일 (회귀 게이트)", () => {
    expect(bake([]).hash).toBe(bakeHashes["knight-arming"].hash);
  });

  it("같은 로그 + 같은 seed → 같은 텍스처 해시", () => {
    expect(bake(log).hash).toBe(bake(log).hash);
  });

  it("로그 마지막 op 를 빼면 결과가 달라진다", () => {
    expect(bake(log.slice(0, -1)).hash).not.toBe(bake(log).hash);
  });

  it("op 순서를 바꿔도 결과가 같다 (필드 가산 + 스탬프 max 누적)", () => {
    const swapped = [log[1], log[0], ...log.slice(2)];
    expect(bake(swapped).hash).toBe(bake(log).hash);
  });

  it("중간 op 를 지워도 나머지 op 의 스탬프가 불변 (op 자신의 seed 에서 파생)", () => {
    const bounds = computePartMetricBounds(sword.merged);
    const full = replayOperations(log, { metricBounds: bounds });
    const withoutFirst = replayOperations(log.slice(1), { metricBounds: bounds });
    // log[1] 이 만든 90개 긁힘은 앞의 polish op 유무와 무관하게 같은 좌표여야 한다
    const firstScratch = full.byPart[0].scratchStamps.slice(0, 90);
    expect(withoutFirst.byPart[0].scratchStamps.slice(0, 90)).toEqual(firstScratch);
  });

  it("golden: 낡은 검 프리셋 3종", () => {
    for (const aged of AGED_PRESETS) {
      const golden = agedHashes[aged.name];
      expect(bake(aged.operations, golden.size, golden.seed).hash).toBe(golden.hash);
    }
  });
});

// ── Step 4.2 — 필드형 Operation ───────────────────────────────────────────

describe("필드형 Operation (06 §4.2)", () => {
  it("local_uv 필드는 영역 안에서만 값을 갖고 경계에서 부드럽게 떨어진다", () => {
    const { byPart } = replayOperations([{
      type: "oxidize", targetPartId: 0, strength: 1,
      selector: { type: "local_uv", bounds: { u0: 0.3, v0: 0.3, u1: 0.7, v1: 0.7 } },
    }]);
    const field = byPart[0].oxidation.field;
    expect(field).toBeInstanceOf(Float32Array);
    expect(field.length).toBe(FIELD_SIZE * FIELD_SIZE);
    expect(sampleField(field, 0.5, 0.5)).toBeCloseTo(1, 3);   // 영역 중심
    expect(sampleField(field, 0.1, 0.5)).toBe(0);             // 영역 밖
    expect(sampleField(field, 0.9, 0.9)).toBe(0);
    const boundary = sampleField(field, 0.3, 0.5);            // 경계 = falloff 중간
    expect(boundary).toBeGreaterThan(0.2);
    expect(boundary).toBeLessThan(0.8);
  });

  it("edge selector 는 필드가 아니라 스칼라로 쌓인다 (D-15)", () => {
    const { byPart } = replayOperations([
      { type: "polish", targetPartId: 0, selector: { type: "edge" }, strength: 0.4 },
      { type: "polish", targetPartId: 0, selector: { type: "ridge" }, strength: 0.25 },
    ]);
    expect(byPart[0].polish).toMatchObject({ edge: 0.4, ridge: 0.25, field: null });
  });

  it("산화 op 는 표면을 어둡게, 연마 op 는 매끄럽게 만든다", () => {
    const base = channelMeans(bake([]));
    const oxidized = channelMeans(bake([{
      type: "oxidize", targetPartId: 0, strength: 0.9,
      selector: { type: "local_uv", bounds: { u0: 0, v0: 0, u1: 1, v1: 1 } },
    }]));
    const polished = channelMeans(bake([
      { type: "polish", targetPartId: 0, selector: { type: "edge" }, strength: 0.8 },
      { type: "polish", targetPartId: 0, selector: { type: "ridge" }, strength: 0.8 },
    ]));
    expect(oxidized.lum).toBeLessThan(base.lum - 5);
    expect(oxidized.rough).toBeGreaterThan(base.rough + 3);
    expect(polished.rough).toBeLessThan(base.rough - 3);
  });

  it("물질별 반응 계수가 유지된다 — 같은 산화 강도라도 청동이 더 많이 변한다", () => {
    const ox = (partId) => ({
      type: "oxidize", targetPartId: partId, strength: 0.8,
      selector: { type: "local_uv", bounds: { u0: 0, v0: 0, u1: 1, v1: 1 } },
    });
    // 칼날(탄소강 0.55) vs 가드(청동 0.7) — 같은 op 를 각각 준 뒤 부품 영역 밝기 변화 비교
    const base = bake([]);
    const shift = (partId, region) => {
      const r = bake([ox(partId)]);
      let d = 0, n = 0;
      for (let y = region.y0; y < region.y1; y++) {
        for (let x = region.x0; x < region.x1; x++) {
          const i = y * SIZE + x;
          if (!base.coverage[i]) continue;
          d += base.baseColor[i * 4] - r.baseColor[i * 4];
          n++;
        }
      }
      return d / n;
    };
    const bladeShift = shift(0, { x0: 0, x1: SIZE, y0: Math.floor(0.63 * SIZE), y1: SIZE });
    const guardShift = shift(1, {
      x0: Math.floor(0.11 * SIZE), x1: Math.floor(0.37 * SIZE),
      y0: Math.floor(0.28 * SIZE), y1: Math.floor(0.49 * SIZE),
    });
    expect(bladeShift).toBeGreaterThan(0);
    expect(guardShift).toBeGreaterThan(bladeShift);
  });
});

// ── Step 4.3 — 긁힘 ───────────────────────────────────────────────────────

describe("긁힘 캡슐 SDF (06 §4.3, D-5·D-16)", () => {
  const spec = {
    type: "scratch", targetPartId: 0, count: 40, direction: "longitudinal",
    lengthRange: [0.5, 0.5], widthRange: [0.02, 0.02], depthRange: [0.3, 0.3], seed: 4242,
    region: { minU: 0.5, maxU: 4.0, minV: 0.1, maxV: 1.0 },
  };

  /** 칼날 표면에서 긁힘이 덮은 픽셀 수 + 아일랜드의 atlas/metric 면적비. */
  function measureScratch(bladeLength, size = 512) {
    const design = makeSwordDesign({ ...preset.params, blade: { ...preset.params.blade, length: bladeLength } });
    const s = buildSword(design, size);
    const grid = replayOperations([spec], {}).byPart[0].scratchGrid;
    const px = size * size;
    const targets = {
      color: new Float32Array(px * 4), rough: new Float32Array(px),
      metal: new Float32Array(px), ao: new Float32Array(px), height: new Float32Array(px),
    };
    let hit = 0;
    rasterizeUV(s.merged, size, (f) => {
      if (f.partId !== 0) return;
      if (sampleScratchDepth(grid, f.uvMetricU, f.uvMetricV) > 0.02) hit++;
    }, targets);
    const m = s.merged;
    let atlasArea = 0, metricArea = 0;
    for (let t = 0; t < m.indices.length; t += 3) {
      const [a, b, c] = [m.indices[t], m.indices[t + 1], m.indices[t + 2]];
      if (m.attributes.partId[a] !== 0 || m.attributes.islandId[a] !== 0) continue;
      const area = (uv) => Math.abs(
        (uv[b * 2] - uv[a * 2]) * (uv[c * 2 + 1] - uv[a * 2 + 1])
        - (uv[b * 2 + 1] - uv[a * 2 + 1]) * (uv[c * 2] - uv[a * 2])) / 2;
      atlasArea += area(m.uvAtlas);
      metricArea += area(m.uvMetric);
    }
    return { hit, density: atlasArea / metricArea };
  }

  it("실측 크기 유지 — 0.8 vs 1.6 검에서 같은 spec 의 긁힘이 metric 비율대로 찍힌다", () => {
    const small = measureScratch(0.8);
    const large = measureScratch(1.6);
    expect(small.hit).toBeGreaterThan(100);
    expect(large.hit).toBeGreaterThan(100);
    // 텍셀 밀도로 정규화하면 metric 면적이 같으므로 두 값이 일치해야 한다
    const ratio = (large.hit / large.density) / (small.hit / small.density);
    expect(ratio).toBeGreaterThan(0.85);
    expect(ratio).toBeLessThan(1.15);
  });

  it("겹침은 가장 깊은 긁힘이 이긴다 — 순서 무관", () => {
    const deep = { ...spec, count: 1, depthRange: [0.5, 0.5], seed: 11 };
    const shallow = { ...spec, count: 1, depthRange: [0.1, 0.1], seed: 11 }; // 같은 좌표
    const a = replayOperations([deep, shallow], {}).byPart[0].scratchGrid;
    const b = replayOperations([shallow, deep], {}).byPart[0].scratchGrid;
    const s = a.cells.find((c) => c)[0];
    const probe = (grid) => sampleScratchDepth(grid, (s.ax + s.bx) / 2, (s.ay + s.by) / 2);
    expect(probe(a)).toBe(probe(b));
    expect(probe(a)).toBeGreaterThan(0);
  });

  it("둘레 seam 을 넘는 캡슐은 반대편에도 한 번 더 찍힌다", () => {
    // 둘레(칼날 = metric V) 하단 경계에 걸치도록 배치
    const wrapping = {
      type: "scratch", targetPartId: 0, count: 6, direction: "perpendicular",
      lengthRange: [0.4, 0.4], widthRange: [0.02, 0.02], depthRange: [0.3, 0.3], seed: 7,
      region: { minU: 1, maxU: 3, minV: 0, maxV: 1.1 },
    };
    const stamps = replayOperations([wrapping], {}).byPart[0].scratchStamps;
    expect(stamps.length).toBeGreaterThan(wrapping.count); // 감긴 복제본이 추가됨
  });

  it("긁힘은 노멀을 눕히고 거칠기를 올린다", () => {
    const base = channelMeans(bake([]));
    const scratched = channelMeans(bake([{ ...spec, count: 200, region: undefined }]));
    expect(scratched.nz).toBeLessThan(base.nz - 2);
    expect(scratched.rough).toBeGreaterThan(base.rough);
  });
});

// ── Step 4.4 — 조각 ───────────────────────────────────────────────────────

describe("조각 마스크 (06 §4.4, D-17)", () => {
  it("프리셋 마스크는 테두리가 비어 있다 (원본 §22 borderIsEmpty)", () => {
    for (const id of MASK_IDS) {
      const mask = getMask(id);
      let border = 0;
      for (let i = 0; i < mask.size; i++) {
        border += mask.data[i] + mask.data[(mask.size - 1) * mask.size + i]
          + mask.data[i * mask.size] + mask.data[i * mask.size + mask.size - 1];
      }
      expect(border).toBe(0);
      // 그리고 실제로 무언가 그려져 있다
      expect(Math.max(...mask.data)).toBeGreaterThan(0.9);
    }
  });

  it("마스크는 같은 인자에 같은 값 (지연 생성 캐시가 결정성을 깨지 않는다)", () => {
    expect(getMask("rune-ansuz")).toBe(getMask("rune-ansuz"));
    expect(sampleMask(getMask("rune-ansuz"), 0.5, 0.5)).toBe(sampleMask(getMask("rune-ansuz"), 0.5, 0.5));
    expect(sampleMask(getMask("rune-ansuz"), -0.1, 0.5)).toBe(0); // 배치 사각형 밖
  });

  it("조각은 높이를 파고 표면을 어둡게 한다", () => {
    const base = channelMeans(bake([]));
    const engraved = channelMeans(bake([{
      type: "engrave", targetPartId: 0, maskId: "cross-bottony", depth: 0.6,
      transform: { offset: [0.5, 0.5], scale: [0.7, 0.9], rotation: 0 },
    }]));
    expect(engraved.lum).toBeLessThan(base.lum);
    expect(engraved.nz).toBeLessThan(base.nz);
  });

  it("배치 회전·오프셋이 결과를 바꾼다", () => {
    const at = (rotation, offset) => bake([{
      type: "engrave", targetPartId: 0, maskId: "rune-ansuz", depth: 0.5,
      transform: { offset, scale: [0.3, 0.3], rotation },
    }]).hash;
    const a = at(0, [0.4, 0.5]);
    expect(at(Math.PI / 3, [0.4, 0.5])).not.toBe(a);
    expect(at(0, [0.6, 0.5])).not.toBe(a);
  });
});
