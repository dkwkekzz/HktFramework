// HktInfra step-0281 — 헤드리스 검증 (#56 브리지 존 데이터 평면 1: enter 흐름)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `zoneenter`.
//   더한 한 조각: zoneEntityFlow ON 이면 게이트웨이→orch zoneEnter 가 *실 EntityZone 핸들*(zoneRuntimes)로 enter 를 흘린다(0272~0280 빈 핸들에 실 entity 가 산다). 미가동 존은 거부. OFF→0280 비트 동일(reg).
//   검증: ⒜ `reg`(키트·OFF 비트 동일). ⒝ `zoneenter`(가설) — z1/z2 에 enter 라우팅 후 실 zone.js ents 에 avatar 존재·미가동 존 거부·zoneEnters 정합.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { run } = NET;

// step-0281 #56 브리지 존 데이터 평면 1 검증 — zoneEntityFlow ON 이면 게이트웨이→orch zoneEnter 가 실 EntityZone 핸들로
//   enter 를 흘린다. z1(hostA)·z2(hostB) 배치 후 a1·a2→z1·a3→z2 enter → 실 zone.js ents 에 산다(count z1=2·z2=1).
//   미가동 존 z9 enter 는 거부(런타임 없음·count 0·zoneEnters 무증). zoneEnters==3(수락분).
function zoneenter(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const ENTER = (at, zoneId, avatar) => ({ at, op: { type: 'zoneEnter', zoneId, avatar } });
  const PLACEOPS = [PLACE(1, 'z1', 'hostA'), PLACE(2, 'z2', 'hostB')];
  const ENTOPS = [ENTER(3, 'z1', 'a1'), ENTER(4, 'z1', 'a2'), ENTER(5, 'z2', 'a3'), ENTER(6, 'z9', 'ax')];
  const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneEntityFlow: true, placementOps: PLACEOPS, entityOps: ENTOPS };
  console.log('== zoneenter (0281·#56 1): 브리지 존 데이터 평면 — 게이트웨이→orch zoneEnter 가 실 EntityZone 핸들로 흐름. z1(2)·z2(1) enter 후 실 zone.js ents 에 avatar 존재·미가동 z9 거부(count 0)·zoneEnters==3. ==');
  console.log('seed   | z1cnt | z2cnt | z9cnt | z1.a1 | z2.a3 | enters | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 10, ...BASE });
    const o = r.orch;
    const c1 = o.zoneEntityCount('z1'), c2 = o.zoneEntityCount('z2'), c9 = o.zoneEntityCount('z9');
    const ok = check(c1 === 2 && c2 === 1 && c9 === 0 && o.zoneHasEntity('z1', 'a1') && o.zoneHasEntity('z2', 'a3') && o.zoneEnters === 3,
      `seed ${seed}: enter 위반 (z1 ${c1}·z2 ${c2}·z9 ${c9}·enters ${o.zoneEnters})`);
    console.log(`${pad(seed, 6)} | ${pad(c1, 5)} | ${pad(c2, 5)} | ${pad(c9, 5)} | ${pad(o.zoneHasEntity('z1', 'a1') ? 'Y' : 'N', 5)} | ${pad(o.zoneHasEntity('z2', 'a3') ? 'Y' : 'N', 5)} | ${pad(o.zoneEnters, 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['zoneenter'] = zoneenter;
kit.ORDER.splice(1, 0, 'zoneenter');

(async () => { process.exit(await kit.cli(process.argv)); })();
