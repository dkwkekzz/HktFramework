'use strict';
// step-0405 — #62 runMulti 합류 4·복원력: reprovisionStandby(zone, standbyHost) — 따뜻한 대기 인스턴스 + 미러 등록. runMulti(`cluster-run.js:202` rep + `:219` mirrors)는 kill→승격 후 새 standby 를 띄우고 권위 입력을 미러해 N=1 복제를 유지했다. 코디네이터가 zone 의 현 상태를 snapshot→standbyHost 에 spawn/zoneadd/loadstate(따뜻한 사본) + mirrors 에 {zone,dstHost} 등록(입력 복제는 0406 tick 미러). 미호출이면 0404 동치. 새 박스·run() 미사용→reg 0.
// step-0404 — 정리(기능 0·reg 0): 박스 30KB 근접(29.4KB) 트리거 — 닫힌 arc(0371~0399·#62/#65/#66/#67) 헤더 주석 스택을 git 태그+reviews 포인터 한 줄로 접어 박스를 유계화(코드 무변경=net-core 동작 비트 동일=reg 0). 비대화 트리거(CLAUDE.md §박스 분할) 집행.
// step-0403 — #62 runMulti 합류 3·복원력: 상태 보존 restart(zone, newHost). failover(0376·비자발·상태 소실)와 대조 — *계획적* 재시작(업그레이드·정비)은 죽기 *전* snapshot 으로 상태를 보존한다(runMulti invRestart `cluster-run.js:90` 의 zone cluster 판: snapshot→kill→spawn→loadstate). socketDead 가 host 단위로 영속하므로 newHost 로 재가동(runMulti `inventory_r` 와 동형). 미호출이면 0402 동치. 새 박스·run() 미사용→reg 0.
// step-0402 — #62 runMulti 합류 2·복원력: silence 기반 lease-timeout 자동 펜싱. fence(0401)는 *수동* — runMulti observeSilence(`cluster-run.js:72`)는 침묵 tick 을 세어 임계(guessThreshold) 초과 시 자동 presumedDead 선언했다. sweepSilence()=placement host 중 socketDead(전송 층 사망 감지)인 host 의 연속 침묵 sweep 을 세어 leaseTimeout 초과 시 자동 fence(임계 기반 추측·즉발 fence 와 대조). socketDead host 0 이면 counter 0 = 0401 동치. 새 박스·run() 미사용→reg 0.
// step-0401 — #62 runMulti 합류 1·복원력 능력 합류: 코디네이터 epoch 펜싱(presumedDead/fence/epoch). runMulti(cluster-run.js)는 presumedDead+epoch 펜싱으로 stale host 발신을 차단했으나(`cluster-run.js:69,76`) 코디네이터(zone cluster 상주 제어 평면)엔 그 능력이 없었다 — fence(host)로 host 를 추정 사망 표기+epoch++, tick 이 presumedDead host 의 존을 건너뛴다(fenced·egress 0). 코디네이터를 runMulti 호환 복원력 코어로 승격(#62·능력 합류·병존 reg 0). presumedDead 비면 0400 동치. 새 박스·run() 미사용→reg 0.
// step-0371~0399 헤더(#62 runMulti 통합·#65 양방향 동기·#66 tick placement-aware·#67 orch 이중 권위 합류)는 git 태그 step-0371~0399 + reviews/review-03{71,81,91}-* 에 보존(정리 step-0404·코드 무변경·reg 0).
// dual-mode: Node require / 브라우저는 net-core.js 가 <script> 선행 로드(전역 __HktNetParts.cluster_coord).

