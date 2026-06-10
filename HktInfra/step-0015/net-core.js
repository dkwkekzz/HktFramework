// HktInfra step-0015 — 채팅 서비스 분리 (채널 팬아웃을 존 tick 밖 비동기 서비스로 · 구독 라우팅 · 비-구독자 누설 0)
// step-0014(가방 서비스 분리 — 아이템 원장·단일 소유·쌍 거래) 위에 *한 조각*만 더한다 — SPINE 계층 3(게임 서비스)의 둘째 박스:
//   0014 가 가방(첫 게임 서비스 박스)을 존 tick 밖으로 떼어 "신성한 tick"을 처음 실증했다. 이 step 은 *그 분리 패턴을
//   반복*해 채팅(ChatService — 채널 팬아웃)을 독립 박스로 세워, 게임 서비스 계층이 *한 박스의 우연이 아니라 일반 패턴*임을
//   보이고, 가방(원장=단일 소유)과 *대비되는* 서비스 의미 — *멀티캐스트 팬아웃*(한 발화 → N 구독자) — 을 친다:
//     · 인프로세스 모드(run): chat 플래그 OFF 면 0014 액터 *그대로* — 0014 와 *비트 동일*(reg 0).
//     · chat 플래그 ON: 클라가 *별도 채널·별도 chatRng* 로 say(전체/지역)/whisper(귓속말) 인텐트를 게이트웨이→chat 으로
//        보낸다(월드 move 스트림 무오염 → 존 상태·AOI 뷰가 채팅 on/off 에 *비트 동일* = 채팅이 시뮬에 비-침습).
//     · 멀티프로세스 모드(runMulti): chat = 자기 프로세스. 토픽 버스로 통신(은닉·헤드리스·E2E 비트 동일).
//
// 핵심 설계 — 채팅은 *tick 무관 순수 반응형 서비스*(onTick 없음). 가방이 *원장*(itemId→owner, 단일 소유)이라면 채팅은
//   *구독 라우팅 테이블*(channel→Set<avatar>, 팬아웃)이다. say 는 한 발화를 *그 채널 구독자 전원*(발신자 제외)에게 팬아웃,
//   whisper 는 *한 타깃*에게만 직접 라우팅(point-to-point). 비-구독자에게 메시지가 가는 것은 *구조적으로 불가*(구독 Set 만
//   순회) — 가방의 "원장 Map ⇒ 소유자=1" 과 같은 자료구조 보장. 증명할 것은 *완전성*(deliveries ≡ 클라 belief, happy 0)과
//   *지역 격리*(region:X 는 X 멤버만)다. 존은 chat 메시지를 *받지 않는다*(채팅은 존을 우회) → 신성한 tick. 클라 belief 는
//   서버가 보낸 chat_msg 로만 갱신(Set 키 channel|from|seq → 재전송 멱등·dup-safe·phantom 0). 전송 열화(loss)면 채팅은
//   *best-effort*(완전성 열화·라우팅 정확성 무관 — 누설 0·지역 격리 보존)다 = 가방의 idempotent transfer 와 대비되는 정직한 한계.
//
// 척추(SPINE.md) 준수:
//   - 신성한 tick: 채널 팬아웃은 *존 tick 밖* 비동기 서비스(chat onTick 0). 존 net.log·상태가 채팅 on/off 비트 동일·존 도달 chat 0.
//   - 결정론 코어: 채팅도 시드 의사난수만(클라 chatRng = move rng 와 독립). 같은 입력열 → 같은 deliveries(E2E·repro 비트 동일).
//   - 권위 단일 소유: 채팅은 비-소유 상태(팬아웃)지만 *라우팅 권위 단일* — 구독 테이블이 SSOT(누설 0·phantom 0).
//   - 은닉·단일 연결: 클라는 게이트웨이만. chat 주소·chat_req·구독 테이블은 *서버간* 경계 — 클라엔 scope/seq/from 만(누설 0).
//   - headless·원격 검증: node verify.js 한 줄이 chat 을 별 프로세스로 띄워 버스로 묶어 4기둥 검증(제1 운영 제약).
//   (0014 가방 박스·아이템 라우팅·itemRng 은 *그대로 잇는다* — 복사 전진. 이 step 이 더한 박스는 ChatService 하나뿐.)
'use strict';
const __engine = (typeof module !== 'undefined' && module.exports && typeof require !== 'undefined')
  ? require('../engine/index.js')
  : globalThis.HktEngine;
const { Net, LoginServer, SessionRegistry, mulberry32, fnv1a } = __engine;

// 복원·failover 파라미터(0009 그대로) — opts 오버라이드 가능 결정론 상수. hkt.recovery.*·hkt.failover.* 노브의 더미판.
const DEFAULTS = { retxPeriod: 2, resyncPeriod: 3, heartbeat: 10, leaseTimeout: 3 };

