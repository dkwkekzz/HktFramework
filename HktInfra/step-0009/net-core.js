// HktInfra step-0009 — 추종자 승격(failover): 권위 존 사망 → 추종자가 권위를 재구성
// step-0008(반응적 복원) 위에 *한 조각*만 더한다:
//   0008 반응적 복원은 *전송 열화*(부분 손실)는 메운다 — 그러나 *영구 단절*(존 사망, 손실 1.0)은 못 메운다(0008 §8.3):
//     어떤 재전송도 죽은 존의 권위를 못 살린다. 권위가 *통째로 사라진다*.
//   이 step 은 0002 가 세운 추종자 존(입력열만으로 권위와 같은 상태로 수렴)을 *사망 감지 시 권위로 승격*시킨다:
//     · 복제: 추종자(shadow)가 권위와 *같은 입력열*(enter/move/leave + 평행 핸드오프)을 받아 ents 를 lockstep 복제.
//             뷰 미발행·권위 census 미포함(수동). 0002 의 입력 미러 탭을 더미 EntityZone 에 입힌 것.
//     · 감지: 권위 존이 매 tick orch 에 lease(하트비트) 갱신. orch 가 leaseTimeout tick 결손 → 사망 선언.
//     · 승격: orch 가 추종자에 promote → shadow=false(권위로) + 강제 keyframe(클라 재동기, 0008 복원 재사용)
//             + 생존 존에 relink(sibling 재연결) + 게이트웨이 reroute + 반대편 추종자 retire(중복 권위 방지).
//
// 0008 과의 관계: 존은 여전히 *시뮬하지 않는다*. 분할·핸드오프·증분·복원도 그대로. 바뀐 것은:
//   ① 추종자(shadow) 복제 존 추가  ② Orchestrator(코디네이션 박스) 추가 — lease 감지·승격
//   ③ 게이트웨이가 입력을 추종자에도 미러(replica) + 승격 후 reroute.  **failover=false 면 0008 코드 경로 → reg 0.**
//
// 핵심 설계:
//   - **평행 추종자 세계(입력 replay)**: zone1f.sibling=zone2f — 추종자끼리 별도 핸드오프 쌍을 이뤄, 권위 세계
//     (zone1↔zone2)를 *간섭 없이* 거울처럼 복제. 같은 입력 → 같은 결정론 로직 → 같은 ents(상태 전송 0).
//   - **사망 = 영구 단절**: deathTick 이후 dead 존은 onTick/onMsg 무동작(프로세스 죽음 모델). lease 끊김 → orch 감지.
//   - **승격 = shadow→authority + 강제 keyframe**: 추종자는 사망 너머로 *계속 복제*(gap 중에도 클라 move 적용)했으므로
//     승격 즉시 *최신 상태*를 가진다. 강제 keyframe 으로 stale 클라를 재동기(0008 의 needsKeyframe 재사용). seq 는
//     추종자가 lockstep 으로 진행했으니 클라 expected 이상 → reset 수용(은닉: 클라는 그냥 view_delta reset 으로 본다).
//   - **권위 단일 소유(사망 너머)**: 사망~승격 사이 *감지 창*(leaseTimeout)만큼 공백은 *불가피*(사망 전 감지 불가) —
//     0008 의 prevention(권위-of-record)과 달리 failover 는 *bounded gap → 회복*. orch 단일 승격으로 이중쓰기 0(펜싱).
//
// 척추(SPINE.md) 준수:
//   - 신성한 tick: 존 tick 안엔 위치 갱신 + 핸드오프 + ghost + 증분 발행 + lease 송신만(I/O·인증 0). 복제/승격은 메모리/메시지.
//   - 결정론 코어: 추종자는 같은 입력열로 권위와 같은 상태에 수렴(복제=재현, 상태 전송 0바이트).
//   - 권위 단일 소유: 사망 시 bounded gap → orch 단일 승격으로 소유자=1 회복, 이중쓰기 0(펜싱 토큰=orch 단일 결정).
//   - 은닉·단일 연결: 클라는 게이트웨이만. lease/promote/orch 는 서버간 제어 평면 — 클라는 keyframe(view_delta reset)만 본다.
'use strict';
const __engine = (typeof module !== 'undefined' && module.exports && typeof require !== 'undefined')
  ? require('../engine/index.js')
  : globalThis.HktEngine;
