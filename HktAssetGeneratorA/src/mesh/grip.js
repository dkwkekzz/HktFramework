// 손잡이 생성기 — 중심 곡선 Sweep (04-phase2 §2.1, 원본 §8).
// 양 끝 캡 없음(가드/폼멜에 가려짐) — 개방 경계 = 링 2개 (기대 경계 엣지 = 2 × radialSegments).

import { lerp } from "../core/math.js";
import { createCurve3, buildArcLengthTable } from "../core/curve.js";
import { MeshBuilder } from "./builder.js";
import { PartId } from "./blade.js";

// uvMetric 1 단위 = 5cm (손 근접 부품 — 02-architecture §4)
const METRIC_UNIT = 0.05;

/** 중앙 0.8, 양 끝 0.4 — 손이 잡는 곳 (04-phase2 §2.1). */
export const evaluateGripContact = (v) => 0.4 + 0.4 * Math.sin(Math.PI * v);

/**
 * @param design {{ length, startRadius, endRadius, curvature: Curve3Spec,
 *                  wrap: {enabled,turns,width,thickness},
 *                  segments: {longitudinal, radial} }}
 * 로컬 공간: v=0 이 원점(가드 쪽), 곡선을 따라 -Y 방향으로 내려간다.
 */
export function buildGripMesh(design) {
  const builder = new MeshBuilder();
  const L = design.segments.longitudinal;
  const R = design.segments.radial;
  if (L < 4 || R < 8) throw new Error("grip segments 부족 (longitudinal ≥ 4, radial ≥ 8)");

  const curve = createCurve3(design.curvature, L);
  const arc = buildArcLengthTable(curve, L);

  for (let i = 0; i <= L; i++) {
    const v = i / L;
    const center = curve.evaluate(v);
    const frame = curve.frame(v);
    const radius = lerp(design.startRadius, design.endRadius, v);
    const contact = evaluateGripContact(v);
    for (let j = 0; j <= R; j++) {
      const u = j / R;
      const angle = u * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      builder.addVertex({
        position: [
          center[0] + frame.normal[0] * x + frame.binormal[0] * y,
          center[1] + frame.normal[1] * x + frame.binormal[1] * y,
          center[2] + frame.normal[2] * x + frame.binormal[2] * y,
        ],
        uvLocal: [u, v], // 원본 §8: U=둘레, V=길이 (칼날과 축 반대 — 원본 정의 유지)
        uvMetric: [(angle * radius) / METRIC_UNIT, arc[i] / METRIC_UNIT],
        attributes: {
          partId: PartId.Grip,
          islandId: 0,
          longitudinal: v,
          perimeter: u,
          edgeWeight: 0, ridgeWeight: 0, fullerWeight: 0,
          contactWeight: contact,
        },
        smoothingGroup: 0, // 원통 — 전체 한 그룹 (04-phase2 §2.1)
      });
    }
  }

  // 감김: 부호 부피로 확정 불가(개방 메시) — 바깥 노멀(dot(normal, radial) > 0) 테스트로 고정
  const stride = R + 1;
  for (let i = 0; i < L; i++) {
    for (let j = 0; j < R; j++) {
      const a = i * stride + j;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      builder.addTriangle(a, b, c);
      builder.addTriangle(b, d, c);
    }
  }

  builder.recalculateNormals();
  builder.calculateCurvature();
  return builder.build();
}

/** 파라미터 → GripDesign (직선 손잡이). */
export function makeStraightGripDesign(p) {
  return {
    length: p.length,
    startRadius: p.startRadius,
    endRadius: p.endRadius,
    curvature: { points: [[0, 0, 0], [0, -p.length / 2, 0], [0, -p.length, 0]] },
    wrap: p.wrap ?? { enabled: false, turns: 8, width: 0.02, thickness: 0.002 },
    segments: { longitudinal: p.segLong ?? 24, radial: p.segRadial ?? 16 },
  };
}
