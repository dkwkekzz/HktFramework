// 검 전체 오케스트레이션 — 부품 생성 → Atlas 배치 → 소켓 조립 (04-phase2).

import { buildBladeMesh, makeStraightBladeDesign } from "./blade.js";
import { buildGuardMesh, makeGuardDesign } from "./guard.js";
import { buildGripMesh, makeStraightGripDesign } from "./grip.js";
import { buildPommelMesh, makePommelDesign } from "./pommel.js";
import { assembleSword } from "./assembly.js";
import { applySwordAtlasUV, mergeForValidation } from "../uv/atlas.js";
import { hashMesh, fnv1a64 } from "../core/hash.js";

/**
 * 검 파라미터 → SwordDesign (부품 4종 설계).
 * @param p {{ blade: <makeStraightBladeDesign 입력>, guard: <makeGuardDesign 입력>,
 *             grip: <makeStraightGripDesign 입력>, pommel: <makePommelDesign 입력> }}
 */
export function makeSwordDesign(p) {
  return {
    blade: makeStraightBladeDesign(p.blade),
    guard: makeGuardDesign(p.guard),
    grip: makeStraightGripDesign(p.grip),
    pommel: makePommelDesign(p.pommel),
  };
}

/**
 * @returns {{ parts: {name,partId,mesh,transform}[], merged, triangleCount }}
 * 소켓 (04-phase2 §2.5):
 *  blade.guardSocket = 뿌리 원점 / guard.bladeSocket = 앞면 중심(로컬 원점)
 *  guard.gripSocket = 뒷면 중심 / grip.guardSocket = 위 끝(로컬 원점)
 *  grip.pommelSocket = 아래 끝 / pommel.gripSocket = 위 끝(로컬 원점)
 */
export function buildSword(design, textureSize = 1024) {
  const bladeMesh = buildBladeMesh(design.blade, textureSize);
  const guardMesh = buildGuardMesh(design.guard);
  const gripMesh = buildGripMesh(design.grip);
  const pommelMesh = buildPommelMesh(design.pommel);

  const meshes = [bladeMesh, guardMesh, gripMesh, pommelMesh];
  applySwordAtlasUV(meshes, textureSize);

  const parts = assembleSword({
    blade: { mesh: bladeMesh, sockets: { guardSocket: [0, 0, 0] } },
    guard: {
      mesh: guardMesh,
      sockets: { bladeSocket: [0, 0, 0], gripSocket: [0, -design.guard.depth, 0] },
    },
    grip: {
      mesh: gripMesh,
      sockets: { guardSocket: [0, 0, 0], pommelSocket: [0, -design.grip.length, 0] },
    },
    pommel: { mesh: pommelMesh, sockets: { gripSocket: [0, 0, 0] } },
  });

  const merged = mergeForValidation(meshes);
  const triangleCount = merged.indices.length / 3;
  return { parts, merged, triangleCount };
}

/** 검 전체 해시 — 부품 메시 해시 + 조립 Transform 을 순서 고정 연결 (02-architecture §5). */
export function hashSword(sword) {
  const text = sword.parts
    .map((p) => `${p.name}:${hashMesh(p.mesh)}:${p.transform.map((v) => v.toFixed(9)).join(",")}`)
    .join("|");
  const bytes = new TextEncoder().encode(text);
  return fnv1a64(bytes);
}
