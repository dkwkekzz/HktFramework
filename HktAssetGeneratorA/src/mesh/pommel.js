// 폼멜 생성기 — 2D 프로파일 회전체(Lathe), 축 = Y (04-phase2 §2.3, 원본 §10).
// 프로파일 = [radius, y] 위(그립 쪽, y=0)에서 아래로. 아래 끝 radius=0 → 폴-팬 (D-2).
// 위 끝은 손잡이에 가려짐 → 개방 경계 1개 (기대 경계 엣지 = radialSegments).
// 꺾임각 > 40° 프로파일 정점은 crease (스무딩 그룹 분리).

import { smoothstep } from "../core/math.js";
import { MeshBuilder } from "./builder.js";
import { PartId } from "./blade.js";

const METRIC_UNIT = 0.05; // 1 UV 단위 = 5cm
const CREASE_ANGLE_DEG = 40;

/**
 * @param design {{ profile: [radius, y][], radialSegments: number }}
 */
export function buildPommelMesh(design) {
  const profile = design.profile;
  const R = design.radialSegments;
  const m = profile.length;
  if (m < 2) throw new Error("pommel profile 은 2점 이상");
  if (profile[0][0] <= 0) throw new Error("pommel profile 위 끝 radius 는 0 보다 커야 한다 (그립 접합)");
  if (profile[m - 1][0] !== 0) throw new Error("pommel profile 아래 끝 radius 는 0 이어야 한다 (폴 닫힘)");
  if (R < 8) throw new Error("radialSegments ≥ 8");

  // 프로파일 누적 거리 (v)
  const dist = new Float64Array(m);
  for (let k = 1; k < m; k++) {
    dist[k] = dist[k - 1] + Math.hypot(profile[k][0] - profile[k - 1][0], profile[k][1] - profile[k - 1][1]);
  }
  const total = dist[m - 1];

  // 세그먼트 스무딩 그룹 — 꺾임각 > 40° 인 내부 정점에서 분리 (04-phase2 §2.3)
  const segGroup = new Array(m - 1);
  let g = 0;
  for (let k = 0; k < m - 1; k++) {
    if (k > 0) {
      const dir = (i) => {
        const dx = profile[i + 1][0] - profile[i][0];
        const dy = profile[i + 1][1] - profile[i][1];
        const len = Math.hypot(dx, dy) || 1;
        return [dx / len, dy / len];
      };
      const [ax, ay] = dir(k - 1);
      const [bx, by] = dir(k);
      const angle = Math.acos(Math.min(1, Math.max(-1, ax * bx + ay * by))) * (180 / Math.PI);
      if (angle > CREASE_ANGLE_DEG) g++;
    }
    segGroup[k] = g;
  }

  // 프로파일 정점 → 행(row) 전개: crease 내부 정점은 행 2개 (그룹 분리)
  // 마지막 정점(radius 0)은 행이 아니라 폴로 처리.
  const rows = []; // { profileIndex, group }
  const rowOut = new Array(m - 1); // 세그먼트 k 의 시작 행
  const rowIn = new Array(m - 1);  // 세그먼트 k-1 의 끝 행 (rowIn[k] = 세그먼트 k 시작점의 이전 그룹 행)
  for (let k = 0; k < m - 1; k++) {
    if (k === 0) {
      rowOut[0] = rows.length;
      rows.push({ profileIndex: 0, group: segGroup[0] });
    } else if (segGroup[k] !== segGroup[k - 1]) {
      rowIn[k] = rows.length;
      rows.push({ profileIndex: k, group: segGroup[k - 1] });
      rowOut[k] = rows.length;
      rows.push({ profileIndex: k, group: segGroup[k] });
    } else {
      rowIn[k] = rowOut[k] = rows.length;
      rows.push({ profileIndex: k, group: segGroup[k] });
    }
  }
  // 폴 직전 행 (마지막 세그먼트의 끝 = 프로파일 m-2 는 이미 rowOut[m-2]... 폴은 별도)

  const builder = new MeshBuilder();
  const contactAt = (v) => 0.8 * smoothstep(0.25, 0, v); // 위쪽(그립 접촉)만

  const ringIndex = []; // rows 순서대로 각 행의 정점 시작 인덱스
  for (const row of rows) {
    const [radius, y] = profile[row.profileIndex];
    const v = dist[row.profileIndex] / total;
    const start = builder.vertexCount;
    ringIndex.push(start);
    for (let j = 0; j <= R; j++) {
      const u = j / R;
      const angle = u * Math.PI * 2;
      builder.addVertex({
        position: [Math.cos(angle) * radius, y, Math.sin(angle) * radius],
        uvLocal: [u, v],
        uvMetric: [(angle * radius) / METRIC_UNIT, dist[row.profileIndex] / METRIC_UNIT],
        attributes: {
          partId: PartId.Pommel, islandId: 0,
          longitudinal: v, perimeter: u,
          edgeWeight: 0, ridgeWeight: 0, fullerWeight: 0,
          contactWeight: contactAt(v),
        },
        smoothingGroup: row.group,
      });
    }
  }

  const stride = R + 1;
  // 세그먼트 k (0..m-3): 행 rowOut[k] → rowIn[k+1] (마지막 세그먼트 m-2 는 폴-팬)
  for (let k = 0; k < m - 2; k++) {
    const top = ringIndex[rowOut[k]];
    const bottom = ringIndex[rowIn[k + 1] ?? rowOut[k + 1]];
    for (let j = 0; j < R; j++) {
      const a = top + j, b = a + 1;
      const c = bottom + j, d = c + 1;
      builder.addTriangle(a, b, c);
      builder.addTriangle(b, d, c);
    }
  }

  // 폴-팬 (아래 끝, D-2): 폴 정점을 R 개 복제, u = 팬 중점
  const poleY = profile[m - 1][1];
  const lastRow = ringIndex[rowOut[m - 2]];
  const lastGroup = segGroup[m - 2];
  for (let j = 0; j < R; j++) {
    const uMid = (j + 0.5) / R;
    const pole = builder.addVertex({
      position: [0, poleY, 0],
      uvLocal: [uMid, 1],
      uvMetric: [0, total / METRIC_UNIT],
      attributes: {
        partId: PartId.Pommel, islandId: 0,
        longitudinal: 1, perimeter: uMid,
        edgeWeight: 0, ridgeWeight: 0, fullerWeight: 0,
        contactWeight: 0,
      },
      smoothingGroup: lastGroup,
    });
    builder.addTriangle(lastRow + j, lastRow + j + 1, pole);
  }

  builder.recalculateNormals();
  builder.calculateCurvature();
  return builder.build();
}

