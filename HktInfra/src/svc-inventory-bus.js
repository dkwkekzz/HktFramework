'use strict';
// step-0054 — lease 생애 관측(busLeaseAudit) — 축출/재admission 을 svc.item.lease 버스 이벤트로 발행(코디네이션 관측). InventoryService *버스 결과/replay* 경로(_out·_onOutAck·_onSeenWatermark·resendOut).
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
      // §3 재admission(이 step·busLeaseLife) — 축출됐던 소비자가 *다시 ack* 하면(재구독→결과 수신→ack) 살아 돌아온 것 → evicted 에서 제거해 min 정의역 복귀.
      //   복귀 후 그 소비자 frontier 가 다시 min 을 눌러 *이후* 결과를 보존(starve 재발 0). 이미 가지친 옛 결과는 그 소비자가 자기 저널 reconstruct(0020)로 복구(0045 §9·버퍼 replay 아님).
      //   outAcked 단조라 복귀가 워터마크를 되돌리진 않는다(min>outAcked 일 때만 전진) — 전진을 *멈출* 뿐. 아래 sweep 가 c===ev.consumer 를 건너뛰어 갓 복귀한 소비자를 같은 tick 즉시 재축출하지 않는다.
      //   busLeaseLife OFF 면 evicted 영구(0047 동일·재admission 0).
      if (this.busLeaseLife && this.evicted.has(ev.consumer)) { this.evicted.delete(ev.consumer); this.readmissions++; this._leaseEvent('readmit', ev.consumer, this.outSeq - 1); }
      // 소비자 lease 축출(이 step·busConsumerLease) — 산 소비자의 ack 가 sweep 를 구동한다(별도 tick 불요·결정론).
      //   방금 ack 한 소비자의 *침묵 기준*(consumerSeen)을 현재 생산자 frontier 로 갱신 → 그 뒤 frontier 가 leaseSpan 이상 전진하도록 재-ack 안 한 소비자(=죽음)를 evicted 에 넣어 min 정의역에서 뺀다.
      //   침묵 신호(frontier−lastSeen)는 ack 사건이 갱신하므로 생산 버스트에도 산 소비자를 오축출 안 함(content lag 와 다름). ack 이력 없는(undefined) 소비자는 미확립이라 정의역 밖. OFF·leaseSpan 0 면 휴면(evicted 안 채워짐 → 0044 비트 동일).
      if (this.busConsumerLease && this.leaseSpan > 0) {
        const frontier = this.outSeq - 1;
        // 적응형 cadence 추정(이 step·busLeaseAdapt) — 방금 ack 한 소비자가 *살아서 견딘* 직전 침묵(frontier−이전 seen)을 per-c 러닝 최대로 키운다.
        //   이 침묵은 c 가 ack 으로 끝낸 = *증명된 생존 cadence*. 죽은 소비자는 ack 안 하므로 자기 max 가 동결 → 아래 임계가 동결값+마진에서 멈춰 결국 축출(죽음 감지 보존).
        //   busLeaseAdapt OFF 면 consumerMaxGap 미갱신 = 0049 비트 동일.
        if (this.busLeaseAdapt) {
          const prevSeen = this.consumerSeen.get(ev.consumer);
          if (prevSeen !== undefined) {
            const gap = frontier - prevSeen;
            // 윈도 cadence(step-0052·busCadenceWindow) — 추정 = 최근 K gap 의 max(전체 max 아님). 옛 큰 gap 이 K 개 뒤로 늙으면 창에서 빠져 추정 감쇠(cadence↓ 추적). grace prior(0051)가 바닥이라 창이 작아도 임계는 prior 아래로 안 내려간다(flapping 붕괴 방지·0051 §9).
            if (this.busCadenceWindow && this.cadenceWindow > 0) {
              let gaps = this.consumerGaps.get(ev.consumer);
              if (gaps === undefined) { gaps = []; this.consumerGaps.set(ev.consumer, gaps); }
              gaps.push(gap);
              while (gaps.length > this.cadenceWindow) gaps.shift();   // 최근 K gap 만 — 옛 gap 은 창에서 늙어 빠진다(감쇠)
              let mx = 0; for (const g of gaps) if (g > mx) mx = g;     // 창의 max = 현재 cadence 추정
              this.consumerMaxGap.set(ev.consumer, mx);
            } else { const m = this.consumerMaxGap.get(ev.consumer) || 0; if (gap > m) this.consumerMaxGap.set(ev.consumer, gap); }   // 전체 러닝 max(0050/0051)
          }
        }
        this.consumerSeen.set(ev.consumer, frontier);   // 방금 ack = 산 것 → 침묵 기준 리셋
        for (const c of this.outConsumers) {
          if (c === ev.consumer || this.evicted.has(c)) continue;
          const seen = this.consumerSeen.get(c);
          if (seen === undefined) {
            // §2 지연 baseline(이 step·busLeaseLife) — *처음 본* 미-ack 소비자에 침묵 기준을 now(frontier)로 깔고 이번엔 안 축출(leaseSpan grace).
            //   → 다음 sweep 부터 frontier−seen 으로 측정 → 영영 ack 안 하면 leaseSpan 뒤 축출(0047 은 미확립이라 영영 못 축출 = §2 버그). 산 소비자는 grace 안에 ack 해 오축출 0.
            //   busLeaseLife OFF 면 0047 처럼 미확립 = 정의역 밖(축출 불가·grace 도 안 깖 → consumerSeen 무변경 = 비트 동일).
            if (this.busLeaseLife) this.consumerSeen.set(c, frontier);
            continue;
          }
          // 축출 임계 — 적응형(0050·busLeaseAdapt)이면 관측 cadence(consumerMaxGap)+leaseSpan(여유 마진), 아니면 고정 leaseSpan(0049 동일).
          //   적응형: 산 소비자는 침묵이 자기 cadence 를 마진 안에서만 넘어 오축출 0(임계가 cadence 를 따라 오름) / 죽은 소비자는 max 동결 → 침묵이 동결값+마진 초과 → 축출.
          //   시작 cadence prior(step-0051·busLeaseGrace) — 0050 §9 "bootstrap 1회 오축출" 해소. 관측 cadence 가 prior 보다 작은 *시작 구간*에만 prior 로 임계 바닥을 깔아 첫 G-침묵을 흡수(오축출 0). 첫 관측이 prior 를 넘으면 관측이 이긴다(가짜 over-protect 아님). prior 유한이라 죽은 소비자는 임계=prior+마진 초과 시 여전히 축출(죽음 감지 보존). OFF/prior 0 = 0050 비트 동일.
          let est = this.consumerMaxGap.get(c) || 0;
          if (this.busLeaseGrace && this.cadencePrior > est) est = this.cadencePrior;
          const threshold = this.busLeaseAdapt ? est + this.leaseSpan : this.leaseSpan;
          if (frontier - seen > threshold) { this.evicted.add(c); this.evictions++; this._leaseEvent('evict', c, frontier); }
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
  // seen 워터마크 수신(0042·busSeenBound) — 게이트웨이가 svc.item.seen 으로 통보한 inAcked(prune 프런티어) 이하 reqId 를 seenReqs 에서 제거.
  //   reqId≤upTo 는 게이트웨이 inBuffer 에서 이미 가지쳐져 *영영 재발행되지 않는다* → dedup 상태가 불필요(잊어도 dupe 0). 워터마크는 단조 — 새 upTo 가 더 클 때만 가지친다.
  //   ── per-producer 복합키 가지치기(이 step·busSeenNs) — 0046 §9/리뷰 §1 해소. ──
  //     0046 busProducerNs ON 이면 seenReqs 키가 *복합키*(`producer reqId`·문자열)인데, 0042 단일 네임스페이스 prune 은 `r <= upTo`(숫자 비교) → `'gw 5' <= 5` 는 false(NaN) → 복합키가 *영영* 안 가지쳐진다(busSeenBound 무력화·무계 회귀).
  //     해법: busSeenNs ON 이면 producer 별 워터마크(producerSeenWm)를 두고, 게이트웨이가 통보한 (producer,upTo)로 *그 producer 의* 복합키만(접두사 일치 + 숫자 suffix ≤ upTo) 가지친다. busSeenNs OFF 면 0046 비트 동일(숫자 prune).
  _onSeenWatermark(ev) {
    if (!this.busSeenBound || ev == null || ev.upTo === undefined) return;
    if (this.busSeenNs && ev.producer !== undefined) {
      const cur = this.producerSeenWm.get(ev.producer);
      if (cur !== undefined && ev.upTo <= cur) return;   // producer 별 워터마크 단조
      this.producerSeenWm.set(ev.producer, ev.upTo);
      const prefix = ev.producer + '\u0000';   // 복합키 구분자(svc-inventory-core 의 dedup 키와 동일)
      for (const k of this.seenReqs) if (typeof k === 'string' && k.startsWith(prefix) && parseInt(k.slice(prefix.length), 10) <= ev.upTo) { this.seenReqs.delete(k); this.seenPruned++; }   // 그 producer 의 복합키만 가지치기
      return;
    }
    if (ev.upTo <= this.seenWatermark) return;
    this.seenWatermark = ev.upTo;
    for (const r of this.seenReqs) if (r <= this.seenWatermark) { this.seenReqs.delete(r); this.seenPruned++; }
  },
  // 버스 failover 결과 재발행(이 step·busResend) — 버스 복구(재구독) 직후 트리거. 보관한 결과를 svc.item.out 에 다시 pub.
  //   gap 에 떨군 결과(원장 적용·클라 미수신 → belief < 원장)를 재배달 → 게이트웨이가 클라에 중계 → belief 가 원장 따라잡음(itemDesync→0).
  //   클라 belief 는 Set add/delete 라 *멱등*(이미 받은 결과 재배달 무해) → consumer dedup 불요. 순수 반응형 제어 평면(존 tick 밖·신성한 tick 보존).
  //   OFF 면 호출돼도 즉시 반환(reg 0 불변). 재구독이 라우팅을 복구한 뒤라야 fan-out 됨(토폴로지가 reneg 다음에 트리거).
  // lease 생애 이벤트 발행(step-0054·busLeaseAudit) — 축출/재admission 을 svc.item.lease 토픽에 pub(audit/오케스트레이터 관측). OFF·버스 OFF 면 발행 0(0053 비트 동일·순수 제어 평면·존 tick 밖).
  _leaseEvent(kind, consumer, frontier) { if (!this.busLeaseAudit || !this.bus) return; this.net.send(this.addr, this.bus, { type: 'pub', topic: 'svc.item.lease', ev: { kind, consumer, frontier } }); this.leaseEventsSent = (this.leaseEventsSent || 0) + 1; },
  resendOut() {
    if (!this.busResend || !this.bus) return;
    for (const msg of this.outBuffer) { this.net.send(this.addr, this.bus, { type: 'pub', topic: 'svc.item.out', ev: msg }); this.outResends++; }
  },
});
if (__isNode) module.exports = { InventoryService };
