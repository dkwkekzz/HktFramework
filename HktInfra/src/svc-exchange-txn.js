'use strict';
// step-0134 — saga 포기 give 재admission(exchReadmit): 포기(abandonedGive)된 give 를 pendingGive 로 되돌려 retry 재개(retryCount 리셋). exchReadmit op 부재면 0133 비트 동일.
// step-0131 — saga 재시도 상한(sagaMaxRetries): exchRetry(0126)·exchSweep autoRetry(0129) 의 재전송 루프를 _resendPending() 공용 헬퍼로 추출하고 gid 당 N회 상한을 둔다. 상한 0(기본)이면 무제한 = 0130 비트 동일.
// step-0124 정리 분할 — 거래소 *트랜잭션 핸들러*(onMsg): svc-exchange.js 가 32KB 를 넘어(비대화 트리거) 박스를 부품으로 재분할(기능 0·바이트 동일·reg 0).
//   원장 코어(svc-exchange-core.js)의 프로토타입을 Object.assign 으로 증강(가방 core/txn 와 동일 패턴·동작 불변). 진입점 svc-exchange.js 가 core 뒤에 로드한다.
//   onMsg 의 분기: item_result(0121 saga 회신·0122 보상)·exchList(0107 인출)·exchSweep(0114 만료)·exchBuy(0107/0118 입금)·exchCancel(0107/0119 반환). 발행 4종(sold/cancelled/expired/aborted).
const __isNode = typeof module !== 'undefined' && module.exports && typeof require !== 'undefined';
const { ExchangeService } = __isNode ? require('./svc-exchange-core.js') : globalThis.__HktNetParts.svc_exchange_core;
Object.assign(ExchangeService.prototype, {
  onMsg(m) {
    const p = m.payload;
    // 가방 give 결과 비동기 수신(step-0121·saga 피드백) — _custody 가 replyTo 로 보낸 give 의 item_result 회신.
    //   집계(ackedGives·giveOks·giveFails) + 보상(step-0122). saga OFF 면 이 메시지가 영영 안 옴(0120 비트 동일).
    if (p.type === 'item_result' && p.op === 'give') {
      this.ackedGives++;
      if (p.gid !== undefined) {
        this.pending.delete(p.gid); this.pendingGive.delete(p.gid); this.retryCount.delete(p.gid);   // 미해결 추적(step-0125·0126) — 회신 도착한 give 를 pending/pendingGive 에서 제거(정상 흐름 0 으로 drain). retryCount(0131)도 정리(상한 0 면 빈 맵·no-op).
        // saga dedup 유계화(step-0127·sagaDedupBound) — 결과 최종 수신 → 더는 그 gid 재전송 안 함 → 가방이 dedup 항목 잊어도 안전. saga_done 으로 통보(0042 워터마크의 saga 판). OFF·inv 부재면 발신 0(0126 비트 동일).
        if (this.sagaDedupBound && this.inv) { this.net.send(this.addr, this.inv, { type: 'saga_done', gid: p.gid }); this.sagaDones++; }
      }
      if (p.ok) { this.giveOks++; return; }
      this.giveFails++;
      // 보상(step-0122·exchCompensate) — list 인출 give 실패면 그 listing 을 abort: 판매자가 itemId 를 안 가져 escrow 에 안 들어왔으므로 낙관적 open 을 롤백(phantom 매물 0).
      //   listed-- 와 listings.delete 가 함께 빠져 보존식 불변. 저널 'abort' 로 reconstruct 정합. compensate OFF 면 open 유지(0121 비트 동일).
      if (this.compensate && p.cause && p.cause.kind === 'list' && this.listings.has(p.cause.id)) {
        const l = this.listings.get(p.cause.id);   // 발행용으로 delete 전 캡처(0123)
        this.listings.delete(p.cause.id); this.listed--; this.aborted++;
        // 보상 발행(step-0123·abortPublish) — 회수된 무효 매물을 svc.exchange.aborted 로 1회 발행. OFF·bus 부재면 no-op(0122 비트 동일).
        if (this.abortPublish && this.bus) { this.net.send(this.addr, this.bus, { type: 'pub', topic: 'svc.exchange.aborted', ev: { id: p.cause.id, seller: l.seller, item: l.item, price: l.price } }); this.abortPublished++; }
        this._journal({ kind: 'abort', id: p.cause.id });
      }
      return;
    }
    // 미해결 give 재전송(step-0126·exchRetry) — 회신 손실로 pending 에 남은 give 를 같은 gid 로 재발신(재실행 아닌 *재회신* 유도·가방 dedup 전제).
    //   재전송이라 gives/pending 무증가(이미 추적 중)·retries++. pendingGive 비었으면(saga OFF·전부 acked) no-op = 0125 비트 동일.
    if (p.type === 'exchRetry') { this._resendPending(); return; }   // step-0131: 재전송 루프를 _resendPending() 로 추출(상한 0 면 무제한 = 0126 동일).
    // 포기 give 재admission(step-0134·exchReadmit) — 운영이 손실 해소 후 포기(abandonedGive)된 give 를 pendingGive 로 되돌려 retry 재개. retryCount 리셋(상한 재충전). 이후 sweep/Retry 가 재전송. abandonedGive 비었으면 no-op = 0133 비트 동일.
    if (p.type === 'exchReadmit') {
      for (const [gid, g] of this.abandonedGive) {
        this.pendingGive.set(gid, g); this.retryCount.delete(gid); this.readmitted++;
        // 재admission 발행(step-0135·readmitPublish) — 재개한 give 를 svc.exchange.saga_readmitted 로 1회 발행(0132 포기 발행의 짝). OFF·bus 부재면 no-op(0134 비트 동일).
        if (this.readmitPublish && this.bus) { this.net.send(this.addr, this.bus, { type: 'pub', topic: 'svc.exchange.saga_readmitted', ev: { gid, itemId: g.itemId, cause: g.cause } }); this.readmitPublished++; }
      }
      this.abandonedGive = new Map();
      return;
    }
    // 매물 등록(list·acquire) — 판매자가 아이템을 거래소 escrow 로 맡긴다. 이후 거래소 권위 아래(판매자 이중 판매 불가). open++.
    if (p.type === 'exchList') {
      const id = ++this.nextId;
      this.listings.set(id, { seller: p.seller, item: p.item, price: p.price | 0, at: m.tick | 0, itemId: p.itemId });   // itemId(0117·가방 원장의 escrow 대상)
      this.listed++;
      this._custody(p.itemId, p.seller, 'escrow', { kind: 'list', id });   // 인출 레그(0117) — 판매자 가방 → escrow custody(invMode ON 일 때만)·cause=list(0121 saga)
      this._journal({ kind: 'list', id, seller: p.seller, item: p.item, price: p.price | 0, at: m.tick | 0, itemId: p.itemId });
      return;
    }
    // 매물 만료 sweep(step-0114·exchExpiry) — now−listedAt ≥ ttl 인 open 매물을 자동 만료(escrow→판매자 반환). 취소와 같은 release 쌍이되 *시간 트리거*. ttl 0 면 no-op(0113 동일). 결정론: 삽입 순(Map) 순회.
    if (p.type === 'exchSweep') {
      // 자동 재전송(step-0129·autoRetry) — sweep 이 미해결 give 재전송도 트리거(주기적 타임아웃 재전송·exchRetry 0126 의 주기 형태). 가방 dedup(0126) 이 재실행 0 보장. OFF 면 블록 skip = 0128 비트 동일(TTL 만 sweep).
      if (this.autoRetry) this._resendPending();   // step-0131: 같은 _resendPending() 재사용(상한 0 면 무제한 = 0129 동일).
      if (this.ttl <= 0) return;
      const now = p.now | 0;
      for (const [id, l] of [...this.listings]) {
        if (now - (l.at | 0) >= this.ttl) {
          this.listings.delete(id); this.expired++;
          this._bump(this.returned, l.seller);          // 판매자가 만료 아이템 반환 acquire(취소와 동형)
          this._custody(l.itemId, 'escrow', l.seller, { kind: 'expire', id });  // 반환 레그(0119) — escrow custody → 판매자 가방(만료·invMode ON 일 때만)·cause=expire(0121 saga)
          // 만료 발행(step-0115·expirePublish) — 회수된 매물을 svc.exchange.expired 로 1회 발행. OFF·bus 부재면 no-op(0114 비트 동일).
          if (this.expirePublish && this.bus) { this.net.send(this.addr, this.bus, { type: 'pub', topic: 'svc.exchange.expired', ev: { id, seller: l.seller, item: l.item, price: l.price } }); this.expirePublished++; }
          this._journal({ kind: 'expire', id, seller: l.seller });
        }
      }
      return;
    }
    // 체결(buy·release 쌍) — escrow 아이템을 구매자에게 넘기고 대가를 판매자에게. 매물은 닫힌다(delete). 없는/닫힌 매물이면 거부(이중 판매 0).
    if (p.type === 'exchBuy') {
      const l = this.listings.get(p.id);
      if (!l) { this.rejects++; return; }
      this.listings.delete(p.id); this.sold++;
      this._bump(this.delivered, p.buyer);          // 구매자가 아이템 acquire
      this._bump(this.proceeds, l.seller, l.price); // 판매자가 대가 acquire
      this._custody(l.itemId, 'escrow', p.buyer, { kind: 'buy', id: p.id });   // 입금 레그(0118) — escrow custody → 구매자 가방(invMode ON 일 때만·인출 0117 의 짝)·cause=buy(0121 saga)
      // 체결 발행(step-0108·exchangePublish) — 성립한 거래를 svc.exchange.sold 로 1회 발행. OFF·bus 부재면 no-op(0107 비트 동일).
      if (this.publish && this.bus) { this.net.send(this.addr, this.bus, { type: 'pub', topic: 'svc.exchange.sold', ev: { id: p.id, buyer: p.buyer, seller: l.seller, item: l.item, price: l.price } }); this.published++; }   // step-0112: item 추가(시세 피드 키)
      this._journal({ kind: 'buy', id: p.id, buyer: p.buyer, seller: l.seller, price: l.price });
      return;
    }
    // 취소(cancel·release) — 판매자가 자기 매물을 거둬 escrow 아이템을 돌려받는다. 소유자 불일치/없는 매물이면 거부.
    if (p.type === 'exchCancel') {
      const l = this.listings.get(p.id);
      if (!l || l.seller !== p.seller) { this.rejects++; return; }
      this.listings.delete(p.id); this.cancelled++;
      this._bump(this.returned, p.seller);          // 판매자가 아이템 반환 acquire
      this._custody(l.itemId, 'escrow', p.seller, { kind: 'cancel', id: p.id });  // 반환 레그(0119) — escrow custody → 판매자 가방(취소·invMode ON 일 때만)·cause=cancel(0121 saga)
      // 취소 발행(step-0111·cancelPublish) — 회수된 매물을 svc.exchange.cancelled 로 1회 발행. OFF·bus 부재면 no-op(0110 비트 동일).
      if (this.cancelPublish && this.bus) { this.net.send(this.addr, this.bus, { type: 'pub', topic: 'svc.exchange.cancelled', ev: { id: p.id, seller: p.seller, item: l.item, price: l.price } }); this.cancelPublished++; }
      this._journal({ kind: 'cancel', id: p.id, seller: p.seller });
      return;
    }
  }
});
if (__isNode) module.exports = { ExchangeService };
