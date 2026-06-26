// HktInfra step-0315 — 헤드리스 검증 (#9 잔여: 다중 동시 host 프로세스 장애)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `hostdoublefail`.
//   더한 한 조각: hostCount()(가동 host 프로세스 수). 2 host 연속 장애 → 모든 존을 마지막 생존 host 로·hostCount 3→1·bijection(읽기 전용).
//   검증: ⒜ `reg`(키트·OFF 비트 동일). ⒝ `hostdoublefail`(가설) — hostA·hostB 연속 down → 4존 전부 hostC·hostCount 1·despawn A·B·hostContainerCoherent·bijection.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { run } = NET;

// step-0315 #9 잔여 검증 — 다중 동시 host 장애(hostCount). z1·z2@A·z3·z4@B(2 host·각 2존). hostA down(생존 [B,C]) → z1·z2→C. hostB down(생존 [C]·죽은 A 제외) → z3·z4→C.
//   장애 누적 후: 모든 4존이 hostC 로 수렴·hostCount 3→1(2대 죽고 1대 남음)·hostZones(C) 4개·A·B despawn 로그·hostContainerCoherent·bijection(zoneHostSnapshot=={C:[z1..z4]}).
function hostdoublefail(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const DOWN = (at, host, hosts) => ({ at, op: { type: 'placeHostDown', host, hosts } });
  const OPS = [PLACE(1, 'z1', 'hostA'), PLACE(2, 'z2', 'hostA'), PLACE(3, 'z3', 'hostB'), PLACE(4, 'z4', 'hostB'),
    DOWN(10, 'hostA', ['hostA', 'hostB', 'hostC']), DOWN(12, 'hostB', ['hostB', 'hostC'])];
  const BASE = { clients: 6, moves: 24, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneHostHandle: true, zoneHostMailbox: true, gatewayZoneDir: true, gatewayDirectZone: true, zoneHostProc: true, zoneHostLifecycle: true };
  console.log('== hostdoublefail (0315·#9 잔여): 다중 동시 host 장애. 2 host(각 2존) 연속 down → 4존 전부 hostC·hostCount 3→1·despawn A·B·bijection. ==');
  console.log('seed   | hostCount | C존수 | despAB | hcoh | bij | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 16, ...BASE, placementOps: OPS });
    const o = r.orch;
    const cN = o.hostZones('hostC').length;
    const despAB = o.hostLifecycle().filter(e => e.kind === 'despawn' && (e.host === 'hostA' || e.host === 'hostB')).length;
    const snap = o.zoneHostSnapshot();
    const bij = Object.keys(snap).length === 1 && (snap.hostC || []).join(',') === 'z1,z2,z3,z4';
    const ok = check(o.hostCount() === 1 && cN === 4 && despAB === 2 && o.hostContainerCoherent() && bij && o.running.size === 4,
      `seed ${seed}: 다중 장애 위반 (hostCount ${o.hostCount()}·C존 ${cN}·despAB ${despAB}·hcoh ${o.hostContainerCoherent()}·bij ${bij})`);
    console.log(`${pad(seed, 6)} | ${pad(o.hostCount(), 9)} | ${pad(cN, 5)} | ${pad(despAB, 6)} | ${pad(o.hostContainerCoherent() ? 'Y' : 'N', 4)} | ${pad(bij ? 'Y' : 'N', 3)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['hostdoublefail'] = hostdoublefail;
kit.ORDER.splice(1, 0, 'hostdoublefail');

(async () => { process.exit(await kit.cli(process.argv)); })();
