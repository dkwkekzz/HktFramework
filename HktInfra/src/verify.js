// HktInfra step-0322 — 헤드리스 검증 (#9 후속: host 산출 뷰의 상호 가시 — AOI enter 델타)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `hostzonemutual`.
//   더한 한 조각: 질의 zoneViewEntered(세션이 enter 로 본 누적 id 집합). 두 avatar 가 가까워지면 서로의 AOI 에 들어와 상호 가시(enter 델타)인지 검증(읽기 전용).
//   검증: ⒜ `reg`(키트·OFF 비트 동일). ⒝ `hostzonemutual`(가설) — a1 이 a2 쪽으로 이동해 반경 안 → a1 가 a2 를·a2 가 a1 을 enter(상호 가시)·최종 vis 둘 다 [a1,a2].
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { run } = NET;

// step-0322 #9 후속 검증 — host 산출 뷰의 상호 가시(zoneViewEntered). a1(5,5)·a2(13,15)는 처음 반경 4 밖. a1 을 (1,1)씩 6회 이동시켜 (11,11) → a2 와 Chebyshev 4(반경 안).
//   가까워지는 순간 a1 의 뷰에 a2 가 enter·a2 의 뷰에 a1 이 enter(상호 가시·AOI enter 델타). 최종 zoneVisibleIds 둘 다 [a1,a2]. AOI 의 *동적* 가시 변화를 host 뷰가 정확히 산출.
function hostzonemutual(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const ENTER = (at, zoneId, avatar) => ({ at, op: { type: 'zoneEnter', zoneId, avatar } });
  const MOVE = (at, zoneId, avatar, dx, dy) => ({ at, op: { type: 'zoneMove', zoneId, avatar, dx, dy } });
  const mv = []; for (let t = 6; t <= 11; t++) mv.push(MOVE(t, 'z1', 'a1', 1, 1));
  const OPS = [PLACE(1, 'z1', 'hostA')];
  const ENT = [ENTER(3, 'z1', 'a1'), ENTER(4, 'z1', 'a2'), ...mv];
  const BASE = { clients: 6, moves: 24, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneEntityFlow: true, zoneHostHandle: true, zoneHostMailbox: true, gatewayZoneDir: true, gatewayDirectZone: true, zoneHostProc: true };
  console.log('== hostzonemutual (0322·#9 후속): host 산출 뷰의 상호 가시. a1 이 a2 쪽으로 이동→반경 안→a1 가 a2 를·a2 가 a1 을 enter(상호 가시)·최종 vis 둘 다 [a1,a2]. ==');
  console.log('seed   | a1entered | a2entered | mutVis | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 16, ...BASE, placementOps: OPS, entityOps: ENT });
    const o = r.orch;
    const e1 = o.zoneViewEntered('z1', 's:a1'), e2 = o.zoneViewEntered('z1', 's:a2');
    const v1 = o.zoneVisibleIds('z1', 'a1'), v2 = o.zoneVisibleIds('z1', 'a2');
    const mutVis = v1.join(',') === 'a1,a2' && v2.join(',') === 'a1,a2';
    const ok = check(e1.includes('a2') && e2.includes('a1') && mutVis,
      `seed ${seed}: 상호 가시 위반 (a1entered ${e1}·a2entered ${e2}·v1 ${v1}·v2 ${v2})`);
    console.log(`${pad(seed, 6)} | ${pad(e1.join('|'), 9)} | ${pad(e2.join('|'), 9)} | ${pad(mutVis ? 'Y' : 'N', 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['hostzonemutual'] = hostzonemutual;
kit.ORDER.splice(1, 0, 'hostzonemutual');

(async () => { process.exit(await kit.cli(process.argv)); })();
