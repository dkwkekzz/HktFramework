// Engrave 프리셋 마스크 (06-phase4 §4.4, D-17).
// 06 은 "흑백 PNG 동봉 → 로드 후 Float 배열을 프로젝트에 저장" 이었다. 그 의도(디코더 편차
// 격리)를 지키되 결정 경로에서 이미지 디코딩을 아예 없앤다 — 프리셋 마스크는 아래의
// **결정적 드로잉 코드**가 만든 배열이다. Phase 6 의 AI 생성 마스크는 `maskFromBytes` 로
// 같은 자료형에 들어온다(그때만 디코딩이 개입하고, 결과 배열이 프로젝트 산출물이 된다).

import { smoothstep } from "../core/math.js";

export const MASK_SIZE = 64;

/** 캡슐 SDF 스트로크를 마스크에 max 누적 (안티앨리어싱 = 자체 smoothstep, 플랫폼 무관). */
function stroke(data, size, ax, ay, bx, by, halfWidth) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const soft = halfWidth * 0.45;
  for (let j = 0; j < size; j++) {
    const v = (j + 0.5) / size;
    for (let i = 0; i < size; i++) {
      const u = (i + 0.5) / size;
      let t = len2 > 0 ? ((u - ax) * dx + (v - ay) * dy) / len2 : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const d = Math.hypot(u - (ax + dx * t), v - (ay + dy * t));
      const value = smoothstep(halfWidth, halfWidth - soft, d);
      const k = j * size + i;
      if (value > data[k]) data[k] = value;
    }
  }
}

function makeMask(id, draw) {
  const data = new Float32Array(MASK_SIZE * MASK_SIZE);
  draw((ax, ay, bx, by, w) => stroke(data, MASK_SIZE, ax, ay, bx, by, w));
  return { id, size: MASK_SIZE, data };
}

// 프리셋 3종 — 전부 [0.08, 0.92] 안에 그려 테두리를 비운다 (원본 §22 borderIsEmpty).
const BUILTIN_DRAWERS = {
  // 룬 (ᚨ 계열) — 세로 기둥 + 가지 2
  "rune-ansuz": (line) => {
    line(0.5, 0.10, 0.5, 0.90, 0.055);
    line(0.5, 0.22, 0.80, 0.36, 0.045);
    line(0.5, 0.44, 0.80, 0.58, 0.045);
  },
  // 십자 문장 — 세로/가로 + 끝 장식
  "cross-bottony": (line) => {
    line(0.5, 0.09, 0.5, 0.91, 0.055);
    line(0.14, 0.34, 0.86, 0.34, 0.055);
    line(0.44, 0.10, 0.56, 0.10, 0.05);
    line(0.44, 0.90, 0.56, 0.90, 0.05);
    line(0.15, 0.28, 0.15, 0.40, 0.05);
    line(0.85, 0.28, 0.85, 0.40, 0.05);
  },
  // 반복 갈매기 띠 — 길이 방향으로 늘려 붙이기 좋은 장식
  "chevron-band": (line) => {
    for (let i = 0; i < 4; i++) {
      const y = 0.12 + i * 0.22;
      line(0.14, y, 0.5, y + 0.12, 0.04);
      line(0.5, y + 0.12, 0.86, y, 0.04);
    }
  },
};

export const MASK_IDS = Object.keys(BUILTIN_DRAWERS);

const cache = new Map();

/** 프리셋 마스크 (지연 생성 + 캐시). @returns {{id, size, data: Float32Array}} */
export function getMask(id) {
  let mask = cache.get(id);
  if (mask) return mask;
  const draw = BUILTIN_DRAWERS[id];
  if (!draw) throw new Error(`알 수 없는 engrave 마스크: ${id}`);
  mask = makeMask(id, draw);
  cache.set(id, mask);
  return mask;
}

/** 외부(Phase 6 AI/PNG) 유래 그레이 바이트 → 마스크. 저장 산출물은 이 배열이다. */
export function maskFromBytes(id, size, bytes) {
  if (bytes.length !== size * size) throw new Error(`마스크 크기 불일치: ${bytes.length} ≠ ${size}²`);
  const data = new Float32Array(size * size);
  for (let i = 0; i < data.length; i++) data[i] = bytes[i] / 255;
  return { id, size, data };
}

/** 마스크 bilinear 샘플 — [0,1]² 밖은 0. */
export function sampleMask(mask, mu, mv) {
  if (mu < 0 || mu > 1 || mv < 0 || mv > 1) return 0;
  const { size, data } = mask;
  const x = mu * size - 0.5;
  const y = mv * size - 0.5;
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = x - x0, fy = y - y0;
  const cx = (i) => (i < 0 ? 0 : i >= size ? size - 1 : i);
  const cy = (j) => (j < 0 ? 0 : j >= size ? size - 1 : j);
  const a = data[cy(y0) * size + cx(x0)];
  const b = data[cy(y0) * size + cx(x0 + 1)];
  const c = data[cy(y0 + 1) * size + cx(x0)];
  const d = data[cy(y0 + 1) * size + cx(x0 + 1)];
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

/**
 * uvLocal 공간의 조각 배치 (원본 §22 sampleDecoration).
 * 마스크는 `offset` 중심, `scale` 크기, `rotation` 회전한 사각형을 차지한다.
 * @param placements compileSurfaceGraph 가 만든 {mask, offset, scale, rotation, depth, radius}[]
 */
export function sampleEngravings(placements, u, v) {
  if (!placements || placements.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < placements.length; i++) {
    const p = placements[i];
    const du = u - p.offset[0];
    const dv = v - p.offset[1];
    if (du * du + dv * dv > p.radius * p.radius) continue; // 변환된 AABB(외접원) 밖 — 즉시 기각
    const cos = p.cos, sin = p.sin;
    const mu = (du * cos + dv * sin) / p.scale[0] + 0.5;
    const mv = (-du * sin + dv * cos) / p.scale[1] + 0.5;
    sum += sampleMask(p.mask, mu, mv) * p.depth;
  }
  return sum;
}
