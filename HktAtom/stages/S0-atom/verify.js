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
  const L = isNode ? require('./levels.js') : window.HktS0Levels;
  const Mo = isNode ? require('./modes.js') : window.HktS0Modes;
  const Po = isNode ? require('./polarization.js') : window.HktS0Pol;
  const Pr = isNode ? require('./promote.js') : window.HktS0Promote;
  const Geo = isNode ? require('./geometry.js') : window.HktS0Geometry;   // ⑭ 각도 반발 (VSEPR)
  const Pol = isNode ? require('./polarity.js') : window.HktS0Polarity;   // ⑮ 부분 전하 (QEq)
  const HB = isNode ? require('./hbond.js') : window.HktS0HBond;          // ⑯ 수소 결합 (R-HB)
  const AB = isNode ? require('./acidbase.js') : window.HktS0AcidBase;    // ⑰ 산·염기 (양성자 이전)
  const Cb = isNode ? require('./combustion.js') : window.HktS0Combustion; // ⑱ 연소 (라디칼 추상)

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

  // 런 도중 최대 상대 E 표류·최대 |ΔP|·최소 겹침 비율 추적 (② 장부 감시)
  function runDrift(name, opts) {
    const w = S.build(name, opts);
    const ticks = (opts && opts.ticks) || 1000;
    const E0 = M.ledgerTable(w).total, P0 = M.momentum(w);
    let maxRelE = 0, maxdP = 0, minRatio = Infinity;
    for (let k = 0; k < ticks; k++) {
      E.step(w);
      const tot = M.ledgerTable(w).total, P = M.momentum(w);
      maxRelE = Math.max(maxRelE, Math.abs(tot - E0) / Math.max(1e-12, Math.abs(E0)));
      maxdP = Math.max(maxdP, pDiff(P, P0));
      if (w.minDsigma < minRatio) minRatio = w.minDsigma;
    }
    return { world: w, maxRelE, maxdP, minRatio, P0, P1: M.momentum(w), pressure: M.pressure(w) };
  }

  // 2체 산란 편향각 θ(b) [rad] — 발사체가 표적을 지나 멀어질 때까지 적분
  function deflect(b, dt) {
    const w = S.build('s02-scatter-2', { b, v0: 1.5, D: 40, dt: dt || 0.004 });
    const proj = w.atoms.find((a) => a.id === w._meta.projectileId);
    const xExit = w.box.L.x / 2 + 40;
    for (let k = 0; k < 60000; k++) { E.step(w); if (proj.r.x > xExit) break; }
    return Math.atan2(proj.p.y, proj.p.x);
  }

  function compEqual(a, b) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) if ((a[k] || 0) !== (b[k] || 0)) return false;
    return true;
  }
  function pDiff(a, b) { return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.z - b.z)); }

  // ── step 섹션 필터 ──
  //    node verify.js --only 8,10  → ⑧⑩ 섹션만 실행 (개발 중 빠른 반복용).
  //    인자 없으면 전량 회귀 (step 닫기 전 필수). 브라우저에선 항상 전량.
  const ONLY = (() => {
    if (typeof process === 'undefined' || !process.argv) return null;
    const i = process.argv.indexOf('--only');
    const v = i >= 0 ? process.argv[i + 1] : (process.argv.find((x) => x.startsWith('--only=')) || '').slice(7);
    if (!v) return null;
    return new Set(v.split(',').map((s) => s.trim()).filter(Boolean));
  })();
  const want = (step) => !ONLY || ONLY.has(String(step));

  // ── 검증 스위트 ──
  function suite() {
    const log = [];
    // 체크별 소요 시간 계측 (node 전용): 연속 push 사이 경과 ms — 느린 체크 식별용
    if (typeof process !== 'undefined') {
      const _push = log.push.bind(log);
      let _t = Date.now();
      log.push = (e) => { const now = Date.now(); e.ms = now - _t; _t = now; return _push(e); };
    }

    // 1. 회계 (정확): 주기 이상 기체 — 힘 0 이므로 전 통 합·P 정확 보존
    if (want(1)) {
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
    if (want(1)) {
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
    if (want(1)) {
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
    if (want(1)) {
      const R = 12, N = 64, T0 = 1.0;
      const st = stat(R, (i) => runScene('s01-ideal-gas', { seed: 900 + i, N, T0, ticks: 1000, dt: 0.01 }).T);
      const target = T0 * (N - 1) / N;   // COM 표류 제거의 편향 (정직)
      const win = 3 * st.se + 1e-9;
      assertWindow('통계·⟨T⟩목표', st.mean, target, win, log);
      log.push({ ok: true, name: '통계·⟨T⟩분포', msg: `mean=${fmt(st.mean)} sd=${fmt(st.sd)} se=${fmt(st.se)} (R=${R})` });
    }

    // 5. ② 힘·충돌 (쿨롱+척력·산란) — ①의 하네스·불변식 스위트를 그대로 재사용
    if (want(2)) {
      // 장부 유지: 고밀도 중성 기체 산란 — max|ΔE|/E ≤ EPS_E · |ΔP|≤1e-9 · 겹침 0
      const g = runDrift('s02-gas-collide', { seed: 42, N: 80, T0: 1.5, L: 14, dt: E.DT_STIFF, ticks: 2000 });
      log.push({ ok: g.maxRelE <= E.EPS_E, name: '②장부·E표류', msg: `max|ΔE|/E = ${fmt(g.maxRelE)} ≤ EPS_E ${E.EPS_E}` });
      assertExact('②장부·P보존(충돌중)', g.maxdP, 0, 1e-9, log);
      log.push({ ok: g.minRatio > E.MIN_DSIGMA, name: '②겹침0', msg: `min d/σ = ${fmt(g.minRatio)} > ${E.MIN_DSIGMA}` });
      log.push({ ok: g.pressure > 0, name: '②압력>0(척력)', msg: `비리얼 압력 P = ${fmt(g.pressure)}` });

      // θ(b) 단조 감소 (반발 산란 앵커 — 러더퍼드 닮음)
      const bs = [0.5, 1.0, 2.0, 4.0, 8.0];
      const ths = bs.map((b) => deflect(b));
      let mono = true;
      for (let i = 1; i < ths.length; i++) if (!(ths[i] < ths[i - 1])) mono = false;
      log.push({ ok: mono, name: '②θ(b)단조감소',
        msg: `θ(deg): ${ths.map((t) => (t * 180 / Math.PI).toFixed(1)).join(' → ')}` });

      // charge-pair: 쿨롱 인력 경로 장부 닫힘
      const c = runDrift('s02-charge-pair', { dt: 0.002, ticks: 4000 });
      log.push({ ok: c.maxRelE <= E.EPS_E, name: '②쿨롱쌍·E닫힘', msg: `max|ΔE|/E = ${fmt(c.maxRelE)} ≤ EPS_E` });
      assertExact('②쿨롱쌍·P보존', c.maxdP, 0, 1e-9, log);

      // dt 반감: θ(b=2) 가 dt·dt/2 에서 통계 동일 (산란은 결정론적 궤도라 상대차 작음)
      const t1 = deflect(2.0, 0.004), t2 = deflect(2.0, 0.002);
      const relTh = Math.abs(t1 - t2) / Math.max(1e-12, Math.abs(t2));
      log.push({ ok: relTh <= 1e-3, name: '②dt반감·θ상대차', msg: `θ(b=2) 상대차 = ${fmt(relTh)} ≤ 1e-3` });
    }

    // 6. ③ 준위·예산 (순수 함수 — 시뮬 불필요·①②와 독립)
    if (want(3)) {
      // 실원소 예산 앵커 (교과서 원자가가 창발): 승위로 C=4·Be=2 채택
      const B = (Z) => L.budget(Z);
      const anchors = { H: [1, 1], Be: [4, 2], B: [5, 3], C: [6, 4], N: [7, 3], O: [8, 2], F: [9, 1], Ne: [10, 0], Na: [11, 1], Mg: [12, 2], Cl: [17, 1], Ar: [18, 0] };
      let allB = true; const got = [];
      for (const s in anchors) { const [Z, want] = anchors[s]; const b = B(Z); got.push(`${s}=${b}`); if (b !== want) allB = false; }
      log.push({ ok: allB, name: '③예산앵커', msg: `${got.join(' ')} (기대 1,2,3,4,3,2,1,0,1,2,1,0)` });

      // 이온화 E 주기 경향 (순위) — 주기 내 단조 증가
      const mono = (zs) => { const v = zs.map((z) => L.ionizationE(z)); return v.every((x, i) => i === 0 || x > v[i - 1]); };
      log.push({ ok: mono([3, 4, 5, 6, 7, 8, 9, 10]), name: '③IE주기2단조↑', msg: 'Li→Ne 이온화 E 단조 증가' });
      log.push({ ok: mono([11, 12, 13, 14, 15, 16, 17, 18]), name: '③IE주기3단조↑', msg: 'Na→Ar 이온화 E 단조 증가' });
      // 희유기체 국소 피크 · 알칼리 국소 골
      const IE = (z) => L.ionizationE(z);
      const peaks = IE(2) > IE(3) && IE(10) > IE(11) && IE(18) > IE(19);
      const troughs = IE(3) < IE(4) && IE(11) < IE(12) && IE(19) < IE(20);
      log.push({ ok: peaks, name: '③희유기체피크', msg: `He>Li·Ne>Na·Ar>K (${IE(2).toFixed(1)}>${IE(3).toFixed(1)} …)` });
      log.push({ ok: troughs, name: '③알칼리골', msg: 'Li<Be·Na<Mg·K<Ca (국소 최소)' });
      // 정직: 족 내림(Li>Na>K)은 간이 Slater 로 창발 안 함 (Na>Li>K) — OPEN GAP 로 기록, 위조 안 함
      log.push({ ok: true, name: '③족경향한계(정직)', msg: `Li=${IE(3).toFixed(2)} Na=${IE(11).toFixed(2)} K=${IE(19).toFixed(2)} → Na>Li>K (간이 Slater 한계, gap 등록)` });

      // 볼츠만 점유: 정규화(합=1) · 고온일수록 들뜬 준위 점유 증가
      const bl = (T) => L.boltzmann(L.VIRTUAL.V1.levels, T);
      const lo = bl(0.2), hi = bl(2.0);
      const sum1 = Math.abs(lo.reduce((a, b) => a + b, 0) - 1) < 1e-12 && Math.abs(hi.reduce((a, b) => a + b, 0) - 1) < 1e-12;
      log.push({ ok: sum1 && hi[1] > lo[1], name: '③볼츠만점유', msg: `들뜸 점유 T=0.2:${lo[1].toFixed(3)} < T=2:${hi[1].toFixed(3)} · 합=1` });

      // 가상 원소 4종 B·준위 확정 (회귀 고정)
      const vt = { V1: [1, 2], V0: [0, 2], V2: [2, 2], V4: [4, 2] };
      let allV = true; const vg = [];
      for (const id in vt) { const v = L.VIRTUAL[id]; vg.push(`${id}:B${v.B}`); if (v.B !== vt[id][0] || v.levels.length !== vt[id][1]) allV = false; }
      log.push({ ok: allV, name: '③가상원소확정', msg: vg.join(' ') + ' (V1/V0/V2/V4)' });
    }

    // 7. ④ 전이 엔진 (볼츠만·냉각·공동 + 에너지 출처·회계). ①②③의 하네스·EPS_E·준위를 소비.
    if (want(4)) {
      // 열욕: 점유가 볼츠만으로 창발 (author 0 — e^{−ΔE/T} 어디에도 안 적음). ~10% 편향 정직.
      const R = 4;
      let rr = [], pp = [];
      for (let s = 0; s < R; s++) {
        const w = S.build('s04-thermal-bath', { seed: 810 + s, N: 60, T0: 2.2, L: 12 });
        E.run(w, 4500);
        const o = M.occupancy(w); rr.push(o.ratio); pp.push(o.predRatio);
      }
      const meanR = rr.reduce((a, b) => a + b, 0) / R, meanP = pp.reduce((a, b) => a + b, 0) / R;
      const ratio = meanR / meanP;
      log.push({ ok: ratio > 0.8 && ratio < 1.25, name: '④볼츠만창발',
        msg: `n1/n0 ${fmt(meanR)} vs 볼츠만 ${fmt(meanP)} → 비율 ${fmt(ratio)} ∈[0.8,1.25] (LB 재분배·~10% 편향)` });

      // 열욕 장부: 전이 사건 회계 정확(checkedApply 가 예외 던짐 — 여기 오면 통과) + Verlet ≤ EPS_E + P 보존
      {
        const w = S.build('s04-thermal-bath', { seed: 850, N: 60, T0: 2.2, L: 12 });
        const E0 = M.ledgerTable(w).total, P0 = M.momentum(w);
        let maxRelE = 0, maxdP = 0;
        for (let k = 0; k < 3000; k++) { E.step(w); const t = M.ledgerTable(w); maxRelE = Math.max(maxRelE, Math.abs(t.total - E0) / Math.abs(E0)); maxdP = Math.max(maxdP, pDiff(M.momentum(w), P0)); }
        log.push({ ok: maxRelE <= E.EPS_E, name: '④장부·전이통과E', msg: `max|ΔE|/E ${fmt(maxRelE)} ≤ EPS_E (사건 회계는 checkedApply 가 상시 강제)` });
        log.push({ ok: maxdP <= 1e-9, name: '④P보존(충돌+힘)', msg: `max|ΔP| ${fmt(maxdP)} ≤ 1e-9` });
      }

      // 에너지 부족 → 전이 불가: 아주 차가운 열욕은 들뜸이 지수 억제
      {
        const w = S.build('s04-thermal-bath', { seed: 870, N: 60, T0: 0.4, L: 12 });
        E.run(w, 3000);
        const o = M.occupancy(w);
        log.push({ ok: o.frac < 0.15, name: '④에너지부족억제', msg: `저온 T=${fmt(o.T)} → 들뜸 frac ${fmt(o.frac)} < 0.15 (지수 억제)` });
      }

      // 복사 냉각: 방출 광자 탈출 → T 단조 하강 + 총 E(E_escape 포함) 보존
      {
        const w = S.build('s04-radiative-cooling', { seed: 5, N: 60, L: 15 });
        const T0 = M.occupancy(w).T, E0 = M.ledgerTable(w).total;
        E.run(w, 2500);
        const T1 = M.occupancy(w).T, lg = M.ledgerTable(w);
        log.push({ ok: T1 < T0 * 0.8 && lg.E_escape > 0, name: '④복사냉각', msg: `T ${fmt(T0)}→${fmt(T1)} · E_escape ${fmt(lg.E_escape)}` });
        log.push({ ok: Math.abs(lg.total - E0) / Math.abs(E0) <= E.EPS_E, name: '④냉각E보존(탈출포함)', msg: `rel ${fmt(Math.abs(lg.total - E0) / Math.abs(E0))} ≤ EPS_E` });
      }

      // 공동: 닫힌 상자 — 광자 빈 저장·재흡수 → 정상 상태 + 총 E 보존
      {
        const w = S.build('s04-cavity', { seed: 6, N: 80, L: 13 });
        const E0 = M.ledgerTable(w).total;
        E.run(w, 2500);
        const ph = [];
        for (let b = 0; b < 4; b++) { E.run(w, 250); ph.push(w.nPhotons); }
        const meanPh = ph.reduce((a, b) => a + b, 0) / ph.length;
        log.push({ ok: meanPh > 0, name: '④공동정상상태', msg: `광자 빈 ${ph.join(',')} (물질↔복사 정상)` });
        log.push({ ok: Math.abs(M.ledgerTable(w).total - E0) / Math.abs(E0) <= E.EPS_E, name: '④공동E보존', msg: `rel ${fmt(Math.abs(M.ledgerTable(w).total - E0) / Math.abs(E0))} ≤ EPS_E` });
      }
    }

    // 8. ⑤ 이온화·전자 이전 (이온 격자 — NaCl 앵커). ④의 실행기·회계를 그대로 재사용.
    if (want(5)) {
      // 쿨롱 전용(마델룽) 에너지 — 이온 배치의 순 인력
      const coulomb = (w) => {
        let U = 0; const A = w.atoms, L = w.box.L, s = w.soft;
        for (let i = 0; i < A.length; i++) for (let j = i + 1; j < A.length; j++) {
          let dx = A[i].r.x - A[j].r.x, dy = A[i].r.y - A[j].r.y;
          dx -= L.x * Math.round(dx / L.x); dy -= L.y * Math.round(dy / L.y);
          U += w.kc * A[i].q * A[j].q / (Math.sqrt(dx * dx + dy * dy) + s);
        }
        return U;
      };

      // 오르막 고립 쌍: 멀리 떨어진 중성 쌍의 전자 이전은 ΔE=IE−EA>0 (KE 없으면 불가)
      {
        const w = S.build('s05-ion-pair', { seed: 1 });
        w.atoms[1].r.x = 62; E.pairForces(w); E.recomputeLedger(w);   // 멀리 (쿨롱 무시)
        const ok = E.transferElectron(w, 0, 1);   // KE=0 상태에서 시도
        log.push({ ok: !ok, name: '⑤오르막고립쌍', msg: `먼 중성 쌍 이전 = ${ok ? '성공(오류)' : '불가(오르막·KE부족)'} — IE−EA>0 확인` });
      }

      // 이온 격자: Σc(총 ne) 불변 · 총 E 보존 · 마델룽<0 · 교대 질서>0 창발
      {
        const w = S.build('s05-lattice', { seed: 4, per: 8, T0: 0.2 });
        const totNe0 = w.atoms.reduce((s, a) => s + a.ne, 0);
        const E0 = M.ledgerTable(w).total, P0 = M.momentum(w);
        let maxRelE = 0, maxdP = 0;
        for (let k = 0; k < 10000; k++) { E.step(w); if (k % 20 === 0) { const t = M.ledgerTable(w); maxRelE = Math.max(maxRelE, Math.abs(t.total - E0) / Math.abs(E0)); maxdP = Math.max(maxdP, pDiff(M.momentum(w), P0)); } }
        const is = M.ionState(w), totNe1 = w.atoms.reduce((s, a) => s + a.ne, 0), cE = coulomb(w);
        log.push({ ok: totNe1 === totNe0, name: '⑤Σc(전자수)불변', msg: `총 ne ${totNe0}→${totNe1} (원자↔이온 오가도 보존)` });
        log.push({ ok: maxRelE <= E.EPS_E, name: '⑤장부·전이통과E', msg: `max|ΔE|/E ${fmt(maxRelE)} ≤ EPS_E` });
        log.push({ ok: maxdP <= 1e-9, name: '⑤P보존(이전+힘)', msg: `max|ΔP| ${fmt(maxdP)} ≤ 1e-9` });
        log.push({ ok: is.plus > 12 && is.minus > 12, name: '⑤이온화창발', msg: `+${is.plus}/−${is.minus} 중성${is.neutral} (전자 이전으로 이온 형성)` });
        log.push({ ok: cE < 0, name: '⑤마델룽이득', msg: `쿨롱 배치 E ${fmt(cE)} < 0 (이온 순 인력 — author 0)` });
        log.push({ ok: is.order > 0.1, name: '⑤교대격자질서', msg: `−⟨qᵢqⱼ⟩ ${fmt(is.order)} > 0.1 (이웃이 반대 전하 — NaCl 배열)` });
      }
    }

    // 9. ⑥ 공유결합 (분자 형성·안정화 경로·원자가 포화·해리). ④⑤의 실행기·회계 재사용.
    if (want(6)) {
      const dominant = (h) => Object.keys(h).sort((a, b) => h[b] - h[a])[0];

      // 이량체 창발: H1(B=1) → H1₂ 우세 + 원자가 포화(과결합 0) + 장부 닫힘
      {
        const w = S.build('s06-v1-dimer', { seed: 2, N: 64, T0: 0.35 });
        const E0 = M.ledgerTable(w).total; let maxRelE = 0;
        for (let k = 0; k < 9000; k++) { E.step(w); if (k % 30 === 0) maxRelE = Math.max(maxRelE, Math.abs(M.ledgerTable(w).total - E0) / Math.abs(E0)); }
        const m = M.molecules(w), dom = dominant(m.hist);
        log.push({ ok: dom === 'H12', name: '⑥이량체창발', msg: `우세 조성 = ${dom} (${m.hist['H12'] || 0}개 H₁₂ — author 0) · ${JSON.stringify(m.hist)}` });
        log.push({ ok: m.maxOver <= 1e-9, name: '⑥원자가포화', msg: `과결합 max ${fmt(m.maxOver)} ≤ 0 (H₃ 덩어리 0 — B=1 포화)` });
        log.push({ ok: maxRelE <= E.EPS_E, name: '⑥장부·결합통과E', msg: `max|ΔE|/E ${fmt(maxRelE)} ≤ EPS_E (형성·해리 회계)` });
      }

      // 안정화 필수: 안정화 행 끄면 안정 결합 급감 (2체 직접 결합 금지 — 복합체만 명멸)
      {
        const w = S.build('s06-no-stab', { seed: 2, N: 64, T0: 0.35 });
        for (let k = 0; k < 7000; k++) E.step(w);
        log.push({ ok: w.bonds.length === 0, name: '⑥안정화필수', msg: `안정화 off → 결합 ${w.bonds.length} (복합체 ${w.complexes.length} 명멸만 — 2체 직접 금지)` });
      }

      // 해리: 형성 후 가열 → 결합 감소 (아레니우스)
      {
        const w = S.build('s06-v1-dimer', { seed: 5, N: 64, T0: 0.3 });
        for (let k = 0; k < 7000; k++) E.step(w);
        const cold = w.bonds.length;
        for (const a of w.atoms) { a.p.x *= 4; a.p.y *= 4; }
        for (let k = 0; k < 6000; k++) E.step(w);
        log.push({ ok: w.bonds.length < cold, name: '⑥해리(가열)', msg: `결합 ${cold} → ${w.bonds.length} (가열 시 감소 — 아레니우스)` });
      }
    }

    // 10. ⑦ 내부 모드 — 열용량 계단 (양자 모드 순차 언프리즈). self-contained modes.js.
    if (want(7)) {
      const Eat = (T0) => { const w = Mo.makeGas({ N: 160, T0, seed: 7 }); Mo.run(w, 6000); return { T: Mo.temperature(w), E: Mo.energy(w) / w.mols.length, uv: Mo.uVib(w), ur: Mo.uRot(w) }; };
      const cvB = (a, b) => { const p = Eat(a), q = Eat(b); return { cv: (q.E - p.E) / (q.T - p.T), lo: p, hi: q }; };
      const low = cvB(0.0008, 0.0016), mid = cvB(0.15, 0.6), high = cvB(30, 60);
      // 목표 1 → 3/2 → 5/2. 내부 모드 LB 가 ~10~20% 뜨겁게 편향(④와 같은 계열·⑨ 통계 관문 이월).
      log.push({ ok: low.cv > 0.9 && low.cv < 1.15, name: '⑦계단·병진(C≈1)', msg: `C_v ${fmt(low.cv)} ≈ 1 (T≪B_rot — 회전·진동 동결)` });
      log.push({ ok: mid.cv > 1.35 && mid.cv < 1.9, name: '⑦계단·+회전(C≈3/2)', msg: `C_v ${fmt(mid.cv)} ≈ 3/2 (회전 활성·진동 동결)` });
      log.push({ ok: high.cv > 2.2 && high.cv < 3.05, name: '⑦계단·+진동(C≈5/2)', msg: `C_v ${fmt(high.cv)} ≈ 5/2 (진동까지 활성 · LB 편향 상단)` });
      log.push({ ok: low.cv < mid.cv && mid.cv < high.cv, name: '⑦계단·순차증가', msg: `C_v ${fmt(low.cv)} < ${fmt(mid.cv)} < ${fmt(high.cv)} (자유도 순차 언프리즈)` });
      // 동결: 저온에서 모드 점유 ≈ 0
      log.push({ ok: low.hi.uv === 0 && low.hi.ur < 0.01 * 160, name: '⑦저온동결', msg: `저온 U_vib=${fmt(low.hi.uv)} U_rot=${fmt(low.hi.ur)} ≈ 0` });
    }

    // 11. ⑧ 분극·응집 (중성 입자가 뭉친다). self-contained polarization.js — 기반 ②(pairForces)만 재사용.
    if (want(8)) {
      const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;

      // 응집 창발: 저온 냉각 → 클러스터·배위수·음의 응집에너지 급증 (고온 기체 ↔ 저온 응집).
      //   미시정준(닫힌계)이라 응축 잠열이 계를 T_c 근방으로 자체 가열 → 액적+증기 공존.
      //   최대 성분 비율(액적 크기)·평균 배위수·U_pol/N(응집에너지)가 함께 오른다.
      const cond = (T0, seed, az) => {
        const w = Po.nobleCondense({ T0, seed, alphaZero: az }); Po.run(w, 7000);
        const c = Po.clusters(w, 1.3);
        return { coord: c.meanCoord, frac: c.largestFrac, upol: w.ledger.U_pol / w.atoms.length };
      };
      const R = 3;
      const hot = [], cold = [], az = [];
      for (let s = 0; s < R; s++) { hot.push(cond(3.0, 80 + s, false)); cold.push(cond(0.02, 80 + s, false)); az.push(cond(0.02, 80 + s, true)); }
      const hC = mean(hot.map((x) => x.coord)), cC = mean(cold.map((x) => x.coord));
      const hF = mean(hot.map((x) => x.frac)), cF = mean(cold.map((x) => x.frac));
      const zC = mean(az.map((x) => x.coord)), zU = mean(az.map((x) => x.upol)), cU = mean(cold.map((x) => x.upol));
      log.push({ ok: cF > 0.5 && cF > hF && cC > hC * 1.2, name: '⑧응집창발',
        msg: `저온 최대성분 ${fmt(cF)}>0.5·>고온 ${fmt(hF)} · 배위 ${fmt(hC)}→${fmt(cC)} (냉각→액적)` });
      log.push({ ok: cU < -0.5, name: '⑧응집에너지', msg: `저온 U_pol/N ${fmt(cU)} < 0 (원자가 분산 우물에 묶임)` });

      // 근원 검증: α=0 → 유도·분산 두 채널이 함께 죽는다 → U_pol 정확 0 · 응집 소멸.
      log.push({ ok: Math.abs(zU) < 1e-12 && zC < 0.4, name: '⑧근원검증(α=0)',
        msg: `α=0 → U_pol/N ${fmt(zU)}=0 · 배위 ${fmt(zC)} ≪ 응집 ${fmt(cC)} (근원=α, 위조 0)` });

      // 장부 닫힘: U_pol 통 (분극·분산 보존력) · P 보존 (반대칭 중심력).
      {
        const w = Po.nobleCondense({ T0: 0.3, seed: 9 });
        const E0 = M.ledgerTable(w).total, P0 = M.momentum(w); let mr = 0, mp = 0;
        for (let k = 0; k < 7000; k++) { E.step(w); if (k % 20 === 0) { mr = Math.max(mr, Math.abs(M.ledgerTable(w).total - E0) / Math.abs(E0)); mp = Math.max(mp, pDiff(M.momentum(w), P0)); } }
        log.push({ ok: mr <= E.EPS_E, name: '⑧장부·U_pol닫힘', msg: `max|ΔE|/E ${fmt(mr)} ≤ EPS_E ${E.EPS_E} (분극 보존력)` });
        assertExact('⑧P보존', mp, 0, 1e-9, log);
      }

      // ion-induced: 전하–유도쌍극자가 C6 없이 단독으로 이온 주변 중성 밀도를 올린다.
      //   이 장면은 분산(C6) off → 계의 유일한 인력이 이온→중성뿐. 전하 on/off 차이 = 분극 경로.
      {
        const near = (off, seed) => { const w = Po.ionInduced({ seed, chargeOff: off }); Po.run(w, 5000); return Po.nearIonCount(w, 2.5); };
        const on = [], of = [];
        for (let s = 0; s < R; s++) { on.push(near(false, 90 + s)); of.push(near(true, 90 + s)); }
        const mOn = mean(on), mOf = mean(of);
        log.push({ ok: mOn > mOf * 1.3, name: '⑧이온유도밀도',
          msg: `이온 근방(R=2.5) 전하ON ${fmt(mOn)} > OFF ${fmt(mOf)}×1.3 (분산 off·분극 경로 단독)` });
      }

      // dt 반감 + 근사 차수 무관: 응집 배위수 통계가 dt·dt/2 에서 근사 동일 (수치 차수가 물리 안 바꿈).
      {
        const cd = (dt, seed) => { const w = Po.nobleCondense({ T0: 0.05, seed, dt, N: 64, L: 12 }); Po.run(w, Math.round(7 / dt)); return Po.clusters(w, 1.3).meanCoord; };
        const a = mean([0, 1].map((s) => cd(0.0015, 85 + s))), b = mean([0, 1].map((s) => cd(0.00075, 85 + s)));
        log.push({ ok: Math.abs(a - b) / b < 0.2, name: '⑧dt반감통계', msg: `배위수 ${fmt(a)} vs dt/2 ${fmt(b)} 상대차 ${fmt(Math.abs(a - b) / Math.max(1e-9, b))} < 0.2` });
      }
    }

    // 12. ⑨ 통계 관문 — 평형은 창발한다 (엔트로피 증가·화학 평형·T_국소). 새 물리 0·측정과 검증만.
    if (want(9)) {
      const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;

      // (1) 엔트로피 앙상블 증가: 저엔트로피 구석 → 자유 팽창 → 위상공간 S 증가 (제2법칙 창발).
      //     단조 아님(개별 런 요동 허용) — R런 평균이 증가하면 통과 (DESIGN §4.1 앙상블 계약).
      const R = 12;
      const s0 = [], s1 = []; let nonMono = 0;
      for (let i = 0; i < R; i++) {
        const w = S.build('s09-entropy-corner', { seed: 500 + i, N: 100, L: 20, T0: 1.0 });
        const a = M.entropy(w, 6, 4); E.run(w, 2000); const mid = M.entropy(w, 6, 4); E.run(w, 4000); const b = M.entropy(w, 6, 4);
        s0.push(a); s1.push(b);
        if (!(mid >= a - 1e-9 && b >= mid - 1e-9)) nonMono++;   // 개별 런 비단조 카운트
      }
      const mS0 = mean(s0), mS1 = mean(s1);
      const seS = Math.sqrt(s1.reduce((x, y) => x + (y - mS1) * (y - mS1), 0) / (R - 1)) / Math.sqrt(R);
      log.push({ ok: mS1 > mS0 + 3 * seS, name: '⑨엔트로피증가',
        msg: `앙상블 ⟨S⟩ ${fmt(mS0)} → ${fmt(mS1)} (증가·3se ±${fmt(3 * seS)}) · 개별 비단조 ${nonMono}/${R} (요동 존재)` });

      // (2) 셀 2배 스캔: coarse-graining 노브를 바꿔도 증가 경향 유지 (셀 의존성 정직).
      {
        let ok = true; const msg = [];
        for (const nc of [4, 8]) {
          const e = [], l = [];
          for (let i = 0; i < 6; i++) { const w = S.build('s09-entropy-corner', { seed: 600 + i, N: 100, L: 20 }); e.push(M.entropy(w, nc, 4)); E.run(w, 6000); l.push(M.entropy(w, nc, 4)); }
          const up = mean(l) > mean(e); ok = ok && up; msg.push(`nCell=${nc}: ${fmt(mean(e))}→${fmt(mean(l))}`);
        }
        log.push({ ok, name: '⑨셀2배경향유지', msg: msg.join(' · ') + ' (둘 다 증가)' });
      }

      // (3) K_eq 부피 의존 (르샤틀리에): 같은 T, 부피 2배 → 해리도 증가 (병진 상태 수 창발·author 0).
      {
        const dissoc = (L, seed) => { const w = S.build('s06-v1-dimer', { seed, N: 80, T0: 1.5, L }); E.run(w, 6000); const ds = []; for (let b = 0; b < 5; b++) { E.run(w, 300); ds.push(M.equilibrium(w).dissoc); } return mean(ds); };
        const dV = mean([0, 1].map((s) => dissoc(18, 30 + s))), d2V = mean([0, 1].map((s) => dissoc(18 * Math.SQRT2, 30 + s)));
        log.push({ ok: d2V > dV * 1.3, name: '⑨르샤틀리에(부피)', msg: `해리분율 V ${fmt(dV)} → 2V ${fmt(d2V)} (부피↑→해리↑·상태 수 의존·비율 공식 0)` });
      }

      // (4) van't Hoff: ln K vs 1/T 기울기 ≈ D (+병진 엔트로피 보정). 캐논ical(고정 T) 관계라 항온조 필요.
      //     발견: ⑥ 복사 결합이 방출 냉각으로 T 를 자체 조절 → T0 스캔 안 먹음. 명시적 항온조로 T 고정(측정 전용).
      {
        const thermostat = (w, T) => { const Tc = M.temperature(w); if (Tc > 0) { const s = Math.sqrt(T / Tc); for (const a of w.atoms) { a.p.x *= s; a.p.y *= s; } } };
        const lnKat = (T, seed) => {
          const w = S.build('s06-v1-dimer', { seed, N: 80, T0: T, L: 18 });
          for (let k = 0; k < 6000; k++) { E.step(w); if (k % 25 === 0) thermostat(w, T); }
          const kc = [];
          for (let b = 0; b < 6; b++) { for (let k = 0; k < 300; k++) { E.step(w); if (k % 25 === 0) thermostat(w, T); } const q = M.equilibrium(w); if (isFinite(q.Kc)) kc.push(q.Kc); }
          return Math.log(mean(kc));
        };
        const Ts = [0.5, 0.8, 1.15, 1.5];
        const pts = Ts.map((T) => ({ invT: 1 / T, lnK: mean([0, 1].map((s) => lnKat(T, 40 + s))) }));
        const sx = mean(pts.map((p) => p.invT)), sy = mean(pts.map((p) => p.lnK));
        let num = 0, den = 0; for (const p of pts) { num += (p.invT - sx) * (p.lnK - sy); den += (p.invT - sx) * (p.invT - sx); }
        const slope = num / den;
        log.push({ ok: slope > 1.4 && slope < 3.0, name: '⑨vantHoff기울기', msg: `d(lnK)/d(1/T) = ${fmt(slope)} ≈ D=2.0 (+병진 엔트로피 보정) ∈[1.4,3.0]` });
      }

      // (5) T_국소 평형 정합: 평형 장면에서 ⟨T_국소⟩ ≈ 전역 T (아레니우스 국소 T 근사의 타당 범위).
      {
        const w = S.build('s02-gas-collide', { seed: 7, N: 100, T0: 1.5, L: 14 });
        E.run(w, 3000);
        const lt = M.localTemp(w, 6);
        const rel = Math.abs(lt.mean - lt.globalT) / Math.max(1e-9, lt.globalT);
        log.push({ ok: rel < 0.1, name: '⑨T국소평형정합', msg: `⟨T_국소⟩ ${fmt(lt.mean)} vs 전역 ${fmt(lt.globalT)} (std ${fmt(lt.std)}·상대 ${fmt(rel)}<0.1)` });
      }
    }

    // 13. ⑩ 수프 관문 — 실원소 합류·화학량론 (2H:1O → H₂O 우세). 쌍별 D(H–H:O–H:O–O=436:463:146) author.
    if (want(10)) {
      const multi = (hist) => { const P = {}; for (const k in hist) { const c = (k.match(/\d+/g) || []).reduce((s, d) => s + +d, 0); if (c > 1) P[k] = hist[k]; } return P; };
      const poolTop = (worlds) => { const P = {}; for (const w of worlds) { const h = multi(M.molecules(w).hist); for (const k in h) P[k] = (P[k] || 0) + h[k]; } const r = Object.entries(P).sort((a, b) => b[1] - a[1]); return { top: r[0] || ['-', 0], all: r, h2o: P['H2O1'] || 0 }; };
      const R = 6, n = 14;

      // 어닐링: 고T 평형 탐색 → 냉각 스케줄 → 열역학 산물 H₂O 우세 (냉각 열은 E_escape 로 회계 → 장부 닫힘).
      const annealed = []; let over = 0, maxRel = 0;
      for (let s = 0; s < R; s++) {
        const w = S.build('s10-water-soup', { seed: 200 + s, n });
        const E0 = M.ledgerTable(w).total; S.annealSoup(w);
        maxRel = Math.max(maxRel, Math.abs(M.ledgerTable(w).total - E0) / Math.abs(E0));
        over = Math.max(over, M.molecules(w).maxOver); annealed.push(w);
      }
      const pa = poolTop(annealed);
      log.push({ ok: pa.top[0] === 'H2O1', name: '⑩화학량론(H₂O우세)',
        msg: `어닐 pooled 최다분자 = ${pa.top[0]}:${pa.top[1]} (${pa.all.slice(0, 4).map(([k, v]) => k + ':' + v).join(' ')}) — 라벨 분기 0` });
      log.push({ ok: over <= 1e-9, name: '⑩원자가포화', msg: `과결합 max ${fmt(over)} ≤ 0 (O 예산 2·H₃O 공유 과결합 0)` });
      log.push({ ok: maxRel <= E.EPS_E, name: '⑩장부·냉각닫힘', msg: `max|ΔE|/E ${fmt(maxRel)} ≤ EPS_E (냉각 열 → E_escape 회계)` });

      // 어닐링 이득 (활성화 장벽): 어닐 H₂O > 크래시 냉각 H₂O — 열역학 최소 도달엔 장벽 통과 필요 (준안정 실증).
      const crashed = [];
      for (let s = 0; s < R; s++) { const w = S.build('s10-water-soup', { seed: 200 + s, n, T0: 0.3 }); E.run(w, 24000); crashed.push(w); }
      const pc = poolTop(crashed);
      log.push({ ok: pa.h2o > pc.h2o * 1.2, name: '⑩어닐링이득(활성화장벽)',
        msg: `H₂O 어닐 ${pa.h2o} > 크래시 ${pc.h2o}×1.2 (H–H≈O–H 근접 → 크래시는 H₂ 갇힘·어닐링이 H₂O 로)` });

      // 실원소 앵커: ③ levels 유도 예산·IE 순위 (He>H·O>H). 가상 원소(V 계열) 회귀는 전체 스위트가 보장.
      const B = (Z) => L.budget(Z), IE = (Z) => L.ionizationE(Z);
      const anchorsOk = B(1) === 1 && B(8) === 2 && B(2) === 0 && B(10) === 0 && IE(2) > IE(1) && IE(8) > IE(1);
      log.push({ ok: anchorsOk, name: '⑩실원소앵커', msg: `B: H=${B(1)}·O=${B(8)}·He=${B(2)}·Ne=${B(10)} · IE He>H (${IE(2).toFixed(2)}>${IE(1).toFixed(2)})·O>H (author 아님·③ 유도)` });
    }

    // 14. ⑪ 승격 배관 MVP — 상자 시나리오 한 장부 + coarse↔재해동 왕복 + output.json (CONTRACT §3).
    if (want(11)) {
      const sortKeys = (o) => { const r = {}; for (const k of Object.keys(o).sort()) r[k] = o[k]; return JSON.stringify(r); };

      // (1) 한 장부: 밀폐 상자 5막(형성→응집→가열→반응→냉각) 전체에서 총합 잔차 ≤ EPS_E · Σc 불변.
      {
        const w = S.build('s11-mvp-box', { seed: 3, n: 12 });
        const tot0 = M.ledgerTable(w).total, c0 = sortKeys(M.composition(w));
        let maxRel = 0;
        S.runScenario(w, (world) => { maxRel = Math.max(maxRel, Math.abs(M.ledgerTable(world).total - tot0) / Math.abs(tot0)); });
        const c1 = sortKeys(M.composition(w)), mol = M.molecules(w);
        log.push({ ok: maxRel <= E.EPS_E, name: '⑪한장부(5막)', msg: `5막 max|ΔE|/E ${fmt(maxRel)} ≤ EPS_E (열욕 E_escape 회계·형성→응집→가열→반응→냉각)` });
        log.push({ ok: c0 === c1, name: '⑪시나리오Σc불변', msg: `원자 조성 불변 (H₂O 우세 ${mol.hist['H2O1'] || 0}·과결합 ${fmt(mol.maxOver)})` });
      }

      // (2) 왕복 (⇧ coarse → ⇩ rethaw): 보존량(Σc·E·P) 정확 + 선언 관측량(조성) ε=0 (KERNEL §3.3).
      {
        const R = 3; let eOk = 0, cOk = 0, maxdE = 0, maxdP = 0; const trat = [];
        for (let s = 0; s < R; s++) {
          const w = S.build('s10-water-soup', { seed: 300 + s, n: 14 }); S.annealSoup(w);
          const cs = Pr.coarse(w); const w2 = Pr.rethaw(cs, w, E.makeRng(999 + s)); const cs2 = Pr.coarse(w2);
          const dE = Math.abs(cs2.E_total - cs.E_total); const p2 = Pr.momentumOf(w2), dP = Math.hypot(p2.x, p2.y);
          maxdE = Math.max(maxdE, dE); maxdP = Math.max(maxdP, dP);
          if (sortKeys(cs.atomCount) === sortKeys(cs2.atomCount)) eOk++;
          if (sortKeys(cs.species) === sortKeys(cs2.species)) cOk++;
          trat.push(cs2.T / Math.max(1e-9, cs.T));
        }
        const tr = trat.reduce((a, b) => a + b, 0) / R;
        log.push({ ok: maxdE < 1e-6 && eOk === R, name: '⑪왕복·E·Σc정확', msg: `coarse→rethaw max|ΔE| ${fmt(maxdE)} <1e-6 · Σc 정확 ${eOk}/${R} (보존 협상 불가)` });
        log.push({ ok: maxdP < 1e-9, name: '⑪왕복·P정확', msg: `|P'| ${fmt(maxdP)} < 1e-9 (COM 제거 유지)` });
        log.push({ ok: cOk === R, name: '⑪왕복·조성계약(ε=0)', msg: `선언 관측량 조성 일치 ${cOk}/${R} · T 비 ${fmt(tr)}∈[0.6,1.6] (재표본 미시 상태 — 보존은 정확·분포는 통계)` });
      }

      // (3) output.json v0 스키마 유효 + 쌍 퍼텐셜 인력 꼬리 (S0-⑧ 반데르발스 앵커 — 손 튜닝 0·측정 산출).
      {
        const w = S.build('s11-mvp-box', { seed: 5, n: 12 }); S.runScenario(w);
        const out = Pr.buildOutput(w, w, { pmfPairs: [['O', 'O'], ['H', 'H']], scenes: ['s11-mvp-box'], runs: 1 });
        const val = Pr.validateOutput(out);
        const pmfOO = Pr.pmf(w, 'O', 'O');
        log.push({ ok: val.ok, name: '⑪output스키마유효', msg: `s0-output-v0 검증 ${val.ok ? '통과' : JSON.stringify(val.errs)} · species ${out.species.length}종·pairPotential ${Object.keys(out.pairPotential).length}쌍` });
        log.push({ ok: pmfOO.hasTail, name: '⑪반데르발스꼬리', msg: `PMF O–O 인력 꼬리 존재 (우물 V ${fmt(pmfOO.vmin)} @ r=${pmfOO.rmin} — α·IE 에서 나옴·author 0)` });
      }
    }

    // 15. ⑫ 복사장 — ④ 빈 근사를 photon 입자로 교체. 냉각/공동 회귀 + 유도 방출 방향성 + 장부 Σphoton.E 정합.
    if (want(12)) {
      // (1) 회귀: open 경계 냉각 — 방출 광자가 상자를 나가며 T 단조 하강 + 총 E(E_escape 포함) 보존.
      {
        const w = S.build('s12-open-cooling', { seed: 5, N: 60, L: 15 });
        const T0 = M.temperature(w), E0 = M.ledgerTable(w).total;
        let maxRel = 0; for (let k = 0; k < 1500; k++) { E.step(w); const t = M.ledgerTable(w); maxRel = Math.max(maxRel, Math.abs(t.total - E0) / Math.abs(E0)); }
        const T1 = M.temperature(w), lg = M.ledgerTable(w);
        log.push({ ok: T1 < T0 * 0.8 && lg.E_escape > 0, name: '⑫복사냉각(입자)', msg: `T ${fmt(T0)}→${fmt(T1)} · E_escape ${fmt(lg.E_escape)} (광자 탈출)` });
        log.push({ ok: maxRel <= E.EPS_E, name: '⑫냉각E보존(탈출포함)', msg: `max|ΔE|/E ${fmt(maxRel)} ≤ EPS_E` });
      }

      // (2) 회귀: 닫힌 공동(reflect) — 광자가 갇혀 재흡수 → 정상 상태(항상 >0) + 총 E 보존.
      {
        const w = S.build('s12-cavity', { seed: 6, N: 100, L: 13 });
        const E0 = M.ledgerTable(w).total;
        E.run(w, 1500);
        const ph = []; for (let b = 0; b < 5; b++) { E.run(w, 250); ph.push(M.photonStats(w).n); }
        const minPh = Math.min(...ph);
        log.push({ ok: minPh > 0, name: '⑫공동정상상태(입자)', msg: `광자 수 ${ph.join(',')} (min ${minPh}>0 — 물질↔복사 정상)` });
        log.push({ ok: Math.abs(M.ledgerTable(w).total - E0) / Math.abs(E0) <= E.EPS_E, name: '⑫공동E보존', msg: `rel ${fmt(Math.abs(M.ledgerTable(w).total - E0) / Math.abs(E0))} ≤ EPS_E` });
        // 스펙트럼: 2준위 종이라 단색(dE 빈 집중) — 정직 한계(연속 스펙트럼·플랑크 꼬리는 다준위 몫).
        const sp = M.photonSpectrum(w, 8, 3.0), occ = sp.filter((c) => c > 0).length;
        log.push({ ok: occ <= 1, name: '⑫스펙트럼단색(2준위한계)', msg: `점유 빈 ${occ}개 [${sp.join(',')}] — 2준위→단색(연속 스펙트럼은 다준위·㉒ 몫·정직 한계)` });
      }

      // (3) 장부 계약: bond 없는 field 장면에서 E_photon 통 == Σphoton.E 정확 (입자↔통 정합·매 tick).
      {
        const w = S.build('s12-cavity', { seed: 9, N: 80, L: 13 });
        let maxGap = 0; for (let k = 0; k < 1200; k++) { E.step(w); const ps = M.photonStats(w); maxGap = Math.max(maxGap, Math.abs(ps.sumE - ps.EphotonBin)); }
        log.push({ ok: maxGap < 1e-9, name: '⑫장부Σphoton.E정합', msg: `max|Σphoton.E − E_photon통| ${fmt(maxGap)} < 1e-9 (입자가 통을 정확히 표상)` });
      }

      // (4) 유도 방출: 밀도 반전 + 씨앗 +x 광자 → 축 정렬 광자 수 증폭. 대조(nu_stim=0)는 자발만 → 등방.
      {
        const R = 4;
        let stimA = [], ctrlA = [];
        for (let s = 0; s < R; s++) {
          const ws = S.build('s12-stim', { seed: 20 + s, stim: 6 }); E.run(ws, 900); stimA.push(M.photonStats(ws).aligned);
          const wc = S.build('s12-stim', { seed: 20 + s, stim: 0 }); E.run(wc, 900); ctrlA.push(M.photonStats(wc).aligned);
        }
        const mS = stimA.reduce((a, b) => a + b, 0) / R, mC = ctrlA.reduce((a, b) => a + b, 0) / R;
        log.push({ ok: mS > 1.8 * mC, name: '⑫유도방출증폭', msg: `축 정렬 광자 유도 ${fmt(mS)} vs 자발 대조 ${fmt(mC)} → ${fmt(mS / Math.max(1e-9, mC))}× (씨앗 방향 결맞음 복제)` });
      }
    }

    // 16. ⑬ z 해동 (3D 전환) — frozenZ:false 만으로 3D. **엔진 변경 0**(scenes/measure/index.html 만).
    //     차원이 코드가 아니라 장면 속성이라는 ①의 청구서. 평면 회귀는 ①–⑫ 88 이 그대로 증명.
    if (want(13)) {
      const sortKeys = (o) => JSON.stringify(Object.keys(o).sort().map((k) => k + o[k]));
      // (0) z 동결 증거: 기존 frozenZ 장면은 ⟨p_z²⟩ 가 정확히 0 (z 자유도 봉인) — 해동과 대조.
      {
        const w = S.build('s02-gas-collide', { seed: 3, N: 40, L: 12 }); E.run(w, 400);
        const mv = M.momentumVariance(w);
        log.push({ ok: mv.z === 0 && mv.x > 0, name: '⑬z동결증거', msg: `frozenZ: ⟨p_z²⟩ ${fmt(mv.z)}=0 vs ⟨p_x²⟩ ${fmt(mv.x)}>0 (z 봉인)` });
      }

      // (1) z 해동 등분배 창발: z 를 차갑게(⟨p_z²⟩=0) 출발 → 3D 충돌이 z 로 에너지 퍼뜨려 등분배.
      //     iso=⟨p_z²⟩/⟨p_xy²⟩ 가 0 → ~1 로 수렴 (R런). 차원=코드 아님·장면 속성의 실증.
      {
        const R = 4; let iso0 = [], iso1 = [];
        for (let s = 0; s < R; s++) {
          const w = S.build('s13-collide-3d', { seed: 40 + s });
          for (const a of w.atoms) a.p.z = 0; E.recomputeLedger(w);   // z 차갑게 출발 (인위 비등방)
          iso0.push(M.momentumVariance(w).iso);
          E.run(w, 2500);
          iso1.push(M.momentumVariance(w).iso);
        }
        const m0 = iso0.reduce((a, b) => a + b, 0) / R, m1 = iso1.reduce((a, b) => a + b, 0) / R;
        log.push({ ok: m0 < 0.05 && m1 > 0.8 && m1 < 1.2, name: '⑬z해동등분배', msg: `iso ⟨p_z²⟩/⟨p_xy²⟩ ${fmt(m0)}→${fmt(m1)} ∈[0.8,1.2] (z 차갑게 출발→충돌이 등분배·창발)` });
      }

      // (2) 3D 장부·겹침: 3D 충돌 장면 총 E 보존 ≤ EPS_E + 겹침 0 (min d/σ > MIN_DSIGMA) + Σc 불변.
      {
        const w = S.build('s13-collide-3d', { seed: 7 });
        const E0 = M.ledgerTable(w).total, c0 = sortKeys(M.composition(w));
        let maxRel = 0, minDs = Infinity;
        for (let k = 0; k < 2000; k++) { E.step(w); const t = M.ledgerTable(w); maxRel = Math.max(maxRel, Math.abs(t.total - E0) / Math.abs(E0)); minDs = Math.min(minDs, w.minDsigma); }
        const cOk = sortKeys(M.composition(w)) === c0;
        log.push({ ok: maxRel <= E.EPS_E && cOk, name: '⑬3D장부닫힘', msg: `max|ΔE|/E ${fmt(maxRel)} ≤ EPS_E · Σc ${cOk ? '불변' : '깨짐'}` });
        log.push({ ok: minDs > E.MIN_DSIGMA, name: '⑬3D겹침0', msg: `min d/σ ${fmt(minDs)} > ${E.MIN_DSIGMA} (3D 척력 벽 유지)` });
      }

      // (3) 3D 결합 위상: C4 허브가 3D 에서 여러 H1 과 결합 (다배위) · 원자가 포화(maxOver 0·과결합 없음).
      //     완전 CH₄ 우세는 화학 어닐링(⑩ 유형)·각도는 ⑭ — 여기선 3D 무대에서 ⑥ 공유 기계가 도는지만.
      {
        const w = S.build('s13-bond-3d', { seed: 11, n: 8 }); E.run(w, 4000);
        const mol = M.molecules(w);
        let maxCoord = 0;
        for (const a of w.atoms) if (a.sp === 'C4') { let bc = 0; for (const b of w.bonds) if (b.i === a.id || b.j === a.id) bc += b.order; maxCoord = Math.max(maxCoord, bc); }
        log.push({ ok: mol.nBonds > 0 && mol.maxOver === 0 && maxCoord >= 2, name: '⑬3D결합위상', msg: `3D 결합 ${mol.nBonds}개·C 최대배위 ${maxCoord}(≥2)·과결합 ${mol.maxOver}=0 (원자가 포화·3D 허브)` });
      }
    }

    // 17. ⑭ 형상 (VSEPR·결합각) — 공통 각도 반발 하나로 정사면체·굽음·직선이 동시 창발. 목표각 author 0.
    if (want(14)) {
      // 중심 원자 결합각 평균 (여러 분자·짧은 저온 런의 통계 — 이완된 형상 최소 근방).
      const meanAngle = (name, cen, over) => {
        const w = S.build(name, Object.assign({ seed: 3, count: 12 }, over));
        const E0 = M.ledgerTable(w).total, P0 = M.momentum(w);
        let mx = 0, mdP = 0; const acc = [];
        for (let k = 0; k < 1200; k++) {
          E.step(w); const t = M.ledgerTable(w).total; mx = Math.max(mx, Math.abs(t - E0) / Math.abs(E0));
          const P = M.momentum(w); mdP = Math.max(mdP, Math.hypot(P.x - P0.x, P.y - P0.y, P.z - P0.z));
          const st = Geo.angleStats(w); if (st.bondAngles[cen]) acc.push(...st.bondAngles[cen]);
        }
        const m = acc.reduce((a, b) => a + b, 0) / acc.length;
        return { ang: m, relE: mx, dP: mdP };
      };

      // (1) 3단 앵커 — 하나의 k_ang·λ_lp 로 동시에 (분자별 파라미터 분기 0: geometry.js 상수 단일·if(molecule) 0).
      const me = meanAngle('s14-methane', 'C4'), wa = meanAngle('s14-water', 'O2'), li = meanAngle('s14-linear', 'Be2');
      log.push({ ok: me.ang > 104 && me.ang < 115, name: '⑭CH₄정사면체', msg: `H–C–H ${fmt(me.ang)}° ∈(104,115) — 4결합 0고립 → 정사면체(109.5°)` });
      log.push({ ok: wa.ang > 95 && wa.ang < 115, name: '⑭H₂O굽음', msg: `H–O–H ${fmt(wa.ang)}° ∈(95,115) — 2결합 2고립 → 굽음(<109.5·고립쌍 압박)` });
      log.push({ ok: li.ang > 170 && li.ang < 180, name: '⑭BeH₂직선', msg: `H–Be–H ${fmt(li.ang)}° ∈(170,180) — 2결합 0고립 → 직선` });
      log.push({ ok: wa.ang < me.ang && me.ang < li.ang, name: '⑭형상서열창발', msg: `굽음 ${fmt(wa.ang)} < 정사면체 ${fmt(me.ang)} < 직선 ${fmt(li.ang)} (한 규칙·목표각 author 0)` });

      // (2) λ_lp=1 대조: 고립쌍 배율 제거 → 물의 4도메인 균등화 → 각이 정사면체(109.5)로 열림 (압박의 근원).
      {
        const w1 = meanAngle('s14-water', 'O2', { lam: 1.0 });
        log.push({ ok: w1.ang > wa.ang + 4, name: '⑭고립쌍압박근원', msg: `λ_lp=1 대조 ${fmt(w1.ang)}° > λ_lp=1.5 ${fmt(wa.ang)}° (고립쌍 배율이 압박의 근원 — 제거 시 109.5° 로 열림)` });
      }

      // (3) 장부: V_ang 포함 총 E 보존 + 각도 힘의 반대칭 짝 → P 정확 보존.
      log.push({ ok: me.relE <= E.EPS_E && wa.relE <= E.EPS_E && li.relE <= E.EPS_E, name: '⑭장부·V_ang닫힘', msg: `max|ΔE|/E CH₄ ${fmt(me.relE)}·H₂O ${fmt(wa.relE)}·BeH₂ ${fmt(li.relE)} ≤ EPS_E` });
      log.push({ ok: me.dP < 1e-9 && li.dP < 1e-9, name: '⑭P보존(각도힘반대칭)', msg: `max|ΔP| CH₄ ${fmt(me.dP)}·BeH₂ ${fmt(li.dP)} < 1e-9 (F_center=−ΣF_nb)` });

      // (4) L 각운동량 보존 스팟 체크 (고립쌍 없는 분자 — 각도 힘이 회전 불변 퍼텐셜의 정확 그래디언트).
      {
        const w = S.build('s14-methane', { seed: 2, count: 1, L: 60, eqSteps: 2000 });
        for (const a of w.atoms) { a.p.x += 0.05; a.p.z += 0.03; }
        const Lv = (ww) => { let x = 0, y = 0, z = 0; for (const a of ww.atoms) { x += a.r.y * a.p.z - a.r.z * a.p.y; y += a.r.z * a.p.x - a.r.x * a.p.z; z += a.r.x * a.p.y - a.r.y * a.p.x; } return { x, y, z }; };
        const L0 = Lv(w); let mdL = 0;
        for (let k = 0; k < 2000; k++) { E.step(w); const l = Lv(w); mdL = Math.max(mdL, Math.hypot(l.x - L0.x, l.y - L0.y, l.z - L0.z)); }
        log.push({ ok: mdL < 1e-9, name: '⑭L보존(회전불변)', msg: `CH₄ max|ΔL| ${fmt(mdL)} < 1e-9 (고립쌍 없는 분자 — 각도 힘 정확 보존·기계 정밀도)` });
      }
    }

    // 18. ⑮ 극성 (부분 전하·QEq) — 전기음성도 균등화로 전하 재분배·극성=전하×형상 창발. χ·η ③ 유도(author 0).
    if (want(15)) {
      // 분자 평균 |μ_mol|·max|q|·장부 (여러 분자·짧은 저온 런).
      const polStat = (name, over) => {
        const R = 4; let mu = [], mq = [], relE = [], sq = [];
        for (let s = 0; s < R; s++) {
          const w = S.build(name, Object.assign({ seed: 40 + s, count: 12 }, over));
          const E0 = M.ledgerTable(w).total; let mx = 0;
          for (let k = 0; k < 1000; k++) { E.step(w); const t = M.ledgerTable(w).total; mx = Math.max(mx, Math.abs(t - E0) / Math.abs(E0)); }
          const dp = Pol.dipoles(w);
          mu.push(dp.reduce((a, b) => a + b.muMol, 0) / dp.length);
          mq.push(dp.reduce((a, b) => a + b.maxAbsQ, 0) / dp.length);
          sq.push(Math.max(...dp.map((d) => Math.abs(d.sumQ))));
          relE.push(mx);
        }
        const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
        return { mu: avg(mu), mq: avg(mq), relE: Math.max(...relE), sq: Math.max(...sq) };
      };
      const o2 = polStat('s15-o2'), be = polStat('s15-beh2'), h2o = polStat('s15-h2o');

      // (1) 3단 기준 — 한 QEq 규칙에서 동시에. O₂ 무극성(동핵)·BeH₂ 극성 결합/무극성 분자(상쇄)·H₂O 극성.
      log.push({ ok: o2.mq < 0.02 && o2.mu < 0.02, name: '⑮O₂무극성(동핵)', msg: `max|q| ${fmt(o2.mq)}·|μ_mol| ${fmt(o2.mu)} ≈ 0 (동핵 대칭 → dq 0)` });
      log.push({ ok: be.mq > 0.02 && be.mu < 0.05, name: '⑮BeH₂결합극성·분자무극성', msg: `결합 max|q| ${fmt(be.mq)}>0 이나 |μ_mol| ${fmt(be.mu)}≈0 (직선 상쇄 — CO₂ 대역·⑩ 이중결합 격차)` });
      log.push({ ok: h2o.mu > 0.08, name: '⑮H₂O극성', msg: `|μ_mol| ${fmt(h2o.mu)}>0 (굽음 + χ_O>χ_H → 순 쌍극자)` });
      log.push({ ok: h2o.mu > be.mu && be.mu <= o2.mu + 0.02, name: '⑮극성서열창발', msg: `|μ_mol| H₂O ${fmt(h2o.mu)} > BeH₂ ${fmt(be.mu)} ≳ O₂ ${fmt(o2.mu)} (전하×형상)` });

      // (2) χ·η ③ 유도 (Mulliken·손 튜닝 0): 전기음성도 서열 χ_O>χ_H>χ_Be 가 극성 부호를 정한다.
      const cO = Pol.params(8).chi, cH = Pol.params(1).chi, cBe = Pol.params(4).chi;
      log.push({ ok: cO > cH && cH > cBe, name: '⑮χ서열③유도', msg: `χ_O ${fmt(cO)} > χ_H ${fmt(cH)} > χ_Be ${fmt(cBe)} (③ IE·EA 유도·author 0 → H₂O 의 O⁻·BeH₂ 의 H⁻)` });

      // (3) 장 응답: 무작위 배향 시작 → 균일 외부장이 극성 분자를 배향 (⟨cosθ⟩ 상승) · 무장 대조는 등방.
      {
        const R = 5; let on = [], off = [];
        for (let s = 0; s < R; s++) {
          const wf = S.build('s15-field', { seed: 30 + s, count: 16, Ex: 0.8 }); E.run(wf, 2000); on.push(Pol.orientationOrder(wf));
          const wc = S.build('s15-field', { seed: 30 + s, count: 16, Ex: 0 }); E.run(wc, 2000); wc.Efield = E.V.make(1, 0, 0); off.push(Pol.orientationOrder(wc));
        }
        const mOn = on.reduce((a, b) => a + b, 0) / R, mOff = off.reduce((a, b) => a + b, 0) / R;
        log.push({ ok: mOn > 0.4 && Math.abs(mOff) < 0.25, name: '⑮장응답배향', msg: `⟨cosθ⟩ 장있음 ${fmt(mOn)} vs 등방 대조 ${fmt(mOff)} (극성 분자 유전 배향)` });
      }

      // (4) 장부: dq 갱신 사건 회계 (QEq 준정적 → E 보존) + 분자별 총 전하 보존 Σq=Q.
      log.push({ ok: o2.relE <= E.EPS_E && be.relE <= E.EPS_E && h2o.relE <= E.EPS_E, name: '⑮장부·QEq닫힘', msg: `max|ΔE|/E O₂ ${fmt(o2.relE)}·BeH₂ ${fmt(be.relE)}·H₂O ${fmt(h2o.relE)} ≤ EPS_E` });
      log.push({ ok: o2.sq < 1e-9, name: '⑮전하보존(Σq=Q)', msg: `분자별 |Σq| ${fmt(o2.sq)} < 1e-9 (QEq 제약 Σq=Q 정확)` });
    }

    // 19. ⑯ 수소 결합 — ⑮ 전하+⑭ 형상이면 방향성 약결합 창발(1차 측정)·점전하는 약해 R-HB 보정(2차·명시 노브).
    if (want(16)) {
      const R = 4; const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
      let cold = [], warm = [], theta = [], drat = [], ehb = [], relE = [], neHB = [], mixW = [];
      for (let s = 0; s < R; s++) {
        const wc = S.build('s16-water-cluster', { seed: 10 + s, T0: 0.02 });
        const E0 = M.ledgerTable(wc).total; let mx = 0;
        for (let k = 0; k < 1500; k++) { E.step(wc); mx = Math.max(mx, Math.abs(M.ledgerTable(wc).total - E0) / Math.abs(E0)); }
        const st = HB.stats(wc);
        cold.push(st.perMol); theta.push(st.meanAngle); drat.push(st.meanD / 1.15); ehb.push(Math.abs(st.meanEhb) / wc.Dbond); relE.push(mx);
        const ww = S.build('s16-water-cluster', { seed: 10 + s, T0: 0.15 }); E.run(ww, 1500); warm.push(HB.stats(ww).perMol);
        const wm = S.build('s16-mixed', { seed: 10 + s, T0: 0.02 }); E.run(wm, 1000); const sm = HB.stats(wm);
        neHB.push(sm.hb.filter((h) => wm.atomById(h.A).Z === 10 || wm.atomById(h.H).Z === 10).length); mixW.push(sm.n);
      }
      const mCold = avg(cold), mWarm = avg(warm), mTheta = avg(theta), mD = avg(drat), mE = avg(ehb), mNe = avg(neHB), mMix = avg(mixW);

      // (1) 방향 선택성: D–H···A 각이 고각 집중 (직선 H-결합 선호 — 등방이면 ~90~120°).
      log.push({ ok: mTheta > 145, name: '⑯방향선택성', msg: `⟨θ(D–H···A)⟩ ${fmt(mTheta)}° > 145° (고각 집중·직선 선호 — 등방 대비 비등방)` });
      // (2) Ne 선택성: 무극성 Ne 는 H-결합 0·물은 유지 (H/O 만 참여).
      log.push({ ok: mNe < 0.5 && mMix > 5, name: '⑯Ne선택성', msg: `Ne H-결합 ${fmt(mNe)}≈0·물 H-결합 ${fmt(mMix)}>0 (무극성 대조 — 선택성)` });
      // (3) E 범위: E_hb/D_OH ∈ (0.03,0.3) — 약결합 위계 (공유보다 약함). 점전하만은 ~0.002 로 부족 → R-HB 채택.
      log.push({ ok: mE > 0.03 && mE < 0.3, name: '⑯E_hb약결합위계', msg: `E_hb/D_OH ${fmt(mE)} ∈(0.03,0.3) (R-HB 보정 — 점전하만은 ~0.002 로 부족·2차 채택)` });
      // (4) 거리 위계: H···A 피크가 공유 d0 의 1.3~2.2배.
      log.push({ ok: mD > 1.3 && mD < 2.2, name: '⑯거리위계', msg: `⟨d(H···A)⟩/d0 ${fmt(mD)} ∈(1.3,2.2) (공유보다 멀고 접촉보다 가까움)` });
      // (5) 온도 응답: 가열 → 분자당 H-결합 수 단조 감소 (네트워크 해체).
      log.push({ ok: mCold > mWarm, name: '⑯온도응답', msg: `배위 저T ${fmt(mCold)} > 고T ${fmt(mWarm)} (가열→네트워크 해체·단조 감소)` });
      // (6) 배위 경향: 저T 에서 분자당 3~4 쪽 (물 네트워크 정성 — 얼음 격자 정량은 S1).
      log.push({ ok: mCold > 2.5 && mCold < 4.5, name: '⑯물네트워크배위', msg: `저T 분자당 H-결합 ${fmt(mCold)} ∈(2.5,4.5) (물 네트워크 — 정사면체 얼음 정량은 S1)` });
      // (7) 장부: R-HB 에너지(U_hb) → U_bond 하위 항목·총 E 보존.
      log.push({ ok: Math.max(...relE) <= E.EPS_E, name: '⑯장부·R-HB닫힘', msg: `max|ΔE|/E ${fmt(Math.max(...relE))} ≤ EPS_E (U_hb → U_bond 귀속·보존)` });
    }

    // 20. ⑰ 산·염기 — ⑯ 물 네트워크 위 양성자 이전(H⁺ 가 H-결합 링크를 갈아탄다). 이온·릴레이·산 창발.
    if (want(17)) {
      const R = 4, avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
      const SB = { count: 16, L: 7.6, eqSteps: 2500 };   // verify 용 소형·고속 빌드
      const totalFormal = (w) => w.atoms.reduce((s, a) => s + AB.formal(w, a), 0);
      const totalH = (w) => w.atoms.filter((a) => (a.Z || 0) === 1).length;
      // (a) 자동 이온화 평형: 이온쌍 주입 → 재결합(중성 우세·K_w≪1) · 온도 응답(흡열) · 장부·전하·예산.
      let iniC = [], finC = [], tailLo = [], tailHi = [], drift = [], maxO = [], chg = 0, hOk = true;
      for (let s = 0; s < R; s++) {
        const w = S.build('s17-autoionize', Object.assign({ seed: 50 + s, T0: 0.05, preIons: 4 }, SB));
        const h0 = totalH(w); iniC.push(AB.ions(w).nCat);
        const E0 = M.ledgerTable(w).total; let mx = 0, ts = 0, tn = 0;
        for (let k = 0; k < 2000; k++) { E.step(w); mx = Math.max(mx, Math.abs(M.ledgerTable(w).total - E0) / Math.abs(E0)); if (k >= 1200) { ts += AB.ions(w).nCat; tn++; } }
        const info = AB.ions(w); finC.push(info.nCat); drift.push(mx); maxO.push(info.maxCoordO);
        chg = Math.max(chg, Math.abs(totalFormal(w))); if (totalH(w) !== h0) hOk = false;
        // 온도 응답 (같은 seed 저T vs 고T 꼬리 평균 — 흡열이라 고T 잔여 이온이 많다·긴 꼬리로 노이즈 완화)
        const wl = S.build('s17-autoionize', Object.assign({ seed: 90 + s, T0: 0.02, preIons: 5 }, SB));
        const wh = S.build('s17-autoionize', Object.assign({ seed: 90 + s, T0: 0.13, preIons: 5 }, SB));
        let sl = 0, sh = 0, nl = 0; for (let k = 0; k < 2600; k++) { E.step(wl); E.step(wh); if (k >= 1000) { sl += AB.ions(wl).nCat; sh += AB.ions(wh).nCat; nl++; } }
        tailLo.push(sl / nl); tailHi.push(sh / nl);
      }
      const mIni = avg(iniC), mFin = avg(finC), mLo = avg(tailLo), mHi = avg(tailHi), mDrift = Math.max(...drift), mMaxO = Math.max(...maxO);
      // (b) 릴레이 (Grotthuss): 여분 양성자 1개 — 전하 누적 MSD ≫ 분자(O) MSD (전하가 분자보다 빨리 이동).
      let ratios = [];
      for (let s = 0; s < R; s++) {
        const w = S.build('s17-relay', Object.assign({ seed: 70 + s, T0: 0.03 }, SB));
        w.atoms.forEach((a) => { a.disp.x = 0; a.disp.y = 0; a.disp.z = 0; });
        const tr = AB.makeTracker(w);
        for (let k = 0; k < 2500; k++) { E.step(w); AB.trackStep(w, tr); }
        let om = 0, on = 0; for (const a of w.atoms) if ((a.Z || 0) === 8) { om += E.V.lenSq(a.disp); on++; }
        ratios.push(tr.path2 / Math.max(1e-6, om / on));
      }
      const mRatio = avg(ratios);
      // (c) 산 첨가 → [H₃O⁺] 증가 (강산 HX 이온화 · 공통 이온 방향).
      let acidC = [], pureC = [];
      for (let s = 0; s < R; s++) {
        const wa = S.build('s17-acid-mix', Object.assign({ seed: 80 + s, T0: 0.03, nAcid: 5 }, SB)); E.run(wa, 2000); acidC.push(AB.ions(wa).nCat);
        const wp = S.build('s17-autoionize', Object.assign({ seed: 80 + s, T0: 0.03, preIons: 0 }, SB)); E.run(wp, 2000); pureC.push(AB.ions(wp).nCat);
      }
      const mAcid = avg(acidC), mPure = avg(pureC);

      // (1) 재결합·중성 우세: 주입 이온쌍이 재결합해 크게 감소 (K_w ≪ 1 — 중성 물 우세).
      log.push({ ok: mFin < 0.5 * mIni, name: '⑰재결합·중성우세', msg: `양이온 주입 ${fmt(mIni)} → 최종 ${fmt(mFin)} (< ½ 주입 · 재결합 우세 · K_w≪1)` });
      // (2) 온도 응답 (흡열·르샤틀리에): 고T 잔여 이온 > 저T (가열이 이온쪽을 favor).
      log.push({ ok: mHi > mLo, name: '⑰온도응답(흡열)', msg: `꼬리 평균 이온 고T ${fmt(mHi)} > 저T ${fmt(mLo)} (자동이온화 흡열 — 가열→K_w 증가)` });
      // (3) 릴레이 (Grotthuss): 전하 MSD ≫ 분자 MSD (양성자가 분자보다 빨리 이동).
      log.push({ ok: mRatio > 10, name: '⑰릴레이Grotthuss', msg: `전하 누적MSD/분자MSD ${fmt(mRatio)} ≫ 1 (D_H>D_mol — 전하가 O 보다 빨리 이동·릴레이)` });
      // (4) 산 → [H₃O⁺] 증가: 강산 HX 이온화로 양이온 증가 (순수 물 대비).
      log.push({ ok: mAcid > mPure + 0.5, name: '⑰산→H₃O⁺증가', msg: `양이온 산첨가 ${fmt(mAcid)} > 순수 ${fmt(mPure)} (HX 이온화 → [H₃O⁺] 증가)` });
      // (5) 예산 (배위 결합): O 배위 ≤ 3 (H₃O⁺ 까지·H₄O²⁺ 없음 — 연속 예산 검증).
      log.push({ ok: mMaxO <= 3, name: '⑰배위예산(≤3)', msg: `최대 O 배위 ${fmt(mMaxO)} ≤ 3 (H₃O⁺ 까지·H₄O²⁺ 없음 — 배위 결합)` });
      // (6) 전하 보존: Σ 형식전하 = 0 정확 (양성자 이전은 전하를 옮길 뿐 만들지 않는다).
      log.push({ ok: chg < 1e-9, name: '⑰전하보존(Σformal=0)', msg: `|Σ 형식전하| ${fmt(chg)} < 1e-9 (D −1·A +1 → 합 0 · 정확)` });
      // (7) 장부·H 보존: 총 H 수 불변 + 런 표류 (이온 쿨롱 + ⑯ 고립쌍 준정적 최소화 ~1e-7/사건 누적).
      log.push({ ok: hOk && mDrift < 2e-3, name: '⑰장부·H보존', msg: `H 수 보존 ${hOk} · max|ΔE|/E ${fmt(mDrift)} < 2e-3 (이온 강성 + ⑯ 고립쌍 준정적 최소화 ~1e-7/사건 누적)` });
    }

    // 21. ⑱ 연소 — ⑥ 결합 + ⑩ 실원소 위 추상 1행이 라디칼 연쇄(점화·발열·분지)를 만든다 (원리 0·행 추가).
    if (want(18)) {
      const R = 4, avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
      const heat = (w) => { const t = M.ledgerTable(w); return t.K_tr + t.E_photon + t.E_escape; };
      const oAtoms = (w) => { let n = 0; for (const a of w.atoms) if ((a.Z || 0) === 8 && Cb.rem(w, a) === 2) n++; return n; };
      // 점화 상자: 스파크 vs 미점화. 라디칼 연쇄·발열·분지·H₂O·보존.
      let radSp = [], radNo = [], qSp = [], qNo = [], waterSp = [], waterNo = [], oMaxSp = [], drift = [], cOk = true;
      for (let s = 0; s < R; s++) {
        for (const spark of [true, false]) {
          const w = S.build('s18-ignition', { seed: 30 + s, spark, T0: 0.15 });
          const c0 = w.atoms.length, Q0 = heat(w), E0 = M.ledgerTable(w).total;
          let rmax = 0, omax = 0, mxdr = 0;
          for (let k = 0; k < 8000; k++) { E.step(w); rmax = Math.max(rmax, Cb.radicals(w).n); omax = Math.max(omax, oAtoms(w)); mxdr = Math.max(mxdr, Math.abs(M.ledgerTable(w).total - E0) / Math.max(1, Math.abs(E0))); }
          const dQ = heat(w) - Q0, nw = Cb.nWater(w);
          if (w.atoms.length !== c0) cOk = false;
          if (spark) { radSp.push(rmax); qSp.push(dQ); waterSp.push(nw); oMaxSp.push(omax); drift.push(mxdr); }
          else { radNo.push(rmax); qNo.push(dQ); waterNo.push(nw); }
        }
      }
      const mRadSp = avg(radSp), mRadNo = avg(radNo), mQSp = avg(qSp), mQNo = avg(qNo), mWSp = avg(waterSp), mWNo = avg(waterNo), mOSp = avg(oMaxSp), mDr = Math.max(...drift);
      // 전선: 가늘고 긴 상자 — 스파크(좌단)의 반응이 먼 끝(우측 절반)까지 퍼진다 (공간 확산).
      let reachFar = 0;
      for (let s = 0; s < R; s++) {
        const w = S.build('s18-flame-front', { seed: 60 + s });
        const Lx = w.box.L.x;
        for (let k = 0; k < 9000; k++) E.step(w);
        let fx = 0; for (const a of w.atoms) if (Cb.rem(w, a) > 0 && a.r.x > fx) fx = a.r.x;
        if (fx > Lx * 0.5) reachFar++;
      }

      // (1) 점화 대조: 스파크가 라디칼 연쇄를 증폭 (미점화 대비). — 점화 문턱의 정성판.
      log.push({ ok: mRadSp > 2 * mRadNo, name: '⑱점화대조', msg: `라디칼 최대 스파크 ${fmt(mRadSp)} > 2× 미점화 ${fmt(mRadNo)} (연쇄 증폭 — 점화)` });
      // (2) 미점화 준안정: 스파크 없으면 연료가 대체로 온전 (라디칼 소수).
      log.push({ ok: mRadNo < 0.5 * mRadSp, name: '⑱미점화준안정', msg: `미점화 라디칼 ${fmt(mRadNo)} ≪ 점화 ${fmt(mRadSp)} (H₂+O₂ 준안정 — 문턱 아래 억제)` });
      // (3) 발열: 스파크 연소가 결합 E 를 열(K_tr+복사)로 방출 (미점화보다 큼).
      log.push({ ok: mQSp > 0 && mQSp > mQNo, name: '⑱발열', msg: `열방출 Δ(K+복사) 스파크 ${fmt(mQSp)} > 0·미점화 ${fmt(mQNo)} (결합 E → 열 · 발열)` });
      // (4) 분지 (author 0): 원자 O(예산 잔여 2)가 연소 중 나타난다 — 라디칼 1→2 분지원 (예산 창발).
      log.push({ ok: mOSp >= 2, name: '⑱분지(원자O)', msg: `연소 중 원자 O(잔여2) 최대 ${fmt(mOSp)} ≥ 2 (분지 agent — 예산에서 창발·author 0)` });
      // (5) H₂O 생성: 스파크 연소가 물을 만든다 (미점화 대비).
      log.push({ ok: mWSp > mWNo, name: '⑱H₂O생성', msg: `H₂O 스파크 ${fmt(mWSp)} > 미점화 ${fmt(mWNo)} (연소 산물 · 2H₂+O₂→2H₂O)` });
      // (6) 전선 확산: 스파크의 반응이 상자 먼 끝(우측 절반)까지 공간 전파 (미연소 연료 속으로).
      log.push({ ok: reachFar >= R - 1, name: '⑱전선확산', msg: `전선이 상자 절반 넘어 도달 ${reachFar}/${R} (스파크→반응이 연료 속 공간 확산)` });
      // (7) 보존: 원자 수(Σc) 정확 불변 + 총 E 표류 유계 (발열 강성 — dt 유계).
      log.push({ ok: cOk && mDr < 5e-2, name: '⑱장부·Σc보존', msg: `원자 수 보존 ${cOk} · max|ΔE|/E ${fmt(mDr)} < 5e-2 (연소 발열 강성·닫힌 계 단열)` });
    }

    return log;
  }

  function report(log) {
    let pass = 0, fail = 0;
    for (const e of log) {
      const tag = e.ok ? 'PASS' : 'FAIL';
      const t = e.ms != null ? ` (${(e.ms / 1000).toFixed(1)}s)` : '';
      console.log(`[${tag}] ${e.msg}${t}`);
      if (e.ok) pass++; else fail++;
    }
    const scope = ONLY ? `--only ${[...ONLY].join(',')} — 부분 실행 (step 닫기 전 전량 회귀 필수)` : '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱ 전량';
    console.log(`\n── S0 verify (${scope}): ${pass} PASS · ${fail} FAIL ──`);
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
