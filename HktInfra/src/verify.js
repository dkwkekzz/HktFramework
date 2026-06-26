// HktInfra step-0316 — 헤드리스 검증 (#9 잔여: entity 가중 부하 인지 자동 배치 placeAutoE)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `hostautoentity`.
//   더한 한 조각: placeAutoE 옵·_leastLoadedByEntities·hostEntityLoad — 후보 host 중 *entity 최소 부하* 선택(존 수 같아도 만원 host 회피). placeAutoE 미수신이면 0315 비트 동일.
//   검증: ⒜ `reg`(키트·OFF 비트 동일). ⒝ `hostautoentity`(가설) — z1@A(5명)·z2@B(0명)일 때 placeAuto(존 수)는 z3→A(만원), placeAutoE(entity)는 z3→B(한가).
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { run } = NET;

// step-0316 #9 잔여 검증 — entity 가중 부하 인지 자동 배치(placeAutoE). z1@A(엔티티 5)·z2@B(엔티티 0): 존 수는 A·B 둘 다 1(균형으로 보임).
//   placeAuto(존 수 기준)는 동률 tie-break 으로 z3→A(만원 host 에 또 얹음). placeAutoE(entity 기준)는 z3→B(한가한 host) — 동접 가중이 만원 host 회피.
function hostautoentity(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const ENTER = (at, zoneId, avatar) => ({ at, op: { type: 'zoneEnter', zoneId, avatar } });
  const AUTO = (at, zoneId, hosts) => ({ at, op: { type: 'placeAuto', zoneId, hosts } });
  const AUTOE = (at, zoneId, hosts) => ({ at, op: { type: 'placeAutoE', zoneId, hosts } });
  const AB = ['hostA', 'hostB'];
  const SETUP = [PLACE(1, 'z1', 'hostA'), PLACE(2, 'z2', 'hostB')];
  const ENT = [ENTER(4, 'z1', 'a1'), ENTER(5, 'z1', 'a2'), ENTER(6, 'z1', 'a3'), ENTER(7, 'z1', 'a4'), ENTER(8, 'z1', 'a5')];
  const BASE = { clients: 6, moves: 24, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneEntityFlow: true, zoneHostHandle: true, zoneHostMailbox: true, gatewayZoneDir: true, gatewayDirectZone: true, zoneHostProc: true };
  console.log('== hostautoentity (0316·#9 잔여): entity 가중 자동 배치. z1@A(5명)·z2@B(0명)·존 수 균형. placeAuto(존 수)→z3@A(만원), placeAutoE(entity)→z3@B(한가). ==');
  console.log('seed   | auto z3 | autoE z3 | hcoh | 판정');
  for (const seed of seeds) {
    const rA = run({ seed, ticks: 14, ...BASE, placementOps: [...SETUP, AUTO(10, 'z3', AB)], entityOps: ENT });
    const rE = run({ seed, ticks: 14, ...BASE, placementOps: [...SETUP, AUTOE(10, 'z3', AB)], entityOps: ENT });
    const hA = rA.orch.running.get('z3'), hE = rE.orch.running.get('z3');
    const ok = check(hA === 'hostA' && hE === 'hostB' && rE.orch.autoEPlacements === 1 && rE.orch.hostContainerCoherent() && rE.orch.running.size === 3,
      `seed ${seed}: entity 가중 배치 위반 (auto z3 ${hA}·autoE z3 ${hE}·autoE# ${rE.orch.autoEPlacements}·hcoh ${rE.orch.hostContainerCoherent()})`);
    console.log(`${pad(seed, 6)} | ${pad(hA, 7)} | ${pad(hE, 8)} | ${pad(rE.orch.hostContainerCoherent() ? 'Y' : 'N', 4)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['hostautoentity'] = hostautoentity;
kit.ORDER.splice(1, 0, 'hostautoentity');

(async () => { process.exit(await kit.cli(process.argv)); })();