// ── [엣지] 게이트웨이 — 0009 그대로(replicas 를 생성자 인자로 받게만 조정 — 토폴로지 빌더가 단일 경로로 배선) ──
class Gateway {
  constructor(zoneAddrs, replicas = [], inventoryAddr = null, chatAddr = null) {
    this.zones = zoneAddrs.slice();      // 권위 존 주소(enter 라우팅 = zones[0])
    this.replicas = replicas.slice();    // 추종자(shadow) 주소 — failover 시 입력 미러 대상(0009=빈 배열 → 비트 동일)
    this.byClient = new Map();
    this.bySession = new Map();
    this.byAvatar = new Map();            // avatar → bind (가방·채팅 결과를 대상 클라로 라우팅 — service off 면 미사용)
    this.inventory = inventoryAddr;       // 가방 서비스 주소(null = 가방 분리 OFF → 0013 비트 동일)
    this.chat = chatAddr;                 // 채팅 서비스 주소(null = 채팅 분리 OFF → 0014 비트 동일)
    this.dropped = 0;
    this.rejected = 0;
  }
  worldTargets() { return this.replicas.length ? this.zones.concat(this.replicas) : this.zones; }
  onMsg(m) {
    const p = m.payload;
    if (m.from === 'registry') {
      if (p.type === 'validate_ok') {
        const bind = { client: p.ref, sessionId: p.sessionId, avatar: p.avatar };
        this.byClient.set(p.ref, bind);
        this.bySession.set(p.sessionId, bind);
        this.byAvatar.set(p.avatar, bind);   // 가방 결과 라우팅용(item off 면 net.send 0 → 비-침습)
        this.net.send(this.addr, this.zones[0], { type: 'enter', sessionId: p.sessionId, avatar: p.avatar });
        if (this.replicas.length) this.net.send(this.addr, this.replicas[0], { type: 'enter', sessionId: p.sessionId, avatar: p.avatar });
        this.net.send(this.addr, p.ref, { type: 'connect_ok', avatar: p.avatar });
      } else if (p.type === 'validate_fail') {
        this.rejected++;
        this.net.send(this.addr, p.ref, { type: 'connect_fail' });
      }
      return;
    }
    if (m.from === 'orch') {
      if (p.type === 'reroute') {
        this.zones = this.zones.map(z => z === p.from ? p.to : z);
        this.replicas = this.replicas.filter(z => z !== p.to && z !== p.retire);
      }
      return;
    }
    if (m.from.startsWith('zone')) {
      if (p.type === 'view') {
        const bind = this.bySession.get(p.sessionId);
        if (bind) this.net.send(this.addr, bind.client, { type: 'view', entities: p.entities });
      } else if (p.type === 'view_delta') {
        const bind = this.bySession.get(p.sessionId);
        if (bind) this.net.send(this.addr, bind.client, { type: 'view_delta', reset: p.reset, enter: p.enter, exit: p.exit, update: p.update, seq: p.seq });
      }
      return;
    }
    if (m.from === this.inventory) {
      // 가방 결과 중계 — 요청자(reqAvatar)에게 item_result, give 성공이면 수신자(toAvatar)에게 item_recv. 은닉: itemId/op 만 전달.
      if (p.type === 'item_result') {
        const rb = this.byAvatar.get(p.reqAvatar);
        if (rb) this.net.send(this.addr, rb.client, { type: 'item_result', ok: p.ok, op: p.op, itemId: p.itemId });
        if (p.ok && p.op === 'give') {
          const tb = this.byAvatar.get(p.toAvatar);
          if (tb) this.net.send(this.addr, tb.client, { type: 'item_recv', itemId: p.itemId });
        }
      }
      return;
    }
    if (m.from === this.chat) {
      // 채팅 팬아웃 중계 — chat 이 결정한 수신자(toAvatar)에게 chat_msg. 은닉: channel/from/seq 만(chat 내부·구독 테이블 비전달).
      if (p.type === 'chat_out') {
        const tb = this.byAvatar.get(p.toAvatar);
        if (tb) this.net.send(this.addr, tb.client, { type: 'chat_msg', channel: p.channel, from: p.from, seq: p.seq });
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
    } else if (p.type === 'resync') {
      const bind = this.byClient.get(m.from);
      if (bind) for (const z of this.worldTargets()) this.net.send(this.addr, z, { type: 'resync', sessionId: bind.sessionId });
      else this.dropped++;
    } else if (p.type === 'item_pickup') {
      // 가방 분리 — 아이템 인텐트는 *존을 우회*해 inventory 서비스로(존 tick 비-침습). 클라엔 inventory 비가시.
      const bind = this.byClient.get(m.from);
      if (bind && this.inventory) this.net.send(this.addr, this.inventory, { type: 'item_req', op: 'pickup', avatar: bind.avatar });
      else this.dropped++;
    } else if (p.type === 'item_give') {
      const bind = this.byClient.get(m.from);
      if (bind && this.inventory) this.net.send(this.addr, this.inventory, { type: 'item_req', op: 'give', fromAvatar: bind.avatar, toAvatar: p.toAvatar, itemId: p.itemId });
      else this.dropped++;
    } else if (p.type === 'chat_join') {
      // 채팅 분리 — 구독 인텐트는 *존을 우회*해 chat 서비스로(존 tick 비-침습). 클라엔 chat 비가시(게이트웨이가 region 만 중계).
      const bind = this.byClient.get(m.from);
      if (bind && this.chat) this.net.send(this.addr, this.chat, { type: 'chat_req', op: 'join', avatar: bind.avatar, region: p.region });
      else this.dropped++;
    } else if (p.type === 'chat_say') {
      const bind = this.byClient.get(m.from);
      if (bind && this.chat) this.net.send(this.addr, this.chat, { type: 'chat_req', op: 'say', fromAvatar: bind.avatar, scope: p.scope, seq: p.seq });
      else this.dropped++;
    } else if (p.type === 'chat_whisper') {
      const bind = this.byClient.get(m.from);
      if (bind && this.chat) this.net.send(this.addr, this.chat, { type: 'chat_req', op: 'whisper', fromAvatar: bind.avatar, toAvatar: p.to, seq: p.seq });
      else this.dropped++;
    } else if (p.type === 'disconnect') {
      const bind = this.byClient.get(m.from);
      if (!bind) return;
      for (const z of this.worldTargets()) this.net.send(this.addr, z, { type: 'leave', sessionId: bind.sessionId, avatar: bind.avatar });
      if (this.chat) this.net.send(this.addr, this.chat, { type: 'chat_req', op: 'leave', avatar: bind.avatar });   // 구독 테이블 대칭 정리(stale 팬아웃 방지)
      this.net.send(this.addr, 'registry', { type: 'session_closed', sessionId: bind.sessionId });
      this.net.send(this.addr, m.from, { type: 'disconnect_ok' });
      this.byClient.delete(m.from);
      this.bySession.delete(bind.sessionId);
      this.byAvatar.delete(bind.avatar);   // 가방·채팅 라우팅 인덱스도 대칭 정리(stale bind 로 결과 오라우팅 방지)
    }
  }
}

// ── [코디네이션] Orchestrator — 0009 그대로(monitor 쌍을 생성자 opts 로 받게만 조정) ──
class Orchestrator {
  constructor(opts = {}) {
    this.leaseTimeout = opts.leaseTimeout || DEFAULTS.leaseTimeout;
    this.pairs = new Map();
    this.lastLease = new Map();
    this.dead = new Set();
    this.curTick = 0;
    this.promotions = 0;
    this.deathSeen = new Map();
    if (opts.monitor) for (const [a, f] of opts.monitor) this.monitor(a, f);
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
      if (last > 0 && (tick - last) >= this.leaseTimeout) {
        this.dead.add(auth);
        this.deathSeen.set(auth, tick);
        this.promotions++;
        const survivor = this._survivorOf(auth);
        const otherFollower = survivor ? this.pairs.get(survivor) : null;
        this.net.send(this.addr, follower, { type: 'promote', sibling: survivor });
        if (survivor) this.net.send(this.addr, survivor, { type: 'relink', sibling: follower });
        if (otherFollower) this.net.send(this.addr, otherFollower, { type: 'retire' });
        this.net.send(this.addr, 'gateway', { type: 'reroute', from: auth, to: follower, retire: otherFollower });
      }
    }
  }
  _survivorOf(deadAuth) {
    for (const a of this.pairs.keys()) if (a !== deadAuth && !this.dead.has(a)) return a;
    return null;
  }
}

