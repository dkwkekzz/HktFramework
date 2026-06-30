// HktInfra step-0422 — 헤드리스 검증 (#61 업스트림 intent 실 클라 2: UpClient move 발신 — plan 한 발씩 zoneMove)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `upmove`.
//   더한 한 조각: UpClient.onTick 이 enter 이후 plan 한 발씩 zoneMove 발신. upClients=null(기본)→스폰 0→reg 0.
//   검증: ⒜ `reg`. ⒝ `upmove` — uc0 가 enter(5,5)+plan[[3,2],[1,1]] 발신 → a1 최종 위치 == enter+Σplan.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { run } = NET;

function upScenario(ucs) {
  return {
    ticks: 14, clients: 0, moves: 0, radius: 4, grid: 16, zones: 2, bus: true, failover: true,
    placeExecute: true, zoneBridge: true, zoneEntityFlow: true, gatewayZoneDir: true, gatewayDirectZone: true, zoneEgress: true,
    placementOps: [{ at: 1, op: { type: 'placeZone', zoneId: 'z1', host: 'hostA' } }, { at: 1, op: { type: 'placeZone', zoneId: 'z2', host: 'hostB' } }],
    upClients: ucs,
  };
}

// step-0422 #61 2 — upmove: uc0 가 enter+plan 발신 → a1 최종 위치 == enter(5,5)+Σplan(클램프 없으면). plan=[[3,2],[1,1]] → (5,5)→(8,7)→(9,8).
function upmove(seeds) {
  console.log('== upmove (0422·#61 2): UpClient.onTick plan 한 발씩 zoneMove → a1 최종 위치 == enter(5,5)+Σplan. ==');
  console.log('seed   | uc0.sent | a1 최종 | 기대 | 판정');
  const plan = [[3, 2], [1, 1]];
  const exp = { x: 5 + 3 + 1, y: 5 + 2 + 1 };   // 그리드 16·반경 4 내라 클램프 0
  for (const seed of seeds) {
    const r = run({ seed, ...upScenario([{ addr: 'uc0', avatar: 'a1', zoneId: 'z1', joinAt: 3, plan }]) });
    const uc0 = r.upclients[0];
    const pos = r.orch.zoneEntityPos('z1', 'a1');
    const ok = check(uc0 && uc0.sent === 1 + plan.length && pos && pos.x === exp.x && pos.y === exp.y,
      `seed ${seed}: move 실패 (sent ${uc0 && uc0.sent}·a1 ${JSON.stringify(pos)}·기대 ${JSON.stringify(exp)})`);
    console.log(`${pad(seed, 6)} | ${pad(uc0 ? uc0.sent : 0, 8)} | ${pad(pos ? `{${pos.x},${pos.y}}` : 'N', 7)} | ${pad(`{${exp.x},${exp.y}}`, 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['upmove'] = upmove;
kit.ORDER.splice(1, 0, 'upmove');

(async () => { process.exit(await kit.cli(process.argv)); })();
