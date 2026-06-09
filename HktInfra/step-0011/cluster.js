// HktInfra step-0011 — broker(코디네이터). 멀티프로세스 lockstep 배리어로 전 서버 박스를 구동한다(Node 전용).
//   step-0010 위에 *한 조각*만 더한다: broker↔host 의 **와이어를 child_process IPC 파이프 → 실 TCP 소켓**으로 현실화.
//   lockstep 배리어(runMulti 루프)·액터·broker substrate(engine/Net)는 *무변경* — 오직 전송 채널(wire)만 교체한다.
//
//   채널 추상(ChannelBase): broker↔host RPC 를 *바꿔 끼울 수 있는* 이음새.
//     · IpcChannel  — 0010 그대로(fork + child_process IPC, OS 가 메시지 경계 보존).      ← reg 0 의 "와이어 OFF" 기준
//     · TcpChannel  — 실 TCP 소켓(net.createServer/connect) + 길이-프리픽스 프레이밍.       ← 이 step 이 더한 한 조각
//       broker 가 127.0.0.1 임시 포트에 listen, host 를 *IPC 없이* spawn(순수 소켓만), host 가 TCP 로 연결해 hello.
//       바이트 스트림이므로 frame.js 로 경계 재조립 — "실 네트워크 전송"의 구체적 차이(0010 §8.2 의 후속).
//   runMulti 루프는 채널 무관 — channel.rpc(host,msg) 만 부른다. 그래서 TCP 든 IPC 든 broker.net.log 가 비트 동일(E2E 동치 보존).
'use strict';
const { fork, spawn } = require('child_process');
const net = require('net');
const path = require('path');
const { frame, FrameReader } = require('./frame.js');

