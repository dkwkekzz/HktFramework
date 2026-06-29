'use strict';
// step-0389 — #65 양방향 동기 9: placementCoherent() 양방향 bijection 불변. 코디네이터 placement(where 권위) ⟷ 실 cluster host 의 존 배치가 정확히 일치하는가: ⒜ forward — placement[z]=h 인 모든 존이 실 host h 에 존재 ⒝ reverse — 실 host h 의 모든 존이 placement[z]==h. 양방향 동기의 단일 술어(placement 가 진짜 실 cluster 를 반영). OFF 동치: 미호출이면 0388 동치.
// step-0388 — #65 양방향 동기 8: syncPlan 이 placement 권위 기준(orch.hostSpawnPlan 아님). 0377 syncPlan 은 orch plan 으로 차분했다 → migrate 후엔 stale(z1@A)이라 잘못된 host 에 복원하려 든다. placement(z1@B·실 위치)로 차분해 *옳은* host 에 누락 존 복원. OFF 동치: 정상 경로(placement==orch plan) 결과 동일 = 0387 동치.
// step-0387 — #65 양방향 동기 7: report 가 placement 기준(coordDesync·placement host/zone·lost 계측). 0379 report 는 orch.hostSpawnPlan + driver.clusterDesync 를 써 migrate 후 발산했다(0379 가 migrate 제외한 이유). placement 권위 + coordDesync 로 바꾸면 *migrate/failover 후도* 대시보드가 정합. OFF 동치: 정상 경로(placement==orch plan·lost 0) 결과 동일 = 0386 동치.
// step-0386 — #65 양방향 동기 6: coordDesync 가 lostZones 의 *기대된 부재*를 제외. failover 는 상태 소실(#63)이라 lost 존은 실 cluster 가 비고 orch 권위엔 entity 가 남아 reverse desync(권위에 있는데 실에 부재)가 뜬다 — 이는 *비자발 손실*이지 불일치가 아니다(crash=양쪽 합의된 손실). lost 존은 reverse 검사만 건너뛴다(forward=ghost 검사는 유지 → 유령 주입은 여전히 검출). OFF 동치: lostZones 비면 0385 동치.
// step-0385 — #65 양방향 동기 5: failover 가 placement 갱신 + lost 추적. failover(deadHost,toHost) 가 코디네이터 placement 로 죽은 host 의 존을 찾아 toHost 로 재가동·placement[zone]=toHost 갱신 + lostZones 에 기록(failover 는 상태 소실·#63). lostZones 는 0386 coordDesync 가 *기대된 부재*로 제외할 근거. OFF 동치: failover 미호출이면 0384 동치.
// step-0384 — #65 양방향 동기 4: run 루프 가드·coordCoherent 가 coordDesync(placement 기준) 채택. 0374/0380 은 driver.clusterDesync(orch plan 기준)를 썼다 → migrate 후 발산해 capstone 이 migrate/failover 를 제외해야 했다. coordDesync 로 바꾸면 placement 권위가 lifecycle 을 따라가므로 *migrate 를 포함한* 연속 루프·capstone 이 정합. OFF 동치: 가드 소스만 교체·정상 경로(placement==orch plan) 결과 동일 = 0383 동치.
// step-0383 — #65 양방향 동기 3: migrate 가 placement 갱신(핵심 fix). migrate(zone,from,to) 가 실 cluster 이주 후 this.placement[zone]=to 로 *where 권위*를 갱신 → coordDesync 가 새 host(to)를 조회해 entity 발견 → migrate 후도 desync 0. driver.clusterDesync 는 orch plan(stale·여전히 from)으로 from 조회 → 발산(대조로 #65 입증). OFF 동치: migrate 미호출이면 0382 동치.
// step-0382 — #65 양방향 동기 2: coordDesync() — 코디네이터 placement(zone→host SSOT)로 host 를 조회해 실 cluster vs orch entity 권위(zoneEntityPos·host-무관) 양방향 불일치 수. driver.clusterDesync 는 orch.hostSpawnPlan(stale 가능)으로 host 조회 → migrate 후 발산. coordDesync 는 placement 권위로 조회 → lifecycle 갱신만 따라가면 항상 정확. placement==orch plan 일 땐 driver.clusterDesync 와 동치. OFF 동치: 미호출이면 0381 동치.
// step-0381 — #65 양방향 동기 1: 코디네이터 placement SSOT(zone→host). #62 가 남긴 잔여 — 코디네이터 lifecycle(migrate/failover)이 *실 cluster* 만 바꾸고 orch 권위 placement 는 갱신 안 해(단방향) 실 migrate 후 clusterDesync 가 stale orch plan 으로 발산했다(0379·capstone 이 migrate/failover 제외). 해법: 코디네이터가 *placement 권위*(zone→실 host)를 직접 들고 lifecycle 마다 갱신 → "어느 host 가 어느 존을 도나"의 SSOT 를 코디네이터가 소유(orch=entity 권위/what·코디네이터=placement 권위/where 분리). 이 step=start() 가 orch.hostSpawnPlan 에서 placement 초기화 + placedHost(zone) 질의. OFF 동치: 미사용이면 0380 동치.
// step-0380 — #62 runMulti 코어 통합 10·grand capstone: coordCoherent() — broker 측 제어 평면이 연속 루프 내내(maxDesync==0) *그리고* 지금(clusterDesync==0) 실 cluster 와 in-proc 권위가 한 몸인가의 단일 술어. start→연속 run→drift→syncPlan 자가 치유 뒤에도 참. #62 runMulti 통합 sub-arc(0371~0380) 종합. OFF 동치: 미호출이면 0379 동치.
// step-0379 — #62 runMulti 코어 통합 9: report() 운영 대시보드 — 상주 코디네이터 한 호출로 {ticks·hosts·zones·entities·desync·maxDesync·egressTotal·migrations·failovers·coherent} 종합. broker 측 제어 평면의 현재 상태를 단일 스냅샷으로(운영 관측). OFF 동치: report 미호출이면 0378 동치.
// step-0378 — #62 runMulti 코어 통합 8: 다운스트림 egress 집계. tick 이 산출한 view_delta frame 을 존별(egressByZone)·누계(egressTotal)로 회계 — broker 측 제어 평면이 매 tick 흘려보낸 다운스트림 뷰의 운영 계측(어느 존이 얼마나 송출하나). OFF 동치: 회계만 추가·구동 무변경 = 0377 동치.
// step-0377 — #62 runMulti 코어 통합 7: syncPlan() 상주 reconcile(비파괴) — orch.hostSpawnPlan(SSOT) 대비 실 cluster 의 *누락 존만* zoneadd 로 복원. driver.reconcile(0366)은 전 존 재-zoneadd 라 entity 상태를 리셋(초기 spawn 전용); 상주 제어 평면은 *언제든* 호출돼도 기존 상태를 보존해야 하므로 현 snapshot 과 차분해 빠진 것만 더한다(idempotent·토폴로지 drift 자가 치유). OFF 동치: syncPlan 미호출이면 0376 동치.
// step-0376 — #62 runMulti 코어 통합 6: 상주 failover(deadHost,toHost) — 죽은 host(killHost)의 존들을 생존 host 에 새 인스턴스 재가동(driver.failoverZone·상태 소실·비자발). migrate(graceful·보존)와 대조 — 죽은 host 는 snapshot 불가(정직한 한계). failovers 계측. OFF 동치: failover 미호출이면 0375 동치.
// step-0375 — #62 runMulti 코어 통합 5: 상주 migrate(zone,fromHost,toHost) — driver.migrateZone(snapshot+zoneadd+loadstate+zonedel) 을 코디네이터 상주 lifecycle 메서드로 감싼다(상태 보존 이주·release+acquire·migrations 계측). verify 가 직접 부르던 lifecycle 을 broker 측 제어 평면으로. OFF 동치: migrate 미호출이면 0374 동치.
// step-0374 — #62 runMulti 코어 통합 4: 매-tick desync 가드. run 루프가 매 tick 끝에 driver.clusterDesync 를 측정해 maxDesync(루프 최악)에 누적 — 정합이 *끝*뿐 아니라 *매 tick 내내* 유지됨을 단언(중간 발산 검출). OFF 동치: 측정만 추가·구동 무변경 = 0373 동치.
// step-0373 — #62 runMulti 코어 통합 3: run(ticks) — *연속 tick 루프*. start()(미시작 시) 후 tick(t)을 1..ticks 반복 — cluster-run.js runMulti 의 핵심(broker 측 제어 평면이 매 tick 실 cluster 를 구동)을 상주 코디네이터 한 호출로. OFF 동치: run 미호출이면 0372 동치.
// step-0372 — #62 runMulti 코어 통합 2: tick(t) — 제어 평면 데이터 평면 1 tick. ① pending entity frame 재생(driver.commands deliver→실 zone.onMsg) ② 전 존 1 tick(move 적용+view_delta egress 산출). driveCluster(0368)의 per-tick 몸통을 코디네이터 상주 메서드로(연속 루프 0373 의 단위). OFF 동치: tick 미호출이면 0371 동치.
// step-0371 — #62 runMulti 코어 통합 1: ClusterCoordinator — broker 측 *제어 평면 상주* 객체.
//   0361~0370 은 verify 하니스가 ad-hoc 으로 실 cluster 를 구동했다(driveCluster 0368 을 verify 가 직접 호출). 이 arc 는 그 구동을
//   orch(in-proc 권위) + 실 cluster + driver(ClusterHostDriver) 를 묶는 *상주 코디네이터*로 옮긴다 — cluster-run.js runMulti 의
//   "orch 상주(broker 측 제어 평면) + 연속 tick 루프" 통합(#62·STATE §2 NEXT·reviews 0361~0370 verdict).
//   이 step = 골격 + start(): orch.hostSpawnPlan 목표로 실 cluster 를 reconcile(미가동 host spawn + 각 존 zoneadd)해 토폴로지 수렴.
//   새 박스(net-core 진입점에 등록되나 run() 데이터 평면 미사용 → reg 0·OFF 동치).
// dual-mode: Node require / 브라우저는 net-core.js 가 <script> 선행 로드(전역 __HktNetParts.cluster_coord).

