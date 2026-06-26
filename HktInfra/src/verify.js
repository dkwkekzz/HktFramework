// HktInfra step-0311 — 헤드리스 검증 (#9 잔여: host 프로세스 부하 불균형 질의 hostLoadSkew)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `hostloadskew`.
//   더한 한 조각: hostLoadSkew()(host 컨테이너 존 수 분포의 max−min). 한 host 에 몰린 배치를 placeRebalance 로 균형 → skew 감소(읽기 전용).
//   검증: ⒜ `reg`(키트·OFF 비트 동일). ⒝ `hostloadskew`(가설) — rebalance 없으면 skew 2, 있으면 skew ≤ 1·총존 보존·hostContainerCoherent.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { run } = NET;

// step-0311 #9 잔여 검증 — host 프로세스 부하 불균형(hostLoadSkew). 한 host(A)에 존을 몰아 둔 뒤 placeRebalance 로 고르게 펴면 skew(max−min)가 줄어든다.
//   같은 배치를 rebalance 없이(r0)·있이(r1) 두 번 돌려: r0 skew 2(A=3,B=1) vs r1 skew ≤ 1(A=2,B=1,C=1) — 부하 균형이 host 프로세스 단위로 수렴함을 보인다. 총존 보존·hostContainerCoherent.
function hostloadskew(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const REBAL = (at, hosts) => ({ at, op: { type: 'placeRebalance', hosts } });
  const HS = ['hostA', 'hostB', 'hostC'];
  const SKEWOPS = [PLACE(1, 'z1', 'hostA'), PLACE(2, 'z2', 'hostA'), PLACE(3, 'z3', 'hostA'), PLACE(4, 'z4', 'hostB')];
  const BASE = { clients: 6, moves: 24, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneHostHandle: true, zoneHostMailbox: true, gatewayZoneDir: true, gatewayDirectZone: true, zoneHostProc: true };
  console.log('== hostloadskew (0311·#9 잔여): host 프로세스 부하 불균형. A 에 몰린 배치를 placeRebalance 로 균형 → skew 2→≤1·총존 보존·hostContainerCoherent. ==');
  console.log('seed   | skew0 | skew1 | tot0 | tot1 | hcoh | 판정');
  for (const seed of seeds) {
    const r0 = run({ seed, ticks: 12, ...BASE, placementOps: SKEWOPS });                                   // rebalance 없음 — A 에 몰린 채.
    const r1 = run({ seed, ticks: 12, ...BASE, placementOps: [...SKEWOPS, REBAL(6, HS)] });                 // rebalance 후 — 고르게.
    const s0 = r0.orch.hostLoadSkew(), s1 = r1.orch.hostLoadSkew();
    const ok = check(s0.skew === 2 && s1.skew <= 1 && r0.orch.running.size === 4 && r1.orch.running.size === 4 &&
      r1.orch.hostContainerCoherent() && r1.orch.zoneHostSingleOwner(),
      `seed ${seed}: 부하 균형 위반 (skew0 ${s0.skew}·skew1 ${s1.skew}·tot0 ${r0.orch.running.size}·tot1 ${r1.orch.running.size}·hcoh ${r1.orch.hostContainerCoherent()})`);
    console.log(`${pad(seed, 6)} | ${pad(s0.skew, 5)} | ${pad(s1.skew, 5)} | ${pad(r0.orch.running.size, 4)} | ${pad(r1.orch.running.size, 4)} | ${pad(r1.orch.hostContainerCoherent() ? 'Y' : 'N', 4)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['hostloadskew'] = hostloadskew;
kit.ORDER.splice(1, 0, 'hostloadskew');

(async () => { process.exit(await kit.cli(process.argv)); })();
