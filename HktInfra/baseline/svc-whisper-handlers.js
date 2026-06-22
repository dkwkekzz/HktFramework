'use strict';
// step-0094 정리 분할 — WhisperRouter 의 *메시지 핸들러*(onMsg·onTick) — svc-whisper-core.js 가 30KB 를 넘어 박스를 부품으로 재분할(기능 0·바이트 동일·reg 0).
//   라우터 코어(svc-whisper-core.js)의 프로토타입을 Object.assign 으로 증강(svc-inventory-txn 분할 패턴 동일·동작 불변). 진입점 svc-whisper.js 가 core 뒤에 로드한다.
const __isNode = typeof module !== 'undefined' && module.exports && typeof require !== 'undefined';
const { WhisperRouter } = __isNode ? require('./svc-whisper-core.js') : globalThis.__HktNetParts.svc_whisper_core;
Object.assign(WhisperRouter.prototype, {
  onMsg(m) {
    const p = m.payload;
    // active 재타깃(step-0072·whisperFailover) — 승격된 프레즌스 박스가 svc.presence.active 로 공지한 새 active 주소로 queryAddr 갱신. 이후 귓속말 질의가 승격된 박스로 간다(라우팅 읽기 경로 failover·0070 presmon 재타깃의 라우터 판). 미구독이면 미발화(0071 비트 동일).
    if (p.type === 'ev' && p.topic === 'svc.presence.active' && p.ev) {
      // active 공지 epoch 펜싱(step-0106·announceEpoch) — 공지에 epoch 가 실리면(0105 presence) 본 최고 이하는 메아리로 거부(staleAnnounces++·역-재타깃·재시도 폭주 방지), 더 높은 epoch 만 재타깃. epoch 없으면(0072) 무조건 재타깃(비트 동일). 0105 presmon 펜싱의 라우터 판.
      if (p.ev.epoch != null) { if (p.ev.epoch <= this.activeEpoch) { this.staleAnnounces++; return; } this.activeEpoch = p.ev.epoch; }
      this.queryAddr = p.ev.addr; this.retargets++;
      // 재타깃 윈도 질의 재시도(step-0074·whisperRetry) — 재타깃 전 보낸 질의가 죽은 primary 로 가 손실됐을 수 있다(0072 §9). 아직 응답 못 받은 보류 질의를 새 active 주소로 재발신 → 윈도 손실분도 승격 박스로 다시 감. 공지(재타깃)가 재시도를 구동(onTick 0·순수 반응). retry OFF 면 재발신 0(0073 비트 동일·보류 방치).
      if (this.retry && this.queryAddr) for (const to of this.pending.keys()) { this.net.send(this.addr, this.queryAddr, { type: 'presenceQuery', consumer: to }); this.queriesSent++; this.retries++; }
      return;
    }
    // 전달 영수증 수신(step-0076·whisperAck) — Mailbox 가 회신한 영수증으로 inflight[seq] 보류 해제·delivered++(전달 확인). 미보류 seq(중복/허위)면 delivered 무변경(idempotent). receipt OFF 면 ackTo 미부착이라 이 메시지 자체가 안 옴.
    if (p.type === 'whisperAck') {
      this.acksRecv++;
      if (this.inflight.has(p.seq)) {
        const e = this.inflight.get(p.seq); this.inflight.delete(p.seq); this.delivered++;
        this._partyAck(e.party);   // 파티 ack 집계(step-0088) — 이 전달이 파티 멤버였으면 그 파티 delivered++(실수신 확인). 비-파티면 no-op.
        // 파티 complete 발행(step-0095·partyCompletePublish) — 이 ack 로 파티가 전원 acked(성공 종결)에 *처음* 이르면 svc.party.complete 발행(관측·종결 1회). OFF·bus 부재·비-파티면 no-op(0094 비트 동일). 0093 incomplete 와 짝·0087 deliveredPublish 의 파티 판.
        if (this.partyCompletePublish && this.bus && e.party != null && this.partyAcked(e.party) && !this._completePub.has(e.party)) {
          this._completePub.add(e.party); const r = this.partyReceipts.get(e.party);
          this.net.send(this.addr, this.bus, { type: 'pub', topic: 'svc.party.complete', ev: { partyId: e.party, members: r.members, routed: r.routed, delivered: r.delivered } });
          this.partyCompletePublished++;
        }
        // 전달 성공 발행(step-0087·deliveredPublish) — 확인된 전달을 svc.whisper.delivered{to, seq, tries} 로 발행(관측). tries=확인까지 재발신 횟수(전달 비용). 0082 failed(포기)와 짝 = 전달 수명주기 전체. OFF·bus 부재면 발행 0(0086 동일).
        if (this.deliveredPublish && this.bus) { this.net.send(this.addr, this.bus, { type: 'pub', topic: 'svc.whisper.delivered', ev: { to: e.to, seq: p.seq, tries: e.tries } }); this.deliveredPublished++; }
      }
      return;
    }
    // 클라→라우터 귓속말 요청(1:1) — 대상 상태를 모르므로 프레즌스 SSOT 에 질의(pull). 응답 올 때까지 보류(consumer 키). queryAddr 없으면 질의 0(전부 영구 보류 = 라우팅 불가의 대조).
    if (p.type === 'whisper') { this._queryFor(p.to, m.from, p.body); return; }
    // 파티 요청(step-0073·1:N 팬아웃·멤버 인라인) — 멤버마다 _queryFor(질의 N개 전개). 응답이 오는 대로 멤버별 라우팅(아래 presenceReply 핸들러 공통) — 한 요청에서 부분 전달이 자연 발생. 파티 미주입이면 이 분기 휴면(0072 비트 동일).
    if (p.type === 'party') { this.parties++; this._partyOpen(p.partyId, (p.members || []).length); for (const to of (p.members || [])) this._queryFor(to, m.from, p.body, p.partyId); return; }
    // 파티 전송(step-0075·멤버십 SSOT 조회) — 멤버 목록을 *인라인으로 받지 않고* PartyService(membershipAddr)에 질의(partyQuery). 응답(partyMembers) 올 때까지 보류(partyId 키). membershipAddr 없으면 미해소(멤버십 SSOT 부재의 대조).
    if (p.type === 'partyTo') { this.partyPending.set(p.partyId, { from: m.from, body: p.body }); if (this.membershipAddr) { this.net.send(this.addr, this.membershipAddr, { type: 'partyQuery', partyId: p.partyId }); this.membershipQueries++; } return; }
    // 멤버십 응답(step-0075·partyMembers) — PartyService 가 회신한 멤버 목록으로 보류 파티 전송을 *전개*: 멤버마다 _queryFor(프레즌스 질의→라우팅·0073 와 동일 경로). 멤버십 SSOT→프레즌스 SSOT→라우팅 2단 조회 완성.
    if (p.type === 'partyMembers') { this.parties++; this.membersResolved += (p.members || []).length; const req = this.partyPending.get(p.partyId) || { from: m.from }; this.partyPending.delete(p.partyId); this._partyOpen(p.partyId, (p.members || []).length); for (const to of (p.members || [])) this._queryFor(to, req.from, req.body, p.partyId); return; }
    // 프레즌스 SSOT 응답(0069 presenceReply) — 대상 상태로 보류 귓속말을 라우팅. up=전달(whisperDeliver→대상 주소·best-effort), 아니면 반송. 라우팅 결정이 *프레즌스 질의로 구동*된다(이 step 의 핵심).
    if (p.type === 'presenceReply') {
      this.repliesRecv++;
      const arr = this.pending.get(p.consumer) || []; this.pending.delete(p.consumer);
      const deliverable = p.state === 'up';
      for (const w of arr) {
        if (deliverable) {
          const msg = { type: 'whisperDeliver', from: w.from, body: w.body };
          // 전달 영수증(step-0076·whisperReceipt) — seq/ackTo 부착·inflight 보류. Mailbox 가 whisperAck 회신하면 delivered++(확인). OFF 면 best-effort(영수증 없이 routed 만·0075 비트 동일).
          if (this.receipt) { const seq = ++this.deliverySeq; msg.seq = seq; msg.ackTo = this.addr; this.inflight.set(seq, { to: p.consumer, from: w.from, body: w.body, at: this.net ? this.net.tick : 0, tries: 0, party: w.party }); }   // party(0088): 영수증을 파티에 귀속
          if (this.epochKeyed) msg.epoch = this.epoch;   // producer epoch(step-0089) — 재시작 안전 dedup 키. OFF 면 미부착(0088 비트 동일).
          this.net.send(this.addr, p.consumer, msg); this.routed++;
        }
        else {
          this.bounced++;
          // 귓속말 반송 발행(step-0097·bouncePublish) — 대상 down/permanent 로 *도달 불가*한 반송을 svc.whisper.bounced{to, from, state} 로 발행(관측). 0082 failed(유계 재시도 소진 후 포기)와 달리 *즉시 도달 불가* — 전달 수명주기의 셋째 결말(routed→delivered / undeliverable / bounced). OFF·bus 부재면 발행 0(0096 비트 동일).
          if (this.bouncePublish && this.bus) { this.net.send(this.addr, this.bus, { type: 'pub', topic: 'svc.whisper.bounced', ev: { to: p.consumer, from: w.from, state: p.state } }); this.bouncePublished++; }
        }
        this._partyTally(w.party, deliverable);   // 파티 영수증 집계(step-0083) — 멤버 판정을 그 파티 원장에 더한다(파티 전송 아니면 no-op). routed+bounced==members 면 파티 완료.
      }
      this.decisions.set(p.consumer, deliverable ? 'routed' : 'bounced');
      return;
    }
  },
  // 전달 손실 재시도(step-0077·whisperDeliverRetry) — deliverTimeout 경과해도 whisperAck 못 받은 inflight 전달을 같은 seq 로 재발신(at-least-once). whisperAck 오면 onMsg 가 inflight 에서 지운다(루프 종료). OFF 면 미실행 = 0076 비트 동일(inflight 방치). 존 tick 무관 — 라우터 제어 평면의 벽시계 timeout.
  onTick(tick) {
    if (!this.deliverRetry || !this.inflight.size) return;
    for (const [seq, e] of this.inflight) {
      if (tick - e.at >= this.deliverTimeout) {
        // 재시도 상한(step-0078·deliverMaxRetries) — 이미 max 회 재발신했는데도 ack 가 없으면 영구 전달불가로 단정: inflight 에서 빼 포기(undeliverable++). 0 이면 무상한(0077 동일).
        if (this.deliverMaxRetries > 0 && e.tries >= this.deliverMaxRetries) {
          this.inflight.delete(seq); this.undeliverable++;
          this._partyFail(e.party);   // 파티 ack 타임아웃 포기(step-0092) — 이 전달이 파티 멤버였으면 그 파티 failed++ → partyIncomplete 종결. partyAckGiveup OFF·비-파티면 no-op(0091 비트 동일).
          // 파티 incomplete 발행(step-0093·partyIncompletePublish) — 이 포기로 파티가 부분 전달 종결에 *처음* 이르면 svc.party.incomplete 발행(관측·종결 1회). OFF·bus 부재·비-파티면 no-op(0092 비트 동일). 0082 failed 의 파티 판.
          if (this.partyIncompletePublish && this.bus && e.party != null && this.partyIncomplete(e.party) && !this._incPub.has(e.party)) {
            this._incPub.add(e.party); const r = this.partyReceipts.get(e.party);
            this.net.send(this.addr, this.bus, { type: 'pub', topic: 'svc.party.incomplete', ev: { partyId: e.party, members: r.members, routed: r.routed, delivered: r.delivered, failed: r.failed } });
            this.partyIncompletePublished++;
          }
          // 전달 포기 통지(step-0079·deliverNotify) — 원 발신자(e.from)에게 영구 전달실패를 회신해 가시화. OFF 면 통지 0(0078 동일·포기는 조용).
          if (this.deliverNotify) { this.net.send(this.addr, e.from, { type: 'deliveryFailed', to: e.to, body: e.body }); this.failedNotified++; }
          // 전달 실패 발행(step-0082·failedPublish) — 포기를 svc.whisper.failed 토픽으로 발행(관측/감사 평면). 발신자 통지(point-to-point·행동용)와 *직교* — audit 같은 범용 sink 가 실패 스트림을 구독. OFF·bus 부재면 발행 0(0081 비트 동일).
          if (this.failedPublish && this.bus) { this.net.send(this.addr, this.bus, { type: 'pub', topic: 'svc.whisper.failed', ev: { to: e.to, from: e.from, body: e.body } }); this.failedPublished++; }
          continue;
        }
        const rmsg = { type: 'whisperDeliver', from: e.from, body: e.body, seq, ackTo: this.addr };
        if (this.epochKeyed) rmsg.epoch = this.epoch;   // 재발신도 현 epoch(restart 가 inflight 를 비우므로 교차-epoch 재시도 없음)
        this.net.send(this.addr, e.to, rmsg);
        e.at = tick; e.tries++; this.deliverRetries++;
      }
    }
  },
});
const __part = { WhisperRouter };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).svc_whisper_handlers = __part;
