// scenario — rule_0008 데모. "골격 결합이 분자에 *형상* 을 주고, 고분자를 *사슬* 로 키우며,
//   분자를 *회전* 시켜 — 수많은 분자의 *복잡한 창발* 로 이어진다"를 한 박스 안에서 보인다.
//
// 같은 3D 박스에 네 무대를 둔다(모두 같은 골격 결합 규칙의 결과 — author 안 함):
//   ① 메탄(CH₄)   : 탄소 1 + 수소 4 → VSEPR 로 *사면체* 형상(109.5°). 살짝 자전시켜 *텀블링* 을 보인다.
//   ② 물(H₂O)     : 산소 1 + 수소 2 → 고립쌍이 눌러 *굽은* 형상(~105°). 메탄과 형상이 갈린다.
//   ③ 고분자 사슬  : 탄소들이 단일 결합(bondOrderCap=1)으로 -C-C-C- *사슬* 골격으로 잇는다(융합 블롭 아님).
//   ④ 창발 수프    : H·C·O 원자 떼를 풀어놓는다 → 부딪치며 스스로 *수많은* 분자(물·메탄꼴·알코올꼴·사슬)로
//                    조립된다. 같은 규칙에서 *형상·조성·회전이 제각각인 분자 군집* 이 창발한다.
//
// author 안 함: "메탄·물·폴리머" 분기 0. 형상·고립쌍·결합가는 Z 의 껍질에서 *창발*(rule_0004/0008).
//   시나리오는 근본 정수 Z·관성 m·초기 위치/속도만 seed. world.skeletal=true 로 공유 결합을 *골격* 으로 실현.

const mass = Z => Z * 2;
const atom = (x, y, z, Z, vx = 0, vy = 0, vz = 0) => ({ x, y, z, vx, vy, vz, Z, m: mass(Z), r: Z === 1 ? 2.2 : Z === 8 ? 3.4 : 3 });

// 정사면체 꼭짓점 방향(단위) — 메탄 수소 4개의 시작 배치(자연 정렬 전 살짝 흔든다).
const TETRA = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]].map(v => {
  const l = Math.sqrt(3); return [v[0] / l, v[1] / l, v[2] / l];
});

export default {
  rule: 'rule_0008',
  name: '골격: 형상·고분자 사슬·회전 → 수많은 분자의 창발',
  setup() {
    const Wd = 380, Hd = 380, Dd = 380;
    const els = [];
    let s = 20260628;
    const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff - 0.5; }; // [-0.5,0.5)

    // 한 분자를 놓는다: 중심(Zc) + 리간드들(dir·Z). 리간드는 결합 길이 안쪽에서 *살짝 안으로* 다가가
    //   결합 게이트(접촉+접근+부드러움)를 충족해 골격 결합을 맺는다. spin 으로 분자 전체를 자전(텀블링)시킨다.
    const addMolecule = (cx, cy, cz, Zc, ligs, bulk, spin) => {
      const c = atom(cx, cy, cz, Zc, bulk[0], bulk[1], bulk[2]);
      els.push(c);
      for (const [dir, Zl, L] of ligs) {
        const px = cx + dir[0] * L, py = cy + dir[1] * L, pz = cz + dir[2] * L;
        // 속도 = 벌크 + 자전(spin × 오프셋) + 안쪽 수렴(결합 형성용)
        const ox = px - cx, oy = py - cy, oz = pz - cz;
        const sx = spin[1] * oz - spin[2] * oy, sy = spin[2] * ox - spin[0] * oz, sz = spin[0] * oy - spin[1] * ox;
        const inl = 0.08;                                  // 안쪽 수렴 속력(접근 충족, vStick 안)
        els.push(atom(px, py, pz, Zl,
          bulk[0] + sx - dir[0] * inl, bulk[1] + sy - dir[1] * inl, bulk[2] + sz - dir[2] * inl));
      }
    };

    // ── ① 메탄(CH₄) 3기 — 사면체 형상 + 텀블링 ─────────────────────────────────────
    const Lch = 9.0;                                       // C–H 시작 거리(접촉 안)
    for (let n = 0; n < 3; n++) {
      const cy = 90 + n * 95;
      const ligs = TETRA.map(d => [[d[0] + rnd() * 0.1, d[1] + rnd() * 0.1, d[2] + rnd() * 0.1], 1, Lch]);
      addMolecule(70, cy, 90, 6, ligs, [rnd() * 0.1, rnd() * 0.1, rnd() * 0.1], [0.025, 0.018, 0.02]);
    }

    // ── ② 물(H₂O) 3기 — 굽은 형상(메탄과 대비) + 텀블링 ──────────────────────────────
    const Loh = 9.5;
    for (let n = 0; n < 3; n++) {
      const cy = 90 + n * 95;
      // 두 수소를 90°로 시작(굽음은 규칙이 만든다 — seed 아님)
      const ligs = [[[1, 0.15, 0], 1, Loh], [[0.15, 1, 0], 1, Loh]];
      addMolecule(180, cy, 90, 8, ligs, [rnd() * 0.1, rnd() * 0.1, rnd() * 0.1], [0.02, 0.0, 0.022]);
    }

    // ── ③ 고분자 사슬 2가닥 — 단일 결합으로 -C-C-C- 골격(융합 블롭 아님) ───────────────────
    const Lcc = 13.0;
    for (let g = 0; g < 2; g++) {
      const y = 120 + g * 130, z = 280, n = 7;
      const xc = 90 + ((n - 1) * Lcc) / 2;
      for (let k = 0; k < n; k++) {
        const x = 90 + k * Lcc;
        els.push(atom(x, y, z, 6, (xc - x) * 0.02, 0, 0));  // 안쪽 수렴 → 이웃끼리 단일 결합으로 사슬화
      }
    }

    // ── ④ 창발 수프 — H·C·O 원자 떼가 스스로 *수많은* 분자로 조립된다(복잡한 창발) ──────────
    //   조성비 H:C:O ≈ 3:1:1(수소가 탄소·산소의 손을 채워 작은 분자·사슬이 다양하게 나오게).
    const sx0 = 235, sy0 = 70, sz0 = 195, sw = 110, sh = 240, sd = 130;
    const SOUP = 80;
    for (let i = 0; i < SOUP; i++) {
      const r = rnd() + 0.5;                               // [0,1)
      const Z = r < 0.6 ? 1 : r < 0.8 ? 6 : 8;            // 수소 60% · 탄소 20% · 산소 20%
      els.push(atom(
        sx0 + (rnd() + 0.5) * sw, sy0 + (rnd() + 0.5) * sh, sz0 + (rnd() + 0.5) * sd,
        Z, rnd() * 0.5, rnd() * 0.5, rnd() * 0.5));         // 작은 무작위 속도 → 부드러운 충돌로 결합
    }

    // skeletal=true : 공유 결합을 *융합* 이 아니라 *골격 링크* 로 실현(rule_0008). bondOrderCap 은 규칙 defaults(1).
    return { width: Wd, height: Hd, depth: Dd, tick: 0, elements: els, impulses: [], skeletal: true };
  },
};
