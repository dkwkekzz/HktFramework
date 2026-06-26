// HktInfra step-0317 — 헤드리스 검증 (#9 잔여: entity 가중 부하 재배치 placeRebalanceE)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `hostrebalanceentity`.
//   더한 한 조각: placeRebalanceE 옵·_rebalanceByEntities — entity 무거운 host 의 존을 가벼운 host 로 이주(gap<2 까지·gap 단조 감소). placeRebalanceE 미수신이면 0316 비트 동일.
//   검증: ⒜ `reg`(키트·OFF 비트 동일). ⒝ `hostrebalanceentity`(가설) — A 에 entity 4 몰림(z1·z2 각 2)·B 0 → placeRebalanceE 로 z1→B·entity skew 4→0·무손실.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { run } = NET;

// step-0317 #9 잔여 검증 — entity 가중 부하 재배치(placeRebalanceE). z1·z2@A(각 entity 3 → A 부하 6)·z3@C(0)·두 컨테이너 {A:6, C:0}. entity gap 6.
//   placeRebalanceE([A,C]): 가장 무거운 A 의 한 존(z1·3명)을 가장 가벼운 C 로 이주 → A={z2}(3)·C={z1,z3}(3)·entity skew 6→0(균형). 같은 핸들 이주라 entity 무손실(보존). gap 단조 감소로 종료.
function hostrebalanceentity(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const ENTER = (at, zoneId, avatar) => ({ at, op: { type: 'zoneEnter', zoneId, avatar } });
  const REBALE = (at, hosts) => ({ at, op: { type: 'placeRebalanceE', hosts } });
  const AC = ['hostA', 'hostC'];
  const SETUP = [PLACE(1, 'z1', 'hostA'), PLACE(2, 'z2', 'hostA'), PLACE(3, 'z3', 'hostC')];
  const ENT = [ENTER(4, 'z1', 'a1'), ENTER(5, 'z1', 'a2'), ENTER(6, 'z1', 'a3'), ENTER(7, 'z2', 'a4'), ENTER(8, 'z2', 'a5'), ENTER(9, 'z2', 'a6')];
  const BASE = { clients: 6, moves: 24, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneEntityFlow: true, zoneHostHandle: true, zoneHostMailbox: true, gatewayZoneDir: true, gatewayDirectZone: true, zoneHostProc: true };
  console.log('== hostrebalanceentity (0317·#9 잔여): entity 가중 재배치. A 에 entity 6 몰림(z1·z2 각 3)·C 0(z3) → placeRebalanceE 로 z1→C·entity skew 6→0·무손실. ==');
  console.log('seed   | skew0 | skew1 | moves | total | consv | 판정');
  for (const seed of seeds) {
    const r0 = run({ seed, ticks: 14, ...BASE, placementOps: SETUP, entityOps: ENT });                          // 재배치 없음 — A 몰린 채.
    const r1 = run({ seed, ticks: 14, ...BASE, placementOps: [...SETUP, REBALE(11, AC)], entityOps: ENT });      // 재배치 후 — 균형.
    const s0 = r0.orch.hostEntitySkew().skew, s1 = r1.orch.hostEntitySkew().skew;
    const ok = check(s0 === 6 && s1 === 0 && r1.orch.rebalanceEMoves === 1 && r1.orch.totalEntities() === 6 &&
      r1.orch.entityConserved() && r1.orch.hostContainerCoherent() && r1.orch.running.size === 3,
      `seed ${seed}: entity 재배치 위반 (skew0 ${s0}·skew1 ${s1}·moves ${r1.orch.rebalanceEMoves}·total ${r1.orch.totalEntities()}·consv ${r1.orch.entityConserved()})`);
    console.log(`${pad(seed, 6)} | ${pad(s0, 5)} | ${pad(s1, 5)} | ${pad(r1.orch.rebalanceEMoves, 5)} | ${pad(r1.orch.totalEntities(), 5)} | ${pad(r1.orch.entityConserved() ? 'Y' : 'N', 5)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['hostrebalanceentity'] = hostrebalanceentity;
kit.ORDER.splice(1, 0, 'hostrebalanceentity');

(async () => { process.exit(await kit.cli(process.argv)); })();
