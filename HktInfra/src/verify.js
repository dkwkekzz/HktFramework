// HktInfra step-0277 — 헤드리스 검증 (#51b 실 zone.js 브리지 6: _rebalance 실 핸들 균형)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `zonerebalance`.
//   더한 한 조각: `zoneRuntimeHosts()` 질의(실 런타임 가동 host 집합). _rebalance 는 매 move 마다 _migrate→_bridgeMigrate(0273)로 실 핸들도 함께 이주하므로, 자동 부하 재배치가 실 EntityZone 핸들을 host 에 고르게 분산함을 단언. OFF→0276 비트 동일(reg).
//   검증: ⒜ `reg`(키트·OFF 비트 동일). ⒝ `zonerebalance`(가설) — 3존 hostA 몰림 후 rebalance→실 런타임 1/1/1 분산(runtimeOn 각 1·zoneRuntimeHosts 3)·drift 0·재생성 0(zoneStarts 3 불변).
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad, worldDigest } = kit.helpers;
const { run } = NET;

// step-0272 #51b 실 zone.js 브리지 1 검증 — zoneBridge ON 이면 placeZone 집행(_start)이 실 EntityZone 인스턴스를
//   host 에 띄워 zoneRuntimes 에 등록한다. running(zoneId→host 문자열) 추상과 실 zone.js 런타임이 일치(실물 정합):
//   z1→hostA·z2→hostB 두 실 EntityZone 핸들·runtimeCount==2·zoneStarts==2·멱등 재배치(같은 host 재-place)는 신규 인스턴스 0.
function zonerebalance(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const REBAL = (at, hosts) => ({ at, op: { type: 'placeRebalance', hosts } });
  const OPS = [PLACE(1, 'z1', 'hostA'), PLACE(2, 'z2', 'hostA'), PLACE(3, 'z3', 'hostA'), REBAL(4, ['hostA', 'hostB', 'hostC'])];   // 3존 A 몰림 → 1/1/1 균형.
  const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, placementOps: OPS };
  console.log('== zonerebalance (0277·#51b 6): _rebalance 실 핸들 균형 — 자동 부하 재배치가 매 move 마다 실 EntityZone 핸들도 _migrate(0273) 이주. 3존 hostA 몰림 후 실 런타임 1/1/1 분산(runtimeOn 각 1·zoneRuntimeHosts 3)·drift 0·재생성 0(zoneStarts 3 불변). ==');
  console.log('seed   | onA | onB | onC | hosts | drift | starts | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 8, ...BASE });
    const o = r.orch;
    const ok = check(o.runtimeOn('hostA') === 1 && o.runtimeOn('hostB') === 1 && o.runtimeOn('hostC') === 1 && o.zoneRuntimeHosts().size === 3 && o.zoneRuntimeDrift() === 0 && o.zoneStarts === 3,
      `seed ${seed}: rebalance 위반 (A ${o.runtimeOn('hostA')}·B ${o.runtimeOn('hostB')}·C ${o.runtimeOn('hostC')}·hosts ${o.zoneRuntimeHosts().size}·drift ${o.zoneRuntimeDrift()}·starts ${o.zoneStarts})`);
    console.log(`${pad(seed, 6)} | ${pad(o.runtimeOn('hostA'), 3)} | ${pad(o.runtimeOn('hostB'), 3)} | ${pad(o.runtimeOn('hostC'), 3)} | ${pad(o.zoneRuntimeHosts().size, 5)} | ${pad(o.zoneRuntimeDrift(), 5)} | ${pad(o.zoneStarts, 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['zonerebalance'] = zonerebalance;
kit.ORDER.splice(1, 0, 'zonerebalance');

(async () => { process.exit(await kit.cli(process.argv)); })();
