// HktInfra step-0016 — 호스트(자식 프로세스) 진입점. child_process.spawn 으로 띄워지는 *독립 OS 프로세스*.
//   0015 대비 *이벤트 버스(bus)·감사(audit) 스냅샷만* 더한다(채팅·가방·버스 전송·멱등·펜스·loadstate 는 0015 그대로):
//     bus = 자기 OS 프로세스에 사는 ServiceBus 액터(토픽→구독자 라우팅 테이블 — pub/sub 의미의 SSOT). audit = 발행자
//     무수정으로 추가된 새 소비자(관찰 스트림·발신 0). snapshotActor 가 라우팅 테이블·발행/팬아웃 회계·관찰 스트림을
//     직렬화해 broker reconstruct 로 넘긴다(둘 다 존을 우회 — 신성한 tick 밖).
//   (이하 0015 그대로) 0014 대비 *채팅 서비스(chat) 스냅샷*:
//     chat = 자기 OS 프로세스에 사는 ChatService 액터(구독 라우팅 테이블·byAvatar 역인덱스·deliveries). snapshotActor 가
//     구독 테이블·역인덱스·deliveries·팬아웃 계측을 직렬화해 broker reconstruct 로 넘긴다(존을 우회 — 신성한 tick 밖 서비스).
//   (이하 0014 그대로) 0013 대비 *가방 서비스(inventory) 스냅샷*:
//     inventory = 자기 OS 프로세스에 사는 InventoryService 액터(원장 Map·byOwner 역인덱스). snapshotActor 가 원장·
//     역인덱스·mint/transfer 계측을 직렬화해 broker reconstruct 로 넘긴다(존을 우회 — 신성한 tick 밖 서비스).
//   (이하 0013 그대로) 0012 대비 *재-provisioning 상태 동기(loadstate)만* 더한다(버스·멱등·펜스는 0012 그대로):
//     ① 버스 — hello 후 자기 명령 토픽(cmd.<hostId>)을 broker 에 구독 통보. broker 는 그 토픽으로 발행한다.
//     ② 멱등(열화 정합) — 링크 드롭 시 broker 가 cmd 를 재전송하므로, *reqId 별 응답 캐시*로 중복 reqId 는
//        재실행 없이 캐시 응답만 회신(deliver/tick 이중 적용 방지). 멱등이 ack/resend 신뢰성의 호스트 반쪽.
//     ③ 펜스(재연결 split-brain 방지) — broker 의 fence 명령에 해당 액터를 dead 로 못박고 {fenced:true} 회신.
//     ④ loadstate(재-provisioning, 0013 신규) — broker 가 *런 중 새로 spawn 한* standby 호스트에 권위 스냅샷을
//        주입해 상태 동기(ents/sessions). 이후 권위 입력을 미러받아 핫 standby 로 복제(N≥2 복원·divergence 0).
//   진짜 kill 은 broker 의 child.kill(SIGKILL) — 호스트는 소켓 close 로 *사라질* 뿐, 자기 죽음을 다루지 않는다.
//   spawn 이라 IPC 채널 0 — 유일한 통신 경로는 broker TCP 포트로의 역연결 소켓(길이-프리픽스 프레이밍).
'use strict';
const net = require('net');
const NET = require('./net-core.js');

function frameOf(obj) {
  const json = Buffer.from(JSON.stringify(obj), 'utf8');
  const hdr = Buffer.allocUnsafe(4);
  hdr.writeUInt32BE(json.length, 0);
  return Buffer.concat([hdr, json]);
}
class Framer {
  constructor(onMsg) { this.buf = Buffer.alloc(0); this.onMsg = onMsg; }
  push(chunk) {
    this.buf = this.buf.length ? Buffer.concat([this.buf, chunk]) : chunk;
    while (this.buf.length >= 4) {
      const len = this.buf.readUInt32BE(0);
      if (this.buf.length < 4 + len) break;
      const json = this.buf.toString('utf8', 4, 4 + len);
      this.buf = this.buf.subarray(4 + len);
      this.onMsg(JSON.parse(json));
    }
  }
}

// HostNet — 액터의 .net. send 는 버퍼링만(broker 가 전역 seq·enqueue·log 소유). 0011 그대로.
class HostNet {
  constructor() { this.buf = []; }
  register(addr, a) { a.addr = addr; a.net = this; }
  send(from, to, payload) { this.buf.push({ from, to, payload }); }
}

const hostId = process.argv[2] || '?';
const brokerPort = parseInt(process.argv[3] || '0', 10);
let hostNet = null;
const actors = new Map();        // addr -> actor
const specByAddr = new Map();    // addr -> spec(kind 판별용)
const replyCache = new Map();    // reqId -> reply obj  (멱등 — 중복 reqId 는 재실행 없이 캐시 회신)
let idempotentHits = 0;          // 중복 reqId 캐시 회신 수(멱등 발동 — broker 가 res 유실로 cmd 를 재전송했다는 증거)

