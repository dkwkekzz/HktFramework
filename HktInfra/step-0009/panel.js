// HktInfra step-0009 — 시각 관찰 셸 (브라우저 2D 격자 + failover 타임라인) + 헤드리스 ASCII(Node)
// 관찰하는 것: *권위 존 사망 → 추종자 승격*을 *눈으로*. 0008 의 복원 위에서 — 권위 존을 죽이면(deathTick)
//   failover OFF 는 그 존의 엔터티가 *영구 소실*(빨강 잔존), ON 은 추종자가 *bounded gap 후 승격*해 권위를 회복(초록 0 수렴).
//   gap 타임라인(권위 공백)에서 OFF(빨강, 영구) vs ON(초록, 감지 창 후 0)을 겹쳐 보인다. 사망/승격 시점을 세로선으로.
// 데이터 층(compute)은 환경 무관(공용 — UE-free 불변을 관찰 도구까지).
'use strict';
(function () {
  const isNode = (typeof module !== 'undefined' && module.exports);
  const NET = isNode ? require('./net-core.js') : globalThis.HktNet;
  const { run, authorityCount, ownerOf, globalAoiTruth } = NET;

  // 매 tick 권위 공백 수(authorityCount==0 인 도입 엔터티) — 사망 주입(deathTick).
  function gapSeries(seed, failover, ticks, deathTick, leaseTimeout) {
    const r = run({ seed, ticks, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2, incremental: true, recovery: true, failover, deathTick, leaseTimeout });
    const intro = new Set(), out = [];
    for (const t of r.trace) {
      for (const av of t.committed.keys()) intro.add(av);
      for (const av of t.inflight) intro.add(av);
      let g = 0; for (const av of intro) if (authorityCount(t, av) === 0) g++;
      out.push(g);
    }
    return { series: out, r };
  }

  function compute(p) {
    const ticks = p.ticks || 80, deathTick = p.deathTick || 40, leaseTimeout = p.leaseTimeout || 3;
    const off = gapSeries(p.seed, false, ticks, deathTick, leaseTimeout);
    const on = gapSeries(p.seed, true, ticks, deathTick, leaseTimeout);
    // 격자 = failover ON 의 최종 상태(승격 후) + 선택 클라 가시
    const r = on.r;
    const live = NET.liveZones(r);
    const liveAddr = new Set(live.map(z => z.addr));
    const ents = [];
    r.allZones.forEach((z) => { if (liveAddr.has(z.addr)) for (const [id, e] of z.ents) ents.push({ id, x: e.x, y: e.y, zone: z.region.lo === 0 ? 0 : 1, promoted: /f$/.test(z.addr) }); });
    const sel = r.clients[p.selected % r.clients.length];
    const seen = sel ? new Set(sel.seenIds()) : new Set();
    const selPos = sel ? (function () { for (const z of live) if (z.ents.has(sel.avatar)) return z.ents.get(sel.avatar); return null; })() : null;
    const last = a => a[a.length - 1];
    // 최종 desync(살아있는 권위 트루스 대비)
    let desync = 0;
    for (const c of r.clients) { if (!c.avatar) continue; const t = globalAoiTruth(r, c.avatar); if (t === null) continue; if (JSON.stringify(c.seenIds()) !== JSON.stringify(t)) desync++; }
    // 소실(영구) — OFF 마지막
    const lastTr = off.r.trace[off.r.trace.length - 1];
    let lostOff = 0; for (const c of off.r.clients) if (c.avatar && (lastTr.committed.get(c.avatar) || 0) === 0 && !lastTr.inflight.has(c.avatar)) lostOff++;
    const promoTick = r.orch ? (r.orch.deathSeen.get('zone1') || null) : null;
    return {
      grid: 16, radius: 4, H: r.H, ents, sel: sel ? sel.avatar : null, seen, selPos, selOwner: sel ? ownerOf(r, sel.avatar) : null,
      deathTick, leaseTimeout, promoTick,
      gapOff: off.series, gapOn: on.series,
      finalGapOff: last(off.series), finalGapOn: last(on.series),
      lostOff, lostOn: 0, promotions: r.totals.promotions, promotionKeyframes: r.totals.promotionKeyframes,
      desync,
    };
  }

  const ZONE_FILL = ['rgba(137,180,250,0.07)', 'rgba(245,194,231,0.07)'];
  const ZONE_DOT = ['#89b4fa', '#f5c2e7'];

  function mountBrowser() {
    const K = globalThis.HktPanelKit;
    const root = document.getElementById('app');
    const params = { seed: 42, leaseTimeout: 3, selected: 0, ticks: 80, deathTick: 40 };
    const canvas = K.h('canvas', { width: 480, height: 480, class: 'grid' });
    const tl = K.h('canvas', { width: 480, height: 120, class: 'grid' });
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
        if (e.promoted) { ctx.strokeStyle = '#fab387'; ctx.lineWidth = 2; ctx.stroke(); }   // 승격 존 소유 = 주황 테두리
        else if (vis && !isSel) { ctx.strokeStyle = '#a6e3a1'; ctx.lineWidth = 1.5; ctx.stroke(); }
        ctx.fillStyle = '#11111b'; ctx.font = (cell * 0.34) + 'px ui-monospace, monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(e.id.replace('av', ''), cx, cy);
      }
    }
    // 권위 공백 타임라인 — OFF(빨강) 영구 잔존 vs ON(초록) 감지 창 후 0. 사망/승격 세로선.
    function drawTimeline(r) {
      const ctx = tl.getContext('2d');
      ctx.clearRect(0, 0, tl.width, tl.height);
      const n = r.gapOff.length, bw = tl.width / n, h = 84, y0 = 6;
      const max = Math.max(1, ...r.gapOff, ...r.gapOn);
      ctx.fillStyle = '#45475a'; ctx.fillRect(0, y0 + h, tl.width, 1);
      for (let t = 0; t < n; t++) {
        const ho = (r.gapOff[t] / max) * h, hn = (r.gapOn[t] / max) * h;
        ctx.fillStyle = 'rgba(243,139,168,0.55)'; ctx.fillRect(t * bw, y0 + h - ho, Math.max(1, bw - 0.5), ho);
        ctx.fillStyle = '#a6e3a1'; ctx.fillRect(t * bw, y0 + h - hn, Math.max(1, bw - 0.5), Math.max(hn, r.gapOn[t] ? 1 : 0));
      }
      // 사망/승격 세로선
      ctx.strokeStyle = '#f38ba8'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(r.deathTick * bw, y0); ctx.lineTo(r.deathTick * bw, y0 + h); ctx.stroke();
      if (r.promoTick) { ctx.strokeStyle = '#a6e3a1'; ctx.beginPath(); ctx.moveTo(r.promoTick * bw, y0); ctx.lineTo(r.promoTick * bw, y0 + h); ctx.stroke(); }
      ctx.fillStyle = '#bac2de'; ctx.font = '10.5px ui-monospace, monospace'; ctx.textAlign = 'left';
      ctx.fillText('권위 공백  빨강=failover OFF(영구 소실) · 초록=ON(감지 창 후 0 회복) · 빨선=사망 · 초록선=승격', 4, y0 + 11);
    }
    function render() {
      const r = compute(params);
      draw(r); drawTimeline(r);
      K.stats(statBox, [
        ['시드', params.seed],
        ['lease 타임아웃(감지 창)', params.leaseTimeout + ' tick'],
        ['선택 클라 / 소유 존', (r.sel || '-') + ' / ' + (r.selOwner || '-')],
        ['사망 tick → 승격 감지 tick', r.deathTick + ' → ' + (r.promoTick || '-')],
        ['failover OFF 영구 소실', r.lostOff, r.lostOff > 0 ? 'bad' : ''],
        ['failover ON 최종 공백', r.finalGapOn, r.finalGapOn === 0 ? 'good' : 'bad'],
        ['승격 횟수 / 승격 keyframe', r.promotions + ' / ' + r.promotionKeyframes],
        ['승격 후 최종 desync', r.desync, r.desync === 0 ? 'good' : 'bad'],
      ]);
      note.textContent = '권위 존(zone1)을 deathTick 에 죽인다(영구 단절). failover OFF(빨강)는 그 존의 엔터티가 *영구 소실*된다(어떤 재전송도 못 메움). '
        + 'failover ON(초록)은 추종자(입력 replay 로 lockstep 복제)가 orch 의 lease 감지 후 *권위로 승격* — 감지 창(leaseTimeout)만큼의 '
        + 'bounded gap 뒤 소유자=1 을 회복하고, 강제 keyframe 으로 클라 뷰를 재동기(desync 0)한다. 클라는 keyframe(view_delta reset)만 볼 뿐 — 사망·승격·존을 모른다(은닉).';
    }

    const ctrls = K.h('div', { class: 'ctrls' },
      K.slider({ label: '시드 idx', min: 0, max: 4, value: 0, on: v => { params.seed = [42, 7, 1234, 99, 2026][v]; render(); } }).node,
      K.slider({ label: 'lease 타임아웃', min: 2, max: 8, value: 3, on: v => { params.leaseTimeout = v; render(); } }).node,
      K.slider({ label: '선택 클라', min: 0, max: 5, value: 0, on: v => { params.selected = v; render(); } }).node,
    );
    root.append(ctrls, canvas, tl, statBox, note);
    render();
  }

  // ── Node ASCII 층 ──
  function printAscii(seed) {
    const p = { seed, leaseTimeout: 3, selected: 0, ticks: 80, deathTick: 40 };
    const r = compute(p);
    const blocks = ' ▁▂▃▄▅▆▇█';
    const spark = (a) => { const m = Math.max(1, ...a); return a.map(v => blocks[Math.min(8, Math.round((v / m) * 8))]).join(''); };
    console.log(`\nstep-0009 관찰(추종자 승격 failover) — seed ${seed} · 사망 tick ${p.deathTick} · lease 타임아웃 ${p.leaseTimeout} · 선택 ${r.sel}(${r.selOwner})`);
    console.log('  권위 존(zone1) 사망 주입 → failover OFF 영구 소실 vs ON 감지 창 후 승격(공백 0 회복)\n');
    console.log('  권위 공백 (zone1 사망):');
    console.log('    OFF ' + spark(r.gapOff) + '  최종 ' + r.finalGapOff + '  (영구 소실 ' + r.lostOff + ')');
    console.log('    ON  ' + spark(r.gapOn) + '  최종 ' + r.finalGapOn + '  (승격 ' + r.promotions + ' @tick ' + (r.promoTick || '-') + ' · 승격KF ' + r.promotionKeyframes + ')');
    console.log('  승격 후 최종 desync(살아있는 권위 트루스 대비): ' + r.desync);
    console.log('  → failover OFF 는 사망 존 엔터티가 영구 소실, ON 은 추종자 승격으로 bounded gap 후 소유자=1·desync 0 회복.\n');
  }

  if (isNode) {
    module.exports = { compute };
    if (require.main === module) printAscii(parseInt(process.argv[2] || '42', 10));
  } else if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountBrowser);
    else mountBrowser();
  }
})();
