// verify.js — S1 자체 검증 (KERNEL §7 4기둥). 문서 수치는 이 출력 그대로.
//   ① 무대: 입력 로드·장부 닫힘·분자 자유 비행(탄도적)·온도의 탄생·경계 회계.
//   node verify.js  → 전량. --only 1 등 필터는 단일 세부 단계라 생략 (추가 시 확장).

(function () {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const E = isNode ? require('./engine.js') : window.HktS1Engine;
  const S = isNode ? require('./scenes.js') : window.HktS1Scenes;
  const M = isNode ? require('./measure.js') : window.HktS1Measure;
  const INPUT = isNode ? require('./input.json') : window.HktS1Input;

  const log = [];
  const push = (ok, msg) => log.push({ ok, msg });
  const fmt = (x) => (typeof x === 'number' && isFinite(x)) ? x.toPrecision(6) : String(x);
  const pDiff = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.z - b.z));
  const compEq = (a, b) => { const ks = new Set([...Object.keys(a), ...Object.keys(b)]); for (const k of ks) if ((a[k] || 0) !== (b[k] || 0)) return false; return true; };

  function suite() {
    // 1. 입출력 계약: 입력 스키마 검증 + 분자 수 = Σcount + Σc(측정) == input.macro.atomCount.
    {
      const vi = S.validateInput(INPUT);
      const w = S.stage(INPUT, { seed: 11 });
      const nExpect = INPUT.species.reduce((s, x) => s + (x.count || 1), 0);
      const cMeas = M.composition(w), cIn = INPUT.macro.atomCount;
      push(vi.ok, `계약·입력 스키마 유효 ${vi.ok} ${vi.errs.length ? '(' + vi.errs.join('·') + ')' : ''}`);
      push(w.mols.length === nExpect, `계약·분자 수 로드 ${w.mols.length} = Σcount ${nExpect} (species 전개)`);
      push(compEq(cMeas, cIn), `계약·Σc = input.macro.atomCount: ${JSON.stringify(cMeas)} == ${JSON.stringify(cIn)} (하위 출력 소비)`);
    }

    // 2. 닫힌 장부: 자유 비행 3000 tick — 총 E·P 정확 보존 · P 총합 0 (COM 제거).
    {
      const w = S.stage(INPUT, { seed: 22, T0: 0.3 });
      const E0 = M.ledgerTable(w).total, P0 = M.momentum(w);
      let mE = 0, mP = 0;
      for (let k = 0; k < 3000; k++) { E.step(w); if (k % 20 === 0) { mE = Math.max(mE, Math.abs(M.ledgerTable(w).total - E0)); mP = Math.max(mP, pDiff(M.momentum(w), P0)); } }
      push(mE < 1e-9, `장부·E 보존 max|ΔE| ${fmt(mE)} ≤ 1e-9 (힘 0 · 통 사이 이동만)`);
      push(mP < 1e-9, `장부·P 보존 max|ΔP| ${fmt(mP)} ≤ 1e-9`);
      push(E.V.len(P0) < 1e-9, `장부·P총합 0 (COM 제거) ${fmt(E.V.len(P0))} ≤ 1e-9`);
    }

    // 3. Σc 시간 불변: 반응 없으므로 조성 다발이 정확 불변.
    {
      const w = S.stage(INPUT, { seed: 33 });
      const c0 = M.composition(w); E.run(w, 2000); const c1 = M.composition(w);
      push(compEq(c0, c1), `Σc 시간 불변: ${JSON.stringify(c0)} → ${JSON.stringify(c1)} (교환은 이동만·반응 0)`);
    }

    // 4. 무대 현상 — 자유 비행 탄도적: F=0 이라 MSD ∝ t² → MSD(2t)/MSD(t) ≈ 4. + T 정합.
    {
      const w = S.stage(INPUT, { seed: 44, T0: 0.5 });
      E.run(w, 500); const msdT = M.msd(w);
      E.run(w, 500); const msd2T = M.msd(w);   // 총 1000 tick (2t)
      const ratio = msd2T / Math.max(1e-12, msdT);
      push(ratio > 3.5 && ratio < 4.5, `무대·자유 비행 탄도적 MSD(2t)/MSD(t) ${fmt(ratio)} ≈ 4 (F=0 등속 · 분자 존재·이동)`);
      const Tm = M.temperature(w);
      push(Math.abs(Tm - 0.5) < 0.12, `무대·T 정합 측정 ${fmt(Tm)} ≈ 씨앗 0.5 (⟨p²/2m⟩ 자유도 정규화)`);
    }

    // 5. 온도의 탄생 (u 접힘): U_int = Σ E_bind (음수·결합 접힘) · 총 E = K_tr + U_int 정합.
    {
      const w = S.stage(INPUT, { seed: 55 });
      const t = M.ledgerTable(w);
      let sumEb = 0; for (const m of w.mols) sumEb += m.Ebind;
      push(Math.abs(t.U_int - sumEb) < 1e-9 && sumEb < 0, `u·온도의 탄생 U_int ${fmt(t.U_int)} = Σ E_bind (음수·S0 결합 접힘)`);
      push(Math.abs(t.total - (t.K_tr + t.U_int)) < 1e-9, `u·장부 합 total ${fmt(t.total)} = K_tr ${fmt(t.K_tr)} + U_int (①은 U_inter 0)`);
    }

    // 6. 경계 회계: open 경계에서 분자가 탈출해도 Σc(활성+탈출)·P(+P_escape) 정확 보존.
    {
      const w = S.stage(INPUT, { seed: 66, T0: 0.8, bc: 'open', L: 6 });   // 작은 열린 상자 → 탈출 유도
      const c0 = M.composition(w), P0 = M.momentum(w), n0 = w.mols.length;
      E.run(w, 4000);
      const c1 = M.composition(w), P1 = M.momentum(w);
      const escaped = w.escaped.length;
      push(compEq(c0, c1), `경계·Σc(활성+탈출) 보존 (${escaped} 탈출): ${JSON.stringify(c1)}`);
      push(pDiff(P0, P1) < 1e-9, `경계·P(+P_escape) 보존 max|ΔP| ${fmt(pDiff(P0, P1))} ≤ 1e-9 · 탈출 ${escaped}/${n0}`);
    }

    return log;
  }

  function report(l) {
    let pass = 0, fail = 0;
    for (const e of l) { console.log(`[${e.ok ? 'PASS' : 'FAIL'}] ${e.msg}`); if (e.ok) pass++; else fail++; }
    console.log(`\n── S1 verify (① 무대): ${pass} PASS · ${fail} FAIL ──`);
    return fail === 0;
  }

  const api = { suite, report };
  if (isNode) { module.exports = api; if (require.main === module) process.exit(report(suite()) ? 0 : 1); }
  else window.HktS1Verify = api;
})();
