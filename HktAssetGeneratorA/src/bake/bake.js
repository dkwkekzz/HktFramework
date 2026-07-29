// 베이크 오케스트레이터 (05-phase3 §3.3~3.5).
// 병합 메시 + MaterialGraph → 래스터 1회(전 채널 동시) → 높이→Normal → dilate → 패킹.
// 순수 CPU 코드 — 브라우저(Worker)와 Node(테스트) 에서 동일 결과 (D-4).

import { rasterizeUV } from "./raster.js";
import { createSwordShader } from "./channels.js";
import { compileSurfaceGraph } from "../material/compile.js";
import { heightToNormal } from "./normalmap.js";
import { dilateChannels } from "./dilate.js";
import { packBaseColor, packNormal, packORM } from "./pack.js";
import { hashArrays } from "../core/hash.js";

export const DILATE_ITERATIONS = 8;
// 높이(무단위 소값) → 노멀 경사 강도 — 시각 튜닝 상수 (결정론 영향값이라 고정 상수)
export const NORMAL_STRENGTH = 60;

/**
 * @param {{ merged, design, materialGraph, seed, size }} req
 * @returns {{ baseColor, normal, orm: Uint8Array(size²*4), size, hash }}
 */
export function bakeSword({ merged, design, materialGraph, seed, size }) {
  const px = size * size;
  const targets = {
    color: new Float32Array(px * 4),
    rough: new Float32Array(px),
    metal: new Float32Array(px),
    ao: new Float32Array(px),
    height: new Float32Array(px),
  };

  const uniforms = compileSurfaceGraph({ design, materialGraph, seed });
  const shade = createSwordShader(uniforms);
  const { coverage, island } = rasterizeUV(merged, size, shade, targets);

  const normal = heightToNormal(targets.height, size, { coverage, island }, NORMAL_STRENGTH);

  dilateChannels(
    [
      { data: targets.color, stride: 4 },
      { data: normal, stride: 4 },
      { data: targets.rough, stride: 1 },
      { data: targets.metal, stride: 1 },
      { data: targets.ao, stride: 1 },
    ],
    size, coverage, island, DILATE_ITERATIONS,
  );

  const baseColor = packBaseColor(targets.color, size);
  const normalPacked = packNormal(normal, size);
  const orm = packORM(targets.ao, targets.rough, targets.metal, size);

  return {
    baseColor,
    normal: normalPacked,
    orm,
    coverage, // 래스터 직후(팽창 전) 커버리지 — 검사·후속 단계용, 해시 대상 아님
    size,
    hash: hashArrays([baseColor, normalPacked, orm]),
  };
}
