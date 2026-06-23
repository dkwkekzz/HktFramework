'use strict';
// step-0130 — escrowXfers 계측: escrow custody 가 관여한 transfer(from/to 중 'escrow') 수. 거래소 giveOks 와 교차 정합(두 서비스 회계 합치 capstone). escrow give 부재면 0 = 0129 비트 동일.
// step-0054 — lease 생애 관측(busLeaseAudit) 플래그 추가 — 축출/재admission 을 svc.item.lease 버스 이벤트로 발행(코디네이션 관측). InventoryService *원장 코어*(생성자 + _own/_unown + crash + 조회).
//   write-behind 영속은 svc-inventory-persist.js, 버스 결과/replay 는 svc-inventory-bus.js 가 프로토타입 증강(Object.assign).
//   진입점 svc-inventory.js 가 셋을 묶어 동일 export(InventoryService) 노출 — 분할은 *파일 구조*만(바이트·동작 불변·reg 0).
// dual-mode: Node require / 브라우저는 common.js 를 <script> 선행 로드(전역 __HktNetCommon).
const __c = (typeof module !== 'undefined' && module.exports && typeof require !== 'undefined')
  ? require('./common.js') : globalThis.__HktNetCommon;
const { Net, LoginServer, SessionRegistry, mulberry32, fnv1a, DEFAULTS } = __c;


