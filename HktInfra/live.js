'use strict';
// ════════════════════════════════════════════════════════════════════════
//  HktInfra/live.js — 진짜 라이브 모니터링 서버 (run.js live 가 위임)
//   레코더(report.html, 녹화 재생)와 달리 *살아있는 인스턴스*를 실시간으로 띄우고 들여다본다:
//     · 현재 step net-core 의 전 서버(로그인·게이트웨이·존·추종자·orch·레지스트리·클라)를
//       인프로세스 액터로 띄우고 tick 루프를 *실시간 페이스*로 굴린다(net.step() 한 번 = 한 tick).
//     · 매 tick 상태를 SSE(Server-Sent Events)로 브라우저에 push → 라이브 대시보드가 즉시 갱신.
//     · 브라우저에서 명령 주입(POST /cmd): play/pause·step·속도·**존 kill(라이브 failover)**·restart.
//   의존성 0(순수 http·SSE) · 동결 step 무수정(net-core 의 export 만 조합).
//
//   ※ 로컬 실행이면 포트포워딩 불요: `node run.js live` → http://localhost:8080 바로 열림.
//     원격 컨테이너에서 띄우면 그 컨테이너의 포트를 환경이 노출해야 브라우저가 닿는다(원격이라서지, 방식의 한계가 아님).
// ════════════════════════════════════════════════════════════════════════

const http = require('http');

const LAYER_LABEL = { edge: '엣지', world: '월드', service: '서비스', bus: '버스', coord: '코디네이션', data: '데이터', client: '클라이언트', other: '기타' };
function layerOf(spec) {
  switch (spec.kind) {
    case 'login': case 'gateway': return 'edge';
    case 'registry': case 'orch': return 'coord';
    case 'zone': return 'world';
    case 'client': return 'client';
    case 'loginqueue': return 'edge';
    default: return 'other';
  }
}
const EVENT_KINDS = new Set(['handoff', 'handoff_ack', 'lease', 'promote', 'relink', 'reroute', 'retire', 'leave']);

// 기본 라이브 시나리오 — failover 머신 켜고 *사망은 미예약*(kill 은 라이브 명령으로).
//   loginQueue ON: 엣지 로그인 큐 박스(loginqueue)를 상주시켜 큐 주입(enqueue/dequeue/auth…)을 관찰 가능하게 한다.
//   스크립트 클라는 여전히 login 박스로 직접 auth(큐 우회) → 큐 박스는 주입 전엔 idle = 기존 거동 불변.
function defaultOpts() {
  return { seed: 42, ticks: 0, transport: null,
    clients: 6, moves: 120, radius: 4, grid: 16, zones: 2,
    incremental: true, recovery: true, failover: true, deathTick: null, leaseTimeout: 4,
    loginQueue: true };
}

