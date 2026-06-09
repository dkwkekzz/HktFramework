// HktInfra step-0011 — 호스트(자식 프로세스) 진입점. child_process.spawn 으로 띄워지는 *독립 OS 프로세스*.
//   0010 대비 *와이어만* 바뀐다: process.on('message')/process.send(fork IPC 채널) → 실 TCP 소켓(net.connect).
//   spawn 으로 떠서 *IPC 채널이 없다* — broker 의 TCP 포트(argv[3])로 역연결해 길이-프리픽스 프레이밍된 JSON
//   메시지만 주고받는다. 자기 몫의 액터만 산다 — 다른 호스트·broker 와 메모리를 공유하지 않는다(별 프로세스·별 주소공간).
//
//   액터 로직은 net-core.js 의 클래스 *그대로*(makeActor) — 와이어 교체가 액터를 수정하지 않는다(seam 만 교체).
//   액터의 net 은 HostNet shim: send 를 버퍼에 모으기만 하고(seq/큐/로그는 broker 가 소유), broker 가 회수한다.
'use strict';
const net = require('net');
const NET = require('./net-core.js');

// 길이-프리픽스 프레이밍 — cluster.js 와 동일 와이어 포맷([4바이트 BE 길이][UTF-8 JSON]).
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

// HostNet — 액터의 .net. send 는 버퍼링만(broker 가 전역 seq·enqueue·log 소유). register 는 addr/net 배선.
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

// 스냅샷 — 경계 너머로 *순수 데이터*만 보낸다(공유 참조 0). digest 재구성에 필요한 상태만.
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

// broker 의 TCP 포트로 역연결 — 유일한 통신 경로(IPC 채널 0). 연결되면 hello 로 pid·hostId 통보.
const sock = net.connect(brokerPort, '127.0.0.1', () => {
  sock.setNoDelay(true);
  reply({ hello: true, pid: process.pid, hostId });
});
function reply(obj) { sock.write(frameOf({ ...obj, hostId })); }

function handle(msg) {
  const { reqId, cmd } = msg;
  if (cmd === 'init') {
    hostNet = new HostNet();
    for (const spec of msg.specs) { specByAddr.set(spec.addr, spec); actors.set(spec.addr, NET.makeActor(spec, hostNet)); }
    reply({ reqId, ready: true, pid: process.pid, addrs: [...actors.keys()] });
  } else if (cmd === 'deliver') {
    const results = [];
    for (const { gi, m } of msg.items) {
      hostNet.buf = [];
      const a = actors.get(m.to);
      if (a && a.onMsg) a.onMsg(m);
      results.push({ gi, sends: hostNet.buf });
    }
    reply({ reqId, results });
  } else if (cmd === 'tick') {
    const results = [];
    for (const { gi, addr } of msg.items) {
      hostNet.buf = [];
      const a = actors.get(addr);
      if (a && a.onTick) a.onTick(msg.tick);
      results.push({ gi, sends: hostNet.buf });
    }
    reply({ reqId, results });
  } else if (cmd === 'snapshot') {
    const snap = {};
    for (const addr of actors.keys()) snap[addr] = snapshotActor(addr, actors.get(addr));
    reply({ reqId, snap });
  } else if (cmd === 'bye') {
    reply({ reqId, ok: true });
    sock.end();
    setTimeout(() => process.exit(0), 30);
  }
}

const framer = new Framer(handle);
sock.on('data', (c) => framer.push(c));
sock.on('error', () => process.exit(0));
sock.on('close', () => process.exit(0));
