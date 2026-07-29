// Step 1.2 검증 — 스무딩 그룹 노멀·탄젠트 (03-phase1 §1.2)

import { describe, it, expect } from "vitest";
import { MeshBuilder } from "../src/mesh/builder.js";

const attrs = { partId: 0, islandId: 0, longitudinal: 0, perimeter: 0, edgeWeight: 0, ridgeWeight: 0, fullerWeight: 0, contactWeight: 0 };

function addQuad(builder, positions, uvs, group) {
  const idx = positions.map((p, i) =>
    builder.addVertex({ position: p, uvLocal: uvs[i], uvMetric: uvs[i], attributes: attrs, smoothingGroup: group }));
  builder.addTriangle(idx[0], idx[1], idx[2]);
  builder.addTriangle(idx[0], idx[2], idx[3]);
  return idx;
}

describe("MeshBuilder", () => {
  it("단위 사각형의 노멀은 +Z, 탄젠트는 +X(U 증가 방향)", () => {
    const builder = new MeshBuilder();
    addQuad(builder,
      [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]],
      [[0, 0], [1, 0], [1, 1], [0, 1]], 0);
    const mesh = builder.build();
    for (let i = 0; i < 4; i++) {
      expect(mesh.normals[i * 3 + 2]).toBeCloseTo(1, 5);
      expect(mesh.tangents[i * 4]).toBeCloseTo(1, 5); // dP/du = +X
    }
  });

  it("같은 위치·다른 그룹(crease)은 노멀이 갈라지고, 같은 그룹(seam)은 이어진다", () => {
    // ㄱ자 두 면: 바닥(+Z 노멀)과 벽(+X→ -X 방향 노멀). 접합선 정점을 복제.
    const builder = new MeshBuilder();
    addQuad(builder,
      [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]],
      [[0, 0], [1, 0], [1, 1], [0, 1]], 0);
    // 벽: 같은 접합선 위치를 그룹 1 로 복제
    addQuad(builder,
      [[0, 1, 0], [1, 1, 0], [1, 1, 1], [0, 1, 1]],
      [[0, 1], [1, 1], [1, 2], [0, 2]], 1);
    const mesh = builder.build();
    // 바닥 접합선 정점(2,3)은 순수 +Z, 벽 접합선 정점(4,5)은 순수 -Y 방향(벽 면 노멀)
    expect(mesh.normals[2 * 3 + 2]).toBeCloseTo(1, 5);
    expect(Math.abs(mesh.normals[4 * 3 + 2])).toBeLessThan(1e-5);

    // 같은 실험을 동일 그룹으로 — 접합선 노멀이 평균(이어짐)
    const welded = new MeshBuilder();
    addQuad(welded,
      [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]],
      [[0, 0], [1, 0], [1, 1], [0, 1]], 0);
    addQuad(welded,
      [[0, 1, 0], [1, 1, 0], [1, 1, 1], [0, 1, 1]],
      [[0, 1], [1, 1], [1, 2], [0, 2]], 0);
    const weldedMesh = welded.build();
    // 접합선의 두 복제 정점 노멀이 동일 (공유)
    for (let k = 0; k < 3; k++) {
      expect(weldedMesh.normals[2 * 3 + k]).toBeCloseTo(weldedMesh.normals[5 * 3 + k], 5);
    }
    // 그리고 순수 축 방향이 아니다 (평균됨)
    expect(Math.abs(weldedMesh.normals[2 * 3 + 2])).toBeLessThan(0.999);
  });
});
