// HktInfra step-0348 — 헤드리스 검증 (#9 후속: 다운스트림 late-join 수렴 — 중도 합류 클라 keyframe 수렴)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `dcjoin`.
//   더한 한 조각(통합 검증·src 무변경): 세션이 *중도에* 입장하면 런타임 존이 reset keyframe(전체 AOI)을 산출 → egress→게이트웨이→클라 전파 → late-join 클라가 즉시 현재 세계로 수렴(복제=재현·snapshot 은 late-join 최후 수단의 다운스트림 판).
//   검증: ⒜ `reg`(키트·src==baseline 비트 동일). ⒝ `dcjoin` — a1 선입장·이동 뒤 a2 중도 입장 → dc1 이 reset keyframe(resets≥1) 받아 dc1.seenSig == zoneAuthSig('z1','a2')(즉시 수렴·a1·a2 다 봄).
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { run } = NET;

// step-0348 #9 후속 — late-join 수렴. a1 선입장 후 (5,5)→(13,13) 이동. a2 가 *중도*(tick 14)에 (13,15) 입장 → a1 반경 안.
//   a2 의 DownClient(dc1)가 reset keyframe(resets≥1) 으로 즉시 현재 세계 수렴: dc1.seenSig == zoneAuthSig('z1','a2')·a1·a2 둘 다 본다.
function dcjoin(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const ENTER = (at, zoneId, avatar, from) => ({ at, from, op: { type: 'zoneEnter', zoneId, avatar } });
  const MOVE = (at, zoneId, avatar, dx, dy, from) => ({ at, from, op: { type: 'zoneMove', zoneId, avatar, dx, dy } });
  const OPS = [PLACE(1, 'z1', 'hostA')];
  const ENT = [ENTER(3, 'z1', 'a1', 'dc0')];
  for (let k = 0; k < 8; k++) ENT.push(MOVE(4 + k, 'z1', 'a1', 1, 1, 'dc0'));   // a1 (5,5)→(13,13).
  ENT.push(ENTER(14, 'z1', 'a2', 'dc1'));   // a2 중도 입장(13,15)·a1 반경 안.
  const BASE = { clients: 6, moves: 24, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneEntityFlow: true, zoneHostHandle: true, zoneHostMailbox: true, gatewayZoneDir: true, gatewayDirectZone: true, zoneHostProc: true, zoneEgress: true, downClients: 2 };
  console.log('== dcjoin (0348·#9 후속): late-join 수렴. 중도 입장 a2 가 keyframe 으로 즉시 현재 세계 수렴(resets≥1·desync 0). ==');
  console.log('seed   | dc1.resets | dc1.seen | match | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 22, ...BASE, placementOps: OPS, entityOps: ENT });
    const o = r.orch, dc1 = r.downclients[1];
    const match = dc1.seenSig() === o.zoneAuthSig('z1', 'a2');
    const ids = dc1.seenIds().join(',');
    const ok = check(dc1.resets >= 1 && match && dc1.seenIds().length >= 2, `seed ${seed}: resets ${dc1.resets} seen [${ids}] auth [${o.zoneAuthSig('z1', 'a2')}]`);
    console.log(`${pad(seed, 6)} | ${pad(dc1.resets, 10)} | ${pad(ids, 8)} | ${pad(match ? 'Y' : 'N', 5)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['dcjoin'] = dcjoin;
kit.ORDER.splice(1, 0, 'dcjoin');

(async () => { process.exit(await kit.cli(process.argv)); })();
