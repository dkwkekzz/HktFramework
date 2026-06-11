// HktInfra step-0028 — broker(버스 허브). 멀티프로세스 lockstep 배리어를 *토픽 pub/sub 버스* 위에서 구동한다(Node 전용).
//   0020 대비 *채팅 failover(chatRestart) + 채팅 영속 스토어(chatpersist) 재구성만* 더한다(invRestart/rankRestart 와 같은 기법):
//     채팅 failover(chatRestart.at) — broker 가 ⒜ chatpersist(안 죽음)에서 커맨드 로그를 읽고 ⒝ 채팅 호스트를 *진짜 kill*(RAM 라우팅 소실)
//     ⒞ 새 채팅 호스트를 spawn·init·*replay(커맨드 로그)* 해 라우팅 테이블+deliveries 를 죽기 전과 비트 동일하게 *리듀서 재실행*으로 재현
//     ⒟ placement 의 'chat' 라우팅을 새 호스트로 돌린다. replay 는 재발신 0(replaying 가드) — net_.log 비-기여 → 인프로세스 crash()+replay() 비트 동일.
//   (이하 0020 그대로) 0016 대비 *영속 스토어(persist) 재구성 + 가방 failover(invRestart) 만* 더한다(이하 전부 0016 그대로):
//     persist 도 *여느 호스트와 동일*하게 spawn·init·deliver(tick 은 onTick 없어 no-op). reconstruct 만 저널을 r.persist 로
//     복원한다. 가방 failover(invRestart.at) — 0013 재-provisioning 의 *서비스 판*: broker 가 ⒜ persist(안 죽음)에서 저널을
//     읽고 ⒝ 가방 호스트를 *진짜 kill*(RAM 소실) ⒞ 새 가방 호스트를 spawn·init·*replay(저널)* 해 원장을 죽기 전과 비트 동일하게
//     재현하고 ⒟ placement 의 'inventory' 라우팅을 새 호스트로 돌린다. 전부 *제어 평면*(cluster RPC) — net_.log 비-기여 →
//     인프로세스 crash()+replay() 와 *비트 동일*(E2E). 가방 죽음과 영속(데이터 계층)의 독립이 "세계가 세션보다 오래 산다"의 증명.
//   (이하 0016 그대로) 0015 대비 *이벤트 버스(bus)·감사(audit) 재구성 + 시나리오 inject seam 만* 더한다(이하 전부 0015 그대로):
//     bus·audit 도 *여느 호스트와 동일*하게 spawn·init·deliver(tick 은 onTick 없어 no-op) — broker 코드는 서비스 버스를
//     특별 취급하지 않는다(범용 액터: 0012 토픽 *전송* 위에 0016 서비스 *의미* 액터가 얹힘). reconstruct 만 라우팅
//     테이블(topics)·발행/팬아웃 회계·관찰 스트림(records)을 r.bus/r.audit 으로 복원해 run() 과 같은 digest 함수를 먹인다.
//     inject seam — run() 과 같은 위치(tick 직전·net_.send)에 클라 intent 를 주입(미제공=no-op → 비트 동일 보존).
//   (이하 0015 그대로) 0014 대비 *채팅 서비스(chat) 재구성*:
//     chat 도 *여느 호스트와 동일*하게 spawn·init·deliver(tick 은 onTick 없어 no-op) — broker 코드는 채팅을 특별
//     취급하지 않는다(범용 액터). reconstruct 만 구독 테이블(channels)·역인덱스(byAvatar)·deliveries·팬아웃 계측을
//     r.chat 으로 복원해 run() 과 같은 digest 함수를 먹인다. 채팅은 존을 우회하므로 net.log 의 권위 세계 비트열엔 비-침습.
//   (이하 0014 그대로) 0013 대비 *가방 서비스(inventory) 재구성*:
//     inventory 는 *여느 호스트와 동일*하게 spawn·init·deliver(tick 은 onTick 없어 no-op) — broker 코드는 가방을 특별
//     취급하지 않는다(범용 액터). reconstruct 만 원장(ledger)·역인덱스(byOwner)·mint/transfer 계측을 r.inventory 로
//     복원해 run() 과 같은 digest 함수를 먹인다. 가방은 존을 우회하므로 net.log 의 권위 세계 비트열엔 비-침습.
//   (이하 0013 그대로) 0012 대비 *진짜 프로세스 kill 생애주기만* 더한다(버스·배리어·발신 순서·드롭/분단/펜싱은 0012 그대로):
//     ① 진짜 kill — 0012 분단은 *논리 윈도*(broker 가 침묵 시점을 *안다*)였고 분단 호스트는 *살아 있었다*. 이 step 은
//        실제 `child.kill('SIGKILL')`(프로세스 소멸·소켓 RST)을 결정론 tick 에 주입한다. broker 는 윈도가 아니라
//        *소켓 close 신호*(전송 층 사망 통보)로 침묵을 *감지*한다(killHost → socketDead). deliver(T>at)·tick(T>=at)
//        은 socketDead 멤버십으로 스킵 = 0009 추상 사망/0012 분단과 *비트 동일*. 차이: 죽은 프로세스는 *돌아오지 않는다*.
//     ② 타임아웃 추측 감지 — 소켓이 *살아 있는* 침묵(falsedeath)은 close 신호가 없다 → broker 가 침묵 tick 을 세어
//        leaseTimeout 초과 시 *presumedDead* 로 *추측*(윈도 아님)하고 epoch 을 올린다.
//     ③ 거짓 사망 + epoch 펜싱 — 일시 침묵 후 *복귀*(falsedeath: 호스트는 살아 돌아와 권위 재개 시도)는 split-brain
//        위험. broker 가 presumedDead(=stale epoch) 호스트의 *발신을 전량 드롭*(epochFenced) → net.log 0 기여 →
//        *진짜 사망과 비트 동일* + 소유자=1. 0012 의 일회성 fence 를 *지속 epoch 토큰*으로 올린 것.
//     ④ 재-provisioning — kill→승격으로 N=1(권위만 남고 추종자 0)이 되면, broker 가 *새 프로세스를 spawn*(zone1g)·
//        권위 스냅샷을 *상태 동기*(loadstate)·이후 권위의 deliver 입력을 *미러*해 핫 standby 를 세운다(N≥2 복원).
//        새 standby = shadow·sibling 0·orch 0 → 발신 0(net.log 불변·비-침습) → 권위와 divergence 0.
//   broker.net.log(발신 substrate)가 인프로세스 deathTick 과 비트 동일(kill=분단=죽음). 공유 메모리 0 — 와이어=소켓 바이트뿐.
'use strict';
const net = require('net');
const { spawn } = require('child_process');
const path = require('path');
const { fnv1a } = require('../engine/index.js');

