'use strict';
// step-0048 분할 preamble — 박스 1개=파일 1개 (CLAUDE.md 임계 규칙). 진입점 topology.js 가 묶는다.
// 정리 step: topology.js 가 31KB>30KB 박스 트리거를 넘겨, *토폴로지 구성*(선언적 spec 빌더 + 액터 팩토리 + 라우트 필터)을
//   이 파일로 분리한다. topology.js 는 *run 드라이버 + 진입점*으로 남는다(quorumMergeJournals·run·runMulti). 기능 0·바이트 동일(verbatim 이동)·
//   export 집합 불변 → reg 0(0037 비트 동일). 0030 net-core 분할·0035 cluster 분할의 topology 판.
// dual-mode: Node require / 브라우저는 common.js·박스 파일을 <script> 선행 로드(전역 __HktNetCommon·__HktNetParts).
const __c = (typeof module !== 'undefined' && module.exports && typeof require !== 'undefined')
  ? require('./common.js') : globalThis.__HktNetCommon;
const { LoginServer, SessionRegistry } = __c;
const __p = n => (typeof module !== 'undefined' && module.exports && typeof require !== 'undefined')
  ? require('./' + n + '.js') : globalThis.__HktNetParts[n.replace(/-/g, '_')];
const { Gateway } = __p('gateway');
const { Orchestrator } = __p('orchestrator');
const { EntityZone } = __p('zone');
const { InventoryService } = __p('svc-inventory');
const { ChatService } = __p('svc-chat');
const { ServiceBus } = __p('svc-bus');
const { AuditService } = __p('svc-audit');
const { RankingService } = __p('svc-ranking');
const { PresenceMonitor } = __p('svc-presence-monitor');
const { PresenceService } = __p('svc-presence');
const { WhisperRouter } = __p('svc-whisper');
const { PartyService } = __p('svc-party');
const { Mailbox } = __p('svc-mailbox');
const { PersistStore } = __p('persist');
const { Client } = __p('client');

