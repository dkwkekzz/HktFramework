// HktInfra step-0008 — 시각 관찰 셸 (브라우저 2D 격자 + 복원 타임라인) + 헤드리스 ASCII(Node)
// 관찰하는 것: *전송 열화 아래 복원*을 *눈으로*. 0007 의 증분 위에서 — 핸드오프 토큰·증분 델타에 손실을 입히면
//   복원 OFF 는 권위 공백/desync 가 *남고*, 복원 ON 은 ack/재전송·NAK/keyframe 으로 *0 으로 수렴*한다.
//   두 타임라인(권위 공백·desync)에서 OFF(빨강, 잔존) vs ON(초록, 0 수렴)을 겹쳐 보인다.
// 데이터 층(compute)은 환경 무관(공용 — UE-free 불변을 관찰 도구까지).
'use strict';
(function () {
  const isNode = (typeof module !== 'undefined' && module.exports);
  const NET = isNode ? require('./net-core.js') : globalThis.HktNet;
  const { run, routeFilters, authorityCount, ownerOf } = NET;

  // 매 tick 권위 공백 수(authorityCount==0 인 도입 엔터티) — 핸드오프 라우트 손실.
  function authGapSeries(seed, loss, recovery, ticks) {
    const r = run({ seed, ticks, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2, incremental: true, recovery, transport: { seed: 0xBEEF, delayMin: 0, delayMax: 0, loss, redundancy: 1, routeFilter: routeFilters.handoff } });
    const intro = new Set(), out = [];
    for (const t of r.trace) {
      for (const av of t.committed.keys()) intro.add(av);
      for (const av of t.inflight) intro.add(av);
      let g = 0; for (const av of intro) if (authorityCount(t, av) === 0) g++;
      out.push(g);
    }
    return { series: out, totals: r.totals };
  }
  // 매 tick desync 수(클라 seen 셀 vs 전체 스냅샷 트루스) — 델타 라우트 손실.
  function desyncSeries(seed, loss, recovery, ticks, truth) {
    const r = run({ seed, ticks, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2, incremental: true, recovery, transport: { seed: 0xD317A, delayMin: 0, delayMax: 0, loss, redundancy: 1, routeFilter: routeFilters.delta } });
    const out = [];
    for (let t = 0; t < ticks; t++) { let d = 0; for (let c = 0; c < r.seenTrace[t].length; c++) if (r.seenTrace[t][c] !== truth.seenTrace[t][c]) d++; out.push(d); }
    return { series: out, r };
  }

  function compute(p) {
    const ticks = p.ticks || 80, loss = p.loss;
    const truth = run({ seed: p.seed, ticks, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2, incremental: false });
    const aOff = authGapSeries(p.seed, loss, false, ticks);
    const aOn = authGapSeries(p.seed, loss, true, ticks);
    const dOff = desyncSeries(p.seed, loss, false, ticks, truth);
    const dOn = desyncSeries(p.seed, loss, true, ticks, truth);
    // 격자 = 복원 ON·델타 손실 런의 최종 상태 + 선택 클라 가시
    const r = dOn.r;
    const ents = [];
    r.zones.forEach((z, zi) => { for (const [id, e] of z.ents) ents.push({ id, x: e.x, y: e.y, zone: zi }); });
    const sel = r.clients[p.selected % r.clients.length];
    const seen = sel ? new Set(sel.seenIds()) : new Set();
    const selPos = sel ? (function () { for (const z of r.zones) if (z.ents.has(sel.avatar)) return z.ents.get(sel.avatar); return null; })() : null;
    const last = a => a[a.length - 1];
    return {
      grid: 16, radius: 4, H: r.H, ents, sel: sel ? sel.avatar : null, seen, selPos, selOwner: sel ? ownerOf(r, sel.avatar) : null,
      loss,
      authOff: aOff.series, authOn: aOn.series, desyncOff: dOff.series, desyncOn: dOn.series,
      retransmits: aOn.totals.retransmits, handoffLost: aOn.totals.netLost,
      naks: dOn.r.totals.naksSent, keyframes: dOn.r.totals.keyframesForced, heartbeats: dOn.r.totals.heartbeats, deltaLost: dOn.r.totals.netLost,
      finalGapOff: last(aOff.series), finalGapOn: last(aOn.series), finalDesyncOff: last(dOff.series), finalDesyncOn: last(dOn.series),
    };
  }

  const ZONE_FILL = ['rgba(137,180,250,0.07)', 'rgba(245,194,231,0.07)'];
  const ZONE_DOT = ['#89b4fa', '#f5c2e7'];

  function mountBrowser() {
    const K = globalThis.HktPanelKit;
    const root = document.getElementById('app');
    const params = { seed: 42, loss: 0.2, selected: 0, ticks: 80 };
    const canvas = K.h('canvas', { width: 480, height: 480, class: 'grid' });
    const tl = K.h('canvas', { width: 480, height: 180, class: 'grid' });
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
    // 복원 타임라인 — 위: 권위 공백(핸드오프 손실), 아래: desync(델타 손실). OFF(빨강) 잔존 vs ON(초록) 0 수렴.
    function drawTimeline(r) {
      const ctx = tl.getContext('2d');
      ctx.clearRect(0, 0, tl.width, tl.height);
      const n = r.authOff.length, bw = tl.width / n;
      const band = (rows, off, on, y0, h, label) => {
        const max = Math.max(1, ...off, ...on);
        ctx.fillStyle = '#45475a'; ctx.fillRect(0, y0 + h, tl.width, 1);
        for (let t = 0; t < n; t++) {
          const ho = (off[t] / max) * h, hn = (on[t] / max) * h;
          ctx.fillStyle = 'rgba(243,139,168,0.55)'; ctx.fillRect(t * bw, y0 + h - ho, Math.max(1, bw - 0.5), ho); // OFF 빨강
          ctx.fillStyle = '#a6e3a1'; ctx.fillRect(t * bw, y0 + h - hn, Math.max(1, bw - 0.5), Math.max(hn, on[t] ? 1 : 0)); // ON 초록
        }
        ctx.fillStyle = '#bac2de'; ctx.font = '10.5px ui-monospace, monospace'; ctx.textAlign = 'left';
        ctx.fillText(label, 4, y0 + 11);
      };
      band(null, r.authOff, r.authOn, 6, 70, '권위 공백 (핸드오프 손실)  빨강=복원OFF 잔존 · 초록=복원ON 0');
      band(null, r.desyncOff, r.desyncOn, 96, 70, 'desync (델타 손실)  빨강=복원OFF 잔존 · 초록=복원ON 0 수렴');
    }
    function render() {
      const r = compute(params);
      draw(r); drawTimeline(r);
      K.stats(statBox, [
        ['시드', params.seed],
        ['전송 손실률', (params.loss * 100).toFixed(0) + '%'],
        ['선택 클라 / 소유 존', (r.sel || '-') + ' / ' + (r.selOwner || '-')],
        ['핸드오프 토큰 유실 / 재전송', r.handoffLost + ' / ' + r.retransmits],
        ['권위 공백 OFF→ON (최종)', r.finalGapOff + ' → ' + r.finalGapOn, r.finalGapOn === 0 ? 'good' : 'bad'],
        ['델타 유실 / NAK / 키프레임', r.deltaLost + ' / ' + r.naks + ' / ' + r.keyframes],
        ['desync OFF→ON (최종)', r.finalDesyncOff + ' → ' + r.finalDesyncOn, r.finalDesyncOn === 0 ? 'good' : 'bad'],
        ['heartbeat 키프레임', r.heartbeats + ' (꼬리 유실 상한)'],
      ]);
      note.textContent = '핸드오프 토큰·증분 델타에 전송 손실을 입힌다. 복원 OFF(빨강)는 권위 공백·desync 가 *남는다*(자가치유 상실). '
        + '복원 ON(초록)은 핸드오프 ack/재전송(권위-of-record)으로 공백을 *원천 차단*하고, 증분 seq/NAK/keyframe(+heartbeat)으로 desync 를 *0 으로 수렴*시킨다. '
        + '클라는 {resync} 만 보낼 뿐 — 세션·존·복원의 내부를 모른다(은닉).';
    }

    const ctrls = K.h('div', { class: 'ctrls' },
      K.slider({ label: '시드 idx', min: 0, max: 4, value: 0, on: v => { params.seed = [42, 7, 1234, 99, 2026][v]; render(); } }).node,
      K.slider({ label: '손실 %', min: 0, max: 40, value: 20, on: v => { params.loss = v / 100; render(); } }).node,
      K.slider({ label: '선택 클라', min: 0, max: 5, value: 0, on: v => { params.selected = v; render(); } }).node,
    );
    root.append(ctrls, canvas, tl, statBox, note);
    render();
  }

  // ── Node ASCII 층 ──
  function printAscii(seed) {
    const p = { seed, loss: 0.2, selected: 0, ticks: 80 };
    const r = compute(p);
    const blocks = ' ▁▂▃▄▅▆▇█';
    const spark = (a) => { const m = Math.max(1, ...a); return a.map(v => blocks[Math.min(8, Math.round((v / m) * 8))]).join(''); };
    console.log(`\nstep-0008 관찰(전송 열화 아래 복원) — seed ${seed} · 손실 ${(p.loss * 100).toFixed(0)}% · 선택 ${r.sel}(${r.selOwner})`);
    console.log('  핸드오프 토큰·증분 델타에 손실 주입 → 복원 OFF 잔존 vs 복원 ON 0 수렴\n');
    console.log('  권위 공백 (핸드오프 손실):');
    console.log('    OFF ' + spark(r.authOff) + '  최종 ' + r.finalGapOff);
    console.log('    ON  ' + spark(r.authOn) + '  최종 ' + r.finalGapOn + '  (재전송 ' + r.retransmits + ' · 유실 ' + r.handoffLost + ')');
    console.log('  desync (델타 손실):');
    console.log('    OFF ' + spark(r.desyncOff) + '  최종 ' + r.finalDesyncOff);
    console.log('    ON  ' + spark(r.desyncOn) + '  최종 ' + r.finalDesyncOn + '  (NAK ' + r.naks + ' · 키프레임 ' + r.keyframes + ' · 유실 ' + r.deltaLost + ')');
    console.log('  → 복원 OFF 는 공백·desync 가 남고, ON 은 ack/재전송·NAK/keyframe 으로 0 으로 수렴(소유자=1·desync 0).\n');
  }

  if (isNode) {
    module.exports = { compute };
    if (require.main === module) printAscii(parseInt(process.argv[2] || '42', 10));
  } else if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountBrowser);
    else mountBrowser();
  }
})();