function makeClusterCoordinator(orch, cluster, specOf, driver) {
  return {
    orch, cluster, specOf, driver,
    ticks: 0,          // 연속 tick 루프가 돈 제어 평면 tick 수(0373~).
    maxDesync: 0,      // 연속 루프 중 관측된 최악 clusterDesync(0374·매-tick 가드·0=내내 수렴).
    migrations: 0,     // 상주 migrate 로 처리한 존 이주 수(0375).
    failovers: 0,      // 상주 failover 로 처리한 host 장애 수(0376).
    restarts: 0,       // 상태 보존 restart 처리 수(0403·계획적·snapshot 보존).
    egressTotal: 0,    // 연속 루프가 송출한 다운스트림 view_delta frame 누계(0378).
    egressByZone: {},  // 존별 송출 view 수(0378·운영 계측).
    placement: {},     // zone→실 host placement 권위(0381·#65·lifecycle 마다 갱신·coordDesync 가 이걸로 host 조회).
    lostZones: new Set(), // failover 로 상태 소실된 존(0385·#63/#65·0386 coordDesync 가 기대된 부재로 제외).
    epoch: 0,          // 펜싱 epoch(0401·#62·runMulti epoch 의 코디네이터 판·fence 마다 ++).
    presumedDead: new Set(), // 추정 사망 host(0401·#62·fence/silence·tick 이 건너뜀·stale 발신 차단).
    fencedTicks: 0,    // 펜싱으로 건너뛴 (host,zone) tick 수(0401·계측).
    leaseTimeout: 3,   // silence 임계(0402·#62·runMulti guessThreshold 판·이만큼 연속 침묵이면 자동 fence).
    _silent: new Map(), // host→연속 침묵 sweep 수(0402·socketDead 인 동안 누적·살아있으면 리셋).
    mirrors: [],       // 따뜻한 대기 미러(0405·#62·{zone,dstHost}·입력 복제로 N=1 복제 유지·runMulti cluster.mirrors 판).
    reprovisions: 0,   // reprovisionStandby 처리 수(0405·계측).
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
    // epoch 펜싱(0401·#62) — host 를 추정 사망 표기 + epoch++. 이후 tick 이 이 host 의 존을 건너뛰어(fenced) stale 발신을 차단(runMulti `cluster-run.js:69,76` 펜싱의 zone cluster 판). 이미 추정 사망이면 멱등 no-op. 반환=새로 펜싱했는지.
    fence(host) { if (this.presumedDead.has(host)) return false; this.presumedDead.add(host); this.epoch++; return true; },
    // silence 기반 자동 펜싱 sweep(0402·#62) — placement host 중 socketDead(전송 층 사망 감지)인 host 의 연속 침묵 sweep 을 세어 leaseTimeout 초과 시 자동 fence(임계 기반 추측·runMulti observeSilence 판). 살아있는 host 는 counter 리셋. socketDead host 0 이면 무동작(0401 동치). 반환=이번에 새로 fence 된 host 배열.
    sweepSilence() {
      const dead = this.cluster.socketDead, newly = [];
      for (const h of new Set(Object.values(this.placement))) {
        if (this.presumedDead.has(h)) continue;
        if (dead && dead.has(h)) { const n = (this._silent.get(h) || 0) + 1; this._silent.set(h, n); if (n >= this.leaseTimeout) { this.fence(h); newly.push(h); } }
        else this._silent.set(h, 0);
      }
      return newly;
    },
    // orch 집행 where-view(0394·#67) — orch 가 들고 있는 제2 where 권위(zone→orch.runningHostOf). 코디네이터 placement 와 별개 — migrate/failover 전엔 일치, 후엔 orch 가 stale(이중 권위). placement 가 추적하는 존마다 orch 의 running host 를 조회. 읽기 전용.
    orchWhere() { const w = {}; for (const z of Object.keys(this.placement)) w[z] = this.orch.runningHostOf(z) || null; return w; },
    // 두 where 권위 합의 술어(0395·#67) — 코디네이터 placement == orchWhere(orch 집행 where-view) 가 모든 존에서 일치하는가. 참이면 단일 where 권위. lifecycle write-back(0396~) 전엔 migrate/failover 후 orch 가 stale → 거짓(이중 권위). 읽기 전용.
    authoritiesAgree() { const ow = this.orchWhere(); for (const z of Object.keys(this.placement)) if (this.placement[z] !== ow[z]) return false; return true; },
    // orch 집행 where-view write-back(0396·#67) — 코디네이터 lifecycle 이 placement 를 옮길 때 orch.running/placement(제2 where 권위)도 같은 host 로 동기해 이중 권위를 합류. host==null 이면 양쪽에서 제거(존 소실/퇴역). orch 의 *내부 zoneHost 컨테이너*(0301~) 는 건드리지 않는다(where-view 만·entity 권위 무관). run() 종료 후 orch 객체에만 작용 → reg 무관.
    _orchWriteBack(zone, host) {
      if (this.orch.running && typeof this.orch.running.set === 'function') { if (host == null) this.orch.running.delete(zone); else this.orch.running.set(zone, host); }
      if (this.orch.placement && typeof this.orch.placement.set === 'function') { if (host == null) this.orch.placement.delete(zone); else this.orch.placement.set(zone, host); }
    },
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
    //   step-0391 (#66) — 존 순회를 *placement 권위*(this.placement)로(orch.hostSpawnPlan 아님). run 루프 *도중* migrate 가 일어나도 tick 이 새 host 를 즉시 따라가 정합. 정상 경로(placement==orch plan)에선 같은 (host,zone) 쌍 집합 → views/egress 동일 = 0390 동치.
    async tick(t) {
      for (const c of this.driver.commands) if (c.op === 'deliver' && c.frame) {
        const host = this.placement[c.zoneId] || c.host;   // step-0392 — placement 권위로 현 host 조회(c.host 는 번역 당시·mid-run migrate 후 stale 가능). 정상 경로(placement==c.host)=0391 동치.
        await this.cluster.rpc(host, { cmd: 'deliver', items: [{ gi: 0, m: { to: c.zoneId, from: c.frame.from, payload: c.frame.payload } }] });
      }
      this.driver.commands = [];
      let views = 0;
      for (const z of Object.keys(this.placement)) {        // step-0391 — placement 권위 순회(삽입 순·결정론). orch plan stale 무관.
        const h = this.placement[z];
        if (this.presumedDead.has(h)) { this.fencedTicks++; continue; }   // step-0401 (#62) — 추정 사망 host 의 존은 tick/egress 건너뜀(펜싱). presumedDead 비면 도달 0 = 0400 동치.
        const v = (await this.driver.tickZone(this.cluster, h, z, t)).filter(s => s.payload && /^view/.test(s.payload.type)).length;
        if (v) this.egressByZone[z] = (this.egressByZone[z] || 0) + v;   // step-0378 — 존별 다운스트림 송출 회계.
        views += v;
      }
      this.egressTotal += views;   // step-0378 — 송출 누계.
      this.ticks++;
      return views;
    },
    // 연속 tick 루프(runMulti 핵심) — start()(미시작 시) 후 tick(t)을 1..ticks 반복 구동. broker 측 제어 평면이 매 tick 실 cluster 전체 데이터 평면을 굴린다. 반환=전 tick 산출 view 총수.
    async run(ticks, onTick) {
      if (!this.started) await this.start();
      let views = 0;
      for (let t = 1; t <= ticks; t++) {
        views += await this.tick(t);
        const d = await this.coordDesync();   // step-0374 매 tick 끝 정합 가드 → step-0384 placement 기준(coordDesync)으로 교체(migrate 포함 정합).
        if (d > this.maxDesync) this.maxDesync = d;
        if (onTick) await onTick(t, this);    // step-0393 — mid-loop lifecycle 훅(루프 도중 migrate 발현). 미제공이면 0392 동치.
      }
      return views;
    },
    // 상주 존 migrate(graceful·상태 보존) — driver.migrateZone(snapshot from→toHost spawn/zoneadd→loadstate→from zonedel) 을 코디네이터 lifecycle 메서드로. entity 무손실·release+acquire(이중 쓰기 0)·migrations 계측. 반환=이전 상태.
    async migrate(zone, fromHost, toHost) {
      const state = await this.driver.migrateZone(this.cluster, zone, fromHost, toHost, this.specOf);
      this.placement[zone] = toHost;   // step-0383 (#65) — where 권위 갱신 → coordDesync 가 새 host 조회·migrate 후 desync 0.
      this._orchWriteBack(zone, toHost);   // step-0396 (#67) — orch 집행 where-view 도 동기 → authoritiesAgree Y(이중 권위 합류).
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
        this._orchWriteBack(z, toHost); // step-0397 (#67) — orch 집행 where-view 도 동기(lost 존도 where 는 toHost 로 합의·entity 손실은 coordDesync 가 제외).
        this.lostZones.add(z);          // step-0385 — 상태 소실 기록(#63·0386 coordDesync 제외 근거)
      }
      this.failovers++;
      return zones;
    },
    // 상태 보존 restart(0403·#62·복원력) — *계획적* 재시작(업그레이드·정비). 죽기 *전* snapshot 으로 상태를 굳히고 host 를 kill 한 뒤 newHost 에 재가동·loadstate 로 상태 복원(runMulti invRestart 의 zone cluster 판). failover(비자발·상태 소실)와 대조: 여기선 entity 무손실. socketDead 가 host 단위 영속이라 newHost(새 id)로 재가동. placement+orch where-view 갱신. 반환=보존된 상태.
    async restart(zone, newHost) {
      const oldHost = this.placement[zone];
      const snap = await this.cluster.rpc(oldHost, { cmd: 'snapshot' });
      const state = snap && snap.snap ? snap.snap[zone] : null;          // pre-kill 상태(보존 소스)
      await this.cluster.killHost(oldHost);                              // 프로세스 사망(RAM 소실·snapshot 은 이미 떴음)
      if (!this.cluster.hostIds.includes(newHost) || this.cluster.socketDead.has(newHost)) await this.cluster.spawnOne(newHost);
      await this.cluster.rpc(newHost, { cmd: 'zoneadd', specs: [this.specOf(zone)] });
      if (state) await this.cluster.rpc(newHost, { cmd: 'loadstate', addr: zone, state });   // 상태 복원 → 무손실
      this.placement[zone] = newHost;
      this._orchWriteBack(zone, newHost);
      this.restarts++;
      return state;
    },
    // 따뜻한 대기 reprovision(0405·#62·복원력) — zone 의 현 상태를 standbyHost 에 사본으로 띄우고 미러 등록. snapshot(현 host)→standbyHost spawn/zoneadd/loadstate(따뜻한 사본·primary 와 같은 상태) + mirrors 에 {zone,dstHost} 추가. 이후 입력이 미러로 복제돼(0406) standby 가 primary 와 동기 유지 → failover 시 즉시 승격 가능(runMulti rep+mirrors 판). primary 는 그대로(이중 가동·shadow=발신 0). 반환=복제된 상태.
    async reprovisionStandby(zone, standbyHost) {
      const srcHost = this.placement[zone];
      const snap = await this.cluster.rpc(srcHost, { cmd: 'snapshot' });
      const state = snap && snap.snap ? snap.snap[zone] : null;
      if (!this.cluster.hostIds.includes(standbyHost) || this.cluster.socketDead.has(standbyHost)) await this.cluster.spawnOne(standbyHost);
      await this.cluster.rpc(standbyHost, { cmd: 'zoneadd', specs: [this.specOf(zone)] });
      if (state) await this.cluster.rpc(standbyHost, { cmd: 'loadstate', addr: zone, state });   // 따뜻한 사본(primary 상태 복제)
      this.mirrors.push({ zone, dstHost: standbyHost });
      this.reprovisions++;
      return state;
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
        authoritiesAgree: this.authoritiesAgree(),   // step-0398 (#67) — 두 where 권위 합치 여부(이중 권위 합류 건강).
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
    // grand capstone 술어(0390·#65) — 연속 루프 정합(maxDesync==0) + 현 entity 정합(coordDesync==0·lost 제외) + placement⟷실 1:1(placementCoherent). migrate/failover 를 *포함한* 전체 lifecycle 뒤에도 참(0380 이 제외한 것). 양방향 동기 sub-arc(0381~0390) 종합.
    async syncedCoherent() {
      return this.maxDesync === 0 && (await this.coordDesync()) === 0 && (await this.placementCoherent());
    },
    // 통합 정합 술어(0399·#66+#67) — syncedCoherent(연속 루프·현 entity·placement↔실 bijection) && authoritiesAgree(코디네이터 placement == orch 집행 where-view). 즉 *양방향 동기(#65)·tick placement-aware(#66)·orch 이중 권위 합류(#67)* 가 모두 한 몸. orch.running 에 stale host 가 남으면 authoritiesAgree 가 잡아 N(실측 검출).
    async unifiedCoherent() {
      return (await this.syncedCoherent()) && this.authoritiesAgree();
    },
  };
}

const __part = { makeClusterCoordinator };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).cluster_coord = __part;
