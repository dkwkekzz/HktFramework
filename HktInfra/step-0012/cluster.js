// HktInfra step-0012 — broker(버스 허브). 멀티프로세스 lockstep 배리어를 *토픽 pub/sub 버스* 위에서 구동한다(Node 전용).
//   0011 대비 *버스·열화만* 바뀐다(배리어·발신 순서 보존 로직은 0011 그대로):
//     ① 버스 분산 — 0011 의 직접 소켓 주소지정(socks.get(host).write)을 *토픽 발행/구독*으로 대체한다. 호스트는
//        자기 토픽(cmd.<hostId>)을 구독하고, broker 는 그 토픽으로 *발행*한다(호스트 소켓을 직접 모름). 호스트는
//        결과를 res 토픽으로 발행하고 broker 가 구독한다. 같은 토픽에 소비자(tap)를 *발행자 무수정*으로 더할 수 있다.
//     ② 열화 내성 — 버스 링크에 (a) *시드 프레임 드롭* + seq/ack/resend(호스트 reqId 멱등) → 전송 무손실처럼 비트 동일,
//        (b) *결정론 분단 윈도*(권위 호스트 링크를 t0 부터 침묵) = 0009 추상 사망을 *소켓 분단*으로 현실화 → orch lease
//        가 침묵 감지·failover 승격, (c) *재연결+펜싱*(분단 호스트 복귀 시 와이어 펜스로 출력 수용 0 → split-brain 없음).
//   broker.net.log(발신 substrate)가 인프로세스와 비트 동일(분단=죽음). 공유 메모리 0 — 와이어=소켓 바이트뿐.
'use strict';
const net = require('net');
const { spawn } = require('child_process');
const path = require('path');
const { mulberry32 } = require('../engine/index.js');

// ── 길이-프리픽스 프레이밍 — TCP 바이트 스트림에서 메시지 경계 복원([4바이트 BE 길이][UTF-8 JSON]). 0011 그대로. ──
function frameOf(obj) {
  const json = Buffer.from(JSON.stringify(obj), 'utf8');
  const hdr = Buffer.allocUnsafe(4);
  hdr.writeUInt32BE(json.length, 0);
  return { buf: Buffer.concat([hdr, json]), bytes: 4 + json.length };
}
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

// ════════════════════════════════════════════════════════════════════════
//  Cluster — broker 가 소유하는 *버스 허브*. 토픽 pub/sub + 링크 열화(드롭·분단·재연결 펜싱).
//   0011 의 Cluster(직접 소켓 rpc)를 토픽 버스로 재배선했다. 배리어는 여전히 reqId 로 요청/응답을 상관.
// ════════════════════════════════════════════════════════════════════════
class Cluster {
  constructor(hostIds, wire = null) {
    this.hostIds = hostIds;
    this.socks = new Map();       // hostId -> net.Socket (res 토픽 상관·구독 등록용)
    this.subs = new Map();        // topic -> Set<sock>  (pub/sub 라우팅 테이블 — 직접 주소지정 대체)
    this.taps = new Map();        // topic -> [fn]       (발행자 무수정 in-broker 소비자)
    this.pending = new Map();     // hostId -> Map(reqId -> {resolve, frame, attempts})
    this.reqSeq = 0;
    this.frames = 0;              // broker→host 발행 프레임 수(out, 와이어 위 실제 write)
    this.bytes = 0;               // out 와이어 바이트(헤더 포함)
    this.framesIn = 0;            // host→broker 프레임 수(in)
    this.bytesIn = 0;             // in 와이어 바이트
    this.publishes = 0;           // 발행 호출 수(드롭 전 — 토픽 라우팅 단위)
    this.tapDeliveries = 0;       // tap 소비자에게 전달된 사본 수
    this.allSerializable = true;  // *양방향* 경계 메시지가 순수 데이터(함수·심볼·순환 0)인가
    this._pids = new Map();       // hostId -> pid
    this.server = null;
    this.port = 0;
    this.children = new Map();    // hostId -> child process
    // ── 열화 ──
    this.wire = wire;             // { drop, dropSeed, partition:{host,at,until}, resendMs }
    this.drng = wire ? mulberry32(((wire.dropSeed || 0) ^ 0x5E1FD30B) >>> 0) : null;
    this.dropped = 0;             // 드롭된 cmd 프레임 수(재전송 유발)
    this.resends = 0;             // 재전송 횟수
    this.fencedHost = null;       // 재연결 후 펜싱된 호스트(출력 수용 0 — split-brain 방지)
    this.fencedAttempts = 0;      // 분단 동안 침묵 처리된 호스트-tick 수(failover 유발 회계)
    this.reconnectedAlive = false;// 분단 후 호스트가 살아 응답(펜스 ack)했는가
    this.resendMs = (wire && wire.resendMs) || 8;
  }

