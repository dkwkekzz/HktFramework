// HktInfra step-0309 — 헤드리스 검증 (#9 잔여: 실 host.js 물리 분리 9 — 다중 동시 이주 host 컨테이너 bijection)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `zonehostbij`.
//   더한 한 조각: zoneHostSnapshot()(host→[존…]). 읽기 전용→0308 비트 동일(reg).
//   검증: ⒜ `reg`(키트·읽기 전용 비트 동일). ⒝ `zonehostbij`(가설) — 4존 몰림→rebalance→drain 다중 동시 이주 후 host 컨테이너 스냅샷 == running 의 host 별 묶음(bijection)·entity graceful 보존.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { run } = NET;

// host 컨테이너 스냅샷 == running 의 host 별 묶음(정확한 bijection·키·값 둘 다).
function snapshotMatchesRunning(o) {
  const snap = o.zoneHostSnapshot();
  const byHost = {};
  for (const [z, h] of o.running) (byHost[h] = byHost[h] || []).push(z);
  for (const h in byHost) byHost[h].sort();
  const sk = Object.keys(snap).sort(), rk = Object.keys(byHost).sort();
  if (sk.length !== rk.length) return false;
  for (let i = 0; i < sk.length; i++) { if (sk[i] !== rk[i]) return false; if (JSON.stringify(snap[sk[i]]) !== JSON.stringify(byHost[sk[i]])) return false; }
  return true;
}

// step-0309 #9 잔여 검증 — 다중 동시 이주(4존 한 host 몰림→rebalance→drain) 후에도 host 컨테이너가 running 과 정확한 bijection·entity graceful 보존.
//   z1~z4 모두 hostA 에 배치·각 enter 1·rebalance[A,B,C](불균형 해소 다중 이주)·drain hostA(남은 존 분산) → host 스냅샷==running bijection·census total 4 보존(graceful 무손실)·hostContainerCoherent.
function zonehostbij(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const ENTER = (at, zoneId, avatar) => ({ at, op: { type: 'zoneEnter', zoneId, avatar } });
  const REBAL = (at, hosts) => ({ at, op: { type: 'placeRebalance', hosts } });
  const DRAIN = (at, host, hosts) => ({ at, op: { type: 'placeDrain', host, hosts } });
  const HS = ['hostA', 'hostB', 'hostC'];
  const PLACEOPS = [PLACE(1, 'z1', 'hostA'), PLACE(2, 'z2', 'hostA'), PLACE(3, 'z3', 'hostA'), PLACE(4, 'z4', 'hostA'),
    REBAL(12, HS), DRAIN(14, 'hostA', HS)];
  const ENTOPS = [ENTER(5, 'z1', 'a1'), ENTER(6, 'z2', 'a2'), ENTER(7, 'z3', 'a3'), ENTER(8, 'z4', 'a4')];
  const BASE = { clients: 6, moves: 24, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneEntityFlow: true, zoneHostHandle: true, zoneHostMailbox: true, gatewayZoneDir: true, gatewayDirectZone: true, zoneHostProc: true, placementOps: PLACEOPS, entityOps: ENTOPS };
  console.log('== zonehostbij (0309·#9 잔여 9): 다중 동시 이주 host 컨테이너 bijection. 4존 hostA 몰림→rebalance→drain → host 스냅샷==running bijection·census total4 보존·hostContainerCoherent. ==');
  console.log('seed   | bij | hcoh | census | hosts | hostA= | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 20, ...BASE });
    const o = r.orch;
    const bij = snapshotMatchesRunning(o);
    const cs = o.zoneHostCensus();
    const aZero = o.hostRuntimeCount('hostA') === 0;   // 드레인 후 hostA 는 비어야(존 0).
    const ok = check(bij && o.hostContainerCoherent() && cs.total === 4 && o.totalEntities() === 4 && aZero && o.zoneEnters === 4,
      `seed ${seed}: host bijection 위반 (bij ${bij}·hcoh ${o.hostContainerCoherent()}·census ${cs.total}·total ${o.totalEntities()}·hostA ${o.hostRuntimeCount('hostA')})`);
    console.log(`${pad(seed, 6)} | ${pad(bij ? 'Y' : 'N', 3)} | ${pad(o.hostContainerCoherent() ? 'Y' : 'N', 4)} | ${pad(cs.total, 6)} | ${pad(o.zoneHostHosts().size, 5)} | ${pad(aZero ? 'Y' : 'N', 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['zonehostbij'] = zonehostbij;
kit.ORDER.splice(1, 0, 'zonehostbij');

(async () => { process.exit(await kit.cli(process.argv)); })();
