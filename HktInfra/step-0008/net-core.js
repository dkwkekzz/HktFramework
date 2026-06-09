// HktInfra step-0008 — 전송 열화 아래 핸드오프 + 반응적 복원 (reactive recovery)
// step-0007(증분 AOI) 위에 *한 조각*만 더한다:
//   0006 핸드오프·0007 증분은 모두 *행복 경로*(전송 무손실)에서만 검증됐다 — 둘 다 손실에 취약하다:
//     (a) 핸드오프 토큰이 버스에서 유실되면 → *권위 공백*(어느 존도 안 씀 = 권위 보존 위반).
//     (b) 증분 델타 1개가 유실되면 → 클라 seen 이 *영구 desync*(전체 스냅샷의 자가치유 상실, 0007 §8.1).
//   이 step 은 0004 의 전송 모델(지연·손실)을 *핸드오프·증분 라우트*에 입히고, 그 위에 **반응적 복원**을 더한다:
//     · 핸드오프: ack + 재전송(sender-retained outbox) — 토큰 유실 → 재전송. 권위-of-record 를 ack 까지 보유 → *공백 0*.
//     · 증분:    seq + NAK + keyframe 재동기 + heartbeat — 델타 유실(seq 점프) → NAK → 존이 reset(키프레임) 재발행.
//                꼬리 유실(후속 델타 없음 → 감지 불가)은 heartbeat(주기적 키프레임)로 상한.
//
// 0007 과의 관계: 존은 여전히 *시뮬하지 않는다*. 분할·핸드오프·경계 ghost·증분도 그대로. 바뀐 것은:
//   ① 핸드오프를 fire-and-forget → ack/재전송(권위-of-record outbox)로  ② 증분에 seq/NAK/keyframe/heartbeat 추가
//   ③ 전송 모델을 핸드오프·증분 라우트에 입힘(routeFilter).  **recovery=false 면 0007 코드 경로를 안 탄다 → reg 0.**
//
// 핵심 설계:
//   - **sender-retained outbox(권위-of-record)**: release 한 존이 토큰을 outbox 에 보관하고 ack 까지 재전송한다.
//     토큰이 유실돼도 권위는 outbox(=권위-of-record)에 *항상* 있다 → 공백이 *발생하지 않는다*(0007 의 즉시-삭제는
//     유실 시 공백). receiver 는 handoffId 로 *멱등 acquire*(재전송 중복 → 위치 덮어쓰기 0), 첫 수신 시 ack.
//   - **seq 연속성(핸드오프 너머)**: 핸드오프 토큰이 lastSeq 를 실어, 새 존이 그 세션의 델타 seq 를 *이어서* 매긴다.
//     → 클라가 보는 seq 가 존 이주에도 단조 → 손실 감지가 핸드오프 너머에서도 작동(이주 직후 reset 이 동시에 재동기).
//   - **NAK 은닉**: 클라는 {resync} 만 보낸다(세션·존 모름). 게이트웨이가 sessionId 붙여 전 존에 흩뿌리고, 소유 존만 응답.
//
// 척추(SPINE.md) 준수:
//   - 신성한 tick: 존 tick 안엔 위치 갱신 + 핸드오프(ack/재전송) + ghost + 증분(seq/keyframe) 발행만(I/O·인증 0). 복원은 메모리/메시지.
//   - 권위 단일 소유: 권위-of-record outbox 로 *유실 중에도* 소유자 정확히 1(공백 0). 멱등 acquire 로 이중쓰기 0.
//   - 은닉·단일 연결: 클라는 게이트웨이만. seq 는 단순 카운터(토폴로지 아님), NAK 은 sessionId 없이. 내부 누설 0.
'use strict';
const __engine = (typeof module !== 'undefined' && module.exports && typeof require !== 'undefined')
  ? require('../engine/index.js')
  : globalThis.HktEngine;
const { Net, LoginServer, SessionRegistry, mulberry32, fnv1a } = __engine;

// 복원 파라미터(하드코딩 지양 — opts 로 오버라이드 가능, 결정론 고정 상수). hkt.recovery.* 노브의 더미 판.
const DEFAULTS = { retxPeriod: 2, resyncPeriod: 3, heartbeat: 10 };

