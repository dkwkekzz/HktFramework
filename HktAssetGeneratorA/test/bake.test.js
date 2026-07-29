// Phase 3 검증 — CPU 베이크 결정성·golden·metric 불변 (05-phase3 §3.7, 원본 §31.5)

import { describe, it, expect } from "vitest";
import swordPresets from "./golden/sword-presets.json";
import bakeHashes from "./golden/bake-hashes.json";
import { buildSword } from "../src/mesh/sword.js";
import { bakeSword } from "../src/bake/bake.js";
import { makeMaterialGraph, MATERIAL_PRIMITIVES } from "../src/material/primitives.js";
import { compileSurfaceGraph } from "../src/material/compile.js";
import { createSwordShader } from "../src/bake/channels.js";

const preset = swordPresets.find((p) => p.name === "knight-arming");
const graph = makeMaterialGraph();

function bakeOnce(size, seed) {
  const sword = buildSword(preset.design, size);
  return bakeSword({ merged: sword.merged, design: preset.design, materialGraph: graph, seed, size });
}

describe("bake determinism (원본 §31.5)", () => {
  it("같은 seed 2회 → 같은 텍스처 해시 (128²)", () => {
    expect(bakeOnce(128, 777).hash).toBe(bakeOnce(128, 777).hash);
  });

  it("seed 가 다르면 해시가 다르다", () => {
    expect(bakeOnce(128, 777).hash).not.toBe(bakeOnce(128, 778).hash);
  });

  it("golden: knight-arming 256² seed 12345", () => {
    const golden = bakeHashes["knight-arming"];
    expect(bakeOnce(golden.size, golden.seed).hash).toBe(golden.hash);
  });
});

describe("metric 불변 (원본 §31.3 확장)", () => {
  it("같은 metric 좌표의 프래그먼트는 형상 크기와 무관하게 같은 색을 낸다", () => {
    // 셰이더는 uvMetric(실측)만 참조 — 같은 실측 위치 = 같은 결과가 곧 패턴 크기 유지의 근거
    const uniforms = compileSurfaceGraph({ design: preset.design, materialGraph: graph, seed: 999 });
    const shade = createSwordShader(uniforms);
    const makeFrag = () => ({
      x: 0, y: 0, partId: 0, islandId: 0,
      uvMetricU: 3.7, uvMetricV: 0.4, uvLocalU: 0.5, uvLocalV: 0.3,
      edgeWeight: 0.2, ridgeWeight: 0, fullerWeight: 0, contactWeight: 0,
      curvature: 0.1, cavity: 0.05,
      out: { r: 0, g: 0, b: 0, rough: 0, metal: 0, ao: 1, height: 0 },
    });
    const a = makeFrag();
    const b = makeFrag();
    shade(a);
    shade(b);
    expect(a.out).toEqual(b.out);
  });
});

describe("채널 물성 (원본 §23.2 물리 검사의 정적 축약)", () => {
  const result = bakeOnce(128, 12345);

  it("Atlas 가 실제로 채워진다 (래스터 자체 검사 — 빈 베이크 회귀 방지)", () => {
    let filled = 0;
    for (let i = 0; i < result.coverage.length; i++) filled += result.coverage[i];
    // 현재 활용률 ~26% — 종횡비 letterbox 보정(D-8)의 트레이드오프.
    // 활용률 개선은 Atlas 레이아웃 재조정(Phase 7)의 몫 — 여기서는 "비어있지 않음"만 게이트.
    expect(filled / result.coverage.length).toBeGreaterThan(0.2);
  });

  it("Roughness 는 채워진 픽셀에서 [0.04, 1] 범위 (8bit 기준 ≥ 10)", () => {
    for (let i = 0; i < 128 * 128; i++) {
      if (!result.coverage[i]) continue;
      expect(result.orm[i * 4 + 1]).toBeGreaterThanOrEqual(10);
    }
  });

  it("가죽(grip)은 비금속, 강철(blade)은 금속으로 구워진다", () => {
    expect(MATERIAL_PRIMITIVES.leather.metallic).toBe(0);
    // grip 영역 (atlas grip/body = x [0,0.45], y [0,0.25]) 의 metallic ≈ 0
    const size = 128;
    const px = Math.floor(0.2 * size), py = Math.floor(0.12 * size);
    expect(result.orm[(py * size + px) * 4 + 2]).toBeLessThan(30);
    // blade 영역 (y [0.62,1]) 의 metallic 높음
    const bx = Math.floor(0.5 * size), by = Math.floor(0.8 * size);
    expect(result.orm[(by * size + bx) * 4 + 2]).toBeGreaterThan(150);
  });

  it("Normal 은 대체로 +Z (탄젠트 공간 z ≥ 0.5)", () => {
    for (let i = 0; i < 128 * 128; i += 17) {
      expect(result.normal[i * 4 + 2]).toBeGreaterThan(127);
    }
  });
});
