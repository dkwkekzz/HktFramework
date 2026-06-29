// HktInfra step-0403 — 헤드리스 검증 (#62 runMulti 합류 3·복원력: 상태 보존 restart)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `coordrestart`.
//   더한 한 조각: cluster-coord.js restart(zone,newHost)=pre-kill snapshot→kill→spawn→loadstate(runMulti invRestart 판·상태 보존). failover(상태 소실)와 대조. 미호출이면 0402 동치. 새 박스·run() 미사용→reg 0.
//   검증: ⒜ `reg`. ⒝ `coordrestart` — 2 host·3 zone: run(5)→restart(z1, hostA_r) → a1 위치 보존(pre==post)·placement[z1]=hostA_r·restarts 1·coordDesync 0.
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

// step-0403 #62 runMulti 합류 3·복원력 — coordrestart: run(5)→restart(z1, hostA_r) → a1 위치 보존(pre==post·snapshot before kill)·placement[z1]=hostA_r·restarts 1·coordDesync 0.
async function coordrestart(seeds) {
  const BASE = coordScenario();
  console.log('== coordrestart (0403·#62 복원력): 상태 보존 restart(zone,newHost). a1 무손실. ==');
  console.log('seed   | pre a1 | post a1 | placement[z1] | restarts | coordDesync | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 12, ...BASE });
    const o = r.orch, drv = o.clusterDriver;
    const cluster = new Cluster([]);
    let preS = '-', postS = '-', plc = '-', rs = -1, cd = -1, preserved = false;
    try {
      await cluster.spawn();
      const coord = makeClusterCoordinator(o, cluster, zoneSpecOf, drv);
      await coord.run(5);
      const pre = realPos(await cluster.rpc(coord.placedHost('z1'), { cmd: 'snapshot' }), 'z1', 'a1');
      await coord.restart('z1', 'hostA_r');                            // 계획적 재시작(상태 보존)
      const post = realPos(await cluster.rpc('hostA_r', { cmd: 'snapshot' }), 'z1', 'a1');
      preS = pre ? `{${pre.x},${pre.y}}` : 'null'; postS = post ? `{${post.x},${post.y}}` : 'null';
      preserved = !!pre && !!post && pre.x === post.x && pre.y === post.y;
      plc = coord.placedHost('z1'); rs = coord.restarts; cd = await coord.coordDesync();
    } finally { await cluster.shutdown(); }
    const ok = check(preserved && plc === 'hostA_r' && rs === 1 && cd === 0, `seed ${seed}: 위반 (pre ${preS}·post ${postS}·plc ${plc}·rs ${rs}·cd ${cd})`);
    console.log(`${pad(seed, 6)} | ${pad(preS, 6)} | ${pad(postS, 7)} | ${pad(plc, 13)} | ${pad(rs, 8)} | ${pad(cd, 11)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['coordrestart'] = coordrestart;
kit.ORDER.splice(1, 0, 'coordrestart');

(async () => { process.exit(await kit.cli(process.argv)); })();
