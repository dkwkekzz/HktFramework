'use strict';
// step-0171 정리 분할 — 우편 *영속·failover 부품*(event sourcing): projection 스냅샷/복원(_snapState/_restore)·op 저널(_journal·스냅샷 압축)·crash(projection 소실)·reconstruct(저널 replay 재구성).
//   원장 코어(svc-mail-core.js)의 프로토타입을 Object.assign 으로 증강(가방 svc-inventory-persist 0053·트랜잭션 svc-mail-txn 0165 와 동일 패턴·동작 불변·reg 0). 진입점 svc-mail.js 가 core→txn→persist 순 로드.
//   분할 이유: svc-mail-core.js 가 30KB 를 넘어(비대화 트리거·박스 1개=파일 1개 유계) saga arc(0166~0170) 누적분을 부품으로 떼냈다(기능 0·바이트 동일·reg 0).
const __isNode = typeof module !== 'undefined' && module.exports && typeof require !== 'undefined';
const { MailService } = __isNode ? require('./svc-mail-core.js') : globalThis.__HktNetParts.svc_mail_core;
Object.assign(MailService.prototype, {
  // projection 스냅샷/복원(step-0146) — 우편함(보유)·읽음·회계를 plain 구조로 직렬화/역직렬화(스냅샷 압축의 베이스).
  _snapState() {
    return {
      boxes: [...this.boxes].map(([r, mm]) => [r, [...mm.values()].map(x => ({ ...x }))]),
      read: [...this.read].map(([r, arr]) => [r, arr.map(x => ({ ...x }))]),
      sent: this.sent, fetched: this.fetched, expired: this.expired,
    };
  },
  _restore(s) {
    this.boxes = new Map(s.boxes.map(([r, arr]) => [r, new Map(arr.map(x => [x.id, { ...x }]))]));
    this.read = new Map(s.read.map(([r, arr]) => [r, arr.map(x => ({ ...x }))]));
    this.sent = s.sent; this.fetched = s.fetched; this.expired = s.expired;
  },
  // op 저널 추가(step-0145) — 우편함을 바꾼 op(send/fetch)만 durable 저널에 append. persist OFF 면 no-op(0144 동일).
  //   step-0146: snapInterval 도달 시 현재 projection 을 스냅샷(upToSeq=jseq)하고 그 이하 저널을 가지치기 → tail 만 유계 보관.
  _journal(entry) {
    if (!this.persist) return;
    this.journal.push({ seq: ++this.jseq, ...entry });
    if (this.snapInterval > 0 && this.journal.length >= this.snapInterval) {
      this.snapshot = { upToSeq: this.jseq, state: this._snapState() };
      this.journal = this.journal.filter(e => e.seq > this.jseq);   // tail 만(방금 upToSeq 이하 전부 가지치기 → 0)
    }
  },
  // crash(step-0145) — 박스 RAM 소실의 인프로세스 모델: projection(우편함·읽음·회계)만 비운다. *op 저널은 durable* 이라 보존(거래소 0109 의 우편 판).
  crash() {
    this.boxes = new Map(); this.read = new Map();
    this.sent = 0; this.fetched = 0; this.expired = 0; this.sentPublished = 0; this.readPublished = 0; this.expirePublished = 0; this._seq = 0; this._lastFetch = null;
    this.itemSent = 0; this.itemFetched = 0; this.itemExpired = 0;   // step-0157~0159: 아이템 회계도 RAM 소실(저널 replay 로 복원)
    this.gives = 0;   // step-0161: give 계측도 소실. reconstruct 는 custody 를 *재발행하지 않는다*(다른 서비스 부수효과·저널 replay 는 projection 만 — 거래소 0109 동형)
    this.ackedGives = 0; this.giveOks = 0; this.giveFails = 0;   // step-0166: saga 회신 계측 소실(저널 밖·외부 회신 의존·reconstruct 가 재발행 안 함)
    this.gid = 0; this.pending = new Set(); this.pendingGive = new Map(); this.pendingPeak = 0;   // step-0167: 미해결 추적도 소실(외부 회신 의존)
    this.retries = 0;   // step-0168: 재전송 계측 소실
    this.retryCount = new Map(); this.giveAbandoned = 0; this.abandonPublished = 0;   // step-0173/0174: 재시도 카운트·포기 계측·포기 발행 계측 소실(외부 회신 의존·발행은 replay 에서 안 함)
    this.abandonedGive = new Map(); this.readmitted = 0; this.readmitPublished = 0;   // step-0176/0177: 재admission 소스·계측·발행 계측 소실(외부 회신 의존·발행은 replay 에서 안 함)
    this.readmitCount = new Map(); this.permFailed = 0; this.failPublished = 0;   // step-0178/0179: 재admission 횟수·영구 실패 계측·발행 계측 소실(외부 회신 의존·발행은 replay 에서 안 함)
    this.escrowIds = new Set();   // step-0164: escrow 추적도 소실 → reconstruct 가 저널 replay 로 재계산(custody 재발행 없이 집합만).
  },
  // reconstruct(step-0145·failover) — fresh 박스가 durable op 저널을 seq 순 replay 해 projection 을 재계산(onMsg 와 같은 매핑·발신/발행 없이) → 죽기 전과 비트 동일.
  //   send → 우편함 적재 + sent++(멱등). fetch → 그 시점 보유분 전부 box→read 이동(수령 회계 재현). 발행(sentPublish)은 replay 에서 *안 한다*(파생 스트림·이중 발행 방지).
  //   step-0146: 스냅샷이 있으면 그 projection 에서 출발해 tail(seq>upToSeq)만 replay(스냅샷 압축 — 전체 replay 와 비트 동일).
  reconstruct() {
    if (this.snapshot) this._restore(this.snapshot.state);
    for (const e of this.journal.slice().sort((a, b) => a.seq - b.seq)) {
      if (e.kind === 'send') {
        const box = this._box(e.to);
        if (box.has(e.id)) continue;
        const item = e.item != null ? e.item : null;   // step-0157: 아이템 동봉 replay
        box.set(e.id, { id: e.id, from: e.from, to: e.to, body: e.body, sentAt: e.sentAt, item });
        this.sent++;
        if (item != null) this.itemSent++;
        if (this.invMode && item != null) this.escrowIds.add(item);   // step-0164: 발신 replay 시 escrow 진입 재계산(custody 재발행 없이 집합만)
      } else if (e.kind === 'fetch') {
        const box = this.boxes.get(e.to);
        const out = box ? [...box.values()] : [];
        if (out.length) {
          const log = this.read.get(e.to) || [];
          for (const mm of out) log.push(mm);
          this.read.set(e.to, log);
          this.fetched += out.length;
          for (const mm of out) if (mm.item != null) this.itemFetched++;   // step-0158: 아이템 수령 이동 replay
          if (this.invMode) for (const mm of out) if (mm.item != null) this.escrowIds.delete(mm.item);   // step-0164: 수령 replay 시 escrow 이탈 재계산
          box.clear();
        }
      } else if (e.kind === 'expire') {   // 만료(step-0148) — 회수된 우편 1통 제거 + expired++(저널 정합).
        const box = this.boxes.get(e.to);
        if (box && box.has(e.id)) { const mm = box.get(e.id); box.delete(e.id); this.expired++; if (mm.item != null) { this.itemExpired++; if (this.invMode) this.escrowIds.delete(mm.item); } }   // step-0159: 아이템 만료 회수 replay (step-0164: escrow 이탈 재계산)
      }
    }
  },
});
if (__isNode) module.exports = { MailService };
