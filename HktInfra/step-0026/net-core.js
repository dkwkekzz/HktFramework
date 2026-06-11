// HktInfra step-0026 — in-flight mint 손실 복구 (클라 id-reconciliation 으로 복구 원장을 belief 로 재수렴 — 0025 §9 mint 손실 해소)
// step-0025(in-flight give 손실 복구) 위에 *한 조각*만 더한다 — STATE §2 ⒜(write-behind 신뢰성 마지막 잔여): "in-flight mint 손실 + 클라 id-reconciliation".
//   0023~0025 는 전송 손실(홉 중간·tail)과 in-flight give 를 닫았다. 마지막 남은 조각:
//     가방이 *활성 중* 죽으면 미-ack sentBuffer(in-flight mint 저널)가 소실 → 복구 원장에 mint 항목이 빠짐.
//     give 와 달리 mint 는 *서버가 itemId 를 새로 할당*(mint++)하므로 클라 재발행 = 새 id → 클라 belief(옛 id)와 불일치.
//     이 step 은 그 격차를 id-reconciliation 프로토콜로 닫는다:
//     · mintRecon 플래그 OFF 면 0025 *그대로* — sendReconcile/pickupLog 휴면·비트 동일(reg 0).
//     · ON: 클라가 *확인한 pickup*(item_result pickup ok)의 itemId 를 pickupLog 에 보관.
//        가방 복구 후 트리거(clientResync)에서 현재 belief(items)를 서버에 선언(item_reconcile).
//        서버는 원장에 *없는* 아이템을 새 id 로 re-mint → item_recon_map({ oldId, newId }) 응답.
//        클라 belief 에서 oldId → newId 로 교체 → 원장·belief 수렴(itemDesync 0).
//     · 멱등: 이미 원장에 있는 아이템은 skip(re-mint 없음) → 중복 reconcile 요청에도 dupe 0.
//        give 복구(0025 clientResend)와 함께 작동 — 두 sub-piece 가 각자의 조각을 메운다.
//
// 핵심 설계 — *id-reconciliation = 클라 belief 를 권위 선언으로 사용*:
//   라이브 ack 로 확인된 아이템 belief 는 *서버가 수락한 사실*(서버 권위) — 서버 crash 가 그 사실의 *저널*을 지웠어도 클라 belief 가 살아있다.
//   mint 는 *클라가 이미 받은 서버 권위 확인*(item_result)이므로 클라가 그 id 목록을 보내면 서버가 새 id 로 *서버 권위로 재발급*.
//   클라는 새 id 를 채택해 belief 를 갱신(id-reconciliation) — 라이브 ack ≠ 내구성의 마지막 격차.
//   월드 경로·제어 평면·채팅·버스·랭킹·영속/압축·0023~0025 신뢰 전달·give-resend 는 *그대로*(복사 전진).
//   더한 것: Client.pickupLog/sendReconcile + Gateway item_reconcile 라우팅/_relayItemRecon + InventoryService item_reconcile 핸들러 + run 루프 트리거 확장.
//
// 척추(SPINE.md) 준수:
//   - 신성한 tick: reconcile 메시지는 *존 tick 밖*(클라 제어 평면 트리거·가방 비동기 onMsg). 존 net.log·상태가 mintRecon on/off 에 비트 동일·존 도달 0.
//   - 결정론 코어: 복구 원장 = persist 저널(durable mint) + re-mint(reconcile) 의 함수 → 무손실 truth 와 비트 동일(invDigest). reconcile 은 시드 로그의 일부(결정론). = §4 "복제=재현".
//   - 권위 단일 소유: re-mint 도 InventoryService 가 원장에 기록(mintTotal++) — 클라 선언은 *요청*일 뿐. 소유자 belief ≤ 1(dupe 0).
//   - 은닉·단일 연결: item_reconcile 은 클라→게이트웨이 *정규 와이어*·서비스 내부 비가시. 복구 안무 누설 0.
//   - headless·원격 검증: node verify.js inflight 한 줄이 mint 저널에 손실을 주입해 recon ON=belief 재수렴(==무손실 truth) / OFF=itemDesync>0 을 4기둥 검증.
//   (가방·랭킹·버스·감사·영속/압축·존/orch/추종자·배리어·kill 생애주기·0023~0025 신뢰 전달·give-resend 는 *그대로 잇는다* — 복사 전진. 더한 로직은 Client pick-recon + 가방 reconcile 핸들러뿐.)
'use strict';
const __engine = (typeof module !== 'undefined' && module.exports && typeof require !== 'undefined')
  ? require('../engine/index.js')
  : globalThis.HktEngine;
const { Net, LoginServer, SessionRegistry, mulberry32, fnv1a } = __engine;

// 복원·failover 파라미터(0009 그대로) — opts 오버라이드 가능 결정론 상수. hkt.recovery.*·hkt.failover.* 노브의 더미판.
const DEFAULTS = { retxPeriod: 2, resyncPeriod: 3, heartbeat: 10, leaseTimeout: 3 };