const { Net, LoginServer, SessionRegistry, mulberry32, fnv1a } = __engine;

// 복원·failover 파라미터(하드코딩 지양 — opts 로 오버라이드 가능, 결정론 고정 상수). hkt.recovery.*·hkt.failover.* 노브의 더미 판.
const DEFAULTS = { retxPeriod: 2, resyncPeriod: 3, heartbeat: 10, leaseTimeout: 3 };

// ── [엣지] 게이트웨이 — 0008 + 입력을 추종자(replica)에도 미러 + 승격 후 reroute ──
class Gateway {
  constructor(zoneAddrs) {
    this.zones = zoneAddrs;          // 권위 존 주소(enter 라우팅 = zones[0])
    this.replicas = [];              // 추종자(shadow) 주소 — failover 시 입력 미러 대상(0008=빈 배열 → 비트 동일)
    this.byClient = new Map();
    this.bySession = new Map();
    this.dropped = 0;
    this.rejected = 0;
  }
  // 월드 입력(move/leave/resync)을 받을 전 존 = 권위 ∪ 추종자(복제). enter 는 zones[0](+그 replica).
  worldTargets() { return this.replicas.length ? this.zones.concat(this.replicas) : this.zones; }
  onMsg(m) {
    const p = m.payload;
    if (m.from === 'registry') {
      if (p.type === 'validate_ok') {
        const bind = { client: p.ref, sessionId: p.sessionId, avatar: p.avatar };
        this.byClient.set(p.ref, bind);
        this.bySession.set(p.sessionId, bind);
        this.net.send(this.addr, this.zones[0], { type: 'enter', sessionId: p.sessionId, avatar: p.avatar });
        // 추종자에도 enter 미러(zones[0]의 replica) — 같은 spawn 위치로 lockstep 복제
        if (this.replicas.length) this.net.send(this.addr, this.replicas[0], { type: 'enter', sessionId: p.sessionId, avatar: p.avatar });
        this.net.send(this.addr, p.ref, { type: 'connect_ok', avatar: p.avatar });
      } else if (p.type === 'validate_fail') {
        this.rejected++;
        this.net.send(this.addr, p.ref, { type: 'connect_fail' });
      }
      return;
    }
    if (m.from === 'orch') {
      if (p.type === 'reroute') {   // 사망 존 → 승격 존으로 enter 라우팅 교체, 그 추종자는 권위가 됐으니 replica 에서 제거
        this.zones = this.zones.map(z => z === p.from ? p.to : z);
        this.replicas = this.replicas.filter(z => z !== p.to && z !== p.retire);
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
      if (bind) for (const z of this.worldTargets()) this.net.send(this.addr, z, { type: 'move', sessionId: bind.sessionId, avatar: bind.avatar, d: p.d });
      else this.dropped++;
    } else if (p.type === 'resync') {   // 클라 NAK — 세션 붙여 전 존에 흩뿌림(소유 존만 응답). 클라는 세션·존 모름(은닉)
      const bind = this.byClient.get(m.from);
      if (bind) for (const z of this.worldTargets()) this.net.send(this.addr, z, { type: 'resync', sessionId: bind.sessionId });
      else this.dropped++;
    } else if (p.type === 'disconnect') {
      const bind = this.byClient.get(m.from);
      if (!bind) return;
      for (const z of this.worldTargets()) this.net.send(this.addr, z, { type: 'leave', sessionId: bind.sessionId, avatar: bind.avatar });
      this.net.send(this.addr, 'registry', { type: 'session_closed', sessionId: bind.sessionId });
      this.net.send(this.addr, m.from, { type: 'disconnect_ok' });
      this.byClient.delete(m.from);
      this.bySession.delete(bind.sessionId);
    }
  }
}

// ── [코디네이션] Orchestrator — lease 하트비트 감시 → 사망 감지 → 추종자 승격(failover 박스, 신규) ──
//  권위 존이 매 tick lease 갱신. leaseTimeout tick 결손 → 사망. 단일 승격 결정(펜싱) → 이중쓰기 0.
class Orchestrator {
  constructor(opts = {}) {
    this.leaseTimeout = opts.leaseTimeout || DEFAULTS.leaseTimeout;
    this.pairs = new Map();        // authority addr -> follower addr
    this.lastLease = new Map();    // authority addr -> 마지막 lease tick
    this.dead = new Set();         // 사망 선언된 authority addr (멱등 — 한 번만 승격)
    this.curTick = 0;
    this.promotions = 0;
    this.deathSeen = new Map();    // authority addr -> 사망 감지 tick
  }
  monitor(authority, follower) { this.pairs.set(authority, follower); this.lastLease.set(authority, 0); }
  onMsg(m) {
    const p = m.payload;
    if (p.type === 'lease') this.lastLease.set(p.zone, this.curTick);
  }
  onTick(tick) {
    this.curTick = tick;
    for (const [auth, follower] of this.pairs) {
      if (this.dead.has(auth)) continue;
      const last = this.lastLease.get(auth);
      // lease 가 leaseTimeout tick 이상 결손 → 사망 선언(단, 아직 lease 한 번도 안 온 워밍업은 제외)
      if (last > 0 && (tick - last) >= this.leaseTimeout) {
        this.dead.add(auth);
        this.deathSeen.set(auth, tick);
        this.promotions++;
        // 승격: 추종자 → 권위. 생존 권위의 sibling 을 승격 존으로 재연결, 반대편 추종자는 retire(중복 권위 방지).
        const survivor = this._survivorOf(auth);
        const otherFollower = survivor ? this.pairs.get(survivor) : null;
        this.net.send(this.addr, follower, { type: 'promote', sibling: survivor });
        if (survivor) this.net.send(this.addr, survivor, { type: 'relink', sibling: follower });
        if (otherFollower) this.net.send(this.addr, otherFollower, { type: 'retire' });
        this.net.send(this.addr, 'gateway', { type: 'reroute', from: auth, to: follower, retire: otherFollower });
      }
    }
  }
  // 죽지 않은 다른 권위(생존 존) — 2존 가정의 단순 탐색.
  _survivorOf(deadAuth) {
    for (const a of this.pairs.keys()) if (a !== deadAuth && !this.dead.has(a)) return a;
    return null;
  }
}

// ── [월드] 분할 존 — 0008 + failover(shadow 복제 · 사망 · 승격) ──
class EntityZone {
  constructor(seed, opts = {}) {
    this.rng = mulberry32((seed ^ 0x5A17) >>> 0);
    this.grid = opts.grid || 16;
    this.radius = opts.radius !== undefined ? opts.radius : 4;
    this.incremental = opts.incremental !== false;
    this.recovery = opts.recovery === true;        // 0008 토글 — false 면 0008(행복 경로) 비트 동일
    this.retxPeriod = opts.retxPeriod || DEFAULTS.retxPeriod;
    this.heartbeat = opts.heartbeat || DEFAULTS.heartbeat;
    // ── failover(이 step) ──
    this.failover = opts.failover === true;        // failover 토글 — false 면 0008 코드 경로(reg 0)
    this.shadow = opts.shadow === true;            // 추종자(수동 복제) — 뷰 미발행·census 미포함
    this.orch = opts.orch || null;                 // lease 송신 대상(권위 존만)
    this.deathTick = opts.deathTick != null ? opts.deathTick : null;  // 이 tick 부터 사망(영구 단절 모델)
    this.dead = false;
    this.promotedAt = null;
    const G = this.grid;
    this.region = opts.region || { lo: 0, hi: G };
    this.sibling = opts.sibling || null;
    this.boundary = opts.boundary !== undefined ? opts.boundary : G / 2;
    const band = this.radius;
    this.bandLo = (this.region.hi === this.boundary) ? this.boundary - band : this.boundary;
    this.bandHi = (this.region.hi === this.boundary) ? this.boundary : this.boundary + band;
    this.ents = new Map();        // avatar -> {x,y}  (소유 = 쓰기 권위; shadow 면 복제 미러)
    this.ghosts = new Map();
    this.sessions = new Map();    // sessionId -> {gateway, avatar}
    this.prevSeen = new Map();    // sessionId -> Map(id->{x,y})  (증분 기준)
    this.pending = [];
    this.curTick = 0;
    // 증분 seq/keyframe 상태(recovery)
    this.deltaSeqOf = new Map();
    this.lastKeyframe = new Map();
    this.needsKeyframe = new Set();
    // 핸드오프 ack/재전송 상태(recovery)
    this.outbox = new Map();
    this.acquired = new Set();
    this.handoffSeq = 0;
    // 회계
    this.sent = 0; this.views = 0;
    this.handoffsSent = 0; this.handoffsAcquired = 0;
    this.ghostMsgs = 0; this.ghostEntsSent = 0;
    this.deltaEnter = 0; this.deltaExit = 0; this.deltaUpdate = 0; this.deltaMsgs = 0; this.resets = 0;
    this.retransmits = 0; this.acksRx = 0; this.naksRx = 0; this.keyframesForced = 0; this.heartbeats = 0;
    this.leasesSent = 0; this.promotionKeyframes = 0;
  }
  // census 에서 권위로 셀지 — 살아있고 수동(shadow) 아님. (0008: dead/shadow 항상 false → 전 존 권위)
  isAuthority() { return !this.dead && !this.shadow; }
  owns(x) { return x >= this.region.lo && x < this.region.hi; }
  inBand(x) { return x >= this.bandLo && x < this.bandHi; }
  near(a, b) { return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) <= this.radius; }
  sessionOf(avatar) {
    for (const [sid, s] of this.sessions) if (s.avatar === avatar) return { id: sid, gateway: s.gateway };
    return null;
  }
  onMsg(m) {
    if (this.dead) return;   // 사망(또는 retire)한 존은 메시지 무시(영구 단절)
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
        if (!this.acquired.has(p.handoffId)) {
          this.acquired.add(p.handoffId);
          this.ents.set(p.avatar, { x: p.x, y: p.y });
          if (p.sessionId) {
            this.sessions.set(p.sessionId, { gateway: p.gateway, avatar: p.avatar });
            this.deltaSeqOf.set(p.sessionId, p.lastSeq);
          }
          this.handoffsAcquired++;
        }
        this.net.send(this.addr, m.from, { type: 'handoff_ack', handoffId: p.handoffId });
      } else {
        this.ents.set(p.avatar, { x: p.x, y: p.y });
        if (p.sessionId) this.sessions.set(p.sessionId, { gateway: p.gateway, avatar: p.avatar });
        this.handoffsAcquired++;
      }
    } else if (p.type === 'handoff_ack') {
      if (this.outbox.delete(p.handoffId)) this.acksRx++;
    } else if (p.type === 'resync') {
      if (this.sessions.has(p.sessionId)) { this.needsKeyframe.add(p.sessionId); this.naksRx++; }
    } else if (p.type === 'ghosts') {
      this.ghosts = new Map(p.ents.map(e => [e.id, { x: e.x, y: e.y }]));
    } else if (p.type === 'promote') {       // ── failover: 추종자 → 권위 승격 ──
      this.shadow = false;
      this.promotedAt = this.curTick;
      this.sibling = p.sibling;              // 생존 권위로 sibling 재연결(이후 핸드오프 정상 라우팅)
      for (const sid of this.sessions.keys()) this.needsKeyframe.add(sid);  // 강제 keyframe → stale 클라 재동기
    } else if (p.type === 'relink') {        // ── failover: 생존 권위가 승격 존으로 sibling 재연결 ──
      this.sibling = p.sibling;
    } else if (p.type === 'retire') {        // ── failover: 반대편 추종자 은퇴(중복 권위 방지) ──
      this.dead = true;
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
    // ── failover: 사망(영구 단절) — 이 tick 부터 무동작(프로세스 죽음). lease 도 안 보냄 → orch 가 감지. ──
    if (this.deathTick != null && this.curTick >= this.deathTick) this.dead = true;
    if (this.dead) return;
    // ── failover: 권위 존은 매 tick lease 갱신(신뢰 제어 평면). 추종자(shadow)는 안 보냄. ──
    if (this.failover && this.orch && !this.shadow) { this.net.send(this.addr, this.orch, { type: 'lease', zone: this.addr }); this.leasesSent++; }
    const SUP = this.shadow;   // 추종자면 외부 발신(뷰)을 억제 — 단 상태(seq/prevSeen)는 lockstep 으로 진행
    // ① 이동 적용
    for (const p of this.pending) {
      const e = this.ents.get(p.avatar);
      if (e) { e.x = (e.x + p.d.dx + this.grid) % this.grid; e.y = (e.y + p.d.dy + this.grid) % this.grid; }
    }
    this.pending = [];
    // ② 핸드오프(release) — region 밖 소유 엔터티를 sibling 으로 이주(추종자는 추종자 sibling 으로 → 평행 세계)
    if (this.sibling) {
      for (const [avatar, e] of [...this.ents]) {
        if (!this.owns(e.x)) {
          const s = this.sessionOf(avatar);
          if (this.recovery) {
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
    // ②b 재전송 — outbox 의 미-ack 토큰을 재전송 주기마다
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
    // ④ AOI 발행 — 전체 스냅샷(0007 호환) 또는 증분(+seq/keyframe/heartbeat). 추종자(SUP)는 발신만 억제(상태는 진행).
    for (const [sessionId, s] of this.sessions) {
      const me = this.ents.get(s.avatar);
      if (!me) continue;
      if (!this.incremental) {
        const visible = [];
        for (const [id, e] of this.ents) if (this.near(me, e)) visible.push({ id, x: e.x, y: e.y });
        for (const [id, e] of this.ghosts) if (this.near(me, e)) visible.push({ id, x: e.x, y: e.y });
        if (!SUP) { this.sent += visible.length; this.views++; this.net.send(this.addr, s.gateway, { type: 'view', sessionId, entities: visible }); }
        continue;
      }
      const cur = this.visibleFor(me);
      const prev = this.prevSeen.get(sessionId);
      if (!this.recovery) {
        // ── 0008/0007 증분(seq 없음) — recovery off 면 비트 동일 ──
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
        if (!SUP) {
          this.deltaEnter += enter.length; this.deltaExit += exit.length; this.deltaUpdate += update.length;
          this.deltaMsgs++; if (reset) this.resets++;
          this.net.send(this.addr, s.gateway, { type: 'view_delta', sessionId, reset, enter, exit, update });
        }
        continue;
      }
      // ── 증분 + 복원(recovery) — reset 사유: 신규/핸드오프(prev 없음) · NAK(needsKeyframe·승격) · heartbeat ──
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
      if (!reset && enter.length === 0 && exit.length === 0 && update.length === 0) continue;
      const seq = (this.deltaSeqOf.get(sessionId) ?? -1) + 1;
      this.deltaSeqOf.set(sessionId, seq);
      if (reset) {
        this.lastKeyframe.set(sessionId, this.curTick);
        if (forced) this.needsKeyframe.delete(sessionId);
      }
      if (!SUP) {
        this.deltaEnter += enter.length; this.deltaExit += exit.length; this.deltaUpdate += update.length;
        this.deltaMsgs++;
        if (reset) {
          this.resets++;
          if (forced) { this.keyframesForced++; if (this.promotedAt != null && this.curTick >= this.promotedAt) this.promotionKeyframes++; }
          else if (hb && prev) this.heartbeats++;
        }
        this.net.send(this.addr, s.gateway, { type: 'view_delta', sessionId, reset, enter, exit, update, seq });
      }
    }
  }
}

// ── 클라이언트 — 0008 그대로(failover 는 클라 미인지 — 승격 keyframe 은 평범한 view_delta reset 으로 보인다) ──
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
    this.expectedSeq = 0;
    this.awaitingResync = false;
    this.lastNak = -99;
    this.naksSent = 0;
    this.resyncPeriod = script.resyncPeriod || DEFAULTS.resyncPeriod;
    this.staleDrops = 0;
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
    } else if (p.type === 'view') {
      this.views++;
      this.seen = new Map(p.entities.map(e => [e.id, { x: e.x, y: e.y }]));
    } else if (p.type === 'view_delta') {
      this.views++;
      if (p.seq === undefined) {
        this.deltasApplied++;
        if (p.reset) this.seen = new Map();
        for (const e of p.enter) this.seen.set(e.id, { x: e.x, y: e.y });
        for (const e of p.update) this.seen.set(e.id, { x: e.x, y: e.y });
        for (const id of p.exit) this.seen.delete(id);
        return;
      }
      if (p.reset) {
        if (p.seq >= this.expectedSeq) {
          this.seen = new Map();
          for (const e of p.enter) this.seen.set(e.id, { x: e.x, y: e.y });
          for (const e of p.update) this.seen.set(e.id, { x: e.x, y: e.y });
          this.expectedSeq = p.seq + 1;
          this.awaitingResync = false;
          this.deltasApplied++;
        }
        return;
      }
      if (p.seq === this.expectedSeq) {
        for (const e of p.enter) this.seen.set(e.id, { x: e.x, y: e.y });
        for (const e of p.update) this.seen.set(e.id, { x: e.x, y: e.y });
        for (const id of p.exit) this.seen.delete(id);
        this.expectedSeq++;
        this.deltasApplied++;
      } else if (p.seq > this.expectedSeq) {
        this.staleDrops++;
        if (!this.awaitingResync || (this.curTick - this.lastNak) >= this.resyncPeriod) {
          this.net.send(this.addr, 'gateway', { type: 'resync' });
          this.lastNak = this.curTick; this.naksSent++;
        }
        this.awaitingResync = true;
      }
    } else if (p.type === 'disconnect_ok') {
      this.phase = 'done';
    }
  }
  seenIds() { return [...this.seen.keys()].sort(); }
  seenSig() {
    return [...this.seen.entries()].map(([id, e]) => id + '@' + e.x + ',' + e.y).sort().join(';');
  }
}

