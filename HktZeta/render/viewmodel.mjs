// ViewModel — 궤적(core)을 읽어 타입 있는 Scene 계약으로 파생한다.
// 불변 원칙 ④: 렌더는 이 Scene 만 소비한다. 여기서 세계 규칙을 재유도하지 않고,
// 오직 core 가 만든 상태를 *표현용 속성*으로 정규화한다(순수·DOM 없음·Node/브라우저 공용).

import { seedWorld, step } from '../core/world.mjs';
import { analyze } from '../core/arith.mjs';

// Scene 계약:
//   meta    : { seed, ticks, count, terrainW, terrainH }
//   bodies  : 최종 틱의 모든 존재 [{x,y,energy,mag,act,turn}]
//   trails  : 초기 계보(index 0..count-1)의 궤적 [ [{x,y,e}, ...(ticks+1)], ... ]
//             (초기 존재는 매 틱 앞쪽에 유지되고 truncation 은 뒤(자식)부터 자르므로 index 안정)
//   terrain : 정수 산술 지형 — height=Ω(n) 정규화, mu=μ(n) (지형 위에서 세계가 결정을 읽는다)
export function buildScene(seed, ticks, count = 8, terrainW = 96, terrainH = 96) {
  let s = seedWorld(seed, count);
  const trails = Array.from({ length: count }, () => []);
  const record = (st) => {
    for (let i = 0; i < count && i < st.beings.length; i++) {
      const b = st.beings[i];
      trails[i].push({ x: b.x, y: b.y, e: b.energy });
    }
  };
  record(s);
  for (let t = 0; t < ticks; t++) { s = step(s); record(s); }

  const bodies = s.beings.map((b) => ({
    x: b.x, y: b.y, energy: b.energy,
    ...decorate(b),
  }));

  return {
    meta: { seed, ticks, count, terrainW, terrainH },
    bodies,
    trails,
    terrain: buildTerrain(terrainW, terrainH),
  };
}

// 존재의 최종 결정 지표를 표현용으로 뽑는다(mag=ω, act=Ω%4, turn=μ).
function decorate(b) {
  const a = analyze(1 + (b.addr % (1 << 20)));
  return { mag: Math.max(1, a.omega), act: a.Omega % 4, turn: a.mu };
}

// 정수 산술 지형 — 셀 k(=1..W·H)의 높이=Ω(k), 색 게이트=μ(k).
// 세계가 결정을 길어 올리는 "소인수 구조" 그 자체를 지형으로 세운다.
export function buildTerrain(W, H) {
  const height = new Float32Array(W * H);
  const mu = new Int8Array(W * H);
  let maxOmega = 1;
  for (let k = 1; k <= W * H; k++) {
    const a = analyze(k);
    height[k - 1] = a.Omega;
    mu[k - 1] = a.mu;
    if (a.Omega > maxOmega) maxOmega = a.Omega;
  }
  for (let i = 0; i < height.length; i++) height[i] /= maxOmega; // 0..1 정규화
  return { W, H, maxOmega, height: Array.from(height), mu: Array.from(mu) };
}