// ── [엣지] 게이트웨이 — 0007 과 동일 + NAK(resync) 중계 + view_delta 에 seq 통과 ──
class Gateway {
  constructor(zoneAddrs) {
    this.zones = zoneAddrs;
    this.byClient = new Map();
    this.bySession = new Map();
    this.dropped = 0;
    this.rejected = 0;
  }
  onMsg(m) {
    const p = m.payload;
    if (m.from === 'registry') {
      if (p.type === 'validate_ok') {
        const bind = { client: p.ref, sessionId: p.sessionId, avatar: p.avatar };
        this.byClient.set(p.ref, bind);
        this.bySession.set(p.sessionId, bind);
        this.net.send(this.addr, this.zones[0], { type: 'enter', sessionId: p.sessionId, avatar: p.avatar });
        this.net.send(this.addr, p.ref, { type: 'connect_ok', avatar: p.avatar });
      } else if (p.type === 'validate_fail') {
        this.rejected++;
        this.net.send(this.addr, p.ref, { type: 'connect_fail' });
      }
      return;
    }
    if (m.from.startsWith('zone')) {
      if (p.type === 'view') {            // 전체 스냅샷 중계(0007 호환)
        const bind = this.bySession.get(p.sessionId);
        if (bind) this.net.send(this.addr, bind.client, { type: 'view', entities: p.entities });
      } else if (p.type === 'view_delta') {  // 증분 중계 — sessionId 박리, seq 는 통과(클라 손실 감지용)
        const bind = this.bySession.get(p.sessionId);
        if (bind) this.net.send(this.addr, bind.client, { type: 'view_delta', reset: p.reset, enter: p.enter, exit: p.exit, update: p.update, seq: p.seq });
      }
      return;
    }
    if (p.type === 'connect') {
      if (this.byClient.has(m.from)) { this.rejected++; this.net.send(this.addr, m.from, { type: 'connect_fail' }); return; }
      this.net.send(this.addr, 'registry', { type: 'validate', ticket: p.ticket, ref: m.from });
    } else if (p.type === 'move') {
      const bind = this.byClient.get(m.from);
      if (bind) for (const z of this.zones) this.net.send(this.addr, z, { type: 'move', sessionId: bind.sessionId, avatar: bind.avatar, d: p.d });
      else this.dropped++;
    } else if (p.type === 'resync') {   // 클라 NAK — 세션 붙여 전 존에 흩뿌림(소유 존만 응답). 클라는 세션·존 모름(은닉)
      const bind = this.byClient.get(m.from);
      if (bind) for (const z of this.zones) this.net.send(this.addr, z, { type: 'resync', sessionId: bind.sessionId });
      else this.dropped++;
    } else if (p.type === 'disconnect') {
      const bind = this.byClient.get(m.from);
      if (!bind) return;
      for (const z of this.zones) this.net.send(this.addr, z, { type: 'leave', sessionId: bind.sessionId, avatar: bind.avatar });
      this.net.send(this.addr, 'registry', { type: 'session_closed', sessionId: bind.sessionId });
      this.net.send(this.addr, m.from, { type: 'disconnect_ok' });
      this.byClient.delete(m.from);
      this.bySession.delete(bind.sessionId);
    }
  }
}

