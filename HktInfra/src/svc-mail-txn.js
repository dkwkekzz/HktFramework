'use strict';
// step-0172 — 아이템 우편 saga 자동 주기 재전송(mailAutoRetry): mailSweep 핸들러가 autoRetry ON 이면 _resendPending() 도 트리거(ttl 체크 앞·TTL 회수와 직교·거래소 0129 의 우편 판). OFF 면 0171 비트 동일.
// step-0165 정리 분할 — 우편 *트랜잭션 핸들러*(onMsg): mailSend(입금·아이템 첨부·leg1 인출)·mailFetch(수령·leg2 입금)·mailSweep(만료·leg3 반환).
//   원장 코어(svc-mail-core.js)의 프로토타입을 Object.assign 으로 증강(거래소 svc-exchange-txn 0124·가방 svc-inventory-txn 0053 과 동일 패턴·동작 불변). 진입점 svc-mail.js 가 core 뒤에 로드한다.
const __isNode = typeof module !== 'undefined' && module.exports && typeof require !== 'undefined';
const { MailService } = __isNode ? require('./svc-mail-core.js') : globalThis.__HktNetParts.svc_mail_core;
Object.assign(MailService.prototype, {
  onMsg(m) {
    const p = m && m.payload;
    if (!p) return;
    // 가방 give 결과 비동기 수신(step-0166·mailSaga) — _custody 가 replyTo 로 보낸 give 의 item_result 회신.
    //   집계(ackedGives·giveOks·giveFails) + 미해결 추적 drain(step-0167). saga OFF 면 이 메시지가 영영 안 옴(0165 비트 동일·가방 echo 휴면).
    if (p.type === 'item_result' && p.op === 'give') {
      // 지속 회신 손실 모의(step-0173·테스트 seam ackDropAlways) — 이 gid 회신을 *매번* 드롭(안 지움 → 재전송이 영영 통과 못 함 → maxRetries 상한 트리거). 미제공이면 무손실.
      if (this.ackDropAlways && p.gid !== undefined && this.ackDropAlways.has(p.gid)) return;
      // 회신 손실 모의(step-0167·테스트 seam ackDrop) — 이 gid 회신을 *1회* 드롭(transient·step-0168 drop-once → 재전송이 통과). 잃은 gid 가 pending 에 남는다(ackedGives<gives). 미제공이면 무손실.
      if (this.ackDrop && p.gid !== undefined && this.ackDrop.has(p.gid)) { this.ackDrop.delete(p.gid); return; }
      this.ackedGives++;
      if (p.gid !== undefined) { this.pending.delete(p.gid); this.pendingGive.delete(p.gid); this.retryCount.delete(p.gid); }   // step-0167: 회신 도착 → 미해결서 제거(정상 흐름 0 으로 drain) (step-0173: 재전송 카운트도 제거)
      if (p.ok) this.giveOks++; else this.giveFails++;
      return;
    }
    // 미해결 give 재전송(step-0168·mailRetry) — 회신 손실로 pending 에 남은 give 를 같은 gid 로 재발신(재실행 아닌 *재회신* 유도·가방 sagaDedup 전제). pendingGive 비었으면 no-op = 0167 비트 동일.
    if (p.type === 'mailRetry') { this._resendPending(); return; }
    // 포기 give 재admission(step-0176·mailReadmit) — 운영이 손실 해소 후 포기(abandonedGive)된 give 를 pendingGive 로 되돌려 retry 재개(거래소 0134 의 우편 판). abandonedGive 비었으면 no-op = 0175 비트 동일.
    if (p.type === 'mailReadmit') { this._readmit(); return; }
    // 우편 입금(mailSend) — 발신자가 수신자 우편함에 우편 1통을 비동기 적재(수신자 접속 무관). p={type,id?,from,to,body}.
    //   id 미지정이면 결정론 시퀀스로 부여. 같은 id 재전송은 멱등(이중 적재 0 — 재전송 신뢰성 0145~ 대비).
    if (p.type === 'mailSend') {
      const rcpt = p.to;
      const id = p.id != null ? p.id : ('mail' + (this._seq++));
      const box = this._box(rcpt);
      if (box.has(id)) return;   // idempotent
      const sentAt = m.tick != null ? m.tick : (p.sentAt | 0);
      const item = (this.item && p.item != null) ? p.item : null;   // step-0157: 아이템 첨부(mailItem OFF·미첨부면 null = 0156 비트 동일)
      box.set(id, { id, from: p.from, to: rcpt, body: p.body, sentAt, item });
      this.sent++;
      if (item != null) this.itemSent++;
      if (item != null) this._custody(item, p.from, 'escrow', { kind: 'send', id });   // 인출 레그(step-0161·leg1) — 발신자 가방 → escrow custody(mailInv ON 일 때만). 아이템이 발신자 가방을 실제로 떠난다(거래소 0117 list leg 의 우편 판).
      this._journal({ kind: 'send', id, from: p.from, to: rcpt, body: p.body, sentAt, item });   // step-0145: durable op (step-0157: item 동봉)
      // 입금 발행(step-0144·mailSentPublish) — svc.mail.sent 로 1회 발행(운영 가시화·audit 관측). OFF·bus 부재면 no-op(0143 비트 동일).
      if (this.sentPublish && this.bus && this.net) { this.net.send(this.addr, this.bus, { type: 'pub', topic: 'svc.mail.sent', ev: { id, from: p.from, to: rcpt, sentAt } }); this.sentPublished++; }
      return;
    }
    // 우편 수령(mailFetch·step-0143) — 수신자가 자기 우편함을 pull. 보유분 전부를 읽음 보관으로 *무손실 이동*(box→read).
    //   빈 우편함 재수령은 0통(이중 수령 0). p={type,to}. 마지막 수령 배치는 _lastFetch 에 보관(0147 발행 대비).
    if (p.type === 'mailFetch') {
      const rcpt = p.to;
      const box = this.boxes.get(rcpt);
      const out = box ? [...box.values()] : [];
      if (out.length) {
        const log = this.read.get(rcpt) || [];
        for (const mm of out) log.push(mm);
        this.read.set(rcpt, log);
        this.fetched += out.length;
        for (const mm of out) if (mm.item != null) this.itemFetched++;   // step-0158: 아이템도 수령 이동(itemHeld→itemFetched)
        for (const mm of out) if (mm.item != null) this._custody(mm.item, 'escrow', rcpt, { kind: 'fetch', id: mm.id });   // 입금 레그(step-0162·leg2) — escrow → 수신자 가방 custody(mailInv ON 일 때만). 아이템이 escrow 를 떠나 수신자 가방으로(거래소 0118 buy leg 의 우편 판).
        box.clear();   // 보유→수령 이동(무손실·중복 0). 빈 Map 유지(held(rcpt)==0).
        this._journal({ kind: 'fetch', to: rcpt });   // step-0145: durable op(수령도 replay 정합 — replay 시 그 시점 보유분을 동일 이동)
        // 읽음 발행(step-0147·mailReadPublish) — 수령 통마다 svc.mail.read 발행(운영/발신자 읽음 관측). OFF·bus 부재면 no-op(0146 비트 동일·발행은 replay 에서 안 함).
        if (this.readPublish && this.bus && this.net) for (const mm of out) { this.net.send(this.addr, this.bus, { type: 'pub', topic: 'svc.mail.read', ev: { id: mm.id, to: rcpt, from: mm.from } }); this.readPublished++; }
      }
      this._lastFetch = { to: rcpt, mails: out };
      return;
    }
    // 우편 만료 sweep(mailSweep·step-0148) — now−sentAt≥ttl 인 미수령 우편을 시간 트리거로 회수(보유→만료). p={type,now?}. now 미지정이면 주입 tick.
    //   ttl 0 면 no-op(0147 동일). 결정론: recipient/id 정렬 순회. 만료도 durable op('expire')로 저널 → reconstruct 정합.
    if (p.type === 'mailSweep') {
      // 자동 재전송(step-0172·mailAutoRetry) — sweep 이 미해결 give 재전송도 트리거(주기적 타임아웃 재전송·exchSweep autoRetry 0129 의 우편 판·명시 mailRetry 0168 의 주기 형태).
      //   가방 dedup(0168) 이 재실행 0 보장. ttl 체크 *앞*(autoRetry 와 TTL 회수는 직교·같은 주기 신호 재사용). OFF 면 skip = 0171 비트 동일.
      if (this.autoRetry) this._resendPending();
      if (this.ttl <= 0) return;
      const now = p.now != null ? p.now : (m.tick | 0);
      for (const rcpt of [...this.boxes.keys()].sort()) {
        const box = this.boxes.get(rcpt);
        for (const id of [...box.keys()].sort()) {
          const mm = box.get(id);
          if (now - mm.sentAt >= this.ttl) {
            box.delete(id); this.expired++;
            if (mm.item != null) this.itemExpired++;   // step-0159: 아이템 실은 우편 만료 회수(itemHeld→itemExpired)
            if (mm.item != null) this._custody(mm.item, 'escrow', mm.from, { kind: 'expire', id });   // 반환 레그(step-0163·leg3) — escrow → 발신자 가방 custody(mailInv ON 일 때만). 미수령 아이템이 발신자에게 회수(거래소 0119 expire leg 의 우편 판·증발 0).
            this._journal({ kind: 'expire', to: rcpt, id });   // durable op(만료도 replay 정합)
            // 만료 발행(step-0149·mailExpirePublish) — 회수 통마다 svc.mail.expired 발행(운영/발신자 관측). OFF·bus 부재면 no-op(0148 비트 동일·replay 에선 안 함).
            if (this.expirePublish && this.bus && this.net) { this.net.send(this.addr, this.bus, { type: 'pub', topic: 'svc.mail.expired', ev: { id, to: rcpt, from: mm.from } }); this.expirePublished++; }
          }
        }
      }
      return;
    }
  }
});
if (__isNode) module.exports = { MailService };
