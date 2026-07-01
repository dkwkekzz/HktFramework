'use strict';
// step-0370 — #57 실 데이터 평면 10·capstone: clusterCoherent(orch,cluster)=clusterDesync==0 — 실 cluster 전체가 in-proc 권위와 한 몸(실 프로세스 경계 넘어 수렴). #57 실 데이터 평면 sub-arc(0361~0370) 종합.
// step-0369 — #57 실 데이터 평면 9: clusterDesync(orch,cluster) 정합 술어 — 실 host.js entity 위치 vs in-proc 권위 불일치 수(양방향·desync 0=실 프로세스 경계 넘어 수렴).
// step-0368 — #57 실 데이터 평면 8: driveCluster(orch,cluster,specOf) 통합 E2E(#62·runMulti analog) — reconcile+deliver 재생+전 존 tick 을 한 호출에. orch 드라이버가 실 cluster 전체 데이터 평면 구동.
// step-0367 — #57 실 데이터 평면 7: hostEntities(cluster,host) 읽기 헬퍼 — 실 host 의 존별 entity 관찰(다중 host 격리 검증·교차 누수 0).
// step-0366 — #57 실 데이터 평면 6: reconcile(plan,cluster,specOf) — orch hostSpawnPlan 목표에 실 cluster 를 spawn/zoneadd/killHost 로 수렴(상태 기반 집행·표준 reconcile).
// step-0365 — #57 실 데이터 평면 5: 실 host.js killHost(child_process 종료) + failoverZone(죽은 host 의 존을 생존 host 에 새 인스턴스 재가동·상태 소실).
// step-0364 — #57 실 데이터 평면 4: migrateZone(snapshot+loadstate 상태 이전·zonedel) — 실 host.js 프로세스 경계를 entity 보존하며 존 이주(같은 핸들 원자 교체의 child_process 판).
// step-0363 — #57 실 데이터 평면 3: tickZone(cluster,host,zone,tick) — 실 host.js zone.onTick(pending move 적용 + view_delta 산출) 집행·산출 send 반환(다운스트림 egress 실 출력).
// step-0362 — #57 실 데이터 평면 2: flush stop(onUnassign)→실 host.js zonedel(존 제거). 실 프로세스에서 stop/migrate-out 집행.
// step-0361 — #57 실 데이터 평면 1: flush deliver 가 frame 동봉 시 실 host.js deliver(items·m.to=존·zone.onMsg) 집행 → entity 가 실 프로세스 존에 산다(논리 frame→실 소켓 데이터 평면).
// step-0359 — #57 실 host.js OS 프로세스 spawn 9: flush specOf init→host.js zoneadd(증분·기존 존 보존) 로 다중 존을 한 host.js 프로세스에 incremental 가동.
// step-0358 — #57 실 host.js OS 프로세스 spawn 8: flush(cluster, specOf) — specOf(zone)→존 spec 면 init 을 host.js 호환 {cmd:'init',specs:[spec]} 로 보내 *실 host.js 자식 프로세스가 그 존을 makeActor 로 인스턴스화*. orch zoneHost 컨테이너 → 실 OS 프로세스 존 가동 E2E.
// step-0357 — #57 실 host.js OS 프로세스 spawn 7: ClusterHostDriver — orch 드라이버 계약(0353~0356) 이벤트를 *실 cluster 명령*으로 번역.
//   orch._hostSet/_zoneDeliver/_drainZoneEgress 가 부르는 on*(host,…) 훅을 *명령 큐*(commands)에 동기·결정론으로 적재하고,
//   flush(cluster) 가 그 큐를 실 Cluster(cluster-core)에 집행한다 — spawnOne/killHost(자식 OS 프로세스)·rpc(소켓 init/deliver). 번역(동기)과 집행(async·child_process)을 분리 = reconcile 패턴·#4 비동기 경계 격리.
//   recorder(0353~0356·인프로세스 검증)와 같은 on* 형상이지만, 이건 *실 cluster 호출로 환산*하는 production 드라이버다. topo-run 이 clusterDriverReal ON 일 때 orch.clusterDriver 로 주입(OFF→null·호출 0·비트 동일).
// dual-mode: Node require / 브라우저는 net-core.js 가 <script> 선행 로드(전역 __HktNetParts.cluster_hostdriver).

