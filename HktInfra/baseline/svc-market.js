'use strict';
// step-0113 — 시세 피드 영속·late-join(marketReconstruct·거래소 op 저널 replay): 0112 MarketFeed 는 *자기 영속 0* — crash 시 시세 투영이 전부 소실됐다(0112 §9). 0020 읽기 모델(ranking)이 *쓰기 모델의 영속 저널*(PersistStore)을 replay 해 투영을 복원했듯, MarketFeed 는 거래소의 *durable op 저널*(0109 exchangePersist)을 replay 해 시세를 재계산한다 — 시세 피드는 *자기 영속 0* 이어도 거래소 저널이 권위 사본이므로 완전 복원(다운타임에 버스가 흘려보낸 sold/cancelled 를 놓쳤어도 거래소가 영속한 op 로 따라잡음·CQRS read model 의 핵심). list→id별 item 매핑·buy→그 item last/volume·cancel→cancelled. reconstruct == 죽기 전 == 라이브. marketReconstruct 미호출(OFF)이면 빈 투영(소실).
// step-0112 — 시세 피드 읽기 모델(marketFeed·svc.exchange.sold+cancelled 구독→item별 체결가·거래량·취소): 거래소(0107~0111)는 escrow 원장의 *권위*만 들고, 체결(0108 sold)·취소(0111 cancelled)를 버스로 발행한다. 이 박스는 그 두 토픽을 *소비만* 해 item별 {last 체결가, volume 누적 거래량, cancelled 누적 취소} 투영을 만든다 — 0019 RankingService(svc.item.out→아바타별 보유 수)의 *거래소 판*(CQRS read model). 원장 권위 0(거래소가 권위)·발신 0(audit 처럼 순수 관찰 소비자·존 tick 밖 반응형). 0016 발행자 무수정 소비자 패턴: 거래소·버스 코드/발신 스트림 비트 동일, 추가는 구독 테이블 행 + 이 박스뿐.
// dual-mode: Node require / 브라우저는 common.js 를 <script> 선행 로드(전역 __HktNetCommon).
const __c = (typeof module !== 'undefined' && module.exports && typeof require !== 'undefined')
  ? require('./common.js') : globalThis.__HktNetCommon;
const { Net, LoginServer, SessionRegistry, mulberry32, fnv1a, DEFAULTS } = __c;

// ── [게임 서비스] MarketFeed — 거래소 시세 피드(읽기 모델). 존 tick 밖 *순수 반응형*(onTick 없음·발신 0). ──
//   svc.exchange.sold·svc.exchange.cancelled 두 토픽을 구독해 item별 시세를 *재계산*하는 파생 뷰일 뿐 — 원장 권위는 거래소.
//   sold{item,price} → 그 item 의 last=price·volume++(체결가 피드·거래량). cancelled{item} → cancelled++(delisting 카운트).
//   0019 RankingService(소비→발행 CQRS) 와 달리 *발신 0*(AuditService 처럼 관찰 전용) — 시세는 질의(pull)로 읽는다(priceOf·volumeOf).
class MarketFeed {
  constructor(opts = {}) {
    this.bus = opts.bus || null;   // 이벤트 버스 주소(구독 경유 — 발행자 주소 무지). marketFeed 는 bus 전제.
    this.market = new Map();       // item -> {last, volume, cancelled} (시세 투영 — 거래소 발행 스트림의 파생, 권위 아님)
    this.consumed = 0;             // svc.exchange.* 소비 수(관찰 소비자의 입력 회계 — sold+cancelled)
  }
  _row(item) { if (!this.market.has(item)) this.market.set(item, { last: 0, volume: 0, cancelled: 0 }); return this.market.get(item); }
  onMsg(m) {
    const p = m.payload;
    if (p.type !== 'ev' || !p.ev) return;
    // 체결 소비(svc.exchange.sold·0108) — item 의 최근 체결가 갱신 + 거래량 누적. ev={id,buyer,seller,item,price}.
    if (p.topic === 'svc.exchange.sold') { const r = this._row(p.ev.item); r.last = p.ev.price | 0; r.volume++; this.consumed++; return; }
    // 취소 소비(svc.exchange.cancelled·0111) — item 의 취소(delisting) 누적. ev={id,seller,item,price}.
    if (p.topic === 'svc.exchange.cancelled') { const r = this._row(p.ev.item); r.cancelled++; this.consumed++; return; }
  }
  priceOf(item) { const r = this.market.get(item); return r ? r.last : 0; }       // 최근 체결가(미체결이면 0)
  volumeOf(item) { const r = this.market.get(item); return r ? r.volume : 0; }    // 누적 거래량
  cancelledOf(item) { const r = this.market.get(item); return r ? r.cancelled : 0; }
  // crash — 읽기 모델 프로세스 사망(RAM 소실)의 인프로세스 모델. 투영·소비 회계 비움(자기 영속 0).
  crash() { this.market = new Map(); this.consumed = 0; }
  // reconstruct(step-0113·late-join) — 시세 피드의 late-join: 자기 영속 0 인데도 *거래소의 durable op 저널*(0109)을 replay 해 시세 투영을 재계산(0020 ranking 의 거래소 판).
  //   매핑: list → id별 {item,price} 기록(buy/cancel 저널은 item 미포함이므로 list 로 id→item 해석), buy → 그 item 의 last=price·volume++, cancel → 그 item cancelled++ (= 라이브 sold/cancelled 소비와 정확히 같다).
  //   핵심: 다운타임에 버스가 흘려보낸 svc.exchange.sold/cancelled 를 *놓쳤어도*, 그 사실을 거래소가 저널에 영속했으므로 저널 replay 가 *완전한* 시세를 복원한다(CQRS read model). 저널은 seq 순.
  //   ※ 거래소 저널이 스냅샷 압축(0110)으로 가지쳐지면 가지친 head 의 volume 이력은 복원 불가(스냅샷에 시세 카운터 없음) — 완전 복원은 저널 무압축(snapInterval 0) 전제(0113 §9 한계).
  reconstruct(journal) {
    this.market = new Map(); this.consumed = 0;
    const byId = new Map();   // listingId -> {item, price} (buy/cancel 저널의 item 해석용 — list 저널이 유일한 id→item 소스)
    for (const e of (journal || []).slice().sort((a, b) => a.seq - b.seq)) {
      if (e.kind === 'list') { byId.set(e.id, { item: e.item, price: e.price }); }
      else if (e.kind === 'buy') { const l = byId.get(e.id); const item = l ? l.item : e.item; if (item != null) { const r = this._row(item); r.last = e.price | 0; r.volume++; this.consumed++; } }
      else if (e.kind === 'cancel') { const l = byId.get(e.id); if (l) { const r = this._row(l.item); r.cancelled++; this.consumed++; } }
    }
  }
}

const __part = { MarketFeed };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).svc_market = __part;
