// HktInfra step-0007 — 시각 관찰 셸 (브라우저 2D 격자) + 헤드리스 ASCII 미리보기(Node)
// 관찰하는 것: *증분 AOI*를 *눈으로*. 0006 의 분할·경계 위에서 — 뷰가 전체 스냅샷이 아니라
//   enter/exit/update *증분*으로 온다. 화면 우측에 tick 별 증분 레코드 막대(정지하면 0 으로 떨어짐)와
//   증분≡전체 일치 여부를 보인다. 데이터 층(compute)은 환경 무관(공용 — UE-free 불변을 관찰 도구까지).
'use strict';
(function () {
  const isNode = (typeof module !== 'undefined' && module.exports);
  const NET = isNode ? require('./net-core.js') : globalThis.HktNet;

  // ── 데이터 층: 파라미터 → 엔터티(소유 존) + 선택 클라 가시/AOI + 증분 시계열 + 절감 지표 ──
  function compute(p) {
    const inc = NET.run({ seed: p.seed, ticks: p.ticks || 48, clients: p.clients, moves: 30, radius: p.radius, grid: p.grid, zones: 2, incremental: true });
    const full = NET.run({ seed: p.seed, ticks: p.ticks || 48, clients: p.clients, moves: 30, radius: p.radius, grid: p.grid, zones: 2, incremental: false });
    const ents = [];
    inc.zones.forEach((z, zi) => { for (const [id, e] of z.ents) ents.push({ id, x: e.x, y: e.y, zone: zi }); });
    const sel = inc.clients[p.selected % inc.clients.length];
    const seen = sel ? new Set(sel.seenIds()) : new Set();
    const selOwner = sel ? NET.ownerOf(inc, sel.avatar) : null;
    let crossSeen = 0;
    if (sel) for (const id of seen) if (id !== sel.avatar && NET.ownerOf(inc, id) && NET.ownerOf(inc, id) !== selOwner) crossSeen++;
    // 증분 ≡ 전체 일치 검사(매 tick 전 클라)
    let mism = 0;
    for (let t = 0; t < inc.seenTrace.length; t++) for (let c = 0; c < inc.seenTrace[t].length; c++) if (inc.seenTrace[t][c] !== full.seenTrace[t][c]) mism++;
    const save = (1 - inc.totals.deltaRecords / full.totals.sent) * 100;
    return {
      grid: p.grid, radius: p.radius, H: inc.H, ents, sel: sel ? sel.avatar : null, seen,
      selPos: sel ? (function () { for (const z of inc.zones) if (z.ents.has(sel.avatar)) return z.ents.get(sel.avatar); return null; })() : null,
      selOwner, crossSeen,
      handoffs: inc.totals.handoffs,
      deltaTrace: inc.deltaTrace, deltaRecords: inc.totals.deltaRecords, baseline: full.totals.sent,
      enter: inc.totals.deltaEnter, exit: inc.totals.deltaExit, update: inc.totals.deltaUpdate,
      resets: inc.totals.resets, save, match: mism === 0,
    };
  }

  const ZONE_FILL = ['rgba(137,180,250,0.07)', 'rgba(245,194,231,0.07)'];
  const ZONE_DOT = ['#89b4fa', '#f5c2e7'];

  // ── 브라우저 층 — 2D 격자 + 증분 시계열 막대 ──
  function mountBrowser() {
    const K = globalThis.HktPanelKit;
    const root = document.getElementById('app');
    const params = { seed: 42, clients: 6, radius: 4, grid: 16, selected: 0, ticks: 48 };
    const canvas = K.h('canvas', { width: 480, height: 480, class: 'grid' });
    const bars = K.h('canvas', { width: 480, height: 120, class: 'grid' });
    const statBox = K.h('div', { class: 'stats' });
    const note = K.h('div', { class: 'note' });

    function draw(r) {
      const ctx = canvas.getContext('2d');
      const G = r.grid, cell = canvas.width / G;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = ZONE_FILL[0]; ctx.fillRect(0, 0, r.H * cell, canvas.height);
      ctx.fillStyle = ZONE_FILL[1]; ctx.fillRect(r.H * cell, 0, canvas.width - r.H * cell, canvas.height);
      ctx.strokeStyle = '#313244'; ctx.lineWidth = 1;
      for (let i = 0; i <= G; i++) {
        ctx.beginPath(); ctx.moveTo(i * cell, 0); ctx.lineTo(i * cell, canvas.height); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i * cell); ctx.lineTo(canvas.width, i * cell); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(249,226,175,0.06)';
      ctx.fillRect((r.H - r.radius) * cell, 0, 2 * r.radius * cell, canvas.height);
      ctx.strokeStyle = '#f9e2af'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(r.H * cell, 0); ctx.lineTo(r.H * cell, canvas.height); ctx.stroke();
      if (r.selPos) {
        const x0 = (r.selPos.x - r.radius), y0 = (r.selPos.y - r.radius), w = (2 * r.radius + 1);
        ctx.strokeStyle = '#a6e3a1'; ctx.lineWidth = 2; ctx.setLineDash([4, 3]);
        ctx.strokeRect(x0 * cell, y0 * cell, w * cell, w * cell); ctx.setLineDash([]);
      }
      for (const e of r.ents) {
        const cx = (e.x + 0.5) * cell, cy = (e.y + 0.5) * cell;
        const isSel = e.id === r.sel, vis = r.seen.has(e.id);
        ctx.beginPath(); ctx.arc(cx, cy, cell * 0.32, 0, Math.PI * 2);
        ctx.fillStyle = isSel ? '#f9e2af' : (vis ? ZONE_DOT[e.zone] : (e.zone === 0 ? '#3a4a6a' : '#5a3a52'));
        ctx.fill();
        if (vis && !isSel) { ctx.strokeStyle = '#a6e3a1'; ctx.lineWidth = 1.5; ctx.stroke(); }
        ctx.fillStyle = '#11111b'; ctx.font = (cell * 0.34) + 'px ui-monospace, monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(e.id.replace('av', ''), cx, cy);
      }
    }
    // 증분 시계열 — tick 별 증분 레코드 막대(이동 중엔 솟고, 정지하면 0 으로 떨어진다)
    function drawBars(r) {
      const ctx = bars.getContext('2d');
      ctx.clearRect(0, 0, bars.width, bars.height);
      const n = r.deltaTrace.length, bw = bars.width / n, max = Math.max(1, ...r.deltaTrace);
      for (let t = 0; t < n; t++) {
        const v = r.deltaTrace[t], hpx = (v / max) * (bars.height - 18);
        ctx.fillStyle = v === 0 ? '#45475a' : '#89b4fa';
        ctx.fillRect(t * bw, bars.height - 14 - hpx, Math.max(1, bw - 1), hpx);
      }
      ctx.fillStyle = '#7f849c'; ctx.font = '11px ui-monospace, monospace'; ctx.textAlign = 'left';
      ctx.fillText('tick별 증분 레코드 (정지 → 0 으로 수렴)', 4, bars.height - 2);
    }
    function render() {
      const r = compute(params);
      draw(r); drawBars(r);
      K.stats(statBox, [
        ['시드', params.seed],
        ['클라(엔터티) 수', params.clients],
        ['AOI 반경 R / 경계 띠', params.radius],
        ['분할 경계 x', r.H + ' (zone1 [0,' + r.H + ') · zone2 [' + r.H + ',' + params.grid + '))'],
        ['선택 클라 / 소유 존', (r.sel || '-') + ' / ' + (r.selOwner || '-')],
        ['선택 클라 가시', r.seen.size + ' / ' + params.clients + (r.crossSeen ? '  (경계 너머 ' + r.crossSeen + ')' : '')],
        ['증분 ≡ 전체 스냅샷', r.match ? '일치(매 tick 전 클라)' : '불일치!', r.match ? 'good' : 'bad'],
        ['증분 enter/exit/update', r.enter + ' / ' + r.exit + ' / ' + r.update],
        ['세션 이주 reset(키프레임)', r.resets + ' 회'],
        ['핸드오프(권위 이주)', r.handoffs + ' 회'],
        ['대역폭 절감 (증분/전체)', r.deltaRecords + ' / ' + r.baseline + ' = ' + r.save.toFixed(1) + '%', 'good'],
      ]);
      note.textContent = '뷰가 전체 스냅샷이 아니라 enter/exit/update *증분*으로 온다 — 클라가 누적 적용해 가시 집합을 재구성한다(증분 ≡ 전체 스냅샷, 매 tick 전 클라 일치). '
        + '아래 막대 = tick 별 증분 레코드: 이동 중엔 솟고 *정지하면 0* 으로 떨어진다(대역폭이 밀도가 아니라 변화량에 비례). 세션이 존을 넘으면(핸드오프) 새 존이 reset(키프레임)으로 재동기 → stale 0.';
    }

    const ctrls = K.h('div', { class: 'ctrls' },
      K.slider({ label: '시드 idx', min: 0, max: 4, value: 0, on: v => { params.seed = [42, 7, 1234, 99, 2026][v]; render(); } }).node,
      K.slider({ label: '클라 수', min: 2, max: 10, value: 6, on: v => { params.clients = v; params.selected = 0; render(); } }).node,
      K.slider({ label: 'AOI 반경 R', min: 1, max: 8, value: 4, on: v => { params.radius = v; render(); } }).node,
      K.slider({ label: '선택 클라', min: 0, max: 9, value: 0, on: v => { params.selected = v; render(); } }).node,
    );
    root.append(ctrls, canvas, bars, statBox, note);
    render();
  }

  // ── Node ASCII 층 (데모·CI 점검) ─────────────────────────────────────────
  function printAscii(seed) {
    const p = { seed, clients: 6, radius: 4, grid: 16, selected: 0, ticks: 48 };
    const r = compute(p);
    const Y = s => '\x1b[43m\x1b[30m' + s + '\x1b[0m';
    const B = s => '\x1b[44m\x1b[37m' + s + '\x1b[0m';
    const M = s => '\x1b[45m\x1b[37m' + s + '\x1b[0m';
    const D = s => '\x1b[100m' + s + '\x1b[0m';
    const at = {}; for (const e of r.ents) at[e.x + ',' + e.y] = e;
    console.log(`\nstep-0007 관찰(증분 AOI) — seed ${seed} · 클라 ${p.clients} · AOI 반경 ${p.radius} · 선택 ${r.sel}(${r.selOwner}) · 경계 x=${r.H}`);
    console.log('  (노랑=선택본인, 파랑=AOI안 zone1, 분홍=AOI안 zone2, 회색=AOI밖) | 가운데 | = 분할 경계\n');
    for (let y = 0; y < p.grid; y++) {
      let row = '  ';
      for (let x = 0; x < p.grid; x++) {
        if (x === r.H) row += ' |';
        const e = at[x + ',' + y];
        if (!e) { row += ' ·'; continue; }
        const c = e.id.replace('av', '');
        const vis = r.seen.has(e.id);
        row += ' ' + (e.id === r.sel ? Y(c) : vis ? (e.zone === 0 ? B(c) : M(c)) : D(c));
      }
      console.log(row);
    }
    // 증분 시계열 스파크라인
    const max = Math.max(1, ...r.deltaTrace), blocks = ' ▁▂▃▄▅▆▇█';
    const spark = r.deltaTrace.map(v => blocks[Math.min(8, Math.round((v / max) * 8))]).join('');
    console.log(`\n  tick별 증분: ${spark}  (정지하면 0=공백 으로 수렴)`);
    console.log(`  증분 ≡ 전체 스냅샷: ${r.match ? '일치' : '불일치!'} · enter/exit/update ${r.enter}/${r.exit}/${r.update} · reset ${r.resets}회`);
    console.log(`  대역폭 ${r.deltaRecords}/${r.baseline} = 절감 ${r.save.toFixed(1)}% · 핸드오프 ${r.handoffs}회 · 선택 ${r.sel} 가시 ${r.seen.size}/${p.clients}${r.crossSeen ? ' (경계 너머 ' + r.crossSeen + ')' : ''}`);
    console.log('  → 뷰가 전체 스냅샷 → enter/exit/update 증분으로. 정지 시 0 수렴, 세션 이주 시 reset 재동기.\n');
  }

  if (isNode) {
    module.exports = { compute };
    if (require.main === module) printAscii(parseInt(process.argv[2] || '42', 10));
  } else if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountBrowser);
    else mountBrowser();
  }
})();
