// HktInfra step-0412 — 헤드리스 검증 (#62 코드 합류 2: coordScenarioFromOpts — runMulti 열화 스펙→코디네이터 시나리오 번역기)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `coordscenfromopts`.
//   더한 한 조각: cluster-run.js coordScenarioFromOpts(opts) — opts.coordSc(migrate/reprovision)→runScenario 시나리오 객체. 순수·미부착→reg 0.
//   검증: ⒜ `reg`. ⒝ `coordscenfromopts` — 순수 번역 일치 + coordSetup→runScenario(번역결과) 후 unifiedCoherent Y·migrations 1·reprovisions 1.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');
const { coordSetup, coordScenarioFromOpts } = require('./cluster-run.js');

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

// step-0412 #62 코드 합류 2 — coordscenfromopts: opts.coordSc(migrate/reprovision)→runScenario 시나리오 순수 번역 일치 + 구동 후 unifiedCoherent·계측.
async function coordscenfromopts(seeds) {
  console.log('== coordscenfromopts (0412·#62 코드 합류 2): coordScenarioFromOpts(migrate/reprovision) 순수 번역 + coordSetup→runScenario 후 unifiedCoherent Y·mig1·reprov1. ==');
  const spec = { migrate: { zone: 'z3', from: 'hostA', to: 'hostB', at: 2 }, reprovision: { zone: 'z1', host: 'hostA_s', at: 3 } };
  const tr = coordScenarioFromOpts({ coordSc: spec });
  const pure = JSON.stringify(tr) === JSON.stringify({ migrate: spec.migrate, reprovision: spec.reprovision });
  console.log(`  순수 번역 일치: ${pure ? 'Y' : 'N'}  (${JSON.stringify(tr)})`);
  console.log('seed   | unifiedCoherent | mig | reprov | 판정');
  for (const seed of seeds) {
    const { cluster, coord } = await coordSetup({ seed, ticks: 12, ...coordScenario() }, { run, zoneSpecOf });
    let uni = false, info = {};
    try {
      await coord.runScenario(6, coordScenarioFromOpts({ coordSc: spec }));
      uni = await coord.unifiedCoherent(); info = coord.clusterInfo();
    } finally { await cluster.shutdown(); }
    const ok = check(pure && uni && info.migrations === 1 && info.reprovisions === 1, `seed ${seed}: 번역/구동 위반 (pure ${pure}·uni ${uni}·mig ${info.migrations}·reprov ${info.reprovisions})`);
    console.log(`${pad(seed, 6)} | ${pad(uni ? 'Y' : 'N', 15)} | ${pad(info.migrations, 3)} | ${pad(info.reprovisions, 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['coordscenfromopts'] = coordscenfromopts;
kit.ORDER.splice(1, 0, 'coordscenfromopts');

(async () => { process.exit(await kit.cli(process.argv)); })();
