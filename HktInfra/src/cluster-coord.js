'use strict';
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
    started: false,
    // 상주 시작 — orch 목표 토폴로지(hostSpawnPlan)로 실 cluster 를 수렴: 미가동 host spawnOne + 각 존 zoneadd + 목표 밖 host killHost.
    //   driver.reconcile(상태 기반 집행·0366) 재사용 — per-event flush 와 직교한 *상태 기반* 수렴(외부 cluster 를 orch 목표에 맞춤). 반환=집행 동작 수.
    async start() {
      const plan = this.orch.hostSpawnPlan();
      const acted = await this.driver.reconcile(plan, this.cluster, this.specOf);
      this.started = true;
      return acted;
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
        const d = await this.driver.clusterDesync(this.orch, this.cluster);   // step-0374 — 매 tick 끝 정합 가드(중간 발산도 잡음).
        if (d > this.maxDesync) this.maxDesync = d;
      }
      return views;
    },
    // 상주 존 migrate(graceful·상태 보존) — driver.migrateZone(snapshot from→toHost spawn/zoneadd→loadstate→from zonedel) 을 코디네이터 lifecycle 메서드로. entity 무손실·release+acquire(이중 쓰기 0)·migrations 계측. 반환=이전 상태.
    async migrate(zone, fromHost, toHost) {
      const state = await this.driver.migrateZone(this.cluster, zone, fromHost, toHost, this.specOf);
      this.migrations++;
      return state;
    },
    // 상주 host failover(비자발·상태 소실) — 죽은 host 를 killHost(child_process 종료) 후 그 host 가 소유하던 존(orch plan 기준)을 생존 toHost 에 새 빈 인스턴스로 재가동(driver.failoverZone). 죽은 host 는 snapshot 불가라 entity 소실(정직한 한계·migrate 와 대조). failovers 계측. 반환=재가동된 존 목록.
    async failover(deadHost, toHost) {
      const plan = this.orch.hostSpawnPlan();
      const zones = (plan.hosts[deadHost] && plan.hosts[deadHost].zones) || [];
      await this.cluster.killHost(deadHost);
      for (const z of zones) await this.driver.failoverZone(this.cluster, z, toHost, this.specOf);
      this.failovers++;
      return zones;
    },
    // 상주 reconcile(비파괴·자가 치유) — orch.hostSpawnPlan(SSOT) 대비 실 cluster 의 현 snapshot 을 차분해 *누락 존만* zoneadd(기존 존 상태 보존). 제어 평면이 언제든 호출돼 토폴로지 drift(존 소실)를 orch 목표로 되돌린다(idempotent). 반환=복원한 존 수.
    async syncPlan() {
      const plan = this.orch.hostSpawnPlan();
      let acted = 0;
      for (const h of plan.order) {
        const snap = await this.cluster.rpc(h, { cmd: 'snapshot' });
        const have = new Set(snap && snap.snap ? Object.keys(snap.snap) : []);
        for (const z of plan.hosts[h].zones) if (!have.has(z)) { await this.cluster.rpc(h, { cmd: 'zoneadd', specs: [this.specOf(z)] }); acted++; }
      }
      return acted;
    },
    // 운영 대시보드(0379) — 실 cluster + 코디네이터 누계를 단일 스냅샷으로. plan(host/zone)·실 host entity 합·현 desync(+루프 최악)·송출 누계·lifecycle 계측. broker 측 제어 평면의 현재 건강을 한 호출로 관측.
    async report() {
      const plan = this.orch.hostSpawnPlan();
      let entities = 0;
      for (const h of plan.order) { const e = await this.driver.hostEntities(this.cluster, h); for (const z of Object.keys(e)) entities += e[z].length; }
      const desync = await this.driver.clusterDesync(this.orch, this.cluster);
      return {
        ticks: this.ticks, hosts: plan.hostCount, zones: plan.zones, entities,
        desync, maxDesync: this.maxDesync, egressTotal: this.egressTotal,
        migrations: this.migrations, failovers: this.failovers, coherent: desync === 0,
      };
    },
  };
}

const __part = { makeClusterCoordinator };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).cluster_coord = __part;
