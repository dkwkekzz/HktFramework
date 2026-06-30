// HktInfra step-0414 — #62 코드 합류 4: runMultiViaCoord 결과 info 에 옛 runMulti clusterInfo 전송/토폴로지 필드(pids·parentPid·port·ipcMsgs/Bytes·allSerializable·wire) parity 병합. 미부착 → reg 0.
// HktInfra step-0413 — #62 코드 합류 3: runMultiViaCoord(opts,deps,probe) — coordSetup+coordScenarioFromOpts+runScenario 를 묶은 단일 진입점(코디네이터를 한 호출로 구동·집계). 미부착 → reg 0.
// HktInfra step-0412 — #62 코드 합류 2: coordScenarioFromOpts(opts) — runMulti 스크립트 열화 스펙(opts.coordSc)을 코디네이터 runScenario 시나리오로 번역. 순수 함수·미부착 → reg 0.
// HktInfra step-0411 — #62 코드 합류 1: coordSetup(opts,deps) — 코디네이터 zone-cluster 배선을 단일 함수로 패키지(verify 손배선 흡수). run() 미사용·OFF-게이트 → reg 0. (아래 §코드 합류)
// HktInfra step-0048 — cluster 분할 ④: computePlacement + runMulti(멀티프로세스 lockstep 드라이버). cluster.js 에서 추출.
//   기능 0 — Cluster(cluster-core)·reconstruct(cluster-reconstruct)를 조립해 멀티프로세스 E2E 를 구동. 바이트 동일(verbatim 이동) → reg 0.
'use strict';
const { Cluster } = require('./cluster-core.js');
const { reconstruct } = require('./cluster-reconstruct.js');
const { makeClusterCoordinator } = require('./cluster-coord.js');

// 배치(placement): addr → hostId. 기본 = 각 서버 박스가 자기 프로세스, 클라는 한 호스트(엣지). 0012 그대로.
function computePlacement(topo, custom) {
  const m = new Map();
  if (custom) { for (const [a, h] of Object.entries(custom)) m.set(a, h); return m; }
  for (const s of topo.specs) m.set(s.addr, s.kind === 'client' ? 'clients' : s.addr);
  return m;
}