// ── routeFilter — 0008 그대로(핸드오프 토큰·증분 델타). failover 의 사망은 라우트 손실이 아니라 deathTick(존 무동작)로 모델. ──
const routeFilters = {
  handoff: (m) => /^zone/.test(m.from) && /^zone/.test(m.to) && m.payload.type === 'handoff',
  delta: (m) => /^zone/.test(m.from) && m.to === 'gateway' && m.payload.type === 'view_delta',
  both: (m) => (/^zone/.test(m.from) && /^zone/.test(m.to) && m.payload.type === 'handoff') ||
               (/^zone/.test(m.from) && m.to === 'gateway' && m.payload.type === 'view_delta'),
};

// ── 하니스 ──
// opts: { seed, ticks, clients, moves, radius, grid, zones, incremental, recovery, transport, leave,
//         retxPeriod, heartbeat, resyncPeriod, failover, deathTick, leaseTimeout, killZone }
function run(opts) {
  const {
    seed, ticks = 48, clients = 6, moves = 30, radius = 4, grid = 16, zones = 2,
    incremental = true, recovery = false, transport = null, leave = {},
    retxPeriod, heartbeat, resyncPeriod,
    failover = false, deathTick = null, leaseTimeout, killZone = 'zone1',
  } = opts;
  const accounts = [];
  for (let i = 0; i < clients; i++) accounts.push('hero' + i);

  const net = new Net({ transport, seed });
  const login = new LoginServer(accounts, seed);
  const registry = new SessionRegistry();
  const H = Math.floor(grid / 2);

  const zoneObjs = [];
  const zoneAddrs = [];
  const zopt = { grid, radius, incremental, recovery, retxPeriod, heartbeat, failover };
  if (zones === 1) {
    zoneObjs.push(new EntityZone(seed, { ...zopt, region: { lo: 0, hi: grid }, sibling: null, boundary: grid }));
    zoneAddrs.push('zone1');
  } else {
    zoneObjs.push(new EntityZone(seed, { ...zopt, region: { lo: 0, hi: H }, sibling: 'zone2', boundary: H }));
    zoneObjs.push(new EntityZone(seed, { ...zopt, region: { lo: H, hi: grid }, sibling: 'zone1', boundary: H }));
    zoneAddrs.push('zone1', 'zone2');
  }

  const gateway = new Gateway(zoneAddrs.slice());
  net.register('login', login);
  net.register('registry', registry);
  net.register('gateway', gateway);
  zoneObjs.forEach((z, i) => net.register(zoneAddrs[i], z));

  // ── failover 배선 — 추종자(shadow) 복제 존 + Orchestrator(코디네이션 박스). 0008(failover=false)엔 없음 → reg 0. ──
  let orch = null;
  const followers = [];
  if (failover && zones === 2) {
    orch = new Orchestrator({ leaseTimeout });
    net.register('orch', orch);
    // 추종자: 권위와 같은 region·radius, sibling 은 추종자끼리(평행 세계). orch 에 lease 송신.
    const f1 = new EntityZone(seed, { ...zopt, region: { lo: 0, hi: H }, sibling: 'zone2f', boundary: H, shadow: true, orch: 'orch' });
    const f2 = new EntityZone(seed, { ...zopt, region: { lo: H, hi: grid }, sibling: 'zone1f', boundary: H, shadow: true, orch: 'orch' });
    net.register('zone1f', f1); net.register('zone2f', f2);
    followers.push(f1, f2);
    gateway.replicas = ['zone1f', 'zone2f'];
    // 권위 존도 orch 에 lease 송신
    zoneObjs[0].orch = 'orch'; zoneObjs[1].orch = 'orch';
    orch.monitor('zone1', 'zone1f'); orch.monitor('zone2', 'zone2f');
  }
  // 사망 주입(영구 단절) — failover 무관하게 적용. failover=false 면 *복원 없는 사망*(OFF 대조: 영구 소실).
  if (deathTick != null && zones === 2) {
    const killIdx = zoneAddrs.indexOf(killZone);
    if (killIdx >= 0) zoneObjs[killIdx].deathTick = deathTick;
  }
  const allZones = zoneObjs.concat(followers);   // census·트루스용 전체 존(권위+추종자)

  const clis = [];
  for (let i = 0; i < clients; i++) {
    const c = new Client({ account: accounts[i], seed: (seed + i * 0x9E37) >>> 0, moves, leaveTick: leave[i] != null ? leave[i] : null, resyncPeriod });
    net.register('client' + i, c);
    clis.push(c);
  }

  const trace = [];        // {tick, committed, inflight(Set), liveN} — 권위 존(살아있고 수동 아님)만 집계
  const seenTrace = [];
  const deltaTrace = [];
  const replicaTrace = [];  // failover: 추종자 복제 충실도(권위 ents 대비 차이) — tick 별
  let prevDeltaRec = 0;
  for (let i = 0; i < ticks; i++) {
    net.step();
    const committed = new Map();
    for (const z of allZones) if (z.isAuthority()) for (const av of z.ents.keys()) committed.set(av, (committed.get(av) || 0) + 1);
    const inflight = inflightSet(net, allZones);   // 버스 토큰 ∪ 권위 존 outbox — avatar 단위
    const live = new Set([...committed.keys(), ...inflight]);
    trace.push({ tick: i + 1, committed, inflight, liveN: live.size });
    seenTrace.push(clis.map(c => c.seenSig()));
    const curDeltaRec = zoneObjs.reduce((a, z) => a + z.deltaEnter + z.deltaExit + z.deltaUpdate, 0);
    deltaTrace.push(curDeltaRec - prevDeltaRec); prevDeltaRec = curDeltaRec;
    if (failover) replicaTrace.push(replicaDivergence(zoneObjs, followers));
  }
  const sum = (f) => zoneObjs.reduce((a, z) => a + f(z), 0);   // 권위 존만(추종자 발신은 억제됨)
  const sumAll = (f) => allZones.reduce((a, z) => a + f(z), 0);
  const totals = {
    sent: sum(z => z.sent), views: sum(z => z.views),
    handoffs: sum(z => z.handoffsSent), acquired: sum(z => z.handoffsAcquired),
    ghostEnts: sum(z => z.ghostEntsSent), ghostMsgs: sum(z => z.ghostMsgs),
    deltaEnter: sum(z => z.deltaEnter), deltaExit: sum(z => z.deltaExit), deltaUpdate: sum(z => z.deltaUpdate),
    deltaMsgs: sum(z => z.deltaMsgs), resets: sum(z => z.resets),
    retransmits: sum(z => z.retransmits), acksRx: sum(z => z.acksRx), naksRx: sum(z => z.naksRx),
    keyframesForced: sumAll(z => z.keyframesForced), heartbeats: sum(z => z.heartbeats),
    promotionKeyframes: sumAll(z => z.promotionKeyframes),
    leasesSent: sumAll(z => z.leasesSent),
    naksSent: clis.reduce((a, c) => a + c.naksSent, 0),
    staleDrops: clis.reduce((a, c) => a + c.staleDrops, 0),
    promotions: orch ? orch.promotions : 0,
  };
  totals.deltaRecords = totals.deltaEnter + totals.deltaExit + totals.deltaUpdate;
  totals.netLost = net.stats.lost;
  return { net, login, registry, gateway, orch, zones: zoneObjs, followers, allZones, zoneAddrs, clients: clis, trace, seenTrace, deltaTrace, replicaTrace, totals, H, grid, radius, deathTick, killZone };
}

