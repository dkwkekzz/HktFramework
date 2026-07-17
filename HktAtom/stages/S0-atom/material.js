// material.js — ㉒ MaterialModel ⇧ (실제 S1 입력). S0 의 *진짜* 출력 산출.
//
// ⑪ MVP(output.json v0)는 배관 증명이라 거시를 단일 macro 점(V·E·T·P 하나)으로만 남겼다.
// ㉒ 는 그 자리에 **굴려서 측정한 상태방정식 EOS 표** P(T,ρ)·U(T,ρ) 를 채운다 (author 0 —
//   실세계 앵커가 아니라 S0 시뮬을 T×ρ 그리드에서 NVT 로 굴린 측정값). 이것이 S1 이 굴릴
//   상태축 [T, ρ] 의 기반이며, 자기일관(C_v=∂U/∂T≈⑦)으로 검증한다.
//
// self-contained: 핵심 엔진(①–⑳)을 건드리지 않는다 (engine diff 0 — hbond/acidbase/… 동형).
//   engine·scenes·measure 만 재사용. output.json 은 CONTRACT §7 가법 확장(스키마 태그 유지·no-op 호환).
//
// 압력 정합 원칙: waterSoup(pairForces) 를 EOS 무대로 쓴다 — world.virial 이 힘 모델과 *정확히*
//   일치하기 때문(쿨롱+척력). polForces(분산 응집)는 분산 virial 을 world.virial 에 안 넣어
//   압력이 에너지와 불일치 → EOS 무대 부적합. 분산 응집의 EOS 접힘은 ㉒-b 후속(§경계).

