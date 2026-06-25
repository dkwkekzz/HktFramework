// HktInfra step-0296 — 헤드리스 검증 (#9 멀티프로세스 배선 6: 이주 중 직접 라우팅 정합 + stale 거부)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `gwdircoh`.
//   더한 한 조각: zoneStaleProbe 테스트 seam(낡은 host 단 zoneDeliver→orch host 불일치 거부). 이주 후 게이트웨이 디렉토리가 새 host 로 갱신돼 직접 라우팅이 옳은 런타임에 도달함 + stale frame 은 거부됨을 검증. OFF→0295 비트 동일(reg).
//   검증: ⒜ `reg`(키트·OFF 비트 동일). ⒝ `gwdircoh`(가설) — 이주 후 직접 enter 가 새 host 런타임 도달(같은 핸들)·디렉토리==running·stale probe 거부(zoneDirStale1·ax 부재)·conserved.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { run } = NET;

// 게이트웨이 디렉토리 ↔ orch.running 정합(0293 helper 재사용).
function dirMatchesRunning(gw, orch) {
  if (gw.zoneDir.size !== orch.running.size) return false;
  for (const [z, h] of orch.running) if (gw.zoneDir.get(z) !== h) return false;
  return true;
}

// step-0296 #9 멀티프로세스 배선 6 검증 — 이주 후 게이트웨이 직접 라우팅이 새 host 로 따라가고, 낡은 host frame 은 거부.
//   place z1@A → 직접 enter a1 → migrate z1 A→B(같은 핸들·a1 보존) → 직접 enter a2(게이트웨이 갱신된 dir 로 z1@B 해소→적용) + stale probe(ax·host=hostA·낡음).
//   → z1 a1+a2(total2)·runtimeHost z1=hostB·dir==running·zoneDirStale1(probe 거부)·ax 부재·conserved. 직접 라우팅이 이주를 따라가며 정합(stale 안전망).
function gwdircoh(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const MIG = (at, zoneId, toHost) => ({ at, op: { type: 'placeMigrate', zoneId, toHost } });
  const ENTER = (at, zoneId, avatar) => ({ at, op: { type: 'zoneEnter', zoneId, avatar } });
  const PLACEOPS = [PLACE(1, 'z1', 'hostA'), MIG(10, 'z1', 'hostB')];
  const ENTOPS = [ENTER(6, 'z1', 'a1'), ENTER(14, 'z1', 'a2')];
  const STALE = [{ at: 14, op: 'enter', zoneId: 'z1', avatar: 'ax', host: 'hostA' }];
  const BASE = { clients: 6, moves: 24, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneEntityFlow: true, zoneHostHandle: true, gatewayZoneDir: true, gatewayDirectZone: true, placementOps: PLACEOPS, entityOps: ENTOPS, zoneStaleProbe: STALE };
  console.log('== gwdircoh (0296·#9 6): 이주 중 직접 라우팅 정합 + stale 거부. migrate z1 A→B 후 직접 enter a2 가 갱신 dir 로 z1@B 도달(a1 보존)·낡은 host probe(ax) 거부. total2·rtHost=hostB·dir==running·stale1·ax 부재·conserved. ==');
  console.log('seed   | z1 | total | rtHost | dir== | stale | ax | consv | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 24, ...BASE });
    const o = r.orch, gw = r.gateway;
    const rtHost = o.zoneRuntimeHostOf('z1');
    const match = dirMatchesRunning(gw, o);
    const ok = check(o.zoneEntityCount('z1') === 2 && o.zoneHasEntity('z1', 'a1') && o.zoneHasEntity('z1', 'a2') &&
      o.totalEntities() === 2 && rtHost === 'hostB' && match && o.zoneDirStale === 1 && !o.zoneHasEntity('z1', 'ax') && o.entityConserved(),
      `seed ${seed}: 이주 라우팅 정합 위반 (z1 ${o.zoneEntityCount('z1')}·rtHost ${rtHost}·match ${match}·stale ${o.zoneDirStale}·ax ${o.zoneHasEntity('z1', 'ax')}·consv ${o.entityConserved()})`);
    console.log(`${pad(seed, 6)} | ${pad(o.zoneEntityCount('z1'), 2)} | ${pad(o.totalEntities(), 5)} | ${pad(rtHost, 6)} | ${pad(match ? 'Y' : 'N', 5)} | ${pad(o.zoneDirStale, 5)} | ${pad(o.zoneHasEntity('z1', 'ax') ? 'Y' : 'N', 2)} | ${pad(o.entityConserved() ? 'Y' : 'N', 5)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['gwdircoh'] = gwdircoh;
kit.ORDER.splice(1, 0, 'gwdircoh');

(async () => { process.exit(await kit.cli(process.argv)); })();
