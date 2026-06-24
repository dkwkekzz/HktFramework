'use strict';
// step-0048 분할 preamble — 박스 1개=파일 1개 (CLAUDE.md 임계 규칙). 진입점 topology.js 가 묶는다.
// step-0133 정리 분할: topo-build.js 가 33KB>30KB 박스 트리거를 다시 넘겨, *버스 구독 테이블 빌더*(buildSubs)를 topo-subs.js 로 분리한다(기능 0·verbatim·reg 0 — 33.1→25.5KB).
// step-0098 정리 분할: topo-build.js 가 32KB>30KB 박스 트리거를 넘겨, *액터 팩토리 + 라우트 필터*(makeActor·routeFilters·박스 클래스 import)를
//   topo-actors.js 로 분리한다. 이 파일은 *선언적 spec 빌더*(buildTopology) + 진입점으로 남고, topo-actors 를 require 해 동일 export 를 노출한다 —
//   기능 0·verbatim 이동·export 집합 불변 → reg 0. 0030 net-core·0035 cluster·0038 topology 분할의 topo-build 판.
// dual-mode: Node 는 부품을 require, 브라우저는 <script> 선행 로드(전역 __HktNetParts.topo_actors). buildTopology 는 외부 의존 0(opts 만).
const __isNode = typeof module !== 'undefined' && module.exports && typeof require !== 'undefined';
const { routeFilters, makeActor } = __isNode ? require('./topo-actors.js') : globalThis.__HktNetParts.topo_actors;
const { buildSubs } = __isNode ? require('./topo-subs.js') : globalThis.__HktNetParts.topo_subs;   // step-0133 분할 — 버스 구독 테이블 빌더.