// ── [월드] 분할 존 — 0007 + 핸드오프 ack/재전송 + 증분 seq/NAK/keyframe/heartbeat(recovery=true 일 때만) ──
class EntityZone {
  constructor(seed, opts = {}) {
    this.rng = mulberry32((seed ^ 0x5A17) >>> 0);
    this.grid = opts.grid || 16;
    this.radius = opts.radius !== undefined ? opts.radius : 4;
    this.incremental = opts.incremental !== false;
    this.recovery = opts.recovery === true;        // 이 step 의 토글 — false 면 0007(행복 경로) 비트 동일
    this.retxPeriod = opts.retxPeriod || DEFAULTS.retxPeriod;   // 핸드오프 재전송 주기(tick)
    this.heartbeat = opts.heartbeat || DEFAULTS.heartbeat;      // 주기적 키프레임(꼬리 유실 상한)
    const G = this.grid;
    this.region = opts.region || { lo: 0, hi: G };
    this.sibling = opts.sibling || null;
    this.boundary = opts.boundary !== undefined ? opts.boundary : G / 2;
    const band = this.radius;
    this.bandLo = (this.region.hi === this.boundary) ? this.boundary - band : this.boundary;
    this.bandHi = (this.region.hi === this.boundary) ? this.boundary : this.boundary + band;
    this.ents = new Map();        // avatar -> {x,y}  (소유 = 쓰기 권위)
    this.ghosts = new Map();
    this.sessions = new Map();    // sessionId -> {gateway, avatar}
    this.prevSeen = new Map();    // sessionId -> Map(id->{x,y})  (증분 기준)
    this.pending = [];
    this.curTick = 0;
    // 증분 seq/keyframe 상태(recovery)
    this.deltaSeqOf = new Map();  // sessionId -> 마지막 *발신* 델타 seq (핸드오프로 이어짐)
    this.lastKeyframe = new Map();// sessionId -> 마지막 reset(키프레임) tick (heartbeat 기준)
    this.needsKeyframe = new Set();// NAK 으로 다음 tick reset 강제할 세션
    // 핸드오프 ack/재전송 상태(recovery)
    this.outbox = new Map();      // handoffId -> {avatar,x,y,sessionId,gateway,lastSeq,lastSent,retries}  (권위-of-record, ack 까지 보유)
    this.acquired = new Set();    // 수신 처리한 handoffId (멱등 acquire — 재전송 중복 무시)
    this.handoffSeq = 0;
    // 회계
    this.sent = 0; this.views = 0;
    this.handoffsSent = 0; this.handoffsAcquired = 0;
    this.ghostMsgs = 0; this.ghostEntsSent = 0;
    this.deltaEnter = 0; this.deltaExit = 0; this.deltaUpdate = 0; this.deltaMsgs = 0; this.resets = 0;
    this.retransmits = 0; this.acksRx = 0; this.naksRx = 0; this.keyframesForced = 0; this.heartbeats = 0;
  }
  owns(x) { return x >= this.region.lo && x < this.region.hi; }
  inBand(x) { return x >= this.bandLo && x < this.bandHi; }
  near(a, b) { return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) <= this.radius; }
  sessionOf(avatar) {
    for (const [sid, s] of this.sessions) if (s.avatar === avatar) return { id: sid, gateway: s.gateway };
    return null;
  }
  onMsg(m) {
    const p = m.payload;
    if (p.type === 'enter') {
      this.sessions.set(p.sessionId, { gateway: m.from, avatar: p.avatar });
      this.ents.set(p.avatar, { x: this.rng() % this.grid, y: this.rng() % this.grid });
    } else if (p.type === 'move') {
      if (this.ents.has(p.avatar)) this.pending.push(p);
    } else if (p.type === 'leave') {
      this.sessions.delete(p.sessionId);
      this.prevSeen.delete(p.sessionId);
      this.deltaSeqOf.delete(p.sessionId);
      this.lastKeyframe.delete(p.sessionId);
      this.ents.delete(p.avatar);
    } else if (p.type === 'handoff') {       // acquire
      if (this.recovery && p.handoffId !== undefined) {
        // 멱등 acquire — 재전송 중복은 다시 ack 만(위치 덮어쓰기 0). ack 은 신뢰(행복 경로) — 유실돼도 sender 재전송이 메움.
        if (!this.acquired.has(p.handoffId)) {
          this.acquired.add(p.handoffId);
          this.ents.set(p.avatar, { x: p.x, y: p.y });
          if (p.sessionId) {
            this.sessions.set(p.sessionId, { gateway: p.gateway, avatar: p.avatar });
            this.deltaSeqOf.set(p.sessionId, p.lastSeq);  // seq 이어받기 — 클라가 보는 seq 단조 유지
          }
          this.handoffsAcquired++;
          // prevSeen 없음 → 다음 tick reset(키프레임)으로 클라 재동기(0007 패턴)
        }
        this.net.send(this.addr, m.from, { type: 'handoff_ack', handoffId: p.handoffId });
      } else {
        // 0007 경로(recovery off) — fire-and-forget acquire(ack 없음)
        this.ents.set(p.avatar, { x: p.x, y: p.y });
        if (p.sessionId) this.sessions.set(p.sessionId, { gateway: p.gateway, avatar: p.avatar });
        this.handoffsAcquired++;
      }
    } else if (p.type === 'handoff_ack') {   // sender — 권위-of-record 해제(전송 확인)
      if (this.outbox.delete(p.handoffId)) this.acksRx++;
    } else if (p.type === 'resync') {        // NAK — 다음 tick reset(키프레임) 강제
      if (this.sessions.has(p.sessionId)) { this.needsKeyframe.add(p.sessionId); this.naksRx++; }
    } else if (p.type === 'ghosts') {
      this.ghosts = new Map(p.ents.map(e => [e.id, { x: e.x, y: e.y }]));
    }
  }
  visibleFor(me) {
    const vis = new Map();
    for (const [id, e] of this.ents) if (this.near(me, e)) vis.set(id, { x: e.x, y: e.y });
    for (const [id, e] of this.ghosts) if (this.near(me, e)) vis.set(id, { x: e.x, y: e.y });
    return vis;
  }
  onTick(tick) {
    this.curTick = tick || 0;
    // ① 이동 적용
    for (const p of this.pending) {
      const e = this.ents.get(p.avatar);
      if (e) { e.x = (e.x + p.d.dx + this.grid) % this.grid; e.y = (e.y + p.d.dy + this.grid) % this.grid; }
    }
    this.pending = [];
    // ② 핸드오프(release) — region 밖 소유 엔터티를 sibling 으로 이주
    if (this.sibling) {
      for (const [avatar, e] of [...this.ents]) {
        if (!this.owns(e.x)) {
          const s = this.sessionOf(avatar);
          if (this.recovery) {
            // 권위-of-record: outbox 에 보관하고 ack 까지 재전송 → 토큰 유실돼도 공백 0
            const handoffId = this.addr + ':' + (this.handoffSeq++);
            const lastSeq = s ? (this.deltaSeqOf.get(s.id) ?? -1) : -1;
            const rec = { avatar, x: e.x, y: e.y, sessionId: s ? s.id : null, gateway: s ? s.gateway : null, lastSeq, lastSent: this.curTick, retries: 0 };
            this.outbox.set(handoffId, rec);
            this.net.send(this.addr, this.sibling, { type: 'handoff', handoffId, avatar, x: e.x, y: e.y, sessionId: rec.sessionId, gateway: rec.gateway, lastSeq });
          } else {
            this.net.send(this.addr, this.sibling, { type: 'handoff', avatar, x: e.x, y: e.y, sessionId: s ? s.id : null, gateway: s ? s.gateway : null });
          }
          this.ents.delete(avatar);
          if (s) { this.sessions.delete(s.id); this.prevSeen.delete(s.id); this.deltaSeqOf.delete(s.id); this.lastKeyframe.delete(s.id); }
          this.handoffsSent++;
        }
      }
    }
    // ②b 재전송 — outbox 의 미-ack 토큰을 재전송 주기마다(권위-of-record 가 유실을 메운다)
    if (this.recovery && this.outbox.size) {
      for (const [hid, rec] of this.outbox) {
        if (this.curTick - rec.lastSent >= this.retxPeriod) {
          rec.lastSent = this.curTick; rec.retries++; this.retransmits++;
          this.net.send(this.addr, this.sibling, { type: 'handoff', handoffId: hid, avatar: rec.avatar, x: rec.x, y: rec.y, sessionId: rec.sessionId, gateway: rec.gateway, lastSeq: rec.lastSeq });
        }
      }
    }
    // ③ 경계 띠 상호 구독(ghost)
    if (this.sibling) {
      const band = [];
      for (const [avatar, e] of this.ents) if (this.inBand(e.x)) band.push({ id: avatar, x: e.x, y: e.y });
      this.net.send(this.addr, this.sibling, { type: 'ghosts', ents: band });
      this.ghostMsgs++;
      this.ghostEntsSent += band.length;
    }
    // ④ AOI 발행 — 전체 스냅샷(0007 호환) 또는 증분(+seq/keyframe/heartbeat)
    for (const [sessionId, s] of this.sessions) {
      const me = this.ents.get(s.avatar);
      if (!me) continue;
      if (!this.incremental) {
        const visible = [];
        for (const [id, e] of this.ents) if (this.near(me, e)) visible.push({ id, x: e.x, y: e.y });
        for (const [id, e] of this.ghosts) if (this.near(me, e)) visible.push({ id, x: e.x, y: e.y });
        this.sent += visible.length; this.views++;
        this.net.send(this.addr, s.gateway, { type: 'view', sessionId, entities: visible });
        continue;
      }
      const cur = this.visibleFor(me);
      const prev = this.prevSeen.get(sessionId);
      if (!this.recovery) {
        // ── 0007 증분(seq 없음) — recovery off 면 비트 동일 ──
        const reset = !prev;
        const enter = [], exit = [], update = [];
        for (const [id, e] of cur) {
          if (reset) { enter.push({ id, x: e.x, y: e.y }); continue; }
          const pe = prev.get(id);
          if (!pe) enter.push({ id, x: e.x, y: e.y });
          else if (pe.x !== e.x || pe.y !== e.y) update.push({ id, x: e.x, y: e.y });
        }
        if (!reset) for (const id of prev.keys()) if (!cur.has(id)) exit.push(id);
        this.prevSeen.set(sessionId, cur);
        if (!reset && enter.length === 0 && exit.length === 0 && update.length === 0) continue;
        this.deltaEnter += enter.length; this.deltaExit += exit.length; this.deltaUpdate += update.length;
        this.deltaMsgs++; if (reset) this.resets++;
        this.net.send(this.addr, s.gateway, { type: 'view_delta', sessionId, reset, enter, exit, update });
        continue;
      }
      // ── 증분 + 복원(recovery) — reset 사유: 신규/핸드오프(prev 없음) · NAK(needsKeyframe) · heartbeat(꼬리 유실 상한) ──
      const forced = this.needsKeyframe.has(sessionId);
      const lastKf = this.lastKeyframe.get(sessionId);
      const hb = lastKf === undefined || (this.curTick - lastKf) >= this.heartbeat;
      const reset = !prev || forced || hb;
      const enter = [], exit = [], update = [];
      for (const [id, e] of cur) {
        if (reset) { enter.push({ id, x: e.x, y: e.y }); continue; }
        const pe = prev.get(id);
        if (!pe) enter.push({ id, x: e.x, y: e.y });
        else if (pe.x !== e.x || pe.y !== e.y) update.push({ id, x: e.x, y: e.y });
      }
      if (!reset) for (const id of prev.keys()) if (!cur.has(id)) exit.push(id);
      this.prevSeen.set(sessionId, cur);
      // 무발신: reset 아니고 변화 0 → 안 보냄(seq 도 안 올림 → 클라가 idle 을 손실로 오인 안 함)
      if (!reset && enter.length === 0 && exit.length === 0 && update.length === 0) continue;
      const seq = (this.deltaSeqOf.get(sessionId) ?? -1) + 1;
      this.deltaSeqOf.set(sessionId, seq);
      this.deltaEnter += enter.length; this.deltaExit += exit.length; this.deltaUpdate += update.length;
      this.deltaMsgs++;
      if (reset) {
        this.resets++;
        this.lastKeyframe.set(sessionId, this.curTick);
        if (forced) { this.needsKeyframe.delete(sessionId); this.keyframesForced++; }
        else if (hb && prev) this.heartbeats++;   // 신규(!prev)는 heartbeat 로 세지 않음
      }
      this.net.send(this.addr, s.gateway, { type: 'view_delta', sessionId, reset, enter, exit, update, seq });
    }
  }
}

