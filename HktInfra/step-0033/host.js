// HktInfra step-0033 — 호스트(자식 프로세스) 진입점. child_process.spawn 으로 띄워지는 *독립 OS 프로세스*.
//   0019 대비 *읽기 모델(랭킹) reconstruct 명령만* 더한다: cmd:'reconstruct' — broker 가 *런 중 새로 spawn 한* 랭킹 standby 호스트에
//     쓰기 모델의 영속 저널을 주입한다(읽기 모델 failover·자기 영속 0). 호스트는 RankingService.reconstruct() 로 저널을 *보유 수 투영*으로
//     접어 죽기 전 ranks 를 재현(CQRS late-join — inventory.replay 의 읽기 모델 판). 제어 평면(net_ 무관·발신 0). (이하 0019 그대로:)
//   0016 대비 *영속 스토어(persist) 스냅샷 + 가방 replay 명령만* 더한다(이하 0016 그대로):
//     persist = 자기 OS 프로세스에 사는 PersistStore 액터(append-only 효과 저널 — 데이터 계층 SSOT·세션보다 오래 산다).
//       snapshotActor 가 저널을 직렬화해 broker 로 넘긴다(존 우회 — 신성한 tick 밖). 가방이 죽어도 이 호스트는 *안 죽는다*.
//     cmd:'replay' — broker 가 *런 중 새로 spawn 한* 가방 standby 호스트에 영속 저널을 주입한다(가방 failover). 호스트는 그
//       저널로 InventoryService.replay() 를 호출해 원장을 *죽기 전과 동일*하게 재현(event sourcing — 상태 전송 아님). 제어 평면.
//   (이하 0016 그대로) 0015 대비 *이벤트 버스(bus)·감사(audit) 스냅샷만* 더한다(채팅·가방·버스 전송·멱등·펜스·loadstate 는 0015 그대로):
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
      rankBelief: a.rankBelief,     // 랭킹 belief(0019) — rankDesync 재구성용(null=미수신)
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
  if (spec.kind === 'ranking') {
    // 랭킹(0019 발신하는 소비자) — rank 투영 테이블 + 소비/발행 회계. reconstruct 가 r.ranking 으로 복원(같은 digest 함수).
    return { kind: 'ranking', addr, ranks: [...a.ranks.entries()], consumed: a.consumed, published: a.published };
  }
  if (spec.kind === 'persist') {
    // 영속 저널(tail) + 스냅샷(이 step 압축 베이스) — 가방 죽음과 독립(데이터 계층). reconstruct 가 r.persist 로 복원.
    return { kind: 'persist', addr, journal: a.journal, writes: a.writes, snapshot: a.snapshot, snapshots: a.snapshots, compacted: a.compacted };
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
  } else if (cmd === 'replay') {
    // 가방 failover 복구 — broker 가 새로 spawn 한 가방 standby 에 영속 저널을 주입(event sourcing 재현). 제어 평면(net_ 무관).
    //   새 InventoryService 는 crash 직후 상태(빈 원장)이고, replay 가 저널을 적용해 죽기 전 원장을 *비트 동일*하게 재구성한다.
    const a = actors.get(msg.addr);
    if (a && a.replay) a.replay(msg.journal || [], msg.snapshot || null);   // 스냅샷(이 step)+tail replay — 압축 베이스에서 재현
    out = { reqId, replayed: true, addr: msg.addr, entries: (msg.journal || []).length, hostId };
  } else if (cmd === 'reconstruct') {
    // 읽기 모델(랭킹) late-join(0020) — broker 가 새로 spawn 한 랭킹 standby 에 *쓰기 모델의 영속 저널*을 주입해 투영을 재계산(CQRS). 제어 평면(net_ 무관).
    //   새 RankingService 는 crash 직후 상태(빈 투영)이고, reconstruct 가 저널을 *보유 수 투영*으로 접어 죽기 전 ranks 를 재현(자기 영속 0).
    const a = actors.get(msg.addr);
    if (a && a.reconstruct) a.reconstruct(msg.journal || [], msg.snapshot || null);
    out = { reqId, reconstructed: true, addr: msg.addr, entries: (msg.journal || []).length, hostId };
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
