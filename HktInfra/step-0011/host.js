// HktInfra step-0011 — 호스트(자식 프로세스) 진입점. child_process 로 띄워지는 *독립 OS 프로세스*.
//   step-0010 위에 더한 한 조각: broker 와의 *와이어*가 두 가지 — IPC(--ipc, 0010) 또는 **실 TCP 소켓**(--tcp, 이 step).
//     · --ipc: fork 의 process IPC 채널(process.send / process.on('message')) — OS 가 메시지 경계 보존(0010 그대로).
//     · --tcp: broker 의 127.0.0.1 포트(env HKT_BROKER_PORT)에 net.connect → *순수 소켓*으로만 통신(IPC 채널 없음).
//              TCP 는 바이트 스트림이라 frame.js 의 길이-프리픽스로 경계를 재조립한다(실 네트워크 전송의 현실).
//
//   액터 로직·명령 처리(init/deliver/tick/snapshot)는 net-core.js·0010 과 *그대로* — 와이어만 갈렸다(seam 만 교체).
//   액터의 net 은 HostNet shim: send 를 버퍼에 모으기만 하고(전역 seq/큐/로그는 broker 소유), broker 가 회수한다.
'use strict';
const NET = require('./net-core.js');
const net = require('net');
const { frame, FrameReader } = require('./frame.js');

// HostNet — 액터의 .net. send 는 버퍼링만(broker 가 전역 seq·enqueue·log 소유). register 는 addr/net 배선.
class HostNet {
  constructor() { this.buf = []; }
  register(addr, a) { a.addr = addr; a.net = this; }
  send(from, to, payload) { this.buf.push({ from, to, payload }); }
}

const hostId = process.argv[2] || process.env.HKT_HOST_ID || '?';
const mode = process.argv.includes('--tcp') ? 'tcp' : 'ipc';
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

// 명령 처리 — 와이어 무관(reply 만 주입받는다). 액터 onMsg/onTick 실행 → 발신(hostNet.buf) 회수.
function handle(msg, reply) {
  const { reqId, cmd } = msg;
  if (cmd === 'init') {
    hostNet = new HostNet();
    for (const spec of msg.specs) { specByAddr.set(spec.addr, spec); actors.set(spec.addr, NET.makeActor(spec, hostNet)); }
    reply({ reqId, ready: true, pid: process.pid, hostId, addrs: [...actors.keys()] });
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
    setTimeout(() => process.exit(0), 10);
  }
}

if (mode === 'tcp') {
  // ── 실 TCP 소켓 와이어 — broker 포트에 연결, 길이-프리픽스 프레이밍으로 경계 재조립. IPC 채널 없음(순수 소켓). ──
  const port = parseInt(process.env.HKT_BROKER_PORT, 10);
  const sock = net.connect(port, '127.0.0.1', () => {
    sock.setNoDelay(true);
    sock.write(frame({ hello: true, pid: process.pid, hostId }));   // 자기 식별(broker 가 소켓↔hostId 매핑)
  });
  const reply = (obj) => sock.write(frame(obj));
  const reader = new FrameReader((m) => handle(m, reply));
  sock.on('data', (chunk) => reader.push(chunk));
  sock.on('error', () => process.exit(0));
  sock.on('close', () => process.exit(0));
} else {
  // ── IPC 와이어(0010 그대로) — fork 의 process IPC 채널. OS 가 메시지 경계 보존. ──
  const reply = (obj) => process.send(obj);
  process.on('message', (msg) => handle(msg, reply));
  process.send({ hello: true, pid: process.pid, hostId });
}
