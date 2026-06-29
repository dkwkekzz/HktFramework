// HktInfra step-0386 — 헤드리스 검증 (#65 양방향 동기 6: coordDesync 가 lost 의 기대된 부재 제외)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `coordfocoh`.
//   더한 한 조각: cluster-coord.js coordDesync 가 lostZones 의 reverse 부재(권위에 있는데 실에 부재)를 제외(forward ghost 검사는 유지). 새 박스·run() 미사용 → reg 0.
//   검증: ⒜ `reg`. ⒝ `coordfocoh` — 2 host·3 zone: run(3)+failover hostA→hostB → coordDesync 0(lost 제외)·lost 존 ghost 주입 시 desync 1(forward 유지).
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

// step-0386 #65 양방향 6 — coordDesync 가 lost 기대 부재 제외: run(3)+failover → coordDesync 0(lost 제외)·lost 존 ghost 주입 시 desync 1(forward 유지).
async function coordfocoh(seeds) {
  const BASE = coordScenario();
  console.log('== coordfocoh (0386·#65 양방향 6): coordDesync 가 lost 기대 부재 제외 — failover 후 0·ghost 검출 유지 ==');
  console.log('seed   | failover desync | ghost desync | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 12, ...BASE });
    const o = r.orch, drv = o.clusterDriver;
    const cluster = new Cluster([]);
    let foD = -1, ghostD = 0;
    try {
      await cluster.spawn();
      const coord = makeClusterCoordinator(o, cluster, zoneSpecOf, drv);
      await coord.run(3);
      await coord.failover('hostA', 'hostB');
      foD = await coord.coordDesync();                                   // lost(z1·z3) reverse 제외 → 0
      // lost 존(z1)에 ghost 주입 → forward(실에 있는데 권위 부재) 는 여전히 검출
      await cluster.rpc('hostB', { cmd: 'deliver', items: [{ gi: 0, m: { to: 'z1', from: 'ghost', payload: { type: 'enter', avatar: 'ghostX', sessionId: 'gs' } } }] });
      ghostD = await coord.coordDesync();
    } finally { await cluster.shutdown(); }
    const ok = check(foD === 0 && ghostD > 0, `seed ${seed}: focoh 위반 (foD ${foD}·ghost ${ghostD})`);
    console.log(`${pad(seed, 6)} | ${pad(foD, 15)} | ${pad(ghostD, 12)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['coordfocoh'] = coordfocoh;
kit.ORDER.splice(1, 0, 'coordfocoh');

(async () => { process.exit(await kit.cli(process.argv)); })();
