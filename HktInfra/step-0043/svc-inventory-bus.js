'use strict';
// step-0043 정리 분할 — InventoryService *버스 결과/replay* 경로(_out·_onOutAck·_onSeenWatermark·resendOut).
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
    if (ev.outSeq > this.outAcked) this.outAcked = ev.outSeq;
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