// ── 클라이언트 — 0007 + seq 기반 손실 감지 → NAK(resync) (recovery 메시지에 seq 가 있을 때만) ──
class Client {
  constructor(script) {
    this.script = script;
    this.phase = 'idle';
    this.ticket = null;
    this.avatar = null;
    this.seen = new Map();
    this.views = 0;
    this.deltasApplied = 0;
    this.events = [];
    this.sent = 0;
    this.rng = null;
    this.curTick = 0;
    // 손실 감지/복원
    this.expectedSeq = 0;
    this.awaitingResync = false;
    this.lastNak = -99;
    this.naksSent = 0;
    this.resyncPeriod = script.resyncPeriod || DEFAULTS.resyncPeriod;
    this.staleDrops = 0;   // 손실 의심으로 적용 보류한 증분 수
  }
  onTick(S) {
    this.curTick = S;
    if (this.script.leaveTick != null && S >= this.script.leaveTick &&
        (this.phase === 'playing' || this.phase === 'settled')) {
      this.phase = 'disconnecting';
      this.net.send(this.addr, 'gateway', { type: 'disconnect' });
      return;
    }
    if (this.phase === 'idle') {
      this.phase = 'authing';
      this.net.send(this.addr, 'login', { type: 'auth', account: this.script.account });
    } else if (this.phase === 'playing') {
      if (this.sent < this.script.moves) {
        const dx = (this.rng() % 3) - 1, dy = (this.rng() % 3) - 1;
        this.net.send(this.addr, 'gateway', { type: 'move', d: { dx, dy } });
        this.sent++;
      } else {
        this.phase = 'settled';
      }
    }
    // 재-NAK — 키프레임이 아직 안 왔으면(awaitingResync) 주기적으로 재요청(키프레임도 유실될 수 있음)
    if (this.awaitingResync && (S - this.lastNak) >= this.resyncPeriod) {
      this.net.send(this.addr, 'gateway', { type: 'resync' });
      this.lastNak = S; this.naksSent++;
    }
  }
  onMsg(m) {
    const p = m.payload;
    this.events.push(p.type);
    if (p.type === 'auth_ok') {
      this.ticket = p.ticket;
      this.phase = 'connecting';
      this.net.send(this.addr, 'gateway', { type: 'connect', ticket: this.ticket });
    } else if (p.type === 'connect_ok') {
      this.phase = 'playing';
      this.avatar = p.avatar;
      this.rng = mulberry32((this.script.seed ^ 0xC11E) >>> 0);
    } else if (p.type === 'connect_fail') {
      this.phase = 'rejected';
    } else if (p.type === 'view') {                 // 전체 스냅샷
      this.views++;
      this.seen = new Map(p.entities.map(e => [e.id, { x: e.x, y: e.y }]));
    } else if (p.type === 'view_delta') {
      this.views++;
      if (p.seq === undefined) {                    // 0007 경로(seq 없음) — 누적 적용
        this.deltasApplied++;
        if (p.reset) this.seen = new Map();
        for (const e of p.enter) this.seen.set(e.id, { x: e.x, y: e.y });
        for (const e of p.update) this.seen.set(e.id, { x: e.x, y: e.y });
        for (const id of p.exit) this.seen.delete(id);
        return;
      }
      // ── recovery — seq 로 손실 감지, reset(키프레임)은 자기완결(seq 무관 재동기) ──
      if (p.reset) {
        if (p.seq >= this.expectedSeq) {            // 최신 키프레임만 채택(이주 연속 seq · NAK · heartbeat)
          this.seen = new Map();
          for (const e of p.enter) this.seen.set(e.id, { x: e.x, y: e.y });
          for (const e of p.update) this.seen.set(e.id, { x: e.x, y: e.y });
          this.expectedSeq = p.seq + 1;
          this.awaitingResync = false;
          this.deltasApplied++;
        }
        return;
      }
      if (p.seq === this.expectedSeq) {             // 순서대로 — 누적 적용
        for (const e of p.enter) this.seen.set(e.id, { x: e.x, y: e.y });
        for (const e of p.update) this.seen.set(e.id, { x: e.x, y: e.y });
        for (const id of p.exit) this.seen.delete(id);
        this.expectedSeq++;
        this.deltasApplied++;
      } else if (p.seq > this.expectedSeq) {        // seq 점프 = 그 사이 델타 유실 → NAK(키프레임 대기, 적용 보류)
        this.staleDrops++;
        if (!this.awaitingResync || (this.curTick - this.lastNak) >= this.resyncPeriod) {
          this.net.send(this.addr, 'gateway', { type: 'resync' });
          this.lastNak = this.curTick; this.naksSent++;
        }
        this.awaitingResync = true;
      }                                             // seq < expected: 구/중복 → 무시
    } else if (p.type === 'disconnect_ok') {
      this.phase = 'done';
    }
  }
  seenIds() { return [...this.seen.keys()].sort(); }
  seenSig() {
    return [...this.seen.entries()].map(([id, e]) => id + '@' + e.x + ',' + e.y).sort().join(';');
  }
}

