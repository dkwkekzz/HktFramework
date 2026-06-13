'use strict';
// step-0036 분할 preamble — 박스 1개=파일 1개 (CLAUDE.md 임계 규칙). 진입점 net-core.js 가 묶는다.
// dual-mode: Node require / 브라우저는 common.js 를 <script> 선행 로드(전역 __HktNetCommon).
const __c = (typeof module !== 'undefined' && module.exports && typeof require !== 'undefined')
  ? require('./common.js') : globalThis.__HktNetCommon;
const { Net, LoginServer, SessionRegistry, mulberry32, fnv1a, DEFAULTS } = __c;
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
const { PersistStore } = __p('persist');
const { Client } = __p('client');
const { inflightSet, replicaDivergence, itemDesync, invDigest } = __p('metrics');

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
  const chatPersistAddr = (chatpersist && chat) ? 'chatpersist' : null;   // 채팅 영속(이 step) = 채팅 전제(채팅 커맨드 로그의 데이터 계층). OFF → 0020 비트 동일.
  const persistBackupAddr = (persistBackup && persistAddr) ? 'persist2' : null;   // 보조 영속(0027) = primary persist 전제. OFF → 0026 비트 동일(이중쓰기 0).
  // N-replica(이 step) — persistReplicas≥1 이면 'persist2'..'persistN+1' 복제 스토어 N개. primary 와 독립 인스턴스(범용 PersistStore 재사용).
  //   persistBackup(0027 단일 backup)과 상호배타: persistReplicas≥1 이면 그 경로를 대체(둘 다 'persist2' 를 쓰므로 충돌 방지). 둘 다 0 = 0027/0026 비트 동일.
  const persistReplicaAddrs = (persistReplicas >= 1 && persistAddr) ? Array.from({ length: persistReplicas }, (_, k) => 'persist' + (k + 2)) : [];
  // 버스 ON 이면 gateway 는 서비스 *주소를 모른다*(inventoryAddr/chatAddr = null — 토픽만) = 직접 결합의 구조적 제거.
  add({ addr: 'gateway', kind: 'gateway', opts: { zoneAddrs, replicas, inventoryAddr: busAddr ? null : inventoryAddr, chatAddr: busAddr ? null : chatAddr, busAddr } });
  // [버스] ServiceBus — bus ON 일 때만 토폴로지에 존재(OFF = 0015 토폴로지 비트 동일). onTick 없음 = 신성한 tick 밖.
  //   구독 = 선언 spec(이 테이블이 SSOT). *새 소비자(audit) 추가 = 여기 행 추가뿐* — 발행자 spec 무수정(decouple 가설).
  if (bus) {
    const subs = [];
    if (inventory) subs.push(['svc.item', 'inventory'], ['svc.item.out', 'gateway']);
    if (chat) subs.push(['svc.chat', 'chat'], ['svc.chat.out', 'gateway']);
    // 랭킹(이 step) — *발행자 무수정으로* svc.item.out 에 둘째 소비자(ranking) 행 추가 + svc.rank.out 을 gateway 가 구독(클라 중계).
    if (rankingAddr) subs.push(['svc.item.out', 'ranking'], ['svc.rank.out', 'gateway']);
    if (audit) for (const t of ['svc.item', 'svc.item.out', 'svc.chat', 'svc.chat.out']) subs.push([t, 'audit']);
    if (audit && rankingAddr) subs.push(['svc.rank.out', 'audit']);   // audit 도 rank 스트림 관찰(둘째 소비자의 둘째 소비자)
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
  if (inventory) add({ addr: 'inventory', kind: 'inventory', opts: { gateway: 'gateway', bus: busAddr, persist: persistAddr, persistBackup: persistBackupAddr, replicas: persistReplicaAddrs, quorumW: persistAddr ? quorumW : 0, windowFill: persistAddr ? windowFill : false, wfWindow: persistAddr ? wfWindow : 0, snapshot: persistAddr ? snapshot : 0, reliable: persistAddr ? journalReliable : false, journalHb: persistAddr ? journalHeartbeat : false } });
  // [데이터] 채팅 영속 스토어(이 step) — chatpersist ON 일 때만 존재(OFF = 0020 토폴로지 비트 동일). PersistStore *재사용*(범용 저널) —
  //   가방 persist 와 *독립 인스턴스*(채팅 커맨드 로그). 채팅보다 먼저 등록(onTick 0·순서 무관). 채팅이 죽어도 이 박스는 산다(데이터 계층).
  if (chatPersistAddr) add({ addr: 'chatpersist', kind: 'persist', opts: {} });
  // [게임 서비스] 채팅 — chat ON 일 때만 토폴로지에 존재(OFF = 0014 토폴로지 비트 동일). onTick 없음 = 신성한 tick 밖.
  //   chatpersist ON 이면 자기 데이터 스토어 주소를 안다(write-behind 커맨드 로그 — 명시 인터페이스). OFF 면 null(0020 비트 동일).
  //   snapshot:N (이 step) — chatpersist ON 일 때만 의미(커맨드 N항목마다 라우팅 스냅샷 압축). OFF(0)면 0021 비트 동일.
  if (chat) add({ addr: 'chat', kind: 'chat', opts: { gateway: 'gateway', bus: busAddr, persist: chatPersistAddr, snapshot: chatPersistAddr ? chatSnapshot : 0 } });
  // [게임 서비스] 감사(audit) — 발행자 무수정으로 추가된 새 소비자(bus 전제). 발신 0 = 구조적 비-침습.
  if (bus && audit) add({ addr: 'audit', kind: 'audit', opts: {} });
  // [게임 서비스] 랭킹(ranking) — *발신하는* 둘째 소비자(이 step). svc.item.out 소비 → rank 투영 → svc.rank.out 발행(consume→publish).
  //   bus+가방 전제. OFF 면 토폴로지에 없음(0018 비트 동일). onTick 없음 = 신성한 tick 밖·권위 아닌 읽기 모델(CQRS).
  if (rankingAddr) add({ addr: 'ranking', kind: 'ranking', opts: { bus: busAddr } });

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
    add({ addr: 'orch', kind: 'orch', opts: { leaseTimeout, monitor: [['zone1', 'zone1f'], ['zone2', 'zone2f']] } });
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
    case 'gateway': a = new Gateway(spec.opts.zoneAddrs, spec.opts.replicas, spec.opts.inventoryAddr, spec.opts.chatAddr, spec.opts.busAddr); break;
    case 'zone': a = new EntityZone(spec.seed, spec.opts); break;
    case 'orch': a = new Orchestrator(spec.opts); break;
    case 'inventory': a = new InventoryService(spec.opts); break;
    case 'chat': a = new ChatService(spec.opts); break;
    case 'bus': a = new ServiceBus(spec.opts); break;
    case 'audit': a = new AuditService(spec.opts); break;
    case 'ranking': a = new RankingService(spec.opts); break;
    case 'persist': a = new PersistStore(spec.opts); break;
    case 'client': a = new Client(spec.opts.script); break;
    default: throw new Error('unknown kind ' + spec.kind);
  }
  net.register(spec.addr, a);
  return a;
}

