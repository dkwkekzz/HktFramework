// MaterialGraph + Operation 로그 → 베이크 입력 컴파일 (05-phase3 §3.2, 06-phase4 §4.1).
// 부품(partId)별 uniform 묶음을 만든다 — 프래그먼트 함수(channels.js)가 참조하는 유일한 입력.
// Operation 로그는 여기서 재생되어 부품별 상태 필드·스탬프로 굳는다 (베이크는 결과만 본다).

import { MATERIAL_PRIMITIVES } from "./primitives.js";
import { deriveSeed } from "../core/rng.js";
import { PART_NAMES, replayOperations } from "./operations.js";

/**
 * @param {{ design, materialGraph, seed, operations?, metricBounds? }} input
 *   design: SwordDesign (grip.wrap 등 부품 파라미터 참조)
 *   operations: MaterialOperation[] — 생략 시 materialGraph.surfaceOperations
 *   metricBounds: computePartMetricBounds 결과 (긁힘 배치 영역)
 * @returns partId 인덱스 배열 — [{ prim, inst, state, seed, wrapMask, ops }]
 */
export function compileSurfaceGraph({ design, materialGraph, seed, operations, metricBounds }) {
  const log = operations ?? materialGraph.surfaceOperations ?? [];
  const replay = replayOperations(log, { metricBounds });
  return PART_NAMES.map((name, partId) => {
    const inst = materialGraph.materials[name];
    const ops = replay.byPart[partId];
    // AssignMaterialOperation 이 있으면 그래프의 배정을 덮어쓴다 (원본 §17)
    const primitiveId = ops.material ?? inst.primitiveId;
    const prim = MATERIAL_PRIMITIVES[primitiveId];
    if (!prim) throw new Error(`알 수 없는 primitive: ${primitiveId}`);
    // 감기 재질 마스크 (원본 §8) — 손잡이만, 기하 감기와 무관하게 가죽 감기 표현
    const wrap = name === "grip" && design.grip.wrap?.enabled
      ? { turns: design.grip.wrap.turns }
      : null;
    return {
      partId,
      name,
      prim,
      inst,
      state: inst.state,
      seed: deriveSeed(seed, `${name}/${primitiveId}`),
      wrapMask: wrap,
      ops,
    };
  });
}