function serve(NET, { port = 8080, host = '0.0.0.0', step = 'current' } = {}) {
  const state = {
    step, opts: defaultOpts(), net: null, actors: null, refs: null,
    tick: 0, running: true, speed: 2 /*tick/s*/, killed: new Set(), seedBase: 42, restarts: 0,
  };

  function buildWorld() {
    const o = state.opts;
    // loginqueue 의 loginAuth 검증 계정을 현재 클라 수에 맞춘다(hero0..N) — addclient/restart 후에도 정합.
    o.loginAccounts = Array.from({ length: o.clients }, (_, i) => 'hero' + i);
    const topo = NET.buildTopology(o);
    const net = new NET.Net({ transport: o.transport, seed: o.seed });
    const actors = new Map();
    for (const spec of topo.specs) actors.set(spec.addr, NET.makeActor(spec, net));
    const zoneObjs = topo.zoneAddrs.map(a => actors.get(a));
    const followers = ['zone1f', 'zone2f'].map(a => actors.get(a)).filter(Boolean);
    const clients = topo.specs.filter(s => s.kind === 'client').map(s => actors.get(s.addr));
    const clientAddrs = topo.specs.filter(s => s.kind === 'client').map(s => s.addr);
    state.net = net; state.actors = actors; state.tick = 0; state.killed = new Set();
    state.refs = {
      boxes: topo.specs.map(s => ({ addr: s.addr, kind: s.kind, layer: layerOf(s) })),
      zoneObjs, followers, clients, clientAddrs, allZones: zoneObjs.concat(followers),
      orch: actors.get('orch') || null, loginq: actors.get('loginqueue') || null,
    };
    broadcastInit();
  }

  function meta() {
    return {
      step: state.step, seed: state.opts.seed, speed: state.speed, running: state.running,
      clients: state.opts.clients, zones: state.opts.zones, restarts: state.restarts,
      zoneAddrs: state.refs.boxes.filter(b => b.kind === 'zone' && !/f$/.test(b.addr)).map(b => b.addr),
      clientAddrs: state.refs.clientAddrs, hasLoginq: !!state.refs.loginq,
    };
  }

  // 한 tick 진행 + 프레임 생성(레코더와 같은 형태 — 권위 소유자/메시지 흐름/이벤트)
  function stepOnce() {
    const net = state.net, R = state.refs;
    net.step(); state.tick = net.tick;
    const committed = new Map();
    for (const z of R.allZones) if (z.isAuthority()) for (const av of z.ents.keys()) committed.set(av, (committed.get(av) || 0) + 1);
    const inflight = NET.inflightSet(net, R.allZones);
    const avatars = new Set([...committed.keys(), ...inflight]);
    const owners = []; let violations = 0;
    for (const av of [...avatars].sort()) {
      const cnt = committed.get(av) || 0;
      const eff = cnt > 0 ? cnt : (inflight.has(av) ? 1 : 0);
      const ok = eff === 1; if (!ok) violations++;
      owners.push({ id: av, count: eff, inflight: inflight.has(av) && cnt === 0, ok });
    }
    const addrSet = new Set(R.boxes.map(b => b.addr));
    const edgeMap = new Map(); const events = [];
    for (const m of net.log) {
      if (m.tick !== net.tick) continue;
      if (!addrSet.has(m.from) || !addrSet.has(m.to)) continue;
      const kind = (m.payload && m.payload.type) || '?';
      const key = m.from + '|' + m.to + '|' + kind;
      edgeMap.set(key, (edgeMap.get(key) || 0) + 1);
      if (EVENT_KINDS.has(kind)) events.push({ kind, from: m.from, to: m.to });
    }
    const msgs = [...edgeMap.entries()].map(([k, n]) => { const [from, to, kind] = k.split('|'); return { from, to, kind, n }; });
    const deadNow = R.allZones.filter(z => z.dead && !z.shadow).map(z => z.addr)
      .concat(R.boxes.filter(b => state.killed.has(b.addr)).map(b => b.addr));
    const lq = R.loginq;
    const loginq = lq ? {
      queue: lq.queueLength(), admitted: lq.admittedCount(),
      enqueues: lq.enqueues | 0, dequeues: lq.dequeues | 0, auths: lq.auths | 0,
      reconnects: lq.reconnects | 0, abandons: lq.abandons | 0, expires: lq.expires | 0,
    } : null;
    return { t: net.tick, owners, violations, liveN: avatars.size, msgs, events, dead: [...new Set(deadNow)], loginq };
  }

  // ── SSE 클라이언트 풀 ──
  const sseClients = new Set();
  function sse(res, ev, data) { res.write(`event: ${ev}\ndata: ${JSON.stringify(data)}\n\n`); }
  function broadcast(ev, data) { for (const res of sseClients) { try { sse(res, ev, data); } catch (_) { } } }
  function broadcastInit() {
    const init = { meta: meta(), boxes: state.refs.boxes, layerLabel: LAYER_LABEL };
    broadcast('init', init);
  }

  // ── 실시간 루프 ──
  let timer = null;
  function reschedule() {
    if (timer) clearInterval(timer);
    timer = setInterval(() => {
      if (!state.running) return;
      // 클라 스크립트 소진(idle) 시 자동 재시작 — 라이브가 죽어보이지 않게
      if (state.tick >= state.opts.moves + 40) { restart(state.opts.seed + 1); return; }
      const frame = stepOnce();
      broadcast('frame', frame);
    }, Math.max(60, Math.round(1000 / state.speed)));
  }
  function restart(seed) {
    state.restarts++; state.opts.seed = seed != null ? seed : state.opts.seed;
    buildWorld();
    broadcast('frame', stepOnce());
  }

  // ── 명령 처리 ──
  function handleCmd(body) {
    const c = body || {};
    switch (c.cmd) {
      case 'play': state.running = true; break;
      case 'pause': state.running = false; break;
      case 'step': { const f = stepOnce(); broadcast('frame', f); break; }
      case 'speed': state.speed = Math.max(1, Math.min(20, +c.speed || 2)); reschedule(); break;
      case 'kill': {
        const z = state.actors.get(c.zone);
        if (z && z.isAuthority && z.isAuthority()) { z.dead = true; state.killed.add(c.zone); }
        break;
      }
      case 'restart': restart(c.seed != null ? +c.seed : state.opts.seed + 1); break;
      // ── 클라 로그인/로그아웃 주입(스크립트 클라의 실 상태기계 구동) ──────────────
      case 'clogin': {   // 재접속: 클라를 idle 로 되돌려 다음 tick 에 auth→ticket→zoneEnter(아바타 재등장).
        const a = state.actors.get(c.client);
        if (a && /^client/.test(c.client || '')) { a.phase = 'idle'; a.ticket = null; a.avatar = null; a.seen = new Map(); a.sent = 0; }
        break;
      }
      case 'clogout': {  // 접속 종료: gateway 로 disconnect 발신(client.js:53 leaveTick 경로와 동일) → 존서 제거.
        const a = state.actors.get(c.client);
        if (a && /^client/.test(c.client || '')) { a.phase = 'disconnecting'; state.net.send(c.client, 'gateway', { type: 'disconnect' }); }
        break;
      }
      // ── 이동 입력 주입(inject write-seam 과 동일 경로: 클라→게이트웨이 move intent) ──
      case 'cmove': {
        if (c.client && state.actors.has(c.client))
          state.net.send(c.client, 'gateway', { type: 'move', d: { dx: (+c.dx || 0), dy: (+c.dy || 0) } });
        break;
      }
      // ── 로그인 큐 입력 주입(loginqueue 박스로 큐 op 발신) ────────────────────────
      case 'lq': {
        if (state.refs.loginq) {
          const pl = { type: c.op, player: c.player || 'guest' };
          if (c.op === 'loginCapacity') pl.cap = (c.cap == null || c.cap === '' ? null : +c.cap);
          if (c.op === 'loginExpire') pl.ttl = (+c.ttl || 0);
          state.net.send('gateway', 'loginqueue', pl);
        }
        break;
      }
      // ── 임의 클라 add/remove(월드 재생성으로 클라 수 증감·late-join/부하 관찰) ──────
      case 'addclient': state.opts.clients = Math.min(24, state.opts.clients + 1); buildWorld(); break;
      case 'removeclient': state.opts.clients = Math.max(1, state.opts.clients - 1); buildWorld(); break;
      default: return { ok: false, err: 'unknown cmd' };
    }
    broadcast('meta', meta());
    return { ok: true, meta: meta() };
  }

  // ── HTTP ──
  const server = http.createServer((req, res) => {
    const url = req.url.split('?')[0];
    if (url === '/' || url === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(DASHBOARD_HTML);
    } else if (url === '/events') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' });
      res.write('retry: 1000\n\n');
      sseClients.add(res);
      sse(res, 'init', { meta: meta(), boxes: state.refs.boxes, layerLabel: LAYER_LABEL });
      req.on('close', () => sseClients.delete(res));
    } else if (url === '/cmd' && req.method === 'POST') {
      let buf = ''; req.on('data', d => buf += d); req.on('end', () => {
        let out; try { out = handleCmd(JSON.parse(buf || '{}')); } catch (e) { out = { ok: false, err: e.message }; }
        res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(out));
      });
    } else { res.writeHead(404); res.end('not found'); }
  });

  buildWorld();
  reschedule();
  server.listen(port, host, () => {
    console.log(`▶ live — ${state.step} 라이브 모니터링 서버`);
    console.log(`  열기: http://localhost:${port}   (로컬 실행이면 포트포워딩 불요)`);
    console.log(`  서버: 로그인·로그인큐·게이트웨이·존×2·추종자×2·orch·레지스트리·클라×${state.opts.clients} 가 실시간 tick 루프로 돕니다.`);
    console.log(`  명령: play/pause·속도·존 kill(failover)·restart + 클라 로그인/로그아웃·이동 주입·로그인 큐 주입·클라 add/remove. Ctrl+C 로 종료.`);
  });
  return { server, state, restart };
}

