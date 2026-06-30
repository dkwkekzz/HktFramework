// HktInfra step-0417 — 헤드리스 검증 (#62 코드 합류 7: fence/sweepSilence — epoch 펜싱 시나리오 번역·구동)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `coorddelegfence`.
//   더한 한 조각: coordScenarioFromOpts fence·sweepSilence case(runScenario 가 이미 처리). 미부착→reg 0.
//   검증: ⒜ `reg`. ⒝ `coorddelegfence` — 순수 번역 일치 + fence hostB 시나리오 구동 후 epoch 1·presumedDead⊇{hostB}·fencedTicks>0(z2 펜싱·stale 발신 차단).
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');
const { runMultiViaCoord, coordScenarioFromOpts } = require('./cluster-run.js');

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

// step-0417 #62 코드 합류 7 — coorddelegfence: fence/sweepSilence 순수 번역 + fence hostB 구동 후 epoch 1·presumedDead⊇{hostB}·fencedTicks>0.
async function coorddelegfence(seeds) {
  console.log('== coorddelegfence (0417·#62 코드 합류 7): fence/sweepSilence 번역·구동 — fence hostB → epoch1·presumedDead⊇{hostB}·fencedTicks>0(z2 펜싱). ==');
  const spec = { fence: { host: 'hostB', at: 3 }, sweepSilence: true };
  const tr = coordScenarioFromOpts({ coordSc: spec });
  const pure = JSON.stringify(tr) === JSON.stringify({ fence: { host: 'hostB', at: 3 }, sweepSilence: true });
  console.log(`  순수 번역 일치: ${pure ? 'Y' : 'N'}  (${JSON.stringify(tr)})`);
  console.log('seed   | epoch | presumedDead⊇hostB | fencedTicks | 판정');
  for (const seed of seeds) {
    const res = await runMultiViaCoord(
      { seed, ticks: 12, coordTicks: 6, coordSc: spec, ...coordScenario() },
      { run, zoneSpecOf },
      async (coord) => ({ epoch: coord.epoch, pd: [...coord.presumedDead], fenced: coord.fencedTicks }));
    const p = res.probe;
    const hasB = p.pd.includes('hostB');
    const ok = check(pure && p.epoch === 1 && hasB && p.fenced > 0,
      `seed ${seed}: fence 위반 (pure ${pure}·epoch ${p.epoch}·pd ${JSON.stringify(p.pd)}·fenced ${p.fenced})`);
    console.log(`${pad(seed, 6)} | ${pad(p.epoch, 5)} | ${pad(hasB ? 'Y' : 'N', 18)} | ${pad(p.fenced, 11)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['coorddelegfence'] = coorddelegfence;
kit.ORDER.splice(1, 0, 'coorddelegfence');

(async () => { process.exit(await kit.cli(process.argv)); })();