// ════════════════════════════════════════════════════════════════════════
//  run — 인프로세스 모드(engine/Net). 0009 와 *비트 동일*(reg 0). 단일 경로(buildTopology+makeActor)로 구성.
// ════════════════════════════════════════════════════════════════════════
// N-replica quorum read(이 step) — 생존 복제 저장소들의 저널을 seq 로 union(dedup) → 완전 저널 재구성.
//   각 복제가 전송 손실로 *부분* 저널만 가져도 union 이 메운다(어떤 seq 든 ≥1 생존 복제에 있으면 복구 = quorum read 의 핵심·단일 복제보다 강함).
//   snapshot 은 upToSeq 최대인 것 채택(압축 OFF 면 전부 null). 죽은(crash) 스토어는 journal=[] → 기여 0 → 자연히 생존 복제만 union.
function quorumMergeJournals(stores) {
  const bySeq = new Map();
  let snapshot = null;
  for (const s of stores) {
    if (!s) continue;
    for (const e of s.journal) if (!bySeq.has(e.seq)) bySeq.set(e.seq, e);
    if (s.snapshot && (!snapshot || s.snapshot.upToSeq > snapshot.upToSeq)) snapshot = s.snapshot;
  }
  const journal = [...bySeq.values()].sort((a, b) => a.seq - b.seq);
  return { journal, snapshot };
}

