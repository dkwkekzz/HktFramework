// HktInfra step-0318 — 헤드리스 검증 (#9 잔여: host 프로세스 부하 균형 술어 hostBalanced·부하 sub-arc capstone)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `hostbalancecap`.
//   더한 한 조각: hostBalanced(zoneTol, entTol)(존 수 불균형 && entity 불균형 둘 다 허용 안). 부하 균형 sub-arc(0311~0317) 종합 — 재배치 전 거짓·후 참(읽기 전용).
//   검증: ⒜ `reg`(키트·OFF 비트 동일). ⒝ `hostbalancecap`(capstone) — entity 몰린 클러스터 재배치 전 hostBalanced false·placeRebalanceE 후 true·conserved·coherent.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { run } = NET;

// step-0318 #9 잔여 capstone — 부하 균형 sub-arc(0311~0317) 종합. z1·z2@A(각 entity 2 → A 부하 4)·z3@C(0): entity 불균형(skew 4)으로 hostBalanced(2,2) false.
//   placeRebalanceE([A,C]) → z1→C·A={z2}(2)·C={z3,z1}(2)·entity skew 0 → hostBalanced(2,2) true. 균형 달성 후에도 entityConserved·hostContainerCoherent(부하 균형이 정합 불변을 깨지 않음).
function hostbalancecap(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const ENTER = (at, zoneId, avatar) => ({ at, op: { type: 'zoneEnter', zoneId, avatar } });
  const REBALE = (at, hosts) => ({ at, op: { type: 'placeRebalanceE', hosts } });
  const AC = ['hostA', 'hostC'];
  const SETUP = [PLACE(1, 'z1', 'hostA'), PLACE(2, 'z2', 'hostA'), PLACE(3, 'z3', 'hostC')];
  const ENT = [ENTER(4, 'z1', 'a1'), ENTER(5, 'z1', 'a2'), ENTER(6, 'z2', 'a3'), ENTER(7, 'z2', 'a4')];
  const BASE = { clients: 6, moves: 24, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneEntityFlow: true, zoneHostHandle: true, zoneHostMailbox: true, gatewayZoneDir: true, gatewayDirectZone: true, zoneHostProc: true };
  console.log('== hostbalancecap (0318·#9 잔여 capstone): 부하 균형 sub-arc. entity 몰린 클러스터 hostBalanced 전 false → placeRebalanceE → true·conserved·coherent. ==');
  console.log('seed   | bal0 | bal1 | skew0 | skew1 | consv | hcoh | 판정');
  for (const seed of seeds) {
    const r0 = run({ seed, ticks: 14, ...BASE, placementOps: SETUP, entityOps: ENT });
    const r1 = run({ seed, ticks: 14, ...BASE, placementOps: [...SETUP, REBALE(10, AC)], entityOps: ENT });
    const b0 = r0.orch.hostBalanced(2, 2), b1 = r1.orch.hostBalanced(2, 2);
    const s0 = r0.orch.hostEntitySkew().skew, s1 = r1.orch.hostEntitySkew().skew;
    const ok = check(b0 === false && b1 === true && s0 === 4 && s1 === 0 &&
      r1.orch.entityConserved() && r1.orch.hostContainerCoherent() && r1.orch.totalEntities() === 4,
      `seed ${seed}: capstone 위반 (bal0 ${b0}·bal1 ${b1}·skew0 ${s0}·skew1 ${s1}·consv ${r1.orch.entityConserved()}·hcoh ${r1.orch.hostContainerCoherent()})`);
    console.log(`${pad(seed, 6)} | ${pad(b0 ? 'Y' : 'N', 4)} | ${pad(b1 ? 'Y' : 'N', 4)} | ${pad(s0, 5)} | ${pad(s1, 5)} | ${pad(r1.orch.entityConserved() ? 'Y' : 'N', 5)} | ${pad(r1.orch.hostContainerCoherent() ? 'Y' : 'N', 4)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['hostbalancecap'] = hostbalancecap;
kit.ORDER.splice(1, 0, 'hostbalancecap');

(async () => { process.exit(await kit.cli(process.argv)); })();