// ── 멀티프로세스 실행 — 같은 buildTopology, lockstep 배리어로 구동. 와이어(버스·열화·kill 생애주기)만 교체. ──
async function runMulti(opts, deps) {
  const { buildTopology, Net } = deps;
  const topo = buildTopology(opts);
  const placement = computePlacement(topo, opts.placement);
  const hostIds = [...new Set([...placement.values()])];
  const specsByHost = new Map();
  for (const h of hostIds) specsByHost.set(h, []);
  for (const s of topo.specs) specsByHost.get(placement.get(s.addr)).push(s);

  const net_ = new Net({ transport: opts.transport || null, seed: opts.seed });
  const cluster = new Cluster(hostIds, opts.wire || null);
  await cluster.spawn();
  await cluster.init(specsByHost);
  if (opts.tap) for (const t of opts.tap) cluster.tap(t.topic, t.fn);

  const ticks = opts.ticks || 48;
  const order = topo.order;
  const placeOf = (addr) => placement.get(addr);
  const W = opts.wire || {};
  const H = topo.H;
  const guessThreshold = opts.leaseTimeout || 3;   // 타임아웃 추측 임계(침묵 tick 수)

  // 열화 시나리오 핸들
  const part = W.partition || null;                // 0012 분단(링크 침묵·호스트 생존)
  const partHost = part ? placeOf(part.host) : null;
  const kill = W.kill || null;                      // 0013 진짜 kill(프로세스 소멸)
  const killHost = kill ? placeOf(kill.host) : null;
  const fd = W.falsedeath || null;                 // 0013 거짓 사망(침묵→복귀·살아 있음)
  const fdHost = fd ? placeOf(fd.host) : null;
  const rep = W.reprovision || null;               // 0013 재-provisioning(죽은 자리 새 프로세스)
  const invRestart = opts.invRestart || null;      // 0017 가방 failover(진짜 kill→새 호스트 replay)
  const rankRestart = opts.rankRestart || null;    // 0020 읽기 모델(랭킹) failover(진짜 kill→새 호스트 reconstruct·쓰기 저널)
  const chatRestart = opts.chatRestart || null;    // 0021 채팅 failover(진짜 kill→새 호스트 커맨드 로그 replay)
  const persistPlaced = placement.has('persist');  // 영속 스토어 존재(replay/reconstruct 소스 — 안 죽는다)
  const chatPersistPlaced = placement.has('chatpersist');  // 채팅 영속 스토어 존재(이 step·채팅 커맨드 로그 — 안 죽는다)
  let invRestartDone = false;
  let rankRestartDone = false;
  let chatRestartDone = false;

  // ── 침묵/펜스 판정 ──
  const downForDeliver = (h, T) => {
    if (cluster.socketDead.has(h)) return true;                 // 진짜 kill — 소켓 사망
    if (part && h === partHost) return T > part.at;             // 분단 윈도(deliver 는 at 까지 정상)
    if (fd && h === fdHost) return T > fd.at && T < fd.healAt;  // 거짓 사망 침묵 구간
    return false;
  };
  const downForTick = (h, T) => {
    if (cluster.socketDead.has(h)) return true;
    if (part && h === partHost) return T >= part.at;            // 분단 윈도(tick 은 at 부터 침묵)
    if (fd && h === fdHost) return T >= fd.at && T < fd.healAt;
    return false;
  };
  // 거짓 사망 복귀 — 호스트는 *살아 돌아와* 권위 재개 시도하나, presumedDead(stale epoch) 라 발신 전량 드롭(펜싱).
  const fenceSendsFrom = (h, T) => (fd && h === fdHost && T >= fd.healAt && cluster.presumedDead.has(h));

  // 타임아웃 추측 — 침묵 tick 을 세어 임계 초과 시 presumedDead 선언(윈도 아닌 *추측*) + epoch++.
  const observeSilence = (h, T) => {
    if (cluster.socketDead.has(h)) return;   // 진짜 kill 은 소켓 신호로 *감지* — 추측 경로 아님
    const n = (cluster.silentTicks.get(h) || 0) + 1;
    cluster.silentTicks.set(h, n);
    if (n >= guessThreshold && !cluster.presumedDead.has(h)) {
      cluster.presumedDead.add(h);
      cluster.epoch++;
      cluster.presumedDeadTick.set(h, T);
      cluster.deadAddrs.add(fd ? fd.host : h);   // 추측 사망 → reconstruct 에서 비권위
    }
  };

  for (let T = 0; T < ticks; T++) {
    // 시나리오 inject write-seam — run() 의 inject 와 *같은 위치*(tick 직전·net_.send): 멀티프로세스도 비트 동일(미제공=no-op).
    if (opts.inject) for (const c of opts.inject) if (c.tick === T + 1 && c.move) net_.send('client' + c.client, 'gateway', { type: 'move', d: { dx: c.move[0] | 0, dy: c.move[1] | 0 } });
    net_.tick++;
    // ── 가방 failover(0017) — tick 의 deliver *직전*(인프로세스 run() 의 crash+replay 와 같은 위치). 제어 평면(net_.log 비-기여). ──
    //   ① persist(안 죽음)에서 저널 읽기 ② 가방 호스트 진짜 kill(RAM 소실) ③ 새 호스트 spawn·init·replay(저널) ④ 'inventory' 라우팅 전환.
    if (invRestart && placement.has('inventory') && net_.tick === invRestart.at && !invRestartDone) {   // inventory 존재 가드(인프로세스 run() 의 `&& inventory` 와 정합 — 부재 시 no-op·모드 발산 방지)
      invRestartDone = true;
      const oldHost = placeOf('inventory');
      let journal = [], snapshot = null;
      if (persistPlaced) { const snap = await cluster.snapshotOne(placeOf('persist'), 'persist'); journal = (snap && snap.journal) || []; snapshot = (snap && snap.snapshot) || null; }
      await cluster.killHost(oldHost);                                   // 진짜 child.kill — 가방 프로세스 소멸(소켓 RST)
      const invSpec = topo.specs.find(s => s.addr === 'inventory');
      const newHost = 'inventory_r';
      placement.set('inventory', newHost);                              // 이후 'inventory' deliver/tick 라우팅을 새 호스트로
      await cluster.spawnOne(newHost);
      await cluster.rpc(newHost, { cmd: 'init', specs: [invSpec] });    // 빈 InventoryService(crash 직후 상태)
      await cluster.rpc(newHost, { cmd: 'replay', addr: 'inventory', journal, snapshot });   // 스냅샷(이 step)+tail replay → 죽기 전 원장 재현
      cluster.invRestarted = { at: invRestart.at, oldHost, newHost, entries: journal.length };
    }
    // ── 읽기 모델(랭킹) failover(0020) — invRestart 와 *같은 위치·기법*. 자기 영속 0 인 읽기 모델을 *쓰기 모델 저널*로 reconstruct. ──
    //   ① persist(안 죽음)에서 저널 읽기 ② 랭킹 호스트 진짜 kill(RAM 투영 소실) ③ 새 호스트 spawn·init·reconstruct(쓰기 저널) ④ 'ranking' 라우팅 전환.
    //   reconstruct 는 발신 0(inventory.replay 처럼 비-침습) → net_.log 비-기여 → 인프로세스 run() 의 crash()+reconstruct() 와 비트 동일.
    if (rankRestart && placement.has('ranking') && net_.tick === rankRestart.at && !rankRestartDone) {   // ranking 존재 가드(인프로세스 run() 의 `&& ranking` 와 정합)
      rankRestartDone = true;
      const oldHost = placeOf('ranking');
      let journal = [], snapshot = null;
      if (persistPlaced) { const snap = await cluster.snapshotOne(placeOf('persist'), 'persist'); journal = (snap && snap.journal) || []; snapshot = (snap && snap.snapshot) || null; }
      await cluster.killHost(oldHost);                                  // 진짜 child.kill — 랭킹 프로세스 소멸(RAM 투영 소실)
      const rankSpec = topo.specs.find(s => s.addr === 'ranking');
      const newHost = 'ranking_r';
      placement.set('ranking', newHost);                               // 이후 'ranking' deliver/tick 라우팅을 새 호스트로(구독 주소→호스트 해소는 placement 기반)
      await cluster.spawnOne(newHost);
      await cluster.rpc(newHost, { cmd: 'init', specs: [rankSpec] });   // 빈 RankingService(crash 직후 상태)
      await cluster.rpc(newHost, { cmd: 'reconstruct', addr: 'ranking', journal, snapshot });   // 쓰기 저널 reconstruct → 죽기 전 투영 재계산
      cluster.rankRestarted = { at: rankRestart.at, oldHost, newHost, entries: journal.length };
    }
    // ── 채팅 failover(0021) — invRestart 와 *같은 위치·기법*. 채팅 라우팅 테이블을 *커맨드 로그*로 replay(리듀서 재실행). ──
    //   ① chatpersist(안 죽음)에서 커맨드 로그 읽기 ② 채팅 호스트 진짜 kill(RAM 라우팅 소실) ③ 새 호스트 spawn·init·replay(커맨드 로그) ④ 'chat' 라우팅 전환.
    //   replay 는 재발신 0(replaying 가드 — inventory.replay 처럼 비-침습) → net_.log 비-기여 → 인프로세스 run() 의 crash()+replay() 와 비트 동일.
    if (chatRestart && placement.has('chat') && net_.tick === chatRestart.at && !chatRestartDone) {   // chat 존재 가드(인프로세스 run() 의 `&& chat` 와 정합)
      chatRestartDone = true;
      const oldHost = placeOf('chat');
      let journal = [], snapshot = null;
      if (chatPersistPlaced) { const snap = await cluster.snapshotOne(placeOf('chatpersist'), 'chatpersist'); journal = (snap && snap.journal) || []; snapshot = (snap && snap.snapshot) || null; }
      await cluster.killHost(oldHost);                                  // 진짜 child.kill — 채팅 프로세스 소멸(RAM 라우팅 소실)
      const chatSpec = topo.specs.find(s => s.addr === 'chat');
      const newHost = 'chat_r';
      placement.set('chat', newHost);                                  // 이후 'chat' deliver/tick·구독 라우팅을 새 호스트로(placement 기반)
      await cluster.spawnOne(newHost);
      await cluster.rpc(newHost, { cmd: 'init', specs: [chatSpec] });   // 빈 ChatService(crash 직후 상태)
      await cluster.rpc(newHost, { cmd: 'replay', addr: 'chat', journal, snapshot });   // 라우팅 스냅샷(이 step)+tail 커맨드 replay → 죽기 전 라우팅+deliveries 재현
      cluster.chatRestarted = { at: chatRestart.at, oldHost, newHost, entries: journal.length };
    }
    // ── deliver phase ──
    const due = net_.queue.get(net_.tick) || [];
    net_.queue.delete(net_.tick);
    const dgroups = new Map(); let gi = 0;
    const mirrorItems = new Map();   // dstHost -> [{gi,m}] (권위 입력을 standby 로 미러)
    for (const m of due) {
      if (net_.delivered.has(m.id)) { net_.stats.dupSkipped++; continue; }
      net_.delivered.add(m.id);
      const delay = net_.tick - m.tick - 1; if (delay > net_.stats.maxDelay) net_.stats.maxDelay = delay;
      net_.stats.deliveredN++;
      // 미러 캡처 — 권위(src) 로 가는 입력의 사본을 standby(dst) 로(권위가 받는 것만).
      if (cluster.mirrors.length) for (const mir of cluster.mirrors) if (m.to === mir.srcAddr) {
        if (!mirrorItems.has(mir.dstHost)) mirrorItems.set(mir.dstHost, []);
        const arr = mirrorItems.get(mir.dstHost);
        arr.push({ gi: arr.length, m: { ...m, to: mir.dstAddr } });
      }
      const h = placeOf(m.to); if (h == null) continue;
      if (downForDeliver(h, net_.tick)) { cluster.fencedAttempts++; continue; }   // 침묵 링크/죽은 소켓 — 배달 안 함
      if (!dgroups.has(h)) dgroups.set(h, []);
      dgroups.get(h).push({ gi: gi++, m });
    }
    if (dgroups.size) {
      const res = await Promise.all([...dgroups].map(([h, items]) => cluster.rpc(h, { cmd: 'deliver', items }).then(r => ({ h, results: r.results || [] }))));
      const sends = [];
      for (const { h, results } of res) {
        const fenced = fenceSendsFrom(h, net_.tick);
        for (const { gi, sends: ss } of results) ss.forEach((s, si) => { if (fenced) cluster.epochFenced++; else sends.push({ gi, si, s }); });
      }
      sends.sort((a, b) => a.gi - b.gi || a.si - b.si);
      for (const { s } of sends) net_.send(s.from, s.to, s.payload);
    }
    // 미러 deliver(standby) — 결과 폐기(shadow=발신 0, net_ 무오염). 권위 경로와 격리.
    if (mirrorItems.size) for (const [dstHost, items] of mirrorItems) {
      await cluster.rpc(dstHost, { cmd: 'deliver', items });
      cluster.mirrorDeliveries += items.length;
    }

    // ── 진짜 kill 주입(열화) — deliver 후·tick 전(=분단 윈도 deliver T>at·tick T>=at 와 정합). ──
    if (kill && net_.tick === kill.at && !cluster.killed.has(killHost)) {
      await cluster.killHost(killHost);
      cluster.deadAddrs.add(kill.host);
    }

    // ── tick phase ──
    const tgroups = new Map();
    order.forEach((addr, idx) => {
      const h = placeOf(addr);
      if (downForTick(h, net_.tick)) { cluster.fencedAttempts++; observeSilence(h, net_.tick); return; }
      if (!tgroups.has(h)) tgroups.set(h, []);
      tgroups.get(h).push({ gi: idx, addr });
    });
    const tres = await Promise.all([...tgroups].map(([h, items]) => cluster.rpc(h, { cmd: 'tick', tick: net_.tick, items }).then(r => ({ h, results: r.results || [] }))));
    const tsends = [];
    for (const { h, results } of tres) {
      const fenced = fenceSendsFrom(h, net_.tick);
      for (const { gi, sends: ss } of results) ss.forEach((s, si) => { if (fenced) cluster.epochFenced++; else tsends.push({ gi, si, s }); });
    }
    tsends.sort((a, b) => a.gi - b.gi || a.si - b.si);
    for (const { s } of tsends) net_.send(s.from, s.to, s.payload);
    // 미러 tick(standby) — onTick 으로 pending 적용·복제 유지. 결과 폐기(발신 0).
    if (cluster.mirrors.length) for (const mir of cluster.mirrors)
      await cluster.rpc(mir.dstHost, { cmd: 'tick', tick: net_.tick, items: [{ gi: 0, addr: mir.dstAddr }] });

    // ── 재-provisioning 주입 — kill→승격 후 N=1 을 새 standby 로 복원(상태 동기 + 미러). ──
    if (rep && net_.tick === rep.at && !cluster._reprovDone) {
      cluster._reprovDone = true;
      const srcHost = placeOf(rep.srcAddr);
      const snap = await cluster.snapshotOne(srcHost, rep.srcAddr);   // 권위(승격된 추종자) 상태 동기 소스
      const shadowSpec = {
        addr: rep.newAddr, kind: 'zone', seed: opts.seed, opts: {
          grid: opts.grid || 16, radius: opts.radius !== undefined ? opts.radius : 4,
          incremental: opts.incremental !== false, recovery: opts.recovery === true,
          // 승격된 권위(src)와 *같은 sibling*(경계 핸드오프 동치) → 같은 ents 진화. shadow·orch 0 → 발신 0(비-침습).
          failover: false, shadow: true, region: { lo: 0, hi: H }, sibling: rep.sibling || null, boundary: H, orch: null,
        },
      };
      placement.set(rep.newAddr, rep.newHost);
      await cluster.spawnOne(rep.newHost);
      await cluster.rpc(rep.newHost, { cmd: 'init', specs: [shadowSpec] });
      await cluster.rpc(rep.newHost, { cmd: 'loadstate', addr: rep.newAddr, state: snap });   // 스냅샷 상태 주입(late-join 복구)
      cluster.reprovAddrs.push(rep.newAddr);
      cluster.mirrors.push({ srcAddr: rep.srcAddr, dstAddr: rep.newAddr, dstHost: rep.newHost });
    }
  }

  // ── 재연결+펜싱(0012 분단 경로) — 분단 호스트가 복귀(살아 있음)해도 펜스로 출력 수용 0. ──
  if (part) { await cluster.fence(partHost, part.host); cluster.deadAddrs.add(part.host); }

  const snaps = await cluster.snapshotAll();
  const clusterInfo = {
    pids: cluster.pids(), livePids: cluster.livePids(), parentPid: process.pid, hostIds: cluster.hostIds.slice(),
    pidByHost: [...cluster._pids.entries()],   // hostId→pid (hello 순서 무관 정확 매핑)
    placement: [...placement.entries()],
    port: cluster.port,
    ipcMsgs: cluster.frames, ipcBytes: cluster.bytes,
    ipcMsgsIn: cluster.framesIn, ipcBytesIn: cluster.bytesIn,
    frames: cluster.frames, socketBytes: cluster.bytes,
    framesIn: cluster.framesIn, socketBytesIn: cluster.bytesIn,
    allSerializable: cluster.allSerializable, wire: 'topic-bus',
    publishes: cluster.publishes, topics: [...cluster.subs.keys()], tapDeliveries: cluster.tapDeliveries,
    dropped: cluster.dropped, resends: cluster.resends, dupCmds: cluster.dupCmds, idempotentHits: cluster.idempotentHits,
    partitionHost: part ? part.host : null, partitionAt: part ? part.at : null,
    fencedHost: cluster.fencedHost, reconnectedAlive: cluster.reconnectedAlive, fencedAttempts: cluster.fencedAttempts,
    // ── 진짜 kill 생애주기 계측(0013) ──
    killedHost: kill ? kill.host : null, killAt: kill ? kill.at : null,
    killed: [...cluster.killed], socketClosed: cluster.socketClosed,
    presumedDead: [...cluster.presumedDead], presumedDeadTick: [...cluster.presumedDeadTick.entries()],
    epoch: cluster.epoch, epochFenced: cluster.epochFenced,
    falsedeathHost: fd ? fd.host : null, falsedeathAt: fd ? fd.at : null, healAt: fd ? fd.healAt : null,
    reprovisioned: cluster.reprovisioned.slice(), reprovAddrs: cluster.reprovAddrs.slice(),
    mirrorDeliveries: cluster.mirrorDeliveries, deadAddrs: [...cluster.deadAddrs],
    invRestarted: cluster.invRestarted,   // 0017 가방 failover
    rankRestarted: cluster.rankRestarted, // 0020 읽기 모델(랭킹) failover
    chatRestarted: cluster.chatRestarted, // 0021 채팅 failover
  };
  await cluster.shutdown();
  return reconstruct(net_, topo, snaps, placement, clusterInfo, opts);
}

