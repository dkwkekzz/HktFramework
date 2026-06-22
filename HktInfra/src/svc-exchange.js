'use strict';
// step-0120 — 거래소↔가방 2-서비스 보존 불변(escrowItemIds 단언·결합 시스템의 창발 불변): 0117~0119 가 거래소↔가방을 escrow 중개로 결합했다 — 이제 *두 서비스에 걸친* 보존이 성립하는지 단언한다. 거래소가 들고 있다고 *믿는* open 매물의 itemId 집합(escrowItemIds)은 가방 원장에서 *실제로* 'escrow' 가 소유한 itemId 집합과 정확히 일치해야 한다(거래소 회계 ≡ 가방 권위·두 서비스 불일치 0). 또 전 거래 흐름(list/buy/cancel/expire 혼합)에서 가방 total(minted)은 불변(아이템은 mint/소멸이 아니라 소유자만 바뀜)·매 아이템은 정확히 한 소유자(seller/escrow/buyer). escrowItemIds 는 *읽기 accessor*(open 매물의 itemId 정렬 목록) — 단언용·미호출이면 동작 무영향 = 0119 비트 동일(reg).
// step-0119 — 거래소↔가방 cancel/expire 반환(exchInventory leg 3·escrow→판매자 실물 반환): 0117 인출+0118 입금으로 list→buy 실물 거래는 닫혔으나, *미체결* 매물의 종결(취소 0107·만료 0114)은 거래소 회계(cancelled/expired/returned)만 굴리고 escrow custody 아이템이 가방에서 판매자에게 *안 돌아왔다*. 이 step 은 반환 레그를 더한다: exchCancel·exchSweep 만료 성립 시 거래소가 가방에 give(itemId, escrow→seller) → escrow custody 가 판매자 가방으로(인출 0117 의 역). 이로써 escrow 의 *모든 출구*(체결→구매자·취소/만료→판매자)가 실물 이동을 동반 — 미체결 아이템이 escrow 에 영영 묶이지 않는다. 가방 권위·minted 불변·xfer++. exchInventory OFF·itemId 부재면 give 0 = 0118 비트 동일.
// step-0118 — 거래소↔가방 buy 입금(exchInventory leg 2·escrow→구매자 실물 인도): 0117 은 list 인출 레그만 — escrow 가 가방 원장에 실체화됐으나 exchBuy 는 거래소 회계(sold)만 굴리고 *구매자 가방엔 아이템이 안 들어왔다*. 이 step 은 입금 레그를 더한다: exchBuy 성립 시 거래소가 가방에 give(itemId, escrow→buyer) → escrow custody 아이템이 구매자 가방으로(2-서비스 쌍 거래의 *인도* 레그·인출 0117 의 짝). 이로써 list(인출)+buy(인도)가 *존을 넘는 실물 거래*를 완성 — 판매자가 escrow 에 맡긴 실제 아이템이 구매자에게 간다(가방이 권위·minted 불변·xfer++). exchInventory OFF·itemId 부재면 give 0 = 0117 비트 동일(추상 sold).
// step-0117 — 거래소↔가방 list 인출(exchInventory leg 1·escrow 를 진짜 가방 원장에 실체화): 0107~0116 의 escrow 는 *추상*이었다 — 거래소 자기 카운터로만 굴러 실제 가방(inventory) 아이템은 빠지지 않았다(판매자가 list 후에도 그 아이템을 계속 보유·존 넘는 거래의 진짜 형태 아님·0107 §9). 이 step 은 escrow 를 *가방 원장의 reserved 아바타 'escrow'* 로 실체화한다: exchList{seller,itemId} 시 거래소가 가방에 give(itemId, seller→escrow) 를 보내 아이템을 escrow custody 로 옮긴다(2-서비스 쌍 거래의 *인출* 레그). 이후 그 아이템은 가방 원장에서 'escrow' 소유 — 판매자 이중 판매 불가(가방이 권위). 가방 total(minted) 불변(이동일 뿐)·xfer++. exchInventory OFF·itemId 부재면 give 0 = 0116 비트 동일(추상 escrow). buy/cancel/expire 의 입금/반환 레그는 후속 step.
// step-0115 — 매물 만료 발행(expirePublish·svc.exchange.expired): 0114 만료(시간 트리거 회수)는 거래소 내부 회계(expired)로만 굴러 외부 관측 불가 — audit·시세 피드가 만료를 못 본다(0114 §9). 0108 sold·0111 cancelled 발행과 같은 매핑으로, 만료 성립(sweep 회수)을 svc.exchange.expired{id,seller,item,price} 로 1회 발행한다 — 시간 트리거 escrow→판매자 반환 순간 버스로, 무수정 소비자(audit·시세 피드)가 구독해 만료를 관측(시세 깊이/회전 추적). 0016 발행자 무수정 소비자 패턴의 거래소 *만료* 판(취소 발행 0111 의 시간 트리거 형제). expirePublish OFF·bus 부재면 발행 0 = 0114 비트 동일.
// step-0114 — 매물 만료 TTL(exchExpiry·시간 기반 escrow 자동 회수): 0107~0113 의 매물은 *판매자 명시 취소*(exchCancel)로만 닫혔다 — 안 팔리고 안 취소되면 영영 escrow 에 묶인다(0111 §9 한계). 상용 거래소(경매장) 매물은 일정 시간 뒤 *자동 만료*돼 판매자에게 돌아간다. 매물에 listedAt(m.tick)을 기록하고, exchSweep{now} op 가 들어오면 now−listedAt ≥ ttl 인 open 매물을 만료시킨다(escrow→판매자 반환·취소와 같은 release 쌍이되 *시간 트리거*). 만료는 새 종결 상태 expired 로 회계 — 보존식 확장: listed == open + sold + cancelled + expired. 만료도 durable 저널('expire')에 기록→reconstruct 정합(영속·압축과 동작). ttl 0 = 만료 비활성(sweep no-op) = 0113 비트 동일.
// step-0112 — sold 발행 ev 에 item 추가(시세 피드 입력): 0108 svc.exchange.sold 는 {id,buyer,seller,price} 만 실어 *어떤 아이템*이 거래됐는지 빠졌다 — item별 시세 피드(0112 MarketFeed)가 키로 쓸 수 없었다. 체결 시점 listing l.item 을 ev 에 추가({id,buyer,seller,item,price}) → 거래량/체결가 피드가 item 별 집계 가능(0111 cancelled ev 는 이미 item 포함). 발행은 exchangePublish ON 일 때만 — reg 시나리오엔 거래소 OFF 라 비트 동일.
// step-0111 — 거래소 취소 발행(cancelPublish·svc.exchange.cancelled): 0108 은 체결(exchBuy)만 svc.exchange.sold 로 발행했다 — 매물 *회수*(exchCancel 성공)는 외부에서 관측 불가(escrow→판매자 반환이 조용히 일어남). 0097 귓속말 반송 발행(bouncePublish)·0104 수신함 손실 발행과 같은 매핑으로, 취소 성립을 svc.exchange.cancelled{id,seller,item,price} 로 1회 발행한다 — 매물이 escrow 에서 빠져 판매자에게 돌아가는 순간 버스로, audit·시세 피드 등 무수정 소비자가 구독해 *delisting* 을 관측(거래량 피드는 sold 와 cancelled 양쪽이 필요·매물 깊이 추적의 씨앗). 0016 발행자 무수정 소비자 패턴의 거래소 *취소* 판(0108 sold 발행의 대칭). cancelPublish OFF·bus 부재면 발행 0 = 0110 비트 동일.
// step-0110 — 거래소 저널 스냅샷 압축(exchangeSnapshot·snapshot+tail replay): 0109 의 op 저널은 *무계 성장*이라 거래가 누적될수록 replay 비용·메모리가 ∝op 수다(0109 §9). 0018 가방·0022 채팅·0086 파티가 *주기 스냅샷+tail replay* 로 푼 압축을 거래소 op 저널에 적용한다: snapInterval 개 op 마다 현재 projection(open 매물 + 회계)을 스냅샷(upToSeq 기록)하고 그 이하 저널을 가지치기 → 저널은 *마지막 스냅샷 이후 tail* 만 보관(유계). reconstruct 는 스냅샷에서 출발해 tail(seq>upToSeq)만 replay → 전체 저널 replay 와 비트 동일(무손실 압축). 스냅샷+tail == 전체 저널 == 죽기 전. exchangeSnapshot(snapInterval 0)면 압축 0·저널 무계 = 0109 비트 동일.
// step-0109 — 거래소 영속·failover(exchangePersist·op 저널 replay): 0107~0108 의 거래소 escrow 원장은 *휘발*(in-memory)이라 박스 crash 시 매물·체결 회계가 전부 소실됐다(영속 0). 0017 가방·0085 파티가 event sourcing(효과/변경 저널 replay)으로 푼 것을 *거래소 원장*에 적용한다: 원장을 바꾸는 명령(list/buy/cancel)을 *durable op 저널*에 추가하고, crash(RAM 소실) 후 fresh 거래소가 그 저널을 seq 순 replay 해 매물·체결 projection 을 재구성한다 → 죽기 전과 비트 동일(open 매물·listed/sold/cancelled/delivered/proceeds/returned 모두 재현). 원장(projection)은 휘발, 저널은 durable(0108 svc.exchange.sold 스트림이 곧 체결 이벤트의 외부 사본). 닫힌 매물 거부(rejects)는 *실패 시도 계측*이라 저널 안 함(0085 가 실패 변경을 저널 안 하듯) — 비-durable 운영 지표. exchangePersist OFF 면 저널 0·crash 후 reconstruct 해도 빈 원장(소실) = 0108 비트 동일(저널 미기록·휴면).
// step-0108 — 거래소 체결 발행(exchangePublish·거래 수명주기 관측): 0107 의 거래소는 escrow 원장을 내부 카운터(sold·proceeds)로만 굴린다 — 체결 사실이 외부에서 관측 불가. 가방(0014)이 svc.item.* 로 이벤트를 흘리고 0087/0103 이 수명주기를 발행했듯, 이 step 은 체결(exchBuy 성공)을 svc.exchange.sold{id,buyer,seller,price} 로 발행한다 — escrow→구매자 release 가 성립하는 순간 버스로 1회, audit·랭킹 등 무수정 소비자가 구독해 관측(거래량·시세 피드의 씨앗). 0016 발행자 무수정 소비자 패턴의 거래소 판. exchangePublish OFF·bus 부재면 발행 0 = 0107 비트 동일.
// step-0107 — 거래소(Exchange) 서비스 분리 (존 넘는 아이템 거래·escrow 쌍 거래): SPINE 계층3 게임 서비스의 거래소 박스 첫 구현. 가방(0014)이 *한 소유자* 원장이라면, 거래소는 *두 당사자 사이*의 아이템↔대가 교환을 존 tick 밖에서 비동기로 성립시킨다 — 그리고 그 핵심 netcode 불변은 가방과 같다: 권위 단일 소유 + 쌍 거래(release+acquire). list = 판매자가 아이템을 거래소 escrow 로 *맡김*(acquire — 이후 판매자는 그 아이템을 못 쓴다·이중 판매 0), buy = escrow 아이템을 구매자에게 *넘기고* 대가를 판매자에게(release 쌍), cancel = escrow 를 판매자에게 반환(release). 모든 listed 아이템은 매 순간 *정확히 한* 상태(open=escrow 보유 / sold / cancelled)에 있다 — 공백도 중복도 없다(보존: listed == open + sold + cancelled). 닫힌 listing 에 대한 buy/cancel 은 거부(rejects·이중 해결 0). 존을 넘는 거래가 *존간 결합 없이* 거래소 한 박스에서 성립(SPINE §2 가방 행). exchange 미설정이면 박스 0 = 0106 비트 동일.
// dual-mode: Node require / 브라우저는 common.js 를 <script> 선행 로드(전역 __HktNetCommon).
const __c = (typeof module !== 'undefined' && module.exports && typeof require !== 'undefined')
  ? require('./common.js') : globalThis.__HktNetCommon;