// ════════════════════════════════════════════════════════════════════════
//  라이브 대시보드 (SSE 구독 + 명령 POST) — 자기완결 1장
// ════════════════════════════════════════════════════════════════════════
const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="ko"><head><meta charset="utf-8"><title>HktInfra — 라이브 모니터</title>
<style>
  :root{--bg:#0d1117;--panel:#161b22;--line:#30363d;--fg:#c9d1d9;--dim:#8b949e;--ok:#3fb950;--warn:#d29922;--bad:#f85149;--acc:#58a6ff;}
  *{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace}
  header{padding:9px 16px;border-bottom:1px solid var(--line);display:flex;gap:16px;align-items:center;flex-wrap:wrap}
  header h1{font-size:15px;margin:0;color:var(--acc)}
  header .m{color:var(--dim)}header .m b{color:var(--fg)}
  .live{display:inline-flex;gap:6px;align-items:center;color:var(--ok)}
  .live .dot{width:8px;height:8px;border-radius:50%;background:var(--ok);animation:pulse 1.1s infinite}
  .live.off{color:var(--dim)} .live.off .dot{background:var(--dim);animation:none}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.25}}
  .bad{color:var(--bad)}.ok{color:var(--ok)}.warn{color:var(--warn)}.tk{color:var(--acc);font-weight:bold}
  main{display:grid;grid-template-columns:1fr 320px;height:calc(100vh - 96px)}
  #stage{position:relative;overflow:hidden}svg{width:100%;height:100%}
  aside{border-left:1px solid var(--line);overflow:auto;padding:12px}
  aside h2{font-size:12px;color:var(--dim);text-transform:uppercase;letter-spacing:.05em;margin:14px 0 6px;border-bottom:1px solid var(--line);padding-bottom:4px}
  aside h2:first-child{margin-top:0}
  .bar{padding:8px 16px;border-top:1px solid var(--line);display:flex;gap:8px;align-items:center;flex-wrap:wrap;background:var(--panel)}
  button{background:#21262d;color:var(--fg);border:1px solid var(--line);border-radius:5px;padding:4px 10px;cursor:pointer;font:inherit}
  button:hover{border-color:var(--acc)} button.kill{border-color:#7d3434} button.kill:hover{border-color:var(--bad);color:var(--bad)}
  .legend{display:flex;gap:12px;flex-wrap:wrap;color:var(--dim);font-size:11px;padding:5px 16px;border-bottom:1px solid var(--line)}
  .legend span{display:inline-flex;gap:4px;align-items:center}.dot{width:9px;height:9px;border-radius:50%;display:inline-block}
  .owner{display:flex;justify-content:space-between;padding:1px 0}
  .ev{padding:2px 0;border-bottom:1px solid #21262d}
  .kv{display:flex;justify-content:space-between;color:var(--dim)}.kv b{color:var(--fg)}
  label{color:var(--dim)}
</style></head><body>
<header>
  <h1>라이브 모니터 — <span id="hstep">…</span></h1>
  <span class="live" id="hlive"><span class="dot"></span><span id="hlivetxt">LIVE</span></span>
  <span class="m">tick <b class="tk" id="htick">0</b></span>
  <span class="m">seed <b id="hseed">—</b></span>
  <span class="m">속도 <b id="hspeed">—</b>/s</span>
  <span class="m">권위위반 <b id="hviol">0</b></span>
  <span class="m">재시작 <b id="hrest">0</b></span>
  <span class="m" id="hconn" style="color:var(--bad)">● 연결중…</span>
</header>
<div class="legend" id="legend"></div>
<main>
  <div id="stage"><svg id="svg" viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid meet"></svg></div>
  <aside>
    <h2>이 tick</h2>
    <div class="kv"><span>live 엔티티</span><b id="sLive">—</b></div>
    <div class="kv"><span>권위 위반</span><b id="sViol">—</b></div>
    <div class="kv"><span>메시지 흐름</span><b id="sMsgs">—</b></div>
    <h2>로그인 큐</h2>
    <div id="lqstat"><span style="color:#6e7681">—</span></div>
    <h2>권위 소유자 (=1 이어야 함)</h2>
    <div id="owners"></div>
    <h2>이벤트 (라이브)</h2>
    <div id="events"></div>
  </aside>
</main>
<div class="bar">
  <button id="play">⏸ pause</button>
  <button id="step">step ▶</button>
  <label>속도</label><input type="range" id="speed" min="1" max="12" value="2" style="width:120px"><span id="speedv">2</span>/s
  <span style="flex:1"></span>
  <span id="killbtns"></span>
  <button id="restart">↻ restart</button>
</div>
<div class="bar">
  <label>클라</label><select id="csel" style="background:#21262d;color:var(--fg);border:1px solid var(--line);border-radius:5px;padding:3px 6px"></select>
  <button id="clogin">⏻ login</button>
  <button id="clogout" class="kill">⏏ logout</button>
  <span style="width:6px"></span>
  <label>이동</label>
  <button data-mv="0,-1">↑</button><button data-mv="0,1">↓</button><button data-mv="-1,0">←</button><button data-mv="1,0">→</button>
  <span style="flex:1"></span>
  <button id="addc">＋ 클라</button><button id="remc">－ 클라</button>
</div>
<div class="bar" id="lqbar">
  <label>로그인 큐</label>
  <input id="lqp" placeholder="player" value="guestA" style="width:82px;background:#21262d;color:var(--fg);border:1px solid var(--line);border-radius:5px;padding:3px 6px">
  <button data-lq="loginAuth">auth</button>
  <button data-lq="loginEnqueue">enqueue</button>
  <button data-lq="loginDequeue">dequeue</button>
  <button data-lq="loginReconnect">reconnect</button>
  <button data-lq="loginAbandon" class="kill">abandon</button>
  <button data-lq="loginExpire" class="kill">expire</button>
</div>
<script>
const NS='http://www.w3.org/2000/svg';
const LAYER_ORDER=['client','edge','coord','world','service','bus','data'];
const LAYER_COLOR={client:'#8b949e',edge:'#58a6ff',coord:'#bc8cff',world:'#3fb950',service:'#d29922',bus:'#f0883e',data:'#39c5cf',other:'#6e7681'};
let BOXES=[],pos={},boxEls={},LAYER_LABEL={},evAcc=[];
const $=id=>document.getElementById(id);
function el(n,a){const e=document.createElementNS(NS,n);for(const k in a)e.setAttribute(k,a[k]);return e;}
const W=1000,H=600,PADX=70,PADY=44,BW=120,BH=40;
const svg=$('svg');let gStatic,gEdges,gBoxes;

function setupTopology(boxes){
  BOXES=boxes;pos={};boxEls={};svg.innerHTML='';
  const defs=el('defs',{});defs.innerHTML='<marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="#3a4250"/></marker>';svg.appendChild(defs);
  const used=LAYER_ORDER.filter(L=>boxes.some(b=>b.layer===L));
  const rowH=(H-PADY*2)/used.length;
  used.forEach((L,li)=>{const bs=boxes.filter(b=>b.layer===L);const cw=(W-PADX*2)/bs.length;
    bs.forEach((b,bi)=>pos[b.addr]={x:PADX+cw*bi+cw/2,y:PADY+rowH*li+rowH/2,layer:L});});
  gStatic=el('g',{});svg.appendChild(gStatic);
  used.forEach((L,li)=>{gStatic.appendChild(el('line',{x1:8,y1:PADY+rowH*li,x2:W-8,y2:PADY+rowH*li,stroke:'#21262d','stroke-width':1}));
    const t=el('text',{x:12,y:PADY+rowH*li+13,fill:'#6e7681','font-size':11});t.textContent=LAYER_LABEL[L]||L;gStatic.appendChild(t);});
  gEdges=el('g',{});svg.appendChild(gEdges);
  gBoxes=el('g',{});svg.appendChild(gBoxes);
  boxes.forEach(b=>{const p=pos[b.addr];const g=el('g',{});
    const rect=el('rect',{x:p.x-BW/2,y:p.y-BH/2,width:BW,height:BH,rx:6,fill:'#161b22',stroke:LAYER_COLOR[b.layer],'stroke-width':1.5});
    const t1=el('text',{x:p.x,y:p.y-1,fill:'#c9d1d9','font-size':12,'text-anchor':'middle'});t1.textContent=b.addr;
    const t2=el('text',{x:p.x,y:p.y+13,fill:'#6e7681','font-size':9,'text-anchor':'middle'});t2.textContent=b.kind;
    g.appendChild(rect);g.appendChild(t1);g.appendChild(t2);gBoxes.appendChild(g);boxEls[b.addr]={rect};});
  // 범례
  const lg=$('legend');lg.innerHTML='';
  used.forEach(L=>{const s=document.createElement('span');s.innerHTML='<span class=dot style="background:'+LAYER_COLOR[L]+'"></span>'+(LAYER_LABEL[L]||L);lg.appendChild(s);});
  lg.insertAdjacentHTML('beforeend','<span><span class=dot style="background:var(--bad)"></span>사망/kill</span><span>선 굵기=메시지 양</span>');
}

function drawFrame(fr){
  $('htick').textContent=fr.t;$('sLive').textContent=fr.liveN;
  $('sViol').innerHTML=fr.violations?('<span class=bad>'+fr.violations+'</span>'):'<span class=ok>0</span>';
  $('hviol').innerHTML=fr.violations?('<span class=bad>'+fr.violations+'</span>'):'0';
  $('sMsgs').textContent=fr.msgs.reduce((a,m)=>a+m.n,0);
  const dead=new Set(fr.dead||[]);
  BOXES.forEach(b=>{const r=boxEls[b.addr].rect;
    if(dead.has(b.addr)){r.setAttribute('stroke','var(--bad)');r.setAttribute('stroke-dasharray','4 3');r.setAttribute('opacity','.4');}
    else{r.setAttribute('stroke',LAYER_COLOR[b.layer]);r.removeAttribute('stroke-dasharray');r.setAttribute('opacity','1');}});
  gEdges.innerHTML='';
  fr.msgs.forEach(m=>{const a=pos[m.from],b=pos[m.to];if(!a||!b)return;
    const w=Math.min(1+m.n*0.8,6);const isEv=['handoff','promote','lease','relink','reroute','retire'].includes(m.kind);
    const ctrl=' Q '+((a.x+b.x)/2+(b.y-a.y)*0.06)+' '+((a.y+b.y)/2-(b.x-a.x)*0.06)+' ';
    gEdges.appendChild(el('path',{d:'M '+a.x+' '+a.y+ctrl+b.x+' '+b.y,fill:'none',stroke:isEv?'#d29922':'#3a4250','stroke-width':w,opacity:isEv?0.95:0.55,'marker-end':'url(#arr)'}));});
  const lq=fr.loginq,ls=$('lqstat');
  if(lq){ls.innerHTML=''
    +'<div class=kv><span>대기열</span><b>'+lq.queue+'</b></div>'
    +'<div class=kv><span>입장(admitted)</span><b>'+lq.admitted+'</b></div>'
    +'<div class=kv><span>enq/deq</span><b>'+lq.enqueues+' / '+lq.dequeues+'</b></div>'
    +'<div class=kv><span>auth/재접속/이탈</span><b>'+lq.auths+' / '+lq.reconnects+' / '+lq.abandons+'</b></div>';}
  else ls.innerHTML='<span style="color:#6e7681">(loginQueue OFF)</span>';
  const ow=$('owners');ow.innerHTML=fr.owners.length?'':'<span style="color:#6e7681">—</span>';
  fr.owners.forEach(o=>{const d=document.createElement('div');d.className='owner';
    d.innerHTML='<span>'+o.id+(o.inflight?' <span class=warn>(in-flight)</span>':'')+'</span><b class="'+(o.ok?'ok':'bad')+'">'+o.count+'</b>';ow.appendChild(d);});
  (fr.events||[]).forEach(e=>evAcc.push({t:fr.t,e}));
  if(evAcc.length>200)evAcc=evAcc.slice(-200);
  const ev=$('events');ev.innerHTML='';
  evAcc.slice(-30).reverse().forEach(({t,e})=>{const d=document.createElement('div');d.className='ev';
    const c=e.kind==='death'?'bad':(e.kind==='promote'?'ok':'warn');
    d.innerHTML='<span class=tk>t'+t+'</span> <span class='+c+'>'+e.kind+'</span> '+(e.from!==e.to?(e.from+'→'+e.to):e.from);ev.appendChild(d);});
}

function applyMeta(m){
  $('hstep').textContent=m.step;$('hseed').textContent=m.seed;$('hspeed').textContent=m.speed;
  $('hrest').textContent=m.restarts;$('speed').value=m.speed;$('speedv').textContent=m.speed;
  const live=$('hlive'),txt=$('hlivetxt'),play=$('play');
  if(m.running){live.classList.remove('off');txt.textContent='LIVE';play.textContent='⏸ pause';}
  else{live.classList.add('off');txt.textContent='PAUSED';play.textContent='▶ play';}
  // kill 버튼 (권위 존만)
  const kb=$('killbtns');if(kb.dataset.zones!==JSON.stringify(m.zoneAddrs)){kb.dataset.zones=JSON.stringify(m.zoneAddrs);kb.innerHTML='';
    (m.zoneAddrs||[]).forEach(z=>{const b=document.createElement('button');b.className='kill';b.textContent='✗ kill '+z;b.onclick=()=>cmd({cmd:'kill',zone:z});kb.appendChild(b);});}
  // 클라 셀렉터 (add/remove 로 목록이 바뀌면 갱신·선택 보존)
  const cs=$('csel'),addrs=m.clientAddrs||[];
  if(cs.dataset.addrs!==JSON.stringify(addrs)){const prev=cs.value;cs.dataset.addrs=JSON.stringify(addrs);cs.innerHTML='';
    addrs.forEach(a=>{const o=document.createElement('option');o.value=a;o.textContent=a;cs.appendChild(o);});
    if(addrs.includes(prev))cs.value=prev;}
  // 로그인 큐 미가동이면 큐 바 흐리게
  $('lqbar').style.opacity=m.hasLoginq?'1':'.4';
}
async function cmd(body){try{await fetch('/cmd',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});}catch(e){}}

// SSE 구독
function connect(){
  const es=new EventSource('/events');
  es.addEventListener('init',e=>{const d=JSON.parse(e.data);LAYER_LABEL=d.layerLabel||{};setupTopology(d.boxes);applyMeta(d.meta);$('hconn').style.color='var(--ok)';$('hconn').textContent='● 연결됨';});
  es.addEventListener('frame',e=>drawFrame(JSON.parse(e.data)));
  es.addEventListener('meta',e=>applyMeta(JSON.parse(e.data)));
  es.onerror=()=>{$('hconn').style.color='var(--bad)';$('hconn').textContent='● 재연결…';};
}
$('play').onclick=()=>cmd({cmd:$('hlivetxt').textContent==='LIVE'?'pause':'play'});
$('step').onclick=()=>cmd({cmd:'step'});
$('restart').onclick=()=>cmd({cmd:'restart'});
$('speed').oninput=()=>{$('speedv').textContent=$('speed').value;cmd({cmd:'speed',speed:+$('speed').value});};
// 클라 로그인/로그아웃·이동·add/remove 주입
$('clogin').onclick=()=>{const c=$('csel').value;if(c)cmd({cmd:'clogin',client:c});};
$('clogout').onclick=()=>{const c=$('csel').value;if(c)cmd({cmd:'clogout',client:c});};
$('addc').onclick=()=>cmd({cmd:'addclient'});
$('remc').onclick=()=>cmd({cmd:'removeclient'});
document.querySelectorAll('button[data-mv]').forEach(b=>b.onclick=()=>{
  const c=$('csel').value;if(!c)return;const[dx,dy]=b.dataset.mv.split(',').map(Number);cmd({cmd:'cmove',client:c,dx,dy});});
// 로그인 큐 op 주입
document.querySelectorAll('button[data-lq]').forEach(b=>b.onclick=()=>{
  const op=b.dataset.lq,player=$('lqp').value||'guest';const body={cmd:'lq',op,player};
  if(op==='loginExpire')body.ttl=3;cmd(body);});
connect();
</script></body></html>`;

module.exports = { serve };