function makeClusterCoordinator(orch, cluster, specOf, driver) {
  return {
    orch, cluster, specOf, driver,
    ticks: 0,          // 연속 tick 루프가 돈 제어 평면 tick 수(0373~).
    maxDesync: 0,      // 연속 루프 중 관측된 최악 clusterDesync(0374·매-tick 가드·0=내내 수렴).
    migrations: 0,     // 상주 migrate 로 처리한 존 이주 수(0375).
    failovers: 0,      // 상주 failover 로 처리한 host 장애 수(0376).
    egressTotal: 0,    // 연속 루프가 송출한 다운스트림 view_delta frame 누계(0378).
    egressByZone: {},  // 존별 송출 view 수(0378·운영 계측).
    placement: {},     // zone→실 host placement 권위(0381·#65·lifecycle 마다 갱신·coordDesync 가 이걸로 host 조회).
    lostZones: new Set(), // failover 로 상태 소실된 존(0385·#63/#65·0386 coordDesync 가 기대된 부재로 제외).
    started: false,
    // 상주 시작 — orch 목표 토폴로지(hostSpawnPlan)로 실 cluster 를 수렴: 미가동 host spawnOne + 각 존 zoneadd + 목표 밖 host killHost.
    //   driver.reconcile(상태 기반 집행·0366) 재사용 — per-event flush 와 직교한 *상태 기반* 수렴(외부 cluster 를 orch 목표에 맞춤). 반환=집행 동작 수.
    async start() {
      const plan = this.orch.hostSpawnPlan();
      const acted = await this.driver.reconcile(plan, this.cluster, this.specOf);
      this.placement = {};                                                // step-0381 — placement SSOT 초기화(zone→host·orch 목표 스냅샷)
      for (const h of plan.order) for (const z of plan.hosts[h].zones) this.placement[z] = h;
      this.started = true;
      return acted;
    },
    // placement 질의(0381) — 이 존이 지금 실제로 도는 host(코디네이터 placement 권위). lifecycle(migrate/failover)이 이를 갱신해 orch plan stale 과 무관히 정확.
    placedHost(zone) { return this.placement[zone] || null; },
    // placement 기준 정합(0382·#65) — placement 권위로 각 존의 host 를 조회해 실 host entity vs orch entity 권위(zoneEntityPos·host-무관) 양방향 불일치 수. driver.clusterDesync 와 달리 stale orch plan 에 안 휘둘림(migrate 후도 정확). 반환=desync(0=수렴).
    async coordDesync() {
      let desync = 0;
      for (const zone of Object.keys(this.placement)) {
        const host = this.placement[zone];
        const snap = await this.cluster.rpc(host, { cmd: 'snapshot' });
        const zs = snap && snap.snap ? snap.snap[zone] : null;
        const real = new Map((zs && zs.ents) || []);
        for (const [id, pos] of real) { const a = this.orch.zoneEntityPos(zone, id); if (!a || a.x !== pos.x || a.y !== pos.y) desync++; }   // 실에 있는데 권위와 불일치/부재(ghost·forward·lost 여부 무관)
        if (this.lostZones.has(zone)) continue;   // step-0386 — lost 존: reverse(권위에 있는데 실에 부재)는 *기대된 비자발 손실*이라 desync 아님
        const auth = this.orch.zoneRuntimes && this.orch.zoneRuntimes.get(zone); if (auth) for (const id of auth.zone.ents.keys()) if (!real.has(id)) desync++;   // 권위에 있는데 실에 부재
      }
      return desync;
    },
    // 제어 평면 데이터 평면 1 tick(연속 루프 0373 의 단위). ① pending entity frame 재생(driver.commands 의 deliver frame→실 host zone.onMsg·첫 tick 에 enter/move 적용·이후 빈 큐) ② 전 존 1 tick(pending move 적용 + AOI view_delta egress 산출). 반환=이 tick 산출 view 수.
    async tick(t) {
      for (const c of this.driver.commands) if (c.op === 'deliver' && c.frame)
        await this.cluster.rpc(c.host, { cmd: 'deliver', items: [{ gi: 0, m: { to: c.zoneId, from: c.frame.from, payload: c.frame.payload } }] });
      this.driver.commands = [];
      const plan = this.orch.hostSpawnPlan();
      let views = 0;
      for (const h of plan.order) for (const z of plan.hosts[h].zones) {
        const v = (await this.driver.tickZone(this.cluster, h, z, t)).filter(s => s.payload && /^view/.test(s.payload.type)).length;
        if (v) this.egressByZone[z] = (this.egressByZone[z] || 0) + v;   // step-0378 — 존별 다운스트림 송출 회계.
        views += v;
      }
      this.egressTotal += views;   // step-0378 — 송출 누계.
      this.ticks++;
      return views;
    },
    // 연속 tick 루프(runMulti 핵심) — start()(미시작 시) 후 tick(t)을 1..ticks 반복 구동. broker 측 제어 평면이 매 tick 실 cluster 전체 데이터 평면을 굴린다. 반환=전 tick 산출 view 총수.
    async run(ticks) {
      if (!this.started) await this.start();
      let views = 0;
      for (let t = 1; t <= ticks; t++) {
        views += await this.tick(t);
        const d = await this.coordDesync();   // step-0374 매 tick 끝 정합 가드 → step-0384 placement 기준(coordDesync)으로 교체(migrate 포함 정합).
        if (d > this.maxDesync) this.maxDesync = d;
      }
      return views;
    },
    // 상주 존 migrate(graceful·상태 보존) — driver.migrateZone(snapshot from→toHost spawn/zoneadd→loadstate→from zonedel) 을 코디네이터 lifecycle 메서드로. entity 무손실·release+acquire(이중 쓰기 0)·migrations 계측. 반환=이전 상태.
    async migrate(zone, fromHost, toHost) {
      const state = await this.driver.migrateZone(this.cluster, zone, fromHost, toHost, this.specOf);
      this.placement[zone] = toHost;   // step-0383 (#65) — where 권위 갱신 → coordDesync 가 새 host 조회·migrate 후 desync 0.
      this.migrations++;
      return state;
    },
    // 상주 host failover(비자발·상태 소실) — 죽은 host 를 killHost(child_process 종료) 후 그 host 가 소유하던 존(orch plan 기준)을 생존 toHost 에 새 빈 인스턴스로 재가동(driver.failoverZone). 죽은 host 는 snapshot 불가라 entity 소실(정직한 한계·migrate 와 대조). failovers 계측. 반환=재가동된 존 목록.
    async failover(deadHost, toHost) {
      const zones = Object.keys(this.placement).filter(z => this.placement[z] === deadHost);   // step-0385 — placement 권위로 죽은 host 의 존(orch plan 아님)
      await this.cluster.killHost(deadHost);
      for (const z of zones) {
        await this.driver.failoverZone(this.cluster, z, toHost, this.specOf);
        this.placement[z] = toHost;     // step-0385 — where 권위 갱신(생존 host 로)
        this.lostZones.add(z);          // step-0385 — 상태 소실 기록(#63·0386 coordDesync 제외 근거)
      }
      this.failovers++;
      return zones;
    },
    // 상주 reconcile(비파괴·자가 치유) — orch.hostSpawnPlan(SSOT) 대비 실 cluster 의 현 snapshot 을 차분해 *누락 존만* zoneadd(기존 존 상태 보존). 제어 평면이 언제든 호출돼 토폴로지 drift(존 소실)를 orch 목표로 되돌린다(idempotent). 반환=복원한 존 수.
    async syncPlan() {
      const byHost = {};   // step-0388 — placement 권위(실 위치)로 host→존 묶음(orch plan stale 무관)
      for (const z of Object.keys(this.placement)) { const h = this.placement[z]; (byHost[h] = byHost[h] || []).push(z); }
      let acted = 0;
      for (const h of Object.keys(byHost)) {
        const snap = await this.cluster.rpc(h, { cmd: 'snapshot' });
        const have = new Set(snap && snap.snap ? Object.keys(snap.snap) : []);
        for (const z of byHost[h]) if (!have.has(z)) { await this.cluster.rpc(h, { cmd: 'zoneadd', specs: [this.specOf(z)] }); acted++; }
      }
      return acted;
    },
    // 운영 대시보드(0379) — 실 cluster + 코디네이터 누계를 단일 스냅샷으로. plan(host/zone)·실 host entity 합·현 desync(+루프 최악)·송출 누계·lifecycle 계측. broker 측 제어 평면의 현재 건강을 한 호출로 관측.
    async report() {
      const hosts = new Set(Object.values(this.placement));   // step-0387 — placement 권위(migrate/failover 반영)
      let entities = 0;
      for (const h of hosts) { const e = await this.driver.hostEntities(this.cluster, h); for (const z of Object.keys(e)) entities += e[z].length; }
      const desync = await this.coordDesync();                 // step-0387 — placement 기준 정합
      return {
        ticks: this.ticks, hosts: hosts.size, zones: Object.keys(this.placement).length, entities,
        desync, maxDesync: this.maxDesync, egressTotal: this.egressTotal,
        migrations: this.migrations, failovers: this.failovers, lost: this.lostZones.size, coherent: desync === 0,
      };
    },
    // placement ⟷ 실 cluster 양방향 bijection 불변(0389·#65) — placement(where 권위)가 실 cluster 의 존 배치와 정확히 1:1. forward(placement→실 존재) + reverse(실→placement). 참이면 placement 가 실 cluster 를 진짜 반영(양방향 동기 닫힘).
    async placementCoherent() {
      const realByHost = {};
      for (const h of new Set(Object.values(this.placement))) {
        const snap = await this.cluster.rpc(h, { cmd: 'snapshot' });
        realByHost[h] = new Set(snap && snap.snap ? Object.keys(snap.snap).filter(z => snap.snap[z].kind === 'zone') : []);
      }
      for (const z of Object.keys(this.placement)) { const h = this.placement[z]; if (!realByHost[h] || !realByHost[h].has(z)) return false; }   // forward
      for (const h of Object.keys(realByHost)) for (const z of realByHost[h]) if (this.placement[z] !== h) return false;   // reverse
      return true;
    },
    // grand capstone 술어(0380) — 연속 루프 내내(maxDesync==0) *그리고* 현 시점(clusterDesync==0) 실 cluster 가 in-proc 권위와 한 몸. broker 측 제어 평면(start→run→drift→syncPlan)이 SPINE §5 수렴을 실 프로세스 경계 넘어 *지속적으로* 만족. #62 sub-arc(0371~0380) 종합.
    async coordCoherent() {
      return this.maxDesync === 0 && (await this.coordDesync()) === 0;   // step-0384 — placement 기준(migrate 후도 정확)
    },
  };
}

const __part = { makeClusterCoordinator };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).cluster_coord = __part;
