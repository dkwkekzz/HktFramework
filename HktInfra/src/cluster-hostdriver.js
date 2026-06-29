'use strict';
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
  };
}

const __part = { makeClusterHostDriver };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).cluster_hostdriver = __part;
