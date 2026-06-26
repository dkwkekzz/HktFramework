// HktInfra step-0346 — 헤드리스 검증 (#9 후속 capstone: 실 다운스트림 클라 수렴 전 정합)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `dccap`.
//   더한 한 조각: DownClient.convergedTo(authSig)(수신자 측 desync 0 선언). capstone = 다중 클라·상호 가시·손실·migrate 뒤 모든 클라가 host 권위로 수렴 + 교차 관찰자 일치 + downstreamSettled.
//   검증: ⒜ `reg`(키트·읽기 헬퍼·비트 동일). ⒝ `dccap` — a1@dc0·a2@dc1 상호 가시·z1 A→B migrate·s:a1#3 손실 뒤 둘 다 convergedTo(zoneAuthSig)·공유 entity 일치·settled. 수렴 sub-arc 0342~0346 닫기.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { run } = NET;

// step-0346 #9 후속 capstone — 실 다운스트림 클라 수렴 전 정합. a1@dc0·a2@dc1 z1 입장·a1→a2 이동(상호 가시)·z1 A→B migrate·s:a1#3 손실.
//   뒤: dc0·dc1 모두 convergedTo(zoneAuthSig)(host 권위로 desync 0)·공유 entity 위치 dc0==dc1==host(교차 일치)·downstreamSettled(전부 도달·복구). 수렴 sub-arc 0342~0346 닫기.
function dccap(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const ENTER = (at, zoneId, avatar, from) => ({ at, from, op: { type: 'zoneEnter', zoneId, avatar } });
  const MOVE = (at, zoneId, avatar, dx, dy, from) => ({ at, from, op: { type: 'zoneMove', zoneId, avatar, dx, dy } });
  const MIG = (at, zoneId, toHost) => ({ at, op: { type: 'placeMigrate', zoneId, toHost } });
  const OPS = [PLACE(1, 'z1', 'hostA'), MIG(16, 'z1', 'hostB')];
  const ENT = [ENTER(3, 'z1', 'a1', 'dc0'), ENTER(4, 'z1', 'a2', 'dc1')];
  for (let k = 0; k < 8; k++) ENT.push(MOVE(5 + k, 'z1', 'a1', 1, 1, 'dc0'));   // a1 (5,5)→(13,13)·a2(13,15) 상호 가시.
  const BASE = { clients: 6, moves: 24, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneEntityFlow: true, zoneHostHandle: true, zoneHostMailbox: true, gatewayZoneDir: true, gatewayDirectZone: true, zoneHostProc: true, zoneEgress: true, downClients: 2, egressDrop: ['s:a1#3'], egressTimeout: 4 };
  console.log('== dccap (0346·#9 후속 capstone): 다중 클라·상호 가시·migrate·손실 뒤 전 수렴. conv0·conv1·agree·settled. sub-arc 0342~0346 닫기. ==');
  console.log('seed   | conv0 | conv1 | agree | settled | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 28, ...BASE, placementOps: OPS, entityOps: ENT });
    const o = r.orch, dc0 = r.downclients[0], dc1 = r.downclients[1];
    const conv0 = dc0.convergedTo(o.zoneAuthSig('z1', 'a1')), conv1 = dc1.convergedTo(o.zoneAuthSig('z1', 'a2'));
    const pos = (id) => { const e = o.zoneEntityPos('z1', id); return e ? (e.x + ',' + e.y) : null; };
    const agree = dc0.seenPos('a1') === dc1.seenPos('a1') && dc0.seenPos('a1') === pos('a1') &&
                  dc0.seenPos('a2') === dc1.seenPos('a2') && dc0.seenPos('a2') === pos('a2');
    const settled = o.downstreamSettled();
    const ok = check(conv0 && conv1 && agree && settled, `seed ${seed}: conv ${conv0}/${conv1} agree ${agree} settled ${settled}`);
    console.log(`${pad(seed, 6)} | ${pad(conv0 ? 'Y' : 'N', 5)} | ${pad(conv1 ? 'Y' : 'N', 5)} | ${pad(agree ? 'Y' : 'N', 5)} | ${pad(settled ? 'Y' : 'N', 7)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['dccap'] = dccap;
kit.ORDER.splice(1, 0, 'dccap');

(async () => { process.exit(await kit.cli(process.argv)); })();