// ── 길이-프리픽스 프레이밍 — TCP 바이트 스트림에서 메시지 경계 복원([4바이트 BE 길이][UTF-8 JSON]). 0012 그대로. ──
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
//  Cluster — broker 가 소유하는 *버스 허브*. 토픽 pub/sub + 링크 열화(드롭·분단·펜싱) + 진짜 kill 생애주기.
//   0012 의 Cluster 를 잇고, *진짜 child.kill·소켓 close 감지·타임아웃 추측·epoch 펜싱·재-provisioning* 만 더했다.
// ════════════════════════════════════════════════════════════════════════
class Cluster {
  constructor(hostIds, wire = null) {
    this.hostIds = hostIds.slice();
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
    this._helloRes = new Map();
    // ── 열화(0012 그대로) ──
    this.wire = wire;             // { drop, dropSeed, partition, kill, falsedeath, reprovision }
    this.dropped = 0;             // 드롭된 프레임 수(cmd+res, 재전송 유발) — *결정론*(시드+reqId+방향+attempt 의 함수)
    this.resends = 0;             // 재전송 라운드 수
    this.dupCmds = 0;             // res 드롭으로 *중복* 전송된 cmd 수 = 호스트 reqId 멱등이 발동하는 횟수
    this.idempotentHits = 0;      // 호스트가 실제로 캐시 회신(재실행 0)한 횟수 — 멱등 발동의 호스트-측 증거
    this.fencedHost = null;       // 재연결 후 펜싱된 호스트(출력 수용 0 — split-brain 방지)
    this.fencedAttempts = 0;      // 침묵 처리된 호스트-tick 수(failover 유발 회계)
    this.reconnectedAlive = false;// 분단 후 호스트가 살아 응답(펜스 ack)했는가
    // ── 진짜 kill 생애주기(0013 신규) ──
    this.socketDead = new Set();  // 소켓 close 로 *감지된* 사망 호스트(deliver/tick 스킵)
    this.killed = new Set();      // 실제 child.kill 한 호스트
    this.socketClosed = 0;        // 소켓 close 신호 관측 수(=전송 층 사망 *감지* 횟수)
    this.silentTicks = new Map(); // hostId -> 연속 침묵 tick 수(타임아웃 추측의 입력)
    this.presumedDead = new Set();// 타임아웃 추측으로 *사망 선언*한 호스트(윈도 아님)
    this.presumedDeadTick = new Map(); // hostId -> 추측 사망 선언 tick
    this.epoch = 0;               // 펜싱 토큰 — 사망 선언마다 +1(복귀 stale 호스트 거부의 근거)
    this.epochFenced = 0;         // stale epoch 호스트의 *발신* 드롭 수(거짓 사망의 출력 거부 — split-brain 0)
    this.deadAddrs = new Set();   // 최종 reconstruct 에서 dead 로 표기할 액터 주소(kill/fence/추측사망)
    // ── 재-provisioning(0013 신규) ──
    this.reprovisioned = [];      // 런 중 spawn 한 새 호스트 id(N≥2 복원)
    this.reprovAddrs = [];        // 그 새 호스트의 액터 주소(standby)
    this.mirrors = [];            // [{srcAddr, dstAddr, dstHost}] — 권위 입력을 standby 로 미러
    this.mirrorDeliveries = 0;    // standby 로 미러된 입력 메시지 수
    this._reprovDone = false;
    this.invRestarted = null;     // 0017 가방 failover 계측({at,oldHost,newHost,entries})
    this.rankRestarted = null;    // 0020 읽기 모델(랭킹) failover 계측({at,oldHost,newHost,entries})
    this.chatRestarted = null;    // 0021 채팅 failover 계측({at,oldHost,newHost,entries})

    this._shuttingDown = false;   // shutdown 중 close 는 graceful — 진짜 사망 감지에서 제외
  }