// in-flight 권위 = 버스의 미배달 핸드오프 토큰 ∪ 권위 존 outbox(권위-of-record). avatar 단위 dedup. 추종자/사망 존 제외.
//  추종자끼리의 핸드오프(zone1f↔zone2f)는 권위 census 가 아니므로 제외 — 권위 라우트(zone1/zone2)만 카운트.
function inflightSet(net, zoneObjs) {
  const out = new Set();
  for (const msgs of net.queue.values())
    for (const m of msgs)
      if (m.payload && m.payload.type === 'handoff' && /^zone[12]$/.test(m.to) && !net.delivered.has(m.id)) out.add(m.payload.avatar);
  for (const z of zoneObjs) if (z.isAuthority()) for (const rec of z.outbox.values()) out.add(rec.avatar);
  return out;
}

// 권위 카운트 — committed 가 있으면 그 수(>1=이중쓰기), 없으면 in-flight 여부(1=이주중, 0=공백).
function authorityCount(t, avatar) {
  const c = t.committed.get(avatar) || 0;
  if (c > 0) return c;
  return t.inflight.has(avatar) ? 1 : 0;
}

// failover: 추종자 복제 충실도 — 살아있는 권위(zone1/zone2) ents 합집합 vs 추종자(zone1f/zone2f) ents 합집합의 차이 셀 수.
//  0 이면 추종자가 완전 복제(상태 보존 토대). 사망 존은 더 이상 그라운드 트루스 아니라 제외.
function replicaDivergence(zoneObjs, followers) {
  const auth = new Map(), foll = new Map();
  for (const z of zoneObjs) if (!z.dead) for (const [id, e] of z.ents) auth.set(id, e.x + ',' + e.y);
  for (const z of followers) if (!z.dead && z.shadow) for (const [id, e] of z.ents) foll.set(id, e.x + ',' + e.y);
  let diff = 0;
  for (const [id, v] of auth) if (foll.get(id) !== v) diff++;
  for (const id of foll.keys()) if (!auth.has(id)) diff++;
  return diff;
}

