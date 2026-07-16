// verify.js — 검증 하네스 (KERNEL §7 검증 4기둥의 수치화).
//
// 세부 단계 ①: ① 자체 완전 실행 ② 닫힌 장부(전 통 합 보존·P 보존·Σc 불변)
// ③ 수치 불변식(dt 반감·경계 3종) ④ R런 통계(⟨T⟩ 목표 창).
// node 로: `node verify.js`. 브라우저에선 index.html 이 같은 함수를 부른다.
//
// 이 하네스의 러너·통계·불변식 스위트는 **이후 모든 세부 단계가 재사용**한다.

(function () {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const E = isNode ? require('./engine.js') : window.HktS0Engine;
  const S = isNode ? require('./scenes.js') : window.HktS0Scenes;
  const M = isNode ? require('./measure.js') : window.HktS0Measure;

  // ── 통계·assert 유틸 ──
  function stat(R, fn) {
    const xs = [];
    for (let i = 0; i < R; i++) xs.push(fn(i));
    const n = xs.length;
    const mean = xs.reduce((a, b) => a + b, 0) / n;
    const varc = xs.reduce((a, b) => a + (b - mean) * (b - mean), 0) / Math.max(1, n - 1);
    const sd = Math.sqrt(varc);
    return { mean, sd, se: sd / Math.sqrt(n), n };
  }
  function assertExact(name, x, target, tol, log) {
    const ok = Math.abs(x - target) <= tol;
    log.push({ ok, name, msg: `${name}: |${fmt(x)} − ${fmt(target)}| = ${fmt(Math.abs(x - target))} ≤ ${tol}` });
    return ok;
  }
  function assertWindow(name, x, target, tolWin, log) {
    // 통계 창: |mean − target| ≤ tolWin (tolWin = 3·se 등 호출부가 정함)
    const ok = Math.abs(x - target) <= tolWin;
    log.push({ ok, name, msg: `${name}: mean ${fmt(x)} vs target ${fmt(target)} (창 ±${fmt(tolWin)})` });
    return ok;
  }
  function fmt(x) { return (typeof x === 'number' && isFinite(x)) ? x.toPrecision(6) : String(x); }

  // ── 러너: 장면을 ticks 만큼 굴리고 관측량을 반환 ──
  function runScene(name, opts) {
    const w = S.build(name, opts);
    const ticks = (opts && opts.ticks) || 1000;
    const E0 = M.ledgerTable(w);
    const P0 = M.momentum(w);
    const c0 = M.composition(w);
    E.run(w, ticks);
    return {
      world: w,
      T: M.temperature(w),
      MSD: M.msd(w),
      ledger0: E0, ledger1: M.ledgerTable(w),
      P0, P1: M.momentum(w),
      comp0: c0, comp1: M.composition(w),
    };
  }

  function compEqual(a, b) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) if ((a[k] || 0) !== (b[k] || 0)) return false;
    return true;
  }
  function pDiff(a, b) { return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.z - b.z)); }

  // ── 검증 스위트 ──
  function suite() {
    const log = [];

    // 1. 회계 (정확): 주기 이상 기체 — 힘 0 이므로 전 통 합·P 정확 보존
    {
      const r = runScene('s01-ideal-gas', { seed: 101, N: 64, T0: 1.0, ticks: 2000, dt: 0.01 });
      assertExact('회계·장부합보존', r.ledger1.total, r.ledger0.total, 1e-12, log);
      assertExact('회계·P보존', pDiff(r.P1, r.P0), 0, 1e-9, log);
      assertExact('회계·P총합0(COM제거)', E.V.len(r.P1), 0, 1e-9, log);
      log.push({ ok: compEqual(r.comp0, r.comp1), name: '회계·Σc불변',
        msg: `Σc: ${JSON.stringify(r.comp0)} → ${JSON.stringify(r.comp1)}` });
      // z 동결은 step() 내부 assert 가 던지므로, 여기까지 왔으면 통과
      log.push({ ok: true, name: '회계·z동결', msg: 'frozenZ assert 통과 (|z|,|pz| ≤ 1e-12 매 tick)' });
    }

    // 2. dt 반감 (수치 불변식): 같은 초기조건을 dt·dt/2 로 같은 물리 시간 굴려 관측량 비교
    {
      const base = { seed: 202, N: 64, T0: 1.0, L: 20 };
      const Tphys = 20;
      const a = runScene('s01-ideal-gas', Object.assign({}, base, { dt: 0.02, ticks: Tphys / 0.02 }));
      const b = runScene('s01-ideal-gas', Object.assign({}, base, { dt: 0.01, ticks: Tphys / 0.01 }));
      const relT = Math.abs(a.T - b.T) / Math.max(1e-12, Math.abs(b.T));
      const relMSD = Math.abs(a.MSD - b.MSD) / Math.max(1e-12, Math.abs(b.MSD));
      assertExact('dt반감·T상대차', relT, 0, 1e-9, log);
      assertExact('dt반감·MSD상대차', relMSD, 0, 1e-9, log);
    }

    // 3. 경계 3종
    {
      // periodic: 위치가 항상 상자 안
      const wp = S.build('s01-ideal-gas', { seed: 303, N: 64, T0: 1.5, dt: 0.01 });
      E.run(wp, 1500);
      let inBox = true;
      for (const at of wp.atoms) if (at.r.x < 0 || at.r.x > wp.box.L.x || at.r.y < 0 || at.r.y > wp.box.L.y) inBox = false;
      log.push({ ok: inBox, name: '경계·주기랩', msg: `모든 원자 위치 ∈ 상자: ${inBox}` });

      // reflect: 에너지 보존 + 입자 상자 안 유지
      const wr = S.build('s01-ideal-gas', { seed: 404, N: 64, T0: 1.5, dt: 0.01, bc: 'reflect' });
      const E0r = M.ledgerTable(wr).total;
      E.run(wr, 1500);
      assertExact('경계·반사E보존', M.ledgerTable(wr).total, E0r, 1e-9, log);
      let inBoxR = true;
      for (const at of wr.atoms) if (at.r.x < -1e-9 || at.r.x > wr.box.L.x + 1e-9) inBoxR = false;
      log.push({ ok: inBoxR, name: '경계·반사가둠', msg: `반사로 상자 안 유지: ${inBoxR}` });

      // open: 탈출 회계 — E_total(E_escape 포함)·P+P_escape 보존, 일부 실제 탈출
      const r = runScene('s01-open-box', { seed: 505, N: 64, T0: 2.0, ticks: 3000, dt: 0.02 });
      assertExact('경계·열림E보존(탈출포함)', r.ledger1.total, r.ledger0.total, 1e-9, log);
      assertExact('경계·열림P보존(P_escape포함)', pDiff(r.P1, r.P0), 0, 1e-9, log);
      const escaped = r.world.escaped.length;
      log.push({ ok: escaped > 0, name: '경계·열림탈출발생', msg: `탈출 원자 ${escaped}/${64} · E_escape=${fmt(r.ledger1.E_escape)}` });
      log.push({ ok: compEqual(r.comp0, r.comp1), name: '경계·열림Σc불변(활성+탈출)',
        msg: `Σc: ${JSON.stringify(r.comp0)} → ${JSON.stringify(r.comp1)}` });
    }

    // 4. R런 통계: ⟨T⟩ 가 목표 창 안. COM 제거로 유효 자유도 (N−1)·dofPer → 목표=(1−1/N)·T0
    {
      const R = 12, N = 64, T0 = 1.0;
      const st = stat(R, (i) => runScene('s01-ideal-gas', { seed: 900 + i, N, T0, ticks: 1000, dt: 0.01 }).T);
      const target = T0 * (N - 1) / N;   // COM 표류 제거의 편향 (정직)
      const win = 3 * st.se + 1e-9;
      assertWindow('통계·⟨T⟩목표', st.mean, target, win, log);
      log.push({ ok: true, name: '통계·⟨T⟩분포', msg: `mean=${fmt(st.mean)} sd=${fmt(st.sd)} se=${fmt(st.se)} (R=${R})` });
    }

    return log;
  }

  function report(log) {
    let pass = 0, fail = 0;
    for (const e of log) {
      const tag = e.ok ? 'PASS' : 'FAIL';
      console.log(`[${tag}] ${e.msg}`);
      if (e.ok) pass++; else fail++;
    }
    console.log(`\n── S0-① verify: ${pass} PASS · ${fail} FAIL ──`);
    return fail === 0;
  }

  const api = { stat, assertExact, assertWindow, runScene, suite, report };
  if (isNode) {
    module.exports = api;
    if (require.main === module) {
      const ok = report(suite());
      process.exit(ok ? 0 : 1);
    }
  } else {
    window.HktS0Verify = api;
  }
})();
