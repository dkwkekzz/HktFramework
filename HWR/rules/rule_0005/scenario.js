// scenario — rule_0005 데모 세계. "분자가 되어야 비로소 특성을 가진다"를 *상태*로 보인다.
//   같은 온도(낮은 속도)에서도 분자의 *극성*이 상태를 가른다:
//     · 굽은 물(H₂O) = 유극성 → 분자 간 인력(수소결합 같은 응집)에 끌려 *응결*(액체 방울).
//     · 일직선 이산화탄소(CO₂) = 무극성(대칭 상쇄) → 인력 0 → 흩어진 *기체*.
//     · 네온(Ne) = 홀원자(분자 아님) → 특성 없음 → 기체.
//   색도 분자가 비로소 갖는다 — 구성 원자 전자껍질 채움의 함수(rule_0005 가 계산해 칠한다).
//
// author 안 함: "물·기체" 타입 분기 0. 시나리오는 *초기 배치*(조성·기하·위치·속도)만 짜고,
//   극성·인력·상태·색은 모두 규칙이 조성·기하에서 계산한다. 물의 '굽은 각도'만 seed(분자 형상은
//   아직 더 낮은 규칙으로 창발 전 — 후속 과제). 굴리는 일은 엔진+규칙의 몫.
//
// 주의: H₂O 를 *일직선*(rule_0004 데모처럼 H 가 O 양옆)으로 두면 대칭이라 무극성이 된다.
//   극성은 조성이 아니라 *기하*의 함수다 — 그래서 여기선 H 둘을 같은 쪽(굽은)으로 둔다.

// 원자(분자의 부분): 상대 위치 (dx,dy,dz) · 원자번호 Z · 질량 m. en 은 Z 에서 계산해 박아 둔다(부분 색은 무관).
const PERIODS = [2, 8, 8, 18, 18, 32];
function enOf(Z) {                                   // rule_0004 shellState.en 과 동일(부분에 미리 기록)
  let cum = 0, cap = 0, prev = 0, period = 1;
  for (let p = 0; p < PERIODS.length; p++) {
    const hi = cum + PERIODS[p];
    if (Z <= hi || p === PERIODS.length - 1) { cap = PERIODS[p]; prev = cum; period = p + 1; break; }
    cum = hi;
  }
  return ((Z - prev) / cap) / period;
}
const part = (dx, dy, dz, Z, m) => ({ x: dx, y: dy, z: dz, vx: 0, vy: 0, vz: 0, Z, en: enOf(Z), m, r: 3 });

// 분자(합성체) — 엔진 병합이 만드는 모양과 동일: parts(부분 원자)·질량 합·freeValence(포화 0)·반경.
//   부분의 *상대 기하*가 극성을 가른다. 중심 (cx,cy,cz), 속도 (vx,vy,vz).
function mol(cx, cy, cz, parts, vx, vy, vz) {
  let M = 0, r2 = 0;
  for (const p of parts) { p.x += cx; p.y += cy; p.z += cz; M += p.m; r2 += (p.r || 0) * (p.r || 0); }
  return { x: cx, y: cy, z: cz, vx, vy, vz, m: M, q: 0, parts, freeValence: 0, r: Math.sqrt(r2) };
}
// 굽은 물(유극성): O 중앙, H 둘이 같은 쪽(+y) → 쌍극자 잔류(굽힘 작게 → 우물 완만 → 다체 응결 안정)
const water = (cx, cy, cz, vx, vy, vz) => mol(cx, cy, cz, [part(0, 0, 0, 8, 16), part(-8, 3, 0, 1, 1), part(8, 3, 0, 1, 1)], vx, vy, vz);
// 일직선 이산화탄소(무극성): C 중앙, O 둘이 정반대(±x) → 쌍극자 상쇄
const co2 = (cx, cy, cz, vx, vy, vz) => mol(cx, cy, cz, [part(0, 0, 0, 6, 12), part(-10, 0, 0, 8, 16), part(10, 0, 0, 8, 16)], vx, vy, vz);
// 네온 홀원자(분자 아님 → 특성 없음): Z=10, 꽉 찬 껍질
const ne = (cx, cy, cz, vx, vy, vz) => ({ x: cx, y: cy, z: cz, vx, vy, vz, Z: 10, en: enOf(10), m: 20, hue: 300, r: 5 });

export default {
  rule: 'rule_0005',
  name: '분자 특성: 극성 → 상태 (물방울 vs 기체)',
  setup() {
    const W = 240, H = 240, D = 240;
    // 결정론적 시드 의사난수(Math.random 금지) — 작은 흔들림(미세 온도)·배치에만 사용
    let s = 12345;
    const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff - 0.5; };
    const els = [];

    // ── 극성 물 분자 무리 — 중심부에 빽빽이(서로 차단권 σ·rCutK≈62 안), *낮은 속도(차가움)* → 응결 ──
    //   3×3×1 격자, 간격 25(평형 σ·2^⅙≈23 바로 밖) → 분자 간 인력이 살짝 당겨 방울로 조인다.
    const cx0 = 120, cy0 = 110, cz0 = 120;
    for (let gx = -1; gx <= 1; gx++) for (let gy = -1; gy <= 1; gy++) {
      els.push(water(cx0 + gx * 25, cy0 + gy * 25, cz0 + rnd() * 8,
        rnd() * 0.03, rnd() * 0.03, rnd() * 0.03));   // 차가움(낮은 운동에너지)
    }

    // ── 무극성 CO₂ — 박스 전역에 흩뿌림, 같은 낮은 속도 → 인력 0 이라 응결 못 함(기체) ──
    const co2pos = [[40, 200, 40], [200, 200, 60], [60, 40, 200], [210, 50, 190], [190, 120, 30]];
    for (const [x, y, z] of co2pos) els.push(co2(x, y, z, rnd() * 0.05, rnd() * 0.05, rnd() * 0.05));

    // ── Ne 홀원자 — 분자가 아니므로 특성 없음 → 기체 ──
    const nepos = [[30, 30, 30], [210, 210, 210], [30, 210, 120], [210, 30, 120], [120, 210, 30], [120, 30, 210]];
    for (const [x, y, z] of nepos) els.push(ne(x, y, z, rnd() * 0.06, rnd() * 0.06, rnd() * 0.06));

    return { width: W, height: H, depth: D, tick: 0, elements: els, impulses: [] };
  },
};
