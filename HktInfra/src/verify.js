// HktInfra step-0313 — 헤드리스 검증 (#9 잔여: 다중 존 host 프로세스 장애 failover)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `hostfailover`.
//   더한 한 조각: hostZones(host) 질의(그 host 컨테이너 소유 존 목록·zoneHostSnapshot 의 단건 판). 다중 존을 인 host 가 죽으면 그 존들 일괄 failover·생존 host 인수·죽은 host 비움(읽기 전용).
//   검증: ⒜ `reg`(키트·OFF 비트 동일). ⒝ `hostfailover`(가설) — 2존 인 hostA 장애 → 두 존 생존 host 로 재가동·entity 3 소실·z3 보존·hostZones(A) 빈·despawn A·conserved.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { run } = NET;

// step-0313 #9 잔여 검증 — 다중 존을 인 host 프로세스 장애. hostA 에 z1·z2(엔티티 3)·hostB 에 z3(엔티티 1). placeHostDown(hostA) → z1·z2 를 생존 host 로 *재가동*(비자발·새 인스턴스·상태 소실).
//   장애 후: hostA 컨테이너 비움(hostZones(A)==[] · despawn 로그)·z1·z2 의 entity 3 소실(zoneEntitiesLost)·z3 의 entity 1 보존·총 entity 1·hostContainerCoherent·entityConserved.
function hostfailover(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const ENTER = (at, zoneId, avatar) => ({ at, op: { type: 'zoneEnter', zoneId, avatar } });
  const DOWN = (at, host, hosts) => ({ at, op: { type: 'placeHostDown', host, hosts } });
  const HS = ['hostA', 'hostB', 'hostC'];
  const OPS = [PLACE(1, 'z1', 'hostA'), PLACE(2, 'z2', 'hostA'), PLACE(3, 'z3', 'hostB'), DOWN(12, 'hostA', HS)];
  const ENT = [ENTER(5, 'z1', 'a1'), ENTER(6, 'z1', 'a2'), ENTER(7, 'z2', 'a3'), ENTER(8, 'z3', 'a4')];
  const BASE = { clients: 6, moves: 24, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneEntityFlow: true, zoneHostHandle: true, zoneHostMailbox: true, gatewayZoneDir: true, gatewayDirectZone: true, zoneHostProc: true, zoneHostLifecycle: true };
  console.log('== hostfailover (0313·#9 잔여): 다중 존 host 장애. hostA(z1·z2·엔티티3)+hostB(z3·엔티티1)·placeHostDown(A) → z1·z2 재가동·entity3 소실·z3 보존·hostZones(A)==[]·despawn A·conserved. ==');
  console.log('seed   | total | lost | A빈 | despwnA | hcoh | consv | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 16, ...BASE, placementOps: OPS, entityOps: ENT });
    const o = r.orch;
    const aEmpty = o.hostZones('hostA').length === 0;
    const despA = o.hostLifecycle().some(e => e.host === 'hostA' && e.kind === 'despawn');
    const ok = check(o.totalEntities() === 1 && o.zoneEntitiesLost === 3 && aEmpty && despA &&
      o.hostContainerCoherent() && o.entityConserved() && o.zoneHasEntity('z3', 'a4'),
      `seed ${seed}: 다중 존 host 장애 위반 (total ${o.totalEntities()}·lost ${o.zoneEntitiesLost}·A빈 ${aEmpty}·despA ${despA}·hcoh ${o.hostContainerCoherent()}·consv ${o.entityConserved()})`);
    console.log(`${pad(seed, 6)} | ${pad(o.totalEntities(), 5)} | ${pad(o.zoneEntitiesLost, 4)} | ${pad(aEmpty ? 'Y' : 'N', 3)} | ${pad(despA ? 'Y' : 'N', 7)} | ${pad(o.hostContainerCoherent() ? 'Y' : 'N', 4)} | ${pad(o.entityConserved() ? 'Y' : 'N', 5)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['hostfailover'] = hostfailover;
kit.ORDER.splice(1, 0, 'hostfailover');

(async () => { process.exit(await kit.cli(process.argv)); })();
