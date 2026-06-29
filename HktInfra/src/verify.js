// HktInfra step-0399 — 헤드리스 검증 (#66+#67 통합 정합 술어: unifiedCoherent())
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `coordunified`.
//   더한 한 조각: cluster-coord.js unifiedCoherent()=syncedCoherent && authoritiesAgree. orch.running stale 주입 시 N(실측 검출). 새 메서드·읽기 전용·reg 0.
//   검증: ⒜ `reg`. ⒝ `coordunified` — 2 host·3 zone: run(5)+migrate+failover → unifiedCoherent **Y**·대조로 orch.running 에 stale host 주입 시 **N**(by-construction 아님).
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

// step-0399 #66+#67 통합 정합 술어 — coordunified: run(5)+migrate+failover → unifiedCoherent Y·대조로 orch.running 에 stale host 주입 시 N(실측 검출·by-construction 아님).
async function coordunified(seeds) {
  const BASE = coordScenario();
  console.log('== coordunified (0399·#66+#67): unifiedCoherent = syncedCoherent && authoritiesAgree. ==');
  console.log('seed   | unified | inject 후(stale) | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 12, ...BASE });
    const o = r.orch, drv = o.clusterDriver;
    const cluster = new Cluster([]);
    let uni = false, injected = true;
    try {
      await cluster.spawn();
      const coord = makeClusterCoordinator(o, cluster, zoneSpecOf, drv);
      await coord.run(5);
      await coord.migrate('z1', 'hostA', 'hostB');
      await coord.failover('hostA', 'hostB');
      uni = await coord.unifiedCoherent();                              // Y — #65/#66/#67 모두 한 몸
      o.running.set('z2', 'hostGHOST');                                 // 대조: orch where-view 에 stale host 주입
      injected = await coord.unifiedCoherent();                        // N — authoritiesAgree 가 실측 검출
    } finally { await cluster.shutdown(); }
    const ok = check(uni && !injected, `seed ${seed}: 위반 (uni ${uni}·injected ${injected})`);
    console.log(`${pad(seed, 6)} | ${pad(uni ? 'Y' : 'N', 7)} | ${pad(injected ? 'Y' : 'N', 16)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['coordunified'] = coordunified;
kit.ORDER.splice(1, 0, 'coordunified');

(async () => { process.exit(await kit.cli(process.argv)); })();