// ── [월드] 분할 존 — 0009 그대로(무수정 복사 전진) ──
class EntityZone {
  constructor(seed, opts = {}) {
    this.rng = mulberry32((seed ^ 0x5A17) >>> 0);
    this.grid = opts.grid || 16;
    this.radius = opts.radius !== undefined ? opts.radius : 4;
    this.incremental = opts.incremental !== false;
    this.recovery = opts.recovery === true;
    this.retxPeriod = opts.retxPeriod || DEFAULTS.retxPeriod;
    this.heartbeat = opts.heartbeat || DEFAULTS.heartbeat;
    this.failover = opts.failover === true;
    this.shadow = opts.shadow === true;
    this.orch = opts.orch || null;
    this.deathTick = opts.deathTick != null ? opts.deathTick : null;
    this.dead = false;
    this.promotedAt = null;
    const G = this.grid;
    this.region = opts.region || { lo: 0, hi: G };
    this.sibling = opts.sibling || null;
    this.boundary = opts.boundary !== undefined ? opts.boundary : G / 2;
    const band = this.radius;
    this.bandLo = (this.region.hi === this.boundary) ? this.boundary - band : this.boundary;
    this.bandHi = (this.region.hi === this.boundary) ? this.boundary : this.boundary + band;
    this.ents = new Map();
    this.ghosts = new Map();
    this.sessions = new Map();
    this.prevSeen = new Map();
    this.pending = [];
    this.curTick = 0;
    this.deltaSeqOf = new Map();
    this.lastKeyframe = new Map();
    this.needsKeyframe = new Set();
    this.outbox = new Map();
    this.acquired = new Set();
    this.handoffSeq = 0;
    this.sent = 0; this.views = 0;
    this.handoffsSent = 0; this.handoffsAcquired = 0;
    this.ghostMsgs = 0; this.ghostEntsSent = 0;
    this.deltaEnter = 0; this.deltaExit = 0; this.deltaUpdate = 0; this.deltaMsgs = 0; this.resets = 0;
    this.retransmits = 0; this.acksRx = 0; this.naksRx = 0; this.keyframesForced = 0; this.heartbeats = 0;
    this.leasesSent = 0; this.promotionKeyframes = 0;
  }
  isAuthority() { return !this.dead && !this.shadow; }
  owns(x) { return x >= this.region.lo && x < this.region.hi; }
  inBand(x) { return x >= this.bandLo && x < this.bandHi; }
  near(a, b) { return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) <= this.radius; }
  sessionOf(avatar) {
    for (const [sid, s] of this.sessions) if (s.avatar === avatar) return { id: sid, gateway: s.gateway };
    return null;
  }
  onMsg(m) {
    if (this.dead) return;
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
    } else if (p.type === 'handoff') {
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
    } else if (p.type === 'promote') {
      this.shadow = false;
      this.promotedAt = this.curTick;
      this.sibling = p.sibling;
      for (const sid of this.sessions.keys()) this.needsKeyframe.add(sid);
    } else if (p.type === 'relink') {
      this.sibling = p.sibling;
    } else if (p.type === 'retire') {
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
    if (this.deathTick != null && this.curTick >= this.deathTick) this.dead = true;
    if (this.dead) return;
    if (this.failover && this.orch && !this.shadow) { this.net.send(this.addr, this.orch, { type: 'lease', zone: this.addr }); this.leasesSent++; }
    const SUP = this.shadow;
    for (const p of this.pending) {
      const e = this.ents.get(p.avatar);
      if (e) { e.x = (e.x + p.d.dx + this.grid) % this.grid; e.y = (e.y + p.d.dy + this.grid) % this.grid; }
    }
    this.pending = [];
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
    if (this.recovery && this.outbox.size) {
      for (const [hid, rec] of this.outbox) {
        if (this.curTick - rec.lastSent >= this.retxPeriod) {
          rec.lastSent = this.curTick; rec.retries++; this.retransmits++;
          this.net.send(this.addr, this.sibling, { type: 'handoff', handoffId: hid, avatar: rec.avatar, x: rec.x, y: rec.y, sessionId: rec.sessionId, gateway: rec.gateway, lastSeq: rec.lastSeq });
        }
      }
    }
    if (this.sibling) {
      const band = [];
      for (const [avatar, e] of this.ents) if (this.inBand(e.x)) band.push({ id: avatar, x: e.x, y: e.y });
      this.net.send(this.addr, this.sibling, { type: 'ghosts', ents: band });
      this.ghostMsgs++;
      this.ghostEntsSent += band.length;
    }
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

// ── [게임 서비스] InventoryService — 아이템 원장(가방). 존 tick 밖 *순수 반응형*(onTick 없음 = 신성한 tick 밖). ──
//   원장 = itemId→owner 의 *함수*(Map) → 구조적 소유자=1·dupe 불가. byOwner = 역인덱스(소유자→itemId 집합) — 트랜잭션
//   정합 교차검증(원장 ≡ byOwner). 이동(give) = sender release + receiver acquire 를 *한 onMsg 안에 원자적*(쌍 거래).
//   itemId = 전역 mint 카운터(아바타 비-인코딩 → 은닉). 재적용(전송 redundancy/dedup)에도 idempotent — 옮긴 아이템은
//   owner≠from 이라 두 번째 give 는 실패(중복 이동 0). 자기 자신/미소유/미존재 give 는 실패(phantom 0).
class InventoryService {
  constructor(opts = {}) {
    this.gateway = opts.gateway || 'gateway';
    this.ledger = new Map();      // itemId -> ownerAvatar (단일 진실 — 매 시점 소유자 정확히 1)
    this.byOwner = new Map();     // ownerAvatar -> Set<itemId> (역인덱스 — 트랜잭션 정합 교차검증)
    this.mintTotal = 0;           // 전역 mint 카운터(결정론 itemId)
    this.minted = 0; this.transfers = 0; this.failedOps = 0;
  }
  _own(owner, itemId) { if (!this.byOwner.has(owner)) this.byOwner.set(owner, new Set()); this.byOwner.get(owner).add(itemId); }
  onMsg(m) {
    const p = m.payload;
    if (p.type !== 'item_req') return;
    if (p.op === 'pickup') {
      const itemId = 'item' + (this.mintTotal++);   // 신규 아이템 mint(dupe 아님 — 새 itemId)
      this.ledger.set(itemId, p.avatar);
      this._own(p.avatar, itemId);
      this.minted++;
      this.net.send(this.addr, this.gateway, { type: 'item_result', ok: true, op: 'pickup', reqAvatar: p.avatar, itemId });
    } else if (p.op === 'give') {
      const owner = this.ledger.get(p.itemId);
      if (owner === p.fromAvatar && p.toAvatar && p.toAvatar !== p.fromAvatar) {
        // 쌍 거래 — release(from) + acquire(to) 원자적. 원장·역인덱스 동시 갱신(둘 다 한 onMsg).
        this.byOwner.get(p.fromAvatar).delete(p.itemId);
        this.ledger.set(p.itemId, p.toAvatar);
        this._own(p.toAvatar, p.itemId);
        this.transfers++;
        this.net.send(this.addr, this.gateway, { type: 'item_result', ok: true, op: 'give', reqAvatar: p.fromAvatar, toAvatar: p.toAvatar, itemId: p.itemId });
      } else {
        // 미소유/이미 이동/자기자신 — 거부(중복 이동·phantom 0). net.log 엔 fail 만(원장 무변경).
        this.failedOps++;
        this.net.send(this.addr, this.gateway, { type: 'item_result', ok: false, op: 'give', reqAvatar: p.fromAvatar, itemId: p.itemId });
      }
    }
  }
  itemCount() { return this.ledger.size; }
  ownerOf(itemId) { return this.ledger.get(itemId); }
}

// ── [게임 서비스] ChatService — 채널 팬아웃(채팅). 존 tick 밖 *순수 반응형*(onTick 없음 = 신성한 tick 밖). 0014 가방의 둘째 판. ──
//   가방이 *원장*(itemId→owner, 단일 소유)이라면 채팅은 *구독 라우팅 테이블*(channel→Set<avatar>, 멀티캐스트 팬아웃)이다.
//   say  = 한 발화를 *그 채널 구독자 전원*(발신자 제외)에게 팬아웃. 비-구독자에게 가는 것은 *구조적으로 불가*(구독 Set 만 순회).
//   whisper = *한 타깃*에게만 직접 라우팅(point-to-point — 구독 무관, byAvatar 로 타깃 게이트웨이 조회).
//   채널: 'global'(전체) · 'region:<r>'(지역 — 같은 region 멤버만) · 'whisper'(귓속말). join 시 global+자기 region 구독.
//   deliveries = 서버 권위 진실(누가 무엇을 받았나) — 클라 belief 의 수렴 대상. seq = 발신자 chat op 카운터(메시지 식별·결정론).
class ChatService {
  constructor(opts = {}) {
    this.gateway = opts.gateway || 'gateway';
    this.channels = new Map();    // channel -> Set<avatar> (구독 라우팅 — pub/sub 팬아웃 테이블·SSOT)
    this.byAvatar = new Map();    // avatar -> {gateway, region, subs:Set<channel>} (역인덱스 — whisper 타깃·구독 정리·누설 교차검증)
    this.deliveries = [];         // {to, channel, from, seq} (서버 권위 진실 — 클라 belief 수렴 대상)
    this.joins = 0; this.says = 0; this.whispers = 0; this.whisperFails = 0; this.fanout = 0;
  }
  _sub(ch, avatar) { if (!this.channels.has(ch)) this.channels.set(ch, new Set()); this.channels.get(ch).add(avatar); }
  _deliver(to, channel, from, seq, gateway) {
    this.deliveries.push({ to, channel, from, seq });
    this.fanout++;
    this.net.send(this.addr, gateway, { type: 'chat_out', toAvatar: to, channel, from, seq });
  }
  onMsg(m) {
    const p = m.payload;
    if (p.type !== 'chat_req') return;
    if (p.op === 'join') {
      const subs = new Set(['global', 'region:' + p.region]);   // 전체 + 자기 지역 채널 구독
      this.byAvatar.set(p.avatar, { gateway: m.from, region: p.region, subs });
      for (const ch of subs) this._sub(ch, p.avatar);
      this.joins++;
    } else if (p.op === 'say') {
      const me = this.byAvatar.get(p.fromAvatar);
      if (!me) return;                                          // 미가입 발신 — 무시(phantom 0)
      const ch = (p.scope === 'global') ? 'global' : 'region:' + me.region;   // 지역 채널은 *발신자 region* 으로 해석(채널 의미는 chat 소유)
      const subs = this.channels.get(ch);
      if (!subs) return;
      for (const a of subs) {                                   // 구독자 Set 순회(삽입 순서 = 결정론) — 비-구독자 도달 구조적 0
        if (a === p.fromAvatar) continue;                       // 발신자 제외(자기 발화 에코 없음)
        const tb = this.byAvatar.get(a);
        if (tb) this._deliver(a, ch, p.fromAvatar, p.seq, tb.gateway);
      }
      this.says++;
    } else if (p.op === 'whisper') {
      const tb = this.byAvatar.get(p.toAvatar);
      if (tb && p.toAvatar !== p.fromAvatar) {                  // 타깃 1명에게만(point-to-point) — 제3자 도달 0
        this._deliver(p.toAvatar, 'whisper', p.fromAvatar, p.seq, tb.gateway);
        this.whispers++;
      } else {
        this.whisperFails++;                                    // 미가입/자기자신 타깃 — 거부(phantom 0)
      }
    } else if (p.op === 'leave') {
      const e = this.byAvatar.get(p.avatar);
      if (e) { for (const ch of e.subs) { const s = this.channels.get(ch); if (s) s.delete(p.avatar); } this.byAvatar.delete(p.avatar); }
    }
  }
  subscriberCount(ch) { const s = this.channels.get(ch); return s ? s.size : 0; }
}

// ── 클라이언트 — 0009 그대로 + 가방 인텐트(별도 itemRng) + 채팅 인텐트(별도 chatRng — 둘 다 월드 move 스트림 비-침습) ──
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
    // ── 가방(0014) — 별도 itemRng·별도 belief. script.inventory OFF 면 전부 휴면(0013 비트 동일). ──
    this.itemRng = null;
    this.items = new Set();       // 클라가 *서버 권위로 확인한* 소유 아이템(item_result/recv 로만 갱신 → 원장 진실로 수렴)
    this.itemOps = 0;             // 발신한 아이템 인텐트 수(cap = script.itemOps)
    this.itemEvents = [];
    // ── 채팅(0015) — 별도 chatRng·별도 belief. script.chat OFF 면 전부 휴면(0014 비트 동일). ──
    this.chatRng = null;
    this.chatRecv = new Set();    // 클라가 *실제로 받은* 채팅(chat_msg 로만 갱신, 키 channel|from|seq → dup-safe·phantom 0)
    this.chatOps = 0;             // 발신한 채팅 인텐트 수(cap = script.chatOps)
    this.chatEvents = [];
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
    // 가방 인텐트 — 별도 itemRng·별도 채널. 월드 move 스트림(this.rng)을 *건드리지 않는다* → 존 상태 비-침습.
    if (this.script.inventory && this.itemRng && this.itemOps < (this.script.itemOps || 0) &&
        (this.phase === 'playing' || this.phase === 'settled')) {
      this._itemAction();
    }
    // 채팅 인텐트 — 별도 chatRng·별도 채널. 월드 move 스트림·itemRng 모두 *건드리지 않는다* → 존 상태 비-침습.
    if (this.script.chat && this.chatRng && this.chatOps < (this.script.chatOps || 0) &&
        (this.phase === 'playing' || this.phase === 'settled')) {
      this._chatAction();
    }
  }
  // say(전체/지역) 또는 whisper(AOI 로 보이는 피어에게 귓속말). chatRng 만 소비 → 월드·가방 스트림 무오염.
  _chatAction() {
    const peers = [...this.seen.keys()].filter(id => id !== this.avatar).sort();
    const roll = this.chatRng() % 3;
    if (roll === 0 && peers.length > 0) {
      const to = peers[this.chatRng() % peers.length];
      this.net.send(this.addr, 'gateway', { type: 'chat_whisper', to, seq: this.chatOps });
    } else {
      const scope = (this.chatRng() % 2 === 0) ? 'global' : 'region';
      this.net.send(this.addr, 'gateway', { type: 'chat_say', scope, seq: this.chatOps });
    }
    this.chatOps++;
  }
  // pickup(원장에 새 아이템) 또는 give(AOI 로 보이는 피어에게 소유 아이템 양도). 첫 3회는 pickup 로 가방 적재 후 거래.
  _itemAction() {
    const peers = [...this.seen.keys()].filter(id => id !== this.avatar).sort();
    const canGive = this.itemOps >= 3 && this.items.size > 0 && peers.length > 0;
    if (canGive && (this.itemRng() % 2 === 0)) {
      const peer = peers[this.itemRng() % peers.length];
      const itemsArr = [...this.items].sort();
      const itemId = itemsArr[this.itemRng() % itemsArr.length];
      this.net.send(this.addr, 'gateway', { type: 'item_give', itemId, toAvatar: peer });
    } else {
      this.net.send(this.addr, 'gateway', { type: 'item_pickup' });
    }
    this.itemOps++;
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
      if (this.script.inventory) this.itemRng = mulberry32((this.script.seed ^ 0x17E1) >>> 0);   // 가방 전용 — move rng(0xC11E)와 독립 스트림(OFF 면 미생성)
      if (this.script.chat) {
        this.chatRng = mulberry32((this.script.seed ^ 0xC4A7) >>> 0);                            // 채팅 전용 — move/item rng 와 독립 스트림(OFF 면 미생성)
        this.net.send(this.addr, 'gateway', { type: 'chat_join', region: this.script.region });  // 가입 = global + 자기 region 구독(존 우회)
      }
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
    } else if (p.type === 'item_result') {
      // 서버 권위 확인 — belief 는 결과로만 갱신(원장 진실로 수렴). pickup ok → 적재, give ok → 양도(제거).
      this.itemEvents.push(p.op + (p.ok ? ':ok' : ':fail'));
      if (p.ok) { if (p.op === 'pickup') this.items.add(p.itemId); else if (p.op === 'give') this.items.delete(p.itemId); }
    } else if (p.type === 'item_recv') {
      this.items.add(p.itemId);
      this.itemEvents.push('recv');
    } else if (p.type === 'chat_msg') {
      // 서버 팬아웃 수신 — belief 는 받은 것으로만(Set 키 channel|from|seq → 재전송 dup 멱등·phantom 0). 누설 검증의 클라 측 진실.
      this.chatRecv.add(p.channel + '|' + p.from + '|' + p.seq);
      this.chatEvents.push(p.channel);
    } else if (p.type === 'disconnect_ok') {
      this.phase = 'done';
    }
  }
  itemsSig() { return [...this.items].sort().join(','); }
  chatSig() { return [...this.chatRecv].sort().join(';'); }
  seenIds() { return [...this.seen.keys()].sort(); }
  seenSig() {
    return [...this.seen.entries()].map(([id, e]) => id + '@' + e.x + ',' + e.y).sort().join(';');
  }
}

