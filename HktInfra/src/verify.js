// HktInfra step-0389 — 헤드리스 검증 (#65 양방향 동기 9: placementCoherent bijection 불변)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `coordplacecoh`.
//   더한 한 조각: cluster-coord.js placementCoherent()=placement ⟷ 실 cluster 존 배치 양방향 bijection. 새 박스·run() 미사용 → reg 0.
//   검증: ⒜ `reg`. ⒝ `coordplacecoh` — 2 host·3 zone: run(3)+migrate z1 A→B → placementCoherent Y(일치)·실 불일치(placement 미갱신 zonedel) 주입 시 N.
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

// step-0389 #65 양방향 9 — placementCoherent bijection: migrate 후 placement⟷실 일치(Y)·placement 미갱신 zonedel 주입 시 불일치(N).
async function coordplacecoh(seeds) {
  const BASE = coordScenario();
  console.log('== coordplacecoh (0389·#65 양방향 9): placementCoherent bijection — migrate 후 일치 Y·실 불일치 주입 N ==');
  console.log('seed   | migrate 후 coh | 불일치 주입 후 | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 12, ...BASE });
    const o = r.orch, drv = o.clusterDriver;
    const cluster = new Cluster([]);
    let cohOk = false, mismatchN = false;
    try {
      await cluster.spawn();
      const coord = makeClusterCoordinator(o, cluster, zoneSpecOf, drv);
      await coord.run(3);
      await coord.migrate('z1', 'hostA', 'hostB');
      cohOk = await coord.placementCoherent();                           // placement(z1@B) ⟷ 실 일치
      await cluster.rpc('hostB', { cmd: 'zonedel', addr: 'z1' });        // placement 미갱신 채 실에서 z1 제거 → 불일치
      mismatchN = !(await coord.placementCoherent());                    // forward 위반 검출(placement z1@B 인데 실 hostB 에 없음)
    } finally { await cluster.shutdown(); }
    const ok = check(cohOk && mismatchN, `seed ${seed}: placecoh 위반 (coh ${cohOk}·mismatch ${mismatchN})`);
    console.log(`${pad(seed, 6)} | ${pad(cohOk ? 'Y' : 'N', 13)} | ${pad(mismatchN ? 'N(검출)' : '미검출', 13)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['coordplacecoh'] = coordplacecoh;
kit.ORDER.splice(1, 0, 'coordplacecoh');

(async () => { process.exit(await kit.cli(process.argv)); })();
