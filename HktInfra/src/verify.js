// HktInfra step-0421 — 헤드리스 검증 (#61 업스트림 intent 실 클라 1: UpClient 골격 — joinAt 에 zoneEnter 발신)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `upclient`.
//   더한 한 조각: client.js UpClient(발신 액터·kind 'upclient')·topo-actors/build/run 배선. upClients=null(기본)→스폰 0→reg 0.
//   검증: ⒜ `reg`. ⒝ `upclient` — uc0 가 joinAt(3)에 zoneEnter 발신(sent≥1)→a1 이 실 존 z1 에 enter(orch.zoneEntityPos 존재).
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { run } = NET;

// 업스트림 실 클라 시나리오 빌더 — in-proc 브리지 데이터 평면(존→egress→클라) + upClients 발신 액터. #61 arc 공통.
//   placeZone z1@hostA → 실 EntityZone 런타임. upClients 가 enter/move 를 게이트웨이로 발신(gatewayDirectZone). downClients 0(uc 자체가 종단).
function upScenario(ucs) {
  return {
    ticks: 14, clients: 0, moves: 0, radius: 4, grid: 16, zones: 2, bus: true, failover: true,
    placeExecute: true, zoneBridge: true, zoneEntityFlow: true, gatewayZoneDir: true, gatewayDirectZone: true, zoneEgress: true,
    placementOps: [{ at: 1, op: { type: 'placeZone', zoneId: 'z1', host: 'hostA' } }, { at: 1, op: { type: 'placeZone', zoneId: 'z2', host: 'hostB' } }],
    upClients: ucs,
  };
}

// step-0421 #61 1 — upclient: uc0 가 joinAt 에 zoneEnter 발신 → a1 이 실 존 z1 에 enter.
function upclient(seeds) {
  console.log('== upclient (0421·#61 1): UpClient 골격 — uc0 가 joinAt(3) 에 zoneEnter 발신(sent≥1)→a1 이 실 존 z1 에 enter. ==');
  console.log('seed   | uc0.sent | a1@z1 | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ...upScenario([{ addr: 'uc0', avatar: 'a1', zoneId: 'z1', joinAt: 3 }]) });
    const uc0 = r.upclients[0];
    const pos = r.orch.zoneEntityPos('z1', 'a1');
    const ok = check(uc0 && uc0.sent >= 1 && !!pos, `seed ${seed}: enter 실패 (sent ${uc0 && uc0.sent}·a1 ${JSON.stringify(pos)})`);
    console.log(`${pad(seed, 6)} | ${pad(uc0 ? uc0.sent : 0, 8)} | ${pad(pos ? `{${pos.x},${pos.y}}` : 'N', 7)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['upclient'] = upclient;
kit.ORDER.splice(1, 0, 'upclient');

(async () => { process.exit(await kit.cli(process.argv)); })();