// ════════════════════════════════════════════════════════════════════════
//  #62 코드 합류 — 코디네이터를 runMulti zone-cluster 복원력의 *단일 진입점*으로 (0411~).
//   0401~0410 이 cluster-coord.js(ClusterCoordinator)에 runMulti 복원력의 *superset*(fence·silence·restart·
//   reprovision·mirror·promote·runScenario·clusterInfo·runMultiCoherent)을 쌓았다. 남은 #62 = 옛 runMulti(전 토폴로지
//   lockstep)와 *병존*하던 그 능력을, cluster-run.js 가 소유한 단일 진입점으로 묶어 runMulti 가 zone-cluster 복원력을
//   코디네이터로 *호출*하게 한다. 이 블록이 그 진입점 — run() 데이터 평면 미수정·미부착(verify 만 호출)→reg 0.
// ════════════════════════════════════════════════════════════════════════

// coordSetup(opts, deps) — runMulti-스타일 opts 로 코디네이터 zone-cluster 배선을 한 번에 구성(0411·#62).
//   verify 가 0401~0410 내내 손으로 짜던 4단(run→orch/driver→Cluster spawn→makeClusterCoordinator)을 한 함수로 흡수.
//   ① deps.run(opts) = in-proc 권위(orch·orch.clusterDriver) — 코디네이터가 실 cluster 를 이 권위에 수렴시킨다(읽기만)
//   ② new Cluster([]) spawn(빈 broker — start()/reconcile 이 host 를 채운다) ③ makeClusterCoordinator(orch,cluster,zoneSpecOf,drv).
//   반환={orch, cluster, coord, drv}. 호출자가 coord.start()/runScenario 후 cluster.shutdown(). run() 은 데이터 평면 비-수정 → reg 0.
async function coordSetup(opts, deps) {
  const r = deps.run(opts);
  const orch = r.orch, drv = orch.clusterDriver;
  const cluster = new Cluster([]);
  await cluster.spawn();
  const coord = makeClusterCoordinator(orch, cluster, deps.zoneSpecOf, drv);
  return { orch, cluster, coord, drv };
}