  // TCP 서버 기동 → 각 호스트 spawn(IPC 0) → 역연결·hello·자기 토픽 구독 대기.
  async spawn() {
    await new Promise((res) => {
      this.server = net.createServer((sock) => this._onConnection(sock));
      this.server.listen(0, '127.0.0.1', () => { this.port = this.server.address().port; res(); });
    });
    await Promise.all(this.hostIds.map(h => this._spawnChild(h)));
  }
  // 단일 호스트 spawn — 초기 기동(spawn)과 *런 중 재-provisioning*(spawnOne)이 공유.
  _spawnChild(h) {
    const hostPath = path.join(__dirname, 'host.js');
    this.pending.set(h, new Map());
    return new Promise((res, rej) => {
      const child = spawn(process.execPath, [hostPath, h, String(this.port)], { stdio: ['ignore', 'inherit', 'inherit'] });
      this.children.set(h, child);
      child.on('error', rej);
      this._helloRes.set(h, res);
    });
  }
  // 런 중 새 호스트 spawn(재-provisioning) — hostIds 에 추가. init/loadstate 는 호출자가 잇는다.
  async spawnOne(h) {
    await this._spawnChild(h);
    if (!this.hostIds.includes(h)) this.hostIds.push(h);
    this.reprovisioned.push(h);
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
    // ── 진짜 kill 감지 — 소켓 close 는 *전송 층 사망 통보*(윈도 아닌 신호). pending RPC 를 dead 로 해소. ──
    //   런 중 close = 진짜 사망 감지(socketClosed++). shutdown 중 close 는 graceful 이라 카운트 제외.
    sock.on('close', () => {
      let host = null;
      for (const [h, s] of this.socks) if (s === sock) { host = h; break; }
      if (host == null) return;
      this.socketDead.add(host);
      if (!this._shuttingDown) this.socketClosed++;
      const pend = this.pending.get(host);
      if (pend) { for (const rec of pend.values()) rec.resolve({ dead: true, results: [] }); pend.clear(); }
    });
  }
  _subscribe(topic, sock) { if (!this.subs.has(topic)) this.subs.set(topic, new Set()); this.subs.get(topic).add(sock); }
  // 발행자 무수정 소비자 추가 — 같은 토픽 프레임 사본을 in-broker fn 으로 받는다(별 프로세스 구독자의 경량 대역).
  tap(topic, fn) { if (!this.taps.has(topic)) this.taps.set(topic, []); this.taps.get(topic).push(fn); }

