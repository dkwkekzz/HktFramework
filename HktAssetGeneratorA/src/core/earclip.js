// 귀 자르기(ear clipping) 삼각분할 — 단순 다각형 전용 (04-phase2 §2.2).
// 자기 교차 outline 은 입력 검증에서 거부한다.

/** 2D 부호 면적 — 양수면 CCW. @param pts [[x,y],...] */
export function signedArea2D(pts) {
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    area += a[0] * b[1] - b[0] * a[1];
  }
  return area / 2;
}

const cross2 = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

function pointInTriangle(p, a, b, c) {
  const d1 = cross2(a, b, p);
  const d2 = cross2(b, c, p);
  const d3 = cross2(c, a, p);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}

/** 단순 다각형 자기 교차 검사 (인접 제외 전수 O(n²) — outline 은 수십 점 규모). */
export function isSimplePolygon(pts) {
  const n = pts.length;
  const segIntersect = (p1, p2, p3, p4) => {
    const o1 = Math.sign(cross2(p1, p2, p3));
    const o2 = Math.sign(cross2(p1, p2, p4));
    const o3 = Math.sign(cross2(p3, p4, p1));
    const o4 = Math.sign(cross2(p3, p4, p2));
    return o1 !== o2 && o3 !== o4 && o1 !== 0 && o2 !== 0 && o3 !== 0 && o4 !== 0;
  };
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      // 인접(공유 정점) 세그먼트는 건너뜀
      if (j === i || (j + 1) % n === i || (i + 1) % n === j) continue;
      if (segIntersect(pts[i], pts[(i + 1) % n], pts[j], pts[(j + 1) % n])) return false;
    }
  }
  return true;
}

/**
 * CCW 단순 다각형 → 삼각형 인덱스 배열 [[i,j,k], ...].
 * 입력이 CW 면 내부에서 뒤집어 처리하고 원본 인덱스로 반환한다.
 */
export function triangulatePolygon(pts) {
  const n = pts.length;
  if (n < 3) throw new Error("outline 은 3점 이상이어야 한다");
  let indices = pts.map((_, i) => i);
  if (signedArea2D(pts) < 0) indices.reverse();

  const triangles = [];
  let guard = 0;
  while (indices.length > 3) {
    if (++guard > n * n) throw new Error("삼각분할 실패 — outline 이 단순 다각형이 아닐 수 있다");
    let clipped = false;
    for (let i = 0; i < indices.length; i++) {
      const iPrev = indices[(i + indices.length - 1) % indices.length];
      const iCur = indices[i];
      const iNext = indices[(i + 1) % indices.length];
      const a = pts[iPrev], b = pts[iCur], c = pts[iNext];
      if (cross2(a, b, c) <= 1e-14) continue; // 오목 또는 퇴화 — 귀 아님
      let hasInner = false;
      for (const k of indices) {
        if (k === iPrev || k === iCur || k === iNext) continue;
        if (pointInTriangle(pts[k], a, b, c)) { hasInner = true; break; }
      }
      if (hasInner) continue;
      triangles.push([iPrev, iCur, iNext]);
      indices.splice(i, 1);
      clipped = true;
      break;
    }
    if (!clipped) throw new Error("삼각분할 실패 — 귀를 찾지 못함");
  }
  triangles.push([indices[0], indices[1], indices[2]]);
  return triangles;
}