// ── routeFilter — 어느 라우트에 전송 열화를 입힐지(핸드오프 토큰 · 증분 델타). ack/NAK/keyframe-경로 외 제어는 신뢰 ──
//  핸드오프: zone→zone, type=handoff(재전송 포함).  델타: zone→gateway, type=view_delta.
//  ack(handoff_ack)·NAK(resync)·뷰 중계(gateway→client)는 매칭 안 됨 = 행복 경로(신뢰 제어 평면 + 손실 벌크).
const routeFilters = {
  handoff: (m) => /^zone/.test(m.from) && /^zone/.test(m.to) && m.payload.type === 'handoff',
  delta: (m) => /^zone/.test(m.from) && m.to === 'gateway' && m.payload.type === 'view_delta',
  both: (m) => (/^zone/.test(m.from) && /^zone/.test(m.to) && m.payload.type === 'handoff') ||
               (/^zone/.test(m.from) && m.to === 'gateway' && m.payload.type === 'view_delta'),
};

// ── 하니스 ──
// opts: { seed, ticks, clients, moves, radius, grid, zones, incremental, recovery, transport, leave, retxPeriod, heartbeat, resyncPeriod }
function run(opts) {
  const {
    seed, ticks = 48, clients = 6, moves = 30, radius = 4, grid = 16, zones = 2,
    incremental = true, recovery = false, transport = null, leave = {},
    retxPeriod, heartbeat, resyncPeriod,
  } = opts;
  const accounts = [];
  for (let i = 0; i < clients; i++) accounts.push('hero' + i);

  const net = new Net({ transport, seed });
  const login = new LoginServer(accounts, seed);
  const registry = new SessionRegistry();
  const H = Math.floor(grid / 2);

  const zoneObjs = [];
  const zoneAddrs = [];
  const zopt = { grid, radius, incremental, recovery, retxPeriod, heartbeat };
  if (zones === 1) {
    zoneObjs.push(new EntityZone(seed, { ...zopt, region: { lo: 0, hi: grid }, sibling: null, boundary: grid }));
    zoneAddrs.push('zone1');
  } else {
    zoneObjs.push(new EntityZone(seed, { ...zopt, region: { lo: 0, hi: H }, sibling: 'zone2', boundary: H }));
    zoneObjs.push(new EntityZone(seed, { ...zopt, region: { lo: H, hi: grid }, sibling: 'zone1', boundary: H }));
    zoneAddrs.push('zone1', 'zone2');
  }

  const gateway = new Gateway(zoneAddrs);
  net.register('login', login);
  net.register('registry', registry);
  net.register('gateway', gateway);
  zoneObjs.forEach((z, i) => net.register(zoneAddrs[i], z));

  const clis = [];
  for (let i = 0; i < clients; i++) {
    const c = new Client({ account: accounts[i], seed: (seed + i * 0x9E37) >>> 0, moves, leaveTick: leave[i] != null ? leave[i] : null, resyncPeriod });
    net.register('client' + i, c);
    clis.push(c);
  }

  const trace = [];        // {tick, committed, inflight(Set), liveN} — 권위 보존(outbox=권위-of-record 포함)
  const seenTrace = [];    // tick 별 [각 클라 seenSig]
  const deltaTrace = [];   // tick 별 증분 레코드 합
  let prevDeltaRec = 0;
  for (let i = 0; i < ticks; i++) {
    net.step();
    const committed = new Map();
    for (const z of zoneObjs) for (const av of z.ents.keys()) committed.set(av, (committed.get(av) || 0) + 1);
    const inflight = inflightSet(net, zoneObjs);   // 버스 토큰 ∪ outbox(권위-of-record) — avatar 단위
    const live = new Set([...committed.keys(), ...inflight]);
    trace.push({ tick: i + 1, committed, inflight, liveN: live.size });
    seenTrace.push(clis.map(c => c.seenSig()));
    const curDeltaRec = zoneObjs.reduce((a, z) => a + z.deltaEnter + z.deltaExit + z.deltaUpdate, 0);
    deltaTrace.push(curDeltaRec - prevDeltaRec); prevDeltaRec = curDeltaRec;
  }
  const sum = (f) => zoneObjs.reduce((a, z) => a + f(z), 0);
  const totals = {
    sent: sum(z => z.sent), views: sum(z => z.views),
    handoffs: sum(z => z.handoffsSent), acquired: sum(z => z.handoffsAcquired),
    ghostEnts: sum(z => z.ghostEntsSent), ghostMsgs: sum(z => z.ghostMsgs),
    deltaEnter: sum(z => z.deltaEnter), deltaExit: sum(z => z.deltaExit), deltaUpdate: sum(z => z.deltaUpdate),
    deltaMsgs: sum(z => z.deltaMsgs), resets: sum(z => z.resets),
    retransmits: sum(z => z.retransmits), acksRx: sum(z => z.acksRx), naksRx: sum(z => z.naksRx),
    keyframesForced: sum(z => z.keyframesForced), heartbeats: sum(z => z.heartbeats),
    naksSent: clis.reduce((a, c) => a + c.naksSent, 0),
    staleDrops: clis.reduce((a, c) => a + c.staleDrops, 0),
  };
  totals.deltaRecords = totals.deltaEnter + totals.deltaExit + totals.deltaUpdate;
  totals.netLost = net.stats.lost;
  return { net, login, registry, gateway, zones: zoneObjs, zoneAddrs, clients: clis, trace, seenTrace, deltaTrace, totals, H, grid, radius };
}