// ── 프로파일 프리셋 (04-phase2 §2.6 — 4종) — scale 로 전체 크기 조절 ────────
export function makePommelProfile(shape, scale = 1) {
  const s = scale;
  switch (shape) {
    case "sphere": // 구 근사 (위가 약간 열린)
      return [
        [0.012 * s, 0], [0.018 * s, -0.008 * s], [0.02 * s, -0.018 * s],
        [0.016 * s, -0.03 * s], [0.008 * s, -0.037 * s], [0, -0.04 * s],
      ];
    case "disc": // 원반형 (중세 디스크 폼멜)
      return [
        [0.01 * s, 0], [0.024 * s, -0.006 * s], [0.026 * s, -0.014 * s],
        [0.024 * s, -0.022 * s], [0.01 * s, -0.028 * s], [0, -0.03 * s],
      ];
    case "teardrop":
      return [
        [0.011 * s, 0], [0.016 * s, -0.012 * s], [0.014 * s, -0.026 * s],
        [0.007 * s, -0.038 * s], [0, -0.046 * s],
      ];
    case "scent-stopper": // 각진 단(段) 폼멜 — crease 확인용
      return [
        [0.01 * s, 0], [0.02 * s, -0.004 * s], [0.02 * s, -0.02 * s],
        [0.012 * s, -0.024 * s], [0.012 * s, -0.034 * s], [0, -0.038 * s],
      ];
    default:
      throw new Error(`알 수 없는 pommel 프로파일: ${shape}`);
  }
}

export function makePommelDesign(p) {
  return {
    profile: makePommelProfile(p.shape, p.scale ?? 1),
    radialSegments: p.radialSegments ?? 16,
  };
}
