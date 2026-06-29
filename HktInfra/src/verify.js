// HktInfra step-0405 — 헤드리스 검증 (#62 runMulti 합류 4·복원력: reprovisionStandby 따뜻한 대기)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `coordreprov`.
//   더한 한 조각: cluster-coord.js reprovisionStandby(zone,standbyHost)=snapshot→standby spawn/zoneadd/loadstate(따뜻한 사본)+mirrors 등록(runMulti rep+mirrors 판). 미호출이면 0404 동치. 새 박스·run() 미사용→reg 0.
//   검증: ⒜ `reg`. ⒝ `coordreprov` — 2 host·3 zone: run(5)→reprovisionStandby(z1, hostA_s) → standby z1 의 a1 == primary a1(따뜻한 사본)·mirrors=[{z1,hostA_s}]·reprovisions 1.
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

// step-0405 #62 runMulti 합류 4·복원력 — coordreprov: run(5)→reprovisionStandby(z1, hostA_s) → standby z1 의 a1 == primary a1(따뜻한 사본)·mirrors=[{z1,hostA_s}]·reprovisions 1.
async function coordreprov(seeds) {
  const BASE = coordScenario();
  console.log('== coordreprov (0405·#62 복원력): reprovisionStandby 따뜻한 대기 사본+미러. ==');
  console.log('seed   | primary a1 | standby a1 | warm | mirrors | reprov | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 12, ...BASE });
    const o = r.orch, drv = o.clusterDriver;
    const cluster = new Cluster([]);
    let pS = '-', sS = '-', warm = false, mir = 0, rp = -1;
    try {
      await cluster.spawn();
      const coord = makeClusterCoordinator(o, cluster, zoneSpecOf, drv);
      await coord.run(5);
      const primary = realPos(await cluster.rpc(coord.placedHost('z1'), { cmd: 'snapshot' }), 'z1', 'a1');
      await coord.reprovisionStandby('z1', 'hostA_s');                 // 따뜻한 대기 사본
      const standby = realPos(await cluster.rpc('hostA_s', { cmd: 'snapshot' }), 'z1', 'a1');
      pS = primary ? `{${primary.x},${primary.y}}` : 'null'; sS = standby ? `{${standby.x},${standby.y}}` : 'null';
      warm = !!primary && !!standby && primary.x === standby.x && primary.y === standby.y;
      mir = coord.mirrors.length; rp = coord.reprovisions;
    } finally { await cluster.shutdown(); }
    const ok = check(warm && mir === 1 && rp === 1, `seed ${seed}: 위반 (p ${pS}·s ${sS}·warm ${warm}·mir ${mir}·rp ${rp})`);
    console.log(`${pad(seed, 6)} | ${pad(pS, 10)} | ${pad(sS, 10)} | ${pad(warm ? 'Y' : 'N', 4)} | ${pad(mir, 7)} | ${pad(rp, 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['coordreprov'] = coordreprov;
kit.ORDER.splice(1, 0, 'coordreprov');

(async () => { process.exit(await kit.cli(process.argv)); })();
