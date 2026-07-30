// Phase 2 golden — 검 전체 회귀 게이트 (04-phase2 §2.6). D-18 곡선 검 · D-19 곡선 가드 포함.
// 해시 갱신 규약은 golden.test.js 와 동일 (`npm run golden` + 커밋 사유).

import { describe, it, expect } from "vitest";
import swordPresets from "./golden/sword-presets.json";
import swordHashes from "./golden/sword-hashes.json";
import { buildSword, hashSword } from "../src/mesh/sword.js";
import { analyzeManifold, countDegenerate3DTriangles } from "../src/mesh/topology.js";
import { validateUVs, assertValidUV } from "../src/uv/validate.js";

const TEXTURE_SIZE = 1024;

describe("golden sword presets (직선 5종 + 곡선 검 1종 D-18 + 곡선 가드 1종 D-19)", () => {
  expect(swordPresets.length).toBe(7);

  for (const preset of swordPresets) {
    it(preset.name, () => {
      const sword = buildSword(preset.design, TEXTURE_SIZE);

      for (const part of sword.parts) {
        const man = analyzeManifold(part.mesh);
        expect(man.nonManifoldEdges, part.name).toBe(0);
        expect(countDegenerate3DTriangles(part.mesh), part.name).toBe(0);
      }
      assertValidUV(validateUVs(sword.merged, TEXTURE_SIZE));
      expect(sword.triangleCount).toBeLessThanOrEqual(15000);

      expect(hashSword(sword)).toBe(swordHashes[preset.name].hash);
      expect(sword.triangleCount).toBe(swordHashes[preset.name].triangles);
    });
  }
});
