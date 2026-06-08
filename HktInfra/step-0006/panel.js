// HktInfra step-0006 — 시각 관찰 셸 (브라우저 2D 격자) + 헤드리스 ASCII 미리보기(Node)
// 관찰하는 것: *분할 존 2개*와 그 경계를 *눈으로*. 세로 경계선(x=H) 좌/우를 zone1(파랑)·zone2(분홍)이
//   소유한다. 선택 클라의 AOI 사각이 경계를 *넘어도* 양 존 엔터티를 끊김 없이 본다(경계 띠 ghost 구독).
//   엔터티가 경계를 넘으면 권위가 이주(핸드오프) — 색이 바뀐다. 데이터 층(compute)은 환경 무관(공용).
'use strict';
(function () {
  const isNode = (typeof module !== 'undefined' && module.exports);
  const NET = isNode ? require('./net-core.js') : globalThis.HktNet;

  // ── 데이터 층: 파라미터 → 엔터티(소유 존 포함) + 선택 클라 가시/AOI + 핸드오프·경계구독 지표 ──
  function compute(p) {
    const r = NET.run({ seed: p.seed, ticks: p.ticks || 48, clients: p.clients, moves: 30, radius: p.radius, grid: p.grid, zones: 2 });
    const ents = [];
    r.zones.forEach((z, zi) => { for (const [id, e] of z.ents) ents.push({ id, x: e.x, y: e.y, zone: zi }); });
    const sel = r.clients[p.selected % r.clients.length];
    const seen = sel ? new Set(sel.seenIds()) : new Set();
    const selOwner = sel ? NET.ownerOf(r, sel.avatar) : null;
    // 횡단 가시: 선택 클라가 *다른 존* 소유 엔터티를 보는가
    let crossSeen = 0;
    if (sel) for (const id of seen) if (id !== sel.avatar && NET.ownerOf(r, id) && NET.ownerOf(r, id) !== selOwner) crossSeen++;
    return {
      grid: p.grid, radius: p.radius, H: r.H, ents, sel: sel ? sel.avatar : null, seen,
      selPos: sel ? (function () { for (const z of r.zones) if (z.ents.has(sel.avatar)) return z.ents.get(sel.avatar); return null; })() : null,
      selOwner, crossSeen,
      handoffs: r.totals.handoffs, ghostEnts: r.totals.ghostEnts,
      save: (1 - r.totals.sent / r.totals.fullAssumed) * 100,
      sent: r.totals.sent,
    };
  }

  const ZONE_FILL = ['rgba(137,180,250,0.07)', 'rgba(245,194,231,0.07)'];   // zone1 파랑, zone2 분홍(영역 음영)
  const ZONE_DOT = ['#89b4fa', '#f5c2e7'];

  // ── 브라우저 층 — 2D 격자 렌더(분할 경계 + 소유 색 + 경계 횡단 AOI) ──
  function mountBrowser() {
    const K = globalThis.HktPanelKit;
    const root = document.getElementById('app');
    const params = { seed: 42, clients: 6, radius: 4, grid: 16, selected: 0, ticks: 48 };
    const canvas = K.h('canvas', { width: 480, height: 480, class: 'grid' });
    const statBox = K.h('div', { class: 'stats' });
    const note = K.h('div', { class: 'note' });

    function draw(r) {
      const ctx = canvas.getContext('2d');
      const G = r.grid, cell = canvas.width / G;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // 존 영역 음영(좌=zone1, 우=zone2)
      ctx.fillStyle = ZONE_FILL[0]; ctx.fillRect(0, 0, r.H * cell, canvas.height);
      ctx.fillStyle = ZONE_FILL[1]; ctx.fillRect(r.H * cell, 0, canvas.width - r.H * cell, canvas.height);
      // 격자
      ctx.strokeStyle = '#313244'; ctx.lineWidth = 1;
      for (let i = 0; i <= G; i++) {
        ctx.beginPath(); ctx.moveTo(i * cell, 0); ctx.lineTo(i * cell, canvas.height); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i * cell); ctx.lineTo(canvas.width, i * cell); ctx.stroke();
      }
      // 경계 띠(band=R) 음영 — 양 존이 상호 구독하는 영역
      ctx.fillStyle = 'rgba(249,226,175,0.06)';
      ctx.fillRect((r.H - r.radius) * cell, 0, 2 * r.radius * cell, canvas.height);
      // 분할 경계선(굵게)
      ctx.strokeStyle = '#f9e2af'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(r.H * cell, 0); ctx.lineTo(r.H * cell, canvas.height); ctx.stroke();
      // 선택 클라 AOI 사각(체비쇼프 반경) — 경계를 넘을 수 있다
      if (r.selPos) {
        const x0 = (r.selPos.x - r.radius), y0 = (r.selPos.y - r.radius), w = (2 * r.radius + 1);
        ctx.strokeStyle = '#a6e3a1'; ctx.lineWidth = 2; ctx.setLineDash([4, 3]);
        ctx.strokeRect(x0 * cell, y0 * cell, w * cell, w * cell); ctx.setLineDash([]);
      }
      // 엔터티 점 — 소유 존 색, AOI 안(밝게)/밖(어둡게), 선택 본인(노랑)
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
    function render() {
      const r = compute(params);
      draw(r);
      K.stats(statBox, [
        ['시드', params.seed],
        ['클라(엔터티) 수', params.clients],
        ['AOI 반경 R / 경계 띠', params.radius],
        ['분할 경계 x', r.H + ' (zone1 [0,' + r.H + ') · zone2 [' + r.H + ',' + params.grid + '))'],
        ['선택 클라 / 소유 존', (r.sel || '-') + ' / ' + (r.selOwner || '-')],
        ['선택 클라 가시', r.seen.size + ' / ' + params.clients + (r.crossSeen ? '  (경계 너머 ' + r.crossSeen + ')' : '')],
        ['핸드오프(권위 이주)', r.handoffs + ' 회'],
        ['경계 띠 상호 구독', r.ghostEnts + ' 건'],
        ['AOI 대역폭 절감', r.save.toFixed(1) + '%', 'good'],
      ]);
      note.textContent = '노랑=선택 본인 · 초록테=그 클라 AOI(초록 점선) 안 = 브로드캐스트됨(파랑=zone1 소유·분홍=zone2 소유) · 어둡게=AOI 밖. '
        + '초록 사각이 노란 경계선을 넘으면 *다른 존* 엔터티도 끊김 없이 보인다(경계 띠 ghost 구독). 엔터티가 경계를 넘으면 색이 바뀐다(권위 핸드오프).';
    }

    const ctrls = K.h('div', { class: 'ctrls' },
      K.slider({ label: '시드 idx', min: 0, max: 4, value: 0, on: v => { params.seed = [42, 7, 1234, 99, 2026][v]; render(); } }).node,
      K.slider({ label: '클라 수', min: 2, max: 10, value: 6, on: v => { params.clients = v; params.selected = 0; render(); } }).node,
      K.slider({ label: 'AOI 반경 R', min: 1, max: 8, value: 4, on: v => { params.radius = v; render(); } }).node,
      K.slider({ label: '선택 클라', min: 0, max: 9, value: 0, on: v => { params.selected = v; render(); } }).node,
    );
    root.append(ctrls, canvas, statBox, note);
    render();
  }

  // ── Node ASCII 층 (데모·CI 점검) ─────────────────────────────────────────
  function printAscii(seed) {
    const p = { seed, clients: 6, radius: 4, grid: 16, selected: 0, ticks: 48 };
    const r = compute(p);
    const Y = s => '\x1b[43m\x1b[30m' + s + '\x1b[0m';                       // 선택 본인(노랑)
    const B = s => '\x1b[44m\x1b[37m' + s + '\x1b[0m';                       // AOI 안 · zone1 소유(파랑)
    const M = s => '\x1b[45m\x1b[37m' + s + '\x1b[0m';                       // AOI 안 · zone2 소유(분홍)
    const D = s => '\x1b[100m' + s + '\x1b[0m';                              // AOI 밖(회색)
    const at = {}; for (const e of r.ents) at[e.x + ',' + e.y] = e;
    console.log(`\nstep-0006 관찰 — seed ${seed} · 클라 ${p.clients} · AOI 반경 ${p.radius} · 선택 ${r.sel}(${r.selOwner}) · 경계 x=${r.H}`);
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
    console.log(`\n  선택 ${r.sel} 가시 ${r.seen.size}/${p.clients}${r.crossSeen ? ' (경계 너머 ' + r.crossSeen + ')' : ''} · 핸드오프 ${r.handoffs}회 · 경계구독 ${r.ghostEnts}건 · AOI 절감 ${r.save.toFixed(1)}%`);
    console.log('  → 존 2개가 x=' + r.H + ' 로 분할. 경계 넘는 엔터티는 권위 이주(핸드오프), 경계 띠는 상호 구독(AOI 연속).\n');
  }

  if (isNode) {
    module.exports = { compute };
    if (require.main === module) printAscii(parseInt(process.argv[2] || '42', 10));
  } else if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountBrowser);
    else mountBrowser();
  }
})();