function run(opts) {
  const { seed, ticks = 48, transport = null, onTick = null } = opts;
  const topo = buildTopology(opts);
  const net = new Net({ transport, seed });
  const map = new Map();
  for (const spec of topo.specs) map.set(spec.addr, makeActor(spec, net));

  const gateway = map.get('gateway');
  const login = map.get('login');
  const registry = map.get('registry');
  const orch = map.get('orch') || null;
  const inventory = map.get('inventory') || null;
  const chat = map.get('chat') || null;
  const bus = map.get('bus') || null;
  const busSubs = bus ? ((topo.specs.find(s => s.addr === 'bus') || {}).opts || {}).subs || [] : [];   // 정적 subs spec(재협상 원천 — "소비자가 무엇을 구독했나"·0034 버스 failover)
  const audit = map.get('audit') || null;
  const ranking = map.get('ranking') || null;
  const persist = map.get('persist') || null;
  const persist2 = map.get('persist2') || null;
  // N-replica 복제 스토어 핸들(이 step) — persistReplicas≥1 이면 'persist2'..'persistN+1'. [] 면 0027 복구 경로(persist2 단일).
  const replicaAddrs = (opts.persistReplicas >= 1) ? Array.from({ length: opts.persistReplicas }, (_, k) => 'persist' + (k + 2)) : [];
  const replicaStores = replicaAddrs.map(a => map.get(a)).filter(Boolean);
  const chatpersist = map.get('chatpersist') || null;
  const zoneObjs = topo.zoneAddrs.map(a => map.get(a));
  const followers = ['zone1f', 'zone2f'].map(a => map.get(a)).filter(Boolean);
  const clis = topo.specs.filter(s => s.kind === 'client').map(s => map.get(s.addr));
  const allZones = zoneObjs.concat(followers);

  const trace = [], seenTrace = [], deltaTrace = [], replicaTrace = [];
  let prevDeltaRec = 0;
  for (let i = 0; i < ticks; i++) {
    // 가방 서비스 failover(이 step) — invRestart.at tick 의 deliver *직전*에 crash+replay. 제어 평면(net.log 비-기여) → 멀티프로세스와 비트 동일.
    //   인프로세스 모델: 같은 inventory 객체를 crash()(RAM 소실)한 뒤 PersistStore 저널을 replay(persist ON) → 죽기 전 원장 재현(복구 투명).
    //   persist OFF 면 replay 없음(원장 비고 = 영속 부재의 대가 = 대조군). PersistStore 는 *별 박스*라 crash 의 영향을 안 받는다(데이터 계층 = 세션보다 오래).
    //   주의(write-behind 윈도): 저널은 1-tick 비동기라 crash 시점에 in-flight 항목이 있으면 손실 — 시나리오는 가방이 *정지(quiescent)* 한 늦은 tick 에 재시작해 투명(후속: ack/resend·스냅샷 압축).
    // PersistStore failover(이 step) — persistRestart.at tick 에 primary persist crash(RAM 소실). persist2 가 이 시점까지 전체 저널 보유 → invRestart 가 persist2 에서 복구.
    //   대조군(persistBackup OFF): persist crash → journal 소실 → invRestart replay 불가 → 원장 소실(invDigest 불일치).
    if (opts.persistRestart && i + 1 === opts.persistRestart.at) {
      if (persist) persist.crash();
      // N-replica(이 step) — 지정 복제도 함께 죽임(생존 복제 union 으로 복구되는지 검증). 죽은 스토어는 journal 빔 → merge 기여 0.
      for (const a of (opts.replicaKills || [])) { const s = map.get(a); if (s) s.crash(); }
    }
    if (opts.invRestart && inventory && i + 1 === opts.invRestart.at) {
      inventory.crash();
      if (replicaStores.length) {
        // N-replica quorum-merge 복구(이 step) — 생존 복제(+primary)들의 저널 union → replay. primary 포함 최대 N개 죽어도 무손실(생존 복제가 메움).
        const merged = quorumMergeJournals([persist, ...replicaStores]);
        inventory.replay(merged.journal, merged.snapshot);
      } else {
        // persistBackup ON(0027) 이고 primary 가 crash 된 경우 persist2 에서 복구 — 단일점 제거 가설.
        const recoveryPersist = (persist2 && opts.persistRestart) ? persist2 : persist;
        if (recoveryPersist) inventory.replay(recoveryPersist.journal, recoveryPersist.snapshot);   // 스냅샷(0018)+tail replay — 압축 OFF 면 snapshot=null(0017 전체 저널)
      }
    }
    // in-flight give 손실 복구(이 step) — clientResync.at 의 deliver *직전*에 클라들이 확인된 give 를 *재발행*(가방 복구 핸드셰이크의 클라 측).
    //   복구 원장은 in-flight 손실 give 효과가 빠져 있다(아이템이 sender 소유로 되돌려짐) → 재발행이 그 전송을 재적용 → 원장이 클라 belief 따라잡음(itemDesync→0).
    //   제어 평면 트리거(invRestart 처럼 run 루프가 주입) — 재발행 메시지는 client→gateway→inventory 정규 라우팅. clientResync 미제공/clientResend OFF 면 호출 0(reg 0 불변).
    if (opts.clientResync && i + 1 === opts.clientResync.at) for (const c of clis) { c.resendGives(); c.sendReconcile(); }   // 0025 give-resend + 이 step mint reconcile 동시 트리거
    // 읽기 모델(랭킹) failover(이 step 의 한 조각) — rankRestart.at 의 deliver *직전*에 crash+reconstruct(invRestart 와 같은 위치·제어 평면).
    //   읽기 모델은 *자기 영속이 없다* — crash(RAM 소실) 후 *쓰기 모델의 영속 저널*(PersistStore)을 reconstruct 해 투영을 재계산한다
    //   (CQRS late-join: 휘발 svc.item.out 스트림이 아니라 *내구 저널*이 복구원). persist OFF 면 reconstruct 없음 = 투영 소실(영속 부재의 대가 = 대조군).
    //   늦은 quiescent tick(활동 정지 후)이라 클라 rankBelief 는 이미 수렴 — 재발행 불필요(rankDesync 0 유지). PersistStore 는 별 박스라 ranking 죽음과 독립.
    if (opts.rankRestart && ranking && i + 1 === opts.rankRestart.at) {
      ranking.crash();
      if (persist) ranking.reconstruct(persist.journal, persist.snapshot);   // 쓰기 저널 replay → 투영 재계산(스냅샷 압축 베이스 + tail). persist OFF → 소실.
    }
    // 채팅 서비스 failover(이 step 의 한 조각) — chatRestart.at 의 deliver *직전*에 crash+replay(invRestart 와 같은 위치·제어 평면·net.log 비-기여).
    //   가방(0017)이 *효과 저널*(mint/xfer)을 replay 했다면, 채팅은 *커맨드 로그*(join/say/whisper/leave)를 replay 해 라우팅 테이블+deliveries 를
    //   리듀서 재실행으로 재현(순수 event sourcing·재발신 0). chatpersist OFF 면 replay 없음 = 구독/배달 소실(영속 부재의 대가 = 대조군).
    //   늦은 quiescent tick(채팅 정지 후)라 클라 belief 는 이미 수렴. PersistStore 는 별 박스라 채팅 죽음과 독립(데이터 계층 = 세션보다 오래).
    if (opts.chatRestart && chat && i + 1 === opts.chatRestart.at) {
      chat.crash();
      if (chatpersist) chat.replay(chatpersist.journal, chatpersist.snapshot);   // 라우팅 스냅샷(이 step)+tail 커맨드 replay → 라우팅+deliveries 재현. chatpersist OFF → 소실.
    }
    // 버스 동적 구독/해지(이 step) — busReSub.at tick 의 net.step *직전*에 지정 소비자가 bus 에 sub/unsub 발신(제어 평면·정규 라우팅).
    //   op={at,from,type:'sub'|'unsub',topic} — actor→bus 정규 net.send(시드 로그의 일부 = 결정론). 버스가 다음 step 에서 처리해 라우팅 테이블을 *양방향*으로 갱신.
    //   미제공이면 호출 0(reg 0 불변 — unsub/동적 sub 코드 휴면). 멀티프로세스 E2E 는 busReSub 를 안 주므로 cluster.js 무수정.
    if (opts.busReSub && bus) for (const op of opts.busReSub) if (op.at === i + 1) net.send(op.from, 'bus', { type: op.type, topic: op.topic });
    // 버스 failover(이 step) — busRestart.at 에 bus.crash()(라우팅 RAM 소실 → 서비스 경로 단절), renegAt 에 *구독 재협상*(0033 동적 sub).
    //   버스는 파생 상태(라우팅)만 들고 진실 원천은 소비자다 → 복구 = 소비자들이 (같은 주소의) 버스에 *재구독*(정적 subs spec 을 sub 메시지로 재발신).
    //   renegAt 없으면 재협상 0 = 영구 단절(대조군 — 버스 단일점의 대가). busRestart 미제공이면 crash 0(reg 0 불변). 발행자(gateway/inventory…)는 같은 'bus' 주소라 무수정.
    if (opts.busRestart && bus) {
      if (i + 1 === opts.busRestart.at) bus.crash();
      if (opts.busRestart.renegAt && i + 1 === opts.busRestart.renegAt)
        for (const [topic, addr] of (busSubs || [])) net.send(addr, 'bus', { type: 'sub', topic });   // 각 소비자가 재구독(재협상) → 라우팅 재구성
    }
    // 시나리오 inject write-seam(TESTBED §10-4 — 0011 onTick 선례) — 미제공이면 호출 0(reg 0 불변).
    //   cmd={tick,client,move:[dx,dy]} — tick 직전에 클라 발신으로 주입(게이트웨이엔 정규 move 와 동일·시드 로그의 일부 = 결정론).
    if (opts.inject) for (const c of opts.inject) if (c.tick === i + 1 && c.move) net.send('client' + c.client, 'gateway', { type: 'move', d: { dx: c.move[0] | 0, dy: c.move[1] | 0 } });
    net.step();
    const committed = new Map();
    for (const z of allZones) if (z.isAuthority()) for (const av of z.ents.keys()) committed.set(av, (committed.get(av) || 0) + 1);
    const inflight = inflightSet(net, allZones);
    const live = new Set([...committed.keys(), ...inflight]);
    trace.push({ tick: i + 1, committed, inflight, liveN: live.size });
    seenTrace.push(clis.map(c => c.seenSig()));
    const curDeltaRec = zoneObjs.reduce((a, z) => a + z.deltaEnter + z.deltaExit + z.deltaUpdate, 0);
    deltaTrace.push(curDeltaRec - prevDeltaRec); prevDeltaRec = curDeltaRec;
    if (opts.failover) replicaTrace.push(replicaDivergence(zoneObjs, followers));
    // 옵션 onTick(t, state) 훅 — 미제공이면 호출 0(reg 0 불변). 레코더의 per-tick 엔티티 위치·AOI 시각화 활성용
    //   (TESTBED 마무리 ⒜·STATE §2). state.ents = [{id,x,y,zone,authority}], state.radius = AOI 반경.
    if (onTick) {
      const ents = [];
      for (const z of allZones) if (z.isAuthority()) for (const [id, e] of z.ents) ents.push({ id, x: e.x, y: e.y, zone: z.addr, authority: true });
      onTick(i + 1, { ents, radius: topo.radius, grid: topo.grid });
    }
  }
  const sum = (f) => zoneObjs.reduce((a, z) => a + f(z), 0);
  const sumAll = (f) => allZones.reduce((a, z) => a + f(z), 0);
  const totals = {
    sent: sum(z => z.sent), views: sum(z => z.views),
    handoffs: sum(z => z.handoffsSent), acquired: sum(z => z.handoffsAcquired),
    ghostEnts: sum(z => z.ghostEntsSent), ghostMsgs: sum(z => z.ghostMsgs),
    deltaEnter: sum(z => z.deltaEnter), deltaExit: sum(z => z.deltaExit), deltaUpdate: sum(z => z.deltaUpdate),
    deltaMsgs: sum(z => z.deltaMsgs), resets: sum(z => z.resets),
    retransmits: sum(z => z.retransmits), acksRx: sum(z => z.acksRx), naksRx: sum(z => z.naksRx),
    keyframesForced: sumAll(z => z.keyframesForced), heartbeats: sum(z => z.heartbeats),
    promotionKeyframes: sumAll(z => z.promotionKeyframes),
    leasesSent: sumAll(z => z.leasesSent),
    naksSent: clis.reduce((a, c) => a + c.naksSent, 0),
    staleDrops: clis.reduce((a, c) => a + c.staleDrops, 0),
    promotions: orch ? orch.promotions : 0,
  };
  totals.deltaRecords = totals.deltaEnter + totals.deltaExit + totals.deltaUpdate;
  totals.netLost = net.stats.lost;
  return { net, login, registry, gateway, orch, inventory, chat, bus, audit, ranking, persist, persist2, replicaStores, chatpersist, zones: zoneObjs, followers, allZones, zoneAddrs: topo.zoneAddrs, clients: clis, trace, seenTrace, deltaTrace, replicaTrace, totals, H: topo.H, grid: topo.grid, radius: topo.radius, deathTick: opts.deathTick != null ? opts.deathTick : null, killZone: opts.killZone || 'zone1', mode: 'inproc' };
}

// ════════════════════════════════════════════════════════════════════════
//  runMulti — 멀티프로세스 모드(토픽 pub/sub 버스 + 소켓 층 열화). cluster.js 에 위임(Node 한정).
//   같은 buildTopology 로 토폴로지를 짜고, 각 서버 박스를 별 프로세스(spawn — IPC 0)에 띄워 broker(버스 허브)와
//   *토픽 발행/구독*으로 묶어 lockstep 배리어로 구동. opts.wire(드롭·분단·재연결)로 링크 열화를 주입.
//   반환 r 은 run() 과 같은 digest 함수들이 그대로 먹는 형태(zones/clients/net.log) + r.cluster(버스/열화 계측).
// ════════════════════════════════════════════════════════════════════════
function runMulti(opts) {
  if (typeof require === 'undefined') throw new Error('runMulti 는 Node 전용');
  return require('./cluster.js').runMulti(opts, { buildTopology, Net, fnv1a });
}

const __part = { routeFilters, buildTopology, makeActor, quorumMergeJournals, run, runMulti };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).topology = __part;
