// scenario_soup — "원시 수프": 다양한 원소(Z) 다수를 섞어 무엇이 창발하는지 본다.
//   원자는 원자번호 Z(와 관성용 m)만 seed — en·결합가·결합은 전부 rule_0004 가 껍질에서 계산.
//   굴리면 충돌(공유 분자)·이온화(전자기력 클러스터)·비활성(안 붙음)이 *저절로* 갈린다.
// 결정론: 시드 의사난수(같은 시드 → 같은 세계). Math.random 금지.

// 원소 명부 — (Z, 질량≈원자량, 색상, 개수). 화학이 풍부하도록 H·O 를 많이.
const ROSTER = [
  { Z: 1,  m: 1,  hue: 55,  n: 55 },  // H  (share, 결합가 1)
  { Z: 8,  m: 16, hue: 205, n: 32 },  // O  (비금속, 결합가 2)
  { Z: 6,  m: 12, hue: 0,   n: 12 },  // C  (share, 결합가 4)
  { Z: 7,  m: 14, hue: 270, n: 8  },  // N  (비금속, 결합가 3)
  { Z: 11, m: 23, hue: 35,  n: 10 },  // Na (금속, 결합가 1)
  { Z: 17, m: 35, hue: 120, n: 12 },  // Cl (비금속, 결합가 1)
  { Z: 12, m: 24, hue: 90,  n: 5  },  // Mg (금속, 결합가 2)
  { Z: 10, m: 20, hue: 320, n: 8  },  // Ne (비활성, 결합가 0)
];

export default {
  rule: 'rule_0004',
  name: '원시 수프 (다원소)',
  setup() {
    const W = 180, H = 180, D = 180;          // 적당히 조밀해 충돌이 자주 일어남(토러스)
    let s = 20240626;                          // 시드
    const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    const els = [];
    for (const k of ROSTER) {
      for (let i = 0; i < k.n; i++) {
        // 구면 등방 속도(3D), 느린 편(부드러운 충돌이라야 공유 결합이 충격을 가둔다 — vStick)
        const u = rnd() * 2 - 1, th = rnd() * Math.PI * 2, sp = 0.2 + rnd() * 0.8;
        const sxy = Math.sqrt(1 - u * u);
        els.push({
          x: rnd() * W, y: rnd() * H, z: rnd() * D,
          vx: Math.cos(th) * sxy * sp, vy: Math.sin(th) * sxy * sp, vz: u * sp,
          Z: k.Z, m: k.m, hue: k.hue, r: 2 + Math.sqrt(k.m) * 1.1,
        });
      }
    }
    return { width: W, height: H, depth: D, tick: 0, elements: els, impulses: [] };
  },
};
