'use strict';
// step-0141 정리 분할 — topology.js 가 31.5KB>30KB 박스 트리거를 넘겨, *run 드라이버*(quorumMergeJournals·run·runMulti)를
//   topo-run.js 로 분리한다. 이 파일은 인프로세스/멀티프로세스 *구동 루프*(per-tick 제어 평면 주입 + net.step + 회계 집계)를 담고,
//   topology.js 는 *진입점*(build 부품 + run 부품을 묶어 동일 export 노출)으로 남는다 — 기능 0·verbatim 이동·export 집합 불변 → reg 0(0140 비트 동일).
//   0030 net-core·0035 cluster·0038 topology(build 분리)·0098 topo-actors·0133 topo-subs 분할의 계보(이번엔 run 드라이버).
// dual-mode: Node require / 브라우저는 common.js·박스 파일을 <script> 선행 로드(전역 __HktNetCommon·__HktNetParts).
const __c = (typeof module !== 'undefined' && module.exports && typeof require !== 'undefined')
  ? require('./common.js') : globalThis.__HktNetCommon;
const { Net, fnv1a } = __c;
const __p = n => (typeof module !== 'undefined' && module.exports && typeof require !== 'undefined')
  ? require('./' + n + '.js') : globalThis.__HktNetParts[n.replace(/-/g, '_')];