// ── routeFilter — 0009 그대로 ──
const routeFilters = {
  handoff: (m) => /^zone/.test(m.from) && /^zone/.test(m.to) && m.payload.type === 'handoff',
  delta: (m) => /^zone/.test(m.from) && m.to === 'gateway' && m.payload.type === 'view_delta',
  both: (m) => (/^zone/.test(m.from) && /^zone/.test(m.to) && m.payload.type === 'handoff') ||
               (/^zone/.test(m.from) && m.to === 'gateway' && m.payload.type === 'view_delta'),
  // 가방 서버-측 홉(gateway↔inventory) — redundancy/dedup 아래 원장 보존(idempotent transfer) 검증용.
  item: (m) => (m.from === 'gateway' && m.to === 'inventory') || (m.from === 'inventory' && m.to === 'gateway'),
  // 채팅 서버-측 홉(gateway↔chat) — loss/redundancy 아래 best-effort 팬아웃(누설 0·지역 격리 보존, 완전성은 graceful 열화) 검증용.
  chat: (m) => (m.from === 'gateway' && m.to === 'chat') || (m.from === 'chat' && m.to === 'gateway'),
};

// ════════════════════════════════════════════════════════════════════════
//  토폴로지 빌더 — 인프로세스/멀티프로세스가 *같은 단일 경로*로 액터를 구성(E2E 동치의 토대).
//   buildTopology(opts) → { specs:[{addr,kind,seed,opts}], order:[addr...] }.  0009 run() 의 배선을
//   *선언적 spec* 으로 옮겼다(생성자 opts 에 전 배선 포함 — 후처리 0). makeActor(spec, net) 가 spec → 액터.
//   같은 spec → 같은 액터(시드 의사난수만) → 프로세스가 갈려도 같은 초기 상태.
// ════════════════════════════════════════════════════════════════════════
function buildTopology(opts) {
  const {
    seed, clients = 6, moves = 30, radius = 4, grid = 16, zones = 2,
    incremental = true, recovery = false, leave = {},
    retxPeriod, heartbeat, resyncPeriod,
    failover = false, deathTick = null, leaseTimeout, killZone = 'zone1',
    inventory = false, itemOps = 0,
    chat = false, chatOps = 0, regions = 2,
  } = opts;
  const H = Math.floor(grid / 2);
  const accounts = [];
  for (let i = 0; i < clients; i++) accounts.push('hero' + i);
  const specs = [];
  const order = [];
  const add = (s) => { specs.push(s); order.push(s.addr); };

  // 등록(=onTick) 순서는 0009 와 *정확히* 일치해야 reg 0: login·registry·gateway·zone1·zone2·[orch·zone1f·zone2f]·client*
  add({ addr: 'login', kind: 'login', opts: { accounts, seed } });
  add({ addr: 'registry', kind: 'registry', opts: {} });

  const zoneAddrs = zones === 1 ? ['zone1'] : ['zone1', 'zone2'];
  const replicas = (failover && zones === 2) ? ['zone1f', 'zone2f'] : [];
  const inventoryAddr = inventory ? 'inventory' : null;
  const chatAddr = chat ? 'chat' : null;
  add({ addr: 'gateway', kind: 'gateway', opts: { zoneAddrs, replicas, inventoryAddr, chatAddr } });
  // [게임 서비스] 가방 — inventory ON 일 때만 토폴로지에 존재(OFF = 0013 토폴로지 비트 동일). onTick 없음 = 신성한 tick 밖.
  if (inventory) add({ addr: 'inventory', kind: 'inventory', opts: { gateway: 'gateway' } });
  // [게임 서비스] 채팅 — chat ON 일 때만 토폴로지에 존재(OFF = 0014 토폴로지 비트 동일). onTick 없음 = 신성한 tick 밖.
  if (chat) add({ addr: 'chat', kind: 'chat', opts: { gateway: 'gateway' } });

  const zopt = { grid, radius, incremental, recovery, retxPeriod, heartbeat, failover };
  const orchAddr = (failover && zones === 2) ? 'orch' : null;
  if (zones === 1) {
    add({ addr: 'zone1', kind: 'zone', seed, opts: { ...zopt, region: { lo: 0, hi: grid }, sibling: null, boundary: grid, orch: orchAddr } });
  } else {
    const dt = (key) => (deathTick != null && killZone === key) ? deathTick : null;
    add({ addr: 'zone1', kind: 'zone', seed, opts: { ...zopt, region: { lo: 0, hi: H }, sibling: 'zone2', boundary: H, orch: orchAddr, deathTick: dt('zone1') } });
    add({ addr: 'zone2', kind: 'zone', seed, opts: { ...zopt, region: { lo: H, hi: grid }, sibling: 'zone1', boundary: H, orch: orchAddr, deathTick: dt('zone2') } });
  }

  if (failover && zones === 2) {
    add({ addr: 'orch', kind: 'orch', opts: { leaseTimeout, monitor: [['zone1', 'zone1f'], ['zone2', 'zone2f']] } });
    add({ addr: 'zone1f', kind: 'zone', seed, opts: { ...zopt, region: { lo: 0, hi: H }, sibling: 'zone2f', boundary: H, shadow: true, orch: 'orch' } });
    add({ addr: 'zone2f', kind: 'zone', seed, opts: { ...zopt, region: { lo: H, hi: grid }, sibling: 'zone1f', boundary: H, shadow: true, orch: 'orch' } });
  }

  for (let i = 0; i < clients; i++) {
    add({ addr: 'client' + i, kind: 'client', opts: { script: { account: accounts[i], seed: (seed + i * 0x9E37) >>> 0, moves, leaveTick: leave[i] != null ? leave[i] : null, resyncPeriod, inventory, itemOps, chat, chatOps, region: String(i % regions) } } });
  }
  return { specs, order, zoneAddrs, H, grid, radius, hasInventory: !!inventory, hasChat: !!chat };
}

