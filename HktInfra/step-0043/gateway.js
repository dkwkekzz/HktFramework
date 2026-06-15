'use strict';
// step-0043 분할 preamble — 박스 1개=파일 1개 (CLAUDE.md 임계 규칙). 진입점 net-core.js 가 묶는다.
// dual-mode: Node require / 브라우저는 common.js 를 <script> 선행 로드(전역 __HktNetCommon).
const __c = (typeof module !== 'undefined' && module.exports && typeof require !== 'undefined')
  ? require('./common.js') : globalThis.__HktNetCommon;
const { Net, LoginServer, SessionRegistry, mulberry32, fnv1a, DEFAULTS } = __c;

// ── [엣지] 게이트웨이 — 0009 그대로(replicas 를 생성자 인자로 받게만 조정 — 토폴로지 빌더가 단일 경로로 배선) ──
class Gateway {
  constructor(zoneAddrs, replicas = [], inventoryAddr = null, chatAddr = null, busAddr = null, busResendReq = false, busWindow = 0, busAck = false, busOutAck = false, busSeenBound = false) {
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
    this.inBuffer = [];                   // 발행한 svc.item 요청 ev(busResendReq 일 때만) — 버스 복구 재발행 소스. busWindow>0 이면 최근 K 개로 슬라이딩(유계·이 step).
    this.inSeq = 0;                       // producer-local 요청 reqId 카운터(단조·결정론 — 클라 op 순서가 시드 함수). 가방 dedup 키.
    this.inResends = 0;                   // 버스 복구 시 재발행한 요청 수(이 step·계측)
    // ── 유계 replay 버퍼(이 step·busWindow) — 0036 outBuffer·0037 inBuffer 의 *무계 성장* 해소(0032 wfWindow 의 버스 판). ──
    //   0037 inBuffer 는 발행한 *전* 요청을 무계로 쌓는다 → 장기 가동 시 메모리 무한 성장(런타임 위험). failover 가 메우려는 건 *gap 구간*(crash→재구독)에
    //   떨군 요청뿐이므로, 버퍼는 그 창을 덮을 만큼만 있으면 된다. busWindow=K 면 *최근 K 개*만 보관(미끄러지는 유계 창) → per-producer 메모리 O(K) 상한.
    //   gap 요청은 재구독 시점에 *가장 최근* 항목들이라, K≥|gap 요청| 이면 전부 버퍼에 남아 재발행됨 = 무손실 유지. K<gap 이면 가장 오래된 gap 요청이 evict → 손실 재현(K 가 load-bearing).
    //   K=0 = 무계(0038 비트 동일). busResendReq OFF 면 inBuffer 미사용 → busWindow 무관(reg 0 불변).
    this.busWindow = busWindow;           // inBuffer 유계 창 크기 K(0039). 0 = 무계. >0 = 최근 K 개만(슬라이딩·고정 K).
    // ── 요청 버퍼 *자기-크기조정*(이 step·busAck) — 0039 고정 K 의 §9(K 수동 튜닝·gap 초과 시 손실) 해소. ──
    //   고정 K 는 *최대 예상 gap(다운타임×발신율)* 을 사전 추정해야 한다 — 작게 잡으면 손실, 크게 잡으면 메모리 낭비. ack-가지치기는 이를 *자동화*:
    //   소비자(가방)가 처리한 reqId 를 svc.item.ack 로 통보 → 게이트웨이가 *ack 된 요청을 inBuffer 에서 가지치기*. 버퍼엔 *미-ack(in-flight)* 요청만 남는다.
    //   정상 구간엔 ack 가 흘러 버퍼 ≈ 왕복 지연(작게 유지)·gap 구간엔 ack 도 끊겨 버퍼가 gap 만큼 *자동 성장* → 복구 replay 가 정확히 그만큼 덮어 무손실(K 추정 불필요).
    //   busAck OFF 면 ack 발행/가지치기 0 = 0039 비트 동일. busResendReq 전제(inBuffer·reqId 필요) — busWindow 와 상호배타적으로 씀(둘 다 inBuffer 바운드).
    this.busAck = busAck;                 // ON 이면 svc.item.ack 수신 시 inBuffer 가지치기(자기-크기조정). OFF = 0039 비트 동일(ack 미구독·가지치기 0).
    this.inAcked = -1;                    // ack 워터마크 — 이 reqId 이하 전부 가방이 처리 확인(단조). inBuffer 가지치기 기준.
    this.inBufPeak = 0;                   // inBuffer 최대 길이(계측) — 자기-크기조정의 유계 증거(ack 면 ≈in-flight·고정/무계면 K/무한).
    this.inPruned = 0;                    // ack 로 가지친 요청 누적(0040·계측)
    // ── 결과 ack(이 step·busOutAck) — 가방 outBuffer 자기-크기조정의 소비자 측(0040 요청 ack 의 거울). ──
    //   svc.item.out 으로 받은 결과를 클라에 *중계할 때마다* 그 outSeq 를 svc.item.out.ack 로 통보(중계 확인) → 가방이 ack 워터마크 이하 outBuffer 를 가지친다.
    //   결과는 클라 belief Set 갱신이라 *멱등*(재배달 무해) → consumer dedup 불요(0036 발견) — ack 는 *버퍼 가지치기*만 위한 신호다. OFF 면 발행 0 = 0040 비트 동일.
    this.busOutAck = busOutAck;           // ON 이면 svc.item.out 중계마다 svc.item.out.ack{outSeq} 발행. OFF = 0040 비트 동일(ack 발행 0).
    this.outAcksSent = 0;                 // 발행한 결과 ack 누적(0041·계측)
    // ── seenReqs 유계화(이 step·busSeenBound) — 가방 dedup 집합(seenReqs·0037)의 *무계 성장* 해소(0040/0041 §9). ──
    //   가방 seenReqs 는 처리한 *전* reqId 를 무계로 쌓는다(재발행 이중 mint 방어) → 장기 가동 시 무한 성장. 그러나 게이트웨이가 재발행하는 건 inBuffer(미-ack=reqId>inAcked)뿐이라
    //   reqId≤inAcked 는 영영 재출현하지 않는다 → 가방은 그 이하 dedup 상태를 잊어도 안전. inAcked 가 전진할 때 그 prune 프런티어를 svc.item.seen 으로 통보(busAck 의 역방향 워터마크).
    this.busSeenBound = busSeenBound;     // ON 이면 inAcked 전진 시 svc.item.seen{upTo} 발행. OFF = 0041 비트 동일(발행 0). busAck+busResendReq 전제.
    this.seenWmSent = 0;                  // 발행한 seen 워터마크 누적(이 step·계측)
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
    if (sent && this.busResendReq && this.bus) {
      this.inBuffer.push(ev);   // 버스 복구 시 재발행 — gap 에 떨군 요청을 다시 가방에 도달시킨다
      if (this.busWindow > 0 && this.inBuffer.length > this.busWindow) this.inBuffer.shift();   // 미끄러지는 유계 창(0039) — 최근 K 개만 보관(K=0 면 미실행)
      if (this.inBuffer.length > this.inBufPeak) this.inBufPeak = this.inBuffer.length;   // 최대 길이 계측(이 step) — 자기-크기조정 유계 증거
    }
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
  // 요청 ack 수신(이 step·busAck) — 가방이 svc.item.ack 로 통보한 reqId 까지 inBuffer 가지치기(자기-크기조정).
  //   ack 워터마크(inAcked)는 단조 — 이 reqId 이하 요청은 가방이 처리 확인했으므로 재발행 불필요(gap 손실 후보 아님) → 앞에서부터 제거.
  //   inBuffer 는 inSeq(=reqId) 순서라 front 가 최소 reqId — front.reqId ≤ 워터마크 동안 shift(O(가지친 수)). 미-ack(in-flight) 요청만 남는다.
  //   ack 도 gap 에 끊기므로 다운타임 동안엔 가지치기 멈춰 버퍼가 자동 성장 → 복구 replay 가 정확히 그만큼 덮음(K 추정 불필요). OFF 면 미발동(reg 0 불변).
  _onItemAck(ev) {
    if (!this.busAck || ev == null || ev.reqId === undefined) return;
    const before = this.inAcked;
    if (ev.reqId > this.inAcked) this.inAcked = ev.reqId;
    while (this.inBuffer.length && this.inBuffer[0].reqId <= this.inAcked) { this.inBuffer.shift(); this.inPruned++; }
    // seenReqs 유계화(이 step·busSeenBound) — inAcked 가 전진하면 그 prune 프런티어를 가방에 통보(역방향 워터마크).
    //   가방이 inBuffer 에서 reqId≤inAcked 를 가지쳤으므로 *그 이하는 다시 재발행되지 않는다* → 가방이 seenReqs dedup 집합에서 안전히 잊을 수 있다.
    //   reqId 단조 + 게이트웨이가 각 reqId 를 1회만 발신(재발행만 중복·재발행 범위는 >inAcked) → ≤inAcked 는 영영 재출현 0 → dedup 정확성 보존(dupe 0). OFF 면 발행 0 = 0041 비트 동일.
    if (this.busSeenBound && this.bus && this.inAcked > before) { this.net.send(this.addr, this.bus, { type: 'pub', topic: 'svc.item.seen', ev: { upTo: this.inAcked } }); this.seenWmSent++; }
  }
  // 결과 ack 발행(이 step·busOutAck) — svc.item.out 결과를 중계할 때마다 그 outSeq 를 가방에 통보(0040 요청 ack 발행의 거울).
  //   가방이 이 ack 로 outBuffer 를 가지쳐 자기-크기조정. outSeq 없으면(busOutAck OFF·가방 미태깅) 발행 0 = 0040 비트 동일.
  _ackOut(ev) {
    if (!this.busOutAck || !this.bus || ev == null || ev.outSeq === undefined) return;
    this.net.send(this.addr, this.bus, { type: 'pub', topic: 'svc.item.out.ack', ev: { outSeq: ev.outSeq } });
    this.outAcksSent++;
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
        if (p.topic === 'svc.item.out') { this._relayItemResult(p.ev); this._relayItemRecon(p.ev); this._ackOut(p.ev); }   // item_result + item_recon_map 중계 + 결과 ack(이 step·busOutAck)
        else if (p.topic === 'svc.item.ack') this._onItemAck(p.ev);   // 요청 ack(0040·busAck) — inBuffer 자기-크기조정 가지치기

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
