// rule_0001 — 관성과 질량
//  ① 관성(뉴턴 1법칙): 힘이 없으면 속도는 불변 — 위치만 v 로 적분된다.
//  ② 질량 = 관성의 척도: 외부 충격량 J 는 Δv = J/m 만큼 속도를 바꾼다(무거울수록 덜 변함).
// 보존: 자유 운동에서 총 운동량 Σ m·v 불변. 충격량이 들어오면 정확히 ΣJ 만큼 변함(닫힌 장부).

// 결정론용 시드 의사난수(LCG) — Math.random 금지.
function lcg(seed) {
  let s = seed >>> 0;
  return () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
}

export default {
  id: 'rule_0001',
  name: '관성과 질량',
  defaults: { count: 40, dt: 1, mMin: 1, mMax: 4, vMax: 1.5, seed: 1234 },

  setup(params) {
    const w = 800, h = 600;
    const rnd = lcg(params.seed);
    const els = [];
    const span = Math.max(1e-9, params.mMax - params.mMin);
    for (let i = 0; i < params.count; i++) {
      const m = params.mMin + rnd() * (params.mMax - params.mMin);
      const a = rnd() * Math.PI * 2;
      const sp = rnd() * params.vMax;
      els.push({
        x: rnd() * w, y: rnd() * h,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        m,
        // 시각화 표시값(창발 아님): 반경 ∝ √m, 색 = 질량(가벼움=청록 → 무거움=적)
        r: 2 + Math.sqrt(m) * 1.5,
        hue: Math.round(200 - (m - params.mMin) / span * 160),
      });
    }
    return { width: w, height: h, tick: 0, elements: els, impulses: [] };
  },

  // 외부 충격량 적용: Δv = J/m (질량 = 관성의 척도). 사용자 입력·시나리오 같은 외부 작용의 통로.
  applyImpulse(world, idx, jx, jy) {
    const e = world.elements[idx];
    if (!e) return;
    const m = e.m > 0 ? e.m : 1;
    e.vx += jx / m;
    e.vy += jy / m;
  },

  step(world, params) {
    const dt = params && params.dt != null ? params.dt : 1;
    const w = world.width, h = world.height;

    // ① 이번 tick 에 예약된 외부 충격량 처리 — 적분 전에 속도 갱신
    if (Array.isArray(world.impulses)) {
      for (const imp of world.impulses) {
        if (imp.tick === world.tick) {
          const e = world.elements[imp.idx];
          if (e) { const m = e.m > 0 ? e.m : 1; e.vx += imp.jx / m; e.vy += imp.jy / m; }
        }
      }
    }

    // ② 관성: 힘 없으면 속도 불변 → 위치만 적분. 토러스 랩(좌표 동일시 — 힘 아님·v 불변)
    for (const e of world.elements) {
      e.x += e.vx * dt; e.y += e.vy * dt;
      e.x = ((e.x % w) + w) % w;
      e.y = ((e.y % h) + h) % h;
    }
    world.tick++;
  },
};
