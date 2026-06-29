// HktInfra step-0400 — 헤드리스 검증 (#66+#67 grand capstone: 루프 중 migrate+failover 후 unifiedCoherent)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `coordunifiedcap`.
//   더한 한 조각: 새 코드 0 — 0399 unifiedCoherent 를 *가장 어려운* 시나리오(run 루프 *중* migrate + 루프 *중* failover)에 적용해 #66(tick placement-aware)+#67(orch 이중 권위 합류) 종합. #66/#67 sub-arc(0391~0400) 닫기. 박스 무변경 → reg 0(자명).
//   검증: ⒜ `reg`. ⒝ `coordunifiedcap` — 2 host·3 zone: run(5, t=2 migrate z1 A→B·t=3 failover hostA→hostB) → unifiedCoherent **Y**(maxDesync0·authoritiesAgree)·대조 driver.clusterDesync>0(옛 orch plan stale)·report coherent&&authoritiesAgree.
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

// step-0400 #66+#67 grand capstone — coordunifiedcap: run(5, 루프 *중* t=2 migrate z1 A→B·t=3 failover hostA→hostB) → unifiedCoherent Y(maxDesync0·authoritiesAgree)·대조 driver.clusterDesync>0(옛 orch plan stale)·report coherent&&authoritiesAgree. #66/#67 sub-arc(0391~0400) 닫기.
async function coordunifiedcap(seeds) {
  const BASE = coordScenario();
  console.log('== coordunifiedcap (0400·#66+#67 grand capstone): 루프 중 migrate+failover 후 unifiedCoherent. 0391~0400 닫기. ==');
  console.log('seed   | unified | maxDesync | clusterDesync(옛) | rpt.coh&&agree | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 12, ...BASE });
    const o = r.orch, drv = o.clusterDriver;
    const cluster = new Cluster([]);
    let uni = false, md = -1, dd = -1, rok = false;
    try {
      await cluster.spawn();
      const coord = makeClusterCoordinator(o, cluster, zoneSpecOf, drv);
      await coord.run(5, async (t, c) => {                              // 루프 *중* lifecycle — #66 발현(placement-aware tick 추종)
        if (t === 2) await c.migrate('z1', 'hostA', 'hostB');
        if (t === 3) await c.failover('hostA', 'hostB');
      });
      uni = await coord.unifiedCoherent();                             // #65/#66/#67 모두 한 몸
      md = coord.maxDesync;
      dd = await drv.clusterDesync(o, cluster);                         // 옛 경로(orch plan stale) → 발산
      const rpt = await coord.report();
      rok = rpt.coherent === true && rpt.authoritiesAgree === true;
    } finally { await cluster.shutdown(); }
    const ok = check(uni && md === 0 && dd > 0 && rok, `seed ${seed}: capstone 위반 (uni ${uni}·md ${md}·dd ${dd}·rok ${rok})`);
    console.log(`${pad(seed, 6)} | ${pad(uni ? 'Y' : 'N', 7)} | ${pad(md, 9)} | ${pad(dd, 17)} | ${pad(rok ? 'Y' : 'N', 14)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['coordunifiedcap'] = coordunifiedcap;
kit.ORDER.splice(1, 0, 'coordunifiedcap');

(async () => { process.exit(await kit.cli(process.argv)); })();