function snapshotActor(addr, a) {
  const spec = specByAddr.get(addr);
  if (spec.kind === 'zone') {
    return {
      kind: 'zone', addr, dead: a.dead, shadow: a.shadow, region: a.region,
      ents: [...a.ents.entries()].map(([id, e]) => [id, { x: e.x, y: e.y }]),
      sessions: [...a.sessions.entries()],   // 재-provisioning 상태 동기용(loadstate 가 복원)
      acquired: [...a.acquired], handoffSeq: a.handoffSeq,   // 핸드오프 멱등 상태(재전송 재-acquire 방지)
      promotionKeyframes: a.promotionKeyframes, leasesSent: a.leasesSent,
    };
  }
  if (spec.kind === 'client') {
    return {
      kind: 'client', addr, avatar: a.avatar, views: a.views,
      seen: [...a.seen.entries()].map(([id, e]) => [id, { x: e.x, y: e.y }]),
      naksSent: a.naksSent, staleDrops: a.staleDrops,
      items: [...a.items],         // 가방 belief(0014) — itemDesync·단일소유 재구성용
      chatRecv: [...a.chatRecv],    // 채팅 belief(0015) — chatDesync·누설 재구성용
    };
  }
  if (spec.kind === 'orch') {
    return { kind: 'orch', addr, promotions: a.promotions, deathSeen: [...a.deathSeen.entries()] };
  }
  if (spec.kind === 'inventory') {
    return {
      kind: 'inventory', addr, minted: a.minted, transfers: a.transfers, failedOps: a.failedOps,
      ledger: [...a.ledger.entries()],
      byOwner: [...a.byOwner.entries()].map(([o, s]) => [o, [...s]]),
    };
  }
  if (spec.kind === 'chat') {
    return {
      kind: 'chat', addr, joins: a.joins, says: a.says, whispers: a.whispers, whisperFails: a.whisperFails, fanout: a.fanout,
      channels: [...a.channels.entries()].map(([ch, s]) => [ch, [...s]]),
      byAvatar: [...a.byAvatar.entries()].map(([av, e]) => [av, { gateway: e.gateway, region: e.region, subs: [...e.subs] }]),
      deliveries: a.deliveries,
    };
  }
  if (spec.kind === 'bus') {
    return {
      kind: 'bus', addr, publishes: a.publishes, deliveries: a.deliveries, unrouted: a.unrouted,
      topics: [...a.topics.entries()],   // topic -> [subscriberAddr...] (배열 그대로 — 등록 순서 보존)
    };
  }
  if (spec.kind === 'audit') {
    return { kind: 'audit', addr, seen: [...a.seen.entries()], records: a.records };
  }
  return { kind: spec.kind, addr };
}

const sock = net.connect(brokerPort, '127.0.0.1', () => {
  sock.setNoDelay(true);
  reply({ hello: true, pid: process.pid, hostId });
  reply({ subscribe: 'cmd.' + hostId, hostId });   // 자기 명령 토픽 구독(broker 는 hello 에서도 보장 — 멱등)
});
function reply(obj) { sock.write(frameOf({ ...obj, hostId })); }

function handle(msg) {
  const { reqId, cmd } = msg;
  // 멱등 — 같은 reqId 재도착(broker 재전송)이면 재실행 없이 캐시 회신.
  if (reqId !== undefined && replyCache.has(reqId)) { idempotentHits++; sock.write(frameOf(replyCache.get(reqId))); return; }
  let out = null;
  if (cmd === 'init') {
    hostNet = new HostNet();
    for (const spec of msg.specs) { specByAddr.set(spec.addr, spec); actors.set(spec.addr, NET.makeActor(spec, hostNet)); }
    out = { reqId, ready: true, pid: process.pid, addrs: [...actors.keys()], hostId };
  } else if (cmd === 'deliver') {
    const results = [];
    for (const { gi, m } of msg.items) {
      hostNet.buf = [];
      const a = actors.get(m.to);
      if (a && a.onMsg) a.onMsg(m);
      results.push({ gi, sends: hostNet.buf });
    }
    out = { reqId, results, hostId };
  } else if (cmd === 'tick') {
    const results = [];
    for (const { gi, addr } of msg.items) {
      hostNet.buf = [];
      const a = actors.get(addr);
      if (a && a.onTick) a.onTick(msg.tick);
      results.push({ gi, sends: hostNet.buf });
    }
    out = { reqId, results, hostId };
  } else if (cmd === 'fence') {
    // 펜싱 — 해당 액터를 dead 로 못박는다(재연결 후 출력 수용 0 = split-brain 방지). 제어 평면(net_ 무관).
    const a = actors.get(msg.addr);
    if (a) a.dead = true;
    out = { reqId, fenced: true, addr: msg.addr, hostId };
  } else if (cmd === 'loadstate') {
    // 재-provisioning 상태 동기 — 권위 스냅샷(ents/sessions)을 standby 액터에 주입(late-join 복구의 최후 수단).
    //   이후 권위 입력을 미러받아 같은 시드 의사난수 + 같은 입력열로 복제(divergence 0). 액터 계약 무변경.
    const a = actors.get(msg.addr);
    const st = msg.state;
    if (a && st) {
      a.ents = new Map((st.ents || []).map(([id, e]) => [id, { x: e.x, y: e.y }]));
      if (st.sessions) a.sessions = new Map(st.sessions);
      else if (a.sessions && a.sessions.clear) a.sessions.clear();
      if (st.acquired) a.acquired = new Set(st.acquired);   // 핸드오프 멱등 — 재전송 재-acquire(위치 리셋) 방지
      if (st.handoffSeq != null) a.handoffSeq = st.handoffSeq;
    }
    out = { reqId, loaded: true, addr: msg.addr, hostId };
  } else if (cmd === 'snapshot') {
    const snap = {};
    for (const addr of actors.keys()) snap[addr] = snapshotActor(addr, actors.get(addr));
    out = { reqId, snap, idempotentHits, hostId };   // 멱등 발동 수 동봉(broker 가 합산 — 멱등의 호스트-측 증거)
  } else if (cmd === 'bye') {
    reply({ reqId, ok: true });
    sock.end();
    setTimeout(() => process.exit(0), 30);
    return;
  }
  if (out) { if (reqId !== undefined) replyCache.set(reqId, out); sock.write(frameOf(out)); }
}

const framer = new Framer(handle);
sock.on('data', (c) => framer.push(c));
sock.on('error', () => process.exit(0));
sock.on('close', () => process.exit(0));
