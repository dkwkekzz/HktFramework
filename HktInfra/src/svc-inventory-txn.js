'use strict';
// step-0053 — 정리 분할: 원장 *트랜잭션 핸들러*(onMsg) — svc-inventory-core.js 가 30KB 를 넘어(31.9KB) 박스를 부품으로 재분할(기능 0·바이트 동일·reg 0).
//   원장 코어(svc-inventory-core.js)의 프로토타입을 Object.assign 으로 증강(persist·bus 와 동일 패턴·동작 불변). 진입점 svc-inventory.js 가 core 뒤에 로드한다.
const __isNode = typeof module !== 'undefined' && module.exports && typeof require !== 'undefined';
const { InventoryService } = __isNode ? require('./svc-inventory-core.js') : globalThis.__HktNetParts.svc_inventory_core;
Object.assign(InventoryService.prototype, {
  onMsg(m) {
    let p = m.payload;
    if (p.type === 'journal_nak') { if (this.reliable) this._resend(p.missing || []); return; }   // 저널 홉 NAK(0023) — persist 가 감지한 갭 재전송(reactive·신성한 tick 밖)
    if (p.type === 'journal_ack') { if (this.quorumW > 0) this._recordAck(p.seq, m.from); return; }   // 쓰기 정족수 ack(0029) — 스토어 저장 확인 집계 → durableSeq 워터마크. quorumW 0 면 ack 자체가 안 옴(0028 비트 동일)
    if (p.type === 'ev' && p.topic === 'svc.item.out.ack') { this._onOutAck(p.ev); return; }   // 결과 ack(0041·busOutAck) — 게이트웨이→가방 자기-크기조정 경로. busOutAck OFF 면 미구독 = 0040 비트 동일.
    if (p.type === 'ev' && p.topic === 'svc.item.seen') { this._onSeenWatermark(p.ev); return; }   // seen 워터마크(이 step·busSeenBound) — 게이트웨이 prune 프런티어 → seenReqs 가지치기. OFF 면 미구독 = 0041 비트 동일.
    if (p.type === 'ev' && p.topic === 'svc.item') p = p.ev;   // 버스 봉투 해체(구독 수신) — 직접 모드와 같은 item_req/item_reconcile
    // 요청 ack 발행(이 step·busAck) — reqId 실린 svc.item 을 받을 때마다 *처리 확인* 통보(dedup 폐기분 포함 — 위 주석 참조).
    //   게이트웨이가 이 ack 로 inBuffer 를 가지쳐 자기-크기조정. OFF(또는 reqId 없음·버스 OFF)면 발행 0 = 0039 비트 동일.
    if (this.busAck && this.bus && p && p.reqId !== undefined) { this.net.send(this.addr, this.bus, { type: 'pub', topic: 'svc.item.ack', ev: { reqId: p.reqId } }); this.acksSent++; }
    // 요청 dedup(이 step·busResendReq) — 게이트웨이 재발행이 gap 전 도달분도 다시 보내므로 reqId 로 *최초 1회만* 처리(pickup 이중 mint 0).
    //   reqId 없으면(busResendReq OFF·재발행 미사용) 분기 휴면 = 0036 비트 동일. 멱등(Set dedup) — 재발행 무해.
    if (this.busResendReq && p.reqId !== undefined) {
      // dedup 키 — busProducerNs ON·producer 태깅이면 (producer,reqId) 복합키로 producer 네임스페이스 분리(이 step). OFF/미태깅이면 bare reqId = 0045 비트 동일.
      const key = (this.busProducerNs && p.producer !== undefined) ? p.producer + '\u0000' + p.reqId : p.reqId;
      if (this.seenReqs.has(key)) return;   // 이미 처리(재발행 중복·또는 같은 (producer,reqId)) — 폐기
      this.seenReqs.add(key);
      if (this.seenReqs.size > this.seenReqsPeak) this.seenReqsPeak = this.seenReqs.size;   // 최대 크기 계측 — 유계화 증거
    }
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
});
if (__isNode) module.exports = { InventoryService };