  // TCP 서버 기동 → 각 호스트 spawn(IPC 0) → 역연결·hello·자기 토픽 구독 대기.
  async spawn() {
    const hostPath = path.join(__dirname, 'host.js');
    await new Promise((res) => {
      this.server = net.createServer((sock) => this._onConnection(sock));
      this.server.listen(0, '127.0.0.1', () => { this.port = this.server.address().port; res(); });
    });
    await Promise.all(this.hostIds.map(h => new Promise((res, rej) => {
      const child = spawn(process.execPath, [hostPath, h, String(this.port)], { stdio: ['ignore', 'inherit', 'inherit'] });
      this.children.set(h, child);
      this.pending.set(h, new Map());
      child.on('error', rej);
      this._helloRes = this._helloRes || new Map();
      this._helloRes.set(h, res);
    })));
  }

  // 역연결 소켓 — 첫 프레임(hello)으로 hostId 식별, subscribe 프레임으로 토픽 구독, 그 외는 res(reqId) 해소.
  _onConnection(sock) {
    sock.setNoDelay(true);
    const framer = new Framer((m) => {
      this._measureIn(m);                 // 양방향 직렬화 검증·계측
      if (m.hello) {
        const h = m.hostId;
        this.socks.set(h, sock);
        this._pids.set(h, m.pid);
        this._subscribe('cmd.' + h, sock);   // 연결의 명령 토픽 구독(hello 와 동일 프레임 순서 — init 발행 전 보장)
        const r = this._helloRes && this._helloRes.get(h);
        if (r) r();
        return;
      }
      if (m.subscribe) { this._subscribe(m.subscribe, sock); return; }   // 호스트가 자기 토픽 구독
      // res 토픽 — reqId 로 pending 해소(상관)
      const pend = this.pending.get(m.hostId);
      const rec = pend && pend.get(m.reqId);
      if (rec) { pend.delete(m.reqId); rec.resolve(m); }
    });
    sock.on('data', (c) => framer.push(c));
    sock.on('error', () => { });
  }
  _subscribe(topic, sock) { if (!this.subs.has(topic)) this.subs.set(topic, new Set()); this.subs.get(topic).add(sock); }
  // 발행자 무수정 소비자 추가 — 같은 토픽 프레임 사본을 in-broker fn 으로 받는다(별 프로세스 구독자의 경량 대역).
  tap(topic, fn) { if (!this.taps.has(topic)) this.taps.set(topic, []); this.taps.get(topic).push(fn); }

  // ── 토픽 발행 — 구독 소켓 전부 + tap 소비자에게 사본. 드롭 결정은 여기(링크 열화). ──
  _publish(topic, msg, opts = {}) {
    this.publishes++;
    // tap 소비자(발행자 무수정) — 드롭과 무관히 관찰(수동 소비자)
    const taps = this.taps.get(topic);
    if (taps) for (const fn of taps) { this.tapDeliveries++; try { fn(msg); } catch (e) { } }
    let f;
    try { f = frameOf(msg); } catch (e) { this.allSerializable = false; return false; }
    // 링크 드롭(전송 열화) — 결정론 시드. 드롭되면 write 안 함(재전송이 메움).
    if (this.wire && this.wire.drop && opts.dropable && (this.drng() % 1000) < Math.floor(this.wire.drop * 1000)) {
      this.dropped++;
      return false;
    }
    const socks = this.subs.get(topic);
    if (!socks || !socks.size) return false;
    this.frames++; this.bytes += f.bytes;
    for (const s of socks) s.write(f.buf);
    return true;
  }
  _measureIn(m) {
    let s;
    try { s = JSON.stringify(m); } catch (e) { this.allSerializable = false; return; }
    if (typeof s !== 'string') { this.allSerializable = false; return; }
    this.framesIn++; this.bytesIn += 4 + Buffer.byteLength(s, 'utf8');
  }

