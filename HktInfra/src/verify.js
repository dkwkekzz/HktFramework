// HktInfra step-0419 — 헤드리스 검증 (#62 코드 합류 9: runMulti OFF-게이트 위임 — opts.viaCoord→runMultiViaCoord)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `coorddelegate`.
//   더한 한 조각: cluster-run.runMulti 가 opts.viaCoord 이면 runMultiViaCoord 로 위임(옛 runMulti 가 코디네이터를 호출). OFF→옛 경로 비트 동일→reg 0·e2e 보존.
//   검증: ⒜ `reg`(OFF 경로 비트 동일) ⒝ `e2e`(OFF 경로 멀티프로세스 보존) ⒞ `coorddelegate` — runMulti(viaCoord:true) → coord 결과 shape·runMultiCoherent Y·mig1·reprov1.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');
const { runMulti } = require('./cluster-run.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { run, fnv1a, buildTopology, Net } = NET;

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

// step-0419 #62 코드 합류 9 — coorddelegate: runMulti(opts.viaCoord:true, full deps) → 코디네이터 위임(coord 결과 shape·runMultiCoherent Y·mig1·reprov1). OFF 경로 비트 동일은 reg/e2e 가 단언.
async function coorddelegate(seeds) {
  console.log('== coorddelegate (0419·#62 코드 합류 9): runMulti(viaCoord:true) → runMultiViaCoord 위임(coord shape·runMultiCoherent Y·mig1·reprov1). OFF 경로 비트 동일=reg/e2e. ==');
  console.log('seed   | coord shape | coherent | mig | reprov | 판정');
  const spec = { migrate: { zone: 'z3', from: 'hostA', to: 'hostB', at: 2 }, reprovision: { zone: 'z1', host: 'hostA_s', at: 3 } };
  const deps = { buildTopology, Net, fnv1a, run, zoneSpecOf };
  for (const seed of seeds) {
    const res = await runMulti({ seed, ticks: 12, coordTicks: 6, coordSc: spec, viaCoord: true, ...coordScenario() }, deps);
    const coordShape = res && res.net === undefined && 'coherent' in res && !!res.info;   // 옛 runMulti shape(.net/.cluster)와 구별
    const ok = check(coordShape && res.coherent && res.info.migrations === 1 && res.info.reprovisions === 1,
      `seed ${seed}: 위임 위반 (coordShape ${coordShape}·coherent ${res && res.coherent}·mig ${res && res.info && res.info.migrations}·reprov ${res && res.info && res.info.reprovisions})`);
    console.log(`${pad(seed, 6)} | ${pad(coordShape ? 'Y' : 'N', 11)} | ${pad(res.coherent ? 'Y' : 'N', 8)} | ${pad(res.info.migrations, 3)} | ${pad(res.info.reprovisions, 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['coorddelegate'] = coorddelegate;
kit.ORDER.splice(1, 0, 'coorddelegate');

(async () => { process.exit(await kit.cli(process.argv)); })();
