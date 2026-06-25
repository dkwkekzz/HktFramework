// HktInfra step-0297 — 헤드리스 검증 (#9 멀티프로세스 배선 7: host 장애 dir 무효화 + 직접 라우팅 복구)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `gwdirdown`.
//   더한 한 조각: placeHostDown 뒤 게이트웨이 hostDown broadcast(죽은 host dir 일괄 무효화). survivor zoneLoc 재push 가 먼저 도착해 구조 존은 새 host 갱신·게이트웨이가 죽은 host 로 라우팅 안 함. OFF→0296 비트 동일(reg).
//   검증: ⒜ `reg`(키트·OFF 비트 동일). ⒝ `gwdirdown`(가설) — hostA 장애 후 z1 survivor 재가동·직접 enter 가 survivor 도달·dir==running·죽은 host 0·entitiesLost 정직·conserved.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { run } = NET;

function dirMatchesRunning(gw, orch) {
  if (gw.zoneDir.size !== orch.running.size) return false;
  for (const [z, h] of orch.running) if (gw.zoneDir.get(z) !== h) return false;
  return true;
}

// step-0297 #9 멀티프로세스 배선 7 검증 — host 장애 후 게이트웨이 디렉토리가 죽은 host 를 버리고 survivor 로 직접 라우팅 복구.
//   place z1@A·z2@B → 직접 enter a1→z1·a2→z2 → hostA 장애(z1 survivor hostC 재가동·a1 소실·새 인스턴스) → 직접 enter a3→z1(게이트웨이 갱신 dir 로 hostC 도달).
//   → z1={a3}·z2={a2}·total2·rtHost z1=hostC·dir==running·runtimeOn(hostA)0·lost1·hostInvalidated1·conserved(2==3−1). 장애가 직접 라우팅을 깨지 않고 복구.
function gwdirdown(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const DOWN = (at, host, hosts) => ({ at, op: { type: 'placeHostDown', host, hosts } });
  const ENTER = (at, zoneId, avatar) => ({ at, op: { type: 'zoneEnter', zoneId, avatar } });
  const HS = ['hostA', 'hostB', 'hostC'];
  const PLACEOPS = [PLACE(1, 'z1', 'hostA'), PLACE(2, 'z2', 'hostB'), DOWN(11, 'hostA', HS)];
  const ENTOPS = [ENTER(6, 'z1', 'a1'), ENTER(7, 'z2', 'a2'), ENTER(15, 'z1', 'a3')];
  const BASE = { clients: 6, moves: 24, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneEntityFlow: true, zoneHostHandle: true, gatewayZoneDir: true, gatewayDirectZone: true, placementOps: PLACEOPS, entityOps: ENTOPS };
  console.log('== gwdirdown (0297·#9 7): host 장애 dir 무효화 + 직접 라우팅 복구. hostA 장애→z1 survivor(hostC) 재가동(a1 소실)→직접 enter a3 가 갱신 dir 로 hostC 도달. total2·rtHost hostC·dir==running·hostA 0·lost1·invalid1·conserved. ==');
  console.log('seed   | z1 | z2 | total | rtHost | onA | dir== | lost | inv | consv | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 24, ...BASE });
    const o = r.orch, gw = r.gateway;
    const rtHost = o.zoneRuntimeHostOf('z1');
    const match = dirMatchesRunning(gw, o);
    const ok = check(o.zoneHasEntity('z1', 'a3') && !o.zoneHasEntity('z1', 'a1') && o.zoneEntityCount('z2') === 1 &&
      o.totalEntities() === 2 && rtHost === 'hostC' && o.runtimeOn('hostA') === 0 && match &&
      o.zoneEntitiesLost === 1 && gw.gatewayHostInvalidated === 1 && o.entityConserved(),
      `seed ${seed}: 장애 복구 위반 (z1a3 ${o.zoneHasEntity('z1', 'a3')}·z1a1 ${o.zoneHasEntity('z1', 'a1')}·rtHost ${rtHost}·onA ${o.runtimeOn('hostA')}·match ${match}·lost ${o.zoneEntitiesLost}·inv ${gw.gatewayHostInvalidated}·consv ${o.entityConserved()})`);
    console.log(`${pad(seed, 6)} | ${pad(o.zoneEntityCount('z1'), 2)} | ${pad(o.zoneEntityCount('z2'), 2)} | ${pad(o.totalEntities(), 5)} | ${pad(rtHost, 6)} | ${pad(o.runtimeOn('hostA'), 3)} | ${pad(match ? 'Y' : 'N', 5)} | ${pad(o.zoneEntitiesLost, 4)} | ${pad(gw.gatewayHostInvalidated, 3)} | ${pad(o.entityConserved() ? 'Y' : 'N', 5)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['gwdirdown'] = gwdirdown;
kit.ORDER.splice(1, 0, 'gwdirdown');

(async () => { process.exit(await kit.cli(process.argv)); })();