// makeActor — spec → 액터(net 에 register). 인프로세스(engine Net)·호스트(HostNet shim) 양쪽이 같은 팩토리 사용.
function makeActor(spec, net) {
  let a;
  switch (spec.kind) {
    case 'login': a = new LoginServer(spec.opts.accounts, spec.opts.seed); break;
    case 'registry': a = new SessionRegistry(); break;
    case 'gateway': a = new Gateway(spec.opts.zoneAddrs, spec.opts.replicas, spec.opts.inventoryAddr, spec.opts.chatAddr); break;
    case 'zone': a = new EntityZone(spec.seed, spec.opts); break;
    case 'orch': a = new Orchestrator(spec.opts); break;
    case 'inventory': a = new InventoryService(spec.opts); break;
    case 'chat': a = new ChatService(spec.opts); break;
    case 'client': a = new Client(spec.opts.script); break;
    default: throw new Error('unknown kind ' + spec.kind);
  }
  net.register(spec.addr, a);
  return a;
}

// ════════════════════════════════════════════════════════════════════════
//  run — 인프로세스 모드(engine/Net). 0009 와 *비트 동일*(reg 0). 단일 경로(buildTopology+makeActor)로 구성.
// ════════════════════════════════════════════════════════════════════════
function run(opts) {
  const { seed, ticks = 48, transport = null, onTick = null } = opts;
  const topo = buildTopology(opts);
  const net = new Net({ transport, seed });
  const map = new Map();
  for (const spec of topo.specs) map.set(spec.addr, makeActor(spec, net));

  const gateway = map.get('gateway');
  const login = map.get('login');
  const registry = map.get('registry');
  const orch = map.get('orch') || null;
  const inventory = map.get('inventory') || null;
  const chat = map.get('chat') || null;
  const zoneObjs = topo.zoneAddrs.map(a => map.get(a));
  const followers = ['zone1f', 'zone2f'].map(a => map.get(a)).filter(Boolean);
  const clis = topo.specs.filter(s => s.kind === 'client').map(s => map.get(s.addr));
  const allZones = zoneObjs.concat(followers);

  const trace = [], seenTrace = [], deltaTrace = [], replicaTrace = [];
  let prevDeltaRec = 0;
  for (let i = 0; i < ticks; i++) {
    net.step();
    const committed = new Map();
    for (const z of allZones) if (z.isAuthority()) for (const av of z.ents.keys()) committed.set(av, (committed.get(av) || 0) + 1);
    const inflight = inflightSet(net, allZones);
    const live = new Set([...committed.keys(), ...inflight]);
    trace.push({ tick: i + 1, committed, inflight, liveN: live.size });
    seenTrace.push(clis.map(c => c.seenSig()));
    const curDeltaRec = zoneObjs.reduce((a, z) => a + z.deltaEnter + z.deltaExit + z.deltaUpdate, 0);
    deltaTrace.push(curDeltaRec - prevDeltaRec); prevDeltaRec = curDeltaRec;
    if (opts.failover) replicaTrace.push(replicaDivergence(zoneObjs, followers));
    // 옵션 onTick(t, state) 훅 — 미제공이면 호출 0(reg 0 불변). 레코더의 per-tick 엔티티 위치·AOI 시각화 활성용
    //   (TESTBED 마무리 ⒜·STATE §2). state.ents = [{id,x,y,zone,authority}], state.radius = AOI 반경.
    if (onTick) {
      const ents = [];
      for (const z of allZones) if (z.isAuthority()) for (const [id, e] of z.ents) ents.push({ id, x: e.x, y: e.y, zone: z.addr, authority: true });
      onTick(i + 1, { ents, radius: topo.radius, grid: topo.grid });
    }
  }
  const sum = (f) => zoneObjs.reduce((a, z) => a + f(z), 0);
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
  return { net, login, registry, gateway, orch, inventory, chat, zones: zoneObjs, followers, allZones, zoneAddrs: topo.zoneAddrs, clients: clis, trace, seenTrace, deltaTrace, replicaTrace, totals, H: topo.H, grid: topo.grid, radius: topo.radius, deathTick: opts.deathTick != null ? opts.deathTick : null, killZone: opts.killZone || 'zone1', mode: 'inproc' };
}

