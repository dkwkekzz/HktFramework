// HktInfra step-0383 — 헤드리스 검증 (#65 양방향 동기 3: migrate 가 placement 갱신·핵심 fix)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `coordmigsync`.
//   더한 한 조각: cluster-coord.js migrate 가 this.placement[zone]=to 갱신 → coordDesync 가 새 host 조회·migrate 후 desync 0. 새 박스·run() 미사용 → reg 0.
//   검증: ⒜ `reg`. ⒝ `coordmigsync` — 2 host·3 zone: run(3)+migrate z1 A→B → placedHost('z1')==hostB·coordDesync 0(정확) vs driver.clusterDesync>0(orch plan stale·#65 입증).
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

// step-0383 #65 양방향 3 — migrate 가 placement 갱신: run(3)+migrate z1 A→B → placedHost==hostB·coordDesync 0(정확)·driver.clusterDesync>0(orch stale·#65 입증).
async function coordmigsync(seeds) {
  const BASE = coordScenario();
  console.log('== coordmigsync (0383·#65 양방향 3): migrate→placement 갱신 — coordDesync 0(정확) vs clusterDesync>0(orch stale) ==');
  console.log('seed   | placedHost z1 | coordDesync | clusterDesync | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 12, ...BASE });
    const o = r.orch, drv = o.clusterDriver;
    const cluster = new Cluster([]);
    let ph = '', cd = -1, dd = -1;
    try {
      await cluster.spawn();
      const coord = makeClusterCoordinator(o, cluster, zoneSpecOf, drv);
      await coord.run(3);
      await coord.migrate('z1', 'hostA', 'hostB');
      ph = coord.placedHost('z1');
      cd = await coord.coordDesync();                                    // placement 갱신 → 정확(0)
      dd = await drv.clusterDesync(o, cluster);                          // orch plan stale(z1@A) → 발산(>0)
    } finally { await cluster.shutdown(); }
    const ok = check(ph === 'hostB' && cd === 0 && dd > 0, `seed ${seed}: migsync 위반 (ph ${ph}·cd ${cd}·dd ${dd})`);
    console.log(`${pad(seed, 6)} | ${pad(ph, 13)} | ${pad(cd, 11)} | ${pad(dd, 13)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['coordmigsync'] = coordmigsync;
kit.ORDER.splice(1, 0, 'coordmigsync');

(async () => { process.exit(await kit.cli(process.argv)); })();
