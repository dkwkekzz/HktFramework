// HktInfra step-0393 — 헤드리스 검증 (#66 tick placement-aware 3·발현: run(ticks,onTick) mid-loop migrate)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `coordmidmigrate`.
//   더한 한 조각: cluster-coord.js run(ticks, onTick) 에 mid-loop lifecycle 훅. 루프 도중 migrate 도 placement-aware tick 이 추종해 maxDesync 0. OFF 동치: onTick 미제공이면 0392 동치. 새 박스·run() 미사용 → reg 0.
//   검증: ⒜ `reg`. ⒝ `coordmidmigrate` — 2 host·3 zone: run(5, t=2 에 migrate z1 A→B) → maxDesync 0·coordDesync 0·placementCoherent Y·migrations 1·대조 driver.clusterDesync>0(옛 orch plan 발산).
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');
const { Cluster } = require('./cluster-core.js');
const { makeClusterCoordinator } = require('./cluster-coord.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { run, fnv1a } = NET;

const zoneSpecOf = (zone) => ({ addr: zone, kind: 'zone', seed: fnv1a(String(zone)) >>> 0, opts: { grid: 16, radius: 4, region: { lo: 0, hi: 16 }, sibling: null, boundary: 16, orch: null, incremental: true } });
const realPos = (snap, zone, id) => { const z = snap && snap.snap ? snap.snap[zone] : null; const e = z && z.ents ? z.ents.find(([x]) => x === id) : null; return e ? e[1] : null; };

// 공유 시나리오 빌더 — 2 host·3 zone(z1@A·z2@B·z3@A)·entity a1@z1·b1@z2 + move. #62 코디네이터 arc 공통.
function coordScenario() {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const ENTER = (at, zoneId, avatar, from) => ({ at, from, op: { type: 'zoneEnter', zoneId, avatar } });
  const MOVE = (at, zoneId, avatar, dx, dy, from) => ({ at, from, op: { type: 'zoneMove', zoneId, avatar, dx, dy } });
  const OPS = [PLACE(1, 'z1', 'hostA'), PLACE(2, 'z2', 'hostB'), PLACE(3, 'z3', 'hostA')];
  const ENT = [ENTER(3, 'z1', 'a1', 'dc0'), ENTER(3, 'z2', 'b1', 'dc1')];
  for (let k = 0; k < 3; k++) { ENT.push(MOVE(4 + k, 'z1', 'a1', 1, 1, 'dc0')); ENT.push(MOVE(4 + k, 'z2', 'b1', 1, 0, 'dc1')); }
  return { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneEntityFlow: true, zoneHostHandle: true, zoneHostProc: true, gatewayZoneDir: true, gatewayDirectZone: true, clusterDriverReal: true, placementOps: OPS, entityOps: ENT };
}

// step-0393 #66 tick placement-aware 3·발현 — coordmidmigrate: run(5, t=2 에 migrate z1 A→B) → placement-aware tick/deliver 가 추종해 maxDesync 0·coordDesync 0·migrations 1·대조 driver.clusterDesync>0(옛 orch plan stale 발산).
async function coordmidmigrate(seeds) {
  const BASE = coordScenario();
  console.log('== coordmidmigrate (0393·#66 발현): 루프 도중 migrate. placement-aware tick 추종. ==');
  console.log('seed   | maxDesync | coordDesync | placecoh | migrations | clusterDesync(옛) | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 12, ...BASE });
    const o = r.orch, drv = o.clusterDriver;
    const cluster = new Cluster([]);
    let md = -1, cd = -1, pc = false, mig = -1, dd = -1;
    try {
      await cluster.spawn();
      const coord = makeClusterCoordinator(o, cluster, zoneSpecOf, drv);
      await coord.run(5, async (t, c) => { if (t === 2) await c.migrate('z1', 'hostA', 'hostB'); });   // 루프 도중 migrate
      md = coord.maxDesync; cd = await coord.coordDesync(); pc = await coord.placementCoherent(); mig = coord.migrations;
      dd = await drv.clusterDesync(o, cluster);                          // 옛 경로(orch plan stale) → 발산
    } finally { await cluster.shutdown(); }
    const ok = check(md === 0 && cd === 0 && pc && mig === 1 && dd > 0, `seed ${seed}: 위반 (md ${md}·cd ${cd}·pc ${pc}·mig ${mig}·dd ${dd})`);
    console.log(`${pad(seed, 6)} | ${pad(md, 9)} | ${pad(cd, 11)} | ${pad(pc ? 'Y' : 'N', 8)} | ${pad(mig, 10)} | ${pad(dd, 17)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['coordmidmigrate'] = coordmidmigrate;
kit.ORDER.splice(1, 0, 'coordmidmigrate');

(async () => { process.exit(await kit.cli(process.argv)); })();