// ── routeFilter — 0009 그대로 ──
const routeFilters = {
  handoff: (m) => /^zone/.test(m.from) && /^zone/.test(m.to) && m.payload.type === 'handoff',
  delta: (m) => /^zone/.test(m.from) && m.to === 'gateway' && m.payload.type === 'view_delta',
  both: (m) => (/^zone/.test(m.from) && /^zone/.test(m.to) && m.payload.type === 'handoff') ||
               (/^zone/.test(m.from) && m.to === 'gateway' && m.payload.type === 'view_delta'),
  // 가방 서버-측 홉(gateway↔inventory) — redundancy/dedup 아래 원장 보존(idempotent transfer) 검증용.
  item: (m) => (m.from === 'gateway' && m.to === 'inventory') || (m.from === 'inventory' && m.to === 'gateway'),
  // 채팅 서버-측 홉(gateway↔chat) — loss/redundancy 아래 best-effort 팬아웃(누설 0·지역 격리 보존, 완전성은 graceful 열화) 검증용.
  chat: (m) => (m.from === 'gateway' && m.to === 'chat') || (m.from === 'chat' && m.to === 'gateway'),
  // 이벤트 버스 홉(bus 출입 전체 — pub·ev) — loss/redundancy 아래 라우팅 정확성(누설/phantom 0)·원장 보존 검증용(0016).
  svcbus: (m) => m.from === 'bus' || m.to === 'bus',
  // 영속 저널 홉(inventory→persist) — loss/redundancy 아래 라우팅 정확성·원장 보존(저널 미사용 시 무해) 검증용(0017).
  persist: (m) => m.to === 'persist' || m.from === 'persist',
};

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
    presenceAnnounce = false,
    whisperRouter = false,
    whisperFailover = false,
    whisperRetry = false,
    partyService = false,
    whisperReceipt = false,
    deliverRetry = false,
    deliverTimeout = 4,
    deliverDrop = 0,
    deliverMaxRetries = 0,
    deliverNotify = false,
    failedPublish = false,
    deliveredPublish = false,
    epochKeyed = false,
    partyReceipt = false,
    partyChange = false,
    partyPersist = false,
    partySnapshot = 0,
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
    const subs = [];
    if (inventory) subs.push(['svc.item', 'inventory'], ['svc.item.out', 'gateway']);
    if (inventory && busAck) subs.push(['svc.item.ack', 'gateway']);   // 요청 ack(0040) — 가방→게이트웨이 자기-크기조정 경로. busAck OFF 면 미추가 = 0039 토폴로지 비트 동일.
    if (inventory && busOutAck) subs.push(['svc.item.out.ack', 'inventory']);   // 결과 ack(0041) — 게이트웨이→가방 자기-크기조정 경로. busOutAck OFF 면 미추가 = 0040 토폴로지 비트 동일.
    if (inventory && busSeenBound) subs.push(['svc.item.seen', 'inventory']);   // seen 워터마크(이 step) — 게이트웨이→가방 seenReqs 가지치기 경로. busSeenBound OFF 면 미추가 = 0041 토폴로지 비트 동일.
    if (chat) subs.push(['svc.chat', 'chat'], ['svc.chat.out', 'gateway']);
    // 랭킹(이 step) — *발행자 무수정으로* svc.item.out 에 둘째 소비자(ranking) 행 추가 + svc.rank.out 을 gateway 가 구독(클라 중계).
    if (rankingAddr) subs.push(['svc.item.out', 'ranking'], ['svc.rank.out', 'gateway']);
    if (audit) for (const t of ['svc.item', 'svc.item.out', 'svc.chat', 'svc.chat.out']) subs.push([t, 'audit']);
    if (audit && busLeaseAudit && inventory) subs.push(['svc.item.lease', 'audit']);   // lease 생애 관측(0054) — audit 가 축출/재admission 이벤트 구독. busLeaseAudit OFF 면 미추가(0053 토폴로지 비트 동일).
    if (busLeaseAudit && busLeasePresence && failover && zones === 2 && inventory) subs.push(['svc.item.lease', 'orch']);   // lease 생애 *반응*(0055) — 코디네이션(orch)이 lease 이벤트 구독해 소비자 프레즌스 SSOT 유지. busLeasePresence OFF·orch 부재면 미추가(0054 토폴로지 비트 동일).
    if (presencePublish && busLeasePresence && audit && failover && zones === 2 && inventory) subs.push(['svc.presence', 'audit']);   // 프레즌스 발행(0060) — orch 가 down/up/permanent 판정을 svc.presence 로 발행, audit(범용 sink)가 구독. presencePublish OFF·audit/orch 부재면 미추가(0059 토폴로지 비트 동일).
    if (presenceMonitor && presencePublish && busLeasePresence && failover && zones === 2 && inventory) subs.push(['svc.presence', 'presmon']);   // 프레즌스 모니터(0063) — svc.presence 의 셋째 소비자(구조적 상태 기계). presenceMonitor OFF 면 미추가(0062 토폴로지 비트 동일·발행자 무수정).
    if (presenceAnnounce && presenceQuery && presenceShadowAddr && presenceMonitor && presencePublish && failover && zones === 2 && inventory) subs.push(['svc.presence.active', 'presmon']);   // failover 중 질의 연속성(0070) — presmon 이 승격 공지를 구독해 queryAddr 재타깃. presenceAnnounce OFF 면 미추가(0069 토폴로지 비트 동일).
    if (whisperRouter && whisperFailover && presenceAnnounce && presenceShadowAddr && presenceQuery && presenceMonitor && presencePublish && failover && zones === 2 && inventory) subs.push(['svc.presence.active', 'wrouter']);   // 귓속말 라우터 failover 연속성(0072) — wrouter 가 승격 공지를 구독해 queryAddr 재타깃(0070 presmon 재타깃의 라우터 판). whisperFailover OFF 면 미추가(0071 토폴로지 비트 동일).
    if (presenceBox && presenceReportBus && presencePublish && failover && zones === 2 && inventory) subs.push(['svc.presence.report', 'presence']);   // 프레즌스 보고 버스화(0065) — PresenceService 가 orch 의 전이 보고를 버스 토픽으로 구독(point-to-point 대신). presenceReportBus OFF 면 미추가(0064 토폴로지 비트 동일).
    if (presenceShadowAddr) subs.push(['svc.presence.report', 'presence2']);   // 프레즌스 박스 shadow(0066) — standby presence2 가 *같은* 보고 토픽을 구독해 SSOT 그림자 복제(primary 뒤 등록 → 팬아웃 순서 primary 먼저). presenceShadow OFF 면 미추가(0065 토폴로지 비트 동일).
    if (presenceShadowAddr && presenceLease) subs.push(['svc.presence.hb', 'presence2']);   // 프레즌스 박스 사망 자율 감지(0068) — standby presence2 가 active primary 의 하트비트를 구독해 침묵 길이로 사망 감지. presenceLease OFF 면 미추가(0067 토폴로지 비트 동일).
    if (replaceAddr && busLeasePresence && failover && zones === 2 && inventory) subs.push(['svc.presence', 'ranking2']);   // 대체 소비자 활성화(0061) — standby ranking2 가 svc.presence 의 'permanent' 신호 구독(svc.item.out 은 활성화 후 *스스로* 재구독). spawnReplace OFF 면 미추가(0060 토폴로지 비트 동일).
    if (audit && rankingAddr) subs.push(['svc.rank.out', 'audit']);   // audit 도 rank 스트림 관찰(둘째 소비자의 둘째 소비자)
    if (audit && failedPublish && whisperRouter) subs.push(['svc.whisper.failed', 'audit']);   // 전달 실패 발행(0082) — audit 가 svc.whisper.failed 구독(발행자 무수정 관측 소비자). failedPublish OFF 면 미추가(0081 토폴로지 비트 동일).
    if (audit && deliveredPublish && whisperRouter) subs.push(['svc.whisper.delivered', 'audit']);   // 전달 성공 발행(0087) — audit 가 svc.whisper.delivered 구독(수명주기 성공 절반). deliveredPublish OFF 면 미추가(0086 토폴로지 비트 동일).
    if (audit && partyChange && partyService) subs.push(['svc.party.changed', 'audit']);   // 멤버십 변경 발행(0084) — audit 가 svc.party.changed 구독(가입/탈퇴 관측). partyChange OFF 면 미추가(0083 토폴로지 비트 동일).
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
  if (inventory) add({ addr: 'inventory', kind: 'inventory', opts: { gateway: 'gateway', bus: busAddr, persist: persistAddr, persistBackup: persistBackupAddr, replicas: persistReplicaAddrs, quorumW: persistAddr ? quorumW : 0, windowFill: persistAddr ? windowFill : false, wfWindow: persistAddr ? wfWindow : 0, snapshot: persistAddr ? snapshot : 0, reliable: persistAddr ? journalReliable : false, journalHb: persistAddr ? journalHeartbeat : false, busResend: busAddr ? busResend : false, busResendReq: busAddr ? busResendReq : false, busWindow: busAddr ? busWindow : 0, busAck: busAddr ? busAck : false, busOutAck: busAddr ? busOutAck : false, busSeenBound: busAddr ? busSeenBound : false, busMinWm: busAddr ? busMinWm : false, outConsumers: (busAddr && busMinWm) ? (rankingAddr ? ['gateway', 'ranking'] : ['gateway']) : [], busConsumerLease: busAddr ? busConsumerLease : false, leaseSpan: busAddr ? leaseSpan : 0, busLeaseLife: busAddr ? busLeaseLife : false, busLeaseAdapt: busAddr ? busLeaseAdapt : false, busLeaseGrace: busAddr ? busLeaseGrace : false, cadencePrior: busAddr ? cadencePrior : 0, busCadenceWindow: busAddr ? busCadenceWindow : false, cadenceWindow: busAddr ? cadenceWindow : 0, busLeaseAudit: busAddr ? busLeaseAudit : false, busProducerNs: busAddr ? busProducerNs : false, busSeenNs: busAddr ? busSeenNs : false } });
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
  if (mailboxOn) add({ addr: 'mbox', kind: 'mailbox', opts: { dropDeliver: deliverDrop, dedup: deliverDedup, dedupBound: deliverDedupBound, epochBound: deliverEpochBound, epochGrace: deliverEpochGrace, dropAck: deliverAckDrop } });   // dropDeliver(0077): 전달 손실 주입. dedup(0080): exactly-once. dedupBound(0081): seen 유계화. epochBound(0090): epoch 워터마크 유계화. epochGrace(0091): 옛 epoch grace 유예(straggler 내성). dropAck(0080): ack 손실 주입. 미설정 = 0079 비트 동일.
  if (whisperAddr) add({ addr: 'wrouter', kind: 'whisper', opts: { queryAddr: presenceSvcAddr, retry: whisperFailover ? whisperRetry : false, membershipAddr: partyAddr, receipt: mailboxOn, deliverRetry: mailboxOn ? deliverRetry : false, deliverTimeout, deliverMaxRetries, deliverNotify, failedPublish, deliveredPublish, epochKeyed, bus: busAddr, partyReceipt } });   // retry(0074): 재타깃 시 보류 질의 재발신(whisperFailover 전제). membershipAddr(0075): 파티 멤버십 SSOT 주소(partyService OFF 면 null=0074 비트 동일). receipt(0076): 전달 영수증(whisperReceipt OFF 면 false=0075 비트 동일). deliverRetry(0077): 미확인 전달 재발신(receipt 전제·OFF 면 false=0076 비트 동일). failedPublish/bus(0082): 포기 시 svc.whisper.failed 발행(OFF 면 0081 비트 동일).
  if (partyAddr) add({ addr: 'pservice', kind: 'party', opts: { bus: busAddr, changePublish: partyChange, persist: partyPersist, snapInterval: partySnapshot } });   // [게임 서비스] 파티 멤버십 SSOT(0075) — onTick 없음·신성한 tick 밖. changePublish(0084): svc.party.changed 발행. persist(0085): 변경 저널 영속·crash replay. snapInterval(0086): 저널 스냅샷 압축(0 면 0085 비트 동일).
  // [코디네이션] 전용 프레즌스 박스(0064) — orch 의 프레즌스 SSOT+발행 인계처. OFF 면 없음(0063 비트 동일). onTick 없음 = 신성한 tick 밖.
  if (presenceSvcAddr) add({ addr: 'presence', kind: 'presence', opts: { bus: busAddr, lease: presenceLease, hbTimeout } });   // primary: presenceLease 면 매 tick 하트비트 발행(0068).
  // [코디네이션] 프레즌스 박스 shadow(0066·presenceShadow) — *대기(standby)* PresenceService(presence2). primary 뒤 등록(팬아웃 순서 primary 먼저). active=false → 같은 보고로 SSOT 그림자 복제만·svc.presence 발행 억제(이중 발행 0). bus 는 승격(0067) 대비 전달. lease 면 하트비트 구독→사망 자율 감지(0068). OFF 면 없음(0065 비트 동일).
  if (presenceShadowAddr) add({ addr: 'presence2', kind: 'presence', opts: { bus: busAddr, active: false, lease: presenceLease, hbTimeout, announceActive: presenceAnnounce } });   // announceActive(0070): 승격 시 svc.presence.active 공지(질의자 재타깃용).
  // [게임 서비스] 랭킹(ranking) — *발신하는* 둘째 소비자(이 step). svc.item.out 소비 → rank 투영 → svc.rank.out 발행(consume→publish).
  //   bus+가방 전제. OFF 면 토폴로지에 없음(0018 비트 동일). onTick 없음 = 신성한 tick 밖·권위 아닌 읽기 모델(CQRS).
  if (rankingAddr) add({ addr: 'ranking', kind: 'ranking', opts: { bus: busAddr, busMinWm: busAddr ? busMinWm : false, dropRecover } });
  // [게임 서비스] 대체 소비자(step-0061·spawnReplace) — ranking 의 *대기(standby)* 복제(RankingService 재사용). 초기엔 svc.item.out 미구독(토폴로지가 svc.presence 만 구독시킴)·busMinWm 불참(min-워터마크 정의역 무영향=비-침습). orch 가 'permanent' 발행 시 스스로 활성화해 역할 인계. OFF 면 토폴로지에 없음(0060 비트 동일).
  if (replaceAddr) add({ addr: 'ranking2', kind: 'ranking', opts: { bus: busAddr, busMinWm: false, replaceTarget: 'ranking' } });

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

