// Step 1.6 검증 — UV 검증기 자체의 단위 테스트 (03-phase1 §1.6, 02-architecture §6)

import { describe, it, expect } from "vitest";
import {
  detectUVTriangleOverlaps, countOutOfBoundsUVs, countDegenerateUVTriangles, assertValidUV,
} from "../src/uv/validate.js";

/** 삼각형 목록으로 최소 메시 구성 (uvAtlas 만 의미 있음) */
function meshFromUVTriangles(tris) {
  const uv = [];
  const indices = [];
  for (const tri of tris) {
    for (const p of tri) {
      indices.push(uv.length / 2);
      uv.push(p[0], p[1]);
    }
  }
  const count = uv.length / 2;
  return {
    positions: new Float32Array(count * 3),
    uvAtlas: new Float32Array(uv),
    indices: new Uint32Array(indices),
    attributes: { islandId: new Float32Array(count), partId: new Float32Array(count) },
  };
}

describe("detectUVTriangleOverlaps", () => {
  it("겹친 두 삼각형을 검출한다", () => {
    const mesh = meshFromUVTriangles([
      [[0.1, 0.1], [0.5, 0.1], [0.3, 0.5]],
      [[0.2, 0.15], [0.6, 0.15], [0.4, 0.55]],
    ]);
    expect(detectUVTriangleOverlaps(mesh, 1024)).toBe(1);
  });

  it("엣지만 공유하는(정점 미공유) 인접 삼각형은 overlap 이 아니다", () => {
    // crease 복제 상황 재현 — 같은 UV 엣지, 다른 정점 인덱스
    const mesh = meshFromUVTriangles([
      [[0.1, 0.1], [0.5, 0.1], [0.5, 0.5]],
      [[0.1, 0.1], [0.5, 0.5], [0.1, 0.5]],
    ]);
    expect(detectUVTriangleOverlaps(mesh, 1024)).toBe(0);
  });

  it("떨어진 삼각형은 overlap 0", () => {
    const mesh = meshFromUVTriangles([
      [[0.1, 0.1], [0.2, 0.1], [0.15, 0.2]],
      [[0.6, 0.6], [0.7, 0.6], [0.65, 0.7]],
    ]);
    expect(detectUVTriangleOverlaps(mesh, 1024)).toBe(0);
  });
});

describe("bounds / degenerate", () => {
  it("경계 밖 UV 를 센다", () => {
    const mesh = meshFromUVTriangles([[[0.5, 0.5], [1.2, 0.5], [0.5, -0.1]]]);
    expect(countOutOfBoundsUVs(mesh)).toBe(2);
  });

  it("면적 0 UV 삼각형을 센다", () => {
    const mesh = meshFromUVTriangles([[[0.1, 0.1], [0.5, 0.1], [0.9, 0.1]]]);
    expect(countDegenerateUVTriangles(mesh, 1024)).toBe(1);
  });
});

describe("assertValidUV", () => {
  const good = { overlaps: 0, outOfBoundsVertices: 0, degenerateTriangles: 0, minimumPaddingPixels: 10 };
  it("정상 리포트는 통과", () => {
    expect(() => assertValidUV(good)).not.toThrow();
  });
  it("차단 조건별로 throw (원본 §13)", () => {
    expect(() => assertValidUV({ ...good, overlaps: 1 })).toThrow(/overlap/);
    expect(() => assertValidUV({ ...good, outOfBoundsVertices: 1 })).toThrow(/bounds/);
    expect(() => assertValidUV({ ...good, degenerateTriangles: 1 })).toThrow(/Degenerate/);
    expect(() => assertValidUV({ ...good, minimumPaddingPixels: 2 })).toThrow(/padding/);
  });
});
