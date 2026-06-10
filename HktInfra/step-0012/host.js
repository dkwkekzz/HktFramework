// HktInfra step-0012 — 호스트(자식 프로세스) 진입점. child_process.spawn 으로 띄워지는 *독립 OS 프로세스*.
//   0011 대비 *버스·열화 정합만* 바뀐다(액터 로직·와이어 프레이밍은 0011 그대로):
//     ① 버스 — hello 후 자기 명령 토픽(cmd.<hostId>)을 broker 에 구독 통보. broker 는 그 토픽으로 발행한다.
//     ② 멱등(열화 정합) — 링크 드롭 시 broker 가 cmd 를 재전송하므로, *reqId 별 응답 캐시*로 중복 reqId 는
//        재실행 없이 캐시 응답만 회신(deliver/tick 이중 적용 방지). 멱등이 ack/resend 신뢰성의 호스트 반쪽.
//     ③ 펜스(재연결 split-brain 방지) — broker 의 fence 명령에 해당 액터를 dead 로 못박고 {fenced:true} 회신
//        (살아 있다는 증거 = 재연결 생존). 이후 그 액터는 onTick/onMsg 에서 0 발신(권위 단일 소유 보존).
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

function snapshotActor(addr, a) {
  const spec = specByAddr.get(addr);
  if (spec.kind === 'zone') {
    return {
      kind: 'zone', addr, dead: a.dead, shadow: a.shadow, region: a.region,
      ents: [...a.ents.entries()].map(([id, e]) => [id, { x: e.x, y: e.y }]),
      promotionKeyframes: a.promotionKeyframes, leasesSent: a.leasesSent,
    };
  }
  if (spec.kind === 'client') {
    return {
      kind: 'client', addr, avatar: a.avatar, views: a.views,
      seen: [...a.seen.entries()].map(([id, e]) => [id, { x: e.x, y: e.y }]),
      naksSent: a.naksSent, staleDrops: a.staleDrops,
    };
  }
  if (spec.kind === 'orch') {
    return { kind: 'orch', addr, promotions: a.promotions, deathSeen: [...a.deathSeen.entries()] };
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
  if (reqId !== undefined && replyCache.has(reqId)) { sock.write(frameOf(replyCache.get(reqId))); return; }
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
  } else if (cmd === 'snapshot') {
    const snap = {};
    for (const addr of actors.keys()) snap[addr] = snapshotActor(addr, actors.get(addr));
    out = { reqId, snap, hostId };
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
