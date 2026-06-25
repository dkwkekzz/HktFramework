'use strict';
// step-0268 정리 분할(#49 인접·선제) — svc-mail-core.js 가 25.3KB(30KB 근접·성장 박스)라, MailService 의 *saga 헬퍼*(_custody·_resendPending·_readmit:
//   우편↔가방 escrow custody 레그 + 미해결 give 재전송/상한/포기 + 재admission)를 svc-mail-saga.js 믹스인으로 분리한다. 코어가 Object.assign(prototype) 로 되섞음 —
//   정의 위치만 이동·this 바인딩/메서드 해소 동일·기능 0 → reg 0(0267 비트 동일). 0171 txn/persist 증강과 같은 패턴(이번엔 saga 헬퍼).
// dual-mode: Node require / 브라우저는 <script> 선행 로드(전역 __HktNetParts.svc_mail_saga).
const MailSaga = {
  // 아이템 custody 이동 헬퍼(step-0161) — 우편↔가방 2-서비스 쌍 거래의 한 레그. invMode·inv·itemId 있을 때만 가방에 give(fromAvatar→toAvatar). 가방이 권위·우편은 요청만(은닉). 미충족이면 no-op(추상 escrow·0160 동일·reg 0).
  //   거래소 _custody(0117)의 우편 판. send=발신자→escrow(leg1 0161)·fetch=escrow→수신자(leg2 0162)·expire=escrow→발신자(leg3 0163).
  _custody(itemId, from, to, cause) {
    if (!this.invMode || !this.inv || itemId == null || !this.net) return;
    const msg = { type: 'item_req', op: 'give', itemId, fromAvatar: from, toAvatar: to };
    // saga 피드백(step-0166·mailSaga) — ON 이면 replyTo(우편 주소)+cause(어느 레그·mailId) 를 실어 가방이 item_result 를 우편으로도 회신.
    //   OFF 면 msg 가 0165 와 정확히 같다(replyTo/cause 키 없음) → 가방의 echo(_sagaReply) 휴면 = 비트 동일(reg 0).
    if (this.saga) {
      const gid = this.gid++;           // 미해결 추적 id(step-0167) — 회신 매칭 키
      msg.replyTo = this.addr; msg.cause = cause; msg.gid = gid;
      this.pending.add(gid);
      this.pendingGive.set(gid, { itemId, from, to, cause });   // 재전송 소스(step-0168 대비)
      if (this.pending.size > this.pendingPeak) this.pendingPeak = this.pending.size;
    }
    this.net.send(this.addr, this.inv, msg);
    this.gives++;
    if (to === 'escrow') this.escrowIds.add(itemId);        // 발신 인출(leg1) — escrow 진입(step-0164·2-서비스 보존 추적)
    else if (from === 'escrow') this.escrowIds.delete(itemId);   // 수령 입금(leg2)·만료 반환(leg3) — escrow 이탈
  },
  // 미해결 give 재전송(step-0168·mailRetry·0172·autoRetry 공용)·재시도 상한(step-0173·maxRetries) — pendingGive 에 남은(회신 손실) give 를 *같은 gid* 로 재발신(재실행 아닌 *재회신* 유도·가방 sagaDedup 전제).
  //   재전송이라 gives/escrowIds 무증가(이미 추적 중)·retries++. maxRetries>0 이면 gid 당 N회 재전송 후 포기(pendingGive 제거→이후 sweep 비-순회·giveAbandoned++·pending(Set) 잔존·sagaConsistent 불변). 포기는 *재전송 중단*일 뿐 abort 아님(give 가 실제 성공했을 수 있어 낙관적 미해결 유지=안전). maxRetries 0·pendingGive 빔이면 0172 비트 동일.
  _resendPending() {
    if (!this.invMode || !this.inv || !this.net) return;
    for (const [gid, g] of [...this.pendingGive]) {
      if (this.maxRetries > 0) {
        const c = this.retryCount.get(gid) || 0;
        if (c >= this.maxRetries) {
          this.pendingGive.delete(gid); this.retryCount.delete(gid); this.giveAbandoned++;   // 상한 도달 — 포기(재전송 중단·pending 잔존)
          // 재admission 횟수 상한(step-0178·readmitMax) — readmitMax 회 재admission 된 give 가 또 포기되면 *영구 실패*: abandonedGive 에 안 넣어 재admission 차단(무한 abandon↔readmit 루프 방지). pending(Set)엔 잔존(미해결·sagaConsistent 불변). readmitMax 0 면 항상 abandonedGive(0177 비트 동일).
          if (this.readmitMax > 0 && (this.readmitCount.get(gid) || 0) >= this.readmitMax) {
            this.readmitCount.delete(gid); this.permFailed++;
            // 영구 실패 발행(step-0179·mailFailPublish) — 종결된 give 를 svc.mail.saga_failed 로 1회 발행(saga liveness 발행 종결 마디·거래소 0138 의 우편 판). OFF·bus 부재면 no-op(0178 비트 동일).
            if (this.failPublish && this.bus && this.net) { this.net.send(this.addr, this.bus, { type: 'pub', topic: 'svc.mail.saga_failed', ev: { gid, itemId: g.itemId, cause: g.cause } }); this.failPublished++; }
            continue;
          }
          this.abandonedGive.set(gid, g);   // 재admission 소스(step-0176) — 포기 give 파라미터 간직(운영이 손실 해소 후 mailReadmit 으로 재개). pending(Set)엔 그대로 남아 미해결.
          // 포기 발행(step-0174·mailAbandonPublish) — 영구 미해결 give 를 svc.mail.saga_abandoned 로 1회 발행(운영 가시화·거래소 0132 의 우편 판). OFF·bus 부재면 no-op(0173 비트 동일).
          if (this.abandonPublish && this.bus && this.net) { this.net.send(this.addr, this.bus, { type: 'pub', topic: 'svc.mail.saga_abandoned', ev: { gid, itemId: g.itemId, cause: g.cause } }); this.abandonPublished++; }
          continue;
        }
        this.retryCount.set(gid, c + 1);
      }
      this.net.send(this.addr, this.inv, { type: 'item_req', op: 'give', itemId: g.itemId, fromAvatar: g.from, toAvatar: g.to, replyTo: this.addr, cause: g.cause, gid });
      this.retries++;
    }
  },
  // 포기 give 재admission(step-0176·mailReadmit·거래소 0134 의 우편 판) — 운영이 손실 해소 후 포기(abandonedGive)된 give 를 pendingGive 로 되돌려 retry 재개(retryCount 리셋·상한 재충전). 이후 sweep/mailRetry 가 재전송 → 손실 해소 후면 ack→drain. abandonedGive 비었으면 no-op = 0175 비트 동일.
  _readmit() {
    for (const [gid, g] of this.abandonedGive) {
      this.pendingGive.set(gid, g); this.retryCount.delete(gid); this.readmitted++;
      this.readmitCount.set(gid, (this.readmitCount.get(gid) || 0) + 1);   // 재admission 횟수 누적(step-0178·readmitMax 비교용·readmitMax 0 면 미사용·관찰 무영향)
      // 재admission 발행(step-0177·mailReadmitPublish) — 포기 give 재개를 svc.mail.saga_readmitted 로 1회 발행(0174 포기 발행의 짝·운영 가시화). OFF·bus 부재면 no-op(0176 비트 동일).
      if (this.readmitPublish && this.bus && this.net) { this.net.send(this.addr, this.bus, { type: 'pub', topic: 'svc.mail.saga_readmitted', ev: { gid, itemId: g.itemId, cause: g.cause } }); this.readmitPublished++; }
    }
    this.abandonedGive = new Map();
  },
};

const __part = { MailSaga };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).svc_mail_saga = __part;