  // rpc — 호스트 토픽(cmd.<host>)으로 발행하고 res(reqId) 응답을 기다린다. 드롭 시 재전송(호스트 reqId 멱등).
  rpc(hostId, msg) {
    return new Promise((resolve) => {
      const reqId = this.reqSeq++;
      const frame = { ...msg, reqId, hostId };
      const rec = { resolve, frame, attempts: 0 };
      this.pending.get(hostId).set(reqId, rec);
      this._deliverRpc(hostId, reqId, rec);
    });
  }
  _deliverRpc(hostId, reqId, rec) {
    rec.attempts++;
    const ok = this._publish('cmd.' + hostId, rec.frame, { dropable: true });
    // 열화 모드: cmd 또는 res 가 드롭될 수 있으니 응답 미수신 시 재전송(reqId 멱등). 캡으로 무한 방지.
    if (this.wire && this.wire.drop) {
      const cap = 60;
      setTimeout(() => {
        const pend = this.pending.get(hostId);
        if (pend && pend.has(reqId) && rec.attempts < cap) { this.resends++; this._deliverRpc(hostId, reqId, rec); }
      }, this.resendMs);
    }
    return ok;
  }

  pids() { return [...this._pids.values()]; }
  async init(specsByHost) {
    await Promise.all(this.hostIds.map(h => this.rpc(h, { cmd: 'init', specs: specsByHost.get(h) || [] })));
  }
  // 와이어 펜스 — 분단 호스트가 복귀(살아 있음)해도 broker 가 그 액터를 dead 로 못박아 출력 수용 0(split-brain 방지).
  //   game 메시지(net_) 가 아닌 *제어 평면* 와이어 명령 → broker.net.log 불변(분단=죽음 비트 동일 보존).
  async fence(hostId, addr) {
    const r = await this.rpc(hostId, { cmd: 'fence', addr });
    this.reconnectedAlive = !!(r && r.fenced);   // 응답 = 호스트가 살아 펜스를 받았다(재연결 후 생존 증거)
    this.fencedHost = hostId;
    return r;
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
      try { this._publish('cmd.' + h, { cmd: 'bye', reqId: this.reqSeq++, hostId: h }); } catch (e) { finish(); }
      setTimeout(() => { try { child && child.kill(); } catch (e) { } finish(); }, 800);
    })));
    await new Promise(res => { if (this.server) this.server.close(() => res()); else res(); });
  }
}

// 배치(placement): addr → hostId. 기본 = 각 서버 박스가 자기 프로세스, 클라는 한 호스트(엣지). 0011 그대로.
function computePlacement(topo, custom) {
  const m = new Map();
  if (custom) { for (const [a, h] of Object.entries(custom)) m.set(a, h); return m; }
  for (const s of topo.specs) m.set(s.addr, s.kind === 'client' ? 'clients' : s.addr);
  return m;
}

