// HktInfra step-0004 — 시각 관찰 셸 (브라우저) + 헤드리스 ASCII 미리보기(Node)
// 관찰하는 것: "타이밍↔내용 분리"를 *눈으로*. 같은 입력열·전송 아래 스케줄 vs naive 의
//   매 tick 권위=추종자(복제 일치)·권위=내용기준(전송 무관)을 초록/빨강 타임라인으로.
//
// 데이터 층(compute)은 환경 무관(Node/브라우저 공용) — UE-free 불변을 관찰 도구까지 확장.
//   브라우저: 컨트롤(시드·전송 노브) → compute → 타임라인/통계 렌더.
//   Node:     `node step-0004/panel.js [seed]` → 같은 데이터를 ANSI 컬러 ASCII 로 출력(데모·CI 점검).
'use strict';
(function () {
  const isNode = (typeof module !== 'undefined' && module.exports);
  const NET = isNode ? require('./net-core.js') : globalThis.HktNet;
  const TICKS = 60;

  // ── 데이터 층: 한 파라미터 묶음 → 스케줄/naive 시계열 + 내용기준(전송 OFF) 비교 ──
  // 핵심: 전송 OFF 스케줄 사슬 = 그 (seed, inputDelay)의 *내용 기준*(전송 타이밍 무관). 스케줄 ON 이 이를 따라가고
  //       naive ON 은 갈리는가를 매 tick 비교 → 분리를 가시화.
  function compute(p) {
    const transport = p.transportOn
      ? { delayMin: 0, delayMax: p.delayMax, loss: p.loss, redundancy: p.redundancy, seed: p.timingSeed }
      : null;
    const common = { seed: p.seed, ticks: TICKS, replicate: true, inputDelay: p.inputDelay };
    const ref = NET.run(Object.assign({}, common, { transport: null, schedule: true })); // 내용 기준
    const s = NET.run(Object.assign({}, common, { transport, schedule: true }));          // 스케줄(분리)
    const n = NET.run(Object.assign({}, common, { transport, schedule: false }));         // naive(누설)
    const cells = (a, b) => { const o = []; for (let i = 0; i < TICKS; i++) o.push((a[i] !== undefined && b[i] !== undefined) ? a[i] === b[i] : null); return o; };
    return {
      ref, s, n, transport,
      rows: [
        { label: 'SCHED 권위=추종자', cells: cells(s.zone.hashes, s.follower.hashes), color: '#a6e3a1' },
        { label: 'SCHED 권위=내용기준', cells: cells(s.zone.hashes, ref.zone.hashes), color: '#a6e3a1' },
        { label: 'NAIVE 권위=추종자', cells: cells(n.zone.hashes, n.follower.hashes), color: '#f38ba8' },
        { label: 'NAIVE 권위=내용기준', cells: cells(n.zone.hashes, ref.zone.hashes), color: '#f38ba8' },
      ],
    };
  }
  function desync(r) { let d = 0; const a = r.zone.hashes, f = r.follower.hashes; for (let i = 0; i < Math.min(a.length, f.length); i++) if (a[i] !== f[i]) d++; return d; }

  // ── 브라우저 층 ──────────────────────────────────────────────────────────
  function mountBrowser() {
    const K = globalThis.HktPanelKit;
    const root = document.getElementById('app');
    const params = { seed: 42, transportOn: true, delayMax: 4, loss: 0.1, redundancy: 4, inputDelay: 8, timingSeed: 1 };
    const canvas = K.h('canvas', { width: 980, height: 160, class: 'tl' });
    const statBox = K.h('div', { class: 'stats' });
    const note = K.h('div', { class: 'note' });

    function render() {
      const r = compute(params);
      K.timeline(canvas, { ticks: TICKS, rows: r.rows });
      const sMatch = r.s.chain === r.ref.chain, nMatch = r.n.chain === r.ref.chain;
      K.stats(statBox, [
        ['시드', params.seed],
        ['전송', params.transportOn ? `지연0..${params.delayMax} · 손실 ${(params.loss * 100).toFixed(0)}% · 중복 ${params.redundancy}` : 'OFF(행복)'],
        ['INPUT_DELAY (예산)', `${params.inputDelay} (${params.inputDelay - 1} tick)`],
        ['SCHED desync', desync(r.s) + ' tick', desync(r.s) ? 'bad' : 'good'],
        ['SCHED =내용기준', sMatch ? 'OK (전송 무관)' : '갈림', sMatch ? 'good' : 'bad'],
        ['SCHED late-miss', r.s.lateMissed, r.s.lateMissed ? 'bad' : 'good'],
        ['NAIVE desync', desync(r.n) + ' tick', desync(r.n) ? 'bad' : 'good'],
        ['NAIVE =내용기준', nMatch ? 'OK' : '갈림 (타이밍 누설)', nMatch ? 'good' : 'bad'],
        ['와이어 사본 / 손실', `${r.s.stats.copies} / ${r.s.stats.lost}`],
      ]);
      note.textContent = params.transportOn
        ? '윗 두 줄(SCHED) 초록·아랫 두 줄(NAIVE) 빨강 = 논리-tick 스케줄링이 타이밍을 내용에서 분리. 손실↑/지연 예산↑ 넘기면 SCHED 도 빨강(절벽).'
        : '전송 OFF = 모두 초록(회귀 0). 전송을 켜고 지연·손실을 올려보세요.';
    }

    const ctrls = K.h('div', { class: 'ctrls' },
      K.slider({ label: '시드 idx', min: 0, max: 4, value: 0, on: v => { params.seed = [42, 7, 1234, 99, 2026][v]; render(); } }).node,
      K.toggle({ label: '전송 ON', value: true, on: v => { params.transportOn = v; render(); } }).node,
      K.slider({ label: 'delayMax', min: 0, max: 12, value: 4, on: v => { params.delayMax = v; render(); } }).node,
      K.slider({ label: '손실 %', min: 0, max: 50, value: 10, on: v => { params.loss = v / 100; render(); } }).node,
      K.slider({ label: '중복(redundancy)', min: 1, max: 6, value: 4, on: v => { params.redundancy = v; render(); } }).node,
      K.slider({ label: 'INPUT_DELAY', min: 1, max: 14, value: 8, on: v => { params.inputDelay = v; render(); } }).node,
      K.slider({ label: '타이밍 시드', min: 1, max: 8, value: 1, on: v => { params.timingSeed = v; render(); } }).node,
    );
    root.append(ctrls, canvas, statBox, note);
    render();
  }

  // ── Node ASCII 층 (데모·CI 점검) ─────────────────────────────────────────
  function printAscii(seed) {
    const G = s => '\x1b[42m' + s + '\x1b[0m', R = s => '\x1b[41m' + s + '\x1b[0m', X = s => '\x1b[100m' + s + '\x1b[0m';
    const p = { seed, transportOn: true, delayMax: 4, loss: 0.1, redundancy: 4, inputDelay: 8, timingSeed: 1 };
    const r = compute(p);
    console.log(`\nstep-0004 관찰 — seed ${seed} · 전송 지연0..${p.delayMax}·손실 ${p.loss * 100}%·중복 ${p.redundancy} · INPUT_DELAY ${p.inputDelay}`);
    console.log('  (초록=권위·추종자/내용 일치, 빨강=갈림) tick 0→59\n');
    for (const row of r.rows) {
      const bar = row.cells.map(c => c == null ? X(' ') : c ? G(' ') : R(' ')).join('');
      console.log('  ' + row.label.padEnd(20) + ' ' + bar);
    }
    console.log(`\n  SCHED desync ${desync(r.s)} tick · =내용기준 ${r.s.chain === r.ref.chain ? 'OK(전송 무관)' : '갈림'} · late-miss ${r.s.lateMissed}`);
    console.log(`  NAIVE desync ${desync(r.n)} tick · =내용기준 ${r.n.chain === r.ref.chain ? 'OK' : '갈림(타이밍 누설)'}`);
    console.log('  → SCHED 초록 · NAIVE 빨강 = 논리-tick 스케줄링이 타이밍을 내용에서 분리.\n');
  }

  if (isNode) {
    module.exports = { compute, desync };
    if (require.main === module) printAscii(parseInt(process.argv[2] || '42', 10));
  } else if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountBrowser);
    else mountBrowser();
  }
})();
