// 손잡이 생성기 — 중심 곡선 Sweep (04-phase2 §2.1 + 단면 확장).
// 단면: circle / ellipse / octagon — 칼날과 같은 "닫힌 프로파일 + crease + 전개 레이아웃"
// 기계를 재사용한다 (원형은 그 특수 경우일 뿐 — 세션 결정, STATE.md 참조).
// 양 끝 캡 없음(가드/폼멜에 가려짐) — 개방 경계 = 링 2개 (기대 경계 엣지 = 2 × radialSegments).

import { lerp, clamp01 } from "../core/math.js";
import { createCurve3, buildArcLengthTable, evaluateCurve1 } from "../core/curve.js";
import { MeshBuilder } from "./builder.js";
import { PartId, makeExpansionLayout } from "./blade.js";

// uvMetric 1 단위 = 5cm (손 근접 부품 — 02-architecture §4)
const METRIC_UNIT = 0.05;

/** 중앙 0.8, 양 끝 0.4 — 손이 잡는 곳 (04-phase2 §2.1). */
export const evaluateGripContact = (v) => 0.4 + 0.4 * Math.sin(Math.PI * v);

/**
 * 감기 골 패턴 [0,1] — 재질 마스크(원본 §8)와 기하 변위가 같은 함수를 공유한다.
 * t = fract(v×turns + u) 의 삼각파를 좁힌 골.
 */
export function wrapGroove(u, v, turns) {
  const t = (v * turns + u) % 1;
  const tw = 1 - Math.abs(2 * t - 1);
  // 좁은 골: 삼각파 꼭대기 부근만
  const g = (tw - 0.7) / 0.3;
  const c = clamp01(g);
  return c * c * (3 - 2 * c);
}

/** 단면 프로파일 — {x, y, crease}[] 닫힌 CCW 루프, s=0 seam. 반지름 1 기준(호출자가 스케일). */
function buildGripProfile(crossSection, flatten, n) {
  if (n < 8 || n % 8 !== 0) {
    throw new Error(`grip segments.radial 은 8 이상, 8의 배수여야 한다: ${n}`);
  }
  const points = [];
  if (crossSection === "circle" || crossSection === "ellipse") {
    const fl = crossSection === "ellipse" ? flatten : 1;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      points.push({ x: Math.cos(a), y: Math.sin(a) * fl, crease: false });
    }
  } else if (crossSection === "octagon") {
    // 8각 — 꼭짓점 crease, 변마다 n/8 샘플. flatten 은 y 축 납작.
    const per = n / 8;
    for (let k = 0; k < 8; k++) {
      const a0 = (k / 8) * Math.PI * 2;
      const a1 = ((k + 1) / 8) * Math.PI * 2;
      const v0 = [Math.cos(a0), Math.sin(a0) * flatten];
      const v1 = [Math.cos(a1), Math.sin(a1) * flatten];
      for (let j = 0; j < per; j++) {
        const f = j / per;
        points.push({ x: lerp(v0[0], v1[0], f), y: lerp(v0[1], v1[1], f), crease: j === 0 });
      }
    }
  } else {
    throw new Error(`알 수 없는 grip 단면: ${crossSection}`);
  }
  return points;
}

/** s=0 부터 각 점까지 둘레 누적 거리 (+전체 둘레) — 변위 전 프로파일 기준. */
function profileDistances(points, scale) {
  const n = points.length;
  const dist = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) {
    const a = points[i];
    const b = points[(i + 1) % n];
    dist[i + 1] = dist[i] + Math.hypot(b.x - a.x, b.y - a.y) * scale;
  }
  return dist;
}

/**
 * @param design {{ length, startRadius, endRadius, radiusCurve?: Curve1Spec,
 *                  crossSection: "circle"|"ellipse"|"octagon", flatten: number,
 *                  curvature: Curve3Spec,
 *                  wrap: {enabled,turns,width,thickness},          // 재질 마스크용 (Phase 3)
 *                  wrapGeometry: {enabled,turns,depth},            // 기하 변위 (선택)
 *                  segments: {longitudinal, radial} }}
 * 로컬 공간: v=0 이 원점(가드 쪽), 곡선을 따라 -Y 방향으로 내려간다.
 */