// makeActor — spec → 액터(net 에 register). 인프로세스(engine Net)·호스트(HostNet shim) 양쪽이 같은 팩토리 사용.
function makeActor(spec, net) {
  let a;
  switch (spec.kind) {
    case 'login': a = new LoginServer(spec.opts.accounts, spec.opts.seed); break;
    case 'registry': a = new SessionRegistry(); break;
    case 'gateway': a = new Gateway(spec.opts.zoneAddrs, spec.opts.replicas, spec.opts.inventoryAddr, spec.opts.chatAddr, spec.opts.busAddr, spec.opts.busResendReq, spec.opts.busWindow, spec.opts.busAck, spec.opts.busOutAck, spec.opts.busSeenBound, spec.opts.busMinWm, spec.opts.busProducerNs, spec.opts.busSeenNs); break;
    case 'zone': a = new EntityZone(spec.seed, spec.opts); break;
    case 'orch': a = new Orchestrator(spec.opts); break;
    case 'inventory': a = new InventoryService(spec.opts); break;
    case 'chat': a = new ChatService(spec.opts); break;
    case 'bus': a = new ServiceBus(spec.opts); break;
    case 'audit': a = new AuditService(spec.opts); break;
    case 'presmon': a = new PresenceMonitor(spec.opts); break;
    case 'presence': a = new PresenceService(spec.opts); break;
    case 'whisper': a = new WhisperRouter(spec.opts); break;
    case 'party': a = new PartyService(spec.opts); break;
    case 'mailbox': a = new Mailbox(spec.opts); break;
    case 'ranking': a = new RankingService(spec.opts); break;
    case 'persist': a = new PersistStore(spec.opts); break;
    case 'client': a = new Client(spec.opts.script); break;
    default: throw new Error('unknown kind ' + spec.kind);
  }
  net.register(spec.addr, a);
  return a;
}

const __part = { routeFilters, buildTopology, makeActor };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).topo_build = __part;
