// HktInfra step-0416 — 헤드리스 검증 (#62 코드 합류 6: warm failover — kill+promote 시나리오 번역·구동)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `coorddelegpromote`.
//   더한 한 조각: coordScenarioFromOpts kill·promote case + coord runScenario promote 처리(kill 과 같은 at·원자). 미부착→reg 0.
//   검증: ⒜ `reg`. ⒝ `coorddelegpromote` — migrate z3+reprovision z1@hostA_s+kill hostA+promote z1(@동일 tick) → coherent Y·promotions 1·a1 보존(상태 손실 0).
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');
const { runMultiViaCoord, coordAuthEquiv } = require('./cluster-run.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { run, fnv1a } = NET;

const zoneSpecOf = (zone) => ({ addr: zone, kind: 'zone', seed: fnv1a(String(zone)) >>> 0, opts: { grid: 16, radius: 4, region: { lo: 0, hi: 16 }, sibling: null, boundary: 16, orch: null, incremental: true } });

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

// step-0416 #62 코드 합류 6 — coorddelegpromote: 따뜻한 failover 시나리오(migrate z3 off hostA·reprovision z1 standby·kill hostA·promote z1 동일 tick) → coherent Y·promotions 1·a1 보존.
async function coorddelegpromote(seeds) {
  console.log('== coorddelegpromote (0416·#62 코드 합류 6): warm failover 번역·구동 — migrate z3+reprovision z1@hostA_s+kill hostA+promote z1(동일 tick) → coherent Y·promo1·a1 보존. ==');
  console.log('seed   | coherent | promo | a1==권위 | placement[z1] | 판정');
  const spec = { migrate: { zone: 'z3', from: 'hostA', to: 'hostB', at: 2 }, reprovision: { zone: 'z1', host: 'hostA_s', at: 3 }, kill: { host: 'hostA', at: 4 }, promote: { zone: 'z1', at: 4 } };
  for (const seed of seeds) {
    const res = await runMultiViaCoord(
      { seed, ticks: 12, coordTicks: 6, coordSc: spec, ...coordScenario() },
      { run, zoneSpecOf },
      async (coord, cluster) => ({ eq: await coordAuthEquiv(coord, cluster, [['z1', 'a1']]), z1: coord.placement['z1'] }));
    const info = res.info, eq = res.probe.eq;
    const ok = check(res.coherent && info.promotions === 1 && eq.match === eq.total && res.probe.z1 === 'hostA_s',
      `seed ${seed}: warm failover 위반 (coherent ${res.coherent}·promo ${info.promotions}·a1 ${eq.match}/${eq.total}·z1@${res.probe.z1})`);
    console.log(`${pad(seed, 6)} | ${pad(res.coherent ? 'Y' : 'N', 8)} | ${pad(info.promotions, 5)} | ${pad(eq.match + '/' + eq.total, 8)} | ${pad(res.probe.z1, 13)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['coorddelegpromote'] = coorddelegpromote;
kit.ORDER.splice(1, 0, 'coorddelegpromote');

(async () => { process.exit(await kit.cli(process.argv)); })();