// ════════════════════════════════════════════════════════════════════════
//  ChannelBase — broker↔host RPC 의 공통 골격(채널 무관). 와이어(_deliver/spawn/shutdown)만 서브클래스가 채운다.
//   전역 seq·큐·로그는 broker 의 net(전송 substrate)이 소유 — 채널은 *메시지 운반*만 한다.
// ════════════════════════════════════════════════════════════════════════
class ChannelBase {
  constructor(hostIds) {
    this.hostIds = hostIds;
    this.pending = new Map();    // hostId -> Map(reqId -> resolve)
    this.reqSeq = 0;
    this.msgsOut = 0; this.bytesOut = 0;   // broker→host 경계 통과량(out)
    this.msgsIn = 0; this.bytesIn = 0;     // host→broker(in)
    this.allSerializable = true;           // *양방향* 경계 넘는 모든 메시지가 순수 데이터(함수·심볼·순환 0)인가
    this._pids = new Map();                // hostId -> pid
    this._helloRes = new Map();            // hostId -> resolve(spawn 대기)
    for (const h of hostIds) this.pending.set(h, new Map());
  }
  // 직렬화 검증 — 경계를 넘는 메시지는 순수 데이터여야(공유 참조·함수 0). 위반 시 allSerializable=false.
  _checkSer(msg) { try { return typeof JSON.stringify(msg) === 'string'; } catch (e) { return false; } }
  // host→broker 수신 공통 처리: hello 면 pid 등록·spawn 해제, 아니면 pending reqId resolve.
  _onHostMessage(hostId, m, wireBytes) {
    if (!this._checkSer(m)) this.allSerializable = false;
    this.msgsIn++; this.bytesIn += (wireBytes != null ? wireBytes : JSON.stringify(m).length);
    if (m.hello) { this._pids.set(hostId, m.pid); const r = this._helloRes.get(hostId); if (r) r(); return; }
    const pend = this.pending.get(hostId);
    const r = pend.get(m.reqId);
    if (r) { pend.delete(m.reqId); r(m); }
  }
  rpc(hostId, msg) {
    const reqId = this.reqSeq++;
    const out = { ...msg, reqId };
    if (!this._checkSer(out)) this.allSerializable = false;
    return new Promise((res) => {
      this.pending.get(hostId).set(reqId, res);
      this._deliver(hostId, out);    // 서브클래스: 실제 와이어로 송신(계측은 _deliver 가 한다)
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
}

// ── IpcChannel — 0010 그대로(fork + child_process IPC). 와이어 "OFF" 기준(reg 0). ──
class IpcChannel extends ChannelBase {
  constructor(hostIds) { super(hostIds); this.kind = 'ipc'; this.children = new Map(); }
  async spawn() {
    const hostPath = path.join(__dirname, 'host.js');
    await Promise.all(this.hostIds.map(h => new Promise((res, rej) => {
      const child = fork(hostPath, [h, '--ipc'], { stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
      this.children.set(h, child);
      this._helloRes.set(h, res);
      child.on('message', (m) => this._onHostMessage(h, m, JSON.stringify(m).length));
      child.on('error', rej);
    })));
  }
  _deliver(hostId, obj) {
    this.msgsOut++; this.bytesOut += JSON.stringify(obj).length;
    this.children.get(hostId).send(obj);
  }
  async shutdown() {
    await Promise.all(this.hostIds.map(h => new Promise(res => {
      const child = this.children.get(h);
      let done = false; const finish = () => { if (!done) { done = true; res(); } };
      child.on('exit', finish);
      try { child.send({ cmd: 'bye', reqId: this.reqSeq++ }); } catch (e) { finish(); }
      setTimeout(() => { try { child.kill(); } catch (e) { } finish(); }, 800);
    })));
  }
  info() { return { channel: 'ipc', port: null }; }
}

// ── TcpChannel — 실 TCP 소켓 + 길이-프리픽스 프레이밍. 이 step 이 더한 한 조각. ──
//   broker 가 127.0.0.1 임시 포트에 listen → host 를 *IPC 없이* spawn(stdio 에 ipc 없음 = 순수 소켓 통신) →
//   host 가 TCP 로 연결해 hello{hostId} 로 자기를 식별. 모든 RPC 는 frame() 으로 감싸 소켓에 쓴다(바이트 스트림).
class TcpChannel extends ChannelBase {
  constructor(hostIds) { super(hostIds); this.kind = 'tcp'; this.sockets = new Map(); this.children = new Map(); this.server = null; this.port = null; this._remote = new Map(); }
  async spawn() {
    // 1) broker 가 먼저 listen(임시 포트) — host 가 연결할 주소 확보.
    await new Promise((res) => {
      this.server = net.createServer((sock) => {
        sock.setNoDelay(true);
        let boundHost = null;
        const reader = new FrameReader((m, wireBytes) => {
          if (m.hello) { boundHost = m.hostId; this.sockets.set(boundHost, sock); this._remote.set(boundHost, sock.remotePort); }
          this._onHostMessage(boundHost, m, wireBytes);
        });
        sock.on('data', (chunk) => reader.push(chunk));
        sock.on('error', () => { });
      });
      this.server.listen(0, '127.0.0.1', () => { this.port = this.server.address().port; res(); });
    });
    // 2) host 를 IPC 없이 spawn — stdio 에 'ipc' 가 없으므로 통신은 *오직 TCP 소켓*뿐(진짜 소켓 분리).
    const hostPath = path.join(__dirname, 'host.js');
    await Promise.all(this.hostIds.map(h => new Promise((res, rej) => {
      this._helloRes.set(h, res);
      const child = spawn(process.execPath, [hostPath, h, '--tcp'], {
        stdio: ['ignore', 'inherit', 'inherit'],   // ipc 없음 — 순수 소켓
        env: { ...process.env, HKT_BROKER_PORT: String(this.port), HKT_HOST_ID: h },
      });
      this.children.set(h, child);
      child.on('error', rej);
    })));
  }
  _deliver(hostId, obj) {
    const buf = frame(obj);
    this.msgsOut++; this.bytesOut += buf.length;   // *실제 와이어 바이트*(헤더 4 + 본문)
    const sock = this.sockets.get(hostId);
    if (sock) sock.write(buf);
  }
  async shutdown() {
    await Promise.all(this.hostIds.map(h => new Promise(res => {
      const child = this.children.get(h);
      let done = false; const finish = () => { if (!done) { done = true; res(); } };
      child.on('exit', finish);
      try { this.sockets.get(h).write(frame({ cmd: 'bye', reqId: this.reqSeq++ })); } catch (e) { finish(); }
      setTimeout(() => { try { child.kill(); } catch (e) { } finish(); }, 800);
    })));
    try { this.server.close(); } catch (e) { }
  }
  info() { return { channel: 'tcp', port: this.port, remotePorts: [...this._remote.values()] }; }
}

function makeChannel(kind, hostIds) {
  return kind === 'tcp' ? new TcpChannel(hostIds) : new IpcChannel(hostIds);
}

// 배치(placement): addr → hostId. 기본 = *각 서버 박스가 자기 프로세스*, 클라는 한 호스트(엣지). custom 으로 오버라이드.
function computePlacement(topo, custom) {
  const m = new Map();
  if (custom) { for (const [a, h] of Object.entries(custom)) m.set(a, h); return m; }
  for (const s of topo.specs) m.set(s.addr, s.kind === 'client' ? 'clients' : s.addr);
  return m;
}

// ── 멀티프로세스 실행 — 같은 buildTopology 로 토폴로지를 짜고 lockstep 배리어로 구동(채널 무관) ──
async function runMulti(opts, deps) {
  const { buildTopology, Net } = deps;
  const channelKind = opts.channel || 'ipc';   // 기본 ipc(0010 와이어) — 'tcp' 면 실 소켓. reg 0 = ipc/inproc 기준.
  const topo = buildTopology(opts);
  const placement = computePlacement(topo, opts.placement);
  const hostIds = [...new Set([...placement.values()])];
  const specsByHost = new Map();
  for (const h of hostIds) specsByHost.set(h, []);
  for (const s of topo.specs) specsByHost.get(placement.get(s.addr)).push(s);

  const net = new Net({ transport: opts.transport || null, seed: opts.seed });
  const ch = makeChannel(channelKind, hostIds);
  await ch.spawn();
  await ch.init(specsByHost);

  const ticks = opts.ticks || 48;
  const order = topo.order;
  const placeOf = (addr) => placement.get(addr);

  for (let T = 0; T < ticks; T++) {
    net.tick++;
    // ── deliver phase: due 메시지를 호스트별로 묶어 원격 onMsg → 발신을 (전역 gi, 로컬 si) 순서로 재생 ──
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
      const res = await Promise.all([...dgroups].map(([h, items]) => ch.rpc(h, { cmd: 'deliver', items }).then(r => r.results)));
      const sends = [];
      for (const results of res) for (const { gi, sends: ss } of results) ss.forEach((s, si) => sends.push({ gi, si, s }));
      sends.sort((a, b) => a.gi - b.gi || a.si - b.si);
      for (const { s } of sends) net.send(s.from, s.to, s.payload);
    }
    // ── tick phase: 전 액터 onTick(등록 순서) → 발신 재생. deliver 발신이 항상 먼저(engine step 의 deliver→onTick). ──
    const tgroups = new Map();
    order.forEach((addr, idx) => { const h = placeOf(addr); if (!tgroups.has(h)) tgroups.set(h, []); tgroups.get(h).push({ gi: idx, addr }); });
    const tres = await Promise.all([...tgroups].map(([h, items]) => ch.rpc(h, { cmd: 'tick', tick: net.tick, items }).then(r => r.results)));
    const tsends = [];
    for (const results of tres) for (const { gi, sends: ss } of results) ss.forEach((s, si) => tsends.push({ gi, si, s }));
    tsends.sort((a, b) => a.gi - b.gi || a.si - b.si);
    for (const { s } of tsends) net.send(s.from, s.to, s.payload);
  }

  const snaps = await ch.snapshotAll();
  const chInfo = ch.info();
  const clusterInfo = {
    pids: ch.pids(), parentPid: process.pid, hostIds,
    placement: [...placement.entries()],
    channel: chInfo.channel, port: chInfo.port, remotePorts: chInfo.remotePorts || null,
    // 경계 통과량(out/in) — 채널 무관 이름. tcp 는 *실제 와이어 바이트*(프레임 헤더 포함), ipc 는 JSON 길이.
    ipcMsgs: ch.msgsOut, ipcBytes: ch.bytesOut, ipcMsgsIn: ch.msgsIn, ipcBytesIn: ch.bytesIn,
    allSerializable: ch.allSerializable,
  };
  await ch.shutdown();
  return reconstruct(net, topo, snaps, placement, clusterInfo, opts);
}

// 스냅샷 → run() 과 *같은 형태*의 r(zones/clients/net.log)로 재구성 — 0009/0010 의 digest/desync 함수가 그대로 먹는다.
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

module.exports = { runMulti, ChannelBase, IpcChannel, TcpChannel, makeChannel, computePlacement };
