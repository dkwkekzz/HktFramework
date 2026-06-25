'use strict';
// step-0130 — escrowXfers 계측: escrow custody 가 관여한 transfer(from/to 중 'escrow') 수. 거래소 giveOks 와 교차 정합(두 서비스 회계 합치 capstone). escrow give 부재면 0 = 0129 비트 동일.
// step-0054 — lease 생애 관측(busLeaseAudit) 플래그 추가 — 축출/재admission 을 svc.item.lease 버스 이벤트로 발행(코디네이션 관측). InventoryService *원장 코어*(생성자 + _own/_unown + crash + 조회).
//   write-behind 영속은 svc-inventory-persist.js, 버스 결과/replay 는 svc-inventory-bus.js 가 프로토타입 증강(Object.assign).
//   진입점 svc-inventory.js 가 셋을 묶어 동일 export(InventoryService) 노출 — 분할은 *파일 구조*만(바이트·동작 불변·reg 0).
// dual-mode: Node require / 브라우저는 common.js 를 <script> 선행 로드(전역 __HktNetCommon).
const __c = (typeof module !== 'undefined' && module.exports && typeof require !== 'undefined')
  ? require('./common.js') : globalThis.__HktNetCommon;
const { Net, LoginServer, SessionRegistry, mulberry32, fnv1a, DEFAULTS } = __c;
// step-0266 분할 — 생성자 필드 초기화 메서드 믹스인(_init).
const { InventoryInit } = (typeof module !== 'undefined' && module.exports && typeof require !== 'undefined')
  ? require('./svc-inventory-init.js') : globalThis.__HktNetParts.svc_inventory_init;


// ── [게임 서비스] InventoryService — 아이템 원장(가방). 존 tick 밖 *순수 반응형*(onTick 없음 = 신성한 tick 밖). ──
//   원장 = itemId→owner 의 *함수*(Map) → 구조적 소유자=1·dupe 불가. byOwner = 역인덱스(소유자→itemId 집합) — 트랜잭션
//   정합 교차검증(원장 ≡ byOwner). 이동(give) = sender release + receiver acquire 를 *한 onMsg 안에 원자적*(쌍 거래).
//   itemId = 전역 mint 카운터(아바타 비-인코딩 → 은닉). 재적용(전송 redundancy/dedup)에도 idempotent — 옮긴 아이템은
//   owner≠from 이라 두 번째 give 는 실패(중복 이동 0). 자기 자신/미소유/미존재 give 는 실패(phantom 0).
class InventoryService {
  constructor(opts = {}) {
    this._init(opts);   // step-0266 분할 — 필드 초기화를 svc-inventory-init 믹스인(_init)으로 위임(verbatim·reg 0).
  }
  _own(owner, itemId) { if (!this.byOwner.has(owner)) this.byOwner.set(owner, new Set()); this.byOwner.get(owner).add(itemId); }
  _unown(owner, itemId) { const s = this.byOwner.get(owner); if (s) s.delete(itemId); }
  // crash — 프로세스 사망(RAM 소실)의 인프로세스 모델: 원장·역인덱스·카운터 전부 비운다. PersistStore 는 *별 박스*라 무관.
  crash() {
    this.ledger = new Map(); this.byOwner = new Map();
    this.mintTotal = 0; this.journalSeq = 0;
    this.sentBuffer = new Map(); this.resends = 0; this.journalHbs = 0;   // 신뢰 전달(0023) — 새 프로세스는 미-ack 버퍼 0(죽기 전 in-flight 는 소실 = §9 write-behind 윈도 잔존). heartbeat 계측도 리셋.
    this.ackSeqs = new Map(); this.durableSeq = -1; this.quorumAcks = 0; this.windowFills = 0;   // 쓰기 정족수·윈도 해소 상태 리셋(0029~0031) — 새 프로세스는 ack 집계/fill 계측 0(복구 후 다시 쌓임). quorumW 0 면 무관.
    this.outBuffer = []; this.outResends = 0;   // 버스 failover 결과 재발행 버퍼 리셋(0036) — 가방 crash 는 결과 버퍼도 소실(RAM). busResend OFF 면 무관.
    this.seenReqs = new Set();   // 요청 dedup 집합 리셋(0037) — 새 프로세스는 처리 이력 0(busResendReq OFF 면 무관).
    this.seenWatermark = -1;     // seen prune 워터마크 리셋(0042) — 새 생애는 dedup 이력 0 이라 워터마크도 초기화(busSeenBound OFF 면 무관).
    this.producerSeenWm = new Map();   // per-producer seen 워터마크 리셋(이 step) — 새 생애는 producer 별 prune 이력 0(busSeenNs OFF 면 무관).
    this.consumerWm = new Map(); // 다중 소비자 워터마크 리셋(0044) — 새 프로세스는 소비자 ack 이력 0(busMinWm OFF 면 무관·outConsumers 는 config 라 유지).
    this.evicted = new Set(); this.evictions = 0; this.consumerSeen = new Map();   // 축출·침묵 이력 리셋(0045) — 새 프로세스는 산 소비자 가정·정의역 복원(busConsumerLease OFF 면 무관·leaseSpan 은 config 라 유지).
    this.consumerGaps = new Map();   // 윈도 cadence 이력 리셋(0052) — 새 생애는 gap 창 0(busCadenceWindow OFF 면 빈 Map 무변경 = 비트 동일).
    this.readmissions = 0;   // 재admission 이력 리셋(이 step) — 새 프로세스는 복귀 이력 0(busLeaseLife OFF 면 무관). §2 지연 baseline 은 sweep 가 다시 깐다(상태 불요).
    this.sagaResults = new Map();   // saga give dedup 이력 리셋(step-0126) — 새 프로세스는 처리 이력 0(sagaDedup OFF 면 빈 Map 무변경).
    this.escrowXfers = 0;           // escrow transfer 계측 리셋(step-0130) — 새 프로세스는 0(escrow give 부재면 무관).
    this.minted = 0; this.transfers = 0; this.failedOps = 0;
  }
  itemCount() { return this.ledger.size; }
  ownerOf(itemId) { return this.ledger.get(itemId); }
}

// step-0266 분할 — 필드 초기화 메서드(_init)를 프로토타입에 되섞음(생성자가 호출·this 바인딩 동일·reg 0).
Object.assign(InventoryService.prototype, InventoryInit);

const __part = { InventoryService };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).svc_inventory_core = __part;
