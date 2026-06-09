// HktInfra step-0010 — broker(코디네이터). 멀티프로세스 lockstep 배리어로 전 서버 박스를 구동한다(Node 전용).
//   broker 는 engine/Net 을 *전송 substrate*(큐·seq·dedup·로그·전송 모델)로 소유하되 액터는 *원격*(자식 프로세스)에 둔다.
//   매 tick 엔진 step() 의 의미(deliver → onTick)를 비동기 IPC 배리어로 재현하되 *전역 발신 순서를 정확히 보존* →
//   broker.net.log 가 인프로세스와 비트 동일(E2E 동치 증명). 자식과는 JSON 직렬화 메시지로만 통신(공유 메모리 0).
'use strict';
const { fork } = require('child_process');
const path = require('path');

class Cluster {
  constructor(hostIds) {
    this.hostIds = hostIds;
    this.children = new Map();   // hostId -> child
    this.pending = new Map();    // hostId -> Map(reqId -> resolve)
    this.reqSeq = 0;
    this.ipcMsgs = 0;            // broker→자식 IPC 메시지 수(out 방향 경계 통과량)
    this.ipcBytes = 0;          // out 직렬화 바이트 합
    this.ipcMsgsIn = 0;         // 자식→broker IPC 메시지 수(in 방향)
    this.ipcBytesIn = 0;        // in 직렬화 바이트 합
    this.allSerializable = true; // *양방향* 경계 넘는 모든 메시지가 순수 데이터(함수·심볼·순환 0)인가
    this._pids = new Map();      // hostId -> pid
  }
  async spawn() {
    const hostPath = path.join(__dirname, 'host.js');
    await Promise.all(this.hostIds.map(h => new Promise((res, rej) => {
      const child = fork(hostPath, [h], { stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
      this.children.set(h, child);
      this.pending.set(h, new Map());
      child.on('message', (m) => {
        this._measureIn(m);   // 자식→broker 방향도 직렬화 검증·계측(양방향 = "직렬화로만" 의 정직한 측정)
        if (m.hello) { this._pids.set(h, m.pid); res(); return; }
        const pend = this.pending.get(h);
        const r = pend.get(m.reqId);
        if (r) { pend.delete(m.reqId); r(m); }
      });
      child.on('error', rej);
    })));
  }
  // 직렬화 검증 — 프로세스 경계를 넘는 메시지는 순수 데이터여야(공유 참조·함수 0). 위반 시 allSerializable=false.
  _measure(msg) {
    let s;
    try { s = JSON.stringify(msg); } catch (e) { this.allSerializable = false; return; }
    if (typeof s !== 'string') { this.allSerializable = false; return; }
    this.ipcMsgs++; this.ipcBytes += s.length;
  }
  // 자식→broker 응답(sends 배열·스냅샷)도 같은 검증 — round-trip 으로 순수 데이터 확인(공유 참조 없음).
  _measureIn(m) {
    let s;
    try { s = JSON.stringify(m); } catch (e) { this.allSerializable = false; return; }
    if (typeof s !== 'string') { this.allSerializable = false; return; }
    this.ipcMsgsIn++; this.ipcBytesIn += s.length;
  }
  rpc(hostId, msg) {
    return new Promise((res) => {
      const reqId = this.reqSeq++;
      this._measure({ ...msg, reqId });
      this.pending.get(hostId).set(reqId, res);
      this.children.get(hostId).send({ ...msg, reqId });
    });
  }
  pids() { return [...this._pids.values()]; }
  async init(specsByHost) {
    await Promise.all(this.hostIds.map(h => this.rpc(h, { cmd: 'init', specs: specsByHost.get(h) || [] })));
  }
  async snapshotAll() {
    const out = new Map();
    await Promise.all(this.hostIds.map(async h => { const r = await this.rpc(h, { cmd: 'snapshot' }); out.set(h, r.snap); }));
    return out;
  }
  async shutdown() {
    await Promise.all(this.hostIds.map(h => new Promise(res => {
      const child = this.children.get(h);
      let done = false;
      const finish = () => { if (!done) { done = true; res(); } };
      child.on('exit', finish);
      try { child.send({ cmd: 'bye', reqId: this.reqSeq++ }); } catch (e) { finish(); }
      setTimeout(() => { try { child.kill(); } catch (e) { } finish(); }, 800);
    })));
  }
}

// 배치(placement): addr → hostId. 기본 = *각 서버 박스가 자기 프로세스*, 클라는 한 호스트(엣지). custom 으로 오버라이드.
function computePlacement(topo, custom) {
  const m = new Map();
  if (custom) { for (const [a, h] of Object.entries(custom)) m.set(a, h); return m; }
  for (const s of topo.specs) m.set(s.addr, s.kind === 'client' ? 'clients' : s.addr);
  return m;
}

// ── 멀티프로세스 실행 — 같은 buildTopology 로 토폴로지를 짜고 lockstep 배리어로 구동, r-like 결과 재구성 ──
async function runMulti(opts, deps) {
  const { buildTopology, Net } = deps;
  const topo = buildTopology(opts);
  const placement = computePlacement(topo, opts.placement);
  const hostIds = [...new Set([...placement.values()])];
  const specsByHost = new Map();
  for (const h of hostIds) specsByHost.set(h, []);
  for (const s of topo.specs) specsByHost.get(placement.get(s.addr)).push(s);

  const net = new Net({ transport: opts.transport || null, seed: opts.seed });
  const cluster = new Cluster(hostIds);
  await cluster.spawn();
  await cluster.init(specsByHost);

  const ticks = opts.ticks || 48;
  const order = topo.order;
  const placeOf = (addr) => placement.get(addr);

  for (let T = 0; T < ticks; T++) {
    net.tick++;
    // ── deliver phase: due 메시지를 호스트별로 묶어 원격 onMsg → 발신을 (전역 gi, 로컬 si) 순서로 재생 ──
    //   engine Net.step() 의 'due 를 순서대로 onMsg' 와 비트 동일 발신 순서를 재현(gi = due 내 전역 인덱스).
    const due = net.queue.get(net.tick) || [];
    net.queue.delete(net.tick);
    const dgroups = new Map(); let gi = 0;
    for (const m of due) {
      if (net.delivered.has(m.id)) { net.stats.dupSkipped++; continue; }
      net.delivered.add(m.id);
      const delay = net.tick - m.tick - 1; if (delay > net.stats.maxDelay) net.stats.maxDelay = delay;
      net.stats.deliveredN++;
      const h = placeOf(m.to); if (h == null) continue;   // 대상 액터 없음 → engine 의 (a&&a.onMsg) 스킵과 동치
      if (!dgroups.has(h)) dgroups.set(h, []);
      dgroups.get(h).push({ gi: gi++, m });
    }
    if (dgroups.size) {
      const res = await Promise.all([...dgroups].map(([h, items]) => cluster.rpc(h, { cmd: 'deliver', items }).then(r => r.results)));
      const sends = [];
      for (const results of res) for (const { gi, sends: ss } of results) ss.forEach((s, si) => sends.push({ gi, si, s }));
      sends.sort((a, b) => a.gi - b.gi || a.si - b.si);
      for (const { s } of sends) net.send(s.from, s.to, s.payload);
    }
    // ── tick phase: 전 액터 onTick(등록 순서) → 발신 재생. deliver 발신이 항상 먼저(engine step 의 deliver→onTick). ──
    const tgroups = new Map();
    order.forEach((addr, idx) => { const h = placeOf(addr); if (!tgroups.has(h)) tgroups.set(h, []); tgroups.get(h).push({ gi: idx, addr }); });
    const tres = await Promise.all([...tgroups].map(([h, items]) => cluster.rpc(h, { cmd: 'tick', tick: net.tick, items }).then(r => r.results)));
    const tsends = [];
    for (const results of tres) for (const { gi, sends: ss } of results) ss.forEach((s, si) => tsends.push({ gi, si, s }));
    tsends.sort((a, b) => a.gi - b.gi || a.si - b.si);
    for (const { s } of tsends) net.send(s.from, s.to, s.payload);
  }

  const snaps = await cluster.snapshotAll();
  const clusterInfo = {
    pids: cluster.pids(), parentPid: process.pid, hostIds,
    placement: [...placement.entries()],
    ipcMsgs: cluster.ipcMsgs, ipcBytes: cluster.ipcBytes,
    ipcMsgsIn: cluster.ipcMsgsIn, ipcBytesIn: cluster.ipcBytesIn,
    allSerializable: cluster.allSerializable,
  };
  await cluster.shutdown();
  return reconstruct(net, topo, snaps, placement, clusterInfo, opts);
}

// 스냅샷 → run() 과 *같은 형태*의 r(zones/clients/net.log)로 재구성 — 0009 의 digest/desync 함수가 그대로 먹는다.
function reconstruct(net, topo, snaps, placement, clusterInfo, opts) {
  const byAddr = new Map();
  for (const snap of snaps.values()) for (const addr of Object.keys(snap)) byAddr.set(addr, snap[addr]);

  const zoneProxy = (s) => ({
    addr: s.addr, region: s.region, dead: s.dead, shadow: s.shadow,
    ents: new Map(s.ents.map(([id, e]) => [id, { x: e.x, y: e.y }])),
    outbox: new Map(),
    promotionKeyframes: s.promotionKeyframes, leasesSent: s.leasesSent,
    isAuthority() { return !this.dead && !this.shadow; },
  });
  const clientProxy = (s) => {
    const seen = new Map(s.seen.map(([id, e]) => [id, { x: e.x, y: e.y }]));
    return {
      addr: s.addr, avatar: s.avatar, views: s.views, seen,
      naksSent: s.naksSent, staleDrops: s.staleDrops,
      seenIds() { return [...seen.keys()].sort(); },
      seenSig() { return [...seen.entries()].map(([id, e]) => id + '@' + e.x + ',' + e.y).sort().join(';'); },
    };
  };

  const zoneObjs = topo.zoneAddrs.map(a => zoneProxy(byAddr.get(a)));
  const followers = ['zone1f', 'zone2f'].filter(a => byAddr.get(a)).map(a => zoneProxy(byAddr.get(a)));
  const clis = topo.specs.filter(s => s.kind === 'client').map(s => clientProxy(byAddr.get(s.addr)));
  const allZones = zoneObjs.concat(followers);
  const orchSnap = byAddr.get('orch');

  const sumAll = (f) => allZones.reduce((a, z) => a + (f(z) || 0), 0);
  const totals = {
    promotions: orchSnap ? orchSnap.promotions : 0,
    promotionKeyframes: sumAll(z => z.promotionKeyframes),
    leasesSent: sumAll(z => z.leasesSent),
    naksSent: clis.reduce((a, c) => a + (c.naksSent || 0), 0),
    staleDrops: clis.reduce((a, c) => a + (c.staleDrops || 0), 0),
  };

  return {
    net, zones: zoneObjs, followers, allZones, zoneAddrs: topo.zoneAddrs, clients: clis,
    totals, H: topo.H, grid: topo.grid, radius: topo.radius,
    deathTick: opts.deathTick != null ? opts.deathTick : null, killZone: opts.killZone || 'zone1',
    orch: orchSnap ? { promotions: orchSnap.promotions, deathSeen: new Map(orchSnap.deathSeen) } : null,
    cluster: clusterInfo, mode: 'multiproc',
  };
}

module.exports = { runMulti, Cluster, computePlacement };
