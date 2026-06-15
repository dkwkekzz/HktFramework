'use strict';
// step-0039 분할 preamble — 박스 1개=파일 1개 (CLAUDE.md 임계 규칙). 진입점 net-core.js 가 묶는다.
// dual-mode: Node require / 브라우저는 common.js 를 <script> 선행 로드(전역 __HktNetCommon).
const __c = (typeof module !== 'undefined' && module.exports && typeof require !== 'undefined')
  ? require('./common.js') : globalThis.__HktNetCommon;
const { Net, LoginServer, SessionRegistry, mulberry32, fnv1a, DEFAULTS } = __c;

// ── [엣지] 게이트웨이 — 0009 그대로(replicas 를 생성자 인자로 받게만 조정 — 토폴로지 빌더가 단일 경로로 배선) ──
class Gateway {
  constructor(zoneAddrs, replicas = [], inventoryAddr = null, chatAddr = null, busAddr = null, busResendReq = false) {
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
    // ── 버스 failover *요청 경로* 무손실(이 step·busResendReq) — 0036 의 §9(요청 드롭=base 대비 mint 손실) 해소. ──
    //   0036 은 *결과* 경로(svc.item.out)를 producer(가방) replay 로 무손실화했다. *요청* 경로(svc.item)는 그 거울:
    //   crash gap 에 떨군 클라 요청(pickup/give/reconcile)은 가방에 도달조차 못 해 mint 자체가 안 일어난다(원장이 base 보다 작음 = mint 손실).
    //   요청의 producer 는 *게이트웨이*다 — 발행한 요청을 inBuffer 에 보관했다 버스 복구 시 재발행(가방 resendOut 의 게이트웨이 판).
    //   재발행은 멱등 불가능한 pickup 을 이중 mint 할 수 있으므로 요청마다 producer-local reqId(단조)를 실어 가방이 dedup(seenReqs).
    this.busResendReq = busResendReq;     // ON 이면 svc.item 요청을 reqId 태깅·inBuffer 보관·버스 복구 시 재발행. OFF = 0036 비트 동일(태깅 0·보관 0·재발행 0).
    this.inBuffer = [];                   // 발행한 svc.item 요청 ev(busResendReq 일 때만) — 버스 복구 재발행 소스. 무계(유계 슬라이딩 창은 후속 — 0036 outBuffer 와 동일 한계).
    this.inSeq = 0;                       // producer-local 요청 reqId 카운터(단조·결정론 — 클라 op 순서가 시드 함수). 가방 dedup 키.
    this.inResends = 0;                   // 버스 복구 시 재발행한 요청 수(이 step·계측)
  }
  worldTargets() { return this.replicas.length ? this.zones.concat(this.replicas) : this.zones; }
  // 서비스 발신 단일 경로 — 버스 ON 이면 *토픽 발행*(소비자 주소 무지), OFF 면 0015 직접 라우팅(비트 동일).
  _svcSend(topic, directAddr, ev) {
    if (this.bus) { this.net.send(this.addr, this.bus, { type: 'pub', topic, ev }); return true; }
    if (directAddr) { this.net.send(this.addr, directAddr, ev); return true; }
    return false;
  }
  // svc.item 요청 발신(이 step·busResendReq) — _svcSend 위 얇은 래퍼. ON 이면 reqId 태깅 + inBuffer 보관(버스 복구 재발행 소스).
  //   OFF 면 ev 무변형 → _svcSend 그대로 = 0036 비트 동일(reqId 없음·보관 0). 버스 OFF(직접 모드)면 보관 안 함(재발행 무의미).
  _itemReq(ev) {
    if (this.busResendReq) ev = { ...ev, reqId: this.inSeq++ };   // 요청 dedup 키(producer-local 단조) — 가방이 재발행 중복을 멱등 폐기
    const sent = this._svcSend('svc.item', this.inventory, ev);
    if (sent && this.busResendReq && this.bus) this.inBuffer.push(ev);   // 버스 복구 시 재발행 — gap 에 떨군 요청을 다시 가방에 도달시킨다
    return sent;
  }
  // 버스 failover 요청 재발행(이 step·busResendReq) — 버스 복구(재구독) 직후 트리거(가방 resendOut 과 같은 위치).
  //   보관한 svc.item 요청을 다시 pub → gap 에 떨군 요청이 가방에 도달해 mint/xfer 발생(원장이 base 따라잡음 = mint 손실 0).
  //   gap *전* 도달한 요청도 함께 재발행되나 가방이 reqId 로 dedup(seenReqs) → 이중 mint 0(멱등). 순수 반응형 제어 평면(존 tick 밖).
  //   OFF 면 호출돼도 즉시 반환(reg 0 불변). 재구독이 라우팅을 복구한 뒤라야 fan-out(토폴로지가 reneg 다음에 트리거).
  resendIn() {
    if (!this.busResendReq || !this.bus) return;
    for (const ev of this.inBuffer) { this.net.send(this.addr, this.bus, { type: 'pub', topic: 'svc.item', ev }); this.inResends++; }
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
      if (bind && (this.bus || this.inventory)) this._itemReq({ type: 'item_req', op: 'pickup', avatar: bind.avatar });
      else this.dropped++;
    } else if (p.type === 'item_give') {
      const bind = this.byClient.get(m.from);
      if (bind && (this.bus || this.inventory)) this._itemReq({ type: 'item_req', op: 'give', fromAvatar: bind.avatar, toAvatar: p.toAvatar, itemId: p.itemId });
      else this.dropped++;
    } else if (p.type === 'item_reconcile') {
      // id-reconciliation 요청(이 step·mintRecon) — 클라가 보낸 belief 목록을 가방에 전달. 가방이 없는 id 를 re-mint.
      //   클라가 avatar 를 포함하지 않아도 됨 — 게이트웨이가 bind.avatar 로 주입(은닉 유지: 클라는 서비스 내부 주소 모름).
      //   버스 ON 이면 svc.item 토픽 발행(주소 무지 — item_pickup/give 와 같은 경로). mintRecon OFF 면 클라가 메시지 0 → 도달 0(reg 0 불변).
      const bind = this.byClient.get(m.from);
      if (bind && (this.bus || this.inventory)) this._itemReq({ type: 'item_reconcile', reqAvatar: bind.avatar, owned: p.owned });
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

const __part = { Gateway };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).gateway = __part;
