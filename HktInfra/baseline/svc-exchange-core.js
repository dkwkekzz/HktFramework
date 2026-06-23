'use strict';
// step-0125 — saga 미해결 give 추적 + 회신 손실 감지(pendingGives·gid): 0121 의 §9(회신 손실 무대비) 를 *가시화*한다. saga ON 이면 _custody 가 각 give 에 단조 gid 를 부여하고 미해결 집합(pending)에 넣는다 — 가방 item_result 회신이 그 gid 로 돌아오면 제거한다. 정상(무손실) 흐름서 pending 은 0 으로 drain(모든 give 가 acked·닫힌 고리의 liveness). 회신 경로(inventory→exchange item_result)에 손실을 주입하면 잃은 회신의 gid 가 pending 에 *남는다*(ack 미수신 격차가 가시·ackedGives<gives). 이로써 "어느 give 가 응답을 못 받았나"를 거래소가 안다 — 재전송(idempotent dedup)의 토대(후속). saga OFF·gid 부재면 추적 0 = 0124 비트 동일.
// step-0124 정리 분할 — ExchangeService *원장 코어*(생성자 + 헬퍼 _custody/_journal/스냅샷 + crash + reconstruct + 조회).
//   거래소 트랜잭션 핸들러(onMsg)는 svc-exchange-txn.js 가 Object.assign 으로 프로토타입 증강(가방 core/txn 분할과 같은 패턴·동작 불변·reg 0).
//   진입점 svc-exchange.js 가 둘을 묶어 동일 export(ExchangeService) 노출 — 분할은 *파일 구조*만(바이트·동작 불변·svc-exchange.js 가 32KB 초과 → 비대화 트리거).
//   역사(왜 각 필드가 있는가)는 step 문서가 SSOT: 0107 거래소 분리(escrow 쌍 거래·존 넘는 거래)·0108 체결 발행·0109 영속·0110 스냅샷 압축·0111 취소 발행·0114 만료 TTL·0115 만료 발행·0117~0119 가방 give 실체화(인출/입금/반환)·0120 2-서비스 보존·0121 saga 피드백·0122 보상·0123 보상 발행.
// dual-mode: Node require / 브라우저는 common.js 를 <script> 선행 로드(전역 __HktNetCommon).
const __c = (typeof module !== 'undefined' && module.exports && typeof require !== 'undefined')
  ? require('./common.js') : globalThis.__HktNetCommon;
const { Net, LoginServer, SessionRegistry, mulberry32, fnv1a, DEFAULTS } = __c;

