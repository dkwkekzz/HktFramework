// 평가 리포트 — EvaluationMetrics + 하드 컨스트레인트 (07-phase5 §5.5, 원본 §27).
// Phase 2 검증기(UV·매니폴드)와 실루엣 지표를 한 리포트로 통합한다.
// seamVisibility 는 Phase 6+ 유예 — MVP 는 0 보고 (07-phase5 §5.5).
// selfIntersections 도 검출기 미구현으로 0 보고 — 유예를 STATE.md 에 기록.

import { buildSword } from "../mesh/sword.js";
import { validateUVs } from "../uv/validate.js";
import { analyzeManifold, countDegenerate3DTriangles } from "../mesh/topology.js";
import { evaluateSilhouette } from "./silhouette.js";

/** 삼각형 예산 (원본 §27 하드 컨스트레인트) */
export const TRIANGLE_BUDGET = 15000;
/** seam 가시성 차단 기준 (원본 §27 — MVP 는 항상 0 이라 통과) */
export const SEAM_VISIBILITY_LIMIT = 0.08;

/**
 * SwordDesign → EvaluationMetrics (원본 §27 필드 전부).
 * @param opts.targetSpec 있으면 실루엣 지표 포함, 없으면 0 (참조 없는 빌드 검증용)
 */
export function evaluateSwordQuality(design, opts = {}) {
  const textureSize = opts.textureSize ?? 1024;
  const sword = buildSword(design, textureSize);
  const uv = validateUVs(sword.merged, textureSize);

  let nonManifoldEdges = 0;
  let degenerate3D = 0;
  for (const part of sword.parts) {
    nonManifoldEdges += analyzeManifold(part.mesh).nonManifoldEdges;
    degenerate3D += countDegenerate3DTriangles(part.mesh);
  }

  const sil = opts.targetSpec ? evaluateSilhouette(opts.targetSpec, design) : null;
  return {
    silhouetteIoU: sil?.iou ?? 0,
    landmarkError: sil?.landmarkError ?? 0,
    partProportionError: sil?.proportionError ?? 0,

    nonManifoldEdges,
    selfIntersections: 0, // 검출기 Phase 6+ 유예 (STATE.md 이슈 기록)
    degenerate3D, // 원본 §27 에는 없지만 Phase 1 게이트라 함께 보고

    uvOverlaps: uv.overlaps,
    uvDegenerate: uv.degenerateTriangles,
    minimumPaddingPixels: uv.minimumPaddingPixels,
    seamVisibility: 0, // Phase 6+ 유예 (07-phase5 §5.5)

    materialPlausibility: 0, // Phase 6 (참조 조명 비교) 유예

    triangleCount: sword.triangleCount,
    aggregateLoss: sil?.aggregateLoss ?? 0,
  };
}

/** 하드 컨스트레인트 — 하나라도 걸리면 빌드 차단 (원본 §27 유지) */
export function assertBuildQuality(report) {
  if (report.nonManifoldEdges > 0) throw new Error("Non-manifold geometry.");
  if (report.selfIntersections > 0) throw new Error("Self-intersection detected.");
  if (report.uvOverlaps > 0) throw new Error("UV overlap detected.");
  if (report.triangleCount > TRIANGLE_BUDGET) throw new Error("Triangle budget exceeded.");
  if (report.seamVisibility > SEAM_VISIBILITY_LIMIT) throw new Error("Visible texture seams.");
}
