'use strict';
// step-0281 — #56 브리지 존 데이터 평면 1: zoneEntityFlow opt 배선(orch 로 전달). OFF→0280 비트 동일.
// step-0048 분할 preamble — 박스 1개=파일 1개 (CLAUDE.md 임계 규칙). 진입점 topology.js 가 묶는다.
// step-0133 정리 분할: topo-build.js 가 33KB>30KB 박스 트리거를 다시 넘겨, *버스 구독 테이블 빌더*(buildSubs)를 topo-subs.js 로 분리한다(기능 0·verbatim·reg 0 — 33.1→25.5KB).
// step-0098 정리 분할: topo-build.js 가 32KB>30KB 박스 트리거를 넘겨, *액터 팩토리 + 라우트 필터*(makeActor·routeFilters·박스 클래스 import)를
//   topo-actors.js 로 분리한다. 이 파일은 *선언적 spec 빌더*(buildTopology) + 진입점으로 남고, topo-actors 를 require 해 동일 export 를 노출한다 —
//   기능 0·verbatim 이동·export 집합 불변 → reg 0. 0030 net-core·0035 cluster·0038 topology 분할의 topo-build 판.
// dual-mode: Node 는 부품을 require, 브라우저는 <script> 선행 로드(전역 __HktNetParts.topo_actors). buildTopology 는 외부 의존 0(opts 만).
const __isNode = typeof module !== 'undefined' && module.exports && typeof require !== 'undefined';
const { routeFilters, makeActor } = __isNode ? require('./topo-actors.js') : globalThis.__HktNetParts.topo_actors;
const { buildSubs } = __isNode ? require('./topo-subs.js') : globalThis.__HktNetParts.topo_subs;   // step-0133 분할 — 버스 구독 테이블 빌더.
const { addServiceBoxes } = __isNode ? require('./topo-boxes.js') : globalThis.__HktNetParts.topo_boxes;   // step-0263 분할 — 서비스/데이터 박스 add 시퀀스.

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
    loginQueue = false,
    loginAccounts = null,   // step-0229·loginAuth 가 검증할 유효 계정 목록(미제공이면 빈 채=0228 거동·loginAuth 미수신이면 무영향).
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
    placeExecute = false,
    zoneBridge = false,
    zoneEntityFlow = false,
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
  // step-0263 분할 — 서비스/데이터 박스 add() 시퀀스를 topo-boxes.addServiceBoxes 로 위임(verbatim·기능 0·reg 0).
  //   buildTopology 가 destructure/derive 한 옵션·파생 주소를 ctx 로 넘긴다(미수신 박스는 가드가 휴면 = 직전 step 비트 동일).
  const __bctx = {
    abandonPublish, abortPublish, accounts, announceEpoch, audit, autoReadmit, autoRetry, bouncePublish,
    bus, busAck, busAddr, busCadenceWindow, busConsumerLease, busLeaseAdapt, busLeaseAudit, busLeaseGrace,
    busLeaseLife, busLeasePresence, busMinWm, busOutAck, busProducerNs, busResend, busResendReq, busSeenBound,
    busSeenNs, busWindow, cacheService, cacheSource, cadencePrior, cadenceWindow, cancelPublish, chat,
    chatAddr, chatPersistAddr, chatSnapshot, chatpersist, deliverAckDrop, deliverDedup, deliverDedupBound, deliverDrop,
    deliverEpochBound, deliverEpochGrace, deliverMaxRetries, deliverNotify, deliverRetry, deliverTimeout, deliveredPublish, dropRecover,
    epochKeyed, exchCompensate, exchInventory, exchSaga, exchange, exchangePersist, exchangePublish, exchangeSnapshot,
    exchangeTtl, expirePublish, failPublish, failedPublish, failover, guildBank, guildBankFeed, guildBankPublish,
    guildChangePublish, guildFeed, guildFeedPersist, guildPersist, guildService, guildSnapshot, hbTimeout, instanceService,
    invUpPublish, inventory, inventoryAddr, journalHeartbeat, journalReliable, leaseSpan, loginAccounts, loginQueue,
    mail, mailAbandonPublish, mailAckDrop, mailAckDropAlways, mailAutoRetry, mailExpirePublish, mailFailPublish, mailFeed,
    mailFeedExpire, mailFeedRead, mailInv, mailItem, mailMaxRetries, mailPersist, mailReadPublish, mailReadmitMax,
    mailReadmitPublish, mailSaga, mailSentPublish, mailSnapshot, mailTtl, mailbox2, mailboxCheckoutBound, mailboxDrainAck,
    mailboxDrainedPublish, mailboxInboxBound, mailboxLossPublish, marketFeed, partyAckGiveup, partyChange, partyCompletePublish, partyIncompletePublish,
    partyPersist, partyReceipt, partyService, partySnapshot, persist, persistAddr, persistBackup, persistBackupAddr,
    persistReplicaAddrs, presenceAnnounce, presenceBox, presenceLease, presenceMonitor, presencePublish, presenceQuery, presenceReportBus,
    presenceShadowAddr, presenceSvcAddr, quorumW, ranking, rankingAddr, readmitMax, readmitPublish, replaceAddr,
    replicas, sagaDedup, sagaDedupBound, sagaMaxRetries, snapshot, wfWindow, whisperFailover, whisperReceipt,
    whisperRetry, whisperRouter, windowFill, worldLog, zoneAddrs, zones
  };
  addServiceBoxes(__bctx, add);

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
    add({ addr: 'orch', kind: 'orch', opts: { leaseTimeout, monitor: [['zone1', 'zone1f'], ['zone2', 'zone2f']], busLeasePresence, busPresenceRecover, recoverRetry, recoverTimeout, recoverMaxRetries, bus: busAddr, presencePublish, presenceBox: !!presenceSvcAddr, presenceAddr: (presenceSvcAddr && !presenceReportBus) ? presenceSvcAddr : null, presenceReportBus: !!(presenceSvcAddr && presenceReportBus), placeExecute, zoneBridge, zoneEntityFlow, zoneRtGrid: grid, zoneRtRadius: radius } });
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