function makeClusterHostDriver() {
  return {
    commands: [],   // 번역된 cluster 명령 큐(동기 적재·flush 가 집행).
    executed: [],   // flush 가 실제 집행한 op 순서(검증·관측).
    // orch 드라이버 계약 훅 → cluster 명령 번역(동기·결정론).
    onSpawn(h) { this.commands.push({ op: 'spawnOne', host: h }); },     // 첫 존 → 자식 OS 프로세스 spawn.
    onDespawn(h) { this.commands.push({ op: 'killHost', host: h }); },   // 마지막 존 잃음 → 프로세스 kill.
    onAssign(h, z) { this.commands.push({ op: 'init', host: h, zone: z }); },     // 존 귀속 → host 에 그 존 init/loadstate.
    onUnassign(h, z) { this.commands.push({ op: 'stop', host: h, zone: z }); },   // 존 이탈 → host 에서 그 존 stop/migrate-out.
    onFrame(h, z, frame) { this.commands.push({ op: 'deliver', host: h, zoneId: z, frame }); }, // entity frame → cluster.rpc(host,{cmd:'deliver'}). step-0361: frame 동봉(실 deliver 페이로드).
    onEgress(h, k) { this.commands.push({ op: 'egress', host: h, key: k }); },    // 다운스트림 view 송출(host→게이트웨이 소켓 out·집행 별 경로).
    // 명령 큐를 실 Cluster 에 집행(async) — spawnOne/killHost 는 child_process, rpc 는 소켓. specOf(zone)→존 spec 가 주어지면 init 을 host.js 호환 {cmd:'init',specs:[spec]} 로(실 host.js 가 makeActor 로 그 존을 인스턴스화) 보낸다. specOf 없으면 {cmd:'init',zone}(mock cluster 동기 기록·검증용). step-0358.
    async flush(cluster, specOf) {
      for (const c of this.commands) {
        if (c.op === 'spawnOne') { await cluster.spawnOne(c.host); }
        else if (c.op === 'killHost') { await cluster.killHost(c.host); }
        else if (c.op === 'init') { await cluster.rpc(c.host, specOf ? { cmd: 'zoneadd', specs: [specOf(c.zone)] } : { cmd: 'init', zone: c.zone }); }   // step-0359 — specOf 면 zoneadd(증분·기존 존 보존) 로 다중 존 한 host 가동.
        else if (c.op === 'deliver') {
          // step-0361 — frame 동봉 시 실 host.js deliver(items=[{gi,m}]·m.to=존 addr·zone.onMsg 적용). 미동봉(0357 mock)이면 zoneId 만.
          if (c.frame) await cluster.rpc(c.host, { cmd: 'deliver', items: [{ gi: 0, m: { to: c.zoneId, from: c.frame.from, payload: c.frame.payload } }] });
          else await cluster.rpc(c.host, { cmd: 'deliver', zoneId: c.zoneId });
        }
        else if (c.op === 'stop' && specOf) { await cluster.rpc(c.host, { cmd: 'zonedel', addr: c.zone }); }   // step-0362 — 존 제거(실 host.js zonedel·stop/migrate-out). specOf(실 모드)일 때만 — mock 은 큐 소비만.
        // 'egress' 의 실 집행(다운스트림 소켓 out)은 후속 — 여기선 큐 소비만(executed 기록).
        this.executed.push(c.op);
      }
      this.commands = [];
      return this.executed.length;
    },
    // step-0363 — 실 host.js 존 tick: {cmd:'tick'} → 실 프로세스 zone.onTick(pending move 적용 + AOI view_delta 산출). 반환 = 그 존이 낸 send(다운스트림 egress·실 소켓 out 의 씨앗). orch _tickRuntimes 의 실 host 판.
    async tickZone(cluster, host, zone, tick) {
      const r = await cluster.rpc(host, { cmd: 'tick', tick, items: [{ gi: 0, addr: zone }] });
      return (r.results && r.results[0] && r.results[0].sends) || [];
    },
    // step-0364 — 실 host.js 존 migrate(상태 보존): snapshot(from)→ toHost spawn/zoneadd→ loadstate(이전 상태 주입)→ zonedel(from). 같은 핸들 원자 교체의 *실 프로세스* 판(orch _bridgeMigrate 의 child_process 판·entity 무손실·권위 단일 소유). 반환=이전 상태.
    async migrateZone(cluster, zone, fromHost, toHost, specOf) {
      const snap = await cluster.rpc(fromHost, { cmd: 'snapshot' });
      const state = snap && snap.snap ? snap.snap[zone] : null;
      if (!cluster.hostIds.includes(toHost)) await cluster.spawnOne(toHost);   // toHost 미가동이면 새 프로세스 spawn.
      await cluster.rpc(toHost, { cmd: 'zoneadd', specs: [specOf(zone)] });     // toHost 에 빈 존 인스턴스
      if (state) await cluster.rpc(toHost, { cmd: 'loadstate', addr: zone, state });   // 이전 상태(ents/sessions) 주입 → 무손실
      await cluster.rpc(fromHost, { cmd: 'zonedel', addr: zone });              // fromHost 에서 제거(release·이중 쓰기 0)
      return state;
    },
    // step-0365 — 실 host.js 장애 failover: 죽은 host 의 존을 생존 host 에 *새 인스턴스* 재가동(상태 소실·비자발). migrate 와 대조 — 죽은 host 는 snapshot 불가라 상태 이전 불가(orch _bridgeHostDown 0285 의 실 프로세스 판·정직한 한계). toHost 미가동/사망이면 spawn.
    async failoverZone(cluster, zone, toHost, specOf) {
      if (!cluster.hostIds.includes(toHost) || cluster.socketDead.has(toHost)) await cluster.spawnOne(toHost);
      await cluster.rpc(toHost, { cmd: 'zoneadd', specs: [specOf(zone)] });   // 새 빈 존(죽은 host 상태 소실)
    },
    // step-0366 — reconcile: orch 목표(hostSpawnPlan)에 맞춰 실 cluster 를 수렴. 목표 밖 host 는 killHost·목표 host 는 spawn(미가동 시)·각 존 zoneadd. 외부 상태(이미 뜬 프로세스)를 목표로 *맞추는* 표준 cluster 패턴(per-event flush 와 직교한 *상태 기반* 집행). 반환=집행 동작 수.
    async reconcile(plan, cluster, specOf) {
      let acted = 0;
      const target = new Set(plan.order);
      for (const h of cluster.hostIds.slice()) if (!target.has(h) && !cluster.socketDead.has(h)) { await cluster.killHost(h); acted++; }   // 목표 밖 host 종료.
      for (const h of plan.order) {
        if (!cluster.hostIds.includes(h) || cluster.socketDead.has(h)) { await cluster.spawnOne(h); acted++; }   // 목표 host spawn.
        for (const z of plan.hosts[h].zones) { await cluster.rpc(h, { cmd: 'zoneadd', specs: [specOf(z)] }); acted++; }   // 각 존 가동.
      }
      return acted;
    },
    // step-0367 — 실 host 의 존별 entity 관찰: snapshot → { zone: [entityId…] }. 다중 host 데이터 평면 격리 검증의 읽기 헬퍼(각 host 가 자기 존 entity 만·교차 누수 0).
    async hostEntities(cluster, host) {
      const r = await cluster.rpc(host, { cmd: 'snapshot' });
      const out = {};
      if (r && r.snap) for (const [addr, a] of Object.entries(r.snap)) if (a.kind === 'zone') out[addr] = (a.ents || []).map(([id]) => id).sort();
      return out;
    },
    // step-0368 — 통합 E2E 구동(#62·runMulti analog): orch 드라이버 커맨드로 실 cluster 전체 데이터 평면을 한 호출에. ① reconcile(plan→spawn/zoneadd) ② deliver 커맨드 재생(실 zone.onMsg) ③ 전 존 1 tick(move 적용+view 산출). orch.clusterDriver(=this) 가 broker 측 제어 평면처럼 실 cluster 를 구동. 반환=tick 산출 view 총수.
    async driveCluster(orch, cluster, specOf, tick = 1) {
      const plan = orch.hostSpawnPlan();
      await this.reconcile(plan, cluster, specOf);                 // ① 목표 토폴로지 수렴
      for (const c of this.commands) if (c.op === 'deliver' && c.frame)   // ② entity frame 재생
        await cluster.rpc(c.host, { cmd: 'deliver', items: [{ gi: 0, m: { to: c.zoneId, from: c.frame.from, payload: c.frame.payload } }] });
      this.commands = [];
      let views = 0;
      for (const h of plan.order) for (const z of plan.hosts[h].zones) views += (await this.tickZone(cluster, h, z, tick)).filter(s => s.payload && /^view/.test(s.payload.type)).length;   // ③ 전 존 tick
      return views;
    },
    // step-0369 — 실 데이터 평면 정합 술어: 실 host.js 의 entity 위치가 in-proc orch 권위와 어긋난 수(양방향). desync 0 = 실 프로세스 경계 넘어 모든 entity 가 권위 재현(SPINE §5 수렴). 실 cluster 데이터 평면의 단일 건강 지표.
    async clusterDesync(orch, cluster) {
      let desync = 0;
      const plan = orch.hostSpawnPlan();
      for (const h of plan.order) {
        const snap = await cluster.rpc(h, { cmd: 'snapshot' });
        for (const z of plan.hosts[h].zones) {
          const zs = snap && snap.snap ? snap.snap[z] : null;
          const real = new Map((zs && zs.ents) || []);
          for (const [id, pos] of real) { const a = orch.zoneEntityPos(z, id); if (!a || a.x !== pos.x || a.y !== pos.y) desync++; }   // 실에 있는데 권위와 위치 불일치/부재
          const auth = orch.zoneRuntimes && orch.zoneRuntimes.get(z); if (auth) for (const id of auth.zone.ents.keys()) if (!real.has(id)) desync++;   // 권위에 있는데 실에 부재
        }
      }
      return desync;
    },
    // step-0370 — 실 데이터 평면 grand capstone 술어: 실 cluster 전체가 in-proc 권위와 한 몸인가(clusterDesync==0). 실 host.js 프로세스/소켓 데이터 평면이 SPINE §5 수렴을 실 프로세스 경계 넘어 만족. #57 실 데이터 평면 sub-arc(0361~0370) 종합.
    async clusterCoherent(orch, cluster) { return (await this.clusterDesync(orch, cluster)) === 0; },
    // ── step-0471 (#70 실 host.js child 경계 업스트림) — 실 UpClient 의 *발신* intent 가 실 프로세스 경계를 넘어 실 host.js zone 에 닿는다. ──
    //   #61(0421~0430)은 UpClient 를 *in-proc* 액터로 세웠고(같은 프로세스 net), 다운스트림은 0361~0370 이 실 host.js 데이터 평면을
    //   집행했다. #70 = 그 업스트림 짝 — UpClient(부모/broker 측)의 게이트웨이-형 intent(zoneEnter/zoneMove/zoneLeave)를 *실 host.js
    //   자식 프로세스의 존*으로 소켓 배달한다. 게이트웨이가 하던 번역(zoneEnter→enter…)을 이 seam 이 재현한다.
    //   intentToZoneMsg: 게이트웨이-형 intent → 존 msg(net.step 이 존에 배달하던 형). from='gateway'(존 입장 불변). step-0471=enter 만(move/leave 는 0472/0476).
    intentToZoneMsg(op, from = 'gateway') {
      if (op.type === 'zoneEnter') return { to: op.zoneId, from, payload: { type: 'enter', sessionId: 's:' + op.avatar, avatar: op.avatar } };
      if (op.type === 'zoneMove') return { to: op.zoneId, from, payload: { type: 'move', avatar: op.avatar, d: { dx: op.dx, dy: op.dy } } };   // step-0472 — 이동 intent → 존 move(존 onTick 이 pending 적용).
      return null;
    },
    // step-0471 — 실 host.js 경계 업스트림 배달: intent 1발을 존 msg 로 번역해 실 host.js deliver(zone.onMsg) 로 보낸다. 미번역(null)이면 배달 0.
    async deliverIntent(cluster, host, op) {
      const m = this.intentToZoneMsg(op);
      if (!m) return null;
      await cluster.rpc(host, { cmd: 'deliver', items: [{ gi: 0, m }] });
      return m;
    },
    // step-0473 (#70) — egress 뷰를 실 UpClient 로 되먹임: 실 host.js 존 tick 이 낸 send 중 게이트웨이-향 view/view_delta 를 골라
    //   해당 클라(자기 세션 's:'+avatar)의 onMsg 로 배달한다. 다운스트림 짝(0333 게이트웨이→클라 라우팅)의 경계 업스트림 판 —
    //   존→(소켓)→게이트웨이→실 UpClient. 반환=배달한 뷰 수. 세션 미지정 뷰(sessionId 무)는 all 클라.
    feedViews(sends, upclient) {
      let n = 0;
      const sid = 's:' + upclient.avatar;
      for (const s of sends) {
        if (s.to !== 'gateway' || !s.payload || !/^view/.test(s.payload.type)) continue;
        if (s.payload.sessionId && s.payload.sessionId !== sid) continue;
        upclient.onMsg({ payload: s.payload }); n++;
      }
      return n;
    },
    // step-0474 (#70) — 실 host.js 존의 권위 AOI 서명: snapshot 의 존 entity 위치를 UpClient.seenSig 와 같은 형식('id@x,y' 정렬)으로.
    //   경계 넘어 수렴 판정(upclient.seenSig()==authSig ⇒ desync 0)의 권위 기준(실 프로세스의 실 월드 상태·in-proc 권위 대신).
    async upstreamAuthSig(cluster, host, zone) {
      const s = await cluster.rpc(host, { cmd: 'snapshot' });
      const ents = (s.snap[zone] && s.snap[zone].ents) || [];
      return ents.map(([id, e]) => id + '@' + e.x + ',' + e.y).sort().join(';');
    },
  };
}

const __part = { makeClusterHostDriver };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).cluster_hostdriver = __part;