const { Net, LoginServer, SessionRegistry, mulberry32, fnv1a, DEFAULTS } = __c;

// ── [게임 서비스] ExchangeService — 아이템 거래소(SPINE 계층3). 존 tick 밖 *순수 반응형*(onTick 없음·발신 0 = 비-침습 구조적). ──
//   list/buy/cancel 메시지로 escrow 원장을 굴린다 — 거래소가 escrow 아이템의 *단일 쓰기 권위*. 이동은 쌍 거래(list=acquire / buy·cancel=release).
//   분리 이유(SPINE §2 판정): 아이템 거래는 존 tick 박자와 무관 — 비동기. 가방(0014)·파티(0075)와 같은 "존 밖 단일 소유 원장 + 쌍 거래" 패턴의 *두 당사자 교환* 판. 존을 넘는 거래가 존간 직접 결합 없이 이 박스 하나로 성립.
class ExchangeService {
  constructor(opts = {}) {
    this.bus = opts.bus || null;        // 버스 주소(step-0108 체결 발행 대상). 부재면 발신 0(순수 원장).
    this.publish = opts.publish || false;   // 체결 발행(step-0108·exchangePublish) — exchBuy 성공 시 svc.exchange.sold 발행(거래 수명주기 관측). OFF·bus 부재면 발행 0(0107 비트 동일).
    this.published = 0;                 // 발행한 svc.exchange.sold 수(step-0108·계측·sold 와 1:1).
    this.cancelPublish = opts.cancelPublish || false;   // 취소 발행(step-0111) — exchCancel 성공 시 svc.exchange.cancelled 발행(매물 회수 수명주기 관측·delisting 신호). OFF·bus 부재면 발행 0(0110 비트 동일).
    this.cancelPublished = 0;           // 발행한 svc.exchange.cancelled 수(step-0111·계측·cancelled 와 1:1).
    this.listings = new Map();          // listingId -> {seller, item, price} — 현재 open(escrow 보유) 매물. size = open 수 = escrow 보유 아이템 수.
    this.nextId = 0;                    // listingId 단조 발급(결정론).
    this.listed = 0;                    // 누적 list 수(총 escrow 진입). 보존식 좌변: listed == open + sold + cancelled + expired(0114).
    this.sold = 0;                      // 누적 체결(escrow→구매자) 수.
    this.cancelled = 0;                 // 누적 취소(escrow→판매자 반환) 수.
    this.ttl = opts.ttl || 0;           // 매물 만료 TTL(step-0114·exchExpiry) — now−listedAt ≥ ttl 이면 sweep 시 자동 만료(escrow→판매자). 0 이면 만료 비활성(sweep no-op·0113 동일).
    this.expired = 0;                   // 누적 만료(시간 트리거 escrow→판매자 반환) 수(step-0114). 보존식 우변에 합류: listed == open+sold+cancelled+expired.
    this.expirePublish = opts.expirePublish || false;   // 만료 발행(step-0115) — sweep 만료 시 svc.exchange.expired 발행(만료 관측). OFF·bus 부재면 발행 0(0114 비트 동일).
    this.expirePublished = 0;           // 발행한 svc.exchange.expired 수(step-0115·계측·expired 와 1:1).
    this.rejects = 0;                   // 닫힌/없는 listing 에 대한 buy/cancel 거부 수(이중 해결 차단 계측).
    this.delivered = new Map();         // buyer -> 받은 아이템 수(release acquire 측 회계).
    this.proceeds = new Map();          // seller -> 받은 대가 합(체결 시 판매자 수익).
    this.returned = new Map();          // seller -> 취소로 반환받은 아이템 수.
    this.persist = opts.persist || false;   // 원장 영속(step-0109·exchangePersist) — list/buy/cancel 명령을 durable op 저널에 기록·crash 후 replay 로 재구성. OFF 면 저널 0(0108 동일·휘발).
    this.journal = [];                  // durable op 저널 [{seq, kind, ...}](step-0109) — projection(listings·회계)과 분리(crash 시 projection 만 소실·저널은 영속). 성공 op 만 기록(rejects 제외).
    this.jseq = 0;                      // 저널 seq 단조 발급.
    this.snapInterval = opts.snapInterval || 0;   // 저널 스냅샷 압축(step-0110·exchangeSnapshot) — snapInterval 개 op 마다 projection 스냅샷+저널 가지치기. 0 이면 압축 0·저널 무계(0109 동일).
    this.snapshot = null;               // {upToSeq, state}(step-0110) — 마지막 압축 스냅샷(이하 저널은 가지쳐짐). reconstruct 의 출발점.
    this.inv = opts.inv || null;        // 가방(inventory) 주소(step-0117·exchInventory) — escrow 실체화 give 의 대상. 부재면 추상 escrow(0116 동일).
    this.invMode = opts.invMode || false;   // 거래소↔가방 원자 거래(step-0117·exchInventory) — ON 이면 list/buy/cancel/expire 가 가방 give 로 escrow custody 를 실제 이동. OFF 면 추상 escrow(0116 비트 동일).
    this.gives = 0;                     // 가방으로 보낸 give 수(step-0117·계측·인출/입금/반환 레그 합).
  }
  // escrow custody 이동 헬퍼(step-0117) — 거래소↔가방 2-서비스 쌍 거래의 한 레그. invMode·inv·itemId 있을 때만 가방에 give(fromAvatar→toAvatar). 가방이 권위(보유 검사·xfer)·거래소는 요청만(은닉·명시 인터페이스). 미충족이면 no-op(추상 escrow·0116 동일).
  _custody(itemId, from, to) {
    if (!this.invMode || !this.inv || itemId == null) return;
    this.net.send(this.addr, this.inv, { type: 'item_req', op: 'give', itemId, fromAvatar: from, toAvatar: to });
    this.gives++;
  }
  _bump(mp, k, n) { mp.set(k, (mp.get(k) || 0) + (n === undefined ? 1 : n)); }
  // projection 직렬화(step-0110·스냅샷) — durable 상태(open 매물 + 회계)를 복사. Map 은 entries 배열로.
  _snapState() { return { listings: [...this.listings.entries()].map(([id, l]) => [id, { ...l }]), nextId: this.nextId, listed: this.listed, sold: this.sold, cancelled: this.cancelled, expired: this.expired, delivered: [...this.delivered], proceeds: [...this.proceeds], returned: [...this.returned] }; }
  // projection 복원(step-0110·스냅샷에서 출발) — 직렬화 상태를 다시 Map/스칼라로. listing 의 at(0114·listedAt)은 {...l} 로 함께 복원(post-recovery sweep 가능).
  _restore(s) { this.listings = new Map(s.listings.map(([id, l]) => [id, { ...l }])); this.nextId = s.nextId; this.listed = s.listed; this.sold = s.sold; this.cancelled = s.cancelled; this.expired = s.expired || 0; this.delivered = new Map(s.delivered); this.proceeds = new Map(s.proceeds); this.returned = new Map(s.returned); }
  // op 저널 추가(step-0109) — 원장을 바꾼 성공 명령만 durable 저널에 append(0085 partyPersist 와 같은 매핑). persist OFF 면 no-op(0108 동일).
  //   step-0110: snapInterval 도달 시 현재 projection 을 스냅샷(upToSeq=jseq)하고 그 이하 저널을 가지치기 → 저널 tail 만 유계 보관.
  _journal(entry) {
    if (!this.persist) return;
    this.journal.push({ seq: ++this.jseq, ...entry });
    if (this.snapInterval > 0 && this.journal.length >= this.snapInterval) {
      this.snapshot = { upToSeq: this.jseq, state: this._snapState() };
      this.journal = this.journal.filter(e => e.seq > this.jseq);   // tail 만 남김(방금 upToSeq 이하 전부 가지치기 → 0)
    }
  }
  onMsg(m) {
    const p = m.payload;
    // 매물 등록(list·acquire) — 판매자가 아이템을 거래소 escrow 로 맡긴다. 이후 그 아이템은 거래소 권위 아래(판매자 이중 판매 불가). open++.
    if (p.type === 'exchList') {
      const id = ++this.nextId;
      this.listings.set(id, { seller: p.seller, item: p.item, price: p.price | 0, at: m.tick | 0, itemId: p.itemId });   // itemId(0117·가방 원장의 escrow 대상)
      this.listed++;
      this._custody(p.itemId, p.seller, 'escrow');   // 인출 레그(0117) — 판매자 가방 → escrow custody(invMode ON 일 때만)
      this._journal({ kind: 'list', id, seller: p.seller, item: p.item, price: p.price | 0, at: m.tick | 0, itemId: p.itemId });
      return;
    }
    // 매물 만료 sweep(step-0114·exchExpiry) — now−listedAt ≥ ttl 인 open 매물을 자동 만료(escrow→판매자 반환). 취소(cancel)와 같은 release 쌍이되 *판매자 요청*이 아닌 *시간 트리거*. ttl 0 면 비활성(no-op·0113 동일). 결정론: listings 는 삽입 순(Map) 순회.
    if (p.type === 'exchSweep') {
      if (this.ttl <= 0) return;
      const now = p.now | 0;
      for (const [id, l] of [...this.listings]) {
        if (now - (l.at | 0) >= this.ttl) {
          this.listings.delete(id); this.expired++;
          this._bump(this.returned, l.seller);          // 판매자가 만료 아이템 반환 acquire(취소와 동형)
          this._custody(l.itemId, 'escrow', l.seller);  // 반환 레그(0119) — escrow custody → 판매자 가방(만료·invMode ON 일 때만)
          // 만료 발행(step-0115·expirePublish) — 회수된 매물을 svc.exchange.expired 로 1회 발행(관측·0111 cancelled 의 시간 트리거 형제). OFF·bus 부재면 no-op(0114 비트 동일).
          if (this.expirePublish && this.bus) { this.net.send(this.addr, this.bus, { type: 'pub', topic: 'svc.exchange.expired', ev: { id, seller: l.seller, item: l.item, price: l.price } }); this.expirePublished++; }
          this._journal({ kind: 'expire', id, seller: l.seller });
        }
      }
      return;
    }
    // 체결(buy·release 쌍) — escrow 아이템을 구매자에게 넘기고 대가를 판매자에게. 매물은 닫힌다(delete). 없는/닫힌 매물이면 거부(이중 판매 0).
    if (p.type === 'exchBuy') {
      const l = this.listings.get(p.id);
      if (!l) { this.rejects++; return; }
      this.listings.delete(p.id); this.sold++;
      this._bump(this.delivered, p.buyer);          // 구매자가 아이템 acquire
      this._bump(this.proceeds, l.seller, l.price); // 판매자가 대가 acquire
      this._custody(l.itemId, 'escrow', p.buyer);   // 입금 레그(0118) — escrow custody → 구매자 가방(invMode ON 일 때만·인출 0117 의 짝)
      // 체결 발행(step-0108·exchangePublish) — 성립한 거래를 svc.exchange.sold 로 1회 발행(관측·거래량/시세 피드 씨앗). OFF·bus 부재면 no-op(0107 비트 동일).
      if (this.publish && this.bus) { this.net.send(this.addr, this.bus, { type: 'pub', topic: 'svc.exchange.sold', ev: { id: p.id, buyer: p.buyer, seller: l.seller, item: l.item, price: l.price } }); this.published++; }   // step-0112: item 추가(시세 피드 키)
      this._journal({ kind: 'buy', id: p.id, buyer: p.buyer, seller: l.seller, price: l.price });
      return;
    }
    // 취소(cancel·release) — 판매자가 자기 매물을 거둬 escrow 아이템을 돌려받는다. 소유자 불일치/없는 매물이면 거부.
    if (p.type === 'exchCancel') {
      const l = this.listings.get(p.id);
      if (!l || l.seller !== p.seller) { this.rejects++; return; }
      this.listings.delete(p.id); this.cancelled++;
      this._bump(this.returned, p.seller);          // 판매자가 아이템 반환 acquire
      this._custody(l.itemId, 'escrow', p.seller);  // 반환 레그(0119) — escrow custody → 판매자 가방(취소·invMode ON 일 때만)
      // 취소 발행(step-0111·cancelPublish) — 회수된 매물을 svc.exchange.cancelled 로 1회 발행(관측·delisting 신호). OFF·bus 부재면 no-op(0110 비트 동일).
      if (this.cancelPublish && this.bus) { this.net.send(this.addr, this.bus, { type: 'pub', topic: 'svc.exchange.cancelled', ev: { id: p.id, seller: p.seller, item: l.item, price: l.price } }); this.cancelPublished++; }
      this._journal({ kind: 'cancel', id: p.id, seller: p.seller });
      return;
    }
  }
  // crash(step-0109) — 박스 RAM 소실의 인프로세스 모델: projection(매물·체결 회계)만 비운다. *op 저널은 durable* 이라 보존(0085 partyPersist 의 거래소 판). rejects(실패 시도 계측)도 비움 — 저널엔 성공 op 만 있어 reconstruct 가 못 살리는 비-durable 지표.
  crash() {
    this.listings = new Map(); this.nextId = 0; this.listed = 0; this.sold = 0; this.cancelled = 0; this.expired = 0; this.rejects = 0; this.published = 0; this.cancelPublished = 0; this.expirePublished = 0; this.gives = 0;
    this.delivered = new Map(); this.proceeds = new Map(); this.returned = new Map();
  }
  // reconstruct(step-0109·failover) — fresh 박스가 durable op 저널을 seq 순 replay 해 projection 을 재계산(onMsg 와 정확히 같은 매핑·발신/발행 없이). list=매물 복원+nextId 추적·buy=체결·cancel=취소 → 죽기 전과 비트 동일(durable 원장). 자기 영속 저널만으로 거래소 복원(0085 멤버십 판).
  //   step-0110: 스냅샷이 있으면 그 projection 에서 출발해 tail(seq>upToSeq)만 replay → 스냅샷+tail == 전체 저널(무손실 압축). 스냅샷 없으면 저널 전체 replay(0109).
  reconstruct() {
    if (this.snapshot) this._restore(this.snapshot.state);
    for (const e of this.journal.slice().sort((a, b) => a.seq - b.seq)) {
      if (e.kind === 'list') { this.listings.set(e.id, { seller: e.seller, item: e.item, price: e.price, at: e.at | 0, itemId: e.itemId }); this.listed++; if (e.id > this.nextId) this.nextId = e.id; }
      else if (e.kind === 'buy') { this.listings.delete(e.id); this.sold++; this._bump(this.delivered, e.buyer); this._bump(this.proceeds, e.seller, e.price); }
      else if (e.kind === 'cancel') { this.listings.delete(e.id); this.cancelled++; this._bump(this.returned, e.seller); }
      else if (e.kind === 'expire') { this.listings.delete(e.id); this.expired++; this._bump(this.returned, e.seller); }   // 만료(step-0114) — 취소와 동형 release(escrow→판매자)·시간 트리거. 저널 정합.
    }
  }
  // 보존 — 모든 listed 아이템은 매 순간 정확히 한 상태(open / sold / cancelled / expired). 공백·중복 0 의 거래소 판(권위 단일 소유 + 쌍 거래·시간 트리거 포함).
  conserved() { return this.listed === this.listings.size + this.sold + this.cancelled + this.expired; }
  open() { return this.listings.size; }
  // 거래소가 escrow 에 들고 있다고 *믿는* open 매물의 itemId 집합(step-0120·2-서비스 보존 단언용 읽기 accessor·정렬).
  //   가방 원장에서 실제 'escrow' 소유 itemId 집합과 일치해야 한다(거래소 회계 ≡ 가방 권위). itemId 없는(추상 escrow·invMode OFF) 매물은 제외.
  escrowItemIds() { return [...this.listings.values()].map(l => l.itemId).filter(x => x != null).sort(); }
}

const __part = { ExchangeService };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).svc_exchange = __part;
