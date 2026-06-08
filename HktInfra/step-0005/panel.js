// HktInfra step-0005 — 시각 관찰 셸 (브라우저 2D 격자) + 헤드리스 ASCII 미리보기(Node)
// 관찰하는 것: 더미 서버의 AOI 브로드캐스트를 *눈으로*. 격자 위 엔터티(점)와, 선택 클라의
//   AOI 반경(사각 = 체비쇼프) 안에 든 엔터티만 그 클라에게 브로드캐스트됨(밝게)을 본다.
// 데이터 층(compute)은 환경 무관(Node/브라우저 공용) — UE-free 불변을 관찰 도구까지 확장.
'use strict';
(function () {
  const isNode = (typeof module !== 'undefined' && module.exports);
  const NET = isNode ? require('./net-core.js') : globalThis.HktNet;

  // ── 데이터 층: 파라미터 → 엔터티 위치 + 각 클라 가시 집합 + 대역폭 절감 ──
  function compute(p) {
    const r = NET.run({ seed: p.seed, ticks: 40, clients: p.clients, moves: 30, radius: p.radius, grid: p.grid });
    const ents = [...r.zone.ents.entries()].map(([id, e]) => ({ id, x: e.x, y: e.y }));
    const sel = r.clients[p.selected % r.clients.length];
    const seen = sel ? new Set(sel.seenIds()) : new Set();
    return {
      grid: p.grid, radius: p.radius, ents, sel: sel ? sel.avatar : null, seen,
      selPos: sel ? r.zone.ents.get(sel.avatar) : null,
      save: (1 - r.zone.sent / r.zone.fullSent) * 100,
      sent: r.zone.sent, full: r.zone.fullSent,
    };
  }

  // ── 브라우저 층 — 2D 격자 렌더 ───────────────────────────────────────────
  function mountBrowser() {
    const K = globalThis.HktPanelKit;
    const root = document.getElementById('app');
    const params = { seed: 42, clients: 6, radius: 4, grid: 16, selected: 0 };
    const canvas = K.h('canvas', { width: 480, height: 480, class: 'grid' });
    const statBox = K.h('div', { class: 'stats' });
    const note = K.h('div', { class: 'note' });

    function draw(r) {
      const ctx = canvas.getContext('2d');
      const G = r.grid, cell = canvas.width / G;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // 격자
      ctx.strokeStyle = '#313244'; ctx.lineWidth = 1;
      for (let i = 0; i <= G; i++) {
        ctx.beginPath(); ctx.moveTo(i * cell, 0); ctx.lineTo(i * cell, canvas.height); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i * cell); ctx.lineTo(canvas.width, i * cell); ctx.stroke();
      }
      // 선택 클라 AOI 사각(체비쇼프 반경)
      if (r.selPos) {
        const x0 = (r.selPos.x - r.radius), y0 = (r.selPos.y - r.radius), w = (2 * r.radius + 1);
        ctx.fillStyle = 'rgba(137,180,250,0.13)';
        ctx.strokeStyle = '#89b4fa'; ctx.lineWidth = 2;
        ctx.fillRect(x0 * cell, y0 * cell, w * cell, w * cell);
        ctx.strokeRect(x0 * cell, y0 * cell, w * cell, w * cell);
      }
      // 엔터티 점 — AOI 안(밝은 초록)/밖(어둡게)/선택 본인(노랑)
      for (const e of r.ents) {
        const cx = (e.x + 0.5) * cell, cy = (e.y + 0.5) * cell;
        const isSel = e.id === r.sel, vis = r.seen.has(e.id);
        ctx.beginPath(); ctx.arc(cx, cy, cell * 0.32, 0, Math.PI * 2);
        ctx.fillStyle = isSel ? '#f9e2af' : vis ? '#a6e3a1' : '#45475a';
        ctx.fill();
        ctx.fillStyle = isSel ? '#1e1e2e' : '#11111b'; ctx.font = (cell * 0.34) + 'px ui-monospace, monospace';
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
        ['AOI 반경 R (체비쇼프)', params.radius + (params.radius >= params.grid ? ' (전체)' : '')],
        ['선택 클라', r.sel || '-'],
        ['선택 클라 가시 엔터티', r.seen.size + ' / ' + params.clients],
        ['보낸 엔터티 정보', r.sent + ' (전체 가정 ' + r.full + ')'],
        ['AOI 대역폭 절감', r.save.toFixed(1) + '%', 'good'],
      ]);
      note.textContent = '노랑=선택 클라 본인 · 초록=그 클라의 AOI(파란 사각) 안 = 그 클라에게 브로드캐스트됨 · 회색=AOI 밖(안 보냄). 반경을 키우면 절감↓, R≥grid 면 전체 브로드캐스트(절감 0).';
    }

    const ctrls = K.h('div', { class: 'ctrls' },
      K.slider({ label: '시드 idx', min: 0, max: 4, value: 0, on: v => { params.seed = [42, 7, 1234, 99, 2026][v]; render(); } }).node,
      K.slider({ label: '클라 수', min: 2, max: 10, value: 6, on: v => { params.clients = v; params.selected = 0; render(); } }).node,
      K.slider({ label: 'AOI 반경 R', min: 1, max: 16, value: 4, on: v => { params.radius = v; render(); } }).node,
      K.slider({ label: '선택 클라', min: 0, max: 9, value: 0, on: v => { params.selected = v; render(); } }).node,
    );
    root.append(ctrls, canvas, statBox, note);
    render();
  }

  // ── Node ASCII 층 (데모·CI 점검) ─────────────────────────────────────────
  function printAscii(seed) {
    const p = { seed, clients: 6, radius: 4, grid: 16, selected: 0 };
    const r = compute(p);
    const Y = s => '\x1b[43m\x1b[30m' + s + '\x1b[0m', G = s => '\x1b[42m\x1b[30m' + s + '\x1b[0m', D = s => '\x1b[100m' + s + '\x1b[0m';
    const at = {}; for (const e of r.ents) at[e.x + ',' + e.y] = e;
    console.log(`\nstep-0005 관찰 — seed ${seed} · 클라 ${p.clients} · AOI 반경 ${p.radius} · 선택 ${r.sel}`);
    console.log('  (노랑=선택본인, 초록=AOI 안=브로드캐스트됨, 회색=AOI 밖) grid ' + p.grid + '×' + p.grid + '\n');
    for (let y = 0; y < p.grid; y++) {
      let row = '  ';
      for (let x = 0; x < p.grid; x++) {
        const e = at[x + ',' + y];
        if (!e) { row += ' ·'; continue; }
        const c = e.id.replace('av', '');
        row += ' ' + (e.id === r.sel ? Y(c) : r.seen.has(e.id) ? G(c) : D(c));
      }
      console.log(row);
    }
    console.log(`\n  선택 클라 ${r.sel} 가시 ${r.seen.size}/${p.clients} · 보낸 엔터티 ${r.sent}(전체 ${r.full}) · AOI 절감 ${r.save.toFixed(1)}%`);
    console.log('  → 파란 사각(AOI) 안 엔터티만 그 클라에게 브로드캐스트. 더미 서버는 위치 갱신 + AOI 필터가 전부.\n');
  }

  if (isNode) {
    module.exports = { compute };
    if (require.main === module) printAscii(parseInt(process.argv[2] || '42', 10));
  } else if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountBrowser);
    else mountBrowser();
  }
})();
