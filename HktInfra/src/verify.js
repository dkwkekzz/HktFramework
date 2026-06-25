// HktInfra step-0282 — 헤드리스 검증 (#56 브리지 존 데이터 평면 2: move 흐름·런타임 tick)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `zonemove`.
//   더한 한 조각: zoneMove 가 실 EntityZone 핸들로 이동 의도를 흘리고(pending), orch 가 런타임 onTick 을 구동해 위치를 적용한다(실 zone.js 시뮬). OFF→0281 비트 동일(reg).
//   검증: ⒜ `reg`(키트·OFF 비트 동일). ⒝ `zonemove`(가설) — enter-only vs enter+move 두 런 위치 비교: 이동량만큼 결정론적으로 이동·위치 보존.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { run } = NET;

// step-0282 #56 브리지 존 데이터 평면 2 검증 — zoneMove 가 실 EntityZone 핸들로 흐르고 orch 가 런타임 onTick 으로 위치 적용.
//   enter-only 런(기준 위치) vs enter+move 런(이동 후 위치)을 비교: 이동량 (3,1)+(2,−1)=(5,0) 만큼 격자 wrap 으로 결정론 이동.
//   런타임 시드=fnv1a(zoneId)·run seed 무관 → 두 런 같은 기준 위치(결정론). zoneMoves==2(수락분).
function zonemove(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const ENTER = (at, zoneId, avatar) => ({ at, op: { type: 'zoneEnter', zoneId, avatar } });
  const MOVE = (at, zoneId, avatar, dx, dy) => ({ at, op: { type: 'zoneMove', zoneId, avatar, dx, dy } });
  const G = 16;
  const PLACEOPS = [PLACE(1, 'z1', 'hostA')];
  const ENT_ONLY = [ENTER(2, 'z1', 'a1')];
  const ENT_MOVE = [ENTER(2, 'z1', 'a1'), MOVE(4, 'z1', 'a1', 3, 1), MOVE(5, 'z1', 'a1', 2, -1)];
  const COMMON = { clients: 6, moves: 20, radius: 4, grid: G, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneEntityFlow: true, placementOps: PLACEOPS };
  console.log('== zonemove (0282·#56 2): 브리지 존 move 흐름 — zoneMove→실 EntityZone pending→orch 런타임 onTick 위치 적용. enter-only vs enter+move(3,1)+(2,-1)=(5,0) 비교: 결정론 이동·zoneMoves==2. ==');
  console.log('seed   | base(x,y) | moved(x,y) | 기대(x,y) | moves | 판정');
  for (const seed of seeds) {
    const rB = run({ seed, ticks: 10, ...COMMON, entityOps: ENT_ONLY });
    const rM = run({ seed, ticks: 10, ...COMMON, entityOps: ENT_MOVE });
    const pb = rB.orch.zoneEntityPos('z1', 'a1');
    const pm = rM.orch.zoneEntityPos('z1', 'a1');
    const exp = pb ? { x: (pb.x + 5 + G) % G, y: (pb.y + 0 + G) % G } : null;
    const ok = check(pb && pm && exp && pm.x === exp.x && pm.y === exp.y && (pm.x !== pb.x || pm.y !== pb.y) && rM.orch.zoneMoves === 2,
      `seed ${seed}: move 위반 (base ${JSON.stringify(pb)}·moved ${JSON.stringify(pm)}·exp ${JSON.stringify(exp)}·moves ${rM.orch.zoneMoves})`);
    console.log(`${pad(seed, 6)} | ${pad(pb ? pb.x + ',' + pb.y : '∅', 9)} | ${pad(pm ? pm.x + ',' + pm.y : '∅', 10)} | ${pad(exp ? exp.x + ',' + exp.y : '∅', 9)} | ${pad(rM.orch.zoneMoves, 5)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['zonemove'] = zonemove;
kit.ORDER.splice(1, 0, 'zonemove');

(async () => { process.exit(await kit.cli(process.argv)); })();
