'use strict';
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
      if (p.gid !== undefined) this.pending.delete(p.gid);   // 미해결 추적(step-0125) — 회신 도착한 give 를 pending 에서 제거(정상 흐름 0 으로 drain).
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
