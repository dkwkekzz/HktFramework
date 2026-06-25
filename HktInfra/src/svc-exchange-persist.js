'use strict';
// step-0264 정리 분할(#49 wiring) — svc-exchange-core.js 가 30.7KB>30KB 박스 트리거를 넘겨,
//   ExchangeService 의 *영속/스냅샷/failover 메서드*(_bump·_snapState·_restore·_journal·crash·reconstruct)를
//   svc-exchange-persist.js 믹스인으로 분리한다. 코어가 `Object.assign(ExchangeService.prototype, ExchangePersist)` 로 되섞음 —
//   정의 위치만 이동·this 바인딩/메서드 해소 동일·기능 0 → reg 0(0263 비트 동일). 0251 orch-placement 믹스인 분할의 거래소 판.
// dual-mode: Node require / 브라우저는 <script> 선행 로드(전역 __HktNetParts.svc_exchange_persist).
const ExchangePersist = {
  _bump(mp, k, n) { mp.set(k, (mp.get(k) || 0) + (n === undefined ? 1 : n)); },
  // projection 직렬화(step-0110·스냅샷) — durable 상태(open 매물 + 회계)를 복사. Map 은 entries 배열로.
  _snapState() { return { listings: [...this.listings.entries()].map(([id, l]) => [id, { ...l }]), nextId: this.nextId, listed: this.listed, sold: this.sold, cancelled: this.cancelled, expired: this.expired, delivered: [...this.delivered], proceeds: [...this.proceeds], returned: [...this.returned] }; },
  // projection 복원(step-0110·스냅샷에서 출발) — 직렬화 상태를 다시 Map/스칼라로. listing 의 at(0114·listedAt)은 {...l} 로 함께 복원(post-recovery sweep 가능).
  _restore(s) { this.listings = new Map(s.listings.map(([id, l]) => [id, { ...l }])); this.nextId = s.nextId; this.listed = s.listed; this.sold = s.sold; this.cancelled = s.cancelled; this.expired = s.expired || 0; this.delivered = new Map(s.delivered); this.proceeds = new Map(s.proceeds); this.returned = new Map(s.returned); },
  // op 저널 추가(step-0109) — 원장을 바꾼 성공 명령만 durable 저널에 append. persist OFF 면 no-op(0108 동일).
  //   step-0110: snapInterval 도달 시 현재 projection 을 스냅샷(upToSeq=jseq)하고 그 이하 저널을 가지치기 → 저널 tail 만 유계 보관.
  _journal(entry) {
    if (!this.persist) return;
    this.journal.push({ seq: ++this.jseq, ...entry });
    if (this.snapInterval > 0 && this.journal.length >= this.snapInterval) {
      this.snapshot = { upToSeq: this.jseq, state: this._snapState() };
      this.journal = this.journal.filter(e => e.seq > this.jseq);   // tail 만 남김(방금 upToSeq 이하 전부 가지치기 → 0)
    }
  },
  // crash(step-0109) — 박스 RAM 소실의 인프로세스 모델: projection(매물·체결 회계)만 비운다. *op 저널은 durable* 이라 보존(0085 partyPersist 의 거래소 판). rejects 도 비움(저널엔 성공 op 만).
  crash() {
    this.listings = new Map(); this.nextId = 0; this.listed = 0; this.sold = 0; this.cancelled = 0; this.expired = 0; this.rejects = 0; this.published = 0; this.cancelPublished = 0; this.expirePublished = 0; this.gives = 0;
    this.ackedGives = 0; this.giveOks = 0; this.giveFails = 0; this.aborted = 0; this.abortPublished = 0;   // saga 피드백/보상/발행 집계 리셋(step-0121~0123) — 새 프로세스는 give 결과·abort·발행 이력 0(플래그 OFF 면 무관).
    this.gid = 0; this.pending = new Set(); this.pendingPeak = 0; this.pendingGive = new Map(); this.retries = 0; this.sagaDones = 0;   // 미해결 give 추적/재전송/유계화 리셋(step-0125~0127) — 새 프로세스는 in-flight give 이력 0(saga OFF 면 무관).
    this.retryCount = new Map(); this.giveAbandoned = 0; this.abandonPublished = 0; this.abandonedGive = new Map(); this.readmitted = 0; this.readmitPublished = 0; this.readmitCount = new Map(); this.permFailed = 0; this.failPublished = 0;   // 재시도 상한/포기 발행/재admission/발행/횟수 상한/영구실패 발행 리셋(step-0131~0138) — 새 프로세스는 재시도 이력 0(sagaMaxRetries 0 면 무관).
    this.delivered = new Map(); this.proceeds = new Map(); this.returned = new Map();
  },
  // reconstruct(step-0109·failover) — fresh 박스가 durable op 저널을 seq 순 replay 해 projection 을 재계산(onMsg 와 정확히 같은 매핑·발신/발행 없이) → 죽기 전과 비트 동일.
  //   step-0110: 스냅샷이 있으면 그 projection 에서 출발해 tail(seq>upToSeq)만 replay. step-0122: abort 항도 정합.
  reconstruct() {
    if (this.snapshot) this._restore(this.snapshot.state);
    for (const e of this.journal.slice().sort((a, b) => a.seq - b.seq)) {
      if (e.kind === 'list') { this.listings.set(e.id, { seller: e.seller, item: e.item, price: e.price, at: e.at | 0, itemId: e.itemId }); this.listed++; if (e.id > this.nextId) this.nextId = e.id; }
      else if (e.kind === 'buy') { this.listings.delete(e.id); this.sold++; this._bump(this.delivered, e.buyer); this._bump(this.proceeds, e.seller, e.price); }
      else if (e.kind === 'cancel') { this.listings.delete(e.id); this.cancelled++; this._bump(this.returned, e.seller); }
      else if (e.kind === 'expire') { this.listings.delete(e.id); this.expired++; this._bump(this.returned, e.seller); }   // 만료(step-0114) — 취소와 동형 release(escrow→판매자)·시간 트리거. 저널 정합.
      else if (e.kind === 'abort') { this.listings.delete(e.id); this.listed--; this.aborted++; }   // 보상 abort(step-0122) — list 인출 실패로 롤백된 매물. list 가 더한 listed/listings 를 되돌림(저널 정합).
    }
  },
};

const __part = { ExchangePersist };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).svc_exchange_persist = __part;
