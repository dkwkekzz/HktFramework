'use strict';
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
      for (const h of plan.order) for (const z of plan.hosts[h].zones)
        views += (await this.driver.tickZone(this.cluster, h, z, t)).filter(s => s.payload && /^view/.test(s.payload.type)).length;
      this.ticks++;
      return views;
    },
  };
}

const __part = { makeClusterCoordinator };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).cluster_coord = __part;
