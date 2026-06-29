// HktInfra step-0392 — 헤드리스 검증 (#66 tick placement-aware 2: deliver 재생도 placement 권위로 host 조회)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `coorddeliverplace`.
//   더한 한 조각: cluster-coord.js tick() 의 deliver 재생이 c.host 대신 placement[c.zoneId] 로 현 host 조회. 정상 경로(placement==c.host)=0391 동치. 새 박스·run() 미사용 → reg 0.
//   검증: ⒜ `reg`. ⒝ `coorddeliverplace` — 2 host·3 zone: run(5) 후 a1 이 placement[z1] host 에 적용(deliver 가 placement host 로)·coordDesync 0.
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

// step-0392 #66 tick placement-aware 2 — coorddeliverplace: run(5) 의 deliver 재생이 placement[zoneId] host 로 → a1 이 placement[z1] host 에 적용·coordDesync 0(deliver 가 옳은 host 로).
async function coorddeliverplace(seeds) {
  const BASE = coordScenario();
  console.log('== coorddeliverplace (0392·#66): deliver 재생도 placement 권위 host. run(5) 후 a1@placement[z1]. ==');
  console.log('seed   | a1@place(z1) | a1 pos | coordDesync | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 12, ...BASE });
    const o = r.orch, drv = o.clusterDriver;
    const cluster = new Cluster([]);
    let landed = false, cd = -1, posStr = '-';
    try {
      await cluster.spawn();
      const coord = makeClusterCoordinator(o, cluster, zoneSpecOf, drv);
      await coord.run(5);                                                // deliver 재생이 placement[z1] host 로(0392)
      const host = coord.placedHost('z1');
      const snap = await cluster.rpc(host, { cmd: 'snapshot' });
      const pos = realPos(snap, 'z1', 'a1');                             // a1 이 placement host 에 적용됐나
      landed = !!pos; posStr = pos ? `{${pos.x},${pos.y}}` : 'null';
      cd = await coord.coordDesync();
    } finally { await cluster.shutdown(); }
    const ok = check(landed && cd === 0, `seed ${seed}: 위반 (landed ${landed}·pos ${posStr}·cd ${cd})`);
    console.log(`${pad(seed, 6)} | ${pad(landed ? 'Y' : 'N', 12)} | ${pad(posStr, 6)} | ${pad(cd, 11)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['coorddeliverplace'] = coorddeliverplace;
kit.ORDER.splice(1, 0, 'coorddeliverplace');

(async () => { process.exit(await kit.cli(process.argv)); })();