// coordScenarioFromOpts(opts) — runMulti-스타일 열화 스펙(opts.coordSc)을 코디네이터 runScenario 시나리오로 번역(0412·#62).
//   옛 runMulti 은 wire.kill/reprovision 등 스크립트 열화를 tick 루프에 직접 주입했다(cluster-run.js:176·202). 코디네이터 runScenario 는
//   {migrate/reprovision/restart/kill/fence/promote/sweepSilence@at} 선언을 onTick 으로 번역한다(cluster-coord.js runScenario). 이 함수가 그
//   *번역기* — verify 가 매번 손으로 짜던 scenario 객체를 opts.coordSc 한 곳에서 만든다. 0412 는 migrate·reprovision 만(이후 step 이 case 확장).
function coordScenarioFromOpts(opts) {
  const sc = (opts && opts.coordSc) || {};
  const out = {};
  if (sc.migrate) out.migrate = { zone: sc.migrate.zone, from: sc.migrate.from, to: sc.migrate.to, at: sc.migrate.at };
  if (sc.reprovision) out.reprovision = { zone: sc.reprovision.zone, host: sc.reprovision.host, at: sc.reprovision.at };
  return out;
}

// runMultiViaCoord(opts, deps, probe) — #62 코드 합류 단일 진입점(0413). coordSetup→coord.runScenario(coordScenarioFromOpts)→probe→집계→shutdown.
//   옛 runMulti(전 토폴로지 lockstep)의 *zone-cluster 복원력 판*: 코디네이터(0401~0410 superset)를 한 호출로 구동하고 결과를 모은다.
//   probe(coord,cluster) 는 shutdown 전 커스텀 단언/측정(예: 따뜻한 standby a1 보존)용 — 반환값을 result.probe 에 담는다. run() 데이터 평면 미수정→reg 0.
//   반환 { coherent(runMultiCoherent), desync(coordDesync), maxDesync, info(clusterInfo), probe }.
async function runMultiViaCoord(opts, deps, probe) {
  const { cluster, coord } = await coordSetup(opts, deps);
  let result;
  try {
    await coord.runScenario(opts.coordTicks || 6, coordScenarioFromOpts(opts));
    const probed = probe ? await probe(coord, cluster) : undefined;
    const coherent = await coord.runMultiCoherent();
    const desync = await coord.coordDesync();
    // step-0414 — runMulti clusterInfo 반환 계약 parity: 코디네이터 clusterInfo(생애주기)에 실 cluster 전송/토폴로지 필드(옛 runMulti cluster-run.js:227~)를 병합.
    const info = Object.assign(coord.clusterInfo(), {
      pids: cluster.pids(), parentPid: process.pid, port: cluster.port,
      ipcMsgs: cluster.frames, ipcBytes: cluster.bytes, ipcMsgsIn: cluster.framesIn, ipcBytesIn: cluster.bytesIn,
      allSerializable: cluster.allSerializable, wire: 'topic-bus',
    });
    result = { coherent, desync, maxDesync: coord.maxDesync, info, probe: probed };
  } finally { await cluster.shutdown(); }
  return result;
}

module.exports = { runMulti, computePlacement, coordSetup, coordScenarioFromOpts, runMultiViaCoord };