  // ── 토픽 발행 — 구독 소켓 전부 + tap 소비자에게 사본. (드롭 결정은 rpc 루프에서 — 양방향·결정론) ──
  _publish(topic, msg) {
    this.publishes++;
    const taps = this.taps.get(topic);
    if (taps) for (const fn of taps) { this.tapDeliveries++; try { fn(msg); } catch (e) { } }
    let f;
    try { f = frameOf(msg); } catch (e) { this.allSerializable = false; return false; }
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

  // 한 번 왕복 — cmd.<host> 발행 + res(reqId) 응답 대기. (드롭은 호출자 rpc 루프가 결정 — _rpcOnce 는 항상 write)
  _rpcOnce(hostId, reqId, frame) {
    return new Promise((resolve) => {
      this.pending.get(hostId).set(reqId, { resolve });
      this._publish('cmd.' + hostId, frame);
    });
  }
  // 결정론 드롭 판정 — (시드, reqId, 방향, attempt)의 *순수 함수*. 0012 그대로.
  _dropHash(reqId, dir, attempt) {
    if (!this.wire || !this.wire.drop) return false;
    const h = fnv1a((this.wire.dropSeed || 0) + ':' + reqId + ':' + dir + ':' + attempt);
    return (h % 1000) < Math.floor(this.wire.drop * 1000);
  }
  // rpc — 신뢰 왕복. 죽은 소켓은 즉시 dead 반환(write 0). 무열화면 단일 왕복. 드롭 모드면 양방향 결정론 드롭 + 재전송. 0012 그대로.
  async rpc(hostId, msg) {
    if (this.socketDead.has(hostId)) return { dead: true, results: [], hostId };   // 죽은 프로세스 — 와이어 없음
    const reqId = this.reqSeq++;
    const frame = { ...msg, reqId, hostId };
    if (!this.wire || !this.wire.drop) return this._rpcOnce(hostId, reqId, frame);
    const cap = 100;
    for (let attempt = 1; attempt <= cap; attempt++) {
      if (this._dropHash(reqId, 0, attempt)) { this.dropped++; this.resends++; continue; }  // cmd 유실 — 호스트 미수신
      const reply = await this._rpcOnce(hostId, reqId, frame);
      if (this._dropHash(reqId, 1, attempt)) { this.dropped++; this.resends++; this.dupCmds++; continue; }  // res 유실 — 재전송=중복 cmd
      return reply;   // 양방향 통과 — 채택
    }
    return this._rpcOnce(hostId, reqId, frame);   // cap(극히 드묾) — 강제 1회
  }

  pids() { return [...this._pids.values()]; }
  livePids() { return [...this._pids.entries()].filter(([h]) => !this.socketDead.has(h)).map(([, p]) => p); }
  async init(specsByHost) {
    await Promise.all(this.hostIds.map(h => this.rpc(h, { cmd: 'init', specs: specsByHost.get(h) || [] })));
  }

  // ── 진짜 프로세스 kill — child.kill(SIGKILL)·소켓 RST. socketDead 즉시 표기(이후 deliver/tick 스킵). ──
  //   await exit 로 프로세스 소멸을 확정(소켓 close 가 처리됨) → 다음 tick 의 스킵이 *논리 tick 공간에서 결정론*.
  //   벽시계(언제 RST 가 도착) 무관 — socketDead 는 kill 호출 직후 세워지고, 배리어가 exit 를 기다린다.
  async killHost(hostId) {
    this.killed.add(hostId);
    const child = this.children.get(hostId);
    const sock = this.socks.get(hostId);
    // 소켓 *close* 를 기다린다 = 전송 층이 사망을 통보할 때까지(감지=신호). close 핸들러가 socketDead·socketClosed 를 세움.
    await new Promise((res) => {
      let done = false; const fin = () => { if (!done) { done = true; res(); } };
      if (sock) sock.once('close', fin);
      try { child && child.kill('SIGKILL'); } catch (e) { fin(); }
      setTimeout(fin, 1000);   // backstop(정상은 즉시 close) — 아래 fallback 이 socketDead 보장
    });
    if (!this.socketDead.has(hostId)) this.socketDead.add(hostId);   // close 누락 대비(결정론은 멤버십이 보장)
  }

  // 와이어 펜스(0012 그대로) — 분단 호스트가 복귀(살아 있음)해도 broker 가 그 액터를 dead 로 못박아 출력 수용 0.
  async fence(hostId, addr) {
    if (this.socketDead.has(hostId)) { this.fencedHost = hostId; return { fenced: false, dead: true }; }
    const r = await this.rpc(hostId, { cmd: 'fence', addr });
    this.reconnectedAlive = !!(r && r.fenced);
    this.fencedHost = hostId;
    return r;
  }
  // 단일 호스트 스냅샷(재-provisioning 상태 동기 소스).
  async snapshotOne(hostId, addr) {
    const r = await this.rpc(hostId, { cmd: 'snapshot' });
    return r && r.snap ? r.snap[addr] : null;
  }
  async snapshotAll() {
    const out = new Map();
    await Promise.all(this.hostIds.map(async h => {
      if (this.socketDead.has(h)) return;   // 죽은 프로세스 — 스냅샷 불가(reconstruct 가 dead 프록시 합성)
      const r = await this.rpc(h, { cmd: 'snapshot' });
      if (!r || !r.snap) return;
      out.set(h, r.snap);
      this.idempotentHits += (r.idempotentHits || 0);
    }));
    return out;
  }
  async shutdown() {
    this._shuttingDown = true;   // 이후 close 는 graceful — socketClosed 카운트 제외
    await Promise.all(this.hostIds.map(h => new Promise(res => {
      if (this.socketDead.has(h)) return res();   // 이미 죽음 — 정리 불필요
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

// 배치(placement): addr → hostId. 기본 = 각 서버 박스가 자기 프로세스, 클라는 한 호스트(엣지). 0012 그대로.
function computePlacement(topo, custom) {
  const m = new Map();
  if (custom) { for (const [a, h] of Object.entries(custom)) m.set(a, h); return m; }
  for (const s of topo.specs) m.set(s.addr, s.kind === 'client' ? 'clients' : s.addr);
  return m;
}

// ── 멀티프로세스 실행 — 같은 buildTopology, lockstep 배리어로 구동. 와이어(버스·열화·kill 생애주기)만 교체. ──
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
  if (opts.tap) for (const t of opts.tap) cluster.tap(t.topic, t.fn);

  const ticks = opts.ticks || 48;
  const order = topo.order;
  const placeOf = (addr) => placement.get(addr);
  const W = opts.wire || {};
  const H = topo.H;
  const guessThreshold = opts.leaseTimeout || 3;   // 타임아웃 추측 임계(침묵 tick 수)

  // 열화 시나리오 핸들
  const part = W.partition || null;                // 0012 분단(링크 침묵·호스트 생존)
  const partHost = part ? placeOf(part.host) : null;
  const kill = W.kill || null;                      // 0013 진짜 kill(프로세스 소멸)
  const killHost = kill ? placeOf(kill.host) : null;
  const fd = W.falsedeath || null;                 // 0013 거짓 사망(침묵→복귀·살아 있음)
  const fdHost = fd ? placeOf(fd.host) : null;
  const rep = W.reprovision || null;               // 0013 재-provisioning(죽은 자리 새 프로세스)
  const invRestart = opts.invRestart || null;      // 0017 가방 failover(진짜 kill→새 호스트 replay)
  const rankRestart = opts.rankRestart || null;    // 0020 읽기 모델(랭킹) failover(진짜 kill→새 호스트 reconstruct·쓰기 저널)
  const chatRestart = opts.chatRestart || null;    // 0021 채팅 failover(진짜 kill→새 호스트 커맨드 로그 replay)
  const persistPlaced = placement.has('persist');  // 영속 스토어 존재(replay/reconstruct 소스 — 안 죽는다)
  const chatPersistPlaced = placement.has('chatpersist');  // 채팅 영속 스토어 존재(이 step·채팅 커맨드 로그 — 안 죽는다)
  let invRestartDone = false;
  let rankRestartDone = false;
  let chatRestartDone = false;

  // ── 침묵/펜스 판정 ──
  const downForDeliver = (h, T) => {
    if (cluster.socketDead.has(h)) return true;                 // 진짜 kill — 소켓 사망
    if (part && h === partHost) return T > part.at;             // 분단 윈도(deliver 는 at 까지 정상)
    if (fd && h === fdHost) return T > fd.at && T < fd.healAt;  // 거짓 사망 침묵 구간
    return false;
  };
  const downForTick = (h, T) => {
    if (cluster.socketDead.has(h)) return true;
    if (part && h === partHost) return T >= part.at;            // 분단 윈도(tick 은 at 부터 침묵)
    if (fd && h === fdHost) return T >= fd.at && T < fd.healAt;
    return false;
  };
  // 거짓 사망 복귀 — 호스트는 *살아 돌아와* 권위 재개 시도하나, presumedDead(stale epoch) 라 발신 전량 드롭(펜싱).
  const fenceSendsFrom = (h, T) => (fd && h === fdHost && T >= fd.healAt && cluster.presumedDead.has(h));

  // 타임아웃 추측 — 침묵 tick 을 세어 임계 초과 시 presumedDead 선언(윈도 아닌 *추측*) + epoch++.
  const observeSilence = (h, T) => {
    if (cluster.socketDead.has(h)) return;   // 진짜 kill 은 소켓 신호로 *감지* — 추측 경로 아님
    const n = (cluster.silentTicks.get(h) || 0) + 1;
    cluster.silentTicks.set(h, n);
    if (n >= guessThreshold && !cluster.presumedDead.has(h)) {
      cluster.presumedDead.add(h);
      cluster.epoch++;
      cluster.presumedDeadTick.set(h, T);
      cluster.deadAddrs.add(fd ? fd.host : h);   // 추측 사망 → reconstruct 에서 비권위
    }
  };

  for (let T = 0; T < ticks; T++) {
    // 시나리오 inject write-seam — run() 의 inject 와 *같은 위치*(tick 직전·net_.send): 멀티프로세스도 비트 동일(미제공=no-op).
    if (opts.inject) for (const c of opts.inject) if (c.tick === T + 1 && c.move) net_.send('client' + c.client, 'gateway', { type: 'move', d: { dx: c.move[0] | 0, dy: c.move[1] | 0 } });
    net_.tick++;
    // ── 가방 failover(0017) — tick 의 deliver *직전*(인프로세스 run() 의 crash+replay 와 같은 위치). 제어 평면(net_.log 비-기여). ──
    //   ① persist(안 죽음)에서 저널 읽기 ② 가방 호스트 진짜 kill(RAM 소실) ③ 새 호스트 spawn·init·replay(저널) ④ 'inventory' 라우팅 전환.
    if (invRestart && placement.has('inventory') && net_.tick === invRestart.at && !invRestartDone) {   // inventory 존재 가드(인프로세스 run() 의 `&& inventory` 와 정합 — 부재 시 no-op·모드 발산 방지)
      invRestartDone = true;
      const oldHost = placeOf('inventory');
      let journal = [], snapshot = null;
      if (persistPlaced) { const snap = await cluster.snapshotOne(placeOf('persist'), 'persist'); journal = (snap && snap.journal) || []; snapshot = (snap && snap.snapshot) || null; }
      await cluster.killHost(oldHost);                                   // 진짜 child.kill — 가방 프로세스 소멸(소켓 RST)
      const invSpec = topo.specs.find(s => s.addr === 'inventory');
      const newHost = 'inventory_r';
      placement.set('inventory', newHost);                              // 이후 'inventory' deliver/tick 라우팅을 새 호스트로
      await cluster.spawnOne(newHost);
      await cluster.rpc(newHost, { cmd: 'init', specs: [invSpec] });    // 빈 InventoryService(crash 직후 상태)
      await cluster.rpc(newHost, { cmd: 'replay', addr: 'inventory', journal, snapshot });   // 스냅샷(이 step)+tail replay → 죽기 전 원장 재현
      cluster.invRestarted = { at: invRestart.at, oldHost, newHost, entries: journal.length };
    }
    // ── 읽기 모델(랭킹) failover(0020) — invRestart 와 *같은 위치·기법*. 자기 영속 0 인 읽기 모델을 *쓰기 모델 저널*로 reconstruct. ──
    //   ① persist(안 죽음)에서 저널 읽기 ② 랭킹 호스트 진짜 kill(RAM 투영 소실) ③ 새 호스트 spawn·init·reconstruct(쓰기 저널) ④ 'ranking' 라우팅 전환.
    //   reconstruct 는 발신 0(inventory.replay 처럼 비-침습) → net_.log 비-기여 → 인프로세스 run() 의 crash()+reconstruct() 와 비트 동일.
    if (rankRestart && placement.has('ranking') && net_.tick === rankRestart.at && !rankRestartDone) {   // ranking 존재 가드(인프로세스 run() 의 `&& ranking` 와 정합)
      rankRestartDone = true;
      const oldHost = placeOf('ranking');
      let journal = [], snapshot = null;
      if (persistPlaced) { const snap = await cluster.snapshotOne(placeOf('persist'), 'persist'); journal = (snap && snap.journal) || []; snapshot = (snap && snap.snapshot) || null; }
      await cluster.killHost(oldHost);                                  // 진짜 child.kill — 랭킹 프로세스 소멸(RAM 투영 소실)
      const rankSpec = topo.specs.find(s => s.addr === 'ranking');
      const newHost = 'ranking_r';
      placement.set('ranking', newHost);                               // 이후 'ranking' deliver/tick 라우팅을 새 호스트로(구독 주소→호스트 해소는 placement 기반)
      await cluster.spawnOne(newHost);
      await cluster.rpc(newHost, { cmd: 'init', specs: [rankSpec] });   // 빈 RankingService(crash 직후 상태)
      await cluster.rpc(newHost, { cmd: 'reconstruct', addr: 'ranking', journal, snapshot });   // 쓰기 저널 reconstruct → 죽기 전 투영 재계산
      cluster.rankRestarted = { at: rankRestart.at, oldHost, newHost, entries: journal.length };
    }
    // ── 채팅 failover(0021) — invRestart 와 *같은 위치·기법*. 채팅 라우팅 테이블을 *커맨드 로그*로 replay(리듀서 재실행). ──
    //   ① chatpersist(안 죽음)에서 커맨드 로그 읽기 ② 채팅 호스트 진짜 kill(RAM 라우팅 소실) ③ 새 호스트 spawn·init·replay(커맨드 로그) ④ 'chat' 라우팅 전환.
    //   replay 는 재발신 0(replaying 가드 — inventory.replay 처럼 비-침습) → net_.log 비-기여 → 인프로세스 run() 의 crash()+replay() 와 비트 동일.
    if (chatRestart && placement.has('chat') && net_.tick === chatRestart.at && !chatRestartDone) {   // chat 존재 가드(인프로세스 run() 의 `&& chat` 와 정합)
      chatRestartDone = true;
      const oldHost = placeOf('chat');
      let journal = [], snapshot = null;
      if (chatPersistPlaced) { const snap = await cluster.snapshotOne(placeOf('chatpersist'), 'chatpersist'); journal = (snap && snap.journal) || []; snapshot = (snap && snap.snapshot) || null; }
      await cluster.killHost(oldHost);                                  // 진짜 child.kill — 채팅 프로세스 소멸(RAM 라우팅 소실)
      const chatSpec = topo.specs.find(s => s.addr === 'chat');
      const newHost = 'chat_r';
      placement.set('chat', newHost);                                  // 이후 'chat' deliver/tick·구독 라우팅을 새 호스트로(placement 기반)
      await cluster.spawnOne(newHost);
      await cluster.rpc(newHost, { cmd: 'init', specs: [chatSpec] });   // 빈 ChatService(crash 직후 상태)
      await cluster.rpc(newHost, { cmd: 'replay', addr: 'chat', journal, snapshot });   // 라우팅 스냅샷(이 step)+tail 커맨드 replay → 죽기 전 라우팅+deliveries 재현
      cluster.chatRestarted = { at: chatRestart.at, oldHost, newHost, entries: journal.length };
    }
    // ── deliver phase ──
    const due = net_.queue.get(net_.tick) || [];
    net_.queue.delete(net_.tick);
    const dgroups = new Map(); let gi = 0;
    const mirrorItems = new Map();   // dstHost -> [{gi,m}] (권위 입력을 standby 로 미러)
    for (const m of due) {
      if (net_.delivered.has(m.id)) { net_.stats.dupSkipped++; continue; }
      net_.delivered.add(m.id);
      const delay = net_.tick - m.tick - 1; if (delay > net_.stats.maxDelay) net_.stats.maxDelay = delay;
      net_.stats.deliveredN++;
      // 미러 캡처 — 권위(src) 로 가는 입력의 사본을 standby(dst) 로(권위가 받는 것만).
      if (cluster.mirrors.length) for (const mir of cluster.mirrors) if (m.to === mir.srcAddr) {
        if (!mirrorItems.has(mir.dstHost)) mirrorItems.set(mir.dstHost, []);
        const arr = mirrorItems.get(mir.dstHost);
        arr.push({ gi: arr.length, m: { ...m, to: mir.dstAddr } });
      }
      const h = placeOf(m.to); if (h == null) continue;
      if (downForDeliver(h, net_.tick)) { cluster.fencedAttempts++; continue; }   // 침묵 링크/죽은 소켓 — 배달 안 함
      if (!dgroups.has(h)) dgroups.set(h, []);
      dgroups.get(h).push({ gi: gi++, m });
    }
    if (dgroups.size) {
      const res = await Promise.all([...dgroups].map(([h, items]) => cluster.rpc(h, { cmd: 'deliver', items }).then(r => ({ h, results: r.results || [] }))));
      const sends = [];
      for (const { h, results } of res) {
        const fenced = fenceSendsFrom(h, net_.tick);
        for (const { gi, sends: ss } of results) ss.forEach((s, si) => { if (fenced) cluster.epochFenced++; else sends.push({ gi, si, s }); });
      }
      sends.sort((a, b) => a.gi - b.gi || a.si - b.si);
      for (const { s } of sends) net_.send(s.from, s.to, s.payload);
    }
    // 미러 deliver(standby) — 결과 폐기(shadow=발신 0, net_ 무오염). 권위 경로와 격리.
    if (mirrorItems.size) for (const [dstHost, items] of mirrorItems) {
      await cluster.rpc(dstHost, { cmd: 'deliver', items });
      cluster.mirrorDeliveries += items.length;
    }

    // ── 진짜 kill 주입(열화) — deliver 후·tick 전(=분단 윈도 deliver T>at·tick T>=at 와 정합). ──
    if (kill && net_.tick === kill.at && !cluster.killed.has(killHost)) {
      await cluster.killHost(killHost);
      cluster.deadAddrs.add(kill.host);
    }

    // ── tick phase ──
    const tgroups = new Map();
    order.forEach((addr, idx) => {
      const h = placeOf(addr);
      if (downForTick(h, net_.tick)) { cluster.fencedAttempts++; observeSilence(h, net_.tick); return; }
      if (!tgroups.has(h)) tgroups.set(h, []);
      tgroups.get(h).push({ gi: idx, addr });
    });
    const tres = await Promise.all([...tgroups].map(([h, items]) => cluster.rpc(h, { cmd: 'tick', tick: net_.tick, items }).then(r => ({ h, results: r.results || [] }))));
    const tsends = [];
    for (const { h, results } of tres) {
      const fenced = fenceSendsFrom(h, net_.tick);
      for (const { gi, sends: ss } of results) ss.forEach((s, si) => { if (fenced) cluster.epochFenced++; else tsends.push({ gi, si, s }); });
    }
    tsends.sort((a, b) => a.gi - b.gi || a.si - b.si);
    for (const { s } of tsends) net_.send(s.from, s.to, s.payload);
    // 미러 tick(standby) — onTick 으로 pending 적용·복제 유지. 결과 폐기(발신 0).
    if (cluster.mirrors.length) for (const mir of cluster.mirrors)
      await cluster.rpc(mir.dstHost, { cmd: 'tick', tick: net_.tick, items: [{ gi: 0, addr: mir.dstAddr }] });

    // ── 재-provisioning 주입 — kill→승격 후 N=1 을 새 standby 로 복원(상태 동기 + 미러). ──
    if (rep && net_.tick === rep.at && !cluster._reprovDone) {
      cluster._reprovDone = true;
      const srcHost = placeOf(rep.srcAddr);
      const snap = await cluster.snapshotOne(srcHost, rep.srcAddr);   // 권위(승격된 추종자) 상태 동기 소스
      const shadowSpec = {
        addr: rep.newAddr, kind: 'zone', seed: opts.seed, opts: {
          grid: opts.grid || 16, radius: opts.radius !== undefined ? opts.radius : 4,
          incremental: opts.incremental !== false, recovery: opts.recovery === true,
          // 승격된 권위(src)와 *같은 sibling*(경계 핸드오프 동치) → 같은 ents 진화. shadow·orch 0 → 발신 0(비-침습).
          failover: false, shadow: true, region: { lo: 0, hi: H }, sibling: rep.sibling || null, boundary: H, orch: null,
        },
      };
      placement.set(rep.newAddr, rep.newHost);
      await cluster.spawnOne(rep.newHost);
      await cluster.rpc(rep.newHost, { cmd: 'init', specs: [shadowSpec] });
      await cluster.rpc(rep.newHost, { cmd: 'loadstate', addr: rep.newAddr, state: snap });   // 스냅샷 상태 주입(late-join 복구)
      cluster.reprovAddrs.push(rep.newAddr);
      cluster.mirrors.push({ srcAddr: rep.srcAddr, dstAddr: rep.newAddr, dstHost: rep.newHost });
    }
  }

  // ── 재연결+펜싱(0012 분단 경로) — 분단 호스트가 복귀(살아 있음)해도 펜스로 출력 수용 0. ──
  if (part) { await cluster.fence(partHost, part.host); cluster.deadAddrs.add(part.host); }

  const snaps = await cluster.snapshotAll();
  const clusterInfo = {
    pids: cluster.pids(), livePids: cluster.livePids(), parentPid: process.pid, hostIds: cluster.hostIds.slice(),
    pidByHost: [...cluster._pids.entries()],   // hostId→pid (hello 순서 무관 정확 매핑)
    placement: [...placement.entries()],
    port: cluster.port,
    ipcMsgs: cluster.frames, ipcBytes: cluster.bytes,
    ipcMsgsIn: cluster.framesIn, ipcBytesIn: cluster.bytesIn,
    frames: cluster.frames, socketBytes: cluster.bytes,
    framesIn: cluster.framesIn, socketBytesIn: cluster.bytesIn,
    allSerializable: cluster.allSerializable, wire: 'topic-bus',
    publishes: cluster.publishes, topics: [...cluster.subs.keys()], tapDeliveries: cluster.tapDeliveries,
    dropped: cluster.dropped, resends: cluster.resends, dupCmds: cluster.dupCmds, idempotentHits: cluster.idempotentHits,
    partitionHost: part ? part.host : null, partitionAt: part ? part.at : null,
    fencedHost: cluster.fencedHost, reconnectedAlive: cluster.reconnectedAlive, fencedAttempts: cluster.fencedAttempts,
    // ── 진짜 kill 생애주기 계측(0013) ──
    killedHost: kill ? kill.host : null, killAt: kill ? kill.at : null,
    killed: [...cluster.killed], socketClosed: cluster.socketClosed,
    presumedDead: [...cluster.presumedDead], presumedDeadTick: [...cluster.presumedDeadTick.entries()],
    epoch: cluster.epoch, epochFenced: cluster.epochFenced,
    falsedeathHost: fd ? fd.host : null, falsedeathAt: fd ? fd.at : null, healAt: fd ? fd.healAt : null,
    reprovisioned: cluster.reprovisioned.slice(), reprovAddrs: cluster.reprovAddrs.slice(),
    mirrorDeliveries: cluster.mirrorDeliveries, deadAddrs: [...cluster.deadAddrs],
    invRestarted: cluster.invRestarted,   // 0017 가방 failover
    rankRestarted: cluster.rankRestarted, // 0020 읽기 모델(랭킹) failover
    chatRestarted: cluster.chatRestarted, // 0021 채팅 failover
  };
  await cluster.shutdown();
  return reconstruct(net_, topo, snaps, placement, clusterInfo, opts);
}

// 스냅샷 → run() 과 같은 형태의 r 로 재구성 + dead 주소(kill/fence/추측사망) 를 dead 로 표기(소유자=1 보존).
//   죽은 프로세스(스냅샷 불가)는 dead 빈 프록시로 합성 — fullDigest 는 비권위라 무관(비트 동일 보존).
function reconstruct(net_, topo, snaps, placement, clusterInfo, opts) {
  const byAddr = new Map();
  for (const snap of snaps.values()) for (const addr of Object.keys(snap)) byAddr.set(addr, snap[addr]);
  const deadSet = new Set(clusterInfo.deadAddrs || []);

  const deadProxy = (addr) => ({
    addr, region: { lo: 0, hi: topo.H }, dead: true, shadow: false,
    ents: new Map(), outbox: new Map(), promotionKeyframes: 0, leasesSent: 0,
    isAuthority() { return false; },
  });
  const zoneProxy = (addr, s) => {
    if (!s) return deadProxy(addr);
    return {
      addr: s.addr, region: s.region, dead: s.dead || deadSet.has(s.addr), shadow: s.shadow,
      ents: new Map(s.ents.map(([id, e]) => [id, { x: e.x, y: e.y }])),
      outbox: new Map(),
      promotionKeyframes: s.promotionKeyframes, leasesSent: s.leasesSent,
      isAuthority() { return !this.dead && !this.shadow; },
    };
  };
  const clientProxy = (s) => {
    const seen = new Map(s.seen.map(([id, e]) => [id, { x: e.x, y: e.y }]));
    const items = new Set(s.items || []);       // 가방 belief(0014)
    const chatRecv = new Set(s.chatRecv || []); // 채팅 belief(0015)
    return {
      addr: s.addr, avatar: s.avatar, views: s.views, seen, items, chatRecv,
      rankBelief: (s.rankBelief == null) ? null : s.rankBelief,   // 랭킹 belief(0019) — rankDesync 재구성용
      naksSent: s.naksSent, staleDrops: s.staleDrops,
      seenIds() { return [...seen.keys()].sort(); },
      seenSig() { return [...seen.entries()].map(([id, e]) => id + '@' + e.x + ',' + e.y).sort().join(';'); },
      itemsSig() { return [...items].sort().join(','); },
      chatSig() { return [...chatRecv].sort().join(';'); },
    };
  };
  // 가방 서비스(0014) 재구성 — 원장·역인덱스를 Map/Set 으로 복원(run() r.inventory 와 같은 형태 → 같은 digest 함수).
  const invSnap = byAddr.get('inventory');
  const inventory = invSnap ? {
    ledger: new Map(invSnap.ledger),
    byOwner: new Map((invSnap.byOwner || []).map(([o, arr]) => [o, new Set(arr)])),
    minted: invSnap.minted, transfers: invSnap.transfers, failedOps: invSnap.failedOps,
    itemCount() { return this.ledger.size; }, ownerOf(id) { return this.ledger.get(id); },
  } : null;
  // 채팅 서비스(0015) 재구성 — 구독 테이블·역인덱스·deliveries 를 Map/Set 으로 복원(run() r.chat 과 같은 형태 → 같은 digest 함수).
  const chatSnap = byAddr.get('chat');
  const chat = chatSnap ? {
    channels: new Map((chatSnap.channels || []).map(([ch, arr]) => [ch, new Set(arr)])),
    byAvatar: new Map((chatSnap.byAvatar || []).map(([av, e]) => [av, { gateway: e.gateway, region: e.region, subs: new Set(e.subs) }])),
    deliveries: chatSnap.deliveries || [],
    joins: chatSnap.joins, says: chatSnap.says, whispers: chatSnap.whispers, whisperFails: chatSnap.whisperFails, fanout: chatSnap.fanout,
    subscriberCount(ch) { const s = this.channels.get(ch); return s ? s.size : 0; },
  } : null;
  // 이벤트 버스(0016) 재구성 — 토픽 라우팅 테이블·발행/팬아웃 회계를 복원(run() r.bus 와 같은 형태 → 같은 digest 함수).
  const busSnap = byAddr.get('bus');
  const bus = busSnap ? {
    topics: new Map((busSnap.topics || []).map(([t, arr]) => [t, arr.slice()])),
    publishes: busSnap.publishes, deliveries: busSnap.deliveries, unrouted: busSnap.unrouted,
    subscriberCount(t) { const a = this.topics.get(t); return a ? a.length : 0; },
  } : null;
  // 감사(0016 새 소비자) 재구성 — 관찰 스트림(records)·토픽별 수신 회계를 복원.
  const auditSnap = byAddr.get('audit');
  const audit = auditSnap ? { seen: new Map(auditSnap.seen || []), records: auditSnap.records || [] } : null;
  // 랭킹(0019 발신하는 소비자) 재구성 — rank 투영 테이블·소비/발행 회계를 복원(run() r.ranking 과 같은 형태 → 같은 digest 함수).
  const rankingSnap = byAddr.get('ranking');
  const ranking = rankingSnap ? { ranks: new Map(rankingSnap.ranks || []), consumed: rankingSnap.consumed || 0, published: rankingSnap.published || 0 } : null;
  // 영속 스토어(0017 데이터 계층) 재구성 — 저널(효과 로그)을 복원(run() r.persist 와 같은 형태 → 같은 digest 함수).
  //   가방이 죽어도 persist 호스트는 안 죽으므로 저널이 온전하다(snapshotAll 이 정상 수집).
  const persistSnap = byAddr.get('persist');
  const persist = persistSnap ? {
    journal: (persistSnap.journal || []).slice(), writes: persistSnap.writes,
    snapshot: persistSnap.snapshot || null, snapshots: persistSnap.snapshots || 0, compacted: persistSnap.compacted || 0,   // 스냅샷 압축(0018)
    size() { return this.journal.length; },
  } : null;
  // 채팅 영속 스토어(0021 데이터 계층) 재구성 — 채팅 커맨드 로그를 복원(run() r.chatpersist 와 같은 형태 → 같은 digest 함수).
  //   채팅이 죽어도 chatpersist 호스트는 안 죽으므로 커맨드 로그가 온전하다(snapshotAll 이 정상 수집).
  const chatPersistSnap = byAddr.get('chatpersist');
  const chatpersist = chatPersistSnap ? {
    journal: (chatPersistSnap.journal || []).slice(), writes: chatPersistSnap.writes,
    snapshot: chatPersistSnap.snapshot || null, snapshots: chatPersistSnap.snapshots || 0, compacted: chatPersistSnap.compacted || 0,   // 라우팅 스냅샷 압축(이 step)
    size() { return this.journal.length; },
  } : null;

  const zoneObjs = topo.zoneAddrs.map(a => zoneProxy(a, byAddr.get(a)));
  const followers = ['zone1f', 'zone2f'].filter(a => byAddr.get(a)).map(a => zoneProxy(a, byAddr.get(a)));
  const reprovZones = (clusterInfo.reprovAddrs || []).filter(a => byAddr.get(a)).map(a => zoneProxy(a, byAddr.get(a)));
  const clis = topo.specs.filter(s => s.kind === 'client').map(s => clientProxy(byAddr.get(s.addr)));
  const allZones = zoneObjs.concat(followers).concat(reprovZones);
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
    net: net_, zones: zoneObjs, followers, reprovZones, allZones, zoneAddrs: topo.zoneAddrs, clients: clis, inventory, chat, bus, audit, ranking, persist, chatpersist,
    totals, H: topo.H, grid: topo.grid, radius: topo.radius,
    deathTick: opts.deathTick != null ? opts.deathTick : null, killZone: opts.killZone || 'zone1',
    orch: orchSnap ? { promotions: orchSnap.promotions, deathSeen: new Map(orchSnap.deathSeen) } : null,
    cluster: clusterInfo, mode: 'multiproc',
  };
}

module.exports = { runMulti, Cluster, computePlacement, frameOf, Framer };