// ── [게임 서비스] InventoryService — 아이템 원장(가방). 존 tick 밖 *순수 반응형*(onTick 없음 = 신성한 tick 밖). ──
//   원장 = itemId→owner 의 *함수*(Map) → 구조적 소유자=1·dupe 불가. byOwner = 역인덱스(소유자→itemId 집합) — 트랜잭션
//   정합 교차검증(원장 ≡ byOwner). 이동(give) = sender release + receiver acquire 를 *한 onMsg 안에 원자적*(쌍 거래).
//   itemId = 전역 mint 카운터(아바타 비-인코딩 → 은닉). 재적용(전송 redundancy/dedup)에도 idempotent — 옮긴 아이템은
//   owner≠from 이라 두 번째 give 는 실패(중복 이동 0). 자기 자신/미소유/미존재 give 는 실패(phantom 0).
class InventoryService {
  constructor(opts = {}) {
    this.gateway = opts.gateway || 'gateway';
    this.bus = opts.bus || null;  // 이벤트 버스 주소(null = 0015 직접 라우팅 비트 동일 — 버스 ON 이면 gateway 주소 미사용)
    this.persist = opts.persist || null;  // 영속 스토어 주소(null = 0016 비트 동일 — write-behind 저널 OFF). 가방 자기 데이터 스토어 명시 인터페이스.
    this.persistBackup = opts.persistBackup || null;  // 보조 영속 스토어 주소(0027·persistBackup) — _journal 이중쓰기 대상. null = 0026 비트 동일(단일 persist).
    this.replicas = opts.replicas || [];  // N-replica 영속 스토어 주소 목록(0028·persistReplicas) — _journal 이 primary + 이 목록 전부에 fan-out. [] = 0027 비트 동일(N-replica 휴면). persistBackup 과 상호배타(토폴로지가 둘 중 하나만 와이어).
    this.quorumW = opts.quorumW || 0;     // 쓰기 정족수(이 step·quorumW) — 저널이 W개 스토어에 ack 되면 그 seq 를 durable 선언. >0 이면 _journal 이 q:true 로 ack 요청, 스토어가 회신. 0 = 0028 비트 동일(ack 0·낙관 fire-and-forget).
    this.ackSeqs = new Map();             // seq -> Set<storeAddr> — durable ack 한 스토어 집합(0029). size≥quorumW 면 그 seq durable.
    this.durableSeq = -1;                 // 커밋 워터마크(0029) — [0..durableSeq] 전 seq 가 ≥W ack(연속). 윈도 = (journalSeq-1) - durableSeq = 아직 정족수 미확인(정합성 윈도 가시화).
    this.quorumAcks = 0;                  // 수신한 journal_ack 누적(0029·계측)
    this.windowFill = opts.windowFill || false;  // 정합성 윈도 *해소*(0031·windowFill) — ON 이면 durableSeq 위 윈도(0<ack<W) seq 를 아직 ack 안 한 스토어에 주기적 재-fan-out → 정족수 채워 durable 로 전환. OFF = 0029 비트 동일(윈도 *감지*만·전환 0).
    this.wfPeriod = opts.wfPeriod || 4;          // 윈도 해소 sweep 주기(0031·제어 평면 결정론 상수·seed 무관·tick 동기 아님). ≥3 이라 직전 sweep fill 의 ack 가 다음 sweep 전에 기록(round-trip 2 tick < period → 이중 발신 0).
    this.wfWindow = opts.wfWindow || 0;          // 윈도 해소 sweep *유계 범위*(이 step·wfWindow) — sweep 이 매 tick [durableSeq+1 .. durableSeq+wfWindow] 만 훑는다(미끄러지는 유계 창 → per-sweep O(K) 비용 상한). durableSeq 가 전진하며 창이 따라 미끄러져 전체 윈도를 결국 덮는다. 0 = 무계(0031 비트 동일 — journalSeq-1 까지).
    this.windowFills = 0;                 // 윈도 해소로 재발신한 저널 누적(0031·계측 — ON 이면 >0·OFF 면 0). fill 손실 retry(이 step) 시 재시도분만큼 증가.
    this.snapInterval = opts.snapshot || 0;  // 스냅샷 압축 주기(0018) — 저널 N항목마다 원장 스냅샷 발신(0 = 0017 비트 동일·압축 휴면).
    this.reliable = opts.reliable || false;  // 저널 홉 신뢰 전달(0023) — ON 이면 보낸 저널을 sentBuffer 에 보관하고 persist NAK 에 재전송(0008 ack/NAK 의 저널 홉 판). OFF = 0022 fire-and-forget 비트 동일.
    this.journalHb = opts.journalHb || false;  // 저널 홉 *tail* 손실 감지(이 step) — ON 이면 주기적 heartbeat 로 persist 에 maxSentSeq 통보 → persist 가 maxRecvSeq *위*의 tail 갭도 NAK 가능(0023 NAK-only 의 §9 사각 해소). reliable 위에 올라탐. OFF = 0023 비트 동일(heartbeat 0).
    this.hbPeriod = opts.hbPeriod || 8;        // heartbeat 주기(제어 평면 결정론 상수 — seed 무관·tick 동기 아님). t % hbPeriod == 0 에 통보.
    this.ledger = new Map();      // itemId -> ownerAvatar (단일 진실 — 매 시점 소유자 정확히 1)
    this.byOwner = new Map();     // ownerAvatar -> Set<itemId> (역인덱스 — 트랜잭션 정합 교차검증)
    this.mintTotal = 0;           // 전역 mint 카운터(결정론 itemId)
    this.journalSeq = 0;          // 저널 항목 시퀀스(영속 효과 로그의 단조 순번 — replay 멱등·순서 보존)
    this.sentBuffer = new Map();  // seq -> 보낸 저널 항목(0023·reliable 일 때만 채움) — persist NAK 시 재전송 소스(미-ack 보존). 압축/bound 는 후속.
    this.resends = 0;             // NAK 에 응답해 재전송한 저널 항목 누적(0023·계측)
    this.journalHbs = 0;          // 보낸 저널 heartbeat 수(0024·journalHb·계측)
    // ── 버스 failover *결과 경로* 무손실(이 step·busResend) — 0034 의 §9(요청/결과 경로 in-flight 드롭=at-most-once) 해소. ──
    //   0034 busfail 은 routing 복구(재구독)만 했다 — crash gap 에 떨군 svc.item.out *결과*(원장엔 적용됐으나 클라 미수신)는 영구 손실(클라 belief 가 원장보다 뒤처짐 = itemDesync).
    //   producer replay(0023 홉 신뢰·0025 give-resend 의 *버스 판*): 발신한 결과를 보관했다가 버스 복구 시 재발행 → 뒤처진 클라가 따라잡음. 버스는 *살아 돌아온* 새 박스(영속 0)라
    //   gap 의 떨군 메시지를 못 메운다 → 진실 원천(producer=가방)이 재발행해야 한다. 클라 belief 는 Set 갱신이라 *멱등*(재배달 무해) → consumer dedup 불요.
    this.busResend = opts.busResend || false;  // ON 이면 발신 결과를 outBuffer 에 보관·버스 복구 시 재발행. OFF = 0035 비트 동일(보관 0·재발행 0).
    this.outBuffer = [];          // 발신한 svc.item.out 결과 페이로드(busResend 일 때만) — 버스 복구 재발행 소스. busWindow>0 이면 최근 K 개로 슬라이딩(유계·이 step).
    this.outResends = 0;          // 버스 복구 시 재발행한 결과 수(0036·계측)
    // ── 유계 replay 버퍼(이 step·busWindow) — outBuffer(0036)·게이트웨이 inBuffer(0037)의 *무계 성장* 해소(0032 wfWindow 의 버스 판). ──
    //   0036 outBuffer 는 발신한 *전* 결과를 무계로 쌓는다 → 장기 가동 시 메모리 무한 성장. failover 가 메우는 건 gap 구간 결과뿐이므로 그 창을 덮을 만큼만 보관하면 된다.
    //   busWindow=K 면 *최근 K 개*만(미끄러지는 유계 창) → 메모리 O(K) 상한. gap 결과는 재구독 시점 최근 항목이라 K≥|gap 결과| 이면 무손실 유지. K<gap 이면 손실 재현.
    this.busWindow = opts.busWindow || 0;  // outBuffer 유계 창 크기 K(이 step). 0 = 무계(0038 동일). >0 = 최근 K 개만(슬라이딩).
    // ── 버스 failover *요청 경로* 무손실의 가방 측(이 step·busResendReq) — 게이트웨이 요청 재발행의 멱등 수신. ──
    //   게이트웨이가 버스 복구 시 보관 요청을 재발행하면 gap *전* 도달한 요청도 함께 온다 → pickup 은 매번 새 itemId 를 mint 하므로
    //   dedup 없이는 이중 mint(dupe). 요청에 실린 producer-local reqId 를 seenReqs 에 기록해 *최초 1회만* 처리(0023 persist recvSeqs 의 요청 홉 판).
    //   give/reconcile 는 자체 멱등(owner/ledger 체크)이나 일관성 위해 같은 dedup 경로. OFF(reqId 없음)면 분기 휴면 = 0036 비트 동일.
    this.busResendReq = opts.busResendReq || false;  // ON 이면 reqId 실린 요청을 dedup(seenReqs). OFF = 0036 비트 동일(dedup 0).
    this.seenReqs = new Set();    // 처리한 요청 dedup 키(busResendReq ON·reqId 실릴 때만) — 재발행 중복 멱등 폐기(pickup 이중 mint 0). 키=reqId(단일 네임스페이스) 또는 (producer,reqId) 복합(이 step).
    // ── 다중 게이트웨이 producer 네임스페이스(이 step·busProducerNs) — 0042 §9 ① 해소. ──
    //   0037 reqId 는 *producer-local* 단조 카운터다(게이트웨이마다 0,1,2…). 단일 게이트웨이면 충분하나, SPINE 의 "게이트웨이 군"처럼 *다중* 게이트웨이가 같은 가방에 발신하면
    //   reqId 네임스페이스가 겹친다(gw1 reqId k vs gw2 reqId k) → 단일 네임스페이스 seenReqs 는 gw2 의 k 를 gw1 의 *이미 처리한 k* 로 오인해 폐기(둘째 producer 요청 손실).
    //   해법: dedup 키를 (producer, reqId) 복합키로 → 같은 reqId 라도 producer 다르면 별개. 가방은 버스 너머라 발신 게이트웨이를 구별 못 하므로(은닉) 요청에 실린 producer 태그가 유일한 네임스페이스 신호.
    //   busProducerNs OFF(또는 producer 미태깅·단일 게이트웨이)면 키=bare reqId = 0045 비트 동일(복합키 미사용). 0044 의 *소비자* min-워터마크의 *producer 측* 거울.
    this.busProducerNs = opts.busProducerNs || false;
    // ── per-producer seen 워터마크(이 step·busSeenNs) — 0046 §9/리뷰 §1 해소. ──
    //   0046 복합키(producer reqId·문자열) + 0042 단일-네임스페이스 숫자 prune(`r<=upTo`)은 `'gw 5'<=5`=false(NaN) → 복합키가 영영 안 가지쳐져 busSeenBound 가 무력(무계 회귀). busSeenNs ON 이면 producer 별 워터마크로 복합키를 가지친다.
    this.busSeenNs = opts.busSeenNs || false;
    this.producerSeenWm = new Map();   // producer id -> 그 producer 의 seen prune 워터마크(단조). 복합키 가지치기 기준. busSeenNs ON 일 때만.
    // ── seenReqs 유계화(0042·busSeenBound) — 게이트웨이 prune 워터마크(svc.item.seen)로 dedup 집합 가지치기(0040/0041 §9 해소). ──
    //   게이트웨이가 inAcked(=inBuffer prune 프런티어)를 통보 → 그 이하 reqId 는 영영 재발행 0 → seenReqs 에서 안전히 제거(미-재출현이라 dupe 보존). busAck 의 역방향 워터마크.
    this.busSeenBound = opts.busSeenBound || false;  // ON 이면 svc.item.seen 수신 시 seenReqs 가지치기. OFF = 0041 비트 동일(가지치기 0·무계).
    this.seenWatermark = -1;      // seen prune 워터마크 — 이 reqId 이하 dedup 상태는 잊음(단조)
    this.seenReqsPeak = 0;        // seenReqs 최대 크기(계측) — 유계화 증거(bound 면 ≈in-flight·무계면 ∝처리 수)
    this.seenPruned = 0;          // 워터마크로 가지친 reqId 누적(이 step·계측)
    // ── 요청 ack(0040·busAck) — 게이트웨이 inBuffer 자기-크기조정의 소비자 측. 받은 reqId 를 svc.item.ack 로 통보(처리 확인). ──
    //   dedup 으로 폐기하는 재발행분도 *ack 는 보낸다* — 그래야 ack 손실로 안 지워진 inBuffer 항목이 재발행→재-ack 되어 끝내 가지쳐진다(수렴).
    this.busAck = opts.busAck || false;  // ON 이면 svc.item 수신마다 svc.item.ack{reqId} 발행. OFF = 0039 비트 동일(ack 발행 0).
    this.acksSent = 0;            // 발행한 요청 ack 누적(0040·계측)
    // ── 결과 replay 버퍼 *자기-크기조정*(이 step·busOutAck) — 0040 요청 버퍼 ack-가지치기의 *결과 경로 거울*(0040 §9 해소). ──
    //   0039 고정 K(busWindow)는 outBuffer 도 *최대 예상 gap* 사전 추정이 필요했다(작으면 결과 손실→desync·크면 낭비). 0040 은 그 §9 를 *요청* 경로(inBuffer)에서 ack 로 풀었고
    //   이 step 은 *결과* 경로(outBuffer)에서 같은 원리로 푼다: 결과의 소비자(게이트웨이)가 *중계한 outSeq* 를 svc.item.out.ack 로 통보 → 가방이 ack 워터마크 이하 outBuffer 를
    //   가지친다. 버퍼엔 *미-ack(클라 미반영 가능)* 결과만 남는다(자기-크기조정). 정상 구간엔 ack 가 흘러 0 으로 drain·gap 구간엔 ack 끊겨 자동 성장 → 복구 resendOut 이 그만큼 덮어 K 추정 없이 무손실.
    //   busOutAck OFF 면 outSeq 미부여·가지치기 0 = 0040 비트 동일(reg). busResend 전제(outBuffer·outSeq 필요) — busWindow 와 상호배타로 씀(둘 다 outBuffer 바운드).
    this.busOutAck = opts.busOutAck || false;  // ON 이면 결과에 outSeq 태깅 + svc.item.out.ack 수신 시 outBuffer 가지치기. OFF = 0040 비트 동일(태깅 0·가지치기 0).
    this.outSeq = 0;             // 결과 producer-local 단조 순번(busOutAck ON 일 때만 부여) — ack 워터마크/가지치기 기준
    this.outAcked = -1;          // 결과 ack 워터마크 — 이 outSeq 이하 결과는 게이트웨이가 중계 확인(단조). outBuffer 가지치기 기준.
    this.outBufPeak = 0;         // outBuffer 최대 길이(계측) — 자기-크기조정 유계 증거(ack 면 ≈in-flight·고정/무계면 K/무한)
    this.outPruned = 0;          // ack 로 가지친 결과 누적(0041·계측)
    // ── 다중 소비자 min-워터마크(이 step·busMinWm) — 0041 busOutAck 의 §9 ① 해소. ──
    //   0041 결과 ack 는 *게이트웨이 단일* 소비자에 키잉됐다 — svc.item.out 의 둘째 소비자(ranking)가 게이트웨이보다 뒤처지면 outBuffer 를 *너무 일찍* 가지칠 위험(starve).
    //   N-소비자 일반화: 각 소비자가 자기 frontier(중계/소비 확인 outSeq)를 svc.item.out.ack{outSeq,consumer} 로 통보 → 가방이 *모든 기대 소비자 워터마크의 최소(min)* 까지만 가지친다.
    //   → 가장 뒤처진 소비자도 안전(미-ack 결과 보존) → 비대칭 복구(늦은 재구독)에도 그 소비자가 replay 로 따라잡는다. busMinWm OFF 면 단일 워터마크(outAcked·0043 비트 동일). busOutAck 전제.
    this.busMinWm = opts.busMinWm || false;
    this.outConsumers = opts.outConsumers || [];   // 기대 결과 소비자 id 목록(예: ['gateway','ranking']) — min 의 정의역. busMinWm ON 일 때만 비어있지 않음.
    this.consumerWm = new Map();   // consumer id -> 그 소비자의 ack 워터마크(최대 확인 outSeq·단조). min 계산의 입력.
    // ── 소비자 lease/축출(이 step·busConsumerLease) — 0044 min-워터마크의 §9 *영구 뒤처진 소비자* 대가 해소. ──
    //   min-워터마크는 *모든* 기대 소비자 frontier 의 최소까지만 가지치므로, 한 소비자가 *영영* ack 를 멈추면(crash·영구 다운) 그 frontier 에 min 이 고정돼 outBuffer 가 무계 성장한다
    //   (자기-크기조정이 *가장 느린* 소비자에 묶임 — 0044 §9). lease: 생산자 frontier(최신 부여 outSeq)보다 leaseSpan 이상 뒤처진 소비자를 *죽은 것*으로 보고 min 정의역에서 축출 → min 이 산 소비자만으로 전진 → 버퍼 drain.
    //   liveness 신호 = *침묵 길이*(content lag 아님): 각 소비자가 ack 한 *시점의 생산자 frontier*(consumerSeen)를 기록 → 그 뒤 frontier 가 leaseSpan 이상 전진하도록 *다시 ack 안 하면* 죽은 것.
    //   content lag(frontier−consumerWm)은 생산 버스트에 산 소비자도 일시로 커져 오축출한다 — 침묵 신호는 ack 사건 자체가 갱신하므로 산(계속 ack)/죽음(ack 끊김)을 정확히 가른다.
    //   leaseSpan 은 정상 ack 간격(침묵)보다 커야 한다 — 작으면 일시 지연을 오축출. 영구-죽음 vs 일시-지연의 분리는 이 임계가 진다(정직한 한계·§9). ack 이력 없는(undefined) 소비자는 아직 미확립이라 축출 정의역 밖.
    //   busConsumerLease OFF 면 evicted 항상 비어 0044 비트 동일(축출 0·min 정의역 무변경). busMinWm 전제(단일 워터마크엔 정의역 개념 없음).
    this.busConsumerLease = opts.busConsumerLease || false;
    this.leaseSpan = opts.leaseSpan || 0;   // ack 시점 이후 생산자 frontier 가 이만큼 전진하도록 *재-ack 없으면* 죽은 것으로 간주(축출). 0 = 축출 없음(0044 동일).
    this.evicted = new Set();               // 축출된 죽은 소비자 id — min 정의역에서 제외. crash 시 리셋.
    this.evictions = 0;                     // 축출 누적(계측) — lease 가 죽은 소비자를 정의역에서 떨군 횟수.
    this.consumerSeen = new Map();          // consumer id -> 그 소비자가 마지막 ack 한 *시점의 생산자 frontier*(침묵 측정 기준). content 워터마크(consumerWm)와 별개.
    // ── 소비자 lease *lifecycle 정합*(이 step·busLeaseLife) — 0045 lease 의 두 빈틈(코드리뷰 §2/§3) 해소. ──
    //   ⒜ §2 *시작-시점 죽음*: 0045 는 침묵 기준(consumerSeen)을 *그 소비자가 처음 ack 한 시점*에야 세운다 → 한 번도 ack 안 한 소비자(구독했지만 영영 죽음)는 consumerSeen 미확립 → 축출 정의역 밖 = 영영 안 축출.
    //      게다가 consumerWm 미확립이면 min 계산에서 -1 → min 이 -1 에 고정 → outBuffer 무계 성장(축출도 못 함). 해법: busLeaseLife ON 이면 sweep 가 *처음 본* 미-ack 소비자에 침묵 기준을 그때의 frontier 로 깔고(leaseSpan grace) → 다음 sweep 부터 측정 → 영영-죽음이면 leaseSpan 뒤 축출.
    //      *지연(lazy)* 확립이라 산 소비자가 첫 ack 을 leaseSpan 안에 보내면 오축출 0(구성-시점 -1 baseline 은 시작 ack 지연이 leaseSpan 을 넘으면 건강한 소비자도 오축출 → 채택 안 함).
    //   ⒝ §3 *축출 비가역*: 0045 는 evicted 에 한 번 들면 영영 빠지지 못한다 → 축출된 소비자가 *돌아와(재구독·재-ack)* 도 min 정의역에 복귀 못 함 → 그 소비자가 필요로 하는 *이후* 결과가 보존 안 됨(starve 재발). 해법: 축출된 소비자가 다시 ack 하면 evicted 에서 제거(재admission) → min 정의역 복귀 → 이후 결과 보존.
    //   busLeaseLife OFF 면 ⒜ 지연 baseline 미확립(consumerSeen 은 0045 처럼 ack 때만)·⒝ 재admission 0 → 0047 비트 동일(evicted 동작 무변경). busConsumerLease·busMinWm 전제.
    this.busLeaseLife = opts.busLeaseLife || false;
    this.readmissions = 0;                  // 재admission 누적(계측·이 step) — 축출됐던 소비자가 돌아와 min 정의역에 복귀한 횟수.
    // ── 적응형 leaseSpan(step-0050·busLeaseAdapt) — 0048/0049 lease 의 *정직한 한계* 해소(고정 leaseSpan 의 영구-죽음 vs 일시-지연 분리·svc-inventory-core.js §lease·0048 verify §9). ──
    //   문제: 고정 leaseSpan 은 *정상 ack 간격(침묵)보다 커야* 산 소비자를 안 쫓는다 — 그 간격은 생산율×소비자 cadence 의 함수라 *사전에 모른다*. 너무 작으면 산 소비자 오축출(leaseSpan≤5 에서 live ranking 축출 재현), 너무 크면 죽은 소비자 늦게 감지.
    //   해법: 임계를 *관측된 cadence* 로 self-size. 소비자 c 가 ack 할 때마다 그 직전 침묵(frontier−consumerSeen = c 가 *살아서* 견딘 ack 간격)을 보고 per-c 러닝 최대(consumerMaxGap)를 키운다. 축출 임계 = consumerMaxGap(c) + leaseSpan(이제 *여유 마진*).
    //   → 산 소비자: 침묵이 자기 관측 cadence 를 마진만큼만 넘지 않으면 오축출 0(임계가 cadence 를 따라 올라감). 죽은 소비자: ack 끊김 → consumerMaxGap 동결 → 침묵이 동결값+마진 초과 → 여전히 축출(죽음 감지 보존·유계).
    //   leaseSpan 의 의미 전환: 고정-임계(OFF) → 관측 cadence 위의 *마진*(ON). 사전에 cadence 를 몰라도 된다(0048 §9 의 "임계를 사람이 맞춰야" 해소). busLeaseAdapt OFF 면 consumerMaxGap 미사용 = 0049 비트 동일(고정 leaseSpan 예측). busConsumerLease 전제.
    this.busLeaseAdapt = opts.busLeaseAdapt || false;
    this.consumerMaxGap = new Map();        // consumer id -> 그 소비자가 *살아서 ack 하며* 보인 최대 침묵(frontier 단위·단조 증가). 적응형 축출 임계의 cadence 추정.
    // 시작 cadence prior(step-0051·busLeaseGrace) — 0050 §9 "bootstrap 1회 오축출" 해소. cadence G 를 학습하려면 G-침묵을 ack 으로 끝낸 사건을 1회 관측해야 하는데, 그 첫 침묵 동안엔 prior 가 없어 임계<G → 산 소비자 1회 오축출. prior 로 임계 바닥(floor)을 깔아 첫 침묵도 흡수(임계=max(관측,prior)+마진). 로직은 svc-inventory-bus.js _onOutAck 임계. OFF/prior 0 = 0050 비트 동일.
    this.busLeaseGrace = opts.busLeaseGrace || false;
    this.cadencePrior = opts.cadencePrior || 0;   // 시작 cadence 추정 바닥. 관측 cadence(consumerMaxGap)가 이보다 작은 bootstrap 구간에만 작동(이후 관측이 이김). 죽은 소비자도 임계=prior+마진 유계라 여전히 축출.
    // ── 윈도 cadence(step-0052·busCadenceWindow) — 0050 §9 "consumerMaxGap 단조 증가(감쇠 없음)" 해소. 로직은 svc-inventory-bus.js _onOutAck. ──
    //   단조 max(0050)는 한 번 본 큰 침묵을 영영 안 내린다 → 소비자가 빨라지면(cadence↓) 임계 과대 동결 → 죽음 늦게 감지. 윈도: cadence 추정 = 최근 K gap 의 max → 옛 큰 gap 이 창 밖으로 늙어 추정 감쇠. *grace prior 바닥*(0051) 위에서만 안전 — prior 없는 윈도는 eviction flapping 에 추정이 0 으로 붕괴(0051 §9). busCadenceWindow OFF(또는 K=0)면 전체 max(0051 비트 동일).
    this.busCadenceWindow = opts.busCadenceWindow || false;
    this.cadenceWindow = opts.cadenceWindow || 0;   // 최근 gap 창 크기 K(0=전체 max). ON 이려면 >0(+grace prior 권장).
    this.consumerGaps = new Map();          // consumer id -> 최근 관측 gap 배열(길이≤K). busCadenceWindow ON 일 때만. consumerMaxGap = 이 창의 max.
    // lease 생애 관측(step-0054·busLeaseAudit) — 0045~0050 소비자 lease 의 축출/재admission 은 *내부 계측*(evictions/readmissions)일 뿐 버스 밖에서 안 보인다. 코디네이션 계층(오케스트레이터)이 소비자 건강을 알려면 lease 전이가 관측 가능해야 한다(은닉·버스 pub/sub 원칙). ON 이면 축출/복귀 시 svc.item.lease 토픽에 이벤트 발행(audit/오케스트레이터가 구독). 발행 단일 경로·존 tick 밖. OFF 면 발행 0(0053 비트 동일). busConsumerLease 전제.
    this.busLeaseAudit = opts.busLeaseAudit || false;
    // ── saga give idempotent dedup(step-0126·sagaDedup) — 거래소↔가방 saga 회신 재전송의 *재실행 0* 보장. ──
    //   회신만 손실된 give(가방서 이미 성공)를 거래소가 재전송하면, dedup 없이는 owner≠from 으로 재실행 실패(ok:false)→거래소 오보상(valid 매물 abort). dedup ON 이면 (replyTo,gid)로 *원래 결과*를 재실행 없이 재회신.
    //   0042 seenReqs(pickup 이중 mint 방지)의 saga 회신 판 — 키=(replyTo,gid)·값=ok. OFF 면 저장 0·dedup 0 = 0125 비트 동일.
    this.sagaDedup = opts.sagaDedup || false;
    this.sagaResults = new Map();   // (replyTo gid) -> ok(boolean) — 처리한 saga give 결과(재전송 시 재회신 소스). sagaDedup ON 일 때만. 유계화는 0127 saga_done.
    this.escrowXfers = 0;           // escrow custody 가 관여한 transfer 수(step-0130) — from/to 중 하나가 'escrow' 인 성공 give. 거래소 giveOks 와 *교차 정합*(두 서비스 회계 합치 capstone). 일반 클라 give 는 비-증가.
    this.minted = 0; this.transfers = 0; this.failedOps = 0;
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

const __part = { InventoryService };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).svc_inventory_core = __part;
