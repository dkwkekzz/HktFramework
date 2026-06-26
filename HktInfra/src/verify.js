// HktInfra step-0324 — 헤드리스 검증 (#9 후속: host 산출 뷰의 AOI exit 델타 — 동적 가시 상실)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `hostzoneexit`.
//   더한 한 조각: 질의 zoneViewExited(세션이 시야에서 잃은 누적 id). 두 avatar 가 멀어지면 서로의 AOI 에서 빠져 exit 델타(enter 0322 의 짝)인지 검증(읽기 전용).
//   검증: ⒜ `reg`(키트·OFF 비트 동일). ⒝ `hostzoneexit`(가설) — a1 이 a2 에 접근(enter)했다 멀어짐(exit) → 서로 exit·최종 vis 자기만.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { run } = NET;

// step-0324 #9 후속 검증 — host 산출 뷰의 AOI exit 델타(zoneViewExited). a1 을 a2 쪽으로 6회 접근(반경 안·enter) 후 다시 6회 멀어짐(반경 밖·exit) → 원위치 (5,5).
//   a1 의 뷰에 a2 가 exit·a2 의 뷰에 a1 이 exit(동적 가시 상실·enter 의 짝). 최종 zoneVisibleIds 둘 다 자기만 — AOI 가 멀어짐을 host 뷰가 정확히 산출(시야 이탈 전파).
function hostzoneexit(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const ENTER = (at, zoneId, avatar) => ({ at, op: { type: 'zoneEnter', zoneId, avatar } });
  const MOVE = (at, zoneId, avatar, dx, dy) => ({ at, op: { type: 'zoneMove', zoneId, avatar, dx, dy } });
  const mv = []; for (let t = 6; t <= 11; t++) mv.push(MOVE(t, 'z1', 'a1', 1, 1)); for (let t = 13; t <= 18; t++) mv.push(MOVE(t, 'z1', 'a1', -1, -1));
  const OPS = [PLACE(1, 'z1', 'hostA')];
  const ENT = [ENTER(3, 'z1', 'a1'), ENTER(4, 'z1', 'a2'), ...mv];
  const BASE = { clients: 6, moves: 24, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneEntityFlow: true, zoneHostHandle: true, zoneHostMailbox: true, gatewayZoneDir: true, gatewayDirectZone: true, zoneHostProc: true };
  console.log('== hostzoneexit (0324·#9 후속): host 산출 뷰의 AOI exit 델타. a1 이 a2 에 접근(enter) 후 멀어짐(exit) → 서로 exit·최종 vis 자기만. ==');
  console.log('seed   | a1exit | a2exit | finVis | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 22, ...BASE, placementOps: OPS, entityOps: ENT });
    const o = r.orch;
    const x1 = o.zoneViewExited('z1', 's:a1'), x2 = o.zoneViewExited('z1', 's:a2');
    const v1 = o.zoneVisibleIds('z1', 'a1'), v2 = o.zoneVisibleIds('z1', 'a2');
    const finVis = v1.join(',') === 'a1' && v2.join(',') === 'a2';
    const ok = check(x1.includes('a2') && x2.includes('a1') && finVis,
      `seed ${seed}: AOI exit 위반 (a1exit ${x1}·a2exit ${x2}·v1 ${v1}·v2 ${v2})`);
    console.log(`${pad(seed, 6)} | ${pad(x1.join('|'), 6)} | ${pad(x2.join('|'), 6)} | ${pad(finVis ? 'Y' : 'N', 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['hostzoneexit'] = hostzoneexit;
kit.ORDER.splice(1, 0, 'hostzoneexit');

(async () => { process.exit(await kit.cli(process.argv)); })();
