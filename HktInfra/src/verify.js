// HktInfra step-0420 — 헤드리스 검증 (#62 코드 합류 10·grand capstone: 단일 진입점이 종합 warm-failover 복원력 구동)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `coordmergecap`.
//   더한 한 조각: 검증만 — 단일 진입점(runMultiViaCoord·runMulti viaCoord 위임)이 migrate+reprovision+kill+promote 를 runMultiCoherent + clusterInfo parity 로 구동. 코드 무변경→reg 0. #62 코드 합류 sub-arc(0411~0420) 닫기.
//   검증: ⒜ `reg`/`e2e`(OFF 경로 보존) ⒝ `coordmergecap` — 종합 시나리오 후 runMultiCoherent Y·mig1·reprov1·promo1·a1 보존·clusterInfo parity 키 완비.
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

const RUNMULTI_KEYS = ['livePids', 'hostIds', 'placement', 'epoch', 'presumedDead', 'migrations', 'reprovisions', 'promotions', 'pids', 'parentPid', 'port', 'ipcMsgs', 'ipcBytes', 'allSerializable', 'wire'];

// step-0420 #62 코드 합류 10·grand capstone — coordmergecap: 단일 진입점이 종합 warm-failover(migrate+reprovision+kill+promote) 를 한 호출로 → runMultiCoherent Y·mig1·reprov1·promo1·a1 보존·clusterInfo parity. 0411~0420 닫기.
async function coordmergecap(seeds) {
  console.log('== coordmergecap (0420·#62 코드 합류 grand capstone): 단일 진입점 종합 warm-failover(migrate+reprovision+kill+promote) → runMultiCoherent Y·mig1·reprov1·promo1·a1 보존·parity. 0411~0420 닫기. ==');
  console.log('seed   | coherent | mig | reprov | promo | a1 보존 | parity | 판정');
  const spec = {
    migrate: { zone: 'z3', from: 'hostA', to: 'hostB', at: 2 },
    reprovision: { zone: 'z1', host: 'hostA_s', at: 3 },
    kill: { host: 'hostA', at: 4 }, promote: { zone: 'z1', at: 4 },
  };
  for (const seed of seeds) {
    const res = await runMultiViaCoord(
      { seed, ticks: 12, coordTicks: 6, coordSc: spec, ...coordScenario() },
      { run, zoneSpecOf },
      async (coord, cluster) => coordAuthEquiv(coord, cluster, [['z1', 'a1']]));
    const info = res.info, eq = res.probe;
    const preserved = eq.match === eq.total;
    const parity = RUNMULTI_KEYS.every(k => k in info);
    const ok = check(res.coherent && info.migrations === 1 && info.reprovisions === 1 && info.promotions === 1 && preserved && parity,
      `seed ${seed}: capstone 위반 (coherent ${res.coherent}·mig ${info.migrations}·reprov ${info.reprovisions}·promo ${info.promotions}·a1 ${eq.match}/${eq.total}·parity ${parity})`);
    console.log(`${pad(seed, 6)} | ${pad(res.coherent ? 'Y' : 'N', 8)} | ${pad(info.migrations, 3)} | ${pad(info.reprovisions, 6)} | ${pad(info.promotions, 5)} | ${pad(preserved ? 'Y' : 'N', 7)} | ${pad(parity ? 'Y' : 'N', 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['coordmergecap'] = coordmergecap;
kit.ORDER.splice(1, 0, 'coordmergecap');

(async () => { process.exit(await kit.cli(process.argv)); })();