// ════════════════════════════════════════════════════════════════════════
//  runMulti — 멀티프로세스 모드(토픽 pub/sub 버스 + 소켓 층 열화). cluster.js 에 위임(Node 한정).
//   같은 buildTopology 로 토폴로지를 짜고, 각 서버 박스를 별 프로세스(spawn — IPC 0)에 띄워 broker(버스 허브)와
//   *토픽 발행/구독*으로 묶어 lockstep 배리어로 구동. opts.wire(드롭·분단·재연결)로 링크 열화를 주입.
//   반환 r 은 run() 과 같은 digest 함수들이 그대로 먹는 형태(zones/clients/net.log) + r.cluster(버스/열화 계측).
// ════════════════════════════════════════════════════════════════════════
function runMulti(opts) {
  if (typeof require === 'undefined') throw new Error('runMulti 는 Node 전용');
  return require('./cluster.js').runMulti(opts, { buildTopology, Net, fnv1a });
}

// ── 회계·트루스 헬퍼 (0009 그대로 — 인프로세스/멀티프로세스 재구성 r 둘 다 먹음) ──
function inflightSet(net, zoneObjs) {
  const out = new Set();
  for (const msgs of net.queue.values())
    for (const m of msgs)
      if (m.payload && m.payload.type === 'handoff' && /^zone[12]$/.test(m.to) && !net.delivered.has(m.id)) out.add(m.payload.avatar);
  for (const z of zoneObjs) if (z.isAuthority && z.isAuthority()) for (const rec of z.outbox.values()) out.add(rec.avatar);
  return out;
}
function authorityCount(t, avatar) {
  const c = t.committed.get(avatar) || 0;
  if (c > 0) return c;
  return t.inflight.has(avatar) ? 1 : 0;
}
function replicaDivergence(zoneObjs, followers) {
  const auth = new Map(), foll = new Map();
  for (const z of zoneObjs) if (!z.dead) for (const [id, e] of z.ents) auth.set(id, e.x + ',' + e.y);
  for (const z of followers) if (!z.dead && z.shadow) for (const [id, e] of z.ents) foll.set(id, e.x + ',' + e.y);
  let diff = 0;
  for (const [id, v] of auth) if (foll.get(id) !== v) diff++;
  for (const id of foll.keys()) if (!auth.has(id)) diff++;
  return diff;
}
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
function liveZones(r) { return r.allZones ? r.allZones.filter(z => z.isAuthority()) : r.zones; }
function ownerOf(r, avatar) {
  const live = liveZones(r);
  for (const z of live) if (z.ents.has(avatar)) return z.addr;
  return null;
}

