// HktInfra step-0010 — 호스트(자식 프로세스) 진입점. child_process.fork 로 띄워지는 *독립 OS 프로세스*.
//   broker(cluster.js)가 IPC 로 보내는 init/deliver/tick/snapshot 명령을 처리한다. 자기 몫의 액터만 산다 —
//   다른 호스트의 액터·broker 의 net 과 *메모리를 공유하지 않는다*(별 프로세스). 통신은 JSON 직렬화 메시지뿐.
//
//   액터 로직은 net-core.js 의 클래스 *그대로*(makeActor) — 프로세스 분리가 액터를 수정하지 않는다(seam 만 교체).
//   액터의 net 은 HostNet shim: send 를 버퍼에 모으기만 하고(seq/큐/로그는 broker 가 소유), broker 가 회수한다.
'use strict';
const NET = require('./net-core.js');

// HostNet — 액터의 .net. send 는 버퍼링만(broker 가 전역 seq·enqueue·log 소유). register 는 addr/net 배선.
class HostNet {
  constructor() { this.buf = []; }
  register(addr, a) { a.addr = addr; a.net = this; }
  send(from, to, payload) { this.buf.push({ from, to, payload }); }
}

const hostId = process.argv[2] || '?';
let hostNet = null;
const actors = new Map();        // addr -> actor
const specByAddr = new Map();    // addr -> spec(kind 판별용)

// 스냅샷 — 프로세스 경계 너머로 *순수 데이터*만 보낸다(공유 참조 0). digest 재구성에 필요한 상태만.
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

process.on('message', (msg) => {
  const { reqId, cmd } = msg;
  if (cmd === 'init') {
    hostNet = new HostNet();
    for (const spec of msg.specs) { specByAddr.set(spec.addr, spec); actors.set(spec.addr, NET.makeActor(spec, hostNet)); }
    process.send({ reqId, ready: true, pid: process.pid, hostId, addrs: [...actors.keys()] });
  } else if (cmd === 'deliver') {
    const results = [];
    for (const { gi, m } of msg.items) {
      hostNet.buf = [];
      const a = actors.get(m.to);
      if (a && a.onMsg) a.onMsg(m);
      results.push({ gi, sends: hostNet.buf });
    }
    process.send({ reqId, results });
  } else if (cmd === 'tick') {
    const results = [];
    for (const { gi, addr } of msg.items) {
      hostNet.buf = [];
      const a = actors.get(addr);
      if (a && a.onTick) a.onTick(msg.tick);
      results.push({ gi, sends: hostNet.buf });
    }
    process.send({ reqId, results });
  } else if (cmd === 'snapshot') {
    const snap = {};
    for (const addr of actors.keys()) snap[addr] = snapshotActor(addr, actors.get(addr));
    process.send({ reqId, snap });
  } else if (cmd === 'bye') {
    process.send({ reqId, ok: true });
    process.disconnect && process.disconnect();
    process.exit(0);
  }
});

// broker 에 "떴다" 신호 — pid 로 프로세스 분리를 증명(isolate).
process.send({ hello: true, pid: process.pid, hostId });
