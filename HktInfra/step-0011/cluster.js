// HktInfra step-0011 — broker(코디네이터). 멀티프로세스 lockstep 배리어를 *실 TCP 소켓* 위에서 구동한다(Node 전용).
//   0010 대비 *와이어만* 바뀐다: child_process.fork 의 내장 IPC 채널 → child_process.spawn(IPC 0) + 실 TCP 소켓.
//   broker 는 TCP 서버로 떠서(ephemeral 포트) 각 호스트의 역(逆)연결을 받고, *길이-프리픽스 프레이밍*된 JSON
//   메시지로만 deliver/tick/snapshot 을 원격 디스패치한다. fork 의 메시지-프레임 IPC 와 달리 TCP 는 바이트 스트림이라
//   프레이밍으로 메시지 경계를 복원한다(실 와이어의 첫 현실 문제). 배리어·발신 순서 보존 로직은 0010 그대로 →
//   broker.net.log 가 인프로세스와 비트 동일(실 소켓 위에서도 E2E 동치). 공유 메모리 0 — 와이어=소켓 바이트뿐.
'use strict';
const net = require('net');
const { spawn } = require('child_process');
const path = require('path');

// ── 길이-프리픽스 프레이밍 — TCP 바이트 스트림에서 메시지 경계 복원([4바이트 BE 길이][UTF-8 JSON]). ──
//   fork IPC 는 메시지 경계를 내장하지만 TCP 는 스트림이라 직접 프레이밍해야 한다(실 와이어의 첫 현실 문제).
function frameOf(obj) {
  const json = Buffer.from(JSON.stringify(obj), 'utf8');
  const hdr = Buffer.allocUnsafe(4);
  hdr.writeUInt32BE(json.length, 0);
  return { buf: Buffer.concat([hdr, json]), bytes: 4 + json.length };
}
// 들어오는 청크를 누적해 완성된 프레임마다 onMsg(obj) 호출. 청크가 프레임 중간에 끊겨도 안전(스트림 재조립).
class Framer {
  constructor(onMsg) { this.buf = Buffer.alloc(0); this.onMsg = onMsg; }
  push(chunk) {
    this.buf = this.buf.length ? Buffer.concat([this.buf, chunk]) : chunk;
    while (this.buf.length >= 4) {
      const len = this.buf.readUInt32BE(0);
      if (this.buf.length < 4 + len) break;       // 프레임 미완 — 다음 청크 대기
      const json = this.buf.toString('utf8', 4, 4 + len);
      this.buf = this.buf.subarray(4 + len);
      this.onMsg(JSON.parse(json));
    }
  }
}

