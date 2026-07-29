// MaterialGraph → 베이크 입력 컴파일 (05-phase3 §3.2).
// 부품(partId)별 uniform 묶음을 만든다 — 프래그먼트 함수(channels.js)가 참조하는 유일한 입력.

import { MATERIAL_PRIMITIVES } from "./primitives.js";
import { deriveSeed } from "../core/rng.js";

const PART_NAMES = ["blade", "guard", "grip", "pommel"];

/**
 * @param {{ design, materialGraph, seed }} input
 *   design: SwordDesign (grip.wrap 등 부품 파라미터 참조)
 * @returns partId 인덱스 배열 — [{ prim, inst, state, seed, wrapMask }]
 */
export function compileSurfaceGraph({ design, materialGraph, seed }) {
  return PART_NAMES.map((name, partId) => {
    const inst = materialGraph.materials[name];
    const prim = MATERIAL_PRIMITIVES[inst.primitiveId];
    if (!prim) throw new Error(`알 수 없는 primitive: ${inst.primitiveId}`);
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
      seed: deriveSeed(seed, `${name}/${inst.primitiveId}`),
      wrapMask: wrap,
    };
  });
}