// ── [엣지] 게이트웨이 — 0009 그대로(replicas 를 생성자 인자로 받게만 조정 — 토폴로지 빌더가 단일 경로로 배선) ──
class Gateway {
  constructor(zoneAddrs, replicas = [], inventoryAddr = null, chatAddr = null, busAddr = null) {
    this.zones = zoneAddrs.slice();      // 권위 존 주소(enter 라우팅 = zones[0])
    this.replicas = replicas.slice();    // 추종자(shadow) 주소 — failover 시 입력 미러 대상(0009=빈 배열 → 비트 동일)
    this.byClient = new Map();
    this.bySession = new Map();
    this.byAvatar = new Map();            // avatar → bind (가방·채팅 결과를 대상 클라로 라우팅 — service off 면 미사용)
    this.inventory = inventoryAddr;       // 가방 서비스 주소(null = 가방 분리 OFF 또는 버스 ON → 직접 결합 0)
    this.chat = chatAddr;                 // 채팅 서비스 주소(null = 채팅 분리 OFF 또는 버스 ON → 직접 결합 0)
    this.bus = busAddr;                   // 이벤트 버스 주소(null = 버스 OFF → 0015 직접 라우팅 비트 동일)
    this.dropped = 0;
    this.rejected = 0;
  }
  worldTargets() { return this.replicas.length ? this.zones.concat(this.replicas) : this.zones; }
  // 서비스 발신 단일 경로 — 버스 ON 이면 *토픽 발행*(소비자 주소 무지), OFF 면 0015 직접 라우팅(비트 동일).
  _svcSend(topic, directAddr, ev) {
    if (this.bus) { this.net.send(this.addr, this.bus, { type: 'pub', topic, ev }); return true; }
    if (directAddr) { this.net.send(this.addr, directAddr, ev); return true; }
    return false;
  }
  // 가방 결과 중계 — 요청자(reqAvatar)에게 item_result, give 성공이면 수신자(toAvatar)에게 item_recv. 은닉: itemId/op 만 전달.
  //   직접 모드(0015)와 버스 모드(svc.item.out ev)가 *같은 중계 함수*를 쓴다 — 클라 와이어 계약 불변.
  _relayItemResult(p) {
    if (p.type !== 'item_result') return;
    const rb = this.byAvatar.get(p.reqAvatar);
    if (rb) this.net.send(this.addr, rb.client, { type: 'item_result', ok: p.ok, op: p.op, itemId: p.itemId });
    if (p.ok && p.op === 'give') {
      const tb = this.byAvatar.get(p.toAvatar);
      if (tb) this.net.send(this.addr, tb.client, { type: 'item_recv', itemId: p.itemId });
    }
  }
  // id-reconciliation 응답 중계(이 step) — 가방이 돌려준 item_recon_map 을 요청 클라에게. 은닉: 매핑만(서비스 내부 비전달).
  //   직접 모드·버스 모드 모두 같은 함수(버스 봉투 해체 후 여기로). mintRecon OFF 면 가방이 메시지 0 → 호출 0(reg 0 불변).
  _relayItemRecon(p) {
    if (p.type !== 'item_recon_map') return;
    const rb = this.byAvatar.get(p.reqAvatar);
    if (rb) this.net.send(this.addr, rb.client, { type: 'item_recon_map', mappings: p.mappings });
  }
  // 채팅 팬아웃 중계 — chat 이 결정한 수신자(toAvatar)에게 chat_msg. 은닉: channel/from/seq 만(chat 내부·구독 테이블 비전달).
  _relayChatOut(p) {
    if (p.type !== 'chat_out') return;
    const tb = this.byAvatar.get(p.toAvatar);
    if (tb) this.net.send(this.addr, tb.client, { type: 'chat_msg', channel: p.channel, from: p.from, seq: p.seq });
  }
  // 랭킹 갱신 중계(이 step) — ranking 이 발행한 svc.rank.out 의 대상 아바타 클라에 rank_update. 은닉: count 만(ranking 내부 비전달).
  _relayRank(p) {
    if (p.type !== 'rank_update') return;
    const tb = this.byAvatar.get(p.avatar);
    if (tb) this.net.send(this.addr, tb.client, { type: 'rank_update', count: p.count });
  }
  onMsg(m) {
    const p = m.payload;
    if (m.from === 'registry') {
      if (p.type === 'validate_ok') {
        const bind = { client: p.ref, sessionId: p.sessionId, avatar: p.avatar };
        this.byClient.set(p.ref, bind);
        this.bySession.set(p.sessionId, bind);
        this.byAvatar.set(p.avatar, bind);   // 가방·채팅 결과 라우팅용(item_result/chat_out → 대상 클라; service off 면 미사용 → 비-침습)
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
    if (this.bus && m.from === this.bus) {
      // 버스 구독 수신(ev 봉투) — 게이트웨이는 *토픽*만 안다(서비스 주소 무지). 중계는 직접 모드와 같은 함수(클라 계약 불변).
      if (p.type === 'ev') {
        if (p.topic === 'svc.item.out') { this._relayItemResult(p.ev); this._relayItemRecon(p.ev); }   // item_result + item_recon_map(이 step) 둘 다 버스 경유
        else if (p.topic === 'svc.chat.out') this._relayChatOut(p.ev);
        else if (p.topic === 'svc.rank.out') this._relayRank(p.ev);   // 랭킹(이 step) — 발신하는 소비자의 출력 중계
      }
      return;
    }
    if (m.from === this.inventory) {
      this._relayItemResult(p);
      this._relayItemRecon(p);   // id-reconciliation 응답 중계(이 step) — item_recon_map 클라로. item_result 와 같은 직접 모드.
      return;
    }
    if (m.from === this.chat) {
      this._relayChatOut(p);
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
      // 가방 분리 — 아이템 인텐트는 *존을 우회*해 서비스 경로로(존 tick 비-침습). 버스 ON 이면 svc.item 토픽 발행(주소 무지).
      const bind = this.byClient.get(m.from);
      if (bind && (this.bus || this.inventory)) this._svcSend('svc.item', this.inventory, { type: 'item_req', op: 'pickup', avatar: bind.avatar });
      else this.dropped++;
    } else if (p.type === 'item_give') {
      const bind = this.byClient.get(m.from);
      if (bind && (this.bus || this.inventory)) this._svcSend('svc.item', this.inventory, { type: 'item_req', op: 'give', fromAvatar: bind.avatar, toAvatar: p.toAvatar, itemId: p.itemId });
      else this.dropped++;
    } else if (p.type === 'item_reconcile') {
      // id-reconciliation 요청(이 step·mintRecon) — 클라가 보낸 belief 목록을 가방에 전달. 가방이 없는 id 를 re-mint.
      //   클라가 avatar 를 포함하지 않아도 됨 — 게이트웨이가 bind.avatar 로 주입(은닉 유지: 클라는 서비스 내부 주소 모름).
      //   버스 ON 이면 svc.item 토픽 발행(주소 무지 — item_pickup/give 와 같은 경로). mintRecon OFF 면 클라가 메시지 0 → 도달 0(reg 0 불변).
      const bind = this.byClient.get(m.from);
      if (bind && (this.bus || this.inventory)) this._svcSend('svc.item', this.inventory, { type: 'item_reconcile', reqAvatar: bind.avatar, owned: p.owned });
      else this.dropped++;
    } else if (p.type === 'chat_join') {
      // 채팅 분리 — 구독 인텐트는 *존을 우회*해 서비스 경로로(존 tick 비-침습). 버스 ON 이면 svc.chat 토픽 발행(주소 무지).
      const bind = this.byClient.get(m.from);
      if (bind && (this.bus || this.chat)) this._svcSend('svc.chat', this.chat, { type: 'chat_req', op: 'join', avatar: bind.avatar, region: p.region });
      else this.dropped++;
    } else if (p.type === 'chat_say') {
      const bind = this.byClient.get(m.from);
      if (bind && (this.bus || this.chat)) this._svcSend('svc.chat', this.chat, { type: 'chat_req', op: 'say', fromAvatar: bind.avatar, scope: p.scope, seq: p.seq });
      else this.dropped++;
    } else if (p.type === 'chat_whisper') {
      const bind = this.byClient.get(m.from);
      if (bind && (this.bus || this.chat)) this._svcSend('svc.chat', this.chat, { type: 'chat_req', op: 'whisper', fromAvatar: bind.avatar, toAvatar: p.to, seq: p.seq });
      else this.dropped++;
    } else if (p.type === 'disconnect') {
      const bind = this.byClient.get(m.from);
      if (!bind) return;
      for (const z of this.worldTargets()) this.net.send(this.addr, z, { type: 'leave', sessionId: bind.sessionId, avatar: bind.avatar });
      if (this.bus || this.chat) this._svcSend('svc.chat', this.chat, { type: 'chat_req', op: 'leave', avatar: bind.avatar });   // 구독 테이블 대칭 정리(stale 팬아웃 방지)
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
    this.bus = opts.bus || null;  // 이벤트 버스 주소(null = 0015 직접 라우팅 비트 동일 — 버스 ON 이면 gateway 주소 미사용)
    this.persist = opts.persist || null;  // 영속 스토어 주소(null = 0016 비트 동일 — write-behind 저널 OFF). 가방 자기 데이터 스토어 명시 인터페이스.
    this.snapInterval = opts.snapshot || 0;  // 스냅샷 압축 주기(0018) — 저널 N항목마다 원장 스냅샷 발신(0 = 0017 비트 동일·압축 휴면).
    this.reliable = opts.reliable || false;  // 저널 홉 신뢰 전달(0023) — ON 이면 보낸 저널을 sentBuffer 에 보관하고 persist NAK 에 재전송(0008 ack/NAK 의 저널 홉 판). OFF = 0022 fire-and-forget 비트 동일.
    this.journalHb = opts.journalHb || false;  // 저널 홉 *tail* 손실 감지(이 step) — ON 이면 주기적 heartbeat 로 persist 에 maxSentSeq 통보 → persist 가 maxRecvSeq *위*의 tail 갭도 NAK 가능(0023 NAK-only 의 §9 사각 해소). reliable 위에 올라탐. OFF = 0023 비트 동일(heartbeat 0).
    this.hbPeriod = opts.hbPeriod || 8;        // heartbeat 주기(제어 평면 결정론 상수 — seed 무관·tick 동기 아님). t % hbPeriod == 0 에 통보.
    this.ledger = new Map();      // itemId -> ownerAvatar (단일 진실 — 매 시점 소유자 정확히 1)
    this.byOwner = new Map();     // ownerAvatar -> Set<itemId> (역인덱스 — 트랜잭션 정합 교차검증)
    this.mintTotal = 0;           // 전역 mint 카운터(결정론 itemId)
    this.journalSeq = 0;          // 저널 항목 시퀀스(영속 효과 로그의 단조 순번 — replay 멱등·순서 보존)
    this.sentBuffer = new Map();  // seq -> 보낸 저널 항목(0023·reliable 일 때만 채움) — persist NAK 시 재전송 소스(미-ack 보존). 압축/bound 는 후속.
    this.resends = 0;             // NAK 에 응답해 재전송한 저널 항목 누적(0023·계측)
    this.journalHbs = 0;          // 보낸 저널 heartbeat 수(이 step·journalHb·계측)
    this.minted = 0; this.transfers = 0; this.failedOps = 0;
  }
  _own(owner, itemId) { if (!this.byOwner.has(owner)) this.byOwner.set(owner, new Set()); this.byOwner.get(owner).add(itemId); }
  _unown(owner, itemId) { const s = this.byOwner.get(owner); if (s) s.delete(itemId); }
  // 결과 발신 단일 경로 — 버스 ON 이면 svc.item.out 토픽 발행(소비자 주소 무지), OFF 면 0015 직접 라우팅(비트 동일).
  _out(msg) {
    if (this.bus) this.net.send(this.addr, this.bus, { type: 'pub', topic: 'svc.item.out', ev: msg });
    else this.net.send(this.addr, this.gateway, msg);
  }
  // 영속 저널 쓰기(write-behind) — 수락한 효과를 PersistStore 로 fire-and-forget. persist OFF 면 no-op(0016 비트 동일).
  //   결과 ack 는 영속 ack 를 *기다리지 않는다*(write-behind) — 신성한 tick 밖 비동기. 저널 항목 = 재현(event sourcing)의 입력.
  _journal(entry) {
    if (!this.persist) return;
    const full = { ...entry, seq: this.journalSeq++ };
    if (this.reliable) this.sentBuffer.set(full.seq, full);   // 신뢰 전달(이 step) — 미-ack 보존(persist NAK 시 재전송). OFF 면 보관 0(0022 비트 동일).
    this.net.send(this.addr, this.persist, { type: 'journal', entry: full });
    // 스냅샷 압축(0018) — 저널 N항목마다 *원장 스냅샷*을 persist 로(write-behind·반응형·onTick 0 유지). persist 가 upToSeq 이하
    //   저널을 폐기 → 무한 성장 방지. 라이브 원장 비-침습(invDigest 불변) · 복구는 스냅샷 베이스 + tail replay(무손실 압축).
    if (this.snapInterval > 0 && this.journalSeq % this.snapInterval === 0) this._snapshot();
  }
  // 저널 홉 재전송(이 step·reliable) — persist 가 seq 갭을 감지해 보낸 NAK 에 응답: sentBuffer 의 미수신 항목을 다시 send(새 m.id·전송 손실 재노출).
  //   순수 반응형(onMsg·onTick 0 유지). persist 는 recvSeqs 로 멱등 수신(중복 push 0) → at-least-once 전송 위에 effectively-once 영속.
  _resend(missing) {
    for (const seq of missing) {
      const e = this.sentBuffer.get(seq);
      if (e) { this.net.send(this.addr, this.persist, { type: 'journal', entry: e, resend: true }); this.resends++; }   // resend:true — 재전송 사본 식별(전송층이 tail 시나리오에서 *최초 전송*만 떨굼 → 재전송은 신뢰 배달, 갭은 *감지* 문제로 격리)
    }
  }
  // 저널 홉 tail 손실 감지(이 step·journalHb) — 주기적 heartbeat 로 persist 에 *내가 보낸 최대 seq*(maxSentSeq) 통보.
  //   NAK-only(0023)는 persist 가 *받은* 최대 seq([0..maxRecvSeq])까지만 갭을 본다 → tail(최고 수신 *위*)을 못 본다(§9 사각).
  //   heartbeat 가 maxSentSeq 를 알려주면 persist 가 [maxRecvSeq+1..maxSentSeq] tail 갭도 NAK → 재전송으로 메움(write-behind 신뢰성의 tail 절반).
  //   *존 tick 밖*(가방 자체 제어 평면 onTick — 존 net.log/상태 비-기여·신성한 tick 보존). OFF 면 onTick no-op(0023 비트 동일).
  onTick(t) {
    if (!this.journalHb || !this.reliable || !this.persist) return;   // 휴면 = 0023 비트 동일(heartbeat 메시지 0)
    if (this.journalSeq <= 0 || t % this.hbPeriod !== 0) return;       // 아직 보낸 저널 없음 or 비-heartbeat tick
    this.net.send(this.addr, this.persist, { type: 'journal_hb', maxSentSeq: this.journalSeq - 1 });
    this.journalHbs++;
  }
  // 스냅샷 발신 — 현재 원장 상태(압축 베이스)를 persist 로. upToSeq = 직전 저널 항목 seq(스냅샷이 그 이하 효과를 *이미 반영*).
  //   ledger/mintTotal/minted/transfers 를 함께 — replay 가 이 베이스에서 tail 만 적용해 전체-저널 replay 와 비트 동일 재구성.
  _snapshot() {
    this.net.send(this.addr, this.persist, { type: 'snapshot', snap: {
      upToSeq: this.journalSeq - 1,
      ledger: [...this.ledger.entries()],
      mintTotal: this.mintTotal, minted: this.minted, transfers: this.transfers,
    } });
  }
  onMsg(m) {
    let p = m.payload;
    if (p.type === 'journal_nak') { if (this.reliable) this._resend(p.missing || []); return; }   // 저널 홉 NAK(이 step) — persist 가 감지한 갭 재전송(reactive·신성한 tick 밖)
    if (p.type === 'ev' && p.topic === 'svc.item') p = p.ev;   // 버스 봉투 해체(구독 수신) — 직접 모드와 같은 item_req/item_reconcile
    if (p.type === 'item_reconcile') {
      // id-reconciliation(이 step·mintRecon) — 클라가 믿는 아이템 id 목록을 받아 원장에 없는 것을 re-mint(새 id).
      //   belief = 서버가 라이브로 확인한 사실 → crash 가 그 mint 저널을 소실했을 뿐 → 서버가 새 id 로 재발급(권위 재-확인).
      //   원장에 이미 있는 id(durable mint)는 skip → 멱등(중복 요청·give-resend 와 공존에도 dupe 0).
      //   결과 item_recon_map 은 _out 으로 → gateway 가 클라에 중계(은닉). 매핑이 없으면(전부 durable) 응답 없음(클라 belief 변경 0).
      const av = p.reqAvatar;
      // mintTotal 하한 보정: 클라가 신고한 id 중 mintTotal 이상인 것이 있으면 충돌 방지(xfer 손실 시 mintTotal 이 너무 낮을 수 있음)
      for (const id of (p.owned || [])) {
        const n = parseInt(String(id).slice(4), 10);
        if (Number.isFinite(n) && n >= this.mintTotal) this.mintTotal = n + 1;
      }
      const mappings = [];
      for (const oldId of (p.owned || [])) {
        if (this.ledger.get(oldId) === av) continue;   // 이미 원장에 있음(durable mint) — skip
        const newId = 'item' + (this.mintTotal++);
        this.ledger.set(newId, av); this._own(av, newId);
        this.minted++;
        this._journal({ kind: 'mint', itemId: newId, owner: av });   // re-mint 도 저널에 기록 → 이후 crash/replay 에도 유지
        mappings.push({ oldId, newId });
      }
      if (mappings.length > 0) this._out({ type: 'item_recon_map', reqAvatar: av, mappings });
      return;
    }
    if (p.type !== 'item_req') return;
    if (p.op === 'pickup') {
      const itemId = 'item' + (this.mintTotal++);   // 신규 아이템 mint(dupe 아님 — 새 itemId)
      this.ledger.set(itemId, p.avatar);
      this._own(p.avatar, itemId);
      this.minted++;
      this._journal({ kind: 'mint', itemId, owner: p.avatar });   // 영속 효과 로그 — 새 가방이 replay 로 이 원장을 재현
      this._out({ type: 'item_result', ok: true, op: 'pickup', reqAvatar: p.avatar, itemId });
    } else if (p.op === 'give') {
      const owner = this.ledger.get(p.itemId);
      if (owner === p.fromAvatar && p.toAvatar && p.toAvatar !== p.fromAvatar) {
        // 쌍 거래 — release(from) + acquire(to) 원자적. 원장·역인덱스 동시 갱신(둘 다 한 onMsg).
        this._unown(p.fromAvatar, p.itemId);
        this.ledger.set(p.itemId, p.toAvatar);
        this._own(p.toAvatar, p.itemId);
        this.transfers++;
        this._journal({ kind: 'xfer', itemId: p.itemId, from: p.fromAvatar, to: p.toAvatar });
        this._out({ type: 'item_result', ok: true, op: 'give', reqAvatar: p.fromAvatar, toAvatar: p.toAvatar, itemId: p.itemId });
      } else {
        // 미소유/이미 이동/자기자신 — 거부(중복 이동·phantom 0). net.log 엔 fail 만(원장 무변경·저널 무기록).
        this.failedOps++;
        this._out({ type: 'item_result', ok: false, op: 'give', reqAvatar: p.fromAvatar, itemId: p.itemId });
      }
    }
  }
  // crash — 프로세스 사망(RAM 소실)의 인프로세스 모델: 원장·역인덱스·카운터 전부 비운다. PersistStore 는 *별 박스*라 무관.
  crash() {
    this.ledger = new Map(); this.byOwner = new Map();
    this.mintTotal = 0; this.journalSeq = 0;
    this.sentBuffer = new Map(); this.resends = 0; this.journalHbs = 0;   // 신뢰 전달(0023) — 새 프로세스는 미-ack 버퍼 0(죽기 전 in-flight 는 소실 = §9 write-behind 윈도 잔존). heartbeat 계측도 리셋(이 step).
    this.minted = 0; this.transfers = 0; this.failedOps = 0;
  }
  // replay — 영속 저널(효과 로그)로 원장을 *재현*(상태 전송 아님 = §4 "복제=재현"). seq 순서대로 mint/xfer 적용.
  //   mintTotal·journalSeq 를 *최대값+1* 로 복원(개수 아님) → 이후 itemId 연속성·seq 단조 보장. 완전 저널이면 max+1==개수(복구 투명).
  //   저널에 빈칸(write-behind 손실/비-contiguous)이 있어도 itemId 재사용·seq 중복이 구조적으로 불가(개수 기반의 함정 회피).
  replay(journal, snapshot) {
    const sorted = (journal || []).slice().sort((a, b) => a.seq - b.seq);
    let maxMintId = -1, maxSeq = -1;
    // 스냅샷 베이스(이 step) — 압축으로 폐기된 *헤드 저널*을 스냅샷 원장이 대신한다. 그 뒤 tail(seq>upToSeq)만 적용.
    //   snapshot 없으면(0017 전체 저널·압축 OFF) 이 블록 휴면 → 종전 경로와 비트 동일.
    if (snapshot) {
      for (const [id, owner] of snapshot.ledger) { this.ledger.set(id, owner); this._own(owner, id); }
      this.minted = snapshot.minted; this.transfers = snapshot.transfers;
      maxMintId = snapshot.mintTotal - 1;   // mintTotal 베이스(= 최대 itemId+1) — tail mint 가 더 밀어올릴 수 있음
      maxSeq = snapshot.upToSeq;             // seq 베이스 — tail 이 더 큰 seq 를 가짐
    }
    for (const e of sorted) {
      if (snapshot && e.seq <= snapshot.upToSeq) continue;   // 스냅샷에 이미 반영된 헤드는 건너뜀(압축 정합 — 이중 적용 방지)
      if (e.seq > maxSeq) maxSeq = e.seq;
      if (e.kind === 'mint') {
        this.ledger.set(e.itemId, e.owner); this._own(e.owner, e.itemId);
        this.minted++;
        const idNum = parseInt(String(e.itemId).slice(4), 10);   // 'item<N>' → N (mintTotal 복원 = max(N)+1)
        if (Number.isFinite(idNum) && idNum > maxMintId) maxMintId = idNum;
      } else if (e.kind === 'xfer') {
        this._unown(e.from, e.itemId); this.ledger.set(e.itemId, e.to); this._own(e.to, e.itemId);
        this.transfers++;
        const idNum = parseInt(String(e.itemId).slice(4), 10);   // xfer 항목도 maxMintId 추적 — mint 전체 손실 시 mintTotal=0 충돌 방지
        if (Number.isFinite(idNum) && idNum > maxMintId) maxMintId = idNum;
      }
    }
    this.mintTotal = maxMintId + 1;   // 다음 mint itemId = 'item'+(max+1) (개수 아님 — 빈칸에도 재사용 0)
    this.journalSeq = maxSeq + 1;     // 다음 저널 seq = max+1 (개수 아님 — 빈칸에도 중복 0)
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
    this.bus = opts.bus || null;  // 이벤트 버스 주소(null = 0015 직접 라우팅 비트 동일 — 버스 ON 이면 gateway 주소 미사용)
    this.persist = opts.persist || null;  // 채팅 영속 스토어 주소(0021·null = 0020 비트 동일 — write-behind 커맨드 로그 OFF). 0017 가방 PersistStore 의 채팅 판.
    this.snapInterval = opts.snapshot || 0;  // 커맨드 로그 스냅샷 압축 주기(이 step) — 커맨드 N항목마다 *라우팅 스냅샷* 발신(0 = 0021 비트 동일·압축 휴면).
    this.channels = new Map();    // channel -> Set<avatar> (구독 라우팅 — pub/sub 팬아웃 테이블·SSOT)
    this.byAvatar = new Map();    // avatar -> {gateway, region, subs:Set<channel>} (역인덱스 — whisper 타깃·구독 정리·누설 교차검증)
    this.deliveries = [];         // {to, channel, from, seq} (서버 권위 진실 — 클라 belief 수렴 대상)
    this.journalSeq = 0;          // 커맨드 로그 시퀀스(이 step·event sourcing 의 단조 순번 — replay 순서 보존)
    this.replaying = false;       // 복구 재실행 중 플래그(0021) — true 면 _deliver 가 deliveries/계측만 재현하고 *재발신 0*(net.log 비-기여)
    this.joins = 0; this.says = 0; this.whispers = 0; this.whisperFails = 0; this.fanout = 0;
    this.leaves = 0;              // 실제 탈퇴 누적(이 step) — 압축에도 불변인 *누적 커맨드 회계*(writes==join+say+whisper+leave 완전성 — journal.length 아님)
  }
  _sub(ch, avatar) { if (!this.channels.has(ch)) this.channels.set(ch, new Set()); this.channels.get(ch).add(avatar); }
  _deliver(to, channel, from, seq, gateway) {
    this.deliveries.push({ to, channel, from, seq });
    this.fanout++;
    if (this.replaying) return;   // 복구 재실행(이 step) — deliveries/팬아웃 계측만 재현, *재발신 0*(클라 중복 0·net.log 비-기여)
    // 버스 ON 이면 svc.chat.out 토픽 발행(소비자 주소 무지 — byAvatar.gateway 미사용), OFF 면 0015 직접 라우팅(비트 동일).
    if (this.bus) this.net.send(this.addr, this.bus, { type: 'pub', topic: 'svc.chat.out', ev: { type: 'chat_out', toAvatar: to, channel, from, seq } });
    else this.net.send(this.addr, gateway, { type: 'chat_out', toAvatar: to, channel, from, seq });
  }
  // 커맨드 로그 쓰기(이 step·write-behind) — 처리한 chat 커맨드를 PersistStore 로 fire-and-forget(신성한 tick 밖·ack 비대기).
  //   가방(0017)은 *효과*(mint/xfer)를 적었지만, 채팅은 *커맨드*(join/say/whisper/leave)를 적는다 — 라우팅 의존 팬아웃이라
  //   replay 가 *리듀서를 재실행*해 deliveries 를 재유도(순수 event sourcing). replay 중엔 기록 안 함(this.replaying 가드).
  _journal(entry) {
    if (!this.persist || this.replaying) return;
    this.net.send(this.addr, this.persist, { type: 'journal', entry: { ...entry, seq: this.journalSeq++ } });
    // 스냅샷 압축(이 step) — 커맨드 N항목마다 *라우팅 스냅샷*을 persist 로(write-behind·반응형·onTick 0 유지). persist 가 upToSeq 이하
    //   커맨드를 폐기 → 무한 성장 방지. 라이브 라우팅 비-침습(chatDigest 불변) · 복구는 라우팅 스냅샷 베이스 + tail replay(무손실 압축).
    //   가방(0018)이 *원장 값* 스냅샷이라면, 채팅은 *파생 라우팅 상태*(channels/byAvatar/deliveries/계측) 스냅샷 — 커맨드소싱의 압축 판.
    if (this.snapInterval > 0 && this.journalSeq % this.snapInterval === 0) this._snapshot();
  }
  // 스냅샷 발신(이 step) — 현재 *라우팅 파생 상태*(압축 베이스)를 persist 로. upToSeq = 직전 커맨드 seq(스냅샷이 그 이하 커맨드를 *이미 반영*).
  //   channels/byAvatar(라우팅) + deliveries(서버 권위 진실) + 계측을 함께 — replay 가 이 베이스에서 tail 커맨드만 재실행해 전체-커맨드 replay 와 비트 동일.
  //   Set/Map 은 *삽입 순서* 보존으로 직렬화(say 의 구독자 순회 순서 = deliveries 순서 결정론 — 복원도 동순서).
  _snapshot() {
    this.net.send(this.addr, this.persist, { type: 'snapshot', snap: {
      upToSeq: this.journalSeq - 1,
      channels: [...this.channels.entries()].map(([ch, set]) => [ch, [...set]]),
      byAvatar: [...this.byAvatar.entries()].map(([av, e]) => [av, { gateway: e.gateway, region: e.region, subs: [...e.subs] }]),
      deliveries: this.deliveries.slice(),
      joins: this.joins, says: this.says, whispers: this.whispers, whisperFails: this.whisperFails, fanout: this.fanout, leaves: this.leaves,
    } });
  }
  onMsg(m) {
    let p = m.payload;
    if (p.type === 'ev' && p.topic === 'svc.chat') p = p.ev;   // 버스 봉투 해체(구독 수신) — 직접 모드와 같은 chat_req
    if (p.type !== 'chat_req') return;
    // 정규화 — 페이로드를 *커맨드*(라우팅 무관 식별)로. gateway 주소(join 의 m.from)는 이 시점에만 보이므로 커맨드에 박는다(replay 재현용).
    let op = null;
    if (p.op === 'join') op = { kind: 'join', avatar: p.avatar, region: p.region, gateway: m.from };
    else if (p.op === 'say') op = { kind: 'say', fromAvatar: p.fromAvatar, scope: p.scope, mseq: p.seq };
    else if (p.op === 'whisper') op = { kind: 'whisper', fromAvatar: p.fromAvatar, toAvatar: p.toAvatar, mseq: p.seq };
    else if (p.op === 'leave') op = { kind: 'leave', avatar: p.avatar };
    if (op) this._process(op);
  }
  // _process — 단일 리듀서(이 step). live(onMsg)·복구(replay) *둘 다* 이 함수를 쓴다 → 로직 분기 0(divergence 위험 제거).
  //   상태 변이 + _deliver(팬아웃) + _journal(커맨드 로그·this.replaying 가드로 replay 중엔 기록 0). 0020 onMsg 와 *비트 동일* 동작(persist OFF 면 _journal no-op).
  _process(op) {
    if (op.kind === 'join') {
      const subs = new Set(['global', 'region:' + op.region]);   // 전체 + 자기 지역 채널 구독
      this.byAvatar.set(op.avatar, { gateway: op.gateway, region: op.region, subs });
      for (const ch of subs) this._sub(ch, op.avatar);
      this.joins++;
      this._journal(op);                                         // 가입 효과 — replay 가 이 구독을 재현
    } else if (op.kind === 'say') {
      const me = this.byAvatar.get(op.fromAvatar);
      if (!me) return;                                           // 미가입 발신 — 무시(phantom 0·저널 0)
      const ch = (op.scope === 'global') ? 'global' : 'region:' + me.region;   // 지역 채널은 *발신자 region* 으로 해석(채널 의미는 chat 소유)
      const subs = this.channels.get(ch);
      if (!subs) return;
      for (const a of subs) {                                    // 구독자 Set 순회(삽입 순서 = 결정론) — 비-구독자 도달 구조적 0
        if (a === op.fromAvatar) continue;                       // 발신자 제외(자기 발화 에코 없음)
        const tb = this.byAvatar.get(a);
        if (tb) this._deliver(a, ch, op.fromAvatar, op.mseq, tb.gateway);
      }
      this.says++;
      this._journal(op);                                         // 발화 커맨드 — replay 가 라우팅 재실행으로 deliveries 재유도(순서: 원본 onMsg 와 동일)
    } else if (op.kind === 'whisper') {
      const tb = this.byAvatar.get(op.toAvatar);
      if (tb && op.toAvatar !== op.fromAvatar) {                 // 타깃 1명에게만(point-to-point) — 제3자 도달 0
        this._deliver(op.toAvatar, 'whisper', op.fromAvatar, op.mseq, tb.gateway);
        this.whispers++;
        this._journal(op);                                       // 전달된 귓속말만 저널(미가입/자기자신은 효과 0 — 저널 0)
      } else {
        this.whisperFails++;                                     // 미가입/자기자신 타깃 — 거부(phantom 0·저널 0)
      }
    } else if (op.kind === 'leave') {
      const e = this.byAvatar.get(op.avatar);
      if (e) { for (const ch of e.subs) { const s = this.channels.get(ch); if (s) s.delete(op.avatar); } this.byAvatar.delete(op.avatar); this.leaves++; this._journal(op); }   // 실제 탈퇴만 저널(누적 leaves — 압축 완전성 회계)
    }
  }
  // crash(이 step) — 채팅 프로세스 사망(RAM 소실)의 인프로세스 모델: 라우팅 테이블·역인덱스·deliveries·계측 전부 비운다. PersistStore 는 *별 박스*라 무관.
  crash() {
    this.channels = new Map(); this.byAvatar = new Map(); this.deliveries = [];
    this.joins = 0; this.says = 0; this.whispers = 0; this.whisperFails = 0; this.fanout = 0;
    this.leaves = 0;
    this.journalSeq = 0;
  }
  // replay(이 step) — 커맨드 로그로 채팅 상태를 *재현*(상태 전송 아님 = §4 "복제=재현"). seq 순서대로 _process 재실행 — replaying 플래그로
  //   재발신은 억제하되 라우팅(channels/byAvatar)·deliveries·계측은 *비트 동일* 재구성(가방 replay 가 효과 재적용이라면, 채팅 replay 는 *커맨드 재실행*).
  replay(journal, snapshot) {
    this.replaying = true;
    try {
      const sorted = (journal || []).slice().sort((a, b) => a.seq - b.seq);
      let maxSeq = -1;
      // 스냅샷 베이스(이 step) — 압축으로 폐기된 *헤드 커맨드*를 라우팅 스냅샷이 대신한다(상태 직접 복원). 그 뒤 tail(seq>upToSeq) 커맨드만 _process.
      //   snapshot 없으면(0021 전체 커맨드 로그·압축 OFF) 이 블록 휴면 → 종전 경로와 비트 동일. Set/Map 은 직렬화 순서 그대로 복원(순회 순서 = deliveries 순서).
      if (snapshot) {
        this.channels = new Map((snapshot.channels || []).map(([ch, arr]) => [ch, new Set(arr)]));
        this.byAvatar = new Map((snapshot.byAvatar || []).map(([av, e]) => [av, { gateway: e.gateway, region: e.region, subs: new Set(e.subs) }]));
        this.deliveries = (snapshot.deliveries || []).slice();
        this.joins = snapshot.joins; this.says = snapshot.says; this.whispers = snapshot.whispers;
        this.whisperFails = snapshot.whisperFails; this.fanout = snapshot.fanout; this.leaves = snapshot.leaves || 0;
        maxSeq = snapshot.upToSeq;   // seq 베이스 — tail 이 더 큰 seq 를 가짐
      }
      for (const e of sorted) {
        if (snapshot && e.seq <= snapshot.upToSeq) continue;   // 스냅샷에 이미 반영된 헤드는 건너뜀(압축 정합 — 이중 적용 방지)
        if (e.seq > maxSeq) maxSeq = e.seq; this._process(e);
      }
      this.journalSeq = maxSeq + 1;   // 다음 커맨드 seq = max+1(개수 아님 — 빈칸에도 중복 0)
    } finally {
      this.replaying = false;   // 예외(손상 커맨드)로 중단돼도 *persistent* replaying 플래그를 반드시 해제 — 안 그러면 이후 live 가 재발신/저널 영구 침묵
    }
  }
  subscriberCount(ch) { const s = this.channels.get(ch); return s ? s.size : 0; }
}

// ── [버스] ServiceBus — 이벤트 버스의 *서비스 의미*(이 step 의 한 조각). 존 tick 밖 *순수 반응형*(onTick 없음). ──
//   0012 토픽 버스가 *전송*(broker 프레임 라우팅)이라면 이것은 *서버간 발행/구독 계약* — 발행자는 토픽만 알고
//   소비자 주소·존재를 모른다(구독자 0 이면 폐기). 라우팅 테이블 Map<topic, [subscriber...]> 이 SSOT — pub 은 그 토픽
//   구독자 *전부*에게 ev 사본을 팬아웃(배열 등록 순서 = 결정론 팬아웃 순서). 채팅의 channel→Set<avatar>(클라 단위)와
//   같은 자료구조 패턴의 *서버 박스 단위* 판. 구독은 토폴로지 빌더의 선언 spec(opts.subs)으로 — 새 소비자 추가 =
//   이 테이블에 행 추가뿐(발행자 spec·코드 무수정 — verify `decouple` 이 수치로 증명).
class ServiceBus {
  constructor(opts = {}) {
    this.topics = new Map();      // topic -> [subscriberAddr...] (구독 라우팅 테이블 — SSOT·등록 순서 = 팬아웃 순서)
    this.publishes = 0;           // pub 수신 수
    this.deliveries = 0;          // 구독자 전달 사본 수(팬아웃)
    this.unrouted = 0;            // 구독자 0 토픽 발행(폐기) — 발행자는 소비자 존재를 모른다는 의미의 회계
    if (opts.subs) for (const [topic, addr] of opts.subs) this._sub(topic, addr);
  }
  _sub(topic, addr) {
    if (!this.topics.has(topic)) this.topics.set(topic, []);
    const arr = this.topics.get(topic);
    if (!arr.includes(addr)) arr.push(addr);
  }
  onMsg(m) {
    const p = m.payload;
    if (p.type === 'sub') { this._sub(p.topic, m.from); return; }   // 런타임 구독 seam(0012 broker subscribe 와 동형) — 0016 토폴로지는 선언 spec 사용
    if (p.type !== 'pub') return;
    this.publishes++;
    const subs = this.topics.get(p.topic);
    if (!subs || !subs.length) { this.unrouted++; return; }
    for (const addr of subs) { this.deliveries++; this.net.send(this.addr, addr, { type: 'ev', topic: p.topic, ev: p.ev }); }
  }
  subscriberCount(topic) { const a = this.topics.get(topic); return a ? a.length : 0; }
}

// ── [게임 서비스] AuditService — "발행자 무수정으로 추가된 새 소비자"(가설의 핵). 존 tick 밖 *순수 반응형*(onTick 없음). ──
//   svc 토픽 4개를 구독해 서비스 이벤트 스트림을 관찰만 한다 — *발신 0*(net.send 호출이 없다) → 비-침습이 구조적.
//   추가는 버스 구독 테이블 행 + 이 박스뿐 — gateway/inventory/chat 의 spec·코드·발신 스트림은 비트 동일(verify `decouple`).
class AuditService {
  constructor() {
    this.seen = new Map();        // topic -> count (토픽별 수신 회계 — 발행 수와 대조)
    this.records = [];            // 'topic|JSON(ev)' — 관찰 스트림(E2E·repro 다이제스트 대상)
  }
  onMsg(m) {
    const p = m.payload;
    if (p.type !== 'ev') return;
    this.seen.set(p.topic, (this.seen.get(p.topic) || 0) + 1);
    this.records.push(p.topic + '|' + JSON.stringify(p.ev));
  }
}

// ── [게임 서비스] RankingService — "발신하는 둘째 소비자"(이 step 의 한 조각). 존 tick 밖 *순수 반응형*(onTick 없음). ──
//   AuditService(0016)가 *관찰 전용*(발신 0)이라면, 이것은 svc.item.out 을 *소비해* svc.rank.out 을 *발행*하는 consume→publish
//   루프 — 이벤트 기반 *읽기 모델*(CQRS read model). rank = 아바타별 보유 아이템 수의 투영(원장 byOwner 의 파생). 원장에 대한
//   *권위는 없다*(가방이 권위) — item_result 스트림에서 재계산하는 파생 뷰일 뿐. pickup ok → 요청자 +1, give ok → from -1·to +1
//   (실패 give 는 무변경 — p.ok 게이트). 변경된 아바타마다 svc.rank.out 발행 → gateway 가 그 아바타 클라에 rank_update 중계.
//   svc.rank.out 은 *어떤 item 서비스도 안 먹는다* → consume→publish 가 다시 item 이벤트를 안 낳음(루프 없음·발행 유계).
class RankingService {
  constructor(opts = {}) {
    this.bus = opts.bus || null;   // 이벤트 버스 주소(발행/구독 경유 — 소비자/발행자 주소 무지). ranking 은 bus 전제.
    this.ranks = new Map();        // avatar -> count (보유 아이템 수 투영 — 원장 byOwner 크기의 파생, 권위 아님)
    this.consumed = 0;             // svc.item.out 소비 수(발신하는 소비자의 *입력* 회계)
    this.published = 0;            // svc.rank.out 발행 수(consume→publish 의 *출력* 회계 — 변경분만, 유계)
  }
  _bump(avatar, delta) {
    const next = (this.ranks.get(avatar) || 0) + delta;
    if (next <= 0) this.ranks.delete(avatar); else this.ranks.set(avatar, next);
    const count = next <= 0 ? 0 : next;
    // consume→publish — 변경된 아바타의 rank 를 svc.rank.out 으로 발행(소비자 주소 무지). 0건 구독이어도 버스가 폐기(발행자 무관).
    if (this.bus) { this.net.send(this.addr, this.bus, { type: 'pub', topic: 'svc.rank.out', ev: { type: 'rank_update', avatar, count } }); this.published++; }
  }
  onMsg(m) {
    const p = m.payload;
    if (p.type !== 'ev' || p.topic !== 'svc.item.out') return;   // svc.item.out 구독 수신만(가방 결과 스트림)
    const ev = p.ev;
    if (ev.type !== 'item_result' || !ev.ok) return;             // 실패 op 는 원장 무변경 → rank 무변경(p.ok 게이트)
    this.consumed++;
    if (ev.op === 'pickup') this._bump(ev.reqAvatar, +1);
    else if (ev.op === 'give') { this._bump(ev.reqAvatar, -1); this._bump(ev.toAvatar, +1); }   // 쌍 이동 = 두 아바타 rank 변경
  }
  rankOf(avatar) { return this.ranks.get(avatar) || 0; }
  // crash(이 step) — 읽기 모델 프로세스 사망(RAM 소실)의 인프로세스 모델. 투영(ranks)·소비/발행 회계 전부 비운다.
  //   읽기 모델은 *자기 영속이 없다*(원장 권위는 가방) — 그래도 잃을 게 없다: 쓰기 모델의 영속 저널에서 *언제든 재계산* 가능(reconstruct).
  crash() {
    this.ranks = new Map();
    this.consumed = 0; this.published = 0;
  }
  // reconstruct(이 step) — 읽기 모델의 *late-join*: 자기 영속 0 인데도 *쓰기 모델의 영속 저널*(PersistStore)을 replay 해 투영을 재계산한다.
  //   매핑: mint → owner +1, xfer → from -1·to +1 (= item_result pickup/give 투영과 정확히 같다 — 저널은 가방이 *수락한* 효과만 담아
  //   ev.ok 게이트와 1:1). 스냅샷(0018 압축 베이스)이 있으면 폐기된 헤드를 원장 히스토그램으로 대신하고 tail(seq>upToSeq)만 적용.
  //   핵심: 다운타임 동안 버스가 흘려보낸 svc.item.out 은 *놓쳤어도*, 그 효과는 가방이 저널에 영속했으므로 저널 replay 가 *완전한* 투영을
  //   복원한다 — 휘발 스트림이 아니라 *내구 저널*이 복구원(CQRS 읽기 모델은 자기 영속 없이 쓰기 저널로 late-join). 발신 0(replay 와 같은 비-침습).
  reconstruct(journal, snapshot) {
    const counts = new Map();
    const bump = (a, d) => { if (a != null) counts.set(a, (counts.get(a) || 0) + d); };
    if (snapshot) for (const [, owner] of snapshot.ledger) bump(owner, +1);   // 압축된 헤드 = 스냅샷 원장의 보유 수 히스토그램(= byOwner 크기)
    const sorted = (journal || []).slice().sort((a, b) => a.seq - b.seq);
    for (const e of sorted) {
      if (snapshot && e.seq <= snapshot.upToSeq) continue;   // 스냅샷에 이미 반영된 헤드 건너뜀(이중 적용 방지 — 압축 정합)
      if (e.kind === 'mint') bump(e.owner, +1);
      else if (e.kind === 'xfer') { bump(e.from, -1); bump(e.to, +1); }
    }
    this.ranks = new Map();
    for (const [a, n] of counts) if (n > 0) this.ranks.set(a, n);   // n<=0 은 비보유(라이브 _bump 의 delete 규약과 동일) → byOwner 와 정확 일치
  }
}

// ── [데이터] PersistStore — 영속 진실(이 step 의 한 조각). SPINE 계층 6 첫 박스. 존 tick 밖 *순수 반응형*(onTick 없음). ──
//   가방의 효과 로그(append-only 저널)를 *프로세스 수명과 독립*으로 보관한다 — "세계가 세션보다 오래 산다". 가방 서비스가
//   죽어도(RAM 소실) 이 박스는 *살아서* 저널을 지킨다(자기 프로세스·데이터 계층) → 새 가방이 저널을 replay 해 원장을 재현.
//   저널 = [{seq,kind:'mint'|'xfer',...}] — event sourcing(상태 전송 아님 = §4 "복제=재현"). write-behind: 가방이 fire-and-forget
//   으로 append 하고 ack 를 안 기다린다(신성한 tick 밖 비동기). 발신 0 = 관찰 전용 스토어(가방이 읽기는 복구 시 제어 평면으로).
//   주의: 이번 step 은 *단일 인스턴스·메모리 저널*(스냅샷 압축·디스크 fsync·다중 복제·write 손실 ack/resend 없음 — 후속).
class PersistStore {
  constructor(opts = {}) {
    this.reliable = opts.reliable || false;  // 저널 홉 신뢰 수신(이 step) — ON 이면 seq 갭 감지 시 발신자에 NAK·중복 seq dedup(멱등). OFF = 0022 비트 동일(매 수신 push).
    this.journal = [];            // append-only 효과 로그(SSOT — replay 입력). 압축 후엔 tail(seq>snapshot.upToSeq)만 보존.
    this.writes = 0;              // append 수신 *누적* 수(압축에도 안 줄음 — 가방 수락 변이 = mint+xfer 와 대조의 진실). reliable 이면 *distinct seq* 수(dedup).
    this.snapshot = null;         // 최신 원장 스냅샷(압축 베이스 — {upToSeq,ledger,mintTotal,minted,transfers}). null = 압축 전(0017).
    this.snapshots = 0;           // 스냅샷 수신 수(압축 횟수)
    this.compacted = 0;           // 압축으로 폐기한 저널 항목 누적 수(절감량)
    this.recvSeqs = new Set();    // 수신한 저널 seq 집합(0023·reliable) — dedup(재전송 중복 0) + 갭 감지(미수신 seq 색출)
    this.maxRecvSeq = -1;         // 수신한 최대 seq(NAK-only 갭 범위의 상한 — [0..maxRecvSeq] 중 미수신 = 손실 후보). *받은* 것만 알므로 tail 은 못 본다(§9).
    this.expectedMaxSeq = -1;     // heartbeat 로 학습한 *발신자* 최대 seq(이 step·journalHb) — 갭 스캔 상한을 maxRecvSeq *위*로 끌어올려 tail 손실 감지(§9 해소).
    this.naks = 0;                // 갭 감지로 보낸 NAK 누적(0023·계측)
    this.tailNaks = 0;            // maxRecvSeq *위*(tail)의 갭을 포함한 NAK 누적(이 step·계측 — heartbeat 없이는 0 = §9 사각의 직접 증명)
  }
  // 갭 스캔 + NAK(0023 의 인라인 스캔을 helper 로 — journal 수신·heartbeat 둘 다 호출).
  //   상한 hi = max(maxRecvSeq, expectedMaxSeq) — heartbeat(이 step)가 expectedMaxSeq 를 올리면 tail 도 스캔. heartbeat 없으면 expectedMaxSeq=-1 → hi=maxRecvSeq(0023 비트 동일).
  _scanAndNak(to) {
    const hi = Math.max(this.maxRecvSeq, this.expectedMaxSeq);
    const missing = [];
    for (let s = 0; s <= hi; s++) if (!this.recvSeqs.has(s)) missing.push(s);
    if (missing.length > 0) {
      this.net.send(this.addr, to, { type: 'journal_nak', missing });
      this.naks++;
      if (missing.some(s => s > this.maxRecvSeq)) this.tailNaks++;   // tail(수신 최고 위) 갭 포함 = heartbeat 가 알려준 덕 — NAK-only 면 구조적으로 0
    }
  }
  onMsg(m) {
    const p = m.payload;
    if (p.type === 'journal') {
      if (!this.reliable) { this.journal.push(p.entry); this.writes++; return; }   // 0022 경로 — fire-and-forget(중복/갭 무처리)
      // 신뢰 수신(이 step) — dedup(이미 받은 seq 면 무시·재전송 중복 0) + 갭 감지 NAK(미수신 seq 를 발신자에 요청).
      const seq = p.entry.seq;
      if (!this.recvSeqs.has(seq)) {
        this.recvSeqs.add(seq); this.journal.push(p.entry); this.writes++;
        if (seq > this.maxRecvSeq) this.maxRecvSeq = seq;
      }
      // 미수신 seq 색출 → 있으면 발신자(m.from)에 NAK(재전송 요청). 매 수신 재-NAK = NAK 손실에도 결국 수렴(tail 손실은 heartbeat 가 알려야 — 이 step).
      this._scanAndNak(m.from);
      return;
    }
    // 저널 홉 heartbeat(이 step·journalHb) — 발신자가 통보한 maxSentSeq 로 갭 스캔 상한을 끌어올린다 → tail(최고 수신 위) 손실도 NAK.
    //   순수 반응형(onMsg). expectedMaxSeq 단조 증가. heartbeat 없으면 이 분기 휴면 → expectedMaxSeq=-1 → 0023 비트 동일.
    if (p.type === 'journal_hb') {
      if (!this.reliable) return;
      if (p.maxSentSeq > this.expectedMaxSeq) this.expectedMaxSeq = p.maxSentSeq;
      this._scanAndNak(m.from);
      return;
    }
    // 스냅샷 수신(이 step) — 압축: snapshot.upToSeq *이하* 저널 항목을 폐기(스냅샷이 그 상태를 이미 담음). tail 만 남김.
    //   writes 는 *안 줄인다*(누적 진실) — journalComplete 가 writes==mint+xfer 로 완전성을 본다(저널은 압축돼도 영속된 변이 수는 불변).
    if (p.type === 'snapshot') {
      this.snapshot = p.snap;
      const before = this.journal.length;
      this.journal = this.journal.filter(e => e.seq > p.snap.upToSeq);
      this.compacted += before - this.journal.length;
      this.snapshots++;
      return;
    }
  }
  size() { return this.journal.length; }
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
    this.rankBelief = null;       // 랭킹(0019) — 서버 rank_update 로만 갱신되는 내 보유 수 belief(null=미수신). 원장 byOwner 크기로 수렴.
    // ── in-flight give 손실 복구(0025) — 클라가 *확인한 give*(전송 인텐트)를 보관했다가 복구 시 재발행. clientResend OFF 면 휴면(0024 비트 동일). ──
    this.clientResend = script.clientResend || false;  // ON 이면 확인된 give 를 giveLog 에 보관·복구 resync 에 재발행(in-flight give 손실분 = 원장이 클라 belief 보다 뒤처진 분 을 재적용). give 만(pickup mint 는 이 step 에서 별도 처리).
    this.givePending = [];        // [{itemId, toAvatar}] — 발신했으나 결과 미확인 give(toAvatar 는 발신 시점에만 알 수 있다 — 게이트웨이가 item_result 에서 은닉). 결과로 확인/폐기.
    this.giveLog = [];            // [{itemId, toAvatar}] — item_result(give,ok) 로 *확인된* 전송. 재발행 소스(itemId 보존 → 멱등). clientResend 일 때만 채움.
    this.giveResends = 0;         // 복구 resync 에 재발행한 give 수(0025·계측)
    // ── in-flight mint 손실 복구(이 step) — 클라가 *확인한 pickup*(item_result pickup ok) itemId 를 보관해 복구 시 id-reconciliation 으로 재수렴. mintRecon OFF 면 휴면(0025 비트 동일). ──
    this.mintRecon = script.mintRecon || false;  // ON 이면 확인된 pickup itemId 를 pickupLog 에 보관·복구 resync 에 item_reconcile 발신(서버가 없는 id 를 re-mint → newId 응답 → belief 교체).
    this.pickupLog = [];          // [{itemId}] — item_result(pickup,ok) 로 *확인된* mint. reconcile 소스(belief 선언 기반 → 서버 re-mint 트리거). mintRecon 일 때만 채움.
    this.mintResends = 0;         // 복구 resync 에 발신한 reconcile 수(이 step·계측)
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
      if (this.clientResend) this.givePending.push({ itemId, toAvatar: peer });   // toAvatar 는 발신 시점에만 알 수 있다(게이트웨이 은닉) — 결과 대기 큐에 보관
      this.net.send(this.addr, 'gateway', { type: 'item_give', itemId, toAvatar: peer });
    } else {
      this.net.send(this.addr, 'gateway', { type: 'item_pickup' });
    }
    this.itemOps++;
  }
  // give 결과 확인(이 step·clientResend) — pending 에서 itemId 매칭분을 빼서 ok 면 giveLog(재발행 소스)로·실패면 폐기.
  //   ⚠ 전제: 클라↔게이트웨이↔가방 홉이 *in-order*(현 시나리오는 전송층이 persist 홉만 손실 → give 경로 FIFO). 그때만 결과가 발신 순서대로 와 첫-매칭이 옳다.
  //   재정렬 전송 하에선 같은 itemId 의 pending 이 다중 형성(belief 는 결과 시 갱신·발신 시 아님)되어 *틀린 toAvatar* 가 기록될 수 있다(§9 — 후속 opSeq 키잉으로 견고화).
  _confirmGive(itemId, ok) {
    const idx = this.givePending.findIndex(g => g.itemId === itemId);
    if (idx < 0) return;
    const g = this.givePending.splice(idx, 1)[0];
    if (ok) this.giveLog.push(g);
  }
  // in-flight give 손실 복구(이 step·clientResend) — 가방 복구 후 트리거되는 *재발행*: 확인했던 give 들을 같은 itemId 로 다시 보낸다.
  //   복구 원장은 in-flight 손실 give 의 효과가 *없다*(전송 미반영=아이템이 아직 sender 소유) → 재발행 give 가 owner==from 을 만족해 재적용 → 원장이 클라 belief 를 따라잡음.
  //   *멱등*: 이미 durable 한 give 는 복구 원장에서 owner==receiver(≠from) → 가방이 거부(이중 전송 0). itemId 보존(give 는 기존 id) → belief 무오염. pickup mint 손실은 id 재할당이라 미포함(§9).
  resendGives() {
    if (!this.clientResend || !this.avatar) return;
    for (const g of this.giveLog) { this.net.send(this.addr, 'gateway', { type: 'item_give', itemId: g.itemId, toAvatar: g.toAvatar }); this.giveResends++; }
  }
  // id-reconciliation(이 step·mintRecon) — 가방 복구 후 트리거되는 *belief 선언*: 현재 보유 아이템 id 목록을 서버에 보낸다.
  //   서버는 원장에 없는 id 를 re-mint(새 id)·item_recon_map 응답 → 클라가 belief 에서 oldId→newId 교체 → 수렴(itemDesync 0).
  //   멱등: 서버는 원장에 이미 있는 id 를 skip(re-mint 0) → 중복 reconcile 에도 dupe 0. mintRecon OFF 면 휴면(0025 비트 동일).
  sendReconcile() {
    if (!this.mintRecon || !this.avatar) return;
    const owned = [...this.items].sort();
    if (owned.length === 0) return;
    this.net.send(this.addr, 'gateway', { type: 'item_reconcile', owned });
    this.mintResends++;
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
      if (p.ok) {
        if (p.op === 'pickup') {
          this.items.add(p.itemId);
          if (this.mintRecon) this.pickupLog.push({ itemId: p.itemId });   // 확인된 mint → pickupLog(복구 reconcile 소스·id 보관)
        } else if (p.op === 'give') { this.items.delete(p.itemId); if (this.clientResend) this._confirmGive(p.itemId, true); }   // 확인된 전송 → giveLog(복구 재발행 소스·toAvatar 는 pending 에서)
      } else if (p.op === 'give' && this.clientResend) {
        this._confirmGive(p.itemId, false);   // 실패한 give → pending 에서 폐기(재발행하지 않음 — 원장 미반영분 아님)
      }
    } else if (p.type === 'item_recon_map') {
      // id-reconciliation 응답(이 step·mintRecon) — 서버가 re-mint 한 {oldId,newId} 매핑으로 belief 교체.
      //   oldId(in-flight mint loss)는 서버 원장에 없었고 → 서버가 새 id 로 re-mint → 클라가 belief 에서 oldId 제거·newId 추가.
      //   멱등: 이미 belief 에 없는 oldId 는 무해. 신성한 tick 비-침습(항상 클라 메시지 처리, 존 tick 밖).
      for (const { oldId, newId } of (p.mappings || [])) {
        this.items.delete(oldId);
        this.items.add(newId);
        const e = this.pickupLog.find(x => x.itemId === oldId);
        if (e) e.itemId = newId;   // log 도 갱신(이후 re-reconcile 시 stale oldId 로 다시 보내지 않도록)
      }
    } else if (p.type === 'item_recv') {
      this.items.add(p.itemId);
      this.itemEvents.push('recv');
    } else if (p.type === 'rank_update') {
      this.rankBelief = p.count;   // 랭킹(0019) — 발신하는 소비자(ranking)→gateway→클라. 최신 rank 만(원장 byOwner 크기로 수렴).
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
  // 이벤트 버스 홉(bus 출입 전체 — pub·ev) — loss/redundancy 아래 라우팅 정확성(누설/phantom 0)·원장 보존 검증용(0016).
  svcbus: (m) => m.from === 'bus' || m.to === 'bus',
  // 영속 저널 홉(inventory→persist) — loss/redundancy 아래 라우팅 정확성·원장 보존(저널 미사용 시 무해) 검증용(0017).
  persist: (m) => m.to === 'persist' || m.from === 'persist',
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
    bus = false, audit = false,
    persist = false, snapshot = 0, journalReliable = false, journalHeartbeat = false,
    ranking = false,
    chatpersist = false, chatSnapshot = 0,
    clientResend = false,
    mintRecon = false,
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
  const busAddr = bus ? 'bus' : null;
  const persistAddr = (persist && inventory) ? 'persist' : null;   // 영속 = 가방 전제(가방 원장의 데이터 계층). persist OFF → 0016 비트 동일.
  const rankingAddr = (ranking && bus && inventory) ? 'ranking' : null;   // 랭킹 = bus+가방 전제(item 이벤트 소비). ranking OFF → 0018 비트 동일.
  const chatPersistAddr = (chatpersist && chat) ? 'chatpersist' : null;   // 채팅 영속(이 step) = 채팅 전제(채팅 커맨드 로그의 데이터 계층). OFF → 0020 비트 동일.
  // 버스 ON 이면 gateway 는 서비스 *주소를 모른다*(inventoryAddr/chatAddr = null — 토픽만) = 직접 결합의 구조적 제거.
  add({ addr: 'gateway', kind: 'gateway', opts: { zoneAddrs, replicas, inventoryAddr: busAddr ? null : inventoryAddr, chatAddr: busAddr ? null : chatAddr, busAddr } });
  // [버스] ServiceBus — bus ON 일 때만 토폴로지에 존재(OFF = 0015 토폴로지 비트 동일). onTick 없음 = 신성한 tick 밖.
  //   구독 = 선언 spec(이 테이블이 SSOT). *새 소비자(audit) 추가 = 여기 행 추가뿐* — 발행자 spec 무수정(decouple 가설).
  if (bus) {
    const subs = [];
    if (inventory) subs.push(['svc.item', 'inventory'], ['svc.item.out', 'gateway']);
    if (chat) subs.push(['svc.chat', 'chat'], ['svc.chat.out', 'gateway']);
    // 랭킹(이 step) — *발행자 무수정으로* svc.item.out 에 둘째 소비자(ranking) 행 추가 + svc.rank.out 을 gateway 가 구독(클라 중계).
    if (rankingAddr) subs.push(['svc.item.out', 'ranking'], ['svc.rank.out', 'gateway']);
    if (audit) for (const t of ['svc.item', 'svc.item.out', 'svc.chat', 'svc.chat.out']) subs.push([t, 'audit']);
    if (audit && rankingAddr) subs.push(['svc.rank.out', 'audit']);   // audit 도 rank 스트림 관찰(둘째 소비자의 둘째 소비자)
    add({ addr: 'bus', kind: 'bus', opts: { subs } });
  }
  // [데이터] 영속 스토어 — persist ON 일 때만 토폴로지에 존재(OFF = 0016 토폴로지 비트 동일). onTick 없음 = 신성한 tick 밖.
  //   가방보다 *먼저* 등록(=onTick 순서 무관·onTick 0). 가방이 죽어도 이 박스는 산다(데이터 계층 = 세션보다 오래).
  //   reliable (이 step) — persist ON 일 때만 의미(저널 홉 갭 감지·NAK·dedup). OFF → 0022 비트 동일.
  if (persistAddr) add({ addr: 'persist', kind: 'persist', opts: { reliable: journalReliable } });
  // [게임 서비스] 가방 — inventory ON 일 때만 토폴로지에 존재(OFF = 0013 토폴로지 비트 동일). onTick 없음 = 신성한 tick 밖.
  //   persist ON 이면 자기 데이터 스토어 주소를 안다(write-behind 저널 — 명시 인터페이스). OFF 면 null(0016 비트 동일).
  //   snapshot:N (이 step) — persist ON 일 때만 의미(저널 N항목마다 압축 스냅샷 발신). OFF(0)면 0017 비트 동일.
  //   journalHb (이 step) — persist+reliable ON 일 때만 의미(heartbeat 로 tail 손실 감지). OFF → 0023 비트 동일(heartbeat 0).
  if (inventory) add({ addr: 'inventory', kind: 'inventory', opts: { gateway: 'gateway', bus: busAddr, persist: persistAddr, snapshot: persistAddr ? snapshot : 0, reliable: persistAddr ? journalReliable : false, journalHb: persistAddr ? journalHeartbeat : false } });
  // [데이터] 채팅 영속 스토어(이 step) — chatpersist ON 일 때만 존재(OFF = 0020 토폴로지 비트 동일). PersistStore *재사용*(범용 저널) —
  //   가방 persist 와 *독립 인스턴스*(채팅 커맨드 로그). 채팅보다 먼저 등록(onTick 0·순서 무관). 채팅이 죽어도 이 박스는 산다(데이터 계층).
  if (chatPersistAddr) add({ addr: 'chatpersist', kind: 'persist', opts: {} });
  // [게임 서비스] 채팅 — chat ON 일 때만 토폴로지에 존재(OFF = 0014 토폴로지 비트 동일). onTick 없음 = 신성한 tick 밖.
  //   chatpersist ON 이면 자기 데이터 스토어 주소를 안다(write-behind 커맨드 로그 — 명시 인터페이스). OFF 면 null(0020 비트 동일).
  //   snapshot:N (이 step) — chatpersist ON 일 때만 의미(커맨드 N항목마다 라우팅 스냅샷 압축). OFF(0)면 0021 비트 동일.
  if (chat) add({ addr: 'chat', kind: 'chat', opts: { gateway: 'gateway', bus: busAddr, persist: chatPersistAddr, snapshot: chatPersistAddr ? chatSnapshot : 0 } });
  // [게임 서비스] 감사(audit) — 발행자 무수정으로 추가된 새 소비자(bus 전제). 발신 0 = 구조적 비-침습.
  if (bus && audit) add({ addr: 'audit', kind: 'audit', opts: {} });
  // [게임 서비스] 랭킹(ranking) — *발신하는* 둘째 소비자(이 step). svc.item.out 소비 → rank 투영 → svc.rank.out 발행(consume→publish).
  //   bus+가방 전제. OFF 면 토폴로지에 없음(0018 비트 동일). onTick 없음 = 신성한 tick 밖·권위 아닌 읽기 모델(CQRS).
  if (rankingAddr) add({ addr: 'ranking', kind: 'ranking', opts: { bus: busAddr } });

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
    add({ addr: 'client' + i, kind: 'client', opts: { script: { account: accounts[i], seed: (seed + i * 0x9E37) >>> 0, moves, leaveTick: leave[i] != null ? leave[i] : null, resyncPeriod, inventory, itemOps, chat, chatOps, region: String(i % regions), clientResend, mintRecon } } });
  }
  return { specs, order, zoneAddrs, H, grid, radius, hasInventory: !!inventory, hasChat: !!chat, hasBus: !!bus, hasAudit: !!(bus && audit), hasPersist: !!persistAddr };
}

// makeActor — spec → 액터(net 에 register). 인프로세스(engine Net)·호스트(HostNet shim) 양쪽이 같은 팩토리 사용.
function makeActor(spec, net) {
  let a;
  switch (spec.kind) {
    case 'login': a = new LoginServer(spec.opts.accounts, spec.opts.seed); break;
    case 'registry': a = new SessionRegistry(); break;
    case 'gateway': a = new Gateway(spec.opts.zoneAddrs, spec.opts.replicas, spec.opts.inventoryAddr, spec.opts.chatAddr, spec.opts.busAddr); break;
    case 'zone': a = new EntityZone(spec.seed, spec.opts); break;
    case 'orch': a = new Orchestrator(spec.opts); break;
    case 'inventory': a = new InventoryService(spec.opts); break;
    case 'chat': a = new ChatService(spec.opts); break;
    case 'bus': a = new ServiceBus(spec.opts); break;
    case 'audit': a = new AuditService(spec.opts); break;
    case 'ranking': a = new RankingService(spec.opts); break;
    case 'persist': a = new PersistStore(spec.opts); break;
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
  const bus = map.get('bus') || null;
  const audit = map.get('audit') || null;
  const ranking = map.get('ranking') || null;
  const persist = map.get('persist') || null;
  const chatpersist = map.get('chatpersist') || null;
  const zoneObjs = topo.zoneAddrs.map(a => map.get(a));
  const followers = ['zone1f', 'zone2f'].map(a => map.get(a)).filter(Boolean);
  const clis = topo.specs.filter(s => s.kind === 'client').map(s => map.get(s.addr));
  const allZones = zoneObjs.concat(followers);

  const trace = [], seenTrace = [], deltaTrace = [], replicaTrace = [];
  let prevDeltaRec = 0;
  for (let i = 0; i < ticks; i++) {
    // 가방 서비스 failover(이 step) — invRestart.at tick 의 deliver *직전*에 crash+replay. 제어 평면(net.log 비-기여) → 멀티프로세스와 비트 동일.
    //   인프로세스 모델: 같은 inventory 객체를 crash()(RAM 소실)한 뒤 PersistStore 저널을 replay(persist ON) → 죽기 전 원장 재현(복구 투명).
    //   persist OFF 면 replay 없음(원장 비고 = 영속 부재의 대가 = 대조군). PersistStore 는 *별 박스*라 crash 의 영향을 안 받는다(데이터 계층 = 세션보다 오래).
    //   주의(write-behind 윈도): 저널은 1-tick 비동기라 crash 시점에 in-flight 항목이 있으면 손실 — 시나리오는 가방이 *정지(quiescent)* 한 늦은 tick 에 재시작해 투명(후속: ack/resend·스냅샷 압축).
    if (opts.invRestart && inventory && i + 1 === opts.invRestart.at) {
      inventory.crash();
      if (persist) inventory.replay(persist.journal, persist.snapshot);   // 스냅샷(이 step)+tail replay — 압축 OFF 면 snapshot=null(0017 전체 저널)
    }
    // in-flight give 손실 복구(이 step) — clientResync.at 의 deliver *직전*에 클라들이 확인된 give 를 *재발행*(가방 복구 핸드셰이크의 클라 측).
    //   복구 원장은 in-flight 손실 give 효과가 빠져 있다(아이템이 sender 소유로 되돌려짐) → 재발행이 그 전송을 재적용 → 원장이 클라 belief 따라잡음(itemDesync→0).
    //   제어 평면 트리거(invRestart 처럼 run 루프가 주입) — 재발행 메시지는 client→gateway→inventory 정규 라우팅. clientResync 미제공/clientResend OFF 면 호출 0(reg 0 불변).
    if (opts.clientResync && i + 1 === opts.clientResync.at) for (const c of clis) { c.resendGives(); c.sendReconcile(); }   // 0025 give-resend + 이 step mint reconcile 동시 트리거
    // 읽기 모델(랭킹) failover(이 step 의 한 조각) — rankRestart.at 의 deliver *직전*에 crash+reconstruct(invRestart 와 같은 위치·제어 평면).
    //   읽기 모델은 *자기 영속이 없다* — crash(RAM 소실) 후 *쓰기 모델의 영속 저널*(PersistStore)을 reconstruct 해 투영을 재계산한다
    //   (CQRS late-join: 휘발 svc.item.out 스트림이 아니라 *내구 저널*이 복구원). persist OFF 면 reconstruct 없음 = 투영 소실(영속 부재의 대가 = 대조군).
    //   늦은 quiescent tick(활동 정지 후)이라 클라 rankBelief 는 이미 수렴 — 재발행 불필요(rankDesync 0 유지). PersistStore 는 별 박스라 ranking 죽음과 독립.
    if (opts.rankRestart && ranking && i + 1 === opts.rankRestart.at) {
      ranking.crash();
      if (persist) ranking.reconstruct(persist.journal, persist.snapshot);   // 쓰기 저널 replay → 투영 재계산(스냅샷 압축 베이스 + tail). persist OFF → 소실.
    }
    // 채팅 서비스 failover(이 step 의 한 조각) — chatRestart.at 의 deliver *직전*에 crash+replay(invRestart 와 같은 위치·제어 평면·net.log 비-기여).
    //   가방(0017)이 *효과 저널*(mint/xfer)을 replay 했다면, 채팅은 *커맨드 로그*(join/say/whisper/leave)를 replay 해 라우팅 테이블+deliveries 를
    //   리듀서 재실행으로 재현(순수 event sourcing·재발신 0). chatpersist OFF 면 replay 없음 = 구독/배달 소실(영속 부재의 대가 = 대조군).
    //   늦은 quiescent tick(채팅 정지 후)라 클라 belief 는 이미 수렴. PersistStore 는 별 박스라 채팅 죽음과 독립(데이터 계층 = 세션보다 오래).
    if (opts.chatRestart && chat && i + 1 === opts.chatRestart.at) {
      chat.crash();
      if (chatpersist) chat.replay(chatpersist.journal, chatpersist.snapshot);   // 라우팅 스냅샷(이 step)+tail 커맨드 replay → 라우팅+deliveries 재현. chatpersist OFF → 소실.
    }
    // 시나리오 inject write-seam(TESTBED §10-4 — 0011 onTick 선례) — 미제공이면 호출 0(reg 0 불변).
    //   cmd={tick,client,move:[dx,dy]} — tick 직전에 클라 발신으로 주입(게이트웨이엔 정규 move 와 동일·시드 로그의 일부 = 결정론).
    if (opts.inject) for (const c of opts.inject) if (c.tick === i + 1 && c.move) net.send('client' + c.client, 'gateway', { type: 'move', d: { dx: c.move[0] | 0, dy: c.move[1] | 0 } });
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
  return { net, login, registry, gateway, orch, inventory, chat, bus, audit, ranking, persist, chatpersist, zones: zoneObjs, followers, allZones, zoneAddrs: topo.zoneAddrs, clients: clis, trace, seenTrace, deltaTrace, replicaTrace, totals, H: topo.H, grid: topo.grid, radius: topo.radius, deathTick: opts.deathTick != null ? opts.deathTick : null, killZone: opts.killZone || 'zone1', mode: 'inproc' };
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

// ── 랭킹(0019) 회계·트루스 헬퍼 (발신하는 둘째 소비자 — 읽기 모델 정합) ──
// 원장에서 파생한 *진실* rank — avatar→보유 아이템 수(byOwner 크기). ranking.ranks 의 수렴 대상(읽기 모델 ≡ 쓰기 모델).
function ledgerCounts(r) {
  const c = new Map();
  if (r.inventory) for (const owner of r.inventory.ledger.values()) c.set(owner, (c.get(owner) || 0) + 1);
  return c;
}
// 프로젝션 정합 — ranking.ranks 가 원장 byOwner 크기와 *정확히 일치*(누락·과잉 0). consume→publish 가 이벤트 전수를 순서대로 반영.
function rankProjectionFaithful(r) {
  if (!r.ranking) return true;
  const truth = ledgerCounts(r);
  const ranks = r.ranking.ranks;
  for (const [a, n] of truth) if ((ranks.get(a) || 0) !== n) return false;   // 진실에 있는데 rank 가 다름
  for (const [a, n] of ranks) if (n !== (truth.get(a) || 0)) return false;    // rank 에 있는데 진실과 다름(과잉)
  return true;
}
// rank 수렴(desync) — 클라 rankBelief 가 원장 진실(자기 보유 수)과 일치하는가. happy path 수렴 후 0.
//   주의: rank_update 를 한 번도 못 받은 클라(보유 0·이벤트 없음)는 belief=null·진실 0 → 일치로 간주(미발신=무변경).
function rankDesync(r) {
  if (!r.ranking) return 0;
  const truth = ledgerCounts(r);
  let d = 0;
  for (const c of r.clients) {
    if (!c.avatar) continue;
    const t = truth.get(c.avatar) || 0;
    const b = (c.rankBelief == null) ? 0 : c.rankBelief;
    if (t !== b) d++;
  }
  return d;
}
// 랭킹 다이제스트 — rank 테이블(SSOT) + 소비/발행 회계. E2E·repro 비트 동일의 대상.
function rankDigest(r) {
  if (!r.ranking) return fnv1a('no-ranking');
  const rt = [...r.ranking.ranks.entries()].map(([a, n]) => a + '=' + n).sort().join('|');
  return fnv1a(rt + ';c' + r.ranking.consumed + ';p' + r.ranking.published);
}

// ── 영속(0017) 회계·트루스 헬퍼 (인프로세스/멀티프로세스 재구성 r 둘 다 먹음) ──
// 영속 저널 다이제스트 — 효과 로그(seq 순서)의 비트열. crash+replay 가 투명하면 restart 유무에 불변(저널은 가방 죽음과 독립).
function persistDigest(r) {
  if (!r.persist) return fnv1a('no-persist');
  const j = (r.persist.journal || []).slice().sort((a, b) => a.seq - b.seq)
    .map(e => e.seq + ':' + e.kind + ':' + (e.itemId || '') + ':' + (e.owner || (e.from + '>' + e.to))).join('|');
  // 스냅샷(이 step) 포함 — 압축 베이스(upToSeq + 원장)도 비트열에. 압축 OFF 면 'nosnap'(0017 의미와 호환). E2E/repro 강화.
  const s = r.persist.snapshot;
  const snap = s ? ('S' + s.upToSeq + ':' + s.ledger.map(([i, o]) => i + '=' + o).sort().join(',')) : 'nosnap';
  return fnv1a(j + '#w' + (r.persist.writes || 0) + '#' + snap);
}
// 채팅 커맨드 로그 다이제스트(이 step) — 채팅 영속 저널(seq 순서 커맨드열)의 비트열. crash+replay 가 투명하면 restart 유무에 불변(저널은 채팅 죽음과 독립).
function chatPersistDigest(r) {
  if (!r.chatpersist) return fnv1a('no-chatpersist');
  const j = (r.chatpersist.journal || []).slice().sort((a, b) => a.seq - b.seq)
    .map(e => e.seq + ':' + e.kind + ':' + (e.avatar || e.fromAvatar || '') + ':' + (e.toAvatar || e.scope || e.region || '') + ':' + (e.mseq != null ? e.mseq : '')).join('|');
  // 라우팅 스냅샷(이 step) 포함 — 압축 베이스(upToSeq + 구독 라우팅 + deliveries 수 + 계측)도 비트열에. 압축 OFF 면 'nosnap'(0021 의미와 호환). E2E/repro 강화.
  const s = r.chatpersist.snapshot;
  const snap = s ? ('S' + s.upToSeq + ':' + (s.channels || []).map(([ch, arr]) => ch + '=' + arr.join(',')).join(';') + ':d' + s.deliveries.length + ':j' + s.joins + 's' + s.says + 'w' + s.whispers) : 'nosnap';
  return fnv1a(j + '#w' + (r.chatpersist.writes || 0) + '#' + snap);
}
// 채팅 커맨드 로그 완전성(이 step·압축-인지) — 영속된 커맨드 누적 수(writes) == 채팅이 *기록한 커맨드* 누적(join+say+whisper+leave 효과 합).
//   압축으로 journal.length 가 줄어도 writes 는 누적 진실이므로 불변(압축은 *보관*을 줄일 뿐 영속된 커맨드 수는 안 줄인다) — 0018 journalComplete 의 채팅 판.
//   압축 OFF(0021)면 writes==journal.length 라 종전 의미 호환. (whisperFail/미가입 say 는 효과 0 = 저널 0 → 합산 제외.)
function chatJournalComplete(r) {
  if (!r.chatpersist || !r.chat) return true;
  return (r.chatpersist.writes || 0) === (r.chat.joins + r.chat.says + r.chat.whispers + r.chat.leaves);
}
// 저널 완전성 — 영속된 변이 *누적* 수(writes) == 가방이 수락한 변이 수(mint+transfer). 압축으로 journal.length 가 줄어도 writes 는 누적
//   진실이므로 불변(압축은 *보관*을 줄일 뿐 *영속된 변이 수*는 안 줄인다). 0017(압축 OFF)에선 writes==journal.length 라 비트 동일.
function journalComplete(r) {
  if (!r.persist || !r.inventory) return true;
  return (r.persist.writes || 0) === (r.inventory.minted + r.inventory.transfers);
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
//   주의 ① 수신자가 이후 disconnect 하면 byAvatar 에서 pruned(op:'leave') → 사후 재검증 불가. 배달 *시점*엔 구독자였음(팬아웃이
//        channels[ch] Set 만 순회 = 비-구독자 배달 구조적 불가)이므로 *현재 부재* 수신자는 skip(이력 deliveries vs live 테이블 불일치
//        false-positive 방지). ② 위반은 *배달당 1*만 — 비-구독자면 그걸로 카운트하고(else-if), 구독 중인데 region 불일치(상태 손상)는
//        교차검증으로만 카운트(이중 집계 방지). region:X 구독은 join 이 X 멤버에게만 부여하므로 보통 redundant — 손상 탐지용.
function chatLeak(r) {
  if (!r.chat) return 0;
  let leak = 0;
  for (const d of r.chat.deliveries) {
    if (d.channel === 'whisper') continue;
    const e = r.chat.byAvatar.get(d.to);
    if (!e) continue;                                                        // disconnect 로 pruned — 배달 시점 구독자였음(skip)
    if (!e.subs.has(d.channel)) leak++;                                      // 비-구독자에게 배달(구조적 0)
    else if (d.channel.startsWith('region:') && e.region !== d.channel.slice(7)) leak++;   // 구독 ≠ region(상태 손상) 교차검증
  }
  return leak;
}
// whisper 프라이버시(카디널리티) — whisper 배달 수 == chat.whispers(팬아웃 1 = 제3자 0). *타깃 정확성*은 별도로 보장된다:
//   _deliver 가 같은 p.toAvatar 를 *조회(byAvatar)와 기록(record.to) 양쪽*에 단일 소스로 써(오라우팅 불가) + phantom(B⊆D)가
//   "타깃 아닌 클라가 그 whisper 를 믿으면" 잡는다. 이 함수는 그중 *팬아웃이 1을 넘지 않음*(브로드캐스트 누설)만 본다.
function chatWhisperPrivate(r) {
  if (!r.chat) return true;
  const wd = r.chat.deliveries.filter(d => d.channel === 'whisper').length;
  return wd === r.chat.whispers;
}
// 채널 누락 — 클라가 받은 채널이 자기 구독(또는 귓속말 타깃)에 모두 부합하는가(클라 측 누설 0 교차검증).
//   chatLeak 과 같은 disconnect 주의 — byAvatar pruned 된 클라(연결 중 정당 수신 후 떠남)는 skip(false-positive 방지).
function chatClientNoLeak(r) {
  if (!r.chat) return true;
  for (const c of r.clients) {
    if (!c.avatar) continue;
    const e = r.chat.byAvatar.get(c.avatar);
    if (!e) continue;                                 // disconnect 로 pruned — 수신은 연결 중 정당했음(skip)
    for (const k of (c.chatRecv || [])) {
      const ch = k.split('|')[0];
      if (ch === 'whisper') continue;                 // 귓속말은 구독 무관(타깃 수신 — phantom 검사가 정당성 보증)
      if (!e.subs.has(ch)) return false;              // 구독 안 한 채널 메시지 수신 = 누설
    }
  }
  return true;
}
function chatDigest(r) {
  if (!r.chat) return fnv1a('no-chat');
  const dl = (r.chat.deliveries || []).map(d => d.to + '|' + d.channel + '|' + d.from + '|' + d.seq).sort().join('#');
  return fnv1a(dl + ';j' + r.chat.joins + ';s' + r.chat.says + ';w' + r.chat.whispers + ';f' + r.chat.fanout);
}

// ── 이벤트 버스(0016) 회계·트루스 헬퍼 (인프로세스/멀티프로세스 재구성 r 둘 다 먹음) ──
// 버스 다이제스트 — 구독 라우팅 테이블(SSOT) + 발행/팬아웃 회계. E2E·repro 비트 동일의 대상.
function busDigest(r) {
  if (!r.bus) return fnv1a('no-bus');
  const tt = [...r.bus.topics.entries()].map(([t, arr]) => t + '=' + arr.join(',')).sort().join('|');
  return fnv1a(tt + ';p' + r.bus.publishes + ';d' + r.bus.deliveries + ';u' + r.bus.unrouted);
}
// 감사(새 소비자) 다이제스트 — 관찰한 ev 스트림 전문. E2E·repro 비트 동일의 대상.
function auditDigest(r) {
  if (!r.audit) return fnv1a('no-audit');
  return fnv1a(r.audit.records.join('\n') + ';n' + r.audit.records.length);
}
// gateway↔service *직접* 메시지 수 — 버스 ON 이면 0(N×N 직접 결합의 구조적 제거를 net.log 로 증명), OFF 면 >0(대조).
function directSvcMsgs(r) {
  return r.net.log.filter(m =>
    (m.from === 'gateway' && (m.to === 'inventory' || m.to === 'chat')) ||
    ((m.from === 'inventory' || m.from === 'chat') && m.to === 'gateway')).length;
}
// 발신자별 발신 스트림 다이제스트(from 고정·내용+순서) — "새 소비자 추가 = 발행자 무수정"을 발신 비트열로 증명(audit on/off 불변).
function senderDigest(r, from) {
  return fnv1a(r.net.log.filter(m => m.from === from).map(m => m.from + '>' + m.to + ':' + JSON.stringify(m.payload)).join('\n'));
}
// 토픽별 발행 수(net.log 기준) — audit.seen 과 대조(소비자가 발행 전수를 받았는가).
function topicPublishCount(r, topic) {
  return r.net.log.filter(m => m.to === 'bus' && m.payload && m.payload.type === 'pub' && m.payload.topic === topic).length;
}

const PUBLIC_ADDRS = ['login', 'gateway'];

// 라이브 testbed(run.js) 의 기능 탐지 — 시나리오 inject write-seam 지원(0016 에서 심음 — TESTBED §10-4).
const SUPPORTS = { inject: true };

// ── 모듈 노출 (dual-mode) ───────────
const __hktNet = {
  mulberry32, fnv1a, Net, LoginServer, SessionRegistry, Gateway, Orchestrator, EntityZone, InventoryService, ChatService, ServiceBus, AuditService, RankingService, PersistStore, Client,
  buildTopology, makeActor, run, runMulti, routeFilters,
  inflightSet, authorityCount, replicaDivergence, globalAoiTruth, liveZones, ownerOf,
  itemConserved, ledgerConsistent, maxItemBeliefOwners, itemDesync, invDigest,
  chatDesync, chatPhantom, chatLeak, chatWhisperPrivate, chatClientNoLeak, chatDigest,
  busDigest, auditDigest, directSvcMsgs, senderDigest, topicPublishCount,
  persistDigest, journalComplete, chatPersistDigest, chatJournalComplete,
  ledgerCounts, rankProjectionFaithful, rankDesync, rankDigest,
  PUBLIC_ADDRS, DEFAULTS, SUPPORTS,
};
if (typeof module !== 'undefined' && module.exports) module.exports = __hktNet;
if (typeof globalThis !== 'undefined') globalThis.HktNet = __hktNet;
