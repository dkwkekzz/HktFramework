// scenario — rule_0005 데모. "분자가 되어야 비로소 (전자기적) 특성을 가진다"를 *이온 수화*로 보인다.
//   분자(중성)는 내부 부분전하 덕에 전자기력에 보이고, 홀원자(중성)는 안 보인다:
//     · 굽은 물(H₂O) = 부분전하(O δ+, H δ−) → 이온 곁에서 EM 력을 받아 끌려간다(수화 껍질).
//     · 네온(Ne) = 홀원자 → 부분전하 없음 → 이온을 *무시*(자유 기체).
//     · 이온쌍(Na⁺Cl⁻) = 순전하 → 전자기력에 묶인다(기존 거동).
//   분자 간 인력(반데르발스)은 *별도 힘이 아니라* 이 부분전하에 작용하는 전자기력(rule_0003)이다 —
//   따로 계산하면 이중계산. rule_0005 는 부분전하라는 *특성*만 부여하고, 인력은 EM 이 창발시킨다.
//   색도 분자가 비로소 갖는다 — 구성 원자 전자껍질 채움의 함수(rule_0005 가 계산해 칠한다).
//
// 한계(정직): 분자는 강체 점질량이라 *회전하지 않는다*. 부분전하 EM 은 방향 의존적이라(올바른 물리),
//   여기선 물의 O 를 이온 쪽으로 *향하게 배치*해 수화를 또렷이 보인다. 무작위 분자의 등방 응결(액체)은
//   분자 회전이 있어야 깨끗이 나며 — 그건 다음 규칙(백로그: 질점 parts → 강체 회전).
//
// author 안 함: "물·이온·기체" 타입 분기 0. 시나리오는 *초기 배치*(조성·기하·위치)만 짜고,
//   부분전하·EM 인력·색은 규칙이 조성·기하에서 계산한다. 굴리는 일은 엔진+규칙의 몫.

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
const part = (x, y, z, Z, m) => ({ x, y, z, vx: 0, vy: 0, vz: 0, Z, en: enOf(Z), m, r: 3 });

// 굽은 물 분자 — O 를 (tx,ty,tz)*반대편*에 두어 O 가 그쪽을 향하게(수화: O δ+ 가 음이온 쪽). 중심 (cx,cy,cz).
//   O 중심, H 둘은 (cx,cy,cz)에서 target 반대 방향으로 빼서 O 노출.
function waterToward(cx, cy, cz, tx, ty, tz) {
  let ox = cx - tx, oy = cy - ty, oz = cz - tz;     // target → 분자 (바깥 방향)
  const L = Math.hypot(ox, oy, oz) || 1; ox /= L; oy /= L; oz /= L;
  // H 둘을 바깥 방향(ox..)으로 9, 그리고 서로 ±5 벌림(바깥과 직교한 축으로)
  let px = -oy, py = ox, pz = 0; const PL = Math.hypot(px, py, pz) || 1; px /= PL; py /= PL; pz /= PL;
  const h = (s) => part(cx + ox * 9 + px * 5 * s, cy + oy * 9 + py * 5 * s, cz + oz * 9 + pz * 5 * s, 1, 1);
  const parts = [part(cx, cy, cz, 8, 16), h(+1), h(-1)];
  return { x: cx, y: cy, z: cz, vx: 0, vy: 0, vz: 0, m: 18, q: 0, freeValence: 0, r: Math.sqrt(27), parts };
}
const ion = (cx, cy, cz, q) => ({ x: cx, y: cy, z: cz, vx: 0, vy: 0, vz: 0, m: 23, q, en: q > 0 ? 0.9 : 3.2, r: 4 });
const ne = (cx, cy, cz) => ({ x: cx, y: cy, z: cz, vx: 0, vy: 0, vz: 0, Z: 10, en: enOf(10), m: 20, hue: 300, r: 5 });

export default {
  rule: 'rule_0005',
  name: '분자 특성: 이온 수화 (분자만 EM에 보인다)',
  setup() {
    const W = 240, H = 240, D = 240;
    const els = [];

    // ── 수화 1쌍씩: 음이온 + 물 1개(O 가 이온 향함) → EM 으로 끌려와 *속박*(분자가 EM 에 보임을 또렷이) ──
    //   (물끼리도 부분전하로 반발하므로 한 이온에 여럿 붙이면 흩어진다 — 1쌍씩 떨어뜨려 강건하게)
    for (const [ix, iy, iz] of [[70, 70, 120], [170, 90, 110], [110, 170, 130]]) {
      els.push(ion(ix, iy, iz, -1));
      els.push(waterToward(ix + 16, iy, iz, ix, iy, iz));   // 물 O 를 이온 쪽으로
    }

    // ── 이온쌍(Na⁺Cl⁻) — 순전하라 전자기력에 묶인다(기존 거동) ──
    els.push(ion(60, 190, 70, +1));
    els.push(ion(72, 190, 70, -1));

    // ── Ne 홀원자 — 분자가 아니므로 부분전하 없음 → 이온 무시(자유 기체) ──
    for (const [x, y, z] of [[200, 40, 200], [40, 200, 200], [200, 200, 40], [190, 190, 190]])
      els.push(ne(x, y, z));

    return { width: W, height: H, depth: D, tick: 0, elements: els, impulses: [] };
  },
};
