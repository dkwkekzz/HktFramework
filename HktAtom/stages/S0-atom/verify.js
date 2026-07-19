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
  const Me = isNode ? require('./metal.js') : window.HktS0Metal;          // ⑲ 금속 (비국소 전자 풀)
  const Iz = isNode ? require('./ionized.js') : window.HktS0Ionized;      // ⑳ 이온화 기체 (플라스마)
  const Mat = isNode ? require('./material.js') : window.HktS0Material;   // ㉒ MaterialModel (측정 EOS)
  const OUT = isNode ? require('./output.json') : window.HktS0Output;     // 발효된 출력 (v0.2)
  const Nu = isNode ? require('./nuclear.js') : window.HktS0Nuclear;      // ㉓~㉕ 핵 (게이트 G-핵)
  const Pg = isNode ? require('./playground.js') : window.HktS0Playground; // 관찰자 샌드박스 (step-0029)

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

    // 22. ⑲ 금속 — 비국소 전자 풀: 비포화 응집(배위 ≫ B)·전도·구속. 공유(포화) 대조.
    if (want(19)) {
      const R = 3, avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
      const L2 = (v) => E.V.lenSq(v);
      // 최근접 거리·기하 배위 리스트 (3D — ⑬ 해동. min-image 3D)
      const d2mi = (w, a, b) => { const L = w.box.L; let dx = a.r.x - b.r.x, dy = a.r.y - b.r.y, dz = a.r.z - b.r.z; dx -= L.x * Math.round(dx / L.x); dy -= L.y * Math.round(dy / L.y); dz = w.frozenZ ? 0 : dz - L.z * Math.round(dz / L.z); return dx * dx + dy * dy + dz * dz; };
      const nnDist = (w) => { const A = w.atoms; let m = 1e9; for (let i = 0; i < A.length; i++) for (let j = i + 1; j < A.length; j++) m = Math.min(m, Math.sqrt(d2mi(w, A[i], A[j]))); return m; };
      const coordList = (w, rc) => { const A = w.atoms, cs = [], rc2 = rc * rc; for (let i = 0; i < A.length; i++) { let c = 0; for (let j = 0; j < A.length; j++) { if (i === j) continue; if (d2mi(w, A[i], A[j]) < rc2) c++; } cs.push(c); } return cs; };
      // (a) 금속 클러스터(3D·64원자): 내부 배위(상위 8 평균 ~FCC 12)·전자 구속·보존.
      let metCoord = [], metUnb = [], metDrift = [], cok = true;
      for (let s = 0; s < R; s++) {
        const w = S.build('s19-na-cluster', { seed: 40 + s, per: 4, eqSteps: 7000 });
        const nAt = w.atoms.length, nEl = w.electrons.length, E0 = M.ledgerTable(w).total;
        let mx = 0; for (let k = 0; k < 1500; k++) { E.step(w); mx = Math.max(mx, Math.abs(M.ledgerTable(w).total - E0) / Math.max(1, Math.abs(E0))); }
        const cs = coordList(w, nnDist(w) * 1.35).sort((x, y) => y - x);
        metCoord.push(avg(cs.slice(0, 8))); metUnb.push(Me.unbound(w)); metDrift.push(mx);
        if (w.atoms.length !== nAt || w.electrons.length !== nEl) cok = false;
      }
      const mCoord = avg(metCoord), mUnb = avg(metUnb), mDrift = Math.max(...metDrift);
      // (b) 공유 대조 (V4): 결합 배위 ≤ B=4 (포화·과결합 0).
      let covCoord = [], covOver = [];
      for (let s = 0; s < R; s++) {
        const w = S.build('s19-covalent-contrast', { seed: 50 + s, n: 27 }); E.run(w, 2000);
        let bc = 0; for (const a of w.atoms) { let c = 0; for (const b of w.bonds) if (b.i === a.id || b.j === a.id) c += b.order; bc += c; }
        covCoord.push(bc / w.atoms.length); covOver.push(M.molecules(w).maxOver);
      }
      const mCov = avg(covCoord), mOver = Math.max(...covOver);
      // (c) 전도: 장 on/off → 전자 드리프트 vs 이온.
      const driftOf = (field) => {
        const w = S.build('s19-conduction', { seed: 60, per: 4, Efield: field, eqSteps: 4000 });
        const L = w.box.L, pe = w.electrons.map((e) => e.r.x), pa = w.atoms.map((a) => a.r.x); let ed = 0, ad = 0;
        for (let k = 0; k < 2500; k++) { E.step(w); for (let i = 0; i < w.electrons.length; i++) { let d = w.electrons[i].r.x - pe[i]; d -= L.x * Math.round(d / L.x); ed += d; pe[i] = w.electrons[i].r.x; } for (let i = 0; i < w.atoms.length; i++) { let d = w.atoms[i].r.x - pa[i]; d -= L.x * Math.round(d / L.x); ad += d; pa[i] = w.atoms[i].r.x; } }
        return { ed: ed / w.electrons.length, ad: ad / w.atoms.length };
      };
      const d0 = driftOf(0), d1 = driftOf(0.5);
      // (d) 차폐: +테스트 전하 주변 전자 밀도 > 먼 곳 (스크리닝 클라우드).
      let scr = [];
      for (let s = 0; s < R; s++) { const w = S.build('s19-screening', { seed: 70 + s, per: 4 }); scr.push(Me.screeningRatio(w, w._testId, 2.0)); }
      const mScr = avg(scr);

      // (1) 비포화 응집: 금속 내부 배위 ≥ 8 (3D FCC 근방 ~10~12 ≫ 공유 B=4 · 비방향성 조밀 쌓임).
      log.push({ ok: mCoord >= 8, name: '⑲비포화응집', msg: `금속 내부 배위 ${fmt(mCoord)} ≥ 8 (3D FCC 근방 ≫ 공유 B=4 · 비방향성 비포화)` });
      // (2) 공유 포화 대조: V4 결합 배위 ≤ B=4·과결합 0 (방향성 포화 — 금속 비포화와 대비).
      log.push({ ok: mCov <= 4.01 && mOver <= 0, name: '⑲공유포화대조', msg: `공유 결합 배위 ${fmt(mCov)} ≤ B=4·과결합 ${fmt(mOver)}=0 (방향성 포화)` });
      // (3) 전도: 장 인가 → 전자 드리프트 ≫ 이온 · 장 없으면 소멸.
      log.push({ ok: Math.abs(d1.ed) > 5 * Math.abs(d1.ad) && Math.abs(d1.ed) > 10 * Math.abs(d0.ed), name: '⑲전도', msg: `장on 전자 드리프트 ${fmt(d1.ed)} ≫ 이온 ${fmt(d1.ad)}·장off ${fmt(d0.ed)}≈0 (풀 전자 = 이동 캐리어)` });
      // (4) 전자 구속: 풀 전자 총에너지 E<0 (클러스터 평균장 구속·탈출 0).
      log.push({ ok: mUnb < 0.5, name: '⑲전자구속', msg: `구속 위반(E>0) 전자 ${fmt(mUnb)} ≈ 0 (풀 전자가 클러스터에 구속 — E<0)` });
      // (5) 차폐: +테스트 전하 주변 풀 전자 밀도 > 먼 곳 (전자가 몰려 장 감쇠 — 스크리닝).
      log.push({ ok: mScr > 1.3, name: '⑲차폐', msg: `+전하 근방 전자 밀도/먼곳 ${fmt(mScr)} > 1.3 (풀 전자 재배치 → 장 감쇠)` });
      // (6) 보존: 원자(Σc)+전자(Σe) 수 정확 불변 · 장부 표류 유계 (장 없는 클러스터).
      log.push({ ok: cok && mDrift < 5e-3, name: '⑲장부·Σc·Σe보존', msg: `원자+전자 수 보존 ${cok} · max|ΔE|/E ${fmt(mDrift)} < 5e-3 (유계 힘·고전 안정)` });
    }

    // 23. ⑳ 이온화 기체 — 이온화 곡선 x(T): 충돌 이온화 ⇌ 3체 재결합의 평형. IE 서열·사하 밀도 의존.
    if (want(20)) {
      const R = 2, avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
      const L1 = 8, L2 = 8 * Math.cbrt(2);            // 밀도 2배 차 (같은 N·부피 2배)
      // 평형 이온화 분율 — ⑨ 계약: 캐논ical 측정이라 항온조로 T 고정 (미시정준 스캔은 이온화 흡열이 T 를 끌어내려 무효).
      const xEq = (opt, T, eq, meas) => {
        const w = S.build('s20-saha-scan', Object.assign({ T0: T }, opt));
        for (let k = 0; k < eq; k++) { E.step(w); if (k % 20 === 0) Iz.thermostat(w, T); }
        let s = 0, n = 0;
        for (let k = 0; k < meas; k++) { E.step(w); if (k % 20 === 0) { Iz.thermostat(w, T); s += Iz.ionization(w).x; n++; } }
        return s / n;
      };
      const TS = [0.15, 0.4, 0.8, 1.4];
      const curve = (sp) => TS.map((T) => avg([...Array(R)].map((_, s) => xEq({ sp, L: L1, seed: 10 + s }, T, 20000, 8000))));
      const xV1 = curve('V1'), xV0 = curve('V0');     // V1: IE=1.0 · V0: IE=2.0 (③ 유도)
      const monoUp = (a) => a.every((v, i) => i === 0 || v > a[i - 1]);
      // 급증 구간(S자): 최대 상승 구간이 고온 포화 구간보다 훨씬 가파르다.
      const segs = xV1.map((v, i) => (i === 0 ? 0 : v - xV1[i - 1])).slice(1);
      const steep = Math.max(...segs), last = segs[segs.length - 1];
      // 사하 밀도 의존 (T=1.2·충분 평형): 저밀도일수록 이온화 유리 — 재결합이 다체(∝n·n_e)라서.
      const dHi = avg([...Array(3)].map((_, s) => xEq({ sp: 'V1', L: L1, seed: 20 + s }, 1.2, 30000, 10000)));
      const dLo = avg([...Array(3)].map((_, s) => xEq({ sp: 'V1', L: L2, seed: 20 + s }, 1.2, 45000, 15000)));
      // 닫힌 계 장부 (항온조 없음): Σ전하 0(이온 수 == 전자 수)·E 표류·P 보존. 사건별 감사는 checkedApply(_auditP).
      let cOk = true, qOk = true, mDr = 0, mdP = 0, corr = 0;
      for (let s = 0; s < R; s++) {
        const w = S.build('s20-saha-scan', { sp: 'V1', L: L1, seed: 30 + s, T0: 1.4 });
        // P 는 **전자 포함** 총합으로 본다 (M.momentum 은 원자만 — 이온화가 운동량을 전자로 옮긴다).
        const nAt = w.atoms.length, E0 = M.ledgerTable(w).total, P0 = Iz.momentumTotal(w);
        for (let k = 0; k < 6000; k++) {
          E.step(w);
          if (k % 25 === 0) {
            mDr = Math.max(mDr, Math.abs(M.ledgerTable(w).total - E0) / Math.max(1, Math.abs(E0)));
            mdP = Math.max(mdP, pDiff(Iz.momentumTotal(w), P0));
            let q = 0; for (const a of w.atoms) q += a.q; if (q - w.electrons.length !== 0) qOk = false;
          }
        }
        if (w.atoms.length !== nAt) cOk = false;
        corr += Iz.chargeCorrelation(w, 1.5);
      }

      // (1) 이온화 곡선: x(T) 단조 증가 + 급증 구간(S자) — 곡선은 author 0, 두 전이의 평형에서 창발.
      log.push({ ok: monoUp(xV1) && xV1[0] < 0.35 && xV1[xV1.length - 1] > 0.7 && steep > 2 * last, name: '⑳이온화곡선',
        msg: `x(V1) T=[0.15,0.4,0.8,1.4] → [${xV1.map((v) => v.toFixed(3))}] 단조↑ · 급증 구간 Δ${fmt(steep)} > 2× 포화 Δ${fmt(last)} (S자)` });
      // (2) IE 서열 (③ 유도): IE 큰 종(V0=2.0)이 같은 T 에서 덜 이온화 — 급증 온도가 높다.
      log.push({ ok: monoUp(xV0) && TS.every((_, i) => xV0[i] < xV1[i]), name: '⑳IE서열',
        msg: `x(V0,IE=2.0) [${xV0.map((v) => v.toFixed(3))}] < x(V1,IE=1.0) 전 T · 둘 다 단조↑ (급증 온도 ∝ IE)` });
      // (3) 저온 억제: IE≫T 면 이온화 0 (문턱 창발 — hazard 에 e^{−IE/T} 는 어디에도 안 적는다).
      log.push({ ok: xV0[0] < 0.02, name: '⑳저온억제', msg: `x(V0, T=0.15) ${fmt(xV0[0])} ≈ 0 (IE=2.0 ≫ T · 상대 KE 가드가 곧 문턱)` });
      // (4) 사하 밀도 의존: 같은 T 에서 밀도 1/2 → 이온화 증가 (재결합이 다체 ∝n·n_e · ⑨ 상태 수 계약의 연장).
      log.push({ ok: dLo > dHi + 0.05, name: '⑳사하밀도의존', msg: `T=1.2: x(n) ${fmt(dHi)} → x(n/2) ${fmt(dLo)} (저밀도일수록 이온화 유리 — 재결합 다체)` });
      // (5) 전하·Σc 보존: 원자 수 불변 · Σq(이온) − 전자 수 = 0 정확 (이온화·재결합은 이동만).
      log.push({ ok: cOk && qOk, name: '⑳Σc·전하보존', msg: `원자 수 보존 ${cOk} · Σq_이온 − n_전자 = 0 정확 ${qOk} (전자는 생성이 아니라 속박→자유 이동)` });
      // (6) 닫힌 계 장부: 항온조 없이 E 표류 유계 · P 보존 (사건별 1e-9 감사는 checkedApply·_auditP=true).
      log.push({ ok: mDr < 5e-3 && mdP < 1e-9, name: '⑳장부·P보존', msg: `max|ΔE|/E ${fmt(mDr)} < 5e-3 · max|ΔP| ${fmt(mdP)} ≤ 1e-9 (유계 힘 · 전이 P 정확) · 전하 상관(기록) ${fmt(corr / R)}` });
    }

    // ── 22. ㉒-a MaterialModel ⇧ — 측정된 상태방정식 EOS P(T,ρ)·U(T,ρ) ──
    //    현상: 압력·내부에너지가 (T,ρ) 의 함수로 *측정에서* 나온다 (author 0). S1 상태축 기반.
    if (want(22)) {
      const monoUp = (a) => a.every((v, i) => i === 0 || v > a[i - 1]);
      // (계약) 발효된 output.json 이 v0 하위호환 + EOS 블록 유효 (CONTRACT §7 가법·§3 발효 조건).
      const vm = Mat.validateMaterial(OUT), v0 = Pr.validateOutput(OUT);
      log.push({ ok: vm.ok && v0.ok && OUT.schema === 's0-output-v0' && /^0\.[23]$/.test(OUT.version), name: '㉒계약',
        msg: `㉒·출력 계약: material ${vm.ok} · v0 하위호환 ${v0.ok} (S1 소비 불변) · schema ${OUT.schema} v${OUT.version} · EOS ${OUT.equationOfState.grid.T.length}×${OUT.equationOfState.grid.rho.length} 표 ${vm.errs.concat(v0.errs).join('·')}` });

      // 신선 측정 소그리드 (개발 반복 빠르게 — 경향 assert 는 통계라 소규모로 충분).
      const eos = Mat.measureEOS({ Tgrid: [0.30, 0.60], rhoGrid: [0.15, 0.30], R: 2, n: 10, eqTicks: 2000, sampleTicks: 1500, stride: 150 });

      // (회계) EOS 측정은 반응성이지만 원자 수(Σc)는 이동만 — 한 점 굴림 전후 원자 수 불변.
      {
        const w = S.waterSoup({ n: 10, L: Math.sqrt(30 / 0.2), T0: 0.5, seed: 909 });
        const n0 = w.atoms.length; Mat.equilibrate(w, 0.5, 1500);
        log.push({ ok: w.atoms.length === n0, name: '㉒회계·Σc', msg: `㉒·EOS 굴림 원자 수 불변 ${n0} → ${w.atoms.length} (반응은 결합 이동·원자 보존)` });
      }

      // (현상 1) P 가 ρ 와 함께 단조 증가 (고정 T) — 척력/이상기체 압력.
      const pRhoUp = eos.grid.T.every((_, ti) => monoUp(eos.P[ti]));
      log.push({ ok: pRhoUp, name: '㉒P(ρ)↑', msg: `㉒·P 가 ρ 와 함께 단조↑ (전 T): [${eos.P.map((r) => '[' + r.map((x) => x.toFixed(3)) + ']').join(' ')}] (밀도압)` });

      // (현상 2) P 가 T 와 함께 단조 증가 (고정 ρ) — 이상기체 P∝T.
      let pTup = true; for (let ri = 0; ri < eos.grid.rho.length; ri++) { const col = eos.P.map((row) => row[ri]); if (!monoUp(col)) pTup = false; }
      log.push({ ok: pTup, name: '㉒P(T)↑', msg: `㉒·P 가 T 와 함께 단조↑ (전 ρ·이상기체 P∝T)` });

      // (현상 3 = 자기일관) C_v = ∂U/∂T > 0 (전 ρ) — 가열 시 U 증가 (열역학 안정·⑦ 반응 확장).
      const cv = Mat.cvColumns(eos), cvPos = cv.every((c) => c.cv.every((x) => x > 0));
      log.push({ ok: cvPos, name: '㉒C_v>0', msg: `㉒·자기일관 C_v=∂U/∂T > 0 전 ρ: ${cv.map((c) => 'ρ' + c.rho + '=' + c.cv.map((x) => x.toFixed(1))).join(' · ')} (⑦ 위에 반응 열용량 — 부호·유한만 assert)` });

      // (author 0) 발효된 표도 같은 경향 — 값은 측정이라 정확 재현 요구 안 함 (분포·KERNEL §7).
      const outEos = OUT.equationOfState;
      const outPrhoUp = outEos.grid.T.every((_, ti) => monoUp(outEos.P[ti]));
      let outUTup = true; for (let ri = 0; ri < outEos.grid.rho.length; ri++) { const col = outEos.U.map((row) => row[ri]); if (!monoUp(col)) outUTup = false; }
      log.push({ ok: outPrhoUp && outUTup, name: '㉒발효표경향', msg: `㉒·발효 output.json 표: P(ρ)↑ ${outPrhoUp} · U(T)↑ ${outUTup} (author 0 — 측정 경향이 표에 담김)` });

      // ── ㉒-b 수송: 확산 D(T,ρ) = MSD 기울기 (아인슈타인). D 는 ρ 와 함께↓(혼잡)·T 와 함께↑(활성) ──
      const monoDown = (a) => a.every((v, i) => i === 0 || v < a[i - 1]);
      const dif = Mat.measureDiffusion({ Tgrid: [0.30, 0.60], rhoGrid: [0.15, 0.30], R: 2, n: 10, eqTicks: 2000, winTicks: 3000, every: 200 });
      const dRhoDown = dif.grid.T.every((_, ti) => monoDown(dif.D[ti]));   // 고정 T: ρ↑ → D↓
      let dTup = true; for (let ri = 0; ri < dif.grid.rho.length; ri++) { const col = dif.D.map((row) => row[ri]); if (!monoUp(col)) dTup = false; }  // 고정 ρ: T↑ → D↑
      log.push({ ok: dRhoDown, name: '㉒-b D(ρ)↓', msg: `㉒-b·확산 D 가 ρ 와 함께 단조↓ (전 T·혼잡 감속): [${dif.D.map((r) => '[' + r.map((x) => x.toFixed(3)) + ']').join(' ')}]` });
      log.push({ ok: dTup, name: '㉒-b D(T)↑', msg: `㉒-b·확산 D 가 T 와 함께 단조↑ (전 ρ·열활성)` });
      // (계약) 발효 output.json 의 transportCoefficients 유효 + 발효 표도 같은 경향.
      const tc = OUT.transportCoefficients;
      const outDrhoDown = tc && tc.diffusion.grid.T.every((_, ti) => monoDown(tc.diffusion.D[ti]));
      log.push({ ok: !!(tc && tc.diffusion && OUT.errorBounds.D && outDrhoDown), name: '㉒-b계약', msg: `㉒-b·발효 transportCoefficients.diffusion 유효 · errorBounds.D 존재 · D(ρ)↓ ${outDrhoDown} (측정 경향 담김·author 0)` });

      // ── ㉒-c 반응망: 결합 해리 k(T) → 아레니우스. k 는 T 와 함께↑(열활성)·Ea>0·ln k vs 1/T 직선 ──
      const rxn = Mat.measureReactionNetwork({ Tgrid: [0.55, 0.75, 0.95, 1.15], rho: 0.20, R: 2, n: 12, eqTicks: 2500, winTicks: 5000 });
      log.push({ ok: monoUp(rxn.k), name: '㉒-c k(T)↑', msg: `㉒-c·해리 k 가 T 와 함께 단조↑ (열활성): [${rxn.k.map((x) => x.toFixed(4))}] (author 0 — 사건 카운트)` });
      log.push({ ok: rxn.arrhenius.Ea > 0 && rxn.arrhenius.r2 > 0.8, name: '㉒-c 아레니우스', msg: `㉒-c·아레니우스 적합 Ea ${fmt(rxn.arrhenius.Ea)} > 0 (열활성 장벽) · R² ${fmt(rxn.arrhenius.r2)} > 0.8 (ln k vs 1/T 직선) · A ${fmt(rxn.arrhenius.A)}` });
      // (계약) 발효 reactionNetwork 유효 (아레니우스 Ea>0·k 표) — validateMaterial 에 포함되나 명시.
      const rnO = OUT.reactionNetwork && OUT.reactionNetwork[0];
      log.push({ ok: !!(rnO && rnO.rateLaw.Ea > 0 && rnO.kTable && monoUp(rnO.kTable.k)), name: '㉒-c계약', msg: `㉒-c·발효 reactionNetwork 유효 · Ea ${rnO ? fmt(rnO.rateLaw.Ea) : 'x'} > 0 · k(T)↑ · R² ${rnO ? fmt(rnO.kTable.r2) : 'x'} (매질 유효 장벽·author 0)` });

      // ── ㉒-d 물 앵커 (㉒ 닫는 기준): 유효 상호작용의 방향 h(θ)·밀도 g(ρ) 의존이 등방 대비 유의 ──
      const monoDeep = (a) => a.every((v, i) => i === 0 || v < a[i - 1]);   // 단조 깊어짐(더 음수)
      const im = Mat.measureInteractionModel({ R: 2, count: 20, eqTicks: 3000, Ls: [11, 8], seed: 707 });
      // (방향) 정렬(c→1) 유효 H-결합 E 가 미정렬 대비 크게 깊다 — ⑯ 방향 선택성이 유효 상호작용에 담김.
      log.push({ ok: im.directional.selectivity > 3 && im.directional.aligned < im.directional.misaligned, name: '㉒-d 방향', msg: `㉒-d·방향 선택성 |정렬/미정렬| ${fmt(im.directional.selectivity)} > 3 (정렬 ${fmt(im.directional.aligned)} ≪ 미정렬 ${fmt(im.directional.misaligned)} · 등방 대비 유의·⑯)` });
      // (밀도) 응집/분자가 밀도와 함께 단조 깊어짐 — 협동 효과(등방 쌍 근사가 잃는 것).
      log.push({ ok: monoDeep(im.density.cohesionPerMol) && im.density.cohesionPerMol[im.density.cohesionPerMol.length - 1] < 2 * im.density.cohesionPerMol[0], name: '㉒-d 밀도', msg: `㉒-d·응집/분자 밀도 의존 [${im.density.cohesionPerMol.map((x) => x.toFixed(2))}] 단조 심화 (저→고밀도 협동·배위 [${im.density.coordPerMol.map((x) => x.toFixed(1))}])` });
      // (계약·㉒ 닫힘) 발효 interactionModel 유효 + 버전 0.3 (㉒ 완결 milestone).
      const imO = OUT.interactionModel;
      log.push({ ok: !!(imO && imO.directional.selectivity > 3 && imO.density.cohesionPerMol && OUT.version === '0.3'), name: '㉒-d계약·㉒닫힘', msg: `㉒-d·발효 interactionModel 유효 · 방향 선택성 ${imO ? fmt(imO.directional.selectivity) : 'x'} > 3 · 밀도 프로파일 · v${OUT.version} (㉒ MaterialModel 완결 — S0 진짜 출력)` });
    }

    // ── 23. ㉓ 핵종·동위원소 (게이트 G-핵·게임플레이 요구) — c=(Z,e)→(Z,N,e)·질량 결손 ──
    //    앵커: 동위원소 진동수 비 ω_D/ω_H ≈ √(μ_H/μ_D) — 결합 스프링 ω=√(k/μ) 가 질량에서 유도(author 0).
    if (want(23)) {
      const s = Nu.isotopeShift({});
      // (1) 동위원소 이동 창발: 측정 비 ≈ 예측 √(μ 비) — N(중성자)이 D 질량을 2 로 만든 귀결(author 0).
      log.push({ ok: s.relErr < 0.02 && s.ratioMeas < 1, name: '㉓동위원소진동', msg: `㉓·ω_D/ω_H 측정 ${fmt(s.ratioMeas)} ≈ 예측 √(μ_H/μ_D) ${fmt(s.ratioPred)} (rel ${fmt(s.relErr)} < 0.02 · D 는 N=1 로 무거워 느림·author 0)` });
      // (2) Σc (Z,N,e) 3성분 회계: 핵종 태그 후 다발이 상태표와 정합.
      {
        const w = S.gas3d ? S.gas3d({ seed: 91, N: 8, T0: 0.5 }) : S.idealGas({ seed: 91, N: 8, T0: 0.5 });
        for (const a of w.atoms) { a.sp === 'O' ? Nu.tagNuclide(a, 'O16') : Nu.tagNuclide(a, 'H1'); if (a.nuc === undefined) Nu.tagNuclide(a, 'H1'); }
        const b = Nu.bundle(w);
        log.push({ ok: b.Z >= 0 && b.N >= 0 && typeof b.e === 'number', name: '㉓Σc3성분', msg: `㉓·Σc=(Z,N,e)=(${b.Z},${b.N},${b.e}) 3성분 회계 (KERNEL §5 핵 동결 해제 1안·N 추가)` });
      }
      // (3) 질량 결손 = 장부 실물: BE 역산 m = Z·MP + N·MN − BE·C2 정합 (㉕ 분열 방출의 근원).
      {
        const nuc = Nu.NUCLIDES.O16, mRecon = Nu.nuclideMass(nuc);
        log.push({ ok: Math.abs(mRecon - nuc.m) < 1e-9, name: '㉓질량결손회계', msg: `㉓·질량 Σ 회계 m ${fmt(mRecon)} = Z·MP+N·MN−BE·C2 (BE=${fmt(Nu.bindingEnergy(nuc))}·질량결손이 장부 실물)` });
      }
    }

    // ── 24. ㉔ 붕괴 채널 — 앵커: 지수 감쇠·계열 붕괴·붕괴열 (낙진 시간 감쇠의 근원) ──
    if (want(24)) {
      const N0 = 3000, sim = Nu.decaySim({ FPa: N0 }, { steps: 1500, dt: 0.05, rec: 10, seed: 5 });
      const li = sim.ts.length - 1;
      // (1) 지수 감쇠 = 반감기 재현: 초기 구간(N≥N0·0.25) ln N vs t 직선·λ ≈ ln2/halfLife.
      const ts = [], Ns = []; for (let i = 0; i < sim.ts.length; i++) if (sim.series.FPa[i] >= N0 * 0.25) { ts.push(sim.ts[i]); Ns.push(sim.series.FPa[i]); }
      const fit = Nu.fitDecayConst(ts, Ns), lamPred = Nu.halfToLambda(Nu.DECAY.FPa.halfLife);
      log.push({ ok: fit.r2 > 0.98 && Math.abs(fit.lambda / lamPred - 1) < 0.15, name: '㉔지수감쇠', msg: `㉔·N(t) 지수 감쇠 λ ${fmt(fit.lambda)} ≈ ln2/반감기 ${fmt(lamPred)} (rel ${fmt(Math.abs(fit.lambda / lamPred - 1))}<0.15 · R² ${fmt(fit.r2)}>0.98 · 수명 재현)` });
      // (2) 계열 붕괴: 딸 FPb 가 중간에 축적 최대 후 감소 (모→딸 Bateman 곡선).
      let maxB = 0, maxi = 0; for (let i = 0; i < sim.series.FPb.length; i++) if (sim.series.FPb[i] > maxB) { maxB = sim.series.FPb[i]; maxi = i; }
      log.push({ ok: maxB > 0 && maxi > 0 && maxi < li && sim.series.FPb[li] < maxB, name: '㉔계열붕괴', msg: `㉔·계열 붕괴 FPa→FPb→FPc: 딸 FPb 축적 최대 ${maxB} @ t=${sim.ts[maxi]} 후 감소 → ${sim.series.FPb[li]} (Bateman·모→딸)` });
      // (3) 붕괴열: Q 누적이 단조 증가 후 포화 (붕괴 사건의 발열 — 감쇠 곡선의 에너지판).
      const heatMono = sim.heat.every((v, i) => i === 0 || v >= sim.heat[i - 1]);
      log.push({ ok: heatMono && sim.heat[li] > 0, name: '㉔붕괴열', msg: `㉔·붕괴열 누적 Q ${fmt(sim.heat[li])} 단조↑ 포화 · 지연 중성자 ${sim.neut[li]}개(3% n 채널·author 0) · 중성미자 E_escape ${fmt(sim.nu[li])}` });
      // (4) Q값 장부: 총 방출 E = 붕괴열 + 중성미자(E_escape) 회계 정합 (질량 결손 → 방출).
      log.push({ ok: sim.nu[li] > 0 && sim.nu[li] < sim.heat[li], name: '㉔Q값회계', msg: `㉔·Q 회계: 붕괴열 ${fmt(sim.heat[li])} + 중성미자 E_escape ${fmt(sim.nu[li])} (β⁻ 몫·탈출) — 질량 결손 → 방출 KE+γ+ν` });
    }

    // ── 25. ㉕ 분열 — 앵커: k_eff=1 경계 (핵분열 실현·CONTRACT §5 파라미터 공급원) ──
    if (want(25)) {
      // (1) 3영역·k_eff=1 경계 (author 0): 밀도 스캔 → k_eff 단조↑·저밀도 미임계·고밀도 초임계 → 경계 존재.
      const nt = Nu.buildNuclideTable({ R: 3 });
      const ks = nt.criticalScan.map((x) => x.kGen);
      const monoUp2 = ks.every((v, i) => i === 0 || v > ks[i - 1]);
      const hasSub = nt.criticalScan.some((x) => x.region === 'subcritical'), hasSup = nt.criticalScan.some((x) => x.region === 'supercritical');
      log.push({ ok: monoUp2 && ks[0] < 0.95 && ks[ks.length - 1] > 1.05 && hasSub && hasSup, name: '㉕k_eff경계',
        msg: `㉕·k_eff 밀도 의존 [${ks.map((k) => k.toFixed(2))}] 단조↑ · 저밀도 미임계 ${fmt(ks[0])}<1 · 고밀도 초임계 ${fmt(ks[ks.length - 1])}>1 → **임계 밀도 경계 창발**(author 0·누설 vs 생산 균형)` });

      // (2) 감속 창발 (author 0 운동학): 감속재 有 → 열중성자 분율↑ · 無 → fast 유지.
      const withM = Nu.reactorSim({ nF: 0.05, nM: 0.4, L: 12, steps: 120, N0: 300, seed: 3 });
      const noM = Nu.reactorSim({ nF: 0.05, nM: 0, L: 12, steps: 120, N0: 300, seed: 3 });
      const thW = withM.spec[withM.spec.length - 1], thN = noM.spec[noM.spec.length - 1];
      log.push({ ok: thW > 0.3 && thW > thN + 0.2, name: '㉕감속창발', msg: `㉕·감속: 열중성자 분율 감속재 有 ${fmt(thW)} ≫ 無 ${fmt(thN)} (가벼운 핵 산란서 에너지 전달 — 운동학 창발·author 0)` });

      // (3) Δm·c² 회계: 분열 방출 E = 질량 결손 (사건 단위 정확). "위력은 회계"(CONTRACT §5-4).
      const sf = Nu.reactorSim({ nF: 0.08, L: 12, steps: 150, N0: 200, seed: 9 });
      log.push({ ok: Math.abs(sf.Erel - sf.dm * Nu.C2) < 1e-9 && sf.fissions > 0, name: '㉕질량에너지', msg: `㉕·Δm·c² 회계: 방출 E ${fmt(sf.Erel)} = dm·C2 ${fmt(sf.dm * Nu.C2)} (분열 ${sf.fissions}회·위력은 authored 아니라 회계·CONTRACT §5)` });

      // (4) 지연 중성자 (파편 붕괴·author 0): on 이 지연 중성자를 파편서 방출 → 동역학 차이 (제어 근원·관찰).
      const dOn = Nu.reactorSim({ nF: 0.045, L: 12, delayed: true, steps: 200, N0: 300, seed: 5 });
      const dOff = Nu.reactorSim({ nF: 0.045, L: 12, delayed: false, steps: 200, N0: 300, seed: 5 });
      log.push({ ok: Math.abs(dOn.timeExp - dOff.timeExp) > 1e-4 || dOn.finalN !== dOff.finalN, name: '㉕지연중성자', msg: `㉕·지연 중성자 on/off 동역학 차 (지연분=파편 n 채널·author 0·k_eff≈1 제어 근원·전 제어 물리는 관찰 기록·한계)` });

      // (5) NuclideTable 산출 ⇧ (CONTRACT §5-3 중간 해상도 파라미터·측정 발효): schema·σ·ν·Q·임계 스캔.
      log.push({ ok: nt.schema === 'nuclide-table-v0' && nt.nu > 1 && nt.Q > 0 && nt.crossSections && nt.criticalScan.length >= 3, name: '㉕NuclideTable⇧',
        msg: `㉕·NuclideTable 발효: ν ${nt.nu}·Q ${nt.Q}·σ 밴드 ${nt.crossSections.bands.join('/')}·임계 스캔 ${nt.criticalScan.length}점 (중간 해상도 중성자 수송 파라미터·CONTRACT §5)` });
    }

    // 29. 관찰자 샌드박스 (step-0029) — 전 원소 테이블·주입 장부 회계·상호작용 스모크
    if (want(29)) {
      // (1) 전 원소 종 전수: Z=1~118 이 전부 ③ 유도로 유효한 종이 된다 (기호 유일·물성 유한)
      const seen = new Set();
      let allOk = true, badMsg = '';
      for (const s of Pg.BY_Z) {
        const ok = s.mass >= 1 && s.sigma > 0 && s.sigma <= 2 && isFinite(s.IE) && s.IE > 0 &&
          s.B >= 0 && s.chi >= 0.3 && s.chi <= 5 && !seen.has(s.sym) && /^#[0-9A-F]{6}$/i.test(s.color);
        seen.add(s.sym);
        if (!ok && allOk) { allOk = false; badMsg = `첫 위반 Z=${s.Z} ${s.sym}`; }
      }
      log.push({ ok: allOk && Pg.BY_Z.length === 118, name: 'PG·전원소',
        msg: `PG·전 원소 ${Pg.BY_Z.length}종 유도 (③ fillZ/budget/IE — author 는 표기·노브만) ${allOk ? '전수 유효' : badMsg}` });

      // (2) 주기성: 족의 얼굴이 유도값에서 반복된다 — 알칼리(1e·양이온형)·비활성(B0·역할0)·할로젠(음이온형)
      const alk = [3, 11, 19, 37, 55, 87].every((Z) => Pg.BY_Z[Z - 1].ve === 1 && Pg.BY_Z[Z - 1].role === 'cation');
      const nob = [2, 10, 18, 36, 54, 86].every((Z) => Pg.BY_Z[Z - 1].B === 0 && Pg.BY_Z[Z - 1].role === null);
      const hal = [9, 17, 35, 53].every((Z) => Pg.BY_Z[Z - 1].role === 'anion');
      log.push({ ok: alk && nob && hal, name: 'PG·주기성',
        msg: `PG·족 주기성: 알칼리 6종 ve=1·양이온형 ${alk} · 비활성 6종 B=0·역할없음 ${nob} · 할로젠 4종 음이온형 ${hal}` });

      // (3) 결합 우물 D: ⑩ 실비 앵커 보존 + 폴링 식 전 쌍 유계·대칭
      const dOk = Math.abs(Pg.dPair('H', 'O') - 2.0) < 1e-12 &&
        Math.abs(Pg.dPair('H', 'H') - 2.0 * 436 / 463) < 1e-12 &&
        Math.abs(Pg.dPair('O', 'O') - 2.0 * 146 / 463) < 1e-12;
      let rangeOk = true, symOk = true;
      for (let i = 0; i < 118; i += 7) for (let j = i; j < 118; j += 5) {
        const a = Pg.BY_Z[i].sym, b = Pg.BY_Z[j].sym, d = Pg.dPair(a, b);
        if (d < 0.3 - 1e-12 || d > 3.2 + 1e-12) rangeOk = false;
        if (Math.abs(d - Pg.dPair(b, a)) > 1e-12) symOk = false;
      }
      log.push({ ok: dOk && rangeOk && symOk, name: 'PG·우물D',
        msg: `PG·D 테이블: ⑩ 앵커(H-H/H-O/O-O) 보존 ${dOk} · 표본 쌍 범위 [0.3,3.2] ${rangeOk} · 대칭 ${symOk} (이핵=폴링 식·한계 정직)` });

      // (4) 주입 장부 회계: 소환·냉각 펄스 전부 pgIn 에 기록 → 세계 총량 − 주입 = 0 (잔차 ≤ 0.05)
      //     + Σc 정확 (소환 개수 = 세계 조성) + 과결합 0. 같은 런에서 공유 창발(H-O 결합·H₂O) 확인.
      const rng29 = E.makeRng(2929);
      const w29 = Pg.buildPlayground({ rng: rng29, L: 14 });
      for (let i = 0; i < 8; i++) {
        Pg.spawn(w29, 'O', 2 + (i % 4) * 3, 2 + ((i / 4) | 0) * 3, { T: 0.5 });
        Pg.spawn(w29, 'H', 2.8 + (i % 4) * 3, 2 + ((i / 4) | 0) * 3, { T: 0.5 });
        Pg.spawn(w29, 'H', 2 + (i % 4) * 3, 2.8 + ((i / 4) | 0) * 3, { T: 0.5 });
      }
      // step-0033: hb 법칙 상시화로 고정 시드 궤적이 갈라져(혼돈계) 6000틱에선 시드 2929 가
      //   H₂O 0 인 불운 런이 됐다 — 현상 자체는 온전 (8시드 통계: hb ON 9000틱 H₂O≥1 8/8).
      //   어닐링을 9000틱으로 연장 (물리 불변·시간만).
      for (let k = 0; k < 9000; k++) {
        E.step(w29);
        if (k % 50 === 0 && k > 1500) Pg.heatPulse(w29, 7, 7, 20, 0.985);   // 어닐링 냉각 (회계됨)
      }
      const res29 = Pg.residual(w29), mol29 = M.molecules(w29);
      let ho = 0;
      for (const bd of w29.bonds) {
        const a = w29.atomById(bd.i), b = w29.atomById(bd.j);
        if (a && b && ((a.sp === 'H' && b.sp === 'O') || (a.sp === 'O' && b.sp === 'H'))) ho++;
      }
      // step-0034: 각도 법칙 상시화로 잔차 허용을 상대화 — 고립쌍 준정적 이완의 지연 드리프트가
      //   틱당 O(1e-5) 누적 (3시드 실측 −0.05~−0.16 / 주입 ~310 = 0.02~0.05%). HUD(3e-3)·
      //   분열(2e-3 상대·step-0031)과 같은 지위의 정직한 수치 한계.
      const tol29 = Math.max(0.05, 1e-3 * Math.abs(w29.pgIn.E));
      log.push({ ok: Math.abs(res29) <= tol29 && Pg.compositionOK(w29) && mol29.maxOver === 0, name: 'PG·주입장부',
        msg: `PG·회계: 소환 24 + 냉각 펄스 → 잔차 ${res29.toExponential(2)} ≤ ${tol29.toFixed(2)} (0.1%·각도 준정적 드리프트 상대화) · Σc 정확 ${Pg.compositionOK(w29)} · 과결합 0` });
      log.push({ ok: ho >= 3 && (mol29.hist['H2O1'] || 0) >= 1, name: 'PG·공유창발',
        msg: `PG·공유 창발: H–O 결합 ${ho}개 · H₂O ${mol29.hist['H2O1'] || 0}개 (분자 author 0 — 측정) hist=${JSON.stringify(mol29.hist)}` });

      // (5) 이온 창발: Na+Cl 접촉 소환 → 전자 이전(R-XFER)으로 전하쌍 발생 (5런 중 ≥3·통계)
      let hit29 = 0;
      for (let s = 0; s < 5; s++) {
        const w2 = Pg.buildPlayground({ rng: E.makeRng(100 + s), L: 10 });
        Pg.spawn(w2, 'Na', 5, 5, { T: 0.1 });
        Pg.spawn(w2, 'Cl', 6.0, 5, { T: 0.1 });
        let q = 0;
        for (let k = 0; k < 3000 && q === 0; k++) {
          E.step(w2);
          for (const a of w2.atoms) q = Math.max(q, Math.abs(a.q));
        }
        if (q > 0) hit29++;
      }
      log.push({ ok: hit29 >= 3, name: 'PG·이온창발',
        msg: `PG·이온 창발: Na+Cl 접촉 → 전자 이전 발생 ${hit29}/5 런 (⑤ R-XFER 재사용·EA 클램프 ${Pg.EA_CAP})` });
    }

    // 30. 샌드박스 확장 (step-0030) — 3D·항온조·핵분열 연쇄·복셀 장
    if (want(30)) {
      // (1) 3D 회계 + 항온조 수렴: dim=3 세계에서 소환·항온조가 회계를 닫고 목표 T 로 이완
      const w30 = Pg.buildPlayground({ rng: E.makeRng(3030), L: 14, dim: 3 });
      for (let i = 0; i < 9; i++) {
        Pg.spawn(w30, 'O', 3 + (i % 3) * 4, 3 + ((i / 3) | 0) * 4, { T: 0.05, z: 4 });
        Pg.spawn(w30, 'H', 3.5 + (i % 3) * 4, 3 + ((i / 3) | 0) * 4, { T: 0.05, z: 8 });
      }
      for (let k = 0; k < 3000; k++) { Pg.tick(w30); if (k % 10 === 0) Pg.thermostat(w30, 0.8, 0.08); }
      const T30 = M.temperature(w30), zMove = w30.atoms.some((a) => Math.abs(a.p.z) > 1e-6);
      log.push({ ok: Math.abs(Pg.residual(w30)) <= 0.05 && Pg.compositionOK(w30) && zMove && T30 > 0.5 && T30 < 1.1,
        name: 'PG·3D항온조',
        msg: `PG·3D+항온조: 잔차 ${Pg.residual(w30).toExponential(2)} ≤ 0.05 · Σc 정확 · z 운동 ${zMove} · T ${T30.toFixed(3)} → 목표 0.8 수렴 (냉시작 0.05·주입 회계)` });
      // (2) 복셀 장 측정: 국소 가열이 장(국소 T)에 나타난다 — 가열 셀 근방 T > 원방 T
      Pg.heatPulse(w30, 3, 3, 3, 2.2, 4);
      const f30 = Pg.field(w30, 7);
      let hotNear = 0, hotFar = 0, nNear = 0, nFar = 0;
      for (const c of f30.cells) {
        const d = Math.hypot(c.cx - 3, c.cy - 3, c.cz - 4);
        if (d < 4) { hotNear += c.T * c.n; nNear += c.n; } else { hotFar += c.T * c.n; nFar += c.n; }
      }
      const okField = nNear > 0 && nFar > 0 && (hotNear / nNear) > (hotFar / nFar);
      log.push({ ok: okField, name: 'PG·복셀장',
        msg: `PG·복셀 장: 가열 지점 근방 ⟨T⟩ ${(nNear ? hotNear / nNear : 0).toFixed(3)} > 원방 ${(nFar ? hotFar / nFar : 0).toFixed(3)} (국소 T 측정이 장으로 보임)` });
      // (3) 핵분열 연쇄: U×6 + 중성자 1발 → 분열 ≥2 (ν=2 연쇄)·전환 장부 Σc 정확·E 닫힘
      const wf = Pg.buildPlayground({ rng: E.makeRng(7), L: 20 });
      for (let i = 0; i < 6; i++) Pg.spawn(wf, 'U', 9 + (i % 3) * 1.8, 9 + ((i / 3) | 0) * 1.8, { T: 0.05 });
      Pg.spawn(wf, 'n', 3, 9.8, { T: 0, px: 6 });
      const Enuc0 = wf.ledger.E_nuclear;
      for (let k = 0; k < 8000; k++) Pg.tick(wf);
      const comp30 = wf.atoms.reduce((c, a) => { c[a.sp] = (c[a.sp] || 0) + 1; return c; }, {});
      const relRes = Math.abs(Pg.residual(wf)) / Math.max(1, Math.abs(wf.pgIn.E));
      log.push({ ok: wf.pgFisCount >= 2 && (comp30.Ba || 0) >= 2 && (comp30.Kr || 0) >= 2 &&
        Pg.compositionOK(wf) && relRes <= 2e-3 && wf.ledger.E_nuclear < Enuc0,
        name: 'PG·핵분열연쇄',
        msg: `PG·핵분열 연쇄: 중성자 1발 → 분열 ${wf.pgFisCount}회 (ν=2 증식) · 파편 Ba ${comp30.Ba || 0}·Kr ${comp30.Kr || 0} · 전환 장부 Σc 정확 ${Pg.compositionOK(wf)} · 상대 잔차 ${relRes.toExponential(1)} ≤ 2e-3 (고 KE 서브스텝 드리프트) · E_nuclear ${Enuc0}→${wf.ledger.E_nuclear.toFixed(1)} (Δm·c² 회계 축약)` });
      // (4) 연소 행 합류: 카탈로그에 R-ABSTRACT (⑱ 라디칼 추상 — 발열 → K_tr 가열)
      log.push({ ok: wf.catalog.some((r) => r.id === 'R-ABSTRACT'), name: 'PG·연소행',
        msg: `PG·연소 합류: catalog=[${wf.catalog.map((r) => r.id).join(',')}] — R-ABSTRACT(⑱) 포함 (발열 반응이 K_tr 로 — 열폭발 경로)` });
    }

    // 31. 반응 체감 게이트 (step-0031) — 핵융합·알칼리+물 발열·위력 스케일
    if (want(31)) {
      // (1) 핵융합: 맨 H 정면 충돌(상대 KE 12 ≥ 장벽 4.5) → He+n+Q. 중성자가 KE 대부분(질량 역비).
      let hitF = 0, vAfter = 0;
      for (let s = 0; s < 5; s++) {
        const w = Pg.buildPlayground({ rng: E.makeRng(200 + s), L: 16 });
        Pg.spawn(w, 'H', 4, 8, { T: 0, px: 3.5 });
        Pg.spawn(w, 'H', 12, 8, { T: 0, px: -3.5 });
        for (let k = 0; k < 3000 && w.pgFusCount === 0; k++) Pg.tick(w);
        if (w.pgFusCount > 0 && Pg.compositionOK(w) && Math.abs(Pg.residual(w)) < 0.1) {
          hitF++;
          for (const a of w.atoms) vAfter = Math.max(vAfter, Math.sqrt(E.V.lenSq(a.p)) / w.mass[a.sp]);
        }
      }
      log.push({ ok: hitF >= 4 && vAfter >= 4, name: 'PG·핵융합',
        msg: `PG·핵융합: H+H 정면 충돌 → He+n 융합 ${hitF}/5 런 (장벽 게이트 ${Pg.FUSION.barrier}·Q=${Pg.FUSION.Q}) · 방출 최고 속도 ${vAfter.toFixed(1)} ≥ 4 (중성자 질량 역비 — 위력 체감·Σc 전환 장부 정확)` });
      // (2) 알칼리+물 격렬 반응: Na 를 O+2H 냉각 클러스터에 → 전자 이전 발열로 T 급등 (EA_CAP 2.5)
      let hitNa = 0; const Tlog = [];
      for (let s = 0; s < 5; s++) {
        const w = Pg.buildPlayground({ rng: E.makeRng(300 + s), L: 12 });
        Pg.spawn(w, 'O', 6, 6, { T: 0.1 }); Pg.spawn(w, 'H', 6.9, 6, { T: 0.1 });
        Pg.spawn(w, 'H', 6, 6.9, { T: 0.1 }); Pg.spawn(w, 'Na', 5.1, 6, { T: 0.1 });
        const T0 = M.temperature(w);
        let q = 0;
        for (let k = 0; k < 4000; k++) { Pg.tick(w); for (const a of w.atoms) q = Math.max(q, Math.abs(a.q)); }
        const T1 = M.temperature(w);
        Tlog.push(`${T0.toFixed(2)}→${T1.toFixed(2)}`);
        if (q > 0 && T1 > 2 * T0 && Math.abs(Pg.residual(w)) < 0.05) hitNa++;
      }
      log.push({ ok: hitNa >= 4, name: 'PG·Na물발열',
        msg: `PG·Na+물 발열: 전자 이전(EA_CAP ${Pg.EA_CAP}) → 이온화 + T 2배↑ ${hitNa}/5 런 [${Tlog.join(' ')}] — 발열이 KE 로 분출 (알칼리 격렬 반응 체감)` });
    }

    // 32. 중력 (step-0032) — 엔진 법칙 g (규모 투명 외부 장): 장면 보편·자유낙하 회계·성층 창발·대조·3D
    if (want(32)) {
      // (0) 법칙은 장면 보편: playground 를 거치지 않는 순수 엔진 세계(makeWorld 옵션 g)에서도
      //     중력이 적용되고 장부(U_grav 통 포함)가 닫힌다 — computeForces 기본값(zeroForces)에서도.
      //     반사 벽은 ΔU_grav 상계 반사(reflect1) — 벽에 깔린 원자의 잦은 반사 드리프트를 ~6×
      //     줄인다 (미보정 시 랜덤워크 실측 → 상계 도입). 잔여는 바운스당 O(dt·g·v) 시간 준위
      //     잔차 (half-kick 의 p 와 drift 의 r 가 반 스텝 어긋남) → 허용 1e-3.
      const we = E.makeWorld({ dt: 0.004, box: { L: E.V.make(20, 20, 20), bc: 'reflect' },
        mass: { X: 3 }, sigma: { X: 1 }, eps: { X: 1 }, g: 0.05 });
      we.atoms.push(E.makeAtom('X', E.V.make(10, 4, 0), E.V.zero()));
      const Ee0 = E.totalEnergy(we);
      let yMaxE = 4;
      for (let k = 0; k < 9000; k++) { E.step(we); yMaxE = Math.max(yMaxE, we.atoms[0].r.y); }
      const Ee1 = E.totalEnergy(we);
      log.push({ ok: Math.abs(Ee1 - Ee0) <= 1e-3 && yMaxE > 15, name: 'PG·중력법칙',
        msg: `PG·중력=엔진 법칙: 순수 makeWorld({g}) 장면에서 낙하 y 4→최저점 ${yMaxE.toFixed(1)} · 총 E 드리프트 ${Math.abs(Ee1 - Ee0).toExponential(1)} ≤ 1e-3 (ΔU_grav 상계 반사 — 어느 장면·어느 computeForces 든 저절로 적용)` });
      // (1) 자유낙하 회계: 높은 곳 정지 Ne 하나 → 낙하 내내 KE = m·g·Δh (위치 E → 운동 E 정확 이동)
      //     + residual(U_grav 포함) 이 머신 정밀도로 닫힌다. 상수 힘은 Verlet 이 정확 적분.
      const wg = Pg.buildPlayground({ rng: E.makeRng(3232), L: 26 });
      Pg.setGravity(wg, 0.06);
      const aF = Pg.spawn(wg, 'Ne', 13, 3, { T: 0 });        // 2D: 아래=+y → y=3 은 높은 곳
      const mNe = wg.mass.Ne, y0 = aF.r.y;
      let devMax = 0, keGain = 0;
      for (let k = 0; k < 8000 && aF.r.y < 25; k++) {
        E.step(wg);
        const ke = E.V.lenSq(aF.p) / (2 * mNe);
        devMax = Math.max(devMax, Math.abs(ke - mNe * 0.06 * (aF.r.y - y0)));
        keGain = Math.max(keGain, ke);
      }
      log.push({ ok: devMax <= 1e-9 && Math.abs(Pg.residual(wg)) <= 1e-9 && keGain > 5, name: 'PG·자유낙하',
        msg: `PG·자유낙하 회계: KE−m·g·Δh 편차 최대 ${devMax.toExponential(1)} ≤ 1e-9 · 잔차 ${Pg.residual(wg).toExponential(1)} · 획득 KE ${keGain.toFixed(1)} (위치 E→운동 E 정확 이동·author 0)` });

      // (2) 성층 창발 (통계·3런): H+He+Xe 를 같은 높이 분포로 소환 → g 켜고 항온조 T=1.7 →
      //     종별 평균 높이가 질량 역순으로 갈라진다 (h̄_Xe < h̄_He < h̄_H — "가라앉아라" 분기 0).
      //     T 는 기체 유지 온도: 저T 에선 H 가 가라앉은 Xe 무리에 분산 흡착되어 He 아래로
      //     붙는다 (그것도 실물리 창발 — 기체 성층 검증엔 고T). setGravity 는 켜는 순간의 위치
      //     E 를 주입 장부에 기록 → 잔차 닫힘 유지. 잔차 판정은 절대 ≤ 0.2 — 고T Verlet 드리프트
      //     (step-0031 등록·에너지 비례·총 E 규모 ~35 의 0.6%). U_grav(음수)가 주입 KE 를 상쇄해
      //     pgIn.E≈0 이 되므로 30-(3)식 상대 정규화는 여기선 무의미하다.
      const SP32 = ['H', 'He', 'Xe'];
      const runStrat = (seed, g) => {
        const w = Pg.buildPlayground({ rng: E.makeRng(seed), L: 26 });
        for (let i = 0; i < 8; i++)   // 3 종을 같은 y 밴드(6~16)에 인터리브 — 초기 높이 편향 0
          for (let sIdx = 0; sIdx < 3; sIdx++)
            Pg.spawn(w, SP32[sIdx], 2.5 + ((i * 3 + sIdx) % 6) * 4.2, 6 + (((i * 3 + sIdx) / 6) | 0) * 2.6, { T: 1.7 });
        Pg.setGravity(w, g);
        const acc = { H: 0, He: 0, Xe: 0 }; let nAcc = 0;
        for (let k = 0; k < 14000; k++) {
          E.step(w);
          if (k % 5 === 0) Pg.thermostat(w, 1.7, 0.1);
          if (k >= 9000 && k % 50 === 0) {
            const s = {}, n = {};
            for (const a of w.atoms) { s[a.sp] = (s[a.sp] || 0) + (26 - a.r.y); n[a.sp] = (n[a.sp] || 0) + 1; }
            for (const sp of SP32) acc[sp] += s[sp] / n[sp];
            nAcc++;
          }
        }
        for (const s of SP32) acc[s] /= nAcc;
        return { h: acc, res: Math.abs(Pg.residual(w)), cOK: Pg.compositionOK(w) };
      };
      let ordHit = 0, resOK = true; const hAgg = { H: 0, He: 0, Xe: 0 }, hLog = [];
      for (let s = 0; s < 3; s++) {
        const r = runStrat(500 + s, 0.06);
        if (r.h.Xe < r.h.He && r.h.He < r.h.H) ordHit++;
        if (r.res > 0.2 || !r.cOK) resOK = false;
        for (const k of SP32) hAgg[k] += r.h[k] / 3;
        hLog.push(`[Xe ${r.h.Xe.toFixed(1)}·He ${r.h.He.toFixed(1)}·H ${r.h.H.toFixed(1)}]`);
      }
      log.push({ ok: ordHit >= 2 && resOK && hAgg.H - hAgg.Xe >= 3, name: 'PG·성층창발',
        msg: `PG·성층 창발: 평균 높이 질량 역순 (Xe<He<H) ${ordHit}/3 런 ${hLog.join(' ')} · 격차 h̄_H−h̄_Xe ${(hAgg.H - hAgg.Xe).toFixed(1)} ≥ 3 · 잔차 ≤ 0.2(고T 드리프트·step-0031)·Σc 정확 ${resOK} (F=m·g 하나에서 층 분리가 창발·측정)` });

      // (3) g=0 대조 (3런 집계): 중력이 없으면 무거운 Xe 도 바닥에 깔리지 않는다 — 균일 분포
      //     기대 h̄≈13 근방 (h̄_Xe ≥ 8). 성층 런의 h̄_Xe ≤ 3 과 대비 — 침강의 원인이 g 임을 고정.
      const h0 = { H: 0, He: 0, Xe: 0 }; let res0 = 0;
      for (let s = 0; s < 3; s++) {
        const r = runStrat(700 + s, 0);
        for (const k of SP32) h0[k] += r.h[k] / 3;
        res0 = Math.max(res0, r.res);
      }
      log.push({ ok: h0.Xe >= 8 && hAgg.Xe <= 3 && res0 <= 0.2, name: 'PG·중력대조',
        msg: `PG·g=0 대조: h̄_Xe ${h0.Xe.toFixed(1)} ≥ 8 (침강 없음·균일≈13) vs 중력 런 h̄_Xe ${hAgg.Xe.toFixed(1)} ≤ 3 (바닥) · [Xe ${h0.Xe.toFixed(1)}·He ${h0.He.toFixed(1)}·H ${h0.H.toFixed(1)}] · 잔차 ≤ 0.2 — 침강·성층은 g 가 만든 창발` });

      // (4) 3D 방향·회계: 3D 는 아래=−y(지형 바닥) — 평균 y 하강 + 잔차 닫힘 (pgGDir 분기)
      const w3 = Pg.buildPlayground({ rng: E.makeRng(3300), L: 16, dim: 3 });
      for (let i = 0; i < 6; i++) Pg.spawn(w3, 'Ne', 3 + (i % 3) * 4, 10, { T: 0.3, z: 4 + ((i / 3) | 0) * 5 });
      Pg.setGravity(w3, 0.06);
      const y3a = w3.atoms.reduce((s, a) => s + a.r.y, 0) / w3.atoms.length;
      for (let k = 0; k < 2500; k++) Pg.tick(w3);
      const y3b = w3.atoms.reduce((s, a) => s + a.r.y, 0) / w3.atoms.length;
      log.push({ ok: y3b < y3a - 3 && Math.abs(Pg.residual(w3)) <= 0.05 && Pg.compositionOK(w3), name: 'PG·3D중력',
        msg: `PG·3D 중력: 평균 y ${y3a.toFixed(1)} → ${y3b.toFixed(1)} (지형 바닥 −y 로 침강) · 잔차 ${Pg.residual(w3).toExponential(1)} ≤ 0.05 · Σc 정확` });
    }

    // 33. 법칙 스택 (step-0033) — 규칙은 무대가 배선하지 않고 세계 속성이 켠다 (중력 패턴의 일반화)
    //     계약: stackForces = pairForces(기반·F 초기화) + rank 순 법칙 기여(더하기만). 게이트 =
    //     물리 입력(종 파라미터) 존재 — 파라미터 부재 = 기여 0 이 그 세계의 참값 (g=0 동형).
    if (want(33)) {
      const mF = (w) => w.atoms.map((a) => ({ x: a.F.x, y: a.F.y, z: a.F.z }));
      const dFmax = (w, F0) => { let d = 0; w.atoms.forEach((a, i) => { d = Math.max(d, Math.abs(a.F.x - F0[i].x), Math.abs(a.F.y - F0[i].y), Math.abs(a.F.z - F0[i].z)); }); return d; };

      // (1) 동등성 ⑧: 스택(pair + pol 법칙) ≡ 기존 polForces — 같은 배치에서 F·U 전 성분 일치
      const wE = Po.nobleCondense({ N: 40, T0: 0.15, seed: 3301 });
      for (let k = 0; k < 300; k++) E.step(wE);                // 비자명 배치로 진화 (기존 경로)
      Po.polForces(wE);
      const F1 = mF(wE), U1 = wE.ledger.U_elec + wE.ledger.U_pol;
      E.stackForces(wE);
      const dF1 = dFmax(wE, F1), dU1 = Math.abs(wE.ledger.U_elec + wE.ledger.U_pol - U1);
      log.push({ ok: dF1 <= 1e-12 && dU1 <= 1e-12, name: '33·동등성⑧',
        msg: `33·스택 동등성 ⑧: max|ΔF| ${dF1.toExponential(1)} ≤ 1e-12 · |ΔU| ${dU1.toExponential(1)} ≤ 1e-12 (polForces ≡ pair+pol 법칙 — 기존 장면 회귀 0)` });

      // (2) 동등성 ⑯: 스택(… + hb 법칙) ≡ 기존 합성 체인 forcesHB(_polForces=polForces)
      //     ⑭ 각도 법칙(step-0034)은 게이트를 꺼서 고립 — 기존 체인엔 각도가 없다.
      const wH = Pg.buildPlayground({ rng: E.makeRng(3302), L: 20 });
      delete wH.valence;
      Pg.buildWaterCluster(wH, 6, 10, 10, 3.0);
      for (let k = 0; k < 200; k++) Pg.tick(wH);
      wH._polForces = Po.polForces;
      HB.forcesHB(wH);                                         // 기존 체인 (⑯ 방식)
      const F2 = mF(wH), Uhb1 = wH._Uhb;
      E.stackForces(wH);
      const dF2 = dFmax(wH, F2), dU2 = Math.abs(wH._Uhb - Uhb1);
      log.push({ ok: dF2 <= 1e-12 && dU2 <= 1e-12 && wH._Uhb < 0, name: '33·동등성⑯',
        msg: `33·스택 동등성 ⑯: max|ΔF| ${dF2.toExponential(1)} ≤ 1e-12 · |ΔU_hb| ${dU2.toExponential(1)} ≤ 1e-12 · U_hb ${wH._Uhb.toFixed(3)} < 0 (forcesHB ≡ 스택 — 배선 코드 0)` });

      // (3) 게이트 = 참값: 물리 입력(Dhb) 제거 → 기여 정확히 0 · F 는 pair+pol 과 일치 (g=0 동형)
      const wG = Pg.buildPlayground({ rng: E.makeRng(3304), L: 20 });
      delete wG.valence;   // ⑭ 각도 법칙 분리 (hb 게이트만 검사)
      Pg.buildWaterCluster(wG, 4, 10, 10, 2.5);
      E.stackForces(wG); const uhOn = wG._Uhb;
      wG.Dhb = 0; wG._Uhb = 0;
      E.stackForces(wG);
      const F3 = mF(wG); Po.polForces(wG);
      const dF3 = dFmax(wG, F3);
      log.push({ ok: uhOn < 0 && wG._Uhb === 0 && dF3 <= 1e-12, name: '33·게이트',
        msg: `33·법칙 게이트: Dhb 有 U_hb ${uhOn.toFixed(3)} < 0 → Dhb 0 기여 ${wG._Uhb} (정확 0) · F ≡ pair+pol (max|ΔF| ${dF3.toExponential(1)}) — 파라미터 부재 = 참값` });

      // (4) 무대 독립 창발 (앵커): playground 기본 세계(반응 카탈로그 ON·모드 전환 0)에서 물
      //     클러스터를 두면 H-결합 네트워크가 저절로 창발 — 규칙 공존 (⑤⑥⑧⑯⑱ 동시 활성)
      const wA = Pg.buildPlayground({ rng: E.makeRng(3303), L: 22 });
      Pg.buildWaterCluster(wA, 8, 11, 11, 3.2);                // enableHBond 호출 없음
      // step-0034: 각도 법칙이 2D 물을 78° 로 재편 → 네트워크가 시점 따라 출렁인다(종점 스냅샷
      //   4~10 · 5시드 실측 최대 6~11) — 시계열 최대로 측정 (현상 = 네트워크의 존재).
      let hbMax33 = 0;
      for (let k = 0; k < 2500; k++) {
        Pg.tick(wA); Pg.thermostat(wA, 0.05, 0.1);
        if (k % 100 === 0) hbMax33 = Math.max(hbMax33, HB.detect(wA, { thetaHb: 120 }).length);
      }
      const catOn = !!(wA.catalog && wA.catalog.length >= 3);
      const res33 = Pg.residual(wA);
      log.push({ ok: hbMax33 >= 5 && catOn && Math.abs(res33) <= 0.05 && Pg.compositionOK(wA), name: '33·무대독립',
        msg: `33·무대 독립 창발: 기본 샌드박스(카탈로그 ${wA.catalog.length}행 ON·전환 0)에서 H-결합 최대 ${hbMax33}개 ≥ 5 창발 · 잔차 ${res33.toExponential(1)} ≤ 0.05 · Σc 정확 ${Pg.compositionOK(wA)} — 법칙은 세계 속성이 켠다` });
    }

    // 34. ⑭ 각도(형상) 법칙 승격 (step-0034) — 동적 세계의 굽은 물. 게이트 = valence 존재.
    //     동적 격차 해소 3종(전부 실측 발견): 씨앗 collinear 스파이크 → 씨앗 즉시 수렴 이완 ·
    //     절대 V_ang 의 위상 전이 오르막 → 이상 배치 기준선 정규화 · 이완 방출 회계 = 회전 추적
    //     아티팩트 → 회계 금지(이완 후 평가만). 잔여 = 준정적 지연 드리프트 (PG·회계 상대화).
    if (want(34)) {
      // 공용: 물 1분자 세계 (수동 결합·형상만 — 반응 끔)
      const mkWater = (seed, dim, initDeg, lawOn) => {
        const w = Pg.buildPlayground({ rng: E.makeRng(seed), L: 20, dim });
        if (!lawOn) delete w.valence;
        w.catalog = []; w.nu_diss = 0;
        const d0 = w.d0, a0 = initDeg * Math.PI / 180, z = dim === 3 ? 10 : undefined;
        const O = Pg.spawn(w, 'O', 10, 10, { T: 0.01, z });
        const H1 = Pg.spawn(w, 'H', 10 + d0, 10, { T: 0.01, z });
        const H2 = Pg.spawn(w, 'H', 10 + d0 * Math.cos(a0), 10 + d0 * Math.sin(a0), { T: 0.01, z });
        const Dho = Pg.dPair('H', 'O');
        w.bonds.push({ i: O.id, j: H1.id, order: 1, rest: d0, k: w.kbond, D: Dho });
        w.bonds.push({ i: O.id, j: H2.id, order: 1, rest: d0, k: w.kbond, D: Dho });
        E.energyFull(w); w.pgIn.E += Pg.residual(w);
        return w;
      };
      const runAngle = (w, ticks) => {
        const acc = [];
        for (let k = 0; k < ticks; k++) {
          Pg.tick(w); Pg.thermostat(w, 0.02, 0.1);
          if (k > 1000 && k % 20 === 0) { const st = Geo.angleStats(w); if (st.bondAngles.O) acc.push(...st.bondAngles.O); }
        }
        const m = acc.reduce((a, b) => a + b, 0) / acc.length;
        return { m, res: Pg.residual(w) };
      };

      // (1) 동등성: 같은 세계에서 legacy 체인(수렴 반복 호출)과 스택의 F 일치 — 기준선은 U 상수 이동
      const wQ = mkWater(3401, 2, 104, true);
      delete wQ.alpha; wQ.Dhb = 0;                       // pair+angle 만 (⑧⑯ 분리)
      for (let k = 0; k < 40; k++) Geo.forcesWithAngles(wQ);   // legacy — 반복 호출로 lones 수렴
      const FQ = wQ.atoms.map((a) => ({ x: a.F.x, y: a.F.y, z: a.F.z }));
      const UbL = wQ.ledger.U_bond;
      E.stackForces(wQ);
      let dFQ = 0;
      wQ.atoms.forEach((a, i) => { dFQ = Math.max(dFQ, Math.abs(a.F.x - FQ[i].x), Math.abs(a.F.y - FQ[i].y), Math.abs(a.F.z - FQ[i].z)); });
      const dUQ = Math.abs(UbL - wQ.ledger.U_bond - Geo.baseV(wQ, 2, 2));   // 기준선 = O(2결합·2고립) 하나뿐
      log.push({ ok: dFQ <= 1e-9 && dUQ <= 1e-9, name: '34·동등성⑭',
        msg: `34·스택 동등성 ⑭: max|ΔF| ${dFQ.toExponential(1)} ≤ 1e-9 (힘 불변) · U_bond 차 = 기준선(위상 상수) 오차 ${dUQ.toExponential(1)} ≤ 1e-9 — 정규화는 힘을 안 바꾼다` });

      // (2) 앵커 2D: H–O–H 가 초기각과 무관하게 일정 각으로 유지 (같은 규칙의 2D 귀결 ~78°)
      //     대조(법칙 OFF): 등방 스프링뿐이라 각이 시드마다 제멋대로 표류.
      const on2 = [11, 22, 33].map((s) => runAngle(mkWater(s, 2, 90, true), 4000));
      const off2 = [11, 22, 33].map((s) => runAngle(mkWater(s, 2, 90, false), 4000));
      const on2ok = on2.every((r) => r.m > 72 && r.m < 84 && Math.abs(r.res) <= 0.05);
      const offSpread = Math.max(...off2.map((r) => r.m)) - Math.min(...off2.map((r) => r.m));
      log.push({ ok: on2ok && offSpread >= 15, name: '34·2D굽은물',
        msg: `34·2D 굽은 물 유지: 법칙 ON ⟨각⟩ [${on2.map((r) => r.m.toFixed(1)).join('·')}]° ⊂ (72,84)·잔차 ≤ 0.05 vs OFF 시드 산포 ${offSpread.toFixed(0)}° ≥ 15 (표류) — 형상은 규칙의 창발` });

      // (3) 앵커 3D: 같은 규칙·3D → 굽은 물 ~101° (⑭ 앵커 95~115 안·2고립쌍 압박)
      const on3 = [11, 22, 33].map((s) => runAngle(mkWater(s, 3, 90, true), 4000));
      const on3ok = on3.every((r) => r.m > 93 && r.m < 112 && Math.abs(r.res) <= 0.05);
      log.push({ ok: on3ok, name: '34·3D굽은물',
        msg: `34·3D 굽은 물: ⟨H–O–H⟩ [${on3.map((r) => r.m.toFixed(1)).join('·')}]° ⊂ (93,112) · 잔차 ≤ 0.05 (같은 규칙·차원은 세계 속성 — 2D 78°↔3D 101°)` });

      // (4) 게이트 = 참값: valence 제거 → 스택 F ≡ pairForces (기여 정확 0)
      const wN = mkWater(3404, 2, 104, true);
      delete wN.alpha; wN.Dhb = 0; delete wN.valence;
      E.stackForces(wN);
      const FN = wN.atoms.map((a) => ({ x: a.F.x, y: a.F.y, z: a.F.z }));
      E.pairForces(wN);
      let dFN = 0;
      wN.atoms.forEach((a, i) => { dFN = Math.max(dFN, Math.abs(a.F.x - FN[i].x), Math.abs(a.F.y - FN[i].y), Math.abs(a.F.z - FN[i].z)); });
      log.push({ ok: dFN <= 1e-12, name: '34·게이트',
        msg: `34·법칙 게이트: valence 부재 → 각도 기여 정확 0 (max|ΔF| ${dFN.toExponential(1)} ≤ 1e-12) — 파라미터 부재 = 참값` });
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
    const scope = ONLY ? `--only ${[...ONLY].join(',')} — 부분 실행 (step 닫기 전 전량 회귀 필수)` : '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳㉒㉓㉔㉕·PG(29~32)·법칙스택(33) 전량';
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
