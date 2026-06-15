// HktInfra step-0039 — broker(버스 허브). 멀티프로세스 lockstep 배리어를 *토픽 pub/sub 버스* 위에서 구동한다(Node 전용).
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
//
// [step-0039 분할] 이 파일은 *Cluster 클래스*(broker 버스 허브)만 담는다 — frameOf/Framer 는 cluster-wire.js, computePlacement/runMulti 는
//   cluster-run.js, reconstruct 는 cluster-reconstruct.js 로 분리(45KB>30KB 박스 트리거 정리·기능 0·바이트 동일·reg 0). 진입점 = cluster.js.
'use strict';
const net = require('net');
const { spawn } = require('child_process');
const path = require('path');
const { fnv1a } = require('../engine/index.js');
const { frameOf, Framer } = require('./cluster-wire.js');

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

module.exports = { Cluster };
