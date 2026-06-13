'use strict';
// step-0035 분할 preamble — 박스 1개=파일 1개 (CLAUDE.md 임계 규칙). 진입점 net-core.js 가 묶는다.
// dual-mode: Node require / 브라우저는 common.js 를 <script> 선행 로드(전역 __HktNetCommon).
const __c = (typeof module !== 'undefined' && module.exports && typeof require !== 'undefined')
  ? require('./common.js') : globalThis.__HktNetCommon;
const { Net, LoginServer, SessionRegistry, mulberry32, fnv1a, DEFAULTS } = __c;

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

const __part = { Client };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).client = __part;
