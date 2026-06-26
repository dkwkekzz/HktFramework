// HktInfra step-0345 — 헤드리스 검증 (#9 후속: 다중 클라 교차 관찰자 일치 — 겹친 뷰 desync 0)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `dcagree`.
//   더한 한 조각: DownClient.seenPos(id)('x,y'|null) — 두 클라가 겹친 AOI 의 *공유* entity 를 같은 위치로 보는가 비교. 척추 "겹친 뷰의 참여자는 일치" 의 다운스트림 판.
//   검증: ⒜ `reg`(키트·읽기 헬퍼 추가·비트 동일). ⒝ `dcagree` — a1·a2 상호 가시 시 dc0·dc1 모두 a1·a2 를 *같은 위치*로 본다(서로 일치 && host 권위와 일치·교차 관찰자 desync 0).
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { run } = NET;

// step-0345 #9 후속 — 다중 클라 교차 관찰자 일치. a1·a2 상호 가시 → dc0(a1)·dc1(a2) 둘 다 a1·a2 를 본다.
//   공유 entity(a1·a2)를 *서로 같은 위치*로 보고(dc0.seenPos==dc1.seenPos) host 권위(zoneEntityPos)와도 일치 → 겹친 뷰 desync 0.
function dcagree(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const ENTER = (at, zoneId, avatar, from) => ({ at, from, op: { type: 'zoneEnter', zoneId, avatar } });
  const MOVE = (at, zoneId, avatar, dx, dy, from) => ({ at, from, op: { type: 'zoneMove', zoneId, avatar, dx, dy } });
  const OPS = [PLACE(1, 'z1', 'hostA')];
  const ENT = [ENTER(3, 'z1', 'a1', 'dc0'), ENTER(4, 'z1', 'a2', 'dc1')];
  for (let k = 0; k < 8; k++) ENT.push(MOVE(5 + k, 'z1', 'a1', 1, 1, 'dc0'));   // a1→a2 근방·상호 가시.
  const BASE = { clients: 6, moves: 24, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneEntityFlow: true, zoneHostHandle: true, zoneHostMailbox: true, gatewayZoneDir: true, gatewayDirectZone: true, zoneHostProc: true, zoneEgress: true, downClients: 2 };
  console.log('== dcagree (0345·#9 후속): 다중 클라 교차 관찰자 일치. 공유 entity 위치 dc0==dc1==host 권위(겹친 뷰 desync 0). ==');
  console.log('seed   | a1: dc0/dc1/auth | a2: dc0/dc1/auth | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 20, ...BASE, placementOps: OPS, entityOps: ENT });
    const o = r.orch, dc0 = r.downclients[0], dc1 = r.downclients[1];
    const pos = (id) => { const e = o.zoneEntityPos('z1', id); return e ? (e.x + ',' + e.y) : null; };
    const a1agree = dc0.seenPos('a1') === dc1.seenPos('a1') && dc0.seenPos('a1') === pos('a1') && pos('a1') !== null;
    const a2agree = dc0.seenPos('a2') === dc1.seenPos('a2') && dc0.seenPos('a2') === pos('a2') && pos('a2') !== null;
    const ok = check(a1agree && a2agree, `seed ${seed}: a1 ${dc0.seenPos('a1')}/${dc1.seenPos('a1')}/${pos('a1')} a2 ${dc0.seenPos('a2')}/${dc1.seenPos('a2')}/${pos('a2')}`);
    console.log(`${pad(seed, 6)} | ${pad(dc0.seenPos('a1') + '/' + dc1.seenPos('a1') + '/' + pos('a1'), 16)} | ${pad(dc0.seenPos('a2') + '/' + dc1.seenPos('a2') + '/' + pos('a2'), 16)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['dcagree'] = dcagree;
kit.ORDER.splice(1, 0, 'dcagree');

(async () => { process.exit(await kit.cli(process.argv)); })();
