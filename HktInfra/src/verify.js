// HktInfra step-0340 — 헤드리스 검증 (#9 후속: 다운스트림 다중 존 격리 — 클라별 교차 누수 0)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `gwiso`.
//   더한 한 조각: 게이트웨이가 클라별 전달 세션 집합(downDelivered) 기록 → 격리 술어 gatewayDeliveryIsolated(모든 클라가 정확히 자기 1세션 frame 만 받음). 읽기 전용 회계.
//   검증: ⒜ `reg`(키트·읽기 회계뿐·비트 동일). ⒝ `gwiso` — z1(a1@dc0·a2@dc1)·z2(b1@dc2) 동시 → 각 클라 자기 세션만(교차 누수 0)·존별 egress 세션 격리.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { run } = NET;

// step-0340 #9 후속 — 다중 존 다운스트림 격리. z1@A(a1@dc0·a2@dc1)·z2@C(b1@dc2) 동시 → 각 클라가 자기 세션 frame 만 받는다.
//   gatewayDeliveryIsolated()==true(모든 클라 1세션)·dc0→[s:a1]·dc1→[s:a2]·dc2→[s:b1]·존별 egress 세션 격리(z1{a1,a2}·z2{b1}).
function gwiso(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const ENTER = (at, zoneId, avatar, from) => ({ at, from, op: { type: 'zoneEnter', zoneId, avatar } });
  const MOVE = (at, zoneId, avatar, dx, dy, from) => ({ at, from, op: { type: 'zoneMove', zoneId, avatar, dx, dy } });
  const OPS = [PLACE(1, 'z1', 'hostA'), PLACE(2, 'z2', 'hostC')];
  const ENT = [ENTER(3, 'z1', 'a1', 'dc0'), ENTER(4, 'z1', 'a2', 'dc1'), ENTER(5, 'z2', 'b1', 'dc2'),
    MOVE(7, 'z1', 'a1', 1, 1, 'dc0'), MOVE(8, 'z2', 'b1', 1, 0, 'dc2'), MOVE(9, 'z1', 'a2', 0, 1, 'dc1')];
  const BASE = { clients: 6, moves: 24, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneEntityFlow: true, zoneHostHandle: true, zoneHostMailbox: true, gatewayZoneDir: true, gatewayDirectZone: true, zoneHostProc: true, zoneEgress: true };
  console.log('== gwiso (0340·#9 후속): 다중 존 다운스트림 격리. 각 클라 자기 세션만·교차 누수 0·존별 egress 격리. ==');
  console.log('seed   | iso | dc0 | dc1 | dc2 | z1sess | z2sess | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 16, ...BASE, placementOps: OPS, entityOps: ENT });
    const o = r.orch, g = r.gateway;
    const iso = g.gatewayDeliveryIsolated();
    const d0 = g.gatewayClientSessions('dc0').join(','), d1 = g.gatewayClientSessions('dc1').join(','), d2 = g.gatewayClientSessions('dc2').join(',');
    const z1s = o.zoneViewSessions('z1').join(','), z2s = o.zoneViewSessions('z2').join(',');
    const ok = check(iso && d0 === 's:a1' && d1 === 's:a2' && d2 === 's:b1' && z1s === 's:a1,s:a2' && z2s === 's:b1',
      `seed ${seed}: iso ${iso} dc0 ${d0} dc1 ${d1} dc2 ${d2} z1 ${z1s} z2 ${z2s}`);
    console.log(`${pad(seed, 6)} | ${pad(iso ? 'Y' : 'N', 3)} | ${pad(d0, 4)} | ${pad(d1, 4)} | ${pad(d2, 4)} | ${pad(z1s, 6)} | ${pad(z2s, 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['gwiso'] = gwiso;
kit.ORDER.splice(1, 0, 'gwiso');

(async () => { process.exit(await kit.cli(process.argv)); })();