// in-flight 권위 = 버스의 미배달 핸드오프 토큰 ∪ 각 존 outbox(권위-of-record). avatar 단위 dedup.
function inflightSet(net, zoneObjs) {
  const out = new Set();
  for (const msgs of net.queue.values())
    for (const m of msgs)
      if (m.payload && m.payload.type === 'handoff' && !net.delivered.has(m.id)) out.add(m.payload.avatar);
  for (const z of zoneObjs) for (const rec of z.outbox.values()) out.add(rec.avatar);
  return out;
}

// 권위 카운트 — committed 가 있으면 그 수(>1=이중쓰기), 없으면 in-flight 여부(1=이주중, 0=공백).
//  committed 우선 → ack-지연 중복(receiver 소유 + sender outbox 잔존)을 이중쓰기로 오인하지 않음.
function authorityCount(t, avatar) {
  const c = t.committed.get(avatar) || 0;
  if (c > 0) return c;
  return t.inflight.has(avatar) ? 1 : 0;
}

function scanInflightHandoffs(net) {
  const out = [];
  for (const msgs of net.queue.values())
    for (const m of msgs)
      if (m.payload && m.payload.type === 'handoff' && !net.delivered.has(m.id)) out.push(m.payload.avatar);
  return out;
}

function globalAoiTruth(r, avatar) {
  let me = null;
  for (const z of r.zones) if (z.ents.has(avatar)) { me = z.ents.get(avatar); break; }
  if (!me) return null;
  const R = r.radius;
  const out = [];
  for (const z of r.zones) for (const [id, e] of z.ents)
    if (Math.max(Math.abs(me.x - e.x), Math.abs(me.y - e.y)) <= R) out.push(id);
  return out.sort();
}

function ownerOf(r, avatar) {
  for (let i = 0; i < r.zones.length; i++) if (r.zones[i].ents.has(avatar)) return r.zoneAddrs[i];
  return null;
}

const PUBLIC_ADDRS = ['login', 'gateway'];

// ── 모듈 노출 (dual-mode) ───────────
const __hktNet = {
  mulberry32, fnv1a, Net, LoginServer, SessionRegistry, Gateway, EntityZone, Client,
  run, routeFilters, inflightSet, authorityCount, scanInflightHandoffs, globalAoiTruth, ownerOf, PUBLIC_ADDRS, DEFAULTS,
};
if (typeof module !== 'undefined' && module.exports) module.exports = __hktNet;
if (typeof globalThis !== 'undefined') globalThis.HktNet = __hktNet;