// ── [게임 서비스] ExchangeService — 아이템 거래소(SPINE 계층3). 존 tick 밖 *순수 반응형*(onTick 없음·발신 0 = 비-침습 구조적). ──
//   list/buy/cancel 메시지로 escrow 원장을 굴린다 — 거래소가 escrow 아이템의 *단일 쓰기 권위*. 이동은 쌍 거래(list=acquire / buy·cancel=release).
//   분리 이유(SPINE §2 판정): 아이템 거래는 존 tick 박자와 무관 — 비동기. 가방(0014)·파티(0075)와 같은 "존 밖 단일 소유 원장 + 쌍 거래" 패턴의 *두 당사자 교환* 판.
class ExchangeService {
  constructor(opts = {}) {
    this.bus = opts.bus || null;        // 버스 주소(step-0108 체결 발행 대상). 부재면 발신 0(순수 원장).
    this.publish = opts.publish || false;   // 체결 발행(step-0108·exchangePublish) — exchBuy 성공 시 svc.exchange.sold 발행. OFF·bus 부재면 발행 0(0107 비트 동일).
    this.published = 0;                 // 발행한 svc.exchange.sold 수(step-0108·계측·sold 와 1:1).
    this.cancelPublish = opts.cancelPublish || false;   // 취소 발행(step-0111) — exchCancel 성공 시 svc.exchange.cancelled 발행. OFF·bus 부재면 발행 0(0110 비트 동일).
    this.cancelPublished = 0;           // 발행한 svc.exchange.cancelled 수(step-0111·계측·cancelled 와 1:1).
    this.listings = new Map();          // listingId -> {seller, item, price} — 현재 open(escrow 보유) 매물. size = open 수 = escrow 보유 아이템 수.
    this.nextId = 0;                    // listingId 단조 발급(결정론).
    this.listed = 0;                    // 누적 list 수(총 escrow 진입). 보존식 좌변: listed == open + sold + cancelled + expired(0114).
    this.sold = 0;                      // 누적 체결(escrow→구매자) 수.
    this.cancelled = 0;                 // 누적 취소(escrow→판매자 반환) 수.
    this.ttl = opts.ttl || 0;           // 매물 만료 TTL(step-0114·exchExpiry) — now−listedAt ≥ ttl 이면 sweep 시 자동 만료. 0 이면 비활성(sweep no-op·0113 동일).
    this.expired = 0;                   // 누적 만료(시간 트리거 escrow→판매자 반환) 수(step-0114). 보존식 우변에 합류.
    this.expirePublish = opts.expirePublish || false;   // 만료 발행(step-0115) — sweep 만료 시 svc.exchange.expired 발행. OFF·bus 부재면 발행 0(0114 비트 동일).
    this.expirePublished = 0;           // 발행한 svc.exchange.expired 수(step-0115·계측·expired 와 1:1).
    this.rejects = 0;                   // 닫힌/없는 listing 에 대한 buy/cancel 거부 수(이중 해결 차단 계측).
    this.delivered = new Map();         // buyer -> 받은 아이템 수(release acquire 측 회계).
    this.proceeds = new Map();          // seller -> 받은 대가 합(체결 시 판매자 수익).
    this.returned = new Map();          // seller -> 취소로 반환받은 아이템 수.
    this.persist = opts.persist || false;   // 원장 영속(step-0109·exchangePersist) — list/buy/cancel 명령을 durable op 저널에 기록·crash 후 replay. OFF 면 저널 0(0108 동일·휘발).
    this.journal = [];                  // durable op 저널 [{seq, kind, ...}](step-0109) — projection 과 분리(crash 시 projection 만 소실). 성공 op 만 기록(rejects 제외).
    this.jseq = 0;                      // 저널 seq 단조 발급.
    this.snapInterval = opts.snapInterval || 0;   // 저널 스냅샷 압축(step-0110·exchangeSnapshot). 0 이면 압축 0·저널 무계(0109 동일).
    this.snapshot = null;               // {upToSeq, state}(step-0110) — 마지막 압축 스냅샷. reconstruct 의 출발점.
    this.inv = opts.inv || null;        // 가방(inventory) 주소(step-0117·exchInventory) — escrow 실체화 give 의 대상. 부재면 추상 escrow(0116 동일).
    this.invMode = opts.invMode || false;   // 거래소↔가방 원자 거래(step-0117) — ON 이면 list/buy/cancel/expire 가 가방 give 로 escrow custody 이동. OFF 면 추상 escrow(0116 비트 동일).
    this.gives = 0;                     // 가방으로 보낸 give 수(step-0117·계측·인출/입금/반환 레그 합).
    this.saga = opts.saga || false;     // 2-서비스 saga 피드백(step-0121·exchSaga) — ON 이면 give 에 replyTo+cause 첨부·가방 item_result 회신·거래소 집계. OFF 면 fire-and-forget(0120 비트 동일).
    this.ackedGives = 0;                // 가방에서 회신받은 give 결과 수(step-0121·계측·saga ON 일 때만). 정상 흐름서 == gives.
    this.giveOks = 0;                   // 그 중 ok:true(성공 acked) 수.
    this.giveFails = 0;                 // 그 중 ok:false(가방 거부·소유 불일치) 수 — phantom 매물의 신호.
    this.compensate = opts.compensate || false;   // saga 보상(step-0122·exchCompensate) — ON 이면 list 인출 give 실패 시 listing abort(낙관적 open 롤백). OFF 면 open 유지(0121 비트 동일).
    this.aborted = 0;                   // 보상으로 abort 한 listing 수(step-0122·계측). 보존식에서 listed-- 로 함께 빠지므로 conserved 불변.
    this.abortPublish = opts.abortPublish || false;   // 보상 발행(step-0123) — abort 성립 시 svc.exchange.aborted 발행. OFF·bus 부재면 발행 0(0122 비트 동일).
    this.abortPublished = 0;            // 발행한 svc.exchange.aborted 수(step-0123·계측·aborted 와 1:1).
    this.gid = 0;                       // give id 단조 발급(step-0125·saga ON 일 때만) — 미해결 추적·회신 매칭 키.
    this.pending = new Set();           // 미해결 give 의 gid 집합(step-0125) — _custody 가 add·item_result 회신이 delete. 정상 흐름서 0 으로 drain·회신 손실 시 잔존(ack 미수신 격차 가시).
    this.pendingPeak = 0;              // pending 최대 크기(step-0125·계측) — in-flight give 가 실제로 있었음을 증거(0 이면 추적 미작동).
  }
  // escrow custody 이동 헬퍼(step-0117) — 거래소↔가방 2-서비스 쌍 거래의 한 레그. invMode·inv·itemId 있을 때만 가방에 give(fromAvatar→toAvatar). 가방이 권위·거래소는 요청만(은닉). 미충족이면 no-op(추상 escrow·0116 동일).
  _custody(itemId, from, to, cause) {
    if (!this.invMode || !this.inv || itemId == null) return;
    const msg = { type: 'item_req', op: 'give', itemId, fromAvatar: from, toAvatar: to };
    // saga 피드백(step-0121) — ON 이면 replyTo(거래소 주소)+cause(어느 레그·listingId) 를 실어 가방이 item_result 를 거래소로도 회신.
    //   OFF 면 msg 가 0120 과 정확히 같다(replyTo/cause/gid 키 없음) → 가방의 회신 분기 휴면 = 비트 동일.
    if (this.saga) {
      const gid = this.gid++;           // 미해결 추적 id(step-0125) — 회신 매칭 키
      msg.replyTo = this.addr; msg.cause = cause; msg.gid = gid;
      this.pending.add(gid);
      if (this.pending.size > this.pendingPeak) this.pendingPeak = this.pending.size;
    }
    this.net.send(this.addr, this.inv, msg);
    this.gives++;
  }
  _bump(mp, k, n) { mp.set(k, (mp.get(k) || 0) + (n === undefined ? 1 : n)); }
  // projection 직렬화(step-0110·스냅샷) — durable 상태(open 매물 + 회계)를 복사. Map 은 entries 배열로.
  _snapState() { return { listings: [...this.listings.entries()].map(([id, l]) => [id, { ...l }]), nextId: this.nextId, listed: this.listed, sold: this.sold, cancelled: this.cancelled, expired: this.expired, delivered: [...this.delivered], proceeds: [...this.proceeds], returned: [...this.returned] }; }
  // projection 복원(step-0110·스냅샷에서 출발) — 직렬화 상태를 다시 Map/스칼라로. listing 의 at(0114·listedAt)은 {...l} 로 함께 복원(post-recovery sweep 가능).
  _restore(s) { this.listings = new Map(s.listings.map(([id, l]) => [id, { ...l }])); this.nextId = s.nextId; this.listed = s.listed; this.sold = s.sold; this.cancelled = s.cancelled; this.expired = s.expired || 0; this.delivered = new Map(s.delivered); this.proceeds = new Map(s.proceeds); this.returned = new Map(s.returned); }
  // op 저널 추가(step-0109) — 원장을 바꾼 성공 명령만 durable 저널에 append. persist OFF 면 no-op(0108 동일).
  //   step-0110: snapInterval 도달 시 현재 projection 을 스냅샷(upToSeq=jseq)하고 그 이하 저널을 가지치기 → 저널 tail 만 유계 보관.
  _journal(entry) {
    if (!this.persist) return;
    this.journal.push({ seq: ++this.jseq, ...entry });
    if (this.snapInterval > 0 && this.journal.length >= this.snapInterval) {
      this.snapshot = { upToSeq: this.jseq, state: this._snapState() };
      this.journal = this.journal.filter(e => e.seq > this.jseq);   // tail 만 남김(방금 upToSeq 이하 전부 가지치기 → 0)
    }
  }
  // crash(step-0109) — 박스 RAM 소실의 인프로세스 모델: projection(매물·체결 회계)만 비운다. *op 저널은 durable* 이라 보존(0085 partyPersist 의 거래소 판). rejects 도 비움(저널엔 성공 op 만).
  crash() {
    this.listings = new Map(); this.nextId = 0; this.listed = 0; this.sold = 0; this.cancelled = 0; this.expired = 0; this.rejects = 0; this.published = 0; this.cancelPublished = 0; this.expirePublished = 0; this.gives = 0;
    this.ackedGives = 0; this.giveOks = 0; this.giveFails = 0; this.aborted = 0; this.abortPublished = 0;   // saga 피드백/보상/발행 집계 리셋(step-0121~0123) — 새 프로세스는 give 결과·abort·발행 이력 0(플래그 OFF 면 무관).
    this.gid = 0; this.pending = new Set(); this.pendingPeak = 0;   // 미해결 give 추적 리셋(step-0125) — 새 프로세스는 in-flight give 이력 0(saga OFF 면 무관).
    this.delivered = new Map(); this.proceeds = new Map(); this.returned = new Map();
  }
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
  }
  // 보존 — 모든 listed 아이템은 매 순간 정확히 한 상태(open / sold / cancelled / expired). 공백·중복 0 의 거래소 판(권위 단일 소유 + 쌍 거래·시간 트리거 포함).
  conserved() { return this.listed === this.listings.size + this.sold + this.cancelled + this.expired; }
  open() { return this.listings.size; }
  pendingGives() { return this.pending.size; }   // 미해결(회신 미수신) give 수(step-0125) — 정상 흐름 0·회신 손실 시 >0(ack 미수신 격차).
  // 거래소가 escrow 에 들고 있다고 *믿는* open 매물의 itemId 집합(step-0120·2-서비스 보존 단언용 읽기 accessor·정렬). itemId 없는(추상 escrow) 매물은 제외.
  escrowItemIds() { return [...this.listings.values()].map(l => l.itemId).filter(x => x != null).sort(); }
}

const __part = { ExchangeService };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).svc_exchange_core = __part;