// ── 멀티프로세스 실행 — 같은 buildTopology, lockstep 배리어로 구동(0011 그대로). 와이어(버스·열화)만 교체. ──
async function runMulti(opts, deps) {
  const { buildTopology, Net } = deps;
  const topo = buildTopology(opts);
  const placement = computePlacement(topo, opts.placement);
  const hostIds = [...new Set([...placement.values()])];
  const specsByHost = new Map();
  for (const h of hostIds) specsByHost.set(h, []);
  for (const s of topo.specs) specsByHost.get(placement.get(s.addr)).push(s);

  const net_ = new Net({ transport: opts.transport || null, seed: opts.seed });
  const cluster = new Cluster(hostIds, opts.wire || null);
  await cluster.spawn();
  await cluster.init(specsByHost);
  if (opts.tap) for (const t of opts.tap) cluster.tap(t.topic, t.fn);   // 발행자 무수정 소비자(검증용)

  const ticks = opts.ticks || 48;
  const order = topo.order;
  const placeOf = (addr) => placement.get(addr);

  // ── 분단(열화 (b)) — 권위 호스트 링크를 at 부터 침묵(=0009 추상 사망의 소켓-층 현실화). ──
  //   deliver 는 T<=at 까지 정상(인프로세스 사망이 onTick 에서 설정되므로 at tick deliver 는 아직 생존),
  //   tick 은 T<at 까지 정상(at 부터 침묵 = 사망 액터 onTick early-return 과 0 발신 동치). 한 번 분단되면 끝까지 침묵.
  const part = opts.wire && opts.wire.partition ? opts.wire.partition : null;
  const partHost = part ? placeOf(part.host) : null;
  const silentDeliver = (host, T) => part && host === partHost && T > part.at;
  const silentTick = (host, T) => part && host === partHost && T >= part.at;

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
      const h = placeOf(m.to); if (h == null) continue;
      if (silentDeliver(h, net_.tick)) { cluster.fencedAttempts++; continue; }   // 분단 링크 — 배달 안 함(사망 액터 ignore 동치)
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
    // ── tick phase: 전 액터 onTick(등록 순서) → 발신 재생. 분단 호스트는 침묵(skip = 사망 onTick 동치). ──
    const tgroups = new Map();
    order.forEach((addr, idx) => {
      const h = placeOf(addr);
      if (silentTick(h, net_.tick)) { cluster.fencedAttempts++; return; }
      if (!tgroups.has(h)) tgroups.set(h, []);
      tgroups.get(h).push({ gi: idx, addr });
    });
    const tres = await Promise.all([...tgroups].map(([h, items]) => cluster.rpc(h, { cmd: 'tick', tick: net_.tick, items }).then(r => r.results)));
    const tsends = [];
    for (const results of tres) for (const { gi, sends: ss } of results) ss.forEach((s, si) => tsends.push({ gi, si, s }));
    tsends.sort((a, b) => a.gi - b.gi || a.si - b.si);
    for (const { s } of tsends) net_.send(s.from, s.to, s.payload);
  }

  // ── 재연결+펜싱(열화 (c)) — 분단 호스트가 복귀(살아 있음)해도 펜스로 출력 수용 0. 액터를 dead 로 못박아 split-brain 방지. ──
  if (part) await cluster.fence(partHost, part.host);

  const snaps = await cluster.snapshotAll();
  const clusterInfo = {
    pids: cluster.pids(), parentPid: process.pid, hostIds,
    placement: [...placement.entries()],
    port: cluster.port,
    // 0010/0011 호환 키(ipcMsgs/ipcBytes) 유지 + 와이어 별칭(frames/socketBytes) — run.js·report 가 그대로 먹음.
    ipcMsgs: cluster.frames, ipcBytes: cluster.bytes,
    ipcMsgsIn: cluster.framesIn, ipcBytesIn: cluster.bytesIn,
    frames: cluster.frames, socketBytes: cluster.bytes,
    framesIn: cluster.framesIn, socketBytesIn: cluster.bytesIn,
    allSerializable: cluster.allSerializable, wire: 'topic-bus',
    // 버스·열화 계측
    publishes: cluster.publishes, topics: [...cluster.subs.keys()], tapDeliveries: cluster.tapDeliveries,
    dropped: cluster.dropped, resends: cluster.resends,
    partitionHost: part ? part.host : null, partitionAt: part ? part.at : null,
    fencedHost: cluster.fencedHost, reconnectedAlive: cluster.reconnectedAlive, fencedAttempts: cluster.fencedAttempts,
  };
  await cluster.shutdown();
  return reconstruct(net_, topo, snaps, placement, clusterInfo, opts);
}

// 스냅샷 → run() 과 같은 형태의 r 로 재구성(0011 그대로) + 분단 호스트 존을 dead 로 표기(펜싱 결과 = 비권위).
function reconstruct(net_, topo, snaps, placement, clusterInfo, opts) {
  const byAddr = new Map();
  for (const snap of snaps.values()) for (const addr of Object.keys(snap)) byAddr.set(addr, snap[addr]);
  const partAddr = clusterInfo.partitionHost;   // 분단된 권위 존 — 펜싱되어 비권위(소유자=1 보존)

  const zoneProxy = (s) => ({
    addr: s.addr, region: s.region, dead: s.dead || s.addr === partAddr, shadow: s.shadow,
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
