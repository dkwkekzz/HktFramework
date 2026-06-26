// HktInfra step-0314 — 헤드리스 검증 (#9 잔여: host 프로세스 entity 가중 부하 hostEntitySkew)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `hostentityskew`.
//   더한 한 조각: hostEntitySkew()(부하를 entity 수로). 존 수는 균형이어도 entity 가 한 host 에 몰리면 실 부하는 불균형 — 존 수 렌즈가 못 보는 것을 드러냄(읽기 전용).
//   검증: ⒜ `reg`(키트·OFF 비트 동일). ⒝ `hostentityskew`(가설) — 존 수 균형(skew 0)인데 entity 는 A 몰림(skew 3): hostLoadSkew 0 vs hostEntitySkew 3.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { run } = NET;

// step-0314 #9 잔여 검증 — entity 가중 부하(hostEntitySkew). z1@A·z2@B·z3@C(존 수 1·1·1 = 균형) 인데 entity 는 z1(A)에 3·z2(B)에 1·z3(C)에 0.
//   존 수 렌즈(hostLoadSkew)는 skew 0(균형으로 착각)이지만 entity 렌즈(hostEntitySkew)는 skew 3(A 만원) — 실 부하 불균형을 entity 가중이 드러낸다. 재배치 판단의 더 정직한 척도.
function hostentityskew(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const ENTER = (at, zoneId, avatar) => ({ at, op: { type: 'zoneEnter', zoneId, avatar } });
  const OPS = [PLACE(1, 'z1', 'hostA'), PLACE(2, 'z2', 'hostB'), PLACE(3, 'z3', 'hostC')];
  const ENT = [ENTER(5, 'z1', 'a1'), ENTER(6, 'z1', 'a2'), ENTER(7, 'z1', 'a3'), ENTER(8, 'z2', 'a4')];
  const BASE = { clients: 6, moves: 24, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneEntityFlow: true, zoneHostHandle: true, zoneHostMailbox: true, gatewayZoneDir: true, gatewayDirectZone: true, zoneHostProc: true };
  console.log('== hostentityskew (0314·#9 잔여): entity 가중 부하. 존 수 균형(skew 0)인데 entity 는 A 몰림(skew 3) — 존 수 렌즈가 못 보는 실 부하 불균형을 entity 가중이 드러냄. ==');
  console.log('seed   | zoneSkew | entSkew | entMax | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 12, ...BASE, placementOps: OPS, entityOps: ENT });
    const o = r.orch;
    const zs = o.hostLoadSkew(), es = o.hostEntitySkew();
    const ok = check(zs.skew === 0 && es.skew === 3 && es.max === 3 && es.min === 0 && o.totalEntities() === 4,
      `seed ${seed}: entity 가중 부하 위반 (zoneSkew ${zs.skew}·entSkew ${es.skew}·entMax ${es.max}·total ${o.totalEntities()})`);
    console.log(`${pad(seed, 6)} | ${pad(zs.skew, 8)} | ${pad(es.skew, 7)} | ${pad(es.max, 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['hostentityskew'] = hostentityskew;
kit.ORDER.splice(1, 0, 'hostentityskew');

(async () => { process.exit(await kit.cli(process.argv)); })();
