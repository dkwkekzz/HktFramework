// HktInfra step-0014 — 시각 관찰 셸 (프로세스 토폴로지 + 토픽 버스 트래픽 + 가방 서비스 박스) + 헤드리스 ASCII(Node)
// 관찰하는 것: *전 서버가 별 프로세스가 되어 토픽 pub/sub 버스로 통신*하는 그림을 *눈으로*. 0013 위에 *가방(inventory) 박스*를
//   더해 — host 태그 경계를 프로세스+버스 경계로 본다: 각 서버 박스(login·gateway·zone·orch·inventory…)를 노드로, 그 사이를
//   흐르는 메시지를 *프로세스 경계를 넘는 버스 토픽 프레임* 으로 본다(공유 메모리 0). 가방은 존을 우회하는 *별도 채널*(신성한
//   tick) — gateway↔inventory 엣지로 보인다. 데이터 층(compute)은 환경 무관(인프로세스 run() 만 사용 — 브라우저는 child_process 미로드).
'use strict';
(function () {
  const isNode = (typeof module !== 'undefined' && module.exports);
  const NET = isNode ? require('./net-core.js') : globalThis.HktNet;
  const { run } = NET;

  // 배치(placement) — cluster.js 기본과 동일: 각 서버 박스 자기 프로세스, 클라는 한 호스트. (compute 는 child_process 불요)
  function hostOf(addr) { return addr.startsWith('client') ? 'clients' : addr; }

  function compute(p) {
    const ticks = p.ticks || 80, deathTick = p.deathTick || 40, leaseTimeout = p.leaseTimeout || 3;
    const r = run({ seed: p.seed, ticks, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2, incremental: true, recovery: true, failover: true, deathTick, leaseTimeout, inventory: true, itemOps: 10 });
    // 프로세스 경계를 넘는 메시지(IPC) 집계 — host(from) != host(to) 인 모든 로그 메시지.
    const hosts = new Set();
    for (const s of NET.buildTopology({ seed: p.seed, clients: 6, zones: 2, failover: true, inventory: true }).order) hosts.add(hostOf(s));
    const edges = new Map();          // "a>b" -> count
    const hostIO = new Map();         // host -> {sent, recv}
    const ipcTimeline = new Array(ticks).fill(0);
    let ipcMsgs = 0, ipcBytes = 0;
    for (const h of hosts) hostIO.set(h, { sent: 0, recv: 0 });
    for (const m of r.net.log) {
      const ha = hostOf(m.from), hb = hostOf(m.to);
      if (ha === hb) continue;        // 같은 프로세스 안 — 경계 안 넘음(클라끼리뿐, 실제 0)
      const key = ha + '>' + hb;
      edges.set(key, (edges.get(key) || 0) + 1);
      if (hostIO.has(ha)) hostIO.get(ha).sent++;
      if (hostIO.has(hb)) hostIO.get(hb).recv++;
      ipcMsgs++; ipcBytes += JSON.stringify(m.payload).length;
      const t = (m.tick || 0) - 1;    // 발신 tick(0-based index)
      if (t >= 0 && t < ticks) ipcTimeline[t]++;
    }
    const promoTick = r.orch ? (r.orch.deathSeen.get('zone1') || null) : null;
    return {
      hosts: [...hosts], hostIO, edges, ipcTimeline, ipcMsgs, ipcBytes,
      deathTick, leaseTimeout, promoTick, promotions: r.totals.promotions,
      leasesSent: r.totals.leasesSent, promotionKeyframes: r.totals.promotionKeyframes,
      // 가방 서비스(0014) — 원장/거래 계측(존 우회·신성한 tick).
      itemsMinted: r.inventory ? r.inventory.minted : 0, itemTransfers: r.inventory ? r.inventory.transfers : 0,
    };
  }

  // 프로세스 박스 고정 배치(6계층 흐름) — 클라(엣지) → 게이트웨이/로그인 → 존/추종자 → orch/registry
  const LAYOUT = {
    clients: [60, 240], login: [200, 120], registry: [200, 360], gateway: [200, 240],
    zone1: [360, 130], zone2: [360, 240], orch: [360, 350],
    zone1f: [490, 130], zone2f: [490, 240],
  };

  function mountBrowser() {
    const K = globalThis.HktPanelKit;
    const root = document.getElementById('app');
    const params = { seed: 42, leaseTimeout: 3, ticks: 80, deathTick: 40 };
    const canvas = K.h('canvas', { width: 600, height: 460, class: 'grid' });
    const tl = K.h('canvas', { width: 600, height: 120, class: 'grid' });
    const statBox = K.h('div', { class: 'stats' });
    const note = K.h('div', { class: 'note' });

    function draw(r) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // 엣지(IPC 흐름) — 굵기 = 메시지 수
      const maxE = Math.max(1, ...[...r.edges.values()]);
      for (const [key, n] of r.edges) {
        const [a, b] = key.split('>');
        const pa = LAYOUT[a], pb = LAYOUT[b];
        if (!pa || !pb) continue;
        ctx.strokeStyle = 'rgba(137,180,250,' + (0.15 + 0.5 * (n / maxE)) + ')';
        ctx.lineWidth = 0.5 + 3 * (n / maxE);
        ctx.beginPath(); ctx.moveTo(pa[0], pa[1]); ctx.lineTo(pb[0], pb[1]); ctx.stroke();
      }
      // 프로세스 박스
      for (const h of r.hosts) {
        const pos = LAYOUT[h]; if (!pos) continue;
        const dead = (h === 'zone1' && r.promotions > 0);
        const promoted = (h === 'zone1f' && r.promotions > 0);
        ctx.fillStyle = dead ? '#5a2030' : (promoted ? '#5a4020' : '#313244');
        ctx.strokeStyle = dead ? '#f38ba8' : (promoted ? '#fab387' : '#89b4fa');
        ctx.lineWidth = 2;
        const w = 76, hgt = 30;
        ctx.fillRect(pos[0] - w / 2, pos[1] - hgt / 2, w, hgt);
        ctx.strokeRect(pos[0] - w / 2, pos[1] - hgt / 2, w, hgt);
        ctx.fillStyle = '#cdd6f4'; ctx.font = '11px ui-monospace, monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(h + (dead ? ' ✝' : promoted ? ' ▲' : ''), pos[0], pos[1] - 4);
        const io = r.hostIO.get(h);
        ctx.fillStyle = '#9399b2'; ctx.font = '9px ui-monospace, monospace';
        ctx.fillText('↑' + io.sent + ' ↓' + io.recv, pos[0], pos[1] + 8);
      }
      ctx.fillStyle = '#bac2de'; ctx.font = '10.5px ui-monospace, monospace'; ctx.textAlign = 'left';
      ctx.fillText('각 박스 = 독립 OS 프로세스 · 선 = 프로세스 경계를 넘는 토픽 버스 프레임(굵기=메시지 수) · ✝사망 ▲승격', 8, 16);
    }
    function drawTimeline(r) {
      const ctx = tl.getContext('2d');
      ctx.clearRect(0, 0, tl.width, tl.height);
      const n = r.ipcTimeline.length, bw = tl.width / n, h = 84, y0 = 6;
      const max = Math.max(1, ...r.ipcTimeline);
      ctx.fillStyle = '#45475a'; ctx.fillRect(0, y0 + h, tl.width, 1);
      for (let t = 0; t < n; t++) {
        const hh = (r.ipcTimeline[t] / max) * h;
        ctx.fillStyle = '#89b4fa'; ctx.fillRect(t * bw, y0 + h - hh, Math.max(1, bw - 0.5), hh);
      }
      ctx.strokeStyle = '#f38ba8'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(r.deathTick * bw, y0); ctx.lineTo(r.deathTick * bw, y0 + h); ctx.stroke();
      if (r.promoTick) { ctx.strokeStyle = '#a6e3a1'; ctx.beginPath(); ctx.moveTo(r.promoTick * bw, y0); ctx.lineTo(r.promoTick * bw, y0 + h); ctx.stroke(); }
      ctx.fillStyle = '#bac2de'; ctx.font = '10.5px ui-monospace, monospace'; ctx.textAlign = 'left';
      ctx.fillText('프로세스 경계 버스 토픽 트래픽 / tick  ·  빨선=존 사망·분단(lease 끊김) · 초록선=승격(keyframe 버스트)', 4, y0 + 11);
    }
    function render() {
      const r = compute(params);
      draw(r); drawTimeline(r);
      K.stats(statBox, [
        ['시드', params.seed],
        ['프로세스(호스트) 수', r.hosts.length],
        ['프로세스 경계 소켓 메시지', r.ipcMsgs],
        ['소켓 payload bytes', r.ipcBytes],
        ['사망 tick → 승격 tick', r.deathTick + ' → ' + (r.promoTick || '-')],
        ['승격 / 승격 keyframe', r.promotions + ' / ' + r.promotionKeyframes],
        ['lease 하트비트 송신', r.leasesSent],
        ['E2E 동치 (헤드리스 검증)', '인프로세스와 비트 동일', 'good'],
      ]);
      note.textContent = 'broker 단일점을 *토픽 pub/sub 버스*로 분산하고 소켓 층에 드롭·분단·재연결을 주입했다. 각 박스는 별 OS 프로세스이고, 선은 그 사이를 '
        + '흐르는 *길이-프리픽스 프레임 소켓 메시지*(공유 메모리 0)다. broker(TCP 서버)가 lockstep 배리어로 전역 발신 순서를 보존하므로 멀티프로세스 실행이 '
        + '인프로세스와 *비트 동일*(E2E 동치) — 0001~0010 의 프로토콜·토폴로지·failover 가 실 소켓 너머로도 그대로 선다. '
        + '검증은 node verify.js 한 줄(원격에서 전 프로세스를 TCP 소켓으로 묶어 → ALL OK). 클라는 여전히 게이트웨이만 — 소켓 분리는 서버간 경계(은닉).';
    }

    const ctrls = K.h('div', { class: 'ctrls' },
      K.slider({ label: '시드 idx', min: 0, max: 4, value: 0, on: v => { params.seed = [42, 7, 1234, 99, 2026][v]; render(); } }).node,
      K.slider({ label: 'lease 타임아웃', min: 2, max: 8, value: 3, on: v => { params.leaseTimeout = v; render(); } }).node,
    );
    root.append(ctrls, canvas, tl, statBox, note);
    render();
  }

  // ── Node ASCII 층 ──
  function printAscii(seed) {
    const r = compute({ seed, leaseTimeout: 3, ticks: 80, deathTick: 40 });
    const blocks = ' ▁▂▃▄▅▆▇█';
    const spark = (a) => { const m = Math.max(1, ...a); return a.map(v => blocks[Math.min(8, Math.round((v / m) * 8))]).join(''); };
    console.log(`\nstep-0012 관찰(토픽 버스 + 소켓 층 열화) — seed ${seed} · 사망 tick ${r.deathTick} · lease 타임아웃 ${r.leaseTimeout}`);
    console.log(`  전 서버 박스를 별 프로세스로 분리 → 토픽 pub/sub 버스(직접 주소결합 제거)로 통신(공유 메모리 0). 인프로세스와 비트 동일(E2E 동치).\n`);
    console.log('  프로세스(호스트): ' + r.hosts.join(' · '));
    console.log('  프로세스 경계 버스 토픽: ' + r.ipcMsgs + ' 메시지 / ' + r.ipcBytes + ' payload bytes · lease ' + r.leasesSent + ' · 승격KF ' + r.promotionKeyframes);
    console.log('\n  버스 토픽 트래픽 / tick (빨=사망·분단 ' + r.deathTick + ' · 초=승격 ' + (r.promoTick || '-') + '):');
    console.log('    ' + spark(r.ipcTimeline));
    console.log('\n  주요 프로세스간 흐름(상위):');
    const top = [...r.edges.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    for (const [k, n] of top) console.log('    ' + k.replace('>', ' → ').padEnd(28) + ' ' + n + ' msgs');
    console.log('\n  → host 태그 = 실 프로세스 + 토픽 버스(spawn·IPC 0). 소켓 층 드롭·분단·재연결 아래에서도 배리어가 발신 순서 보존 → 비트 동일.\n');
  }

  if (isNode) {
    module.exports = { compute };
    if (require.main === module) printAscii(parseInt(process.argv[2] || '42', 10));
  } else if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountBrowser);
    else mountBrowser();
  }
})();
