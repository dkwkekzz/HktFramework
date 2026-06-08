// HktInfra step-0005 — 시각 관찰 셸 (브라우저) + 헤드리스 ASCII 미리보기(Node)
// 관찰하는 것: "클라 예측/조정"을 *눈으로*. 뷰 경로 지연 아래 —
//   ⒜ 확정 레이어가 권위를 매 tick 비트 재현(초록 = 수렴 보장, 뷰 지연·손실 무관),
//   ⒝ 예측(화면)이 정확 모델이면 권위와 일치(초록)·eager 면 갈림(빨강 = 러버밴딩),
//   ⒞ 예측이 은닉하는 뷰 RTT(응답성 이득)가 뷰 지연 따라 자라는 것.
//
// 데이터 층(compute)은 환경 무관(Node/브라우저 공용) — UE-free 불변을 관찰 도구까지 확장.
//   브라우저: 컨트롤(시드·뷰지연·예측모델 노브) → compute → 타임라인/통계 렌더.
//   Node:     `node step-0005/panel.js [seed]` → 같은 데이터를 ANSI 컬러 ASCII 로 출력(데모·CI 점검).
'use strict';
(function () {
  const isNode = (typeof module !== 'undefined' && module.exports);
  const NET = isNode ? require('./net-core.js') : globalThis.HktNet;
  const TICKS = 60;
  const INPUT_DELAY = 8;

  // ── 데이터 층: 한 파라미터 묶음 → 확정/예측(정확)/예측(현 모델) per-tick 일치 시계열 ──
  function compute(p) {
    const common = {
      seed: p.seed, ticks: TICKS, replicate: true, transport: null,
      inputDelay: INPUT_DELAY, schedule: true,
      viewDelay: p.viewDelay, viewJitter: !!p.viewJitter, viewLoss: p.viewLoss, predict: true,
    };
    const acc = NET.run(Object.assign({}, common, { predictDelay: INPUT_DELAY }));   // 정확 모델
    const mod = NET.run(Object.assign({}, common, { predictDelay: p.predictDelay })); // 현재 화면 모델
    // per-tick 일치 셀: 해당 tick 의 뷰가 검증됐고 일치=true / 불일치=false / 미검증=null
    const cell = (arr, t) => (arr[t] === undefined ? null : arr[t]);
    const cells = (arr) => { const o = []; for (let t = 0; t < TICKS; t++) o.push(cell(arr, t)); return o; };
    return {
      acc, mod,
      rows: [
        { label: '확정=권위 (수렴)', cells: cells(acc.proxy.confMatch), color: '#a6e3a1' },
        { label: '예측(정확)=권위', cells: cells(acc.proxy.predMatch), color: '#a6e3a1' },
        { label: `예측(모델 ${p.predictDelay})=권위`, cells: cells(mod.proxy.predMatch), color: p.predictDelay === INPUT_DELAY ? '#a6e3a1' : '#f38ba8' },
      ],
    };
  }

  // ── 브라우저 층 ──────────────────────────────────────────────────────────
  function mountBrowser() {
    const K = globalThis.HktPanelKit;
    const root = document.getElementById('app');
    const params = { seed: 42, viewDelay: 6, predictDelay: 8, viewLoss: 0, viewJitter: false };
    const canvas = K.h('canvas', { width: 980, height: 150, class: 'tl' });
    const statBox = K.h('div', { class: 'stats' });
    const note = K.h('div', { class: 'note' });

    function render() {
      const r = compute(params);
      K.timeline(canvas, { ticks: TICKS, rows: r.rows });
      const accurate = params.predictDelay === INPUT_DELAY;
      K.stats(statBox, [
        ['시드', params.seed],
        ['뷰 경로 지연', `${params.viewDelay} tick${params.viewJitter ? ' (지터·재정렬)' : ''}${params.viewLoss ? ' · 손실 ' + (params.viewLoss * 100).toFixed(0) + '%' : ''}`],
        ['INPUT_DELAY (권위)', INPUT_DELAY],
        ['화면 예측 모델', `predictDelay ${params.predictDelay} ${accurate ? '(정확)' : '(eager·러버밴딩)'}`],
        ['확정 desync (수렴)', r.acc.confDesync + ' tick', r.acc.confDesync ? 'bad' : 'good'],
        ['예측 오예측 (현 모델)', r.mod.mispredict + ' / ' + r.mod.viewsValidated, r.mod.mispredict ? 'bad' : 'good'],
        ['은닉 뷰 RTT (응답성)', r.acc.avgHidden.toFixed(1) + ' tick', 'good'],
        ['롤백 깊이 (최대)', r.acc.specWindowMax + ' tick'],
        ['세계 사슬 (불변)', K.fmtHex(r.acc.chain) + (r.acc.chain === r.mod.chain ? ' ✓' : ' ✗'), 'good'],
      ]);
      note.textContent = accurate
        ? '윗 두 줄 초록 = 확정·정확 예측이 권위를 매 tick 비트 재현(수렴). 뷰 지연·손실을 올려도 확정은 초록(자기 결정론 복제). predictDelay 를 낮춰 eager(러버밴딩)를 만들면 셋째 줄이 빨강 — 단 확정(첫 줄)은 여전히 초록(안전망).'
        : '셋째 줄 빨강 = eager 화면 모델이 입력지연을 무시해 오예측(러버밴딩). 그러나 첫 줄(확정)은 초록 — 사후 조정이 모델 정확도와 무관하게 권위로 수렴. 세계 사슬도 불변(예측은 클라 측).';
    }

    const ctrls = K.h('div', { class: 'ctrls' },
      K.slider({ label: '시드 idx', min: 0, max: 4, value: 0, on: v => { params.seed = [42, 7, 1234, 99, 2026][v]; render(); } }).node,
      K.slider({ label: '뷰 지연', min: 0, max: 14, value: 6, on: v => { params.viewDelay = v; render(); } }).node,
      K.slider({ label: '화면 모델(predictDelay)', min: 0, max: 8, value: 8, on: v => { params.predictDelay = v; render(); } }).node,
      K.slider({ label: '뷰 손실 %', min: 0, max: 50, value: 0, on: v => { params.viewLoss = v / 100; render(); } }).node,
      K.toggle({ label: '뷰 지터(재정렬)', value: false, on: v => { params.viewJitter = v; render(); } }).node,
    );
    root.append(ctrls, canvas, statBox, note);
    render();
  }

  // ── Node ASCII 층 (데모·CI 점검) ─────────────────────────────────────────
  function printAscii(seed) {
    const G = s => '\x1b[42m' + s + '\x1b[0m', R = s => '\x1b[41m' + s + '\x1b[0m', X = s => '\x1b[100m' + s + '\x1b[0m';
    const accP = { seed, viewDelay: 6, predictDelay: 8, viewLoss: 0, viewJitter: false };
    const eagerP = Object.assign({}, accP, { predictDelay: 0 });
    const ra = compute(accP), re = compute(eagerP);
    console.log(`\nstep-0005 관찰 — seed ${seed} · 뷰 경로 지연 ${accP.viewDelay} · INPUT_DELAY ${INPUT_DELAY}`);
    console.log('  (초록=권위와 일치, 빨강=갈림, 회색=미검증 tick) tick 0→59\n');
    console.log('  [정확 모델 predictDelay=8]');
    for (const row of ra.rows) {
      const bar = row.cells.map(c => c == null ? X(' ') : c ? G(' ') : R(' ')).join('');
      console.log('  ' + row.label.padEnd(20) + ' ' + bar);
    }
    console.log('\n  [eager 모델 predictDelay=0 — 합성 오예측]');
    const erow = re.rows[2];
    console.log('  ' + erow.label.padEnd(20) + ' ' + erow.cells.map(c => c == null ? X(' ') : c ? G(' ') : R(' ')).join(''));
    console.log(`\n  확정 desync ${ra.acc.confDesync}(수렴 보장) · 정확 예측 오예측 ${ra.acc.mispredict} · eager 오예측 ${re.mod.mispredict}/${re.mod.viewsValidated}`);
    console.log(`  은닉 뷰 RTT ${ra.acc.avgHidden.toFixed(1)} tick(응답성) · 롤백 깊이 ${ra.acc.specWindowMax} · 세계 사슬 불변 ${ra.acc.chain === re.mod.chain ? 'OK' : 'FAIL'}`);
    console.log('  → 확정(첫 줄)은 모델 무관 항상 초록(권위 수렴). eager 화면만 빨강(러버밴딩). 예측이 뷰 RTT 를 은닉.\n');
  }

  if (isNode) {
    module.exports = { compute };
    if (require.main === module) printAscii(parseInt(process.argv[2] || '42', 10));
  } else if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountBrowser);
    else mountBrowser();
  }
})();
