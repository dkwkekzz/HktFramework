'use strict';
// step-0046 정리 분할 — InventoryService *버스 결과/replay* 경로(_out·_onOutAck·_onSeenWatermark·resendOut).
//   원장 코어(svc-inventory-core.js)의 프로토타입을 Object.assign 으로 증강(동작 불변). 진입점이 core 뒤에 로드한다.
const __isNode = typeof module !== 'undefined' && module.exports && typeof require !== 'undefined';
const { InventoryService } = __isNode ? require('./svc-inventory-core.js') : globalThis.__HktNetParts.svc_inventory_core;
Object.assign(InventoryService.prototype, {
  // 결과 발신 단일 경로 — 버스 ON 이면 svc.item.out 토픽 발행(소비자 주소 무지), OFF 면 0015 직접 라우팅(비트 동일).
  _out(msg) {
    if (this.bus) {
      if (this.busResend) {
        if (this.busOutAck) msg.outSeq = this.outSeq++;   // 결과 단조 순번 부여(이 step) — ack 워터마크/가지치기 기준. OFF 면 미부여 = 0040 비트 동일(게이트웨이가 outSeq 무시).
        this.outBuffer.push(msg);   // 버스 failover 결과 재발행 소스 보관(0036). OFF 면 push 0 → 0035 비트 동일.
        if (this.busWindow > 0 && this.outBuffer.length > this.busWindow) this.outBuffer.shift();   // 미끄러지는 유계 창(0039) — 최근 K 개만(K=0 면 미실행 = 0038 동일)
        if (this.outBuffer.length > this.outBufPeak) this.outBufPeak = this.outBuffer.length;   // 최대 길이 계측(이 step) — 자기-크기조정 유계 증거
      }
      this.net.send(this.addr, this.bus, { type: 'pub', topic: 'svc.item.out', ev: msg });
    }
    else this.net.send(this.addr, this.gateway, msg);
  },
  // 결과 ack 수신(이 step·busOutAck) — 게이트웨이가 svc.item.out.ack 로 통보한 outSeq 까지 outBuffer 가지치기(자기-크기조정).
  //   ack 워터마크(outAcked)는 단조 — 이 outSeq 이하 결과는 게이트웨이가 클라에 중계 확인했으므로 재발행 불필요(gap 손실 후보 아님) → 앞에서부터 제거.
  //   outBuffer 는 outSeq 순서라 front 가 최소 outSeq — front.outSeq ≤ 워터마크 동안 shift(O(가지친 수)). 미-ack(in-flight) 결과만 남는다. 0040 _onItemAck 의 결과 경로 거울.
  _onOutAck(ev) {
    if (!this.busOutAck || ev == null || ev.outSeq === undefined) return;
    if (this.busMinWm && ev.consumer !== undefined) {
      // 다중 소비자 min-워터마크(이 step) — 소비자별 frontier 갱신 후 *모든 기대 소비자 워터마크의 최소(min)* 까지만 가지친다.
      //   한 소비자가 앞서가도(게이트웨이) 뒤처진 소비자(ranking)의 frontier 가 min 을 눌러 그 이하만 prune → 뒤처진 소비자가 필요로 하는 결과를 *보존*(starve 0).
      const cur = this.consumerWm.get(ev.consumer);
      if (cur === undefined || ev.outSeq > cur) this.consumerWm.set(ev.consumer, ev.outSeq);   // 소비자 frontier 단조 갱신
      // 소비자 lease 축출(이 step·busConsumerLease) — 산 소비자의 ack 가 sweep 를 구동한다(별도 tick 불요·결정론).
      //   방금 ack 한 소비자의 *침묵 기준*(consumerSeen)을 현재 생산자 frontier 로 갱신 → 그 뒤 frontier 가 leaseSpan 이상 전진하도록 재-ack 안 한 소비자(=죽음)를 evicted 에 넣어 min 정의역에서 뺀다.
      //   침묵 신호(frontier−lastSeen)는 ack 사건이 갱신하므로 생산 버스트에도 산 소비자를 오축출 안 함(content lag 와 다름). ack 이력 없는(undefined) 소비자는 미확립이라 정의역 밖. OFF·leaseSpan 0 면 휴면(evicted 안 채워짐 → 0044 비트 동일).
      if (this.busConsumerLease && this.leaseSpan > 0) {
        const frontier = this.outSeq - 1;
        this.consumerSeen.set(ev.consumer, frontier);   // 방금 ack = 산 것 → 침묵 기준 리셋
        for (const c of this.outConsumers) {
          if (c === ev.consumer || this.evicted.has(c)) continue;
          const seen = this.consumerSeen.get(c);
          if (seen !== undefined && frontier - seen > this.leaseSpan) { this.evicted.add(c); this.evictions++; }
        }
      }
      let min = Infinity;
      for (const c of this.outConsumers) { if (this.evicted.has(c)) continue; const w = this.consumerWm.get(c); min = Math.min(min, w === undefined ? -1 : w); }   // 미-ack 소비자는 -1 → min 정지·축출된 죽은 소비자는 정의역 제외(이 step). evicted 빔=0044 동일.
      if (min !== Infinity && min > this.outAcked) this.outAcked = min;   // min 은 소비자 frontier 전진으로만 오름 → outAcked 단조
    } else {
      if (ev.outSeq > this.outAcked) this.outAcked = ev.outSeq;   // 단일 워터마크(0041) — busMinWm OFF·consumer 미태깅이면 0043 비트 동일
    }
    while (this.outBuffer.length && this.outBuffer[0].outSeq <= this.outAcked) { this.outBuffer.shift(); this.outPruned++; }
  },
  // seen 워터마크 수신(이 step·busSeenBound) — 게이트웨이가 svc.item.seen 으로 통보한 inAcked(prune 프런티어) 이하 reqId 를 seenReqs 에서 제거.
  //   reqId≤upTo 는 게이트웨이 inBuffer 에서 이미 가지쳐져 *영영 재발행되지 않는다* → dedup 상태가 불필요(잊어도 dupe 0). 워터마크는 단조 — 새 upTo 가 더 클 때만 가지친다.
  //   Set 이라 순서 보장이 없으니 upTo 이하를 순회 제거(O(가지친 수)). 가방 crash 후엔 seenReqs 리셋이므로 워터마크도 무관(별개 생애).
  _onSeenWatermark(ev) {
    if (!this.busSeenBound || ev == null || ev.upTo === undefined || ev.upTo <= this.seenWatermark) return;
    this.seenWatermark = ev.upTo;
    for (const r of this.seenReqs) if (r <= this.seenWatermark) { this.seenReqs.delete(r); this.seenPruned++; }
  },
  // 버스 failover 결과 재발행(이 step·busResend) — 버스 복구(재구독) 직후 트리거. 보관한 결과를 svc.item.out 에 다시 pub.
  //   gap 에 떨군 결과(원장 적용·클라 미수신 → belief < 원장)를 재배달 → 게이트웨이가 클라에 중계 → belief 가 원장 따라잡음(itemDesync→0).
  //   클라 belief 는 Set add/delete 라 *멱등*(이미 받은 결과 재배달 무해) → consumer dedup 불요. 순수 반응형 제어 평면(존 tick 밖·신성한 tick 보존).
  //   OFF 면 호출돼도 즉시 반환(reg 0 불변). 재구독이 라우팅을 복구한 뒤라야 fan-out 됨(토폴로지가 reneg 다음에 트리거).
  resendOut() {
    if (!this.busResend || !this.bus) return;
    for (const msg of this.outBuffer) { this.net.send(this.addr, this.bus, { type: 'pub', topic: 'svc.item.out', ev: msg }); this.outResends++; }
  },
});
if (__isNode) module.exports = { InventoryService };
