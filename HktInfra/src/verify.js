// HktInfra step-0410 — 헤드리스 검증 (#62 runMulti 합류 9·grand capstone: runMultiCoherent 종합 복원력)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `coordmulticap`.
//   더한 한 조각: cluster-coord.js runMultiCoherent()=unifiedCoherent && 미러 standby 실재. 종합 복원력 시나리오 뒤 #62 능력 합류 완성. 0401~0410 닫기. 새 박스·run() 미사용→reg 0.
//   검증: ⒜ `reg`. ⒝ `coordmulticap` — 2 host·3 zone: runScenario(6,{migrate z3 A→B@2·reprovision z1@hostA_s@3})+killHost(hostA)+promoteStandby(z1) → runMultiCoherent Y·a1 보존·migrations 1·reprovisions 1·promotions 1.
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

// step-0410 #62 runMulti 합류 9·grand capstone — coordmulticap: runScenario(6,{migrate z3 A→B@2·reprovision z1@hostA_s@3})+killHost(hostA)+promoteStandby(z1) → runMultiCoherent Y·a1 보존·migrations 1·reprovisions 1·promotions 1. #62 복원력 sub-arc(0401~0410) 닫기.
async function coordmulticap(seeds) {
  const BASE = coordScenario();
  console.log('== coordmulticap (0410·#62 grand capstone): 종합 복원력 시나리오 후 runMultiCoherent. 0401~0410 닫기. ==');
  console.log('seed   | runMultiCoherent | a1 보존 | mig | reprov | promo | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 12, ...BASE });
    const o = r.orch, drv = o.clusterDriver;
    const cluster = new Cluster([]);
    let rmc = false, preserved = false, info = {};
    try {
      await cluster.spawn();
      const coord = makeClusterCoordinator(o, cluster, zoneSpecOf, drv);
      await coord.runScenario(6, { migrate: { zone: 'z3', from: 'hostA', to: 'hostB', at: 2 }, reprovision: { zone: 'z1', host: 'hostA_s', at: 3 } });
      const pre = realPos(await cluster.rpc('hostA_s', { cmd: 'snapshot' }), 'z1', 'a1');   // 따뜻한 standby 의 a1
      await cluster.killHost('hostA');                                  // primary 사망
      await coord.promoteStandby('z1');                                 // 따뜻한 failover
      const post = realPos(await cluster.rpc('hostA_s', { cmd: 'snapshot' }), 'z1', 'a1');
      preserved = !!pre && !!post && pre.x === post.x && pre.y === post.y;
      rmc = await coord.runMultiCoherent(); info = coord.clusterInfo();
    } finally { await cluster.shutdown(); }
    const ok = check(rmc && preserved && info.migrations === 1 && info.reprovisions === 1 && info.promotions === 1,
      `seed ${seed}: capstone 위반 (rmc ${rmc}·preserved ${preserved}·${JSON.stringify({ mg: info.migrations, rp: info.reprovisions, pr: info.promotions })})`);
    console.log(`${pad(seed, 6)} | ${pad(rmc ? 'Y' : 'N', 16)} | ${pad(preserved ? 'Y' : 'N', 7)} | ${pad(info.migrations, 3)} | ${pad(info.reprovisions, 6)} | ${pad(info.promotions, 5)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['coordmulticap'] = coordmulticap;
kit.ORDER.splice(1, 0, 'coordmulticap');

(async () => { process.exit(await kit.cli(process.argv)); })();
