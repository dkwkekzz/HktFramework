// HktInfra step-0411 — 헤드리스 검증 (#62 코드 합류 1: coordSetup — 코디네이터 zone-cluster 배선 단일 함수 패키지)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `coordsetup`.
//   더한 한 조각: cluster-run.js coordSetup(opts,deps) — verify 손배선(run→orch→Cluster→coord) 4단을 한 함수로. 미부착(verify 만 호출)→reg 0.
//   검증: ⒜ `reg`. ⒝ `coordsetup` — coordSetup 으로 구성한 coord.start() 후 placement==orch plan·coordDesync 0(배선이 0410 손배선과 동치).
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');
const { coordSetup } = require('./cluster-run.js');

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

// step-0411 #62 코드 합류 1 — coordsetup: cluster-run.coordSetup 으로 구성한 코디네이터를 run(6) 구동 후 placement==orch plan·maxDesync 0·coordDesync 0. 손배선(0410)과 동치 증명.
async function coordsetup(seeds) {
  console.log('== coordsetup (0411·#62 코드 합류 1): cluster-run.coordSetup(run→orch→Cluster→coord) 단일 함수 → run(6) 후 placement==orch plan·maxDesync 0·coordDesync 0. ==');
  console.log('seed   | views | placement==plan | maxDesync | coordDesync | 판정');
  for (const seed of seeds) {
    const { orch, cluster, coord } = await coordSetup({ seed, ticks: 12, ...coordScenario() }, { run, zoneSpecOf });
    let views = 0, planMatch = false, desync = -1, maxd = -1;
    try {
      views = await coord.run(6);
      const plan = orch.hostSpawnPlan();
      planMatch = plan.order.every(h => plan.hosts[h].zones.every(z => coord.placement[z] === h));
      maxd = coord.maxDesync;
      desync = await coord.coordDesync();
    } finally { await cluster.shutdown(); }
    const ok = check(planMatch && maxd === 0 && desync === 0, `seed ${seed}: coordSetup 배선 불일치 (planMatch ${planMatch}·maxDesync ${maxd}·desync ${desync})`);
    console.log(`${pad(seed, 6)} | ${pad(views, 5)} | ${pad(planMatch ? 'Y' : 'N', 15)} | ${pad(maxd, 9)} | ${pad(desync, 11)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['coordsetup'] = coordsetup;
kit.ORDER.splice(1, 0, 'coordsetup');

(async () => { process.exit(await kit.cli(process.argv)); })();
