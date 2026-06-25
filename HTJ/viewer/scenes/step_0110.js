// viewer/scenes/step_0110.js — (조립) 선 캐릭터: 큰 구체(행성) 위에 *방사 중력*으로 선다(PW-A 최소 단위).
//   CLAUDE.md §4 게임 최소 단위: "선 캐릭터 = 중력↓ + 접촉 반발↑ 균형, 지면 = 아주 큰 구체." 새 물리 0 —
//   이미 가진 두 법칙만 큰 구체 무대에서 함께 굴린다: applyEntityGravity(0028·쌍힘 N체 중력)이 작은
//   캐릭터를 *무거운* 행성 중심으로 끌고(중력=방사·아래는 중심 방향), applyEntityContact(0037·Hooke
//   반발+감쇠)가 표면에서 떠받쳐 평형 overlap*(=F_grav/k)에 정착시킨다. 행성은 *아주 무거워*(M≫m) 거의
//   안 움직인다(author-anchoring 없이 "큰 구체"가 지면). 캐릭터는 *어느 각도*에 놓아도 표면에 선다(아래=방사).
//   engine 변경 0(조립·0028+0037). 탑다운 x-y(중력 평면). UMD(브라우저·Node).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require);
  else { root.HTJScenes = root.HTJScenes || {}; root.HTJScenes['0110'] = factory(null); }
})(typeof self !== 'undefined' ? self : this, function (require) {
  const En = require ? require('../../engine/htj-entity.js') : self.HTJEntity;

  const N = 48, CX = 24, CY = 24, R = 12, DT = 0.05;
  const GOPT = { G: 0.04, soft: 1 }, COPT = { k: 20, cDamp: 6 }, M = 4000;

  function build(w) {
    const planet = { cx: CX, cy: CY, cz: 0, mass: M, px: 0, py: 0, pz: 0, internalE: 0, KEcm: 0, energy: 0, radius: R };  // M≫m → 무게가 곧 부동성(author-anchor 아님)
    const ch = { cx: CX, cy: CY + R + 6, cz: 0, mass: 1, px: 0, py: 0, pz: 0, internalE: 0, KEcm: 0, energy: 0, radius: 1 };  // 위에서 떨어뜨림
    w.__e = [planet, ch];
  }
  function sim(w) {
    for (let s = 0; s < 4; s++) {
      En.applyEntityGravity(w.__e, DT, GOPT);                 // 방사 중력(0028)
      En.applyEntityContact(w.__e, DT, COPT);                 // 접촉 반발+감쇠(0037)
      En.stepEntities(w.__e, DT);
    }
  }

  return {
    label: 'step_0110 — (조립) 선 캐릭터: 큰 구체(행성) 위에 방사 중력으로 선다(PW-A 최소 단위)',
    title: 'HTJ — 선 캐릭터: 작은 구체가 무거운 행성 표면에 *중력↓+접촉↑ 균형*으로 정착·선다(아래=방사·어디든)',
    sub: 'CLAUDE §4 게임 최소 단위 "선 캐릭터=중력↓+접촉반발↑ 균형, 지면=아주 큰 구체". 새 물리 0 — applyEntityGravity(0028)이 캐릭터를 행성 중심으로 끌고, applyEntityContact(0037)가 표면서 떠받쳐 평형 overlap*=F_grav/k 에 정착. 행성은 M≫m 라 거의 안 움직임. 어느 각도에 놓아도 선다(아래=방사).',
    mode: 'energy', dynamics: true, render: 'points',
    defaults: {},

    init(w) { build(w); },
    advance(w) { sim(w); },

    makeWorld() { return { N }; },
    frames: [1, 8, 20, 80],                                   // 떨어짐 → 닿음 → 정착
    captureOpts: { N, color: (v) => v >= 0.9 ? [235, 70, 60] : [120, 95, 70] },   // 캐릭터=빨강·행성=흙빛
    toFrame(w) {
      const p = w.__e[0], c = w.__e[1];
      return { pts: [
        { cx: p.cx, cy: N - p.cy, r: R, v: 0.3 },             // 행성(큰 구체)
        { cx: c.cx, cy: N - c.cy, r: 1.2, v: 1.0 },           // 캐릭터
      ] };
    },

    note: '<b>게임의 최소 단위 — 작은 구체(캐릭터)가 *아주 큰 구체*(행성=지면) 표면에 *중력↓ + 접촉↑ 균형*으로 선다.</b> CLAUDE.md §4: "선 캐릭터 = 중력(무게)↓ + 접촉 반발(떠받침)↑ 균형, 지면은 아주 큰 구체." 이 step 은 *새 물리 없이*(engine 변경 0) 이미 가진 두 법칙을 큰 구체 무대에서 함께 굴려 그 균형을 발현한다: <code>applyEntityGravity</code>(0028·쌍힘 N체 중력)이 가벼운 캐릭터를 *무거운* 행성 중심으로 끌고(중력=방사·**아래는 중심 방향**), <code>applyEntityContact</code>(0037·Hooke 반발+법선 감쇠)가 표면에서 떠받쳐 — 평형 overlap*=F_grav/k 에서 멈춘다(감쇠가 진동을 죽여 *정착*). 행성은 *아주 무거워*(M=4000≫m=1) 캐릭터가 당겨도 거의 안 움직인다(0.001) — **author-anchoring 없이** "큰 구체"가 그 자체로 지면(무게가 곧 부동성). <b>측정(verify)</b>: ① <b>정착</b> 캐릭터 최종 속도 ≈0(감쇠로 멈춤) ② <b>균형</b> 접촉력 F_c=k·overlap = 중력 F_g 정확(ratio 1.0000 — 떠받침=무게) ③ <b>안 가라앉음</b> overlap 유계(터널링 0·표면 위) ④ <b>어디든 선다</b> 캐릭터를 꼭대기·옆구리·대각 어디에 놓아도 같은 분리거리에 정착(아래=방사·자기일관) ⑤ 운동량 보존(planet+char·쌍힘) ⑥ 결정론. <b>흐름</b>(capture·탑다운): 빨간 캐릭터가 흙빛 행성 위로 떨어져 표면에 닿고 — 튕김 없이 *얹혀 선다*. <b>큰 그림</b>: 이 "선 캐릭터"가 PW-A 의 토대 — 다음 step 이 여기에 제어 힘(0109)을 얹어 표면을 *걷고*(0111) *뛴다*(0112). <b>원칙 준수</b>: 지면=무거운 구체(타입 아님)·중력/접촉=generic 쌍힘 법칙·engine 변경 0. <b>정직한 한계</b>: 행성 M 유한(미세 반작용 드리프트 0.001)·접촉 단일 점(표면 곡률 무시)·아직 정지(걷기는 0111).'
  };
});