class Cluster {
  constructor(hostIds) {
    this.hostIds = hostIds;
    this.socks = new Map();      // hostId -> net.Socket
    this.pending = new Map();    // hostId -> Map(reqId -> resolve)
    this.reqSeq = 0;
    this.frames = 0;             // broker→host 프레임 수(out)
    this.bytes = 0;              // out 와이어 바이트 합(프레임 헤더 포함)
    this.framesIn = 0;           // host→broker 프레임 수(in)
    this.bytesIn = 0;            // in 와이어 바이트 합
    this.allSerializable = true; // *양방향* 경계 넘는 모든 메시지가 순수 데이터(함수·심볼·순환 0)인가
    this._pids = new Map();      // hostId -> pid
    this.server = null;
    this.port = 0;
    this.children = new Map();   // hostId -> child process
  }
  // TCP 서버 기동(ephemeral 포트) → 각 호스트 프로세스 spawn(IPC 채널 0, 포트를 argv 로 전달) → 역연결·hello 대기.
  async spawn() {
    const hostPath = path.join(__dirname, 'host.js');
    await new Promise((res) => {
      this.server = net.createServer((sock) => this._onConnection(sock));
      this.server.listen(0, '127.0.0.1', () => { this.port = this.server.address().port; res(); });
    });
    await Promise.all(this.hostIds.map(h => new Promise((res, rej) => {
      // spawn(not fork): IPC 채널을 *만들지 않는다* — 유일한 통신 경로는 TCP 소켓. stdio 는 부모로 상속.
      const child = spawn(process.execPath, [hostPath, h, String(this.port)], { stdio: ['ignore', 'inherit', 'inherit'] });
      this.children.set(h, child);
      this.pending.set(h, new Map());
      child.on('error', rej);
      this._helloRes = this._helloRes || new Map();
      this._helloRes.set(h, res);
    })));
  }
  // 역연결 소켓 — 첫 프레임(hello)으로 hostId 를 식별해 매핑. 이후 프레임은 reqId 로 pending 해소.
  _onConnection(sock) {
    sock.setNoDelay(true);
    const framer = new Framer((m) => {
      this._measureIn(m);     // 자식→broker 방향도 직렬화 검증·계측(양방향 = "직렬화로만" 의 정직한 측정)
      if (m.hello) {
        const h = m.hostId;
        this.socks.set(h, sock);
        this._pids.set(h, m.pid);
        const r = this._helloRes && this._helloRes.get(h);
        if (r) r();
        return;
      }
      const pend = this.pending.get(m.hostId);
      const r = pend && pend.get(m.reqId);
      if (r) { pend.delete(m.reqId); r(m); }
    });
    sock.on('data', (c) => framer.push(c));
    sock.on('error', () => { });
  }
  // 직렬화 검증·계측 — 경계를 넘는 메시지는 순수 데이터여야(공유 참조·함수 0). frameOf 가 JSON.stringify 를 강제한다.
  _send(hostId, msg) {
    let f;
    try { f = frameOf(msg); } catch (e) { this.allSerializable = false; return; }
    this.frames++; this.bytes += f.bytes;
    this.socks.get(hostId).write(f.buf);
  }
  _measureIn(m) {
    let s;
    try { s = JSON.stringify(m); } catch (e) { this.allSerializable = false; return; }
    if (typeof s !== 'string') { this.allSerializable = false; return; }
    this.framesIn++; this.bytesIn += 4 + Buffer.byteLength(s, 'utf8');
  }
  rpc(hostId, msg) {
    return new Promise((res) => {
      const reqId = this.reqSeq++;
      this.pending.get(hostId).set(reqId, res);
      this._send(hostId, { ...msg, reqId, hostId });
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
      if (child) child.on('exit', finish);
      try { this._send(h, { cmd: 'bye', reqId: this.reqSeq++, hostId: h }); } catch (e) { finish(); }
      setTimeout(() => { try { child && child.kill(); } catch (e) { } finish(); }, 800);
    })));
    await new Promise(res => { if (this.server) this.server.close(() => res()); else res(); });
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
//   배리어·발신 순서 보존 로직은 0010 그대로 — 와이어(rpc)만 fork IPC → TCP 소켓 프레임.
async function runMulti(opts, deps) {
  const { buildTopology, Net } = deps;
  const topo = buildTopology(opts);
  const placement = computePlacement(topo, opts.placement);
  const hostIds = [...new Set([...placement.values()])];
  const specsByHost = new Map();
  for (const h of hostIds) specsByHost.set(h, []);
  for (const s of topo.specs) specsByHost.get(placement.get(s.addr)).push(s);

  const net_ = new Net({ transport: opts.transport || null, seed: opts.seed });
  const cluster = new Cluster(hostIds);
  await cluster.spawn();
  await cluster.init(specsByHost);

  const ticks = opts.ticks || 48;
  const order = topo.order;
  const placeOf = (addr) => placement.get(addr);

  for (let T = 0; T < ticks; T++) {
    net_.tick++;
    // ── deliver phase: due 메시지를 호스트별로 묶어 원격 onMsg → 발신을 (전역 gi, 로컬 si) 순서로 재생 ──
    const due = net_.queue.get(net_.tick) || [];
    net_.queue.delete(net_.tick);
    const dgroups = new Map(); let gi = 0;
    for (const m of due) {
      if (net_.delivered.has(m.id)) { net_.stats.dupSkipped++; continue; }
      net_.delivered.add(m.id);
      const delay = net_.tick - m.tick - 1; if (delay > net_.stats.maxDelay) net_.stats.maxDelay = delay;
      net_.stats.deliveredN++;
      const h = placeOf(m.to); if (h == null) continue;   // 대상 액터 없음 → engine 의 (a&&a.onMsg) 스킵과 동치
      if (!dgroups.has(h)) dgroups.set(h, []);
      dgroups.get(h).push({ gi: gi++, m });
    }
    if (dgroups.size) {
      const res = await Promise.all([...dgroups].map(([h, items]) => cluster.rpc(h, { cmd: 'deliver', items }).then(r => r.results)));
      const sends = [];
      for (const results of res) for (const { gi, sends: ss } of results) ss.forEach((s, si) => sends.push({ gi, si, s }));
      sends.sort((a, b) => a.gi - b.gi || a.si - b.si);
      for (const { s } of sends) net_.send(s.from, s.to, s.payload);
    }
    // ── tick phase: 전 액터 onTick(등록 순서) → 발신 재생. deliver 발신이 항상 먼저(engine step 의 deliver→onTick). ──
    const tgroups = new Map();
    order.forEach((addr, idx) => { const h = placeOf(addr); if (!tgroups.has(h)) tgroups.set(h, []); tgroups.get(h).push({ gi: idx, addr }); });
    const tres = await Promise.all([...tgroups].map(([h, items]) => cluster.rpc(h, { cmd: 'tick', tick: net_.tick, items }).then(r => r.results)));
    const tsends = [];
    for (const results of tres) for (const { gi, sends: ss } of results) ss.forEach((s, si) => tsends.push({ gi, si, s }));
    tsends.sort((a, b) => a.gi - b.gi || a.si - b.si);
    for (const { s } of tsends) net_.send(s.from, s.to, s.payload);
  }

  const snaps = await cluster.snapshotAll();
  const clusterInfo = {
    pids: cluster.pids(), parentPid: process.pid, hostIds,
    placement: [...placement.entries()],
    port: cluster.port,
    // 0010 호환 키(ipcMsgs/ipcBytes) 유지 + 와이어 의미 별칭(frames/socketBytes) — run.js·report 가 그대로 먹음.
    ipcMsgs: cluster.frames, ipcBytes: cluster.bytes,
    ipcMsgsIn: cluster.framesIn, ipcBytesIn: cluster.bytesIn,
    frames: cluster.frames, socketBytes: cluster.bytes,
    framesIn: cluster.framesIn, socketBytesIn: cluster.bytesIn,
    allSerializable: cluster.allSerializable, wire: 'tcp-socket',
  };
  await cluster.shutdown();
  return reconstruct(net_, topo, snaps, placement, clusterInfo, opts);
}

// 스냅샷 → run() 과 *같은 형태*의 r(zones/clients/net.log)로 재구성 — 0010 의 digest/desync 함수가 그대로 먹는다.
function reconstruct(net_, topo, snaps, placement, clusterInfo, opts) {
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
    net: net_, zones: zoneObjs, followers, allZones, zoneAddrs: topo.zoneAddrs, clients: clis,
    totals, H: topo.H, grid: topo.grid, radius: topo.radius,
    deathTick: opts.deathTick != null ? opts.deathTick : null, killZone: opts.killZone || 'zone1',
    orch: orchSnap ? { promotions: orchSnap.promotions, deathSeen: new Map(orchSnap.deathSeen) } : null,
    cluster: clusterInfo, mode: 'multiproc',
  };
}

module.exports = { runMulti, Cluster, computePlacement, frameOf, Framer };
