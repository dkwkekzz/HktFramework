'use strict';
// step-0137 — saga 재admission 횟수 상한(readmitMax): 0134/0136 §9 의 무한 abandon↔readmit 루프를 막는다. gid 가 readmitMax 회 재admission 된 뒤 또 포기되면 *영구 실패*(permFailed)로 abandonedGive 에 안 넣어 재admission 차단. pending 엔 남아 미해결(sagaConsistent 불변). readmitMax 0 면 무제한 = 0136 비트 동일.
// step-0136 — saga 재admission 자동 트리거(autoReadmit·0056 busPresenceRecover 의 saga 판): 0134/0135 재admission 은 수동 op 였다. autoReadmit ON 이면 거래소가 svc.inventory.up(가방 회복 신호)을 *구독*해, 그 ev 수신 시 스스로 _readmit() — 수동 exchReadmit 불요(은닉·decouple: 거래소는 가방 회복을 직접 안 보고 발행된 신호로만 반응). OFF 면 그 ev 무시 = 0135 비트 동일.
// step-0135 — saga 재admission 발행(readmitPublish): exchReadmit 으로 포기 give 를 재개할 때 svc.exchange.saga_readmitted{gid,itemId,cause} 1회 발행(운영 가시화·0132 포기 발행 svc.exchange.saga_abandoned 의 짝·readmitPublished==readmitted). OFF·bus 부재면 발행 0 = 0134 비트 동일.
// step-0134 — saga 포기 give 재admission(exchReadmit): 0131 포기는 영구였다 — 손실이 *해소*되면 운영이 재개할 수 있어야 한다. 포기 시 give 파라미터를 abandonedGive 에 간직, exchReadmit op 이 그것을 pendingGive 로 되돌리고 retryCount 리셋 → 다음 sweep 이 재전송(손실 해소 후면 ack→drain). exchReadmit 부재면 0133 비트 동일. (0048 busLeaseLife 재admission 의 saga 판.)
// step-0132 — saga 포기 발행(abandonPublish): 0131 상한 도달로 포기한 give 를 svc.exchange.saga_abandoned 로 1회 발행(운영 가시화·audit 관측·giveAbandoned 와 1:1). OFF·bus 부재면 발행 0 = 0131 비트 동일.
// step-0131 — saga 재시도 상한(sagaMaxRetries): autoRetry/exchRetry 재전송을 _resendPending() 헬퍼로 추출 + gid 당 N회 상한. 도달 시 포기(pendingGive 제거·giveAbandoned++)·pending 잔존(sagaConsistent 불변). 상한 0 면 무제한 = 0130 비트 동일.
// step-0129 — saga 자동 재전송(autoRetry·exchSweep 피기백): 0126 의 재전송은 명시 exchRetry op 1회였다 — 실서버는 *타임아웃 기반 주기 재전송*이 필요하다(거래소는 onTick 없는 순수 반응형이라 주기 트리거가 외부 op). 이미 0114 가 주기적 exchSweep op(TTL 회수)을 받는다 — autoRetry ON 이면 exchSweep 가 *미해결 give 재전송도* 트리거한다(TTL 만료 회수와 직교·같은 주기 신호 재사용). 매 sweep 이 pending 의 give 를 같은 gid 로 재발신 → 가방 dedup(0126) 이 재실행 없이 재회신 → 회신 손실이 *지속*돼도 다음 sweep 이 다시 시도(결국 한 회신이 통과하면 pending drain). autoRetry OFF·exchSweep 부재면 재전송 0 = 0128 비트 동일. exchSweep 의 TTL 로직(0114)은 autoRetry 와 독립(autoRetry 블록이 ttl 체크 앞·OFF 면 0114 동일).
// step-0128 — saga 회계 정합 불변(sagaConsistent·결합 시스템의 창발 불변): 0121~0127 의 saga 회계(gives·ackedGives·pendingGives·giveOks·giveFails)가 *대수적으로 닫혀* 있는지 단언한다. 두 항등식: ① gives == ackedGives + pendingGives(보낸 모든 give 는 *정확히* acked(회신 받음) 또는 pending(미수신) 둘 중 하나·새는 give 0) ② ackedGives == giveOks + giveFails(받은 모든 회신은 ok 또는 fail·분류 누락 0). 이 불변은 정상·회신손실·재전송 *모든 체제*에서 성립해야 한다(체제 무관 회계 정합). sagaConsistent 는 미호출 읽기 accessor(두 항등식의 AND)·단언용 — 미호출이면 동작 무영향 = 0127 비트 동일(reg).
// step-0127 — saga dedup 유계화(sagaDedupBound·saga_done ack-of-ack): 0126 §9 해소. 가방의 dedup 맵(sagaResults)은 처리한 모든 (replyTo,gid)를 무계로 쌓는다 — 재전송이 끝나도 안 지워진다. 거래소가 give 결과를 *최종 수신*(pending 에서 제거)하면 더는 그 gid 를 재전송하지 않으므로, 가방은 그 dedup 항목을 안전히 잊어도 된다. 거래소가 ack 수신 시 saga_done{gid} 를 가방에 보내 sagaResults[(replyTo,gid)] 를 가지친다(0042 busSeenBound 워터마크의 saga 회신 판·best-effort). sagaDedupBound ON: 정상 흐름서 sagaResults 가 0 으로 drain(유계). OFF: 무계(0126 동일·∝처리 give 수). saga_done 손실돼도 안전(가방이 항목 보존·재전송 시 여전히 재회신·다음 ack 가 다시 prune). sagaDedupBound OFF·saga_done 부재면 0126 비트 동일.
// step-0126 — saga 회신 재전송 + idempotent dedup(exchRetry·sagaDedup): 0125 의 §9 해소. 거래소가 미해결 give(pending)의 *파라미터*를 pendingGive 에 보관했다가 exchRetry op 에 재전송한다 — 단 *재실행이 아니라 재회신*을 받아야 안전하다. 가방이 give 를 (replyTo,gid)로 dedup(sagaResults): 이미 처리한 give 면 *원래 결과*를 재실행 없이 재회신한다. 그래야 회신만 손실된 경우(give 는 성공) 재전송이 owner≠from 으로 *재실행→ok:false 오판*되어 보상이 *valid 매물을 잘못 abort*(안전 위반)하는 것을 막는다. dedup ON: 재전송→저장된 ok:true 재회신→pending drain·giveOks 정확·2-서비스 안전. dedup OFF: 재전송→재실행 실패(ok:false)→보상 오작동(valid 매물 abort·open≠escrow). exchRetry op 부재·sagaDedup OFF 면 0125 비트 동일. 0042 seenReqs(요청 dedup)의 saga 회신 판.
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
    this.pendingGive = new Map();       // gid -> {itemId, from, to, cause}(step-0126) — 미해결 give 의 파라미터(재전송 소스). ack 시 pending 과 함께 delete.
    this.retries = 0;                   // 재전송한 give 누적(step-0126·exchRetry·계측).
    this.sagaDedupBound = opts.sagaDedupBound || false;   // saga dedup 유계화(step-0127) — ON 이면 give 결과 최종 수신 시 saga_done{gid} 를 가방에 보내 dedup 항목 가지치기. OFF 면 발신 0(0126 비트 동일).
    this.sagaDones = 0;                 // 발신한 saga_done 수(step-0127·계측·ackedGives 와 1:1·재전송 ack 포함).
    this.autoRetry = opts.autoRetry || false;   // 자동 재전송(step-0129) — ON 이면 exchSweep op 이 미해결 give 재전송도 트리거(주기적 타임아웃 재전송). OFF 면 sweep 은 TTL 회수만(0128 비트 동일).
    this.sagaMaxRetries = opts.sagaMaxRetries || 0;   // saga 재시도 상한(step-0131·0059 recoverMaxRetries 의 saga 판) — autoRetry/exchRetry 재전송을 gid 당 N회로 제한. 도달 시 그 give 포기(pendingGive 제거·재전송 중단)·pending 에는 잔존(미해결·sagaConsistent 불변). 0 이면 무제한(0130 비트 동일).
    this.retryCount = new Map();        // gid -> 재전송 횟수(step-0131·sagaMaxRetries>0 일 때만 사용) — 상한 비교용. ack/포기 시 제거.
    this.giveAbandoned = 0;             // 상한 도달로 포기한 give 누적(step-0131·계측) — 영구 회신 손실의 신호. pending 에는 남는다(미해결·재전송만 중단).
    this.abandonPublish = opts.abandonPublish || false;   // 포기 발행(step-0132) — 상한 도달로 give 포기 시 svc.exchange.saga_abandoned 발행(운영 가시화·audit 관측). OFF·bus 부재면 발행 0(0131 비트 동일).
    this.abandonPublished = 0;          // 발행한 svc.exchange.saga_abandoned 수(step-0132·계측·giveAbandoned 와 1:1).
    this.abandonedGive = new Map();     // gid -> {itemId, from, to, cause}(step-0134) — 포기한 give 의 파라미터 보관(재admission 소스). 0131 은 버렸으나 운영이 손실 해소 후 재개할 수 있게 *간직*한다(내부 상태·sagaMaxRetries 0 면 빈 맵).
    this.readmitted = 0;                // exchReadmit 으로 재admission 한 give 누적(step-0134·계측) — 포기 give 의 retry 재개 수.
    this.readmitPublish = opts.readmitPublish || false;   // 재admission 발행(step-0135) — exchReadmit 으로 give 재개 시 svc.exchange.saga_readmitted 발행(운영 가시화·0132 포기 발행의 짝). OFF·bus 부재면 발행 0(0134 비트 동일).
    this.readmitPublished = 0;          // 발행한 svc.exchange.saga_readmitted 수(step-0135·계측·readmitted 와 1:1).
    this.autoReadmit = opts.autoReadmit || false;   // 재admission 자동 트리거(step-0136·0056 busPresenceRecover 의 saga 판) — ON 이면 거래소가 svc.inventory.up(가방 회복 신호)을 *구독*해 수신 시 스스로 _readmit(수동 exchReadmit op 불요). OFF 면 그 ev 무시 = 0135 비트 동일.
    this.readmitMax = opts.readmitMax || 0;   // 재admission 횟수 상한(step-0137·0134/0136 §9 의 무한 abandon↔readmit 루프 방지) — gid 가 readmitMax 회 재admission 된 뒤 또 포기되면 *영구 실패*로 abandonedGive 에 넣지 않는다(재admission 차단). 0 이면 무제한(0136 비트 동일).
    this.readmitCount = new Map();      // gid -> 재admission 누적 횟수(step-0137·readmitMax>0 일 때만 의미) — 상한 비교용. ack 시 정리.
    this.permFailed = 0;                // 재admission 상한 도달로 영구 실패 처리한 give 누적(step-0137·계측) — pending 엔 남는다(미해결·sagaConsistent 불변)·재admission 만 차단.
  }
  // 포기 give 재admission 실행(step-0134 추출·0136) — abandonedGive 의 give 를 pendingGive 로 되돌리고 retryCount 리셋(상한 재충전)·readmitted++. readmitPublish ON 이면 gid 마다 svc.exchange.saga_readmitted 발행(0135).
  //   exchReadmit op(수동)과 autoReadmit ev(자동·0136)가 공용한다. abandonedGive 비었으면 no-op.
  _readmit() {
    for (const [gid, g] of this.abandonedGive) {
      this.pendingGive.set(gid, g); this.retryCount.delete(gid); this.readmitted++;
      this.readmitCount.set(gid, (this.readmitCount.get(gid) || 0) + 1);   // 재admission 횟수 누적(step-0137·readmitMax 비교용·readmitMax 0 면 미사용·관찰 무영향)

      if (this.readmitPublish && this.bus) { this.net.send(this.addr, this.bus, { type: 'pub', topic: 'svc.exchange.saga_readmitted', ev: { gid, itemId: g.itemId, cause: g.cause } }); this.readmitPublished++; }
    }
    this.abandonedGive = new Map();
  }
  // 미해결 give 재전송(step-0126 exchRetry·0129 autoRetry 공용 추출 — 0131)·재시도 상한(step-0131·sagaMaxRetries).
  //   pendingGive 의 각 give 를 같은 gid 로 재발신(재실행 아닌 *재회신* 유도·가방 dedup 전제). sagaMaxRetries>0 이면 gid 당 N회 재전송 후 포기(pendingGive 제거→이후 sweep 비-순회·giveAbandoned++·pending 잔존).
  //   sagaMaxRetries 0(기본) 이면 상한 분기 휴면 → 무제한 재전송 = 0130 비트 동일(reg). 포기는 *재전송 중단*일 뿐 abort 아님(give 가 실제 성공했을 수 있으므로 낙관적 open 유지 = 안전).
  _resendPending() {
    for (const [gid, g] of [...this.pendingGive]) {
      if (this.sagaMaxRetries > 0) {
        const c = this.retryCount.get(gid) || 0;
        if (c >= this.sagaMaxRetries) {
          this.pendingGive.delete(gid); this.retryCount.delete(gid); this.giveAbandoned++;
          // 재admission 횟수 상한(step-0137·readmitMax) — readmitMax 회 재admission 된 give 가 또 포기되면 *영구 실패*: abandonedGive 에 안 넣어 재admission 차단(무한 루프 방지). pending(Set)엔 남아 미해결(sagaConsistent 불변). readmitMax 0 면 항상 abandonedGive(0136 동일).
          if (this.readmitMax > 0 && (this.readmitCount.get(gid) || 0) >= this.readmitMax) { this.readmitCount.delete(gid); this.permFailed++; continue; }
          this.abandonedGive.set(gid, g);   // 재admission 소스(step-0134) — 포기한 give 의 파라미터를 간직(운영이 손실 해소 후 exchReadmit 으로 재개). pending(Set)엔 그대로 남아 미해결.
          // 포기 발행(step-0132·abandonPublish) — 영구 미해결 give 를 svc.exchange.saga_abandoned 로 1회 발행(운영 가시화). OFF·bus 부재면 no-op(0131 비트 동일).
          // 포기 발행(step-0132·abandonPublish) — 영구 미해결 give 를 svc.exchange.saga_abandoned 로 1회 발행(운영 가시화). OFF·bus 부재면 no-op(0131 비트 동일).
          if (this.abandonPublish && this.bus) { this.net.send(this.addr, this.bus, { type: 'pub', topic: 'svc.exchange.saga_abandoned', ev: { gid, itemId: g.itemId, cause: g.cause } }); this.abandonPublished++; }
          continue;
        }
        this.retryCount.set(gid, c + 1);
      }
      this.net.send(this.addr, this.inv, { type: 'item_req', op: 'give', itemId: g.itemId, fromAvatar: g.from, toAvatar: g.to, replyTo: this.addr, cause: g.cause, gid });
      this.retries++;
    }
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
      this.pendingGive.set(gid, { itemId, from, to, cause });   // 재전송 소스(step-0126) — 회신 손실 시 exchRetry 가 같은 gid 로 재발신.
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
    this.gid = 0; this.pending = new Set(); this.pendingPeak = 0; this.pendingGive = new Map(); this.retries = 0; this.sagaDones = 0;   // 미해결 give 추적/재전송/유계화 리셋(step-0125~0127) — 새 프로세스는 in-flight give 이력 0(saga OFF 면 무관).
    this.retryCount = new Map(); this.giveAbandoned = 0; this.abandonPublished = 0; this.abandonedGive = new Map(); this.readmitted = 0; this.readmitPublished = 0; this.readmitCount = new Map(); this.permFailed = 0;   // 재시도 상한/포기 발행/재admission/발행/횟수 상한 리셋(step-0131·0132·0134·0135·0137) — 새 프로세스는 재시도 이력 0(sagaMaxRetries 0 면 무관).
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
  // saga 회계 정합 불변(step-0128·단언용 읽기 accessor) — ① 보낸 give 는 acked 또는 pending(새는 give 0) ② 받은 회신은 ok 또는 fail(분류 누락 0). 모든 체제(정상·손실·재전송)서 성립.
  sagaConsistent() { return this.gives === this.ackedGives + this.pending.size && this.ackedGives === this.giveOks + this.giveFails; }
  // 거래소가 escrow 에 들고 있다고 *믿는* open 매물의 itemId 집합(step-0120·2-서비스 보존 단언용 읽기 accessor·정렬). itemId 없는(추상 escrow) 매물은 제외.
  escrowItemIds() { return [...this.listings.values()].map(l => l.itemId).filter(x => x != null).sort(); }
}

const __part = { ExchangeService };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).svc_exchange_core = __part;