export function buildGripMesh(design) {
  const builder = new MeshBuilder();
  const L = design.segments.longitudinal;
  const R = design.segments.radial;
  if (L < 4) throw new Error("grip segments.longitudinal ≥ 4");

  const curve = createCurve3(design.curvature, L);
  const arc = buildArcLengthTable(curve, L);

  const profile = buildGripProfile(design.crossSection ?? "circle", design.flatten ?? 1, R);
  const layout = makeExpansionLayout(profile.map((p) => p.crease));
  const { slots, out, into, stride } = layout;

  const wrapGeom = design.wrapGeometry?.enabled ? design.wrapGeometry : null;

  const radiusAt = (v) =>
    design.radiusCurve
      ? evaluateCurve1(design.radiusCurve, v)
      : lerp(design.startRadius, design.endRadius, v);

  for (let i = 0; i <= L; i++) {
    const v = i / L;
    const center = curve.evaluate(v);
    const frame = curve.frame(v);
    const radius = radiusAt(v);
    const dist = profileDistances(profile, radius);
    const contact = evaluateGripContact(v);

    for (const slot of slots) {
      const p = profile[slot.profileIndex];
      const u = slot.s;
      // 감기 기하 변위 — 반경 방향 축소 (토폴로지·UV 불변)
      let px = p.x * radius;
      let py = p.y * radius;
      if (wrapGeom) {
        const len = Math.hypot(px, py) || 1;
        const scale = Math.max(0.5, 1 - (wrapGeom.depth * wrapGroove(u, v, wrapGeom.turns)) / len);
        px *= scale; py *= scale;
      }
      const metricPerimeter = u === 1 ? dist[R] : dist[slot.profileIndex];
      builder.addVertex({
        position: [
          center[0] + frame.normal[0] * px + frame.binormal[0] * py,
          center[1] + frame.normal[1] * px + frame.binormal[1] * py,
          center[2] + frame.normal[2] * px + frame.binormal[2] * py,
        ],
        uvLocal: [u, v], // 원본 §8: U=둘레, V=길이 (칼날과 축 반대 — 원본 정의 유지)
        uvMetric: [metricPerimeter / METRIC_UNIT, arc[i] / METRIC_UNIT],
        attributes: {
          partId: PartId.Grip,
          islandId: 0,
          longitudinal: v,
          perimeter: u,
          edgeWeight: 0, ridgeWeight: 0, fullerWeight: 0,
          contactWeight: contact,
        },
        smoothingGroup: slot.group,
      });
    }
  }

  // 감김 — Phase 2 에서 바깥 노멀 테스트로 확정한 방향 유지
  for (let i = 0; i < L; i++) {
    const base = i * stride;
    const next = base + stride;
    for (let seg = 0; seg < R; seg++) {
      const a = base + out[seg];
      const b = base + into[seg + 1];
      const c = next + out[seg];
      const d = next + into[seg + 1];
      builder.addTriangle(a, b, c);
      builder.addTriangle(b, d, c);
    }
  }

  builder.recalculateNormals();
  builder.calculateCurvature();
  const mesh = builder.build();
  // 감기 골은 cavity (오염·산화가 골에 끼는 근거 — Phase 3 베이크가 사용)
  if (wrapGeom) {
    const { cavity, perimeter, longitudinal } = mesh.attributes;
    for (let i = 0; i < cavity.length; i++) {
      cavity[i] = clamp01(cavity[i] + wrapGroove(perimeter[i], longitudinal[i], wrapGeom.turns) * 0.5);
    }
  }
  return mesh;
}

/** 파라미터 → GripDesign (직선 손잡이). */
// p.tilt: 손잡이 끝 ±X 오프셋(m) — 곡선 검의 기울어진 손잡이 (D-18). 0 이면 기존과 동일.
export function makeStraightGripDesign(p) {
  const tilt = p.tilt ?? 0;
  return {
    length: p.length,
    startRadius: p.startRadius,
    endRadius: p.endRadius,
    radiusCurve: p.radiusCurve ?? null,
    crossSection: p.crossSection ?? "circle",
    flatten: p.flatten ?? 1,
    curvature: { points: [[0, 0, 0], [tilt / 2, -p.length / 2, 0], [tilt, -p.length, 0]] },
    wrap: p.wrap ?? { enabled: true, turns: 9, width: 0.02, thickness: 0.002 },
    wrapGeometry: p.wrapGeometry ?? { enabled: false, turns: 9, depth: 0.0012 },
    segments: { longitudinal: p.segLong ?? 24, radial: p.segRadial ?? 16 },
  };
}
