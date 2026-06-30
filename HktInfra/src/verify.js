// HktInfra step-0413 — 헤드리스 검증 (#62 코드 합류 3: runMultiViaCoord — 코디네이터 단일 진입점 한 호출 구동)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `runviacoord`.
//   더한 한 조각: cluster-run.js runMultiViaCoord(opts,deps,probe) — coordSetup+coordScenarioFromOpts+runScenario 를 묶은 단일 진입점. 미부착→reg 0.
//   검증: ⒜ `reg`. ⒝ `runviacoord` — migrate+reprovision 시나리오 한 호출 → coherent(runMultiCoherent) Y·mig1·reprov1·probe(따뜻한 standby a1 실재).
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');
const { runMultiViaCoord } = require('./cluster-run.js');

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

// step-0413 #62 코드 합류 3 — runviacoord: runMultiViaCoord 한 호출(migrate+reprovision) → coherent(runMultiCoherent) Y·mig1·reprov1·probe(따뜻한 standby a1 실재).
async function runviacoord(seeds) {
  console.log('== runviacoord (0413·#62 코드 합류 3): runMultiViaCoord 단일 진입점 한 호출(migrate+reprovision) → runMultiCoherent Y·mig1·reprov1·probe standby a1. ==');
  console.log('seed   | coherent | desync | mig | reprov | standby a1 | 판정');
  const spec = { migrate: { zone: 'z3', from: 'hostA', to: 'hostB', at: 2 }, reprovision: { zone: 'z1', host: 'hostA_s', at: 3 } };
  for (const seed of seeds) {
    const res = await runMultiViaCoord(
      { seed, ticks: 12, coordTicks: 6, coordSc: spec, ...coordScenario() },
      { run, zoneSpecOf },
      async (coord, cluster) => realPos(await cluster.rpc('hostA_s', { cmd: 'snapshot' }), 'z1', 'a1'));
    const info = res.info;
    const ok = check(res.coherent && res.desync === 0 && info.migrations === 1 && info.reprovisions === 1 && !!res.probe,
      `seed ${seed}: runMultiViaCoord 위반 (coherent ${res.coherent}·desync ${res.desync}·mig ${info.migrations}·reprov ${info.reprovisions}·a1 ${JSON.stringify(res.probe)})`);
    console.log(`${pad(seed, 6)} | ${pad(res.coherent ? 'Y' : 'N', 8)} | ${pad(res.desync, 6)} | ${pad(info.migrations, 3)} | ${pad(info.reprovisions, 6)} | ${pad(res.probe ? `{${res.probe.x},${res.probe.y}}` : 'N', 10)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['runviacoord'] = runviacoord;
kit.ORDER.splice(1, 0, 'runviacoord');

(async () => { process.exit(await kit.cli(process.argv)); })();
