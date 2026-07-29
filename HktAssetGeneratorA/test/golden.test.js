// Step 1.8 — golden 20종 회귀 게이트 (03-phase1 §1.8).
// 해시가 어긋나면: 의도한 알고리즘 변경이면 `npm run golden` 으로 갱신 + 커밋에 사유 명시,
// 아니면 비결정성/회귀 버그다 (02-architecture §5).

import { describe, it, expect } from "vitest";
import presets from "./golden/blade-presets.json";
import hashes from "./golden/blade-hashes.json";
import { buildBladeMesh } from "../src/mesh/blade.js";
import { hashMesh } from "../src/core/hash.js";
import { analyzeManifold, countDegenerate3DTriangles, signedVolume } from "../src/mesh/topology.js";
import { validateUVs, assertValidUV } from "../src/uv/validate.js";

const TEXTURE_SIZE = 1024;

describe("golden blade presets (20종)", () => {
  expect(presets.length).toBe(20);

  for (const preset of presets) {
    it(preset.name, () => {
      const mesh = buildBladeMesh(preset.design, TEXTURE_SIZE);

      // 위상 (03-phase1 완료 조건)
      const man = analyzeManifold(mesh);
      expect(man.nonManifoldEdges).toBe(0);
      expect(man.boundaryEdges).toBe(0);
      expect(countDegenerate3DTriangles(mesh)).toBe(0);
      expect(signedVolume(mesh)).toBeGreaterThan(0);

      // UV (원본 §13 차단 조건)
      assertValidUV(validateUVs(mesh, TEXTURE_SIZE));

      // 예산
      expect(mesh.indices.length / 3).toBeLessThanOrEqual(5000);

      // 결정성 회귀
      expect(hashMesh(mesh)).toBe(hashes[preset.name].hash);
      expect(mesh.indices.length / 3).toBe(hashes[preset.name].triangles);
    });
  }
});
