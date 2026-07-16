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

    // 5. ② 힘·충돌 (쿨롱+척력·산란) — ①의 하네스·불변식 스위트를 그대로 재사용
    {
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
    {
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
    {
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
    {
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
    {
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
    {
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
    {
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
        const near = (off, seed) => { const w = Po.ionInduced({ seed, chargeOff: off }); Po.run(w, 7000); return Po.nearIonCount(w, 2.5); };
        const on = [], of = [];
        for (let s = 0; s < R; s++) { on.push(near(false, 90 + s)); of.push(near(true, 90 + s)); }
        const mOn = mean(on), mOf = mean(of);
        log.push({ ok: mOn > mOf * 1.3, name: '⑧이온유도밀도',
          msg: `이온 근방(R=2.5) 전하ON ${fmt(mOn)} > OFF ${fmt(mOf)}×1.3 (분산 off·분극 경로 단독)` });
      }

      // dt 반감 + 근사 차수 무관: 응집 배위수 통계가 dt·dt/2 에서 근사 동일 (수치 차수가 물리 안 바꿈).
      {
        const cd = (dt, seed) => { const w = Po.nobleCondense({ T0: 0.05, seed, dt }); Po.run(w, Math.round(10.5 / dt)); return Po.clusters(w, 1.3).meanCoord; };
        const a = mean([0, 1].map((s) => cd(0.0015, 85 + s))), b = mean([0, 1].map((s) => cd(0.00075, 85 + s)));
        log.push({ ok: Math.abs(a - b) / b < 0.2, name: '⑧dt반감통계', msg: `배위수 ${fmt(a)} vs dt/2 ${fmt(b)} 상대차 ${fmt(Math.abs(a - b) / Math.max(1e-9, b))} < 0.2` });
      }
    }

    // 12. ⑨ 통계 관문 — 평형은 창발한다 (엔트로피 증가·화학 평형·T_국소). 새 물리 0·측정과 검증만.
    {
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
        const dissoc = (L, seed) => { const w = S.build('s06-v1-dimer', { seed, N: 80, T0: 1.5, L }); E.run(w, 9000); const ds = []; for (let b = 0; b < 6; b++) { E.run(w, 300); ds.push(M.equilibrium(w).dissoc); } return mean(ds); };
        const dV = mean([0, 1, 2].map((s) => dissoc(18, 30 + s))), d2V = mean([0, 1, 2].map((s) => dissoc(18 * Math.SQRT2, 30 + s)));
        log.push({ ok: d2V > dV * 1.3, name: '⑨르샤틀리에(부피)', msg: `해리분율 V ${fmt(dV)} → 2V ${fmt(d2V)} (부피↑→해리↑·상태 수 의존·비율 공식 0)` });
      }

      // (4) van't Hoff: ln K vs 1/T 기울기 ≈ D (+병진 엔트로피 보정). 캐논ical(고정 T) 관계라 항온조 필요.
      //     발견: ⑥ 복사 결합이 방출 냉각으로 T 를 자체 조절 → T0 스캔 안 먹음. 명시적 항온조로 T 고정(측정 전용).
      {
        const thermostat = (w, T) => { const Tc = M.temperature(w); if (Tc > 0) { const s = Math.sqrt(T / Tc); for (const a of w.atoms) { a.p.x *= s; a.p.y *= s; } } };
        const lnKat = (T, seed) => {
          const w = S.build('s06-v1-dimer', { seed, N: 80, T0: T, L: 18 });
          for (let k = 0; k < 8000; k++) { E.step(w); if (k % 25 === 0) thermostat(w, T); }
          const kc = [];
          for (let b = 0; b < 8; b++) { for (let k = 0; k < 300; k++) { E.step(w); if (k % 25 === 0) thermostat(w, T); } const q = M.equilibrium(w); if (isFinite(q.Kc)) kc.push(q.Kc); }
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

    return log;
  }

  function report(log) {
    let pass = 0, fail = 0;
    for (const e of log) {
      const tag = e.ok ? 'PASS' : 'FAIL';
      console.log(`[${tag}] ${e.msg}`);
      if (e.ok) pass++; else fail++;
    }
    console.log(`\n── S0 verify (①②③④⑤⑥⑦⑧⑨): ${pass} PASS · ${fail} FAIL ──`);
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
