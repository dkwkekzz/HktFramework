// 오라클(Ω) — 모든 존재의 "다음 결정"을 내리는 단 하나의 공통 원천.
//
//   존재는 객체가 아니라 *주소*(정수 a)다. 존재의 상태는 시각 t 에서
//   결정 색인 n = mix(a, t) 로 접히고, 그 n 의 소인수 구조가 곧 결정이 된다.
//   객체를 시뮬레이션하지 않는다 — 함수의 값을 읽을 뿐이다.
//
// 하나의 결정 = { turn, act, mag } (단순함).
//   - turn ∈ {-1,0,+1} : 뫼비우스 μ(n) — 좌 / 정지 / 우
//   - act  : Ω(n)(중복도 포함 소인수 개수)을 채널 수(ACT_CHANNELS)로 접은 종류
//   - mag  : ω(n)(서로 다른 소인수 개수)에서 얻은 강도(≥1)
//
// 결정의 "결합"은 이 결정들을 시간축으로 적분(누적)한 것이다 → 궤적(core/world).

import { mix, analyze } from './arith.mjs';

// 행동 채널의 수 — Ω(n) 을 이 개수로 접어 종류를 만든다.
export const ACT_CHANNELS = 4; // 0:이동 1:섭취 2:분열 3:대기 (SPINE 참조, 확장 가능)

// 오라클의 작업 창 — mix 결과를 이 주기로 접어 소인수분해를 값싸게 유지한다.
// 2²⁰ 이므로 √n ≤ 1024, 게다가 유계라 메모이즈가 포화한다. 스케일이 커지면
// 이 창을 넓히거나 BigInt 경로로 승격한다(SPINE 로드맵 §성능 seam).
export const ORACLE_PERIOD = 1 << 20;

export const ACT = Object.freeze({
  MOVE: 0,
  FEED: 1,
  SPLIT: 2,
  WAIT: 3,
});

// 오라클: (a, t) → 하나의 순수한 결정. 부수효과·상태 없음.
export function decide(a, t) {
  const n = 1 + (mix(a, t) % ORACLE_PERIOD);   // 유계 창으로 접는다
  const { mu, omega, Omega } = analyze(n);
  const turn = mu;                             // {-1,0,+1}
  const act = Omega % ACT_CHANNELS;            // 채널 — Ω(n) 은 모든 잔여류를 밟는다
  const mag = Math.max(1, omega);              // 강도(≥1) — 서로 다른 소인수의 폭
  return { n, turn, act, mag };
}

// 8방위 이동 벡터 — turn 을 누적 방향(heading)에 더해 걸음을 만든다.
const DIRS = [
  [1, 0], [1, 1], [0, 1], [-1, 1],
  [-1, 0], [-1, -1], [0, -1], [1, -1],
];

// 결정을 공간 이동으로 번역한다(heading 은 존재가 들고 다니는 유일한 국소 상태).
// act 가 MOVE 일 때만 실제로 전진한다 — 나머지 행동은 제자리에서 일어난다.
export function stepMotion(heading, decision) {
  const nextHeading = ((heading + decision.turn) % 8 + 8) % 8;
  let dx = 0, dy = 0;
  if (decision.act === ACT.MOVE) {
    const [ux, uy] = DIRS[nextHeading];
    dx = ux * decision.mag;
    dy = uy * decision.mag;
  }
  return { heading: nextHeading, dx, dy };
}
