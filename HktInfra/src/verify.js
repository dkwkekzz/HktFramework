// HktInfra step-0409 — 헤드리스 검증 (#62 runMulti 합류 8·복원력 payoff: promoteStandby 상태 보존 failover)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `coordpromote`.
//   더한 한 조각: cluster-coord.js promoteStandby(zone)=따뜻한 standby 를 primary 로 승격(placement→standby host·미러 해제). primary host 사망 시 상태 손실 0(0376 빈 재가동·#63 과 대조). 미호출이면 0408 동치. 새 박스·run() 미사용→reg 0.
//   검증: ⒜ `reg`. ⒝ `coordpromote` — 2 host·3 zone: run(5)+migrate(z3 A→B·hostA 비움)+reprovisionStandby(z1,hostA_s)+killHost(hostA)+promoteStandby(z1) → a1 보존(pre==post)·placement[z1]=hostA_s·unifiedCoherent Y·promotions 1.
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

// step-0409 #62 runMulti 합류 8·복원력 payoff — coordpromote: run(5)+migrate(z3 A→B)+reprovisionStandby(z1,hostA_s)+killHost(hostA)+promoteStandby(z1) → a1 보존(pre==post·상태 손실 0)·placement[z1]=hostA_s·unifiedCoherent Y·promotions 1.
async function coordpromote(seeds) {
  const BASE = coordScenario();
  console.log('== coordpromote (0409·#62 payoff): 따뜻한 standby 승격 — 상태 보존 failover. ==');
  console.log('seed   | pre a1 | post a1 | placement[z1] | unified | promotions | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 12, ...BASE });
    const o = r.orch, drv = o.clusterDriver;
    const cluster = new Cluster([]);
    let preS = '-', postS = '-', plc = '-', uni = false, pr = -1, preserved = false;
    try {
      await cluster.spawn();
      const coord = makeClusterCoordinator(o, cluster, zoneSpecOf, drv);
      await coord.run(5);
      await coord.migrate('z3', 'hostA', 'hostB');                      // hostA 를 z1 단독으로(co-located stranding 회피)
      await coord.reprovisionStandby('z1', 'hostA_s');                  // 따뜻한 standby(동기)
      const pre = realPos(await cluster.rpc('hostA_s', { cmd: 'snapshot' }), 'z1', 'a1');
      await cluster.killHost('hostA');                                  // primary host 사망(z1 RAM 소실)
      await coord.promoteStandby('z1');                                 // 따뜻한 standby 승격(상태 보존)
      const post = realPos(await cluster.rpc('hostA_s', { cmd: 'snapshot' }), 'z1', 'a1');
      preS = pre ? `{${pre.x},${pre.y}}` : 'null'; postS = post ? `{${post.x},${post.y}}` : 'null';
      preserved = !!pre && !!post && pre.x === post.x && pre.y === post.y;
      plc = coord.placedHost('z1'); uni = await coord.unifiedCoherent(); pr = coord.promotions;
    } finally { await cluster.shutdown(); }
    const ok = check(preserved && plc === 'hostA_s' && uni && pr === 1, `seed ${seed}: 위반 (pre ${preS}·post ${postS}·plc ${plc}·uni ${uni}·pr ${pr})`);
    console.log(`${pad(seed, 6)} | ${pad(preS, 6)} | ${pad(postS, 7)} | ${pad(plc, 13)} | ${pad(uni ? 'Y' : 'N', 7)} | ${pad(pr, 10)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['coordpromote'] = coordpromote;
kit.ORDER.splice(1, 0, 'coordpromote');

(async () => { process.exit(await kit.cli(process.argv)); })();