(function () {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const E = isNode ? require('./engine.js') : window.HktS0Engine;
  const S = isNode ? require('./scenes.js') : window.HktS0Scenes;
  const M = isNode ? require('./measure.js') : window.HktS0Measure;

  // 물질 에너지 = 개체 안에 든 에너지만 (병진+퍼텐셜+내부). 떠난 에너지(복사·탈출·핵)는 제외
  //   — S1 개체의 u′ 로 접히는 것은 물질 에너지뿐 (promote.matterEnergy 동형·회계 정직).
  const LEFT_BINS = { E_photon: 1, E_escape: 1, E_nuclear: 1 };
  function matterEnergy(world) {
    E.recomputeLedger(world);
    let s = 0; for (const b of E.LEDGER_BINS) if (!LEFT_BINS[b]) s += world.ledger[b];
    return s;
  }

  // NVT 항온조: 목표 T 로 병진 KE 재척도. 뺀/넣은 열은 E_escape 로 회계 → 장부 닫힘
  //   (scenes.thermoReservoir 동형 — ④ 복사 냉각과 같은 정직). frozenZ 2D: T = 2K/(2N) = K/N.
  function thermostat(world, Ttar) {
    const n = world.atoms.length; if (!n) return;
    E.recomputeLedger(world);
    const dof = world.frozenZ ? 2 : 3;
    const Kb = world.ledger.K_tr, Tc = 2 * Kb / (dof * n);
    if (Tc <= 1e-12) return;
    const sc = Math.sqrt(Ttar / Tc);
    for (const a of world.atoms) { a.p.x *= sc; a.p.y *= sc; if (!world.frozenZ) a.p.z *= sc; }
    E.recomputeLedger(world);
    world.ledger.E_escape += Kb - world.ledger.K_tr;   // 저수지 회계 (장부 닫힘)
  }

  // 평형화: NVT 로 굴려 정상 상태에 도달. thermoEvery tick 마다 항온조.
  function equilibrate(world, Ttar, ticks, thermoEvery) {
    thermoEvery = thermoEvery || 20;
    for (let k = 0; k < ticks; k++) { E.step(world); if (k % thermoEvery === 0) thermostat(world, Ttar); }
  }

  // 표본화: 평형 후 NVT 유지하며 P(비리얼)·U(물질) 를 stride 마다 채집 → 시계열.
  function sample(world, Ttar, ticks, stride, thermoEvery) {
    stride = stride || 100; thermoEvery = thermoEvery || 20;
    const Ps = [], Us = [], Ts = [];
    for (let k = 0; k < ticks; k++) {
      E.step(world);
      if (k % thermoEvery === 0) thermostat(world, Ttar);
      if (k % stride === 0) { Ps.push(M.pressure(world)); Us.push(matterEnergy(world)); Ts.push(M.temperature(world)); }
    }
    return { Ps, Us, Ts };
  }

  const mean = (xs) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
  const stderr = (xs) => { if (xs.length < 2) return 0; const m = mean(xs); const v = xs.reduce((a, b) => a + (b - m) * (b - m), 0) / (xs.length - 1); return Math.sqrt(v / xs.length); };

  // ── EOS 한 점 (T, ρ) 측정 ──
  //   ρ 를 상자 크기로 실현: frozenZ 2D 넓이 A=N/ρ → L=√(N/ρ). waterSoup(N=3n) 을 그 L·T0=T 로
  //   빌드 → 평형 → 표본. 반응성(공유 결합) 활성이라 EOS 는 *반응 혼합물*의 상태함수 (정직).
  function eosPoint(T, rho, opts) {
    opts = opts || {};
    const n = opts.n || 16;                       // waterSoup n → N = 3n 원자
    const N = 3 * n;
    const L = Math.sqrt(N / rho);                 // 2D 넓이 = N/ρ
    const w = S.waterSoup({ n, L, T0: T, seed: opts.seed || 1001 });
    equilibrate(w, T, opts.eqTicks || 4000);
    const s = sample(w, T, opts.sampleTicks || 3000, opts.stride || 150);
    return {
      T, rho, N, L: +L.toFixed(3),
      P: mean(s.Ps), Perr: stderr(s.Ps),
      U: mean(s.Us), Uerr: stderr(s.Us),
      Tmeas: mean(s.Ts),
      nSamp: s.Ps.length,
    };
  }

  // ── EOS 그리드 측정: 각 (T,ρ) 를 R 회 반복(다른 seed) → 반복 평균 + 반복 간 표준오차 ──
  function measureEOS(opts) {
    opts = opts || {};
    const Tgrid = opts.Tgrid || [0.30, 0.50, 0.70];
    const rhoGrid = opts.rhoGrid || [0.12, 0.20, 0.30];
    const R = opts.R || 3;
    const nT = Tgrid.length, nR = rhoGrid.length;
    const P = [], U = [], Perr = [], Uerr = [], Tmeas = [];
    for (let ti = 0; ti < nT; ti++) {
      P.push([]); U.push([]); Perr.push([]); Uerr.push([]); Tmeas.push([]);
      for (let ri = 0; ri < nR; ri++) {
        const Pr = [], Ur = [], Tr = [];
        for (let rep = 0; rep < R; rep++) {
          const pt = eosPoint(Tgrid[ti], rhoGrid[ri], Object.assign({}, opts, { seed: 1001 + rep * 37 + ti * 7 + ri * 3 }));
          Pr.push(pt.P); Ur.push(pt.U); Tr.push(pt.Tmeas);
        }
        P[ti].push(+mean(Pr).toFixed(5)); U[ti].push(+mean(Ur).toFixed(5));
        Perr[ti].push(+stderr(Pr).toFixed(5)); Uerr[ti].push(+stderr(Ur).toFixed(5));
        Tmeas[ti].push(+mean(Tr).toFixed(4));
        if (opts.log) opts.log(`EOS T=${Tgrid[ti]} ρ=${rhoGrid[ri]}: P=${mean(Pr).toFixed(4)} U=${mean(Ur).toFixed(3)} (R=${R})`);
      }
    }
    return { form: 'table', grid: { T: Tgrid.slice(), rho: rhoGrid.slice() }, P, U, Perr, Uerr, Tmeas, n: opts.n || 16, N: 3 * (opts.n || 16), R };
  }

  // ── 자기일관: 등적 열용량 C_v(ρ) = ∂U/∂T (T 격자 유한차분). 양수·유한이어야 (열역학 안정) ──
  //   ⑦ 은 분자당 C_v 계단(1→3/2→5/2)을 냈다 — 여기 반응 혼합물 C_v 는 그 위에 반응 기여가 얹혀
  //   더 크다(가열이 결합을 끊어 U↑ 추가) — 부호·유한만 assert, 값은 기록 (반응 열용량).
  function cvColumns(eos) {
    const { T } = eos.grid, nR = eos.grid.rho.length, cols = [];
    for (let ri = 0; ri < nR; ri++) {
      const cv = [];
      for (let ti = 1; ti < T.length; ti++) {
        const dU = eos.U[ti][ri] - eos.U[ti - 1][ri], dT = T[ti] - T[ti - 1];
        cv.push(+(dU / dT).toFixed(4));
      }
      cols.push({ rho: eos.grid.rho[ri], cv });
    }
    return cols;
  }

  // ── output.json 가법 확장 (CONTRACT §7: 스키마 태그 유지·미존재 시 no-op·기존 소비자 불변) ──
  //   base = 기존 v0 출력(promote.buildOutput 또는 현 output.json). version 0.1 → 0.2.
  function buildMaterialModel(base, eos, opts) {
    opts = opts || {};
    const out = JSON.parse(JSON.stringify(base));
    out.version = '0.2';
    const Ts = eos.grid.T, rhos = eos.grid.rho;
    // 상태 변수 축 (S1 이 굴릴 축)
    out.stateVariables = [
      { name: 'T', range: [Ts[0], Ts[Ts.length - 1]] },
      { name: 'rho', range: [rhos[0], rhos[rhos.length - 1]] },
      { name: 'composition', range: null },
    ];
    // 측정된 상태방정식 (author 0)
    out.equationOfState = {
      form: 'table',
      grid: { T: Ts, rho: rhos },
      P: eos.P, U: eos.U,
      note: 'NVT 그리드 굴림 측정 (반응성 중성 수프 N=' + eos.N + '·R=' + eos.R + '). P=비리얼(비결합쌍)·U=물질 에너지. 분산 응집 virial 접힘은 ㉒-b.',
    };
    // 자기일관 지표
    const cv = cvColumns(eos);
    // 오차 한계 (S1 오차 전파용)
    out.errorBounds = {
      P: { grid: eos.Perr, protocol: 'R런 반복 간 표준오차' },
      U: { grid: eos.Uerr, protocol: 'R런 반복 간 표준오차' },
      cv: { columns: cv, note: 'C_v=∂U/∂T 유한차분 (양수=열역학 안정)' },
    };
    // 관측량 계약에 EOS 추가 (선언 목록)
    out.observables = (base.observables || []).slice();
    if (!out.observables.some((o) => o.name === 'EOS')) {
      out.observables.push({ name: 'EOS', epsilon: 0.3, protocol: 'P(T,ρ)·U(T,ρ) 표 — NVT 굴림 측정·R런 표준오차 이내' });
    }
    // validRange: 상단은 원본 유지 (CONTRACT §7 가법·S1 이 이미 소비 — 좁히지 않는다).
    //   EOS 의 유효 범위는 그리드 자체가 문서화 → equationOfState.validRange 로 별도 기록.
    out.validRange = base.validRange;
    out.equationOfState.validRange = { T: [Ts[0], Ts[Ts.length - 1]], rho: [rhos[0], rhos[rhos.length - 1]] };
    out.provenance = Object.assign({}, base.provenance, {
      scenes: (base.provenance && base.provenance.scenes || []).concat(['s10-water-soup(eos-grid)']),
      note: 'S0 출력 v0.2 — ⑪ MVP 배관 위에 ㉒-a 측정 EOS 표 가법. S1 상태축[T,ρ] 기반.',
    });
    return out;
  }

  // 스키마 검증 (v0 하위호환 유지 + EOS 블록 유효성)
  function validateMaterial(out) {
    const errs = [];
    const req = (c, m) => { if (!c) errs.push(m); };
    const eos = out.equationOfState;
    req(eos && eos.form === 'table' && eos.grid, 'equationOfState.grid');
    if (eos && eos.grid) {
      const nT = eos.grid.T.length, nR = eos.grid.rho.length;
      req(Array.isArray(eos.P) && eos.P.length === nT && eos.P.every((row) => row.length === nR), 'P 표 차원 = T×ρ');
      req(Array.isArray(eos.U) && eos.U.length === nT && eos.U.every((row) => row.length === nR), 'U 표 차원 = T×ρ');
      let finite = true; for (const row of (eos.P || []).concat(eos.U || [])) for (const v of row) if (!isFinite(v)) finite = false;
      req(finite, 'EOS 표 전 항 유한');
    }
    req(out.errorBounds && out.errorBounds.P && out.errorBounds.U, 'errorBounds P·U (발효 조건 CONTRACT §3)');
    req(out.stateVariables && out.stateVariables.length >= 2, 'stateVariables [T,ρ]');
    req(out.observables && out.observables.some((o) => o.name === 'EOS'), 'observables EOS 선언');
    return { ok: errs.length === 0, errs };
  }

  // node 헤드리스 눈 확인용 ASCII 히트맵 (field='P'|'U'). 뷰어(index.html)의 대체 스냅샷.
  function asciiHeatmap(eos, field) {
    const G = eos[field], Ts = eos.grid.T, rhos = eos.grid.rho;
    let lo = Infinity, hi = -Infinity;
    for (const row of G) for (const v of row) { if (v < lo) lo = v; if (v > hi) hi = v; }
    const ramp = ' .:-=+*#%@';
    const lines = [`  ${field}(T,ρ)  [${lo.toFixed(3)} … ${hi.toFixed(3)}]`];
    lines.push('  ρ→ ' + rhos.map((r) => r.toFixed(2).padStart(6)).join(''));
    for (let ti = Ts.length - 1; ti >= 0; ti--) {
      const cells = G[ti].map((v) => { const f = hi > lo ? (v - lo) / (hi - lo) : 0; const ch = ramp[Math.min(ramp.length - 1, Math.floor(f * ramp.length))]; return (ch + ' ' + v.toFixed(2)).padStart(6); }).join('');
      lines.push('T' + Ts[ti].toFixed(2) + ' ' + cells);
    }
    return lines.join('\n');
  }

  const api = { matterEnergy, thermostat, equilibrate, sample, eosPoint, measureEOS, cvColumns, buildMaterialModel, validateMaterial, asciiHeatmap, mean, stderr };
  if (isNode) module.exports = api;
  else window.HktS0Material = api;
})();
