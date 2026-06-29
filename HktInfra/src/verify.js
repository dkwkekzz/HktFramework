// HktInfra step-0395 — 헤드리스 검증 (#67 orch 이중 권위 합류 2: authoritiesAgree() 술어·migrate 후 발산 노출)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `coordauthsplit`.
//   더한 한 조각: cluster-coord.js authoritiesAgree()=placement==orchWhere. write-back 전이라 migrate 후 orch stale → 발산 노출(#67). 새 메서드·읽기 전용. 새 박스·run() 미사용 → reg 0.
//   검증: ⒜ `reg`. ⒝ `coordauthsplit` — 2 host·3 zone: run(5) 후 authoritiesAgree Y(일치) → migrate z1 A→B 후 authoritiesAgree N(orch stale·이중 권위 노출)·단 coordDesync 0(코디네이터 placement 는 정확).
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

// step-0395 #67 orch 이중 권위 합류 2 — coordauthsplit: run(5) 후 authoritiesAgree Y → migrate z1 A→B 후 authoritiesAgree N(write-back 전·orch stale·이중 권위 노출)·coordDesync 0(코디네이터 placement 는 정확).
async function coordauthsplit(seeds) {
  const BASE = coordScenario();
  console.log('== coordauthsplit (0395·#67): authoritiesAgree() — migrate 후 두 권위 발산 노출(write-back 전). ==');
  console.log('seed   | agree(전) | agree(migrate 후) | coordDesync | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 12, ...BASE });
    const o = r.orch, drv = o.clusterDriver;
    const cluster = new Cluster([]);
    let before = false, after = true, cd = -1;
    try {
      await cluster.spawn();
      const coord = makeClusterCoordinator(o, cluster, zoneSpecOf, drv);
      await coord.run(5);
      before = coord.authoritiesAgree();                                // 정상 경로 — 일치
      await coord.migrate('z1', 'hostA', 'hostB');                       // write-back 없음 → orch stale
      after = coord.authoritiesAgree();                                  // 발산 노출(#67)
      cd = await coord.coordDesync();                                    // 코디네이터 placement 권위는 정확
    } finally { await cluster.shutdown(); }
    const ok = check(before && !after && cd === 0, `seed ${seed}: 위반 (before ${before}·after ${after}·cd ${cd})`);
    console.log(`${pad(seed, 6)} | ${pad(before ? 'Y' : 'N', 9)} | ${pad(after ? 'Y' : 'N', 17)} | ${pad(cd, 11)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['coordauthsplit'] = coordauthsplit;
kit.ORDER.splice(1, 0, 'coordauthsplit');

(async () => { process.exit(await kit.cli(process.argv)); })();
