// HktInfra step-0343 — 헤드리스 검증 (#9 후속: 다운스트림 상호 가시 수렴 — 증분 델타로 위치까지 desync 0)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `dcmutual`.
//   더한 한 조각: 권위 AOI 서명 zoneAuthSig(id@x,y·host 권위·DownClient.seenSig 형식). a1·a2 가 이동으로 반경 안에 들어와 상호 가시 → DownClient 가 증분 델타(enter/update)로 위치까지 수렴.
//   검증: ⒜ `reg`(키트·읽기 전용·비트 동일). ⒝ `dcmutual` — a1 이 a2 쪽 이동 후 dc0.seenSig == zoneAuthSig('z1','a1')(위치 desync 0)·둘 다 [a1,a2] 상호 가시.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { run } = NET;

// step-0343 #9 후속 — 상호 가시 수렴. a1@(5,5)·a2@(13,15)·반경4(초기 무가시). a1 을 a2 쪽으로 8회 이동 → 반경 안 → 상호 가시.
//   DownClient 가 증분 델타로 위치까지 수렴: dc0.seenSig == zoneAuthSig('z1','a1')·dc1 동형·둘 다 a1·a2 본다(상호 가시·desync 0).
function dcmutual(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const ENTER = (at, zoneId, avatar, from) => ({ at, from, op: { type: 'zoneEnter', zoneId, avatar } });
  const MOVE = (at, zoneId, avatar, dx, dy, from) => ({ at, from, op: { type: 'zoneMove', zoneId, avatar, dx, dy } });
  const OPS = [PLACE(1, 'z1', 'hostA')];
  const ENT = [ENTER(3, 'z1', 'a1', 'dc0'), ENTER(4, 'z1', 'a2', 'dc1')];
  for (let k = 0; k < 8; k++) ENT.push(MOVE(5 + k, 'z1', 'a1', 1, 1, 'dc0'));   // a1 (5,5)→(13,13)·a2(13,15) 거리2 <4 → 상호 가시.
  const BASE = { clients: 6, moves: 24, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneEntityFlow: true, zoneHostHandle: true, zoneHostMailbox: true, gatewayZoneDir: true, gatewayDirectZone: true, zoneHostProc: true, zoneEgress: true, downClients: 2 };
  console.log('== dcmutual (0343·#9 후속): 상호 가시 수렴. dc.seenSig == zoneAuthSig(위치 desync 0)·둘 다 [a1,a2]. ==');
  console.log('seed   | dc0 ids | sig match | dc1 ids | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 20, ...BASE, placementOps: OPS, entityOps: ENT });
    const o = r.orch, dc0 = r.downclients[0], dc1 = r.downclients[1];
    const s0 = dc0.seenIds().join(','), s1 = dc1.seenIds().join(',');
    const m0 = dc0.seenSig() === o.zoneAuthSig('z1', 'a1'), m1 = dc1.seenSig() === o.zoneAuthSig('z1', 'a2');
    const ok = check(m0 && m1 && s0 === 'a1,a2' && s1 === 'a1,a2',
      `seed ${seed}: dc0 [${s0}] m0 ${m0} · dc1 [${s1}] m1 ${m1}`);
    console.log(`${pad(seed, 6)} | ${pad(s0, 7)} | ${pad((m0 && m1) ? 'Y' : 'N', 9)} | ${pad(s1, 7)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['dcmutual'] = dcmutual;
kit.ORDER.splice(1, 0, 'dcmutual');

(async () => { process.exit(await kit.cli(process.argv)); })();
