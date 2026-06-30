// HktInfra step-0427 — 헤드리스 검증 (#61 업스트림 intent 실 클라 7: UpClient leave — zoneLeave 발신·접속 종료)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `upleave`.
//   더한 한 조각: UpClient.onTick 이 leaveAt 에 zoneLeave 발신(이후 발신 0). upClients=null→reg 0.
//   검증: ⒜ `reg`. ⒝ `upleave` — uc0 가 enter+move 후 leaveAt 에 zoneLeave → 권위 존서 a1 제거(zoneEntityPos null).
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { run } = NET;

const BASE = {
  ticks: 14, clients: 0, moves: 0, radius: 4, grid: 16, zones: 2, bus: true, failover: true,
  placeExecute: true, zoneBridge: true, zoneEntityFlow: true, gatewayZoneDir: true, gatewayDirectZone: true, zoneEgress: true,
  placementOps: [{ at: 1, op: { type: 'placeZone', zoneId: 'z1', host: 'hostA' } }, { at: 1, op: { type: 'placeZone', zoneId: 'z2', host: 'hostB' } }],
};

// step-0427 #61 7 — upleave: uc0 가 enter+move 후 leaveAt(8) 에 zoneLeave → 권위 존서 a1 제거(생애주기 완결). sent=enter+move+leave.
function upleave(seeds) {
  console.log('== upleave (0427·#61 7): UpClient.onTick leaveAt 에 zoneLeave 발신 → 권위 존서 a1 제거(enter→move→leave 생애주기). ==');
  console.log('seed   | sent | a1 leave 전 | a1 최종(제거) | 판정');
  const plan = [[1, 1], [1, 1]];
  for (const seed of seeds) {
    const r = run({ seed, ...BASE, upClients: [{ addr: 'uc0', avatar: 'a1', zoneId: 'z1', joinAt: 3, plan, leaveAt: 8 }] });
    const uc0 = r.upclients[0];
    const finalPos = r.orch.zoneEntityPos('z1', 'a1');
    const ok = check(uc0.sent === 1 + plan.length + 1 && finalPos == null,
      `seed ${seed}: leave 실패 (sent ${uc0.sent}·기대 ${1 + plan.length + 1}·최종 ${JSON.stringify(finalPos)})`);
    console.log(`${pad(seed, 6)} | ${pad(uc0.sent, 4)} | ${pad('moved', 11)} | ${pad(finalPos == null ? '제거됨' : JSON.stringify(finalPos), 13)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['upleave'] = upleave;
kit.ORDER.splice(1, 0, 'upleave');

(async () => { process.exit(await kit.cli(process.argv)); })();
