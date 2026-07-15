// ============================================================================
//  scatterLayout.js — 환경 스캐터 **배치 계산** (three 무의존 순수 함수).
//
//  어디에 무엇을 얼마나 크게 놓을지만 결정한다. 렌더(scatter.js)와
//  Node 검증(verify/rmt-verify.mjs)이 같은 배치를 공유하므로, 검증 캡처가
//  실제 화면 배치와 항상 일치한다.
//
//  RMT 매핑:
//   · 위치  — 지니브르 2D 점과정(rmt.js). 거시 균일 + 미시 반발이라
//     일반 난수의 뭉침(clumping)/공백 없이 유기적으로 흩어진다.
//     개인 공간이 큰 나무는 **별도의 저밀도 과정**으로 분리해 표본한다
//     (밀도가 다른 객체를 한 과정에 섞으면 반발 스케일이 하나로 뭉개진다).
//   · 크기  — GUE 언폴딩 간격열(Wigner surmise). s→0 도 s→∞ 도 드물어
//     "극단 없이 자연스럽게 다양한" 크기 분포가 된다.
//  비교 모드('uniform')는 같은 개수를 일반 난수로 배치 — 뭉침이 그대로 보인다.
// ============================================================================
import { ginibrePoints, uniformDiskPoints, gueSpacings, mulberry32 } from './rmt.js';

export const SCATTER = {
  R_OUT: 9.2,    // 배치 바깥 반경 (바닥 원판 10m 안쪽, 안개 시작 9m 걸침)
  R_CLEAR: 1.6,  // 캐릭터 주변 공터 반경
  N_SMALL: 220,  // 소형(잔디·바위·수정) 점과정 개수
  N_TREE: 14,    // 나무 점과정 개수
  R_TREE: 8.6,   // 나무 배치 반경
};

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// mode: 'rmt' | 'uniform'. 반환: [{ type, x, z, s, yaw, tint }]
//  type ∈ grass | rock | crystal | tree, s = 크기 배율, tint = 색 변주(-0.5..0.5 스케일)
export function buildScatterLayout(mode, seed = 1) {
  const rnd = mulberry32((seed ^ 0x5eed) >>> 0);
  const sample = (n, s, R) => {
    const p = mode === 'rmt' ? ginibrePoints(n, s) : uniformDiskPoints(n, s);
    return p.x.map((px, i) => [px * R, p.y[i] * R]);
  };

  // 크기열 — RMT 모드는 Wigner 간격(평균 1, 0·극단 회피), 비교 모드는 일반 난수
  const sizes = mode === 'rmt' ? gueSpacings(300, (seed * 7 + 3) >>> 0) : null;
  let si = 0;
  const nextSize = () =>
    sizes ? clamp(sizes[si++ % sizes.length], 0.5, 1.8) : 0.5 + 1.3 * rnd();

  const items = [];
  // 소형 과정 — 잔디 다발 / 바위 / 발광 수정
  for (const [x, z] of sample(SCATTER.N_SMALL, (seed * 2 + 1) >>> 0, SCATTER.R_OUT)) {
    const r = Math.hypot(x, z);
    if (r < SCATTER.R_CLEAR || r > SCATTER.R_OUT) continue;
    const u = rnd();
    const type = u < 0.05 ? 'crystal' : u < 0.27 ? 'rock' : 'grass';
    items.push({ type, x, z, s: nextSize(), yaw: rnd() * Math.PI * 2, tint: rnd() - 0.5 });
  }
  // 나무 과정 — 저밀도 분리 (캐릭터 공터는 여유를 더 둔다)
  for (const [x, z] of sample(SCATTER.N_TREE, (seed * 2 + 2) >>> 0, SCATTER.R_TREE)) {
    const r = Math.hypot(x, z);
    if (r < SCATTER.R_CLEAR + 1.0 || r > SCATTER.R_TREE) continue;
    items.push({ type: 'tree', x, z, s: 0.85 + 0.45 * nextSize(), yaw: rnd() * Math.PI * 2, tint: rnd() - 0.5 });
  }
  return items;
}
