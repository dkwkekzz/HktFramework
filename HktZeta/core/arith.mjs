// 산술 원천 — 세계의 모든 결정이 흘러나오는 "공통 함수"의 바탕 수론.
// 여기엔 상태가 없다. 오직 정수 n 의 *구조*(소인수분해)만을 읽는다.
// 제타 함수 ζ(s)=Σ 1/nˢ 가 소수의 분포를 품듯, 우리는 n 의 소인수 구조에서
// 결정을 길어 올린다. 궤적(세계)은 이 함수의 값들이 쌓인 것이다.

// 안전 정수 범위 가드 — 시드 단계에서는 trial division 으로 충분하다.
// 주소가 이 한계를 넘어 성장하면 BigInt 경로로 승격한다(SPINE 로드맵 참조).
export const SAFE_LIMIT = Number.MAX_SAFE_INTEGER;

// 소인수분해: n = Π pᵢ^eᵢ 를 [ [p, e], ... ] 로 반환한다(오름차순).
// 이것이 "결정의 결합"의 물리적 기반이다 — 하나의 수는 여러 소수 결정의 곱이다.
export function factorize(n) {
  if (!Number.isInteger(n) || n < 1) {
    throw new RangeError(`factorize: 양의 정수만 허용 (받은 값: ${n})`);
  }
  const factors = [];
  let m = n;
  for (let p = 2; p * p <= m; p++) {
    if (m % p !== 0) continue;
    let e = 0;
    while (m % p === 0) { m = Math.floor(m / p); e++; }
    factors.push([p, e]);
  }
  if (m > 1) factors.push([m, 1]);
  return factors;
}

// 뫼비우스 함수 μ(n) ∈ {-1, 0, +1}.
//   μ(1)=1, 제곱인수를 가지면 0, 서로 다른 소수 k개의 곱이면 (-1)^k.
// 3-기호 결정 알파벳(좌회전 / 정지 / 우회전)의 원천이다.
export function mobius(n) {
  if (n === 1) return 1;
  const f = factorize(n);
  for (const [, e] of f) if (e > 1) return 0; // 제곱인수 → 0
  return f.length % 2 === 0 ? 1 : -1;
}

// 서로 다른 소인수의 개수 ω(n) — "분기의 폭".
export function omegaDistinct(n) {
  return n === 1 ? 0 : factorize(n).length;
}

// 중복도 포함 소인수의 개수 Ω(n) — "결정의 강도(누적 깊이)".
export function omegaTotal(n) {
  if (n === 1) return 0;
  return factorize(n).reduce((s, [, e]) => s + e, 0);
}

// 리우빌 함수 λ(n) = (-1)^Ω(n) ∈ {-1, +1} — 이진 결정(±).
export function liouville(n) {
  return omegaTotal(n) % 2 === 0 ? 1 : -1;
}

// 최소 소인수(least prime factor) — 결정의 "채널/종류"를 고른다.
// n=1 은 소인수가 없으므로 1 을 반환(중립 채널).
export function leastPrimeFactor(n) {
  if (n === 1) return 1;
  return factorize(n)[0][0];
}

// 한 번의 소인수분해로 세계가 읽는 모든 지표를 함께 뽑는다(핫 패스 — decide 가 매 틱 호출).
//   mu     : 뫼비우스 μ(n)
//   omega  : 서로 다른 소인수 개수 ω(n)
//   Omega  : 중복도 포함 소인수 개수 Ω(n)
//   lpf    : 최소 소인수
// 오라클의 작업 창(window)은 유계이므로(core/oracle ORACLE_PERIOD) 같은 n 이 자주 반복된다
// → 메모이즈가 크게 이득. 캐시는 유계 창 크기로 자연히 포화한다.
const _cache = new Map();
export function analyze(n) {
  const hit = _cache.get(n);
  if (hit !== undefined) return hit;
  const f = factorize(n);
  let squareFree = true;
  let Omega = 0;
  for (const [, e] of f) { Omega += e; if (e > 1) squareFree = false; }
  const omega = f.length;
  const mu = n === 1 ? 1 : (squareFree ? (omega % 2 === 0 ? 1 : -1) : 0);
  const lpf = n === 1 ? 1 : f[0][0];
  const out = { mu, omega, Omega, lpf };
  _cache.set(n, out);
  return out;
}

// 결정론적 정수 쌍맺음(pairing) — (주소 a, 시각 t) → 하나의 결정 색인 n.
// 상태를 저장하지 않고도 존재마다 서로 다른 산술 궤도를 밟게 하는 seam.
// 홀짝 섞기로 두 축의 소인수 구조가 서로를 오염시키지 않게 한다.
export function mix(a, t) {
  // 간단하지만 충돌이 드문 결합: 큰 소수 계수로 흩뿌린 뒤 1 을 더해 0 을 피한다.
  const n = (a * 2654435761 + t * 40503 + 1) >>> 0; // uint32 로 접기
  return n === 0 ? 1 : n;
}
