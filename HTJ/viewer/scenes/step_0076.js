// viewer/scenes/step_0076.js — SW5 격자 은퇴 역이주: 격자 유체 → SPH 입자 → *다시* 격자(왕복=항등·가역 은퇴).
//   0051/0055 는 격자를 SPH 로 이주시켰다(은퇴의 일방). 새 엔진 법칙 particlesToFluid 가 그 *역*을 더해 왕복을 닫는다:
//   격자 블롭(청록 셀) → 자유 SPH 입자(주황·퍼짐) → particlesToFluid 로 *다시 격자에 녹아듦*(청록 셀). "은퇴"가
//   일방이 아니라 *가역*(SPH 가 필요 없어진 영역을 격자로 되접음)임을 보인다. 중앙 z-슬라이스 top-down.
//
//   engine 법칙(htj-sph.js particlesToFluid·VER 17). UMD(브라우저·Node).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require);
  else { root.HTJScenes = root.HTJScenes || {}; root.HTJScenes['0076'] = factory(null); }
})(typeof self !== 'undefined' ? self : this, function (require) {
  const W = require ? require('../../engine/htj-world.js') : self.HTJWorld;
  const SPH = require ? require('../../engine/htj-sph.js') : self.HTJSph;
  const En = require ? require('../../engine/htj-entity.js') : self.HTJEntity;
  const FIELDS = ['energy', 'mom_x', 'mom_y', 'mom_z', 'therm'];

  const N = 30;
  function emptyWorld() { const w = W.createWorld(N); for (const f of FIELDS) if (!w.fields[f]) w.addField(f); return w; }
  function build(w) {
    const g = emptyWorld(), c = (N - 1) / 2, sig = N * 0.16;
    const rho = g.fields.energy, u = g.fields.therm;
    for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const d2 = (x - c) ** 2 + (y - c) ** 2 + (z - c) ** 2, i = (z * N + y) * N + x;
      const r = 2.0 * Math.exp(-d2 / (2 * sig * sig)); if (r < 0.02) continue;
      rho[i] = r; u[i] = r * 0.3;
    }
    w.__grid = g; w.__parts = null; w.__mode = 'grid'; w.__c = c;
  }
  function advance(w) {
    if (w.__mode === 'grid' && !w.__parts) {                 // 격자 → SPH 이주(0055·격자 비움)
      const mig = SPH.migrateRegionToSPH(w.__grid, {});
      w.__parts = mig.particles;
      for (const p of w.__parts) { const dx = p.cx - w.__c, dy = p.cy - w.__c; const r = Math.hypot(dx, dy) || 1; p.px += dx / r * 0.7; p.py += dy / r * 0.7; }  // 바깥으로 퍼지게
      w.__mode = 'sph';
    } else if (w.__mode === 'sph' && !w.__drifted) {         // 자유 입자가 퍼진다(Lagrangian)
      for (let s = 0; s < 18; s++) En.stepEntities(w.__parts, 0.05);
      w.__drifted = true;
    } else if (w.__mode === 'sph') {                         // SPH → 격자 되돌림(역이주·이 step)
      const g = emptyWorld(); SPH.particlesToFluid(w.__parts, g);
      w.__grid = g; w.__mode = 'grid';
    }
  }

  function gridPts(g) {
    const rho = g.fields.energy, zc = Math.round((N - 1) / 2), pts = [];
    const span = (g.max ? g.max('energy') : 2) || 1;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const m = rho[(zc * N + y) * N + x]; if (m > 0.02) pts.push({ cx: x, cy: y, r: 0.62, v: Math.min(0.95, m / span) }); }
    return pts;
  }
  function partPts(parts) {
    const zc = (N - 1) / 2, pts = [];
    for (const p of parts) { if (Math.abs(p.cz - zc) > 2.2) continue; pts.push({ cx: p.cx, cy: p.cy, r: 0.7, v: 1 + Math.min(0.9, (p.mass || 0) / 2) }); }
    return pts;
  }

  return {
    label: 'step_0076 — SW5 격자 은퇴 역이주: 격자→SPH→격자 왕복(가역 은퇴)',
    title: 'HTJ — 가역 은퇴: 격자 유체 ↔ SPH 입자(되돌릴 수 있다)',
    sub: '0051/0055 는 격자를 SPH 로 이주시켰다(은퇴의 일방). 새 엔진 법칙 particlesToFluid 가 역을 더해 왕복을 닫는다: 격자 블롭(청록) → 자유 SPH 입자(주황·퍼짐) → 다시 격자에 녹아듦(청록). 한 셀에 여럿 모이면 상대 KE→열로 총E 보존. 격자→SPH→격자 = 항등. 중앙 z-슬라이스.',
    mode: 'energy', dynamics: true, render: 'points',
    defaults: {},

    init(w) { build(w); },
    advance(w) { advance(w); },

    makeWorld() { return { N }; },
    frames: [0, 1, 2, 3],
    captureOpts: { N, color: (v) => v >= 1 ? [200, 120 + (v - 1) * 60, 55] : [38, 118 + v * 100, 150 + v * 95] },
    toFrame(w) {
      const pts = w.__mode === 'grid' ? gridPts(w.__grid) : partPts(w.__parts);
      const label = w.__mode === 'grid' ? (w.__parts ? '격자(되돌림)' : '격자(원본)') : (w.__drifted ? 'SPH 입자(퍼짐)' : 'SPH 입자');
      return { pts, mode: w.__mode, stage: label, count: pts.length };
    },

    note: '<b>격자 은퇴가 *가역*이다 — 격자 유체 ↔ SPH 입자를 양방향으로 오간다.</b> SW5 의 목표는 격자 유체(Eulerian)를 자유 구체/SPH(Lagrangian)로 *이주*시켜 격자를 은퇴하는 것이다(0051 fluidToParticles 복사·0055 migrateRegionToSPH 이동). 그러나 그건 *일방*이었다 — SPH 가 필요 없어진(다시 조밀·균질해진) 영역을 격자로 되접을 길이 없었다. 이 step 의 새 엔진 법칙 <code>particlesToFluid</code> 가 그 *역*을 더해 왕복을 닫는다: 입자를 제가 점유한 격자 셀(반올림 좌표)에 되쌓아(질량 ρ·운동량 mom·내부E therm 누적) 격자로 *녹인다*. <b>핵심</b>: 격자→SPH→격자 왕복이 <b>항등</b>(한 셀당 입자 하나면 셀별 정확 복원·verify 최대차 0)·한 셀에 여럿 모이면 bulk 운동량은 합쳐지고 *잃은 상대 운동 KE 는 열(internalE)로* 적립돼 <b>총E 정확 보존</b>(0031 demote 의 충돌→열 규약·verify 상대 KE 4→열 4). 격자 밖 입자는 경계 셀로 클램프(질량 손실 0). <b>의미</b>: "은퇴"가 일방 절벽이 아니라 *되돌릴 수 있는 표현 변환* — 영역마다 격자/SPH 를 비용에 맞게 오갈 수 있다(0026 promote·0031 demote 의 *유체 전체* 판이 양방향으로 닫힘). <b>흐름</b>(capture 4 프레임): 청록 격자 블롭 → (이주) 주황 SPH 입자 → (자유 운동) 퍼진 입자 → (역이주) 다시 청록 격자 셀로 녹아듦. <b>정직한 한계</b>: 되쌓기는 최근접 셀 반올림(셀 이하 위치는 양자화·CIC 보간 아님)·왕복은 *대량 이주*엔 정확하나 미세 위치는 격자 해상도로 양자화·viewer 는 중앙 z-슬라이스만(3D 전체는 입자 과중). 다음: 자동 양방향 이주 트리거(영역별 격자↔SPH 동적 선택)·통합 중력 SPH 판·안정 분절 침식.'
  };
});
