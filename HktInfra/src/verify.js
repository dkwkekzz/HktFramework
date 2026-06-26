// HktInfra step-0330 — 헤드리스 검증 (#9 후속 capstone: 다운스트림 데이터 평면 전 정합)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `downstreamcap`.
//   더한 한 조각: 술어 downstreamCoherent(zoneViewConserved && zoneViewAllKeyed && serializable). 혼합 lifecycle 뒤 다운스트림 뷰가 빠짐없이 주소·무굶김·와이어 준비인지 + host-proc 정합도 유지인지(읽기 전용).
//   검증: ⒜ `reg`(키트·OFF 비트 동일). ⒝ `downstreamcap`(capstone) — enter/move/leave/migrate 혼합 → downstreamCoherent(z1·z2)·hostProcCoherent·entityConserved·total 2. #9 후속 downstream sub-arc(0319~0330) 닫기.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { run } = NET;

// step-0330 #9 후속 capstone — 다운스트림 데이터 평면 전 정합(downstreamCoherent). z1@A(a1·a2)·z2@C(b1) 혼합 lifecycle: 이동 + z1 A→B migrate + a2 leave.
//   뒤에: 두 존 downstreamCoherent(뷰 무손실 회계 + 무굶김 + 와이어 준비) + 데이터 평면 hostProcCoherent(0310·배치 3층 + 게이트웨이 직접 라우팅 + host 프로세스 컨테이너 정합) + entityConserved(3 enter−1 leave=2).
//   다운스트림(host→세션 뷰)이 업스트림 정합을 깨지 않고 완전 건강 — #9 후속 downstream sub-arc 0319~0330 닫기.
function downstreamcap(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const ENTER = (at, zoneId, avatar) => ({ at, op: { type: 'zoneEnter', zoneId, avatar } });
  const MOVE = (at, zoneId, avatar, dx, dy) => ({ at, op: { type: 'zoneMove', zoneId, avatar, dx, dy } });
  const LEAVE = (at, zoneId, avatar) => ({ at, op: { type: 'zoneLeave', zoneId, avatar } });
  const MIG = (at, zoneId, toHost) => ({ at, op: { type: 'placeMigrate', zoneId, toHost } });
  const OPS = [PLACE(1, 'z1', 'hostA'), PLACE(2, 'z2', 'hostC'), MIG(10, 'z1', 'hostB')];
  const ENT = [ENTER(3, 'z1', 'a1'), ENTER(4, 'z1', 'a2'), ENTER(5, 'z2', 'b1'), MOVE(7, 'z1', 'a1', 1, 1), MOVE(8, 'z2', 'b1', 1, 0), MOVE(12, 'z1', 'a1', 1, 1), LEAVE(13, 'z1', 'a2')];
  const BASE = { clients: 6, moves: 24, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneEntityFlow: true, zoneHostHandle: true, zoneHostMailbox: true, gatewayZoneDir: true, gatewayDirectZone: true, zoneHostProc: true, zoneHostLifecycle: true };
  console.log('== downstreamcap (0330·#9 후속 capstone): 다운스트림 전 정합. enter/move/leave/migrate 혼합 → downstreamCoherent(z1·z2)·hostProcCoherent·entityConserved·total2. downstream sub-arc 0319~0330 닫기. ==');
  console.log('seed   | dc1 | dc2 | hpcoh | consv | total | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 16, ...BASE, placementOps: OPS, entityOps: ENT });
    const o = r.orch;
    const dc1 = o.downstreamCoherent('z1'), dc2 = o.downstreamCoherent('z2');
    const ok = check(dc1 && dc2 && o.hostProcCoherent() && o.entityConserved() && o.totalEntities() === 2,
      `seed ${seed}: capstone 위반 (dc1 ${dc1}·dc2 ${dc2}·hpcoh ${o.hostProcCoherent()}·consv ${o.entityConserved()}·total ${o.totalEntities()})`);
    console.log(`${pad(seed, 6)} | ${pad(dc1 ? 'Y' : 'N', 3)} | ${pad(dc2 ? 'Y' : 'N', 3)} | ${pad(o.hostProcCoherent() ? 'Y' : 'N', 5)} | ${pad(o.entityConserved() ? 'Y' : 'N', 5)} | ${pad(o.totalEntities(), 5)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['downstreamcap'] = downstreamcap;
kit.ORDER.splice(1, 0, 'downstreamcap');

(async () => { process.exit(await kit.cli(process.argv)); })();