function scanInflightHandoffs(net) {
  const out = [];
  for (const msgs of net.queue.values())
    for (const m of msgs)
      if (m.payload && m.payload.type === 'handoff' && !net.delivered.has(m.id)) out.push(m.payload.avatar);
  return out;
}

// 전체 존(권위) AOI 트루스 — 살아있는 권위 존만(사망·추종자 제외 = liveAoiTruth). failover 후엔 {승격 존, 생존 존}.
function globalAoiTruth(r, avatar) {
  const live = liveZones(r);
  let me = null;
  for (const z of live) if (z.ents.has(avatar)) { me = z.ents.get(avatar); break; }
  if (!me) return null;
  const R = r.radius;
  const out = [];
  for (const z of live) for (const [id, e] of z.ents)
    if (Math.max(Math.abs(me.x - e.x), Math.abs(me.y - e.y)) <= R) out.push(id);
  return out.sort();
}
// 살아있는 권위 존(사망·수동 추종자 제외) — failover 후엔 {승격 존, 생존 존}.
function liveZones(r) { return r.allZones ? r.allZones.filter(z => z.isAuthority()) : r.zones; }

function ownerOf(r, avatar) {
  const live = liveZones(r);
  for (const z of live) if (z.ents.has(avatar)) return z.addr;
  return null;
}

const PUBLIC_ADDRS = ['login', 'gateway'];

// ── 모듈 노출 (dual-mode) ───────────
const __hktNet = {
  mulberry32, fnv1a, Net, LoginServer, SessionRegistry, Gateway, Orchestrator, EntityZone, Client,
  run, routeFilters, inflightSet, authorityCount, replicaDivergence, scanInflightHandoffs,
  globalAoiTruth, liveZones, ownerOf, PUBLIC_ADDRS, DEFAULTS,
};
if (typeof module !== 'undefined' && module.exports) module.exports = __hktNet;
if (typeof globalThis !== 'undefined') globalThis.HktNet = __hktNet;
