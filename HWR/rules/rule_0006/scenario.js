// scenario — rule_0006 데모. "철이 비로소 *덩어리 고체*가 된다"를 물질 종류 대비로 보인다.
//   같은 3D 박스에 세 종류 원소를 둔다 — 결합 종류(Z 의 껍질에서 창발)가 물질 종류를 가른다:
//     · 철(Fe, Z=26, 금속) = 전자바다 결합 → 응집·냉각해 *고체 덩어리*(격자).
//     · 나트륨(Na, Z=11, 금속·원자가 1) = 전자바다 결합이 약해 더 무른 덩어리.
//     · 네온(Ne, Z=10, 비활성) = 결합 안 함 → 흩어진 *기체*.
//   → 금속은 덩어리로 형상화, 비활성은 기체 — 박은 타입이 아니라 결합 종류의 결과.
//
// author 안 함: "철·기체" 분기 0. 금속 여부·결합 세기는 Z 의 껍질에서 *창발*(shellState). 시나리오는
//   근본 정수 Z·관성 m 만 seed. 굴리는 일은 엔진+규칙의 몫.

const atom = (x, y, z, Z, vx, vy, vz) => ({ x, y, z, vx, vy, vz, Z, m: Z * 2, r: 3 });

export default {
  rule: 'rule_0006',
  name: '물질: 금속 고체 vs 비활성 기체 (철 덩어리)',
  setup() {
    const W = 320, H = 320, D = 320;
    const els = [];
    let s = 20240626;
    const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff - 0.5; };

    // ── 철(Fe) 무리 — 평형 밖(σ≈29 → 간격 36)에서 출발 → 전자바다 결합으로 응집·냉각해 고체 덩어리 ──
    const fcx = 95, fcy = 160, fcz = 160, fsp = 36;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++)
      els.push(atom(fcx + (i - 1) * fsp + rnd() * 6, fcy + (j - 1) * fsp + rnd() * 6, fcz + (k - 1) * fsp + rnd() * 6,
        26, rnd() * 0.4, rnd() * 0.4, rnd() * 0.4));

    // ── 나트륨(Na) 무리 — 더 무른 금속(원자가 1) → 덩어리지되 느슨 ──
    const ncx = 225, ncy = 110, ncz = 160, nsp = 24;
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) for (let k = 0; k < 2; k++)
      els.push(atom(ncx + i * nsp + rnd() * 4, ncy + j * nsp + rnd() * 4, ncz + k * nsp + rnd() * 4,
        11, rnd() * 0.4, rnd() * 0.4, rnd() * 0.4));

    // ── 네온(Ne) 비활성 — 결합 안 함 → 박스를 떠도는 기체 ──
    for (const [x, y, z] of [[230, 230, 80], [80, 80, 240], [250, 80, 230], [60, 250, 90], [240, 250, 250], [150, 60, 60]])
      els.push(atom(x, y, z, 10, rnd() * 0.5, rnd() * 0.5, rnd() * 0.5));

    return { width: W, height: H, depth: D, tick: 0, elements: els, impulses: [] };
  },
};