// ── 가방(0014) 회계·트루스 헬퍼 (인프로세스/멀티프로세스 재구성 r 둘 다 먹음) ──
// 원장 보존 — 아이템은 소멸 없음·이동만 → ledger.size == minted (dupe·loss 0). 전송 열화에도 불변(idempotent).
function itemConserved(r) { return !!r.inventory && r.inventory.ledger.size === r.inventory.minted; }
// 트랜잭션 정합 — 원장(itemId→owner) ≡ byOwner 역인덱스(owner→Set). 비-원자 give 면 둘이 어긋난다.
function ledgerConsistent(r) {
  if (!r.inventory) return true;
  const inv = r.inventory;
  let total = 0;
  for (const [owner, set] of inv.byOwner) {
    total += set.size;
    for (const id of set) if (inv.ledger.get(id) !== owner) return false;   // byOwner 가 원장과 불일치
  }
  if (total !== inv.ledger.size) return false;                              // 합이 원장 크기와 다름(중복/누락)
  for (const [id, owner] of inv.ledger) { const s = inv.byOwner.get(owner); if (!s || !s.has(id)) return false; }
  return true;
}
// 아이템 단일 소유(belief 기준) — 수렴 후 어떤 itemId 도 두 클라가 동시에 소유 믿지 않음(=1). split-brain 검출.
function maxItemBeliefOwners(r) {
  const cnt = new Map();
  for (const c of r.clients) for (const id of (c.items || [])) cnt.set(id, (cnt.get(id) || 0) + 1);
  let mx = 0; for (const v of cnt.values()) if (v > mx) mx = v;
  return mx;
}
// 아이템 수렴(desync) — 클라 belief 가 원장 진실(자기 avatar 소유분)과 일치하는가. 행복 경로 수렴 후 0.
function itemDesync(r) {
  if (!r.inventory) return 0;
  const truth = new Map();
  for (const [id, owner] of r.inventory.ledger) { if (!truth.has(owner)) truth.set(owner, new Set()); truth.get(owner).add(id); }
  let d = 0;
  for (const c of r.clients) {
    if (!c.avatar) continue;
    const own = truth.get(c.avatar) || new Set();
    const belief = c.items instanceof Set ? c.items : new Set(c.items || []);
    if (own.size !== belief.size) { d++; continue; }
    let same = true; for (const id of own) if (!belief.has(id)) { same = false; break; }
    if (!same) d++;
  }
  return d;
}
function invDigest(r) {
  if (!r.inventory) return fnv1a('no-inventory');
  const led = [...r.inventory.ledger.entries()].map(([id, o]) => id + '=' + o).sort().join('|');
  return fnv1a(led + '#m' + r.inventory.minted + ';t' + r.inventory.transfers);
}