// ════════════════════════════════════════════════════════════════════════
//  토폴로지 빌더 — 인프로세스/멀티프로세스가 *같은 단일 경로*로 액터를 구성(E2E 동치의 토대).
//   buildTopology(opts) → { specs:[{addr,kind,seed,opts}], order:[addr...] }.  0009 run() 의 배선을
//   *선언적 spec* 으로 옮겼다(생성자 opts 에 전 배선 포함 — 후처리 0). makeActor(spec, net) 가 spec → 액터.
//   같은 spec → 같은 액터(시드 의사난수만) → 프로세스가 갈려도 같은 초기 상태.
// ════════════════════════════════════════════════════════════════════════
function buildTopology(opts) {
  const {
    seed, clients = 6, moves = 30, radius = 4, grid = 16, zones = 2,
    incremental = true, recovery = false, leave = {},
    retxPeriod, heartbeat, resyncPeriod,
    failover = false, deathTick = null, leaseTimeout, killZone = 'zone1',
    inventory = false, itemOps = 0,
    chat = false, chatOps = 0, regions = 2,
    bus = false, audit = false,
    persist = false, snapshot = 0, journalReliable = false, journalHeartbeat = false,
    ranking = false,
    exchange = false,
    exchangePublish = false,
    exchangePersist = false,
    exchangeSnapshot = 0,
    cancelPublish = false,
    marketFeed = false,
    mail = false,
    mailSentPublish = false,
    mailReadPublish = false,
    mailExpirePublish = false,
    mailPersist = false,
    mailSnapshot = 0,
    mailTtl = 0,
    mailFeed = false,
    mailFeedRead = false,
    mailFeedExpire = false,
    mailItem = false,
    mailInv = false,
    mailSaga = false,
    mailAckDrop = null,
    mailAckDropAlways = null,
    mailAutoRetry = false,
    mailMaxRetries = 0,
    mailAbandonPublish = false,
    mailReadmitPublish = false,
    mailReadmitMax = 0,
    mailFailPublish = false,
    exchangeTtl = 0,
    expirePublish = false,
    exchInventory = false,
    exchSaga = false,
    exchCompensate = false,
    abortPublish = false,
    sagaDedup = false,
    sagaDedupBound = false,
    autoRetry = false,
    sagaMaxRetries = 0,
    abandonPublish = false,
    readmitPublish = false,
    autoReadmit = false,
    readmitMax = 0,
    failPublish = false,
    invUpPublish = false,
    chatpersist = false, chatSnapshot = 0,
    clientResend = false,
    mintRecon = false,
    persistBackup = false,
    persistReplicas = 0,
    quorumW = 0,
    windowFill = false,
    wfWindow = 0,
    busResend = false,
    busResendReq = false,
    busWindow = 0,
    busAck = false,
    busOutAck = false,
    busSeenBound = false,
    busMinWm = false,
    busConsumerLease = false,
    leaseSpan = 0,
    busLeaseLife = false,
    busLeaseAdapt = false,
    busLeaseGrace = false,
    cadencePrior = 0,
    busCadenceWindow = false,
    cadenceWindow = 0,
    busLeaseAudit = false,
    busLeasePresence = false,
    busPresenceRecover = false,
    presencePublish = false,
    spawnReplace = false,
    presenceMonitor = false,
    presenceBox = false,
    presenceReportBus = false,
    presenceShadow = false,
    presenceLease = false,
    hbTimeout = 3,
    presenceQuery = false,
    announceEpoch = false,
    presenceAnnounce = false,
    whisperRouter = false,
    whisperFailover = false,
    whisperRetry = false,
    partyService = false,
    whisperReceipt = false,
    mailbox2 = false,
    mailboxInboxBound = 0,
    mailboxDrainAck = false,
    mailboxCheckoutBound = 0,
    mailboxDrainedPublish = false,
    mailboxLossPublish = false,
    deliverRetry = false,
    deliverTimeout = 4,
    deliverDrop = 0,
    deliverMaxRetries = 0,
    deliverNotify = false,
    failedPublish = false,
    deliveredPublish = false,
    epochKeyed = false,
    partyReceipt = false,
    partyAckGiveup = false,
    partyIncompletePublish = false,
    partyCompletePublish = false,
    bouncePublish = false,
    partyChange = false,
    partyPersist = false,
    partySnapshot = 0,
    guildService = false,
    guildChangePublish = false,
    guildPersist = false,
    guildSnapshot = 0,
    guildFeed = false,
    guildFeedPersist = false,
    guildBank = false,
    guildBankPublish = false,
    guildBankFeed = false,
    instanceService = false,
    cacheService = false,
    cacheSource = null,
    worldLog = false,
    deliverDedup = false,
    deliverDedupBound = false,
    deliverEpochBound = false,
    deliverEpochGrace = 0,
    deliverAckDrop = 0,
    recoverRetry = false,
    recoverTimeout = 4,
    recoverMaxRetries = 0,
    dropRecover = 0,
    busProducerNs = false,
    busSeenNs = false,
  } = opts;
  const H = Math.floor(grid / 2);
  const accounts = [];
  for (let i = 0; i < clients; i++) accounts.push('hero' + i);
  const specs = [];
  const order = [];
  const add = (s) => { specs.push(s); order.push(s.addr); };

  // 등록(=onTick) 순서는 0009 와 *정확히* 일치해야 reg 0: login·registry·gateway·zone1·zone2·[orch·zone1f·zone2f]·client*
  add({ addr: 'login', kind: 'login', opts: { accounts, seed } });
  add({ addr: 'registry', kind: 'registry', opts: {} });

  const zoneAddrs = zones === 1 ? ['zone1'] : ['zone1', 'zone2'];
  const replicas = (failover && zones === 2) ? ['zone1f', 'zone2f'] : [];
  const inventoryAddr = inventory ? 'inventory' : null;
  const chatAddr = chat ? 'chat' : null;
  const busAddr = bus ? 'bus' : null;
  const persistAddr = (persist && inventory) ? 'persist' : null;   // 영속 = 가방 전제(가방 원장의 데이터 계층). persist OFF → 0016 비트 동일.
  const rankingAddr = (ranking && bus && inventory) ? 'ranking' : null;   // 랭킹 = bus+가방 전제(item 이벤트 소비). ranking OFF → 0018 비트 동일.
  // 대체 소비자(step-0061·spawnReplace) — ranking 의 *대기(standby)* 복제. presencePublish 전제(svc.presence 의 'permanent' 신호로 활성화). OFF → 0060 비트 동일(액터·구독 0).
  const replaceAddr = (spawnReplace && presencePublish && rankingAddr) ? 'ranking2' : null;
  // 전용 프레즌스 박스(step-0064·presenceBox) — orch 의 프레즌스 SSOT+발행을 인계하는 PresenceService. failover+발행 전제. OFF → 0063 비트 동일(박스 0·orch 직접).
  const presenceSvcAddr = (presenceBox && presencePublish && failover && zones === 2 && inventory) ? 'presence' : null;
  // 프레즌스 박스 shadow 복제(step-0066·presenceShadow) — *대기(standby)* PresenceService(presence2). 보고 버스화(0065·presenceReportBus) 전제: 같은 svc.presence.report 토픽을 구독해 SSOT 를 그림자 복제만 한다(active=false → 발행 억제). OFF → 0065 비트 동일(standby 0·단일 active 박스).
  const presenceShadowAddr = (presenceShadow && presenceSvcAddr && presenceReportBus) ? 'presence2' : null;
  const chatPersistAddr = (chatpersist && chat) ? 'chatpersist' : null;   // 채팅 영속(이 step) = 채팅 전제(채팅 커맨드 로그의 데이터 계층). OFF → 0020 비트 동일.
  const persistBackupAddr = (persistBackup && persistAddr) ? 'persist2' : null;   // 보조 영속(0027) = primary persist 전제. OFF → 0026 비트 동일(이중쓰기 0).
  // N-replica(이 step) — persistReplicas≥1 이면 'persist2'..'persistN+1' 복제 스토어 N개. primary 와 독립 인스턴스(범용 PersistStore 재사용).
  //   persistBackup(0027 단일 backup)과 상호배타: persistReplicas≥1 이면 그 경로를 대체(둘 다 'persist2' 를 쓰므로 충돌 방지). 둘 다 0 = 0027/0026 비트 동일.
  const persistReplicaAddrs = (persistReplicas >= 1 && persistAddr) ? Array.from({ length: persistReplicas }, (_, k) => 'persist' + (k + 2)) : [];
  // 버스 ON 이면 gateway 는 서비스 *주소를 모른다*(inventoryAddr/chatAddr = null — 토픽만) = 직접 결합의 구조적 제거.
  add({ addr: 'gateway', kind: 'gateway', opts: { zoneAddrs, replicas, inventoryAddr: busAddr ? null : inventoryAddr, chatAddr: busAddr ? null : chatAddr, busAddr, busResendReq: busAddr ? busResendReq : false, busWindow: busAddr ? busWindow : 0, busAck: busAddr ? busAck : false, busOutAck: busAddr ? busOutAck : false, busSeenBound: busAddr ? busSeenBound : false, busMinWm: busAddr ? busMinWm : false, busProducerNs: busAddr ? busProducerNs : false, busSeenNs: busAddr ? busSeenNs : false } });
  // [버스] ServiceBus — bus ON 일 때만 토폴로지에 존재(OFF = 0015 토폴로지 비트 동일). onTick 없음 = 신성한 tick 밖.
  //   구독 = 선언 spec(이 테이블이 SSOT). *새 소비자(audit) 추가 = 여기 행 추가뿐* — 발행자 spec 무수정(decouple 가설).
  if (bus) {
    // 구독 테이블 빌더(step-0133 분할·topo-subs.js) — 플래그 컨텍스트로부터 [topic,addr] spec 을 짓는다. 행 추가 = 새 소비자(발행자 무수정).
    const subs = buildSubs({ inventory, busAck, busOutAck, busSeenBound, chat, rankingAddr, audit, busLeaseAudit, busLeasePresence, failover, zones, presencePublish, presenceMonitor, presenceAnnounce, presenceQuery, presenceShadowAddr, whisperRouter, whisperFailover, presenceBox, presenceReportBus, presenceLease, replaceAddr, failedPublish, deliveredPublish, partyChange, partyService, guildService, guildChangePublish, guildFeed, guildBank, guildBankPublish, guildBankFeed, partyIncompletePublish, partyCompletePublish, mailboxDrainedPublish, mailboxLossPublish, whisperReceipt, exchange, exchangePublish, cancelPublish, expirePublish, abortPublish, abandonPublish, readmitPublish, autoReadmit, failPublish, marketFeed, bouncePublish, mail, mailSentPublish, mailReadPublish, mailExpirePublish, mailAbandonPublish, mailReadmitPublish, mailFailPublish, mailFeed, mailFeedRead, mailFeedExpire });
    add({ addr: 'bus', kind: 'bus', opts: { subs } });
  }
  // [데이터] 영속 스토어 — persist ON 일 때만 토폴로지에 존재(OFF = 0016 토폴로지 비트 동일). onTick 없음 = 신성한 tick 밖.
  //   가방보다 *먼저* 등록(=onTick 순서 무관·onTick 0). 가방이 죽어도 이 박스는 산다(데이터 계층 = 세션보다 오래).
  //   reliable (이 step) — persist ON 일 때만 의미(저널 홉 갭 감지·NAK·dedup). OFF → 0022 비트 동일.
  if (persistAddr) add({ addr: 'persist', kind: 'persist', opts: { reliable: journalReliable } });
  // [데이터] 보조 영속 스토어(이 step) — persistBackup ON 일 때만 존재(OFF = 0026 토폴로지 비트 동일). PersistStore *재사용*(범용 저널) — primary 와 독립 인스턴스.
  //   가방 _journal 이중쓰기 대상. primary crash 후 이 박스에서 완전 복구 가능(단일점 제거). 데이터 계층 = 세션보다 오래.
  if (persistBackupAddr) add({ addr: 'persist2', kind: 'persist', opts: { reliable: journalReliable } });
  // [데이터] N-replica 복제 스토어(이 step) — persistReplicas≥1 일 때만 N개 존재(OFF = 0027 토폴로지 비트 동일). 각각 독립 PersistStore.
  //   가방 _journal fan-out 대상. primary 포함 최대 N개 죽어도 *생존 복제들의 저널 union* 으로 무손실 복구(quorum read). 데이터 계층 = 세션보다 오래.
  for (const ra of persistReplicaAddrs) add({ addr: ra, kind: 'persist', opts: { reliable: journalReliable } });
  // [게임 서비스] 가방 — inventory ON 일 때만 토폴로지에 존재(OFF = 0013 토폴로지 비트 동일). onTick 없음 = 신성한 tick 밖.
  //   persist ON 이면 자기 데이터 스토어 주소를 안다(write-behind 저널 — 명시 인터페이스). OFF 면 null(0016 비트 동일).
  //   snapshot:N (이 step) — persist ON 일 때만 의미(저널 N항목마다 압축 스냅샷 발신). OFF(0)면 0017 비트 동일.
  //   journalHb (이 step) — persist+reliable ON 일 때만 의미(heartbeat 로 tail 손실 감지). OFF → 0023 비트 동일(heartbeat 0).
  //   replicas (0028) — persistReplicas≥1 이면 fan-out 대상 목록. [] 면 0027 비트 동일(N-replica 휴면).
  //   quorumW (이 step) — persist ON 일 때만 의미(저널에 q 플래그·ack 집계·durableSeq). 0 면 0028 비트 동일(ack 0).
  //   windowFill (0031) — persist+quorumW>0 일 때만 의미(윈도 해소 sweep). wfWindow (이 step) — 유계 sweep 범위(0=무계·0031 동일). OFF → 0029 비트 동일(sweep 0).
  if (inventory) add({ addr: 'inventory', kind: 'inventory', opts: { gateway: 'gateway', bus: busAddr, persist: persistAddr, persistBackup: persistBackupAddr, replicas: persistReplicaAddrs, quorumW: persistAddr ? quorumW : 0, windowFill: persistAddr ? windowFill : false, wfWindow: persistAddr ? wfWindow : 0, snapshot: persistAddr ? snapshot : 0, reliable: persistAddr ? journalReliable : false, journalHb: persistAddr ? journalHeartbeat : false, busResend: busAddr ? busResend : false, busResendReq: busAddr ? busResendReq : false, busWindow: busAddr ? busWindow : 0, busAck: busAddr ? busAck : false, busOutAck: busAddr ? busOutAck : false, busSeenBound: busAddr ? busSeenBound : false, busMinWm: busAddr ? busMinWm : false, outConsumers: (busAddr && busMinWm) ? (rankingAddr ? ['gateway', 'ranking'] : ['gateway']) : [], busConsumerLease: busAddr ? busConsumerLease : false, leaseSpan: busAddr ? leaseSpan : 0, busLeaseLife: busAddr ? busLeaseLife : false, busLeaseAdapt: busAddr ? busLeaseAdapt : false, busLeaseGrace: busAddr ? busLeaseGrace : false, cadencePrior: busAddr ? cadencePrior : 0, busCadenceWindow: busAddr ? busCadenceWindow : false, cadenceWindow: busAddr ? cadenceWindow : 0, busLeaseAudit: busAddr ? busLeaseAudit : false, busProducerNs: busAddr ? busProducerNs : false, busSeenNs: busAddr ? busSeenNs : false, sagaDedup, invUpPublish: busAddr ? invUpPublish : false } });   // 0126: sagaDedup — saga give 재전송 멱등(재실행 0). 0139: invUpPublish — 가방 회복 자기 공지(svc.inventory.up).
  // [데이터] 채팅 영속 스토어(이 step) — chatpersist ON 일 때만 존재(OFF = 0020 토폴로지 비트 동일). PersistStore *재사용*(범용 저널) —
  //   가방 persist 와 *독립 인스턴스*(채팅 커맨드 로그). 채팅보다 먼저 등록(onTick 0·순서 무관). 채팅이 죽어도 이 박스는 산다(데이터 계층).
  if (chatPersistAddr) add({ addr: 'chatpersist', kind: 'persist', opts: {} });
  // [게임 서비스] 채팅 — chat ON 일 때만 토폴로지에 존재(OFF = 0014 토폴로지 비트 동일). onTick 없음 = 신성한 tick 밖.
  //   chatpersist ON 이면 자기 데이터 스토어 주소를 안다(write-behind 커맨드 로그 — 명시 인터페이스). OFF 면 null(0020 비트 동일).
  //   snapshot:N (이 step) — chatpersist ON 일 때만 의미(커맨드 N항목마다 라우팅 스냅샷 압축). OFF(0)면 0021 비트 동일.
  if (chat) add({ addr: 'chat', kind: 'chat', opts: { gateway: 'gateway', bus: busAddr, persist: chatPersistAddr, snapshot: chatPersistAddr ? chatSnapshot : 0 } });
  // [게임 서비스] 감사(audit) — 발행자 무수정으로 추가된 새 소비자(bus 전제). 발신 0 = 구조적 비-침습.
  if (bus && audit) add({ addr: 'audit', kind: 'audit', opts: {} });
  // [게임 서비스] 프레즌스 모니터(0063) — svc.presence 구조적 읽기 모델(상태 기계). presenceMonitor+발행 전제. OFF 면 토폴로지에 없음(0062 비트 동일). onTick 없음·발신 0 = 비-침습.
  const presMonAddr = (presenceMonitor && presencePublish && bus && failover && zones === 2 && inventory) ? 'presmon' : null;
  //   질의자(0069·presenceQuery) — presmon 이 프레즌스 박스(presenceSvcAddr)의 읽기 인터페이스를 호출. queryFor=관측 대상('ranking' down)+미관측('inventory' 항상 up — 독립 읽기 경로 증명). presenceQuery OFF·박스 부재면 queryAddr null(0068 비트 동일).
  const presQueryOn = presenceQuery && presMonAddr && presenceSvcAddr;
  if (presMonAddr) add({ addr: 'presmon', kind: 'presmon', opts: presQueryOn ? { queryAddr: presenceSvcAddr, queryFor: ['ranking', 'inventory'] } : {} });
  // [게임 서비스] 귓속말 라우터(0071·whisperRouter) — 프레즌스 질의 인터페이스(0069)의 첫 *진짜* 라우팅 소비자. 클라 귓속말을 받아 대상 상태를 프레즌스 SSOT 에 질의→라우팅(up 전달·아니면 반송).
  //   질의 인터페이스 전제(presenceQuery+박스). OFF·박스 부재면 토폴로지에 없음(0070 비트 동일). onTick 없음 = 신성한 tick 밖·권위 0(질의 소비·라우팅 결정만).
  const whisperAddr = (whisperRouter && presenceQuery && presenceSvcAddr && presMonAddr) ? 'wrouter' : null;
  // 파티 멤버십 SSOT(0075·partyService) — 라우터가 멤버 목록을 질의로 얻는 PartyService. whisperRouter 전제(라우터 소비자). OFF 면 토폴로지에 없음(0074 비트 동일).
  const partyAddr = (partyService && whisperAddr) ? 'pservice' : null;
  // 전달 영수증 수신 박스(0076·whisperReceipt) — 귓속말 수신측 Mailbox. 라우터 전제(whisperAddr). OFF·라우터 부재면 박스 0(0075 비트 동일).
  const mailboxOn = whisperReceipt && whisperAddr;
  const __mboxOpts = { dropDeliver: deliverDrop, dedup: deliverDedup, dedupBound: deliverDedupBound, epochBound: deliverEpochBound, epochGrace: deliverEpochGrace, dropAck: deliverAckDrop, inboxBound: mailboxInboxBound, drainAck: mailboxDrainAck, checkoutBound: mailboxCheckoutBound, bus: (mailboxDrainedPublish || mailboxLossPublish) ? busAddr : null, drainedPublish: mailboxDrainedPublish, lossPublish: mailboxLossPublish };   // inboxBound(0099): inbox 최근 K cap. drainAck(0101): 읽음 확인 2단계 읽음(checkout→ackDrain). checkoutBound(0102): 미확인 체크아웃 최근 K cap. drainedPublish(0103): 읽음 소비를 svc.mailbox.drained 로 발행. lossPublish(0104): inbox overflow 를 svc.mailbox.overflowed 로 발행. 미설정=무계·파괴적 드레인·발행 0(0100 동일).
  if (mailboxOn) add({ addr: 'mbox', kind: 'mailbox', opts: __mboxOpts });   // dropDeliver(0077): 전달 손실 주입. dedup(0080): exactly-once. dedupBound(0081): seen 유계화. epochBound(0090): epoch 워터마크 유계화. epochGrace(0091): 옛 epoch grace 유예(straggler 내성). dropAck(0080): ack 손실 주입. 미설정 = 0079 비트 동일.
  // 멤버별 Mailbox 토폴로지(step-0096·mailbox2) — 둘째 수신함 박스(mbox2). 파티원마다 *자기 수신함*을 가지면 모든 up 멤버가 ack 가능 → partyAcked/complete 가 N>1 에서 의미 있다(0088 §9 한계 해소). OFF 면 둘째 박스 0 = 0095 비트 동일.
  if (mailboxOn && mailbox2) add({ addr: 'mbox2', kind: 'mailbox', opts: Object.assign({}, __mboxOpts) });
  if (whisperAddr) add({ addr: 'wrouter', kind: 'whisper', opts: { queryAddr: presenceSvcAddr, retry: whisperFailover ? whisperRetry : false, membershipAddr: partyAddr, receipt: mailboxOn, deliverRetry: mailboxOn ? deliverRetry : false, deliverTimeout, deliverMaxRetries, deliverNotify, failedPublish, deliveredPublish, epochKeyed, bus: busAddr, partyReceipt, partyAckGiveup, partyIncompletePublish, partyCompletePublish, bouncePublish } });   // retry(0074): 재타깃 시 보류 질의 재발신(whisperFailover 전제). membershipAddr(0075): 파티 멤버십 SSOT 주소(partyService OFF 면 null=0074 비트 동일). receipt(0076): 전달 영수증(whisperReceipt OFF 면 false=0075 비트 동일). deliverRetry(0077): 미확인 전달 재발신(receipt 전제·OFF 면 false=0076 비트 동일). failedPublish/bus(0082): 포기 시 svc.whisper.failed 발행(OFF 면 0081 비트 동일).
  if (partyAddr) add({ addr: 'pservice', kind: 'party', opts: { bus: busAddr, changePublish: partyChange, persist: partyPersist, snapInterval: partySnapshot } });   // [게임 서비스] 파티 멤버십 SSOT(0075) — onTick 없음·신성한 tick 밖. changePublish(0084): svc.party.changed 발행. persist(0085): 변경 저널 영속·crash replay. snapInterval(0086): 저널 스냅샷 압축(0 면 0085 비트 동일).
  // [코디네이션] 전용 프레즌스 박스(0064) — orch 의 프레즌스 SSOT+발행 인계처. OFF 면 없음(0063 비트 동일). onTick 없음 = 신성한 tick 밖.
  if (presenceSvcAddr) add({ addr: 'presence', kind: 'presence', opts: { bus: busAddr, lease: presenceLease, hbTimeout } });   // primary: presenceLease 면 매 tick 하트비트 발행(0068).
  // [코디네이션] 프레즌스 박스 shadow(0066·presenceShadow) — *대기(standby)* PresenceService(presence2). primary 뒤 등록(팬아웃 순서 primary 먼저). active=false → 같은 보고로 SSOT 그림자 복제만·svc.presence 발행 억제(이중 발행 0). bus 는 승격(0067) 대비 전달. lease 면 하트비트 구독→사망 자율 감지(0068). OFF 면 없음(0065 비트 동일).
  if (presenceShadowAddr) add({ addr: 'presence2', kind: 'presence', opts: { bus: busAddr, active: false, lease: presenceLease, hbTimeout, announceActive: presenceAnnounce, announceEpoch: presenceAnnounce && announceEpoch } });   // announceActive(0070): 승격 시 svc.presence.active 공지(질의자 재타깃용). announceEpoch(0105): 공지에 epoch 실어 메아리 거부.
  // [게임 서비스] 랭킹(ranking) — *발신하는* 둘째 소비자(이 step). svc.item.out 소비 → rank 투영 → svc.rank.out 발행(consume→publish).
  //   bus+가방 전제. OFF 면 토폴로지에 없음(0018 비트 동일). onTick 없음 = 신성한 tick 밖·권위 아닌 읽기 모델(CQRS).
  if (rankingAddr) add({ addr: 'ranking', kind: 'ranking', opts: { bus: busAddr, busMinWm: busAddr ? busMinWm : false, dropRecover } });
  if (exchange) add({ addr: 'exchange', kind: 'exchange', opts: { bus: busAddr, publish: exchangePublish, persist: exchangePersist, snapInterval: exchangeSnapshot, cancelPublish, ttl: exchangeTtl, expirePublish, inv: (exchInventory && inventory) ? inventoryAddr : null, invMode: exchInventory, saga: exchSaga, compensate: exchCompensate, abortPublish, sagaDedupBound, autoRetry, sagaMaxRetries, abandonPublish, readmitPublish, autoReadmit, readmitMax, failPublish } });   // 0117: exchInventory ON 이면 거래소가 가방 주소를 알고 escrow 를 실체화(give). OFF 면 추상 escrow(0116 비트 동일).
  if (marketFeed && exchange) add({ addr: 'market', kind: 'market', opts: { bus: busAddr } });   // 시세 피드(step-0112·MarketFeed) — 거래소 발행 스트림 구독 읽기 모델. marketFeed OFF·거래소 부재면 박스 0 = 0111 비트 동일.   // 거래소(step-0107) — 아이템 escrow 거래 박스(존 tick 밖·단일 소유·쌍 거래). publish(0108): 체결 발행. persist(0109): op 저널 replay. snapInterval(0110): 저널 스냅샷 압축. exchange OFF 면 박스 0 = 0106 비트 동일.
  // [게임 서비스] 우편(step-0142·MailService) — 오프라인 비동기 배송 박스(존 tick 밖·발신 0). 거래소·시세 피드와 독립(아이템/메시지 우편함). mail OFF 면 박스 0 = 0141 비트 동일.
  if (mail) add({ addr: 'mail', kind: 'mail', opts: { bus: busAddr, sentPublish: mailSentPublish, readPublish: mailReadPublish, persist: mailPersist, snapInterval: mailPersist ? mailSnapshot : 0, ttl: mailTtl, expirePublish: mailExpirePublish, item: mailItem, inv: (mailInv && inventory) ? inventoryAddr : null, invMode: mailInv, saga: mailSaga, ackDrop: mailAckDrop, ackDropAlways: mailAckDropAlways, autoRetry: mailAutoRetry, maxRetries: mailMaxRetries, abandonPublish: mailAbandonPublish, readmitPublish: mailReadmitPublish, readmitMax: mailReadmitMax, failPublish: mailFailPublish } });   // sentPublish(0144): svc.mail.sent. readPublish(0147): svc.mail.read. expirePublish(0149): svc.mail.expired. persist(0145): replay. snapInterval(0146): 압축. ttl(0148): 만료. inv/invMode(0161·mailInv): 아이템 우편↔가방 escrow custody. OFF 면 직전 비트 동일.
  // [게임 서비스] 우편 미읽음 배지(step-0151·MailFeed) — 우편 발행 스트림(svc.mail.*) 구독 읽기 모델(거래소 MarketFeed 0112 의 우편 판). 발신 0·권위 0(순수 관찰). mailFeed OFF·우편 부재면 박스 0 = 0150 비트 동일.
  if (mailFeed && mail) add({ addr: 'mailfeed', kind: 'mailfeed', opts: { bus: busAddr } });
  // [게임 서비스] 길드(step-0181·GuildService) — 오래 사는 명명된 조직 박스(로스터+마스터십 SSOT·존 tick 밖·onTick 없음). 파티(0075)의 *영속 조직* 판·single-master 권위. guildService OFF 면 박스 0 = 0180 비트 동일.
  if (guildService) add({ addr: 'guild', kind: 'guild', opts: { bus: busAddr, changePublish: guildChangePublish, persist: guildPersist, snapInterval: guildPersist ? guildSnapshot : 0, bank: guildBank, bankPublish: guildBankPublish } });   // changePublish(0183): svc.guild.changed 발행. persist(0184): 변경 저널 영속·crash replay. snapInterval(0185): 저널 스냅샷 압축(0 면 0184 비트 동일).
  // [게임 서비스] 길드 멤버 수 배지(step-0186·GuildFeed) — svc.guild.changed 구독 읽기 모델(우편 MailFeed 0151 의 길드 판). 발신 0·권위 0(순수 관찰). guildFeed OFF·길드 부재면 박스 0 = 0185 비트 동일.
  if (guildFeed && guildService) add({ addr: 'guildfeed', kind: 'guildfeed', opts: { bus: busAddr, persist: guildFeedPersist } });   // persist(0187): 소비 op 저널 replay·crash 후 배지 재구성(OFF 면 0186 비트 동일).
  // [게임 서비스] 대체 소비자(step-0061·spawnReplace) — ranking 의 *대기(standby)* 복제(RankingService 재사용). 초기엔 svc.item.out 미구독(토폴로지가 svc.presence 만 구독시킴)·busMinWm 불참(min-워터마크 정의역 무영향=비-침습). orch 가 'permanent' 발행 시 스스로 활성화해 역할 인계. OFF 면 토폴로지에 없음(0060 비트 동일).
  if (replaceAddr) add({ addr: 'ranking2', kind: 'ranking', opts: { bus: busAddr, busMinWm: false, replaceTarget: 'ranking' } });
  // [월드] 인스턴스(던전) 서버(step-0201·InstanceServer) — 던전/매치 일회성 시뮬 인스턴스의 spawn/despawn SSOT. 존(영속)과 수명주기 분리·존 tick 밖·onTick 없음. instanceService OFF 면 박스 0 = 0200 비트 동일(reg 0).
  if (instanceService) add({ addr: 'instance', kind: 'instance', opts: {} });
  // [데이터] 캐시(step-0205·CacheStore) — 핫 데이터(세션·가방·시세) 1홉 캐시 계층. DB 직행 대체·존 tick 밖·onTick 없음. cacheService OFF 면 박스 0 = 0204 비트 동일(reg 0).
  if (cacheService) add({ addr: 'cache', kind: 'cache', opts: { source: cacheSource } });   // source(0206): read-through miss 시 읽을 backing store(DB 더미). 없으면 miss 가 안 채워짐(0205 거동).
  // [데이터] 월드 영속(step-0207·WorldLog) — 월드 상태의 intent 로그 event sourcing(데이터 3분할 ①). 서비스 PersistStore·캐시와 직교·존 tick 밖. worldLog OFF 면 박스 0 = 0206 비트 동일(reg 0).
  if (worldLog) add({ addr: 'worldlog', kind: 'worldlog', opts: {} });

  const zopt = { grid, radius, incremental, recovery, retxPeriod, heartbeat, failover };
  const orchAddr = (failover && zones === 2) ? 'orch' : null;
  if (zones === 1) {
    add({ addr: 'zone1', kind: 'zone', seed, opts: { ...zopt, region: { lo: 0, hi: grid }, sibling: null, boundary: grid, orch: orchAddr } });
  } else {
    const dt = (key) => (deathTick != null && killZone === key) ? deathTick : null;
    add({ addr: 'zone1', kind: 'zone', seed, opts: { ...zopt, region: { lo: 0, hi: H }, sibling: 'zone2', boundary: H, orch: orchAddr, deathTick: dt('zone1') } });
    add({ addr: 'zone2', kind: 'zone', seed, opts: { ...zopt, region: { lo: H, hi: grid }, sibling: 'zone1', boundary: H, orch: orchAddr, deathTick: dt('zone2') } });
  }

  if (failover && zones === 2) {
    add({ addr: 'orch', kind: 'orch', opts: { leaseTimeout, monitor: [['zone1', 'zone1f'], ['zone2', 'zone2f']], busLeasePresence, busPresenceRecover, recoverRetry, recoverTimeout, recoverMaxRetries, bus: busAddr, presencePublish, presenceBox: !!presenceSvcAddr, presenceAddr: (presenceSvcAddr && !presenceReportBus) ? presenceSvcAddr : null, presenceReportBus: !!(presenceSvcAddr && presenceReportBus) } });
    add({ addr: 'zone1f', kind: 'zone', seed, opts: { ...zopt, region: { lo: 0, hi: H }, sibling: 'zone2f', boundary: H, shadow: true, orch: 'orch' } });
    add({ addr: 'zone2f', kind: 'zone', seed, opts: { ...zopt, region: { lo: H, hi: grid }, sibling: 'zone1f', boundary: H, shadow: true, orch: 'orch' } });
  }

  for (let i = 0; i < clients; i++) {
    add({ addr: 'client' + i, kind: 'client', opts: { script: { account: accounts[i], seed: (seed + i * 0x9E37) >>> 0, moves, leaveTick: leave[i] != null ? leave[i] : null, resyncPeriod, inventory, itemOps, chat, chatOps, region: String(i % regions), clientResend, mintRecon } } });
  }
  return { specs, order, zoneAddrs, H, grid, radius, hasInventory: !!inventory, hasChat: !!chat, hasBus: !!bus, hasAudit: !!(bus && audit), hasPersist: !!persistAddr };
}

// makeActor·routeFilters 는 topo-actors.js 로 분리(step-0098) — 진입점이 re-export.

const __part = { routeFilters, buildTopology, makeActor };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).topo_build = __part;