const { inflightSet, replicaDivergence } = __p('metrics');
// 토폴로지 구성 부품(0038/0098/0133 분할) — buildTopology·makeActor 를 topo-build.js 에서 가져와 run 이 쓴다. routeFilters 는 진입점이 직접 재노출.
const { buildTopology, makeActor } = __p('topo-build');
const { applyInjections } = __p('topo-inject');   // step-0261 분할 — per-tick 제어 평면 메시지 주입열(rankDie~inject).
const { applyFailover } = __p('topo-failover');   // step-0262 분할 — crash/failover 복구 주입(persistRestart~busRestart).

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
  // step-0357 (#57) — 실 cluster 호스트 드라이버 주입. clusterDriverReal ON 이면 orch.clusterDriver 를 ClusterHostDriver(orch 이벤트→cluster 명령 번역)로 교체. recorder(clusterDriverRecord)와 배타·OFF→null·호출 0·비트 동일.
  if (opts.clusterDriverReal && orch) orch.clusterDriver = __p('cluster-hostdriver').makeClusterHostDriver();
  const inventory = map.get('inventory') || null;
  const chat = map.get('chat') || null;
  const bus = map.get('bus') || null;
  const busSubs = bus ? ((topo.specs.find(s => s.addr === 'bus') || {}).opts || {}).subs || [] : [];   // 정적 subs spec(재협상 원천 — "소비자가 무엇을 구독했나"·0034 버스 failover)
  const audit = map.get('audit') || null;
  const ranking = map.get('ranking') || null;
  const ranking2 = map.get('ranking2') || null;   // 대체 소비자(step-0061·spawnReplace) — standby. spawnReplace OFF 면 null(0060 동일).
  const presmon = map.get('presmon') || null;      // 프레즌스 모니터(step-0063·presenceMonitor) — svc.presence 읽기 모델. OFF 면 null(0062 동일).
  const presence = map.get('presence') || null;    // 전용 프레즌스 박스(step-0064·presenceBox) — 프레즌스 SSOT. OFF 면 null(0063 동일).
  const presenceShadow = map.get('presence2') || null;   // 프레즌스 박스 shadow(step-0066·presenceShadow) — standby PresenceService. 같은 보고로 SSOT 그림자 복제(active=false·발행 0). OFF 면 null(0065 동일).
  const wrouter = map.get('wrouter') || null;       // 귓속말 라우터(step-0071·whisperRouter) — 프레즌스 질의로 라우팅. OFF 면 null(0070 동일).
  const exchange = map.get('exchange') || null;     // 거래소(step-0107·ExchangeService) — 아이템 escrow 거래. OFF 면 null(0106 동일).
  const market = map.get('market') || null;         // 시세 피드(step-0112·MarketFeed) — 거래소 발행 구독 읽기 모델. OFF 면 null(0111 동일).
  const mail = map.get('mail') || null;             // 우편(step-0142·MailService) — 오프라인 비동기 배송 박스. OFF 면 null(0141 동일).
  const mailfeed = map.get('mailfeed') || null;     // 우편 미읽음 배지(step-0151·MailFeed) — 우편 발행 구독 읽기 모델. OFF 면 null(0150 동일).
  const pservice = map.get('pservice') || null;     // 파티 멤버십 SSOT(step-0075·partyService) — 멤버십 보유. OFF 면 null(0074 동일).
  const instance = map.get('instance') || null;     // 인스턴스(던전) 서버(step-0201·InstanceServer) — spawn/despawn SSOT. instanceService OFF 면 null(0200 동일).
  const cache = map.get('cache') || null;           // 캐시(step-0205·CacheStore) — 핫 데이터 1홉 캐시. cacheService OFF 면 null(0204 동일).
  const worldlog = map.get('worldlog') || null;     // 월드 영속(step-0207·WorldLog) — intent 로그 event sourcing. worldLog OFF 면 null(0206 동일).
  const loginqueue = map.get('loginqueue') || null; // 로그인 큐(step-0209·LoginQueue) — 대기열+티켓. loginQueue OFF 면 null(0208 동일).
  const guild = map.get('guild') || null;           // 길드(step-0181·GuildService) — 로스터+마스터십 SSOT. OFF 면 null(0180 동일).
  const guildfeed = map.get('guildfeed') || null;   // 길드 멤버 수 배지(step-0186·GuildFeed) — svc.guild.changed 구독 읽기 모델. OFF 면 null(0185 동일).
  const mbox = map.get('mbox') || null;             // 귓속말 수신 박스(step-0076·whisperReceipt) — Mailbox. OFF 면 null(0075 동일).
  const mbox2 = map.get('mbox2') || null;           // 둘째 수신 박스(step-0096·mailbox2) — 멤버별 Mailbox. OFF 면 null(0095 동일).
  const persist = map.get('persist') || null;
  const persist2 = map.get('persist2') || null;
  // N-replica 복제 스토어 핸들(이 step) — persistReplicas≥1 이면 'persist2'..'persistN+1'. [] 면 0027 복구 경로(persist2 단일).
  const replicaAddrs = (opts.persistReplicas >= 1) ? Array.from({ length: opts.persistReplicas }, (_, k) => 'persist' + (k + 2)) : [];
  const replicaStores = replicaAddrs.map(a => map.get(a)).filter(Boolean);
  const chatpersist = map.get('chatpersist') || null;
  const zoneObjs = topo.zoneAddrs.map(a => map.get(a));
  const followers = ['zone1f', 'zone2f'].map(a => map.get(a)).filter(Boolean);
  const clis = topo.specs.filter(s => s.kind === 'client').map(s => map.get(s.addr));
  const downclis = topo.specs.filter(s => s.kind === 'downclient').map(s => map.get(s.addr));   // step-0342 (#9 후속) — 수신 전용 다운스트림 클라(desync 0 수렴 검증). downClients 0 면 [].
  const allZones = zoneObjs.concat(followers);

  const trace = [], seenTrace = [], deltaTrace = [], replicaTrace = [];
  let prevDeltaRec = 0;
  // step-0261 분할 — 주입열(topo-inject.applyInjections)이 쓰는 박스 핸들 묶음(루프 전 1회 구성·verbatim 동치).
  const __ctx = { net, map, ranking, inventory, bus, presence, presenceShadow, wrouter, mbox, presmon, exchange, mail, mailfeed, pservice, guild, instance, orch, cache, worldlog, loginqueue };
  // step-0262 분할 — 복구 주입(topo-failover.applyFailover)이 쓰는 핸들 묶음(박스 + quorumMergeJournals 헬퍼·루프 전 1회 구성).
  const __fctx = { net, map, persist, persist2, inventory, replicaStores, quorumMergeJournals, clis, ranking, ranking2, chat, chatpersist, bus, busSubs };
  for (let i = 0; i < ticks; i++) {
    // step-0262 분할 — crash/failover 복구 주입(persistRestart~busRestart 재협상)을 topo-failover.js 로 위임.
    //   verbatim 이동·ctx 핸들만 주입·기능 0(reg 0). 복구 가드는 미제공 옵션/박스에서 휴면 = 직전 step 비트 동일.
    applyFailover(opts, i, __fctx);
    // step-0261 분할 — per-tick 제어 평면 메시지 주입열(rankDie/rankStall/producerInject/presenceFailover/whispers~loginOps/inject)을 topo-inject.js 로 위임.
    //   verbatim 이동·ctx 핸들만 주입·기능 0(reg 0). 주입 가드는 미수신 박스(null)에서 휴면 = 직전 step 비트 동일.
    applyInjections(opts, i, __ctx);
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
  return { net, login, registry, gateway, orch, instance, cache, worldlog, loginqueue, inventory, chat, bus, audit, ranking, ranking2, presmon, presence, presenceShadow, wrouter, pservice, mbox, mbox2, exchange, market, mail, mailfeed, guild, guildfeed, persist, persist2, replicaStores, chatpersist, zones: zoneObjs, followers, allZones, zoneAddrs: topo.zoneAddrs, clients: clis, downclients: downclis, trace, seenTrace, deltaTrace, replicaTrace, totals, H: topo.H, grid: topo.grid, radius: topo.radius, deathTick: opts.deathTick != null ? opts.deathTick : null, killZone: opts.killZone || 'zone1', mode: 'inproc' };
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

const __part = { quorumMergeJournals, run, runMulti };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).topo_run = __part;
