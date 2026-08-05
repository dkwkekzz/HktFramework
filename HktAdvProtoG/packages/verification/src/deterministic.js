// V1 — 결정적 실행 환경: Seeded Random, Deterministic ID, Stable Sort, State Hash, Tick 실행.
// 모든 시뮬레이션 코드는 Math.random / Date 를 쓰지 않고 이 모듈만 사용한다.
import { createHash } from 'node:crypto';

/** mulberry32 — 32bit 시드 결정적 PRNG */
export class SeededRandom {
  #s;
  constructor(seed) {
    if (!Number.isInteger(seed)) throw new Error(`시드는 정수여야 한다: ${seed}`);
    this.#s = seed >>> 0;
  }
  /** [0,1) 부동소수 */
  next() {
    let t = (this.#s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  /** [0,max) 정수 */
  int(max) { return Math.floor(this.next() * max); }
  pick(arr) {
    if (!arr.length) throw new Error('빈 배열에서 pick 불가');
    return arr[this.int(arr.length)];
  }
}

/** 접두사별 순차 결정적 ID 생성기 */
export function createIdGenerator(prefix) {
  let n = 0;
  return () => `${prefix}-${String(++n).padStart(6, '0')}`;
}

/** 원본을 바꾸지 않는 안정 정렬 — 동률이면 원래 순서 유지 */
export function stableSort(arr, cmp) {
  return arr
    .map((v, i) => [v, i])
    .sort((a, b) => cmp(a[0], b[0]) || a[1] - b[1])
    .map(([v]) => v);
}

/** 키 순서·환경과 무관한 정준 직렬화 */
export function canonicalize(value) {
  return JSON.stringify(sortValue(value));
}

function sortValue(v) {
  if (Array.isArray(v)) return v.map(sortValue);
  if (v && typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = sortValue(v[k]);
    return out;
  }
  if (typeof v === 'number' && !Number.isFinite(v)) throw new Error(`직렬화 불가 수치: ${v}`);
  return v;
}

/** 상태 해시 — 정준 직렬화의 sha256 앞 16자리 */
export function stateHash(value) {
  return createHash('sha256').update(canonicalize(value)).digest('hex').slice(0, 16);
}

/**
 * 결정적 Tick 실행. tickFn(state, tick) → newState (순수 함수).
 * 반환: 최종 상태, tick 별 해시 궤적.
 */
export function runTicks(state, tickFn, ticks) {
  const trail = [stateHash(state)];
  let cur = state;
  for (let t = 1; t <= ticks; t++) {
    cur = tickFn(cur, t);
    trail.push(stateHash(cur));
  }
  return { state: cur, trail };
}

/** 두 해시 궤적의 최초 차이 지점 — 없으면 -1 */
export function firstDivergence(trailA, trailB) {
  const n = Math.max(trailA.length, trailB.length);
  for (let i = 0; i < n; i++) if (trailA[i] !== trailB[i]) return i;
  return -1;
}