// ── 채팅(0015) 회계·트루스 헬퍼 (인프로세스/멀티프로세스 재구성 r 둘 다 먹음) ──
// 서버 권위 진실 — 의도된 배달 집합 D = {to|channel|from|seq}. 클라 belief 의 수렴 대상.
function _chatDeliverySet(r) { return new Set((r.chat.deliveries || []).map(d => d.to + '|' + d.channel + '|' + d.from + '|' + d.seq)); }
// 클라 belief 집합 B = ∪{avatar|channel|from|seq}. chat_msg 로만 채워짐(Set → dup 멱등).
function _chatBeliefSet(r) {
  const B = new Set();
  for (const c of r.clients) { if (!c.avatar) continue; const recv = c.chatRecv || []; for (const k of recv) B.add(c.avatar + '|' + k); }
  return B;
}
// 완전성(수렴) — |D \ B| = 의도됐으나 클라에 미도달한 배달 수. happy path(무손실) 0. 전송 열화면 graceful >0(best-effort).
function chatDesync(r) {
  if (!r.chat) return 0;
  const B = _chatBeliefSet(r); let miss = 0;
  for (const d of r.chat.deliveries) { if (!B.has(d.to + '|' + d.channel + '|' + d.from + '|' + d.seq)) miss++; }
  return miss;
}
// phantom — |B \ D| = 서버가 안 보낸 걸 클라가 믿는 수. 구조적 0(belief 는 서버 chat_msg 로만, 재전송 dup 은 Set 멱등).
function chatPhantom(r) {
  if (!r.chat) return 0;
  const D = _chatDeliverySet(r); let ph = 0;
  for (const c of r.clients) { if (!c.avatar) continue; for (const k of (c.chatRecv || [])) if (!D.has(c.avatar + '|' + k)) ph++; }
  return ph;
}
// 누설 — 비-구독자 도달 + 지역 격리 위반 수(둘 다 구조적 0이어야). 구독 테이블 교차검증(say 는 구독 Set 만 순회 = 구조적 보장).
//   region:X 배달의 수신자 region 이 X 가 아니면 격리 위반. whisper 는 구독 무관(직접 라우팅) → 누설 검사 제외.
function chatLeak(r) {
  if (!r.chat) return 0;
  let leak = 0;
  for (const d of r.chat.deliveries) {
    if (d.channel === 'whisper') continue;
    const e = r.chat.byAvatar.get(d.to);
    const subs = e ? e.subs : new Set();
    if (!subs.has(d.channel)) leak++;                                         // 비-구독자에게 배달(구조적 0)
    if (d.channel.startsWith('region:') && (!e || e.region !== d.channel.slice(7))) leak++;   // 지역 격리 위반
  }
  return leak;
}
// whisper 프라이버시 — 모든 whisper 배달이 정확히 타깃 1명(제3자 0). deliveries 의 whisper 수 == chat.whispers(서버 회계).
function chatWhisperPrivate(r) {
  if (!r.chat) return true;
  const wd = r.chat.deliveries.filter(d => d.channel === 'whisper').length;
  return wd === r.chat.whispers;
}
// 채널 누락 — 클라가 받은 채널이 자기 구독(또는 귓속말 타깃)에 모두 부합하는가(클라 측 누설 0 교차검증).
function chatClientNoLeak(r) {
  if (!r.chat) return true;
  for (const c of r.clients) {
    if (!c.avatar) continue;
    const e = r.chat.byAvatar.get(c.avatar);
    const subs = e ? e.subs : new Set();
    for (const k of (c.chatRecv || [])) {
      const ch = k.split('|')[0];
      if (ch === 'whisper') continue;                 // 귓속말은 구독 무관(타깃 수신 — phantom 검사가 정당성 보증)
      if (!subs.has(ch)) return false;                // 구독 안 한 채널 메시지 수신 = 누설
    }
  }
  return true;
}
function chatDigest(r) {
  if (!r.chat) return fnv1a('no-chat');
  const dl = (r.chat.deliveries || []).map(d => d.to + '|' + d.channel + '|' + d.from + '|' + d.seq).sort().join('#');
  return fnv1a(dl + ';j' + r.chat.joins + ';s' + r.chat.says + ';w' + r.chat.whispers + ';f' + r.chat.fanout);
}

const PUBLIC_ADDRS = ['login', 'gateway'];

// ── 모듈 노출 (dual-mode) ───────────
const __hktNet = {
  mulberry32, fnv1a, Net, LoginServer, SessionRegistry, Gateway, Orchestrator, EntityZone, InventoryService, ChatService, Client,
  buildTopology, makeActor, run, runMulti, routeFilters,
  inflightSet, authorityCount, replicaDivergence, globalAoiTruth, liveZones, ownerOf,
  itemConserved, ledgerConsistent, maxItemBeliefOwners, itemDesync, invDigest,
  chatDesync, chatPhantom, chatLeak, chatWhisperPrivate, chatClientNoLeak, chatDigest,
  PUBLIC_ADDRS, DEFAULTS,
};
if (typeof module !== 'undefined' && module.exports) module.exports = __hktNet;
if (typeof globalThis !== 'undefined') globalThis.HktNet = __hktNet;
