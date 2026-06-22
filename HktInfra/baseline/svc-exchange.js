'use strict';
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
    this.listings = new Map();          // listingId -> {seller, item, price} — 현재 open(escrow 보유) 매물. size = open 수 = escrow 보유 아이템 수.
    this.nextId = 0;                    // listingId 단조 발급(결정론).
    this.listed = 0;                    // 누적 list 수(총 escrow 진입). 보존식 좌변: listed == open + sold + cancelled.
    this.sold = 0;                      // 누적 체결(escrow→구매자) 수.
    this.cancelled = 0;                 // 누적 취소(escrow→판매자 반환) 수.
    this.rejects = 0;                   // 닫힌/없는 listing 에 대한 buy/cancel 거부 수(이중 해결 차단 계측).
    this.delivered = new Map();         // buyer -> 받은 아이템 수(release acquire 측 회계).
    this.proceeds = new Map();          // seller -> 받은 대가 합(체결 시 판매자 수익).
    this.returned = new Map();          // seller -> 취소로 반환받은 아이템 수.
  }
  _bump(mp, k, n) { mp.set(k, (mp.get(k) || 0) + (n === undefined ? 1 : n)); }
  onMsg(m) {
    const p = m.payload;
    // 매물 등록(list·acquire) — 판매자가 아이템을 거래소 escrow 로 맡긴다. 이후 그 아이템은 거래소 권위 아래(판매자 이중 판매 불가). open++.
    if (p.type === 'exchList') {
      const id = ++this.nextId;
      this.listings.set(id, { seller: p.seller, item: p.item, price: p.price | 0 });
      this.listed++;
      return;
    }
    // 체결(buy·release 쌍) — escrow 아이템을 구매자에게 넘기고 대가를 판매자에게. 매물은 닫힌다(delete). 없는/닫힌 매물이면 거부(이중 판매 0).
    if (p.type === 'exchBuy') {
      const l = this.listings.get(p.id);
      if (!l) { this.rejects++; return; }
      this.listings.delete(p.id); this.sold++;
      this._bump(this.delivered, p.buyer);          // 구매자가 아이템 acquire
      this._bump(this.proceeds, l.seller, l.price); // 판매자가 대가 acquire
      // 체결 발행(step-0108·exchangePublish) — 성립한 거래를 svc.exchange.sold 로 1회 발행(관측·거래량/시세 피드 씨앗). OFF·bus 부재면 no-op(0107 비트 동일).
      if (this.publish && this.bus) { this.net.send(this.addr, this.bus, { type: 'pub', topic: 'svc.exchange.sold', ev: { id: p.id, buyer: p.buyer, seller: l.seller, price: l.price } }); this.published++; }
      return;
    }
    // 취소(cancel·release) — 판매자가 자기 매물을 거둬 escrow 아이템을 돌려받는다. 소유자 불일치/없는 매물이면 거부.
    if (p.type === 'exchCancel') {
      const l = this.listings.get(p.id);
      if (!l || l.seller !== p.seller) { this.rejects++; return; }
      this.listings.delete(p.id); this.cancelled++;
      this._bump(this.returned, p.seller);          // 판매자가 아이템 반환 acquire
      return;
    }
  }
  // 보존 — 모든 listed 아이템은 매 순간 정확히 한 상태(open / sold / cancelled). 공백·중복 0 의 거래소 판(권위 단일 소유 + 쌍 거래).
  conserved() { return this.listed === this.listings.size + this.sold + this.cancelled; }
  open() { return this.listings.size; }
}

const __part = { ExchangeService };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).svc_exchange = __part;
