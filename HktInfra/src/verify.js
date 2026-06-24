// HktInfra step-0248 — 헤드리스 검증 (배치 SSOT 실배선 #51 — host 장애 복구 placeHostDown)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `placehostdown`.
//   더한 한 조각: placeHostDown{host, hosts} → 비자발적으로 죽은 host 의 모든 존을 생존 host 중 최소부하로 *재가동*(re-acquire·드레인의 graceful migrate 와 달리 죽은 host 는 release 불가). 복구 후 죽은 host running 0·drift 0. 미주입/OFF → 0247 비트 동일(reg). #51 실배선 8.
//   검증: ⒜ `reg`(키트). ⒝ `placehostdown`(가설) — z1·z2@A·z3@B 가동 → A 장애 → z1·z2 생존 host(B·C) 재가동·A run 0·drift 0.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { run } = NET;
const { check, pad } = kit.helpers;

const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
const HOSTDOWN = (at, host, hosts) => ({ at, op: { type: 'placeHostDown', host, hosts } });
const HOSTS = ['hostA', 'hostB', 'hostC'];
// z1·z2@hostA·z3@hostB 가동 → hostA 비자발 장애 → z1·z2 생존 host(B·C)로 재가동(re-acquire).
const OPS = [PLACE(1, 'z1', 'hostA'), PLACE(2, 'z2', 'hostA'), PLACE(3, 'z3', 'hostB'), HOSTDOWN(4, 'hostA', HOSTS)];
const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, placementOps: OPS };

function placehostdown(seeds) {
  console.log('== placehostdown (0248·#51 실배선): host 장애 복구 — placeHostDown 이 비자발적으로 죽은 host 의 모든 존을 생존 host 중 최소부하로 *재가동*(re-acquire·드레인의 graceful migrate 와 달리 죽은 host 는 release 불가). z1·z2@A·z3@B → A 장애 → A run 0·생존 host 회복·drift 0·rescued 2·한 존 정확히 한 host. ==');
  console.log('seed   | A run | B run | C run | rescued | drift | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 8, ...BASE });
    const o = r.orch;
    // A 장애: A run 0(소실)·z1→B(부하 1<C 0? z3@B 라 B1,C0 → z1→C, z2→B)·총 3존 생존·rescued 2·drift 0·한 존 한 host.
    const A = o.runningOn('hostA'), B = o.runningOn('hostB'), C = o.runningOn('hostC');
    const ok = check(A === 0 && o.runningCount() === 3 && (A + B + C) === 3 && o.hostRescued === 2 && o.placementDrift() === 0 && o.runningHostOf('z3') === 'hostB',
      `seed ${seed}: 장애 복구 위반 (A ${A}·B ${B}·C ${C}·rescued ${o.hostRescued}·drift ${o.placementDrift()})`);
    console.log(`${pad(seed, 6)} | ${pad(A, 5)} | ${pad(B, 5)} | ${pad(C, 5)} | ${pad(o.hostRescued, 7)} | ${pad(o.placementDrift(), 5)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['placehostdown'] = placehostdown;
kit.ORDER.splice(1, 0, 'placehostdown');

(async () => { process.exit(await kit.cli(process.argv)); })();
