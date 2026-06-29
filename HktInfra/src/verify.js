// HktInfra step-0352 — 헤드리스 검증 (#57 실 host.js OS 프로세스 spawn 2: hostSpawnDelta reconcile 델타)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `hostdelta`.
//   더한 한 조각: orch.hostSpawnDelta(prev) 읽기 전용 — 직전 spawn host 집합 대비 {spawn,kill,keep}. 드라이버가 매 reconcile tick cluster.spawnOne/killHost 로 집행할 차이.
//   검증: ⒜ `reg`(키트·읽기 전용·비트 동일). ⒝ `hostdelta` — z1@A·z2@B 뒤 hostB drain→hostC: 최종 {hostA,hostC} vs prev[A,B] → spawn[C]·kill[B]·keep[A].
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { run } = NET;

// step-0352 #57 실 host.js OS 프로세스 spawn 2 — reconcile 델타. z1@hostA·z2@hostB 뒤 hostB 드레인(→hostA/hostC 최소부하=hostC).
//   최종 컨테이너 {hostA:[z1], hostC:[z2]}. prev=[hostA,hostB] 대비 hostSpawnDelta → spawn=[hostC]·kill=[hostB]·keep=[hostA]. 드라이버 reconcile 차이.
function hostdelta(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const DRAIN = (at, host, hosts) => ({ at, op: { type: 'placeDrain', host, hosts } });
  const OPS = [PLACE(1, 'z1', 'hostA'), PLACE(2, 'z2', 'hostB'), DRAIN(3, 'hostB', ['hostA', 'hostB', 'hostC'])];
  const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneHostProc: true, placementOps: OPS };
  console.log('== hostdelta (0352·#57): hostSpawnDelta reconcile 차이 — 직전 spawn host 대비 {spawn,kill,keep}(드라이버 cluster.spawnOne/killHost 집행 단위). ==');
  console.log('seed   | hosts | spawn  | kill   | keep   | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 8, ...BASE });
    const o = r.orch;
    const d = o.hostSpawnDelta(['hostA', 'hostB']);   // 직전 reconcile 에 hostA·hostB 가 떠 있었다고 가정.
    const hostsOk = o.hostCount() === 2 && o.hostRegistered('hostA') && o.hostRegistered('hostC') && !o.hostRegistered('hostB');
    const ok = check(hostsOk && d.spawn.join(',') === 'hostC' && d.kill.join(',') === 'hostB' && d.keep.join(',') === 'hostA',
      `seed ${seed}: delta 위반 (spawn ${d.spawn}·kill ${d.kill}·keep ${d.keep})`);
    console.log(`${pad(seed, 6)} | ${pad(o.hostCount(), 5)} | ${pad(d.spawn.join(',') || '-', 6)} | ${pad(d.kill.join(',') || '-', 6)} | ${pad(d.keep.join(',') || '-', 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['hostdelta'] = hostdelta;
kit.ORDER.splice(1, 0, 'hostdelta');

(async () => { process.exit(await kit.cli(process.argv)); })();
