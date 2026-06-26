// HktInfra step-0329 — 헤드리스 검증 (#9 후속: 다운스트림 뷰 무손실 회계 — 고아 frame 0)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `hostzoneconsv`.
//   더한 한 조각: 술어 zoneViewConserved(모든 view frame 이 정확히 한 세션에 귀속·고아 frame 0·세션별 합==전체). host 산출 뷰가 빠짐없이 배달 주소를 갖는지 검증(읽기 전용).
//   검증: ⒜ `reg`(키트·OFF 비트 동일). ⒝ `hostzoneconsv`(가설) — a1·a2·a3 enter+이동 → 모든 frame 에 sessionId·세션별 total 합 == zoneViewFrames·zoneViewConserved true.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { run } = NET;

// step-0329 #9 후속 검증 — 다운스트림 뷰 무손실 회계(zoneViewConserved). z1 에 a1·a2·a3 enter + 이동 → 산출된 모든 view frame 이 정확히 한 세션에 귀속(고아 frame 0)·세션별 total 합 == zoneViewFrames.
//   host 가 산출한 다운스트림 뷰는 빠짐없이 *누군가에게 배달될 주소*(sessionId)를 갖는다 — 주소 없는 frame 0(무손실 배달 가능성). 다운스트림 데이터 평면 보존의 회계 단언.
function hostzoneconsv(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const ENTER = (at, zoneId, avatar) => ({ at, op: { type: 'zoneEnter', zoneId, avatar } });
  const MOVE = (at, zoneId, avatar, dx, dy) => ({ at, op: { type: 'zoneMove', zoneId, avatar, dx, dy } });
  const OPS = [PLACE(1, 'z1', 'hostA')];
  const ENT = [ENTER(3, 'z1', 'a1'), ENTER(4, 'z1', 'a2'), ENTER(5, 'z1', 'a3'), MOVE(7, 'z1', 'a1', 1, 0), MOVE(8, 'z1', 'a2', 0, 1), MOVE(9, 'z1', 'a3', 1, 1)];
  const BASE = { clients: 6, moves: 24, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneEntityFlow: true, zoneHostHandle: true, zoneHostMailbox: true, gatewayZoneDir: true, gatewayDirectZone: true, zoneHostProc: true };
  console.log('== hostzoneconsv (0329·#9 후속): 다운스트림 뷰 무손실 회계. 모든 view frame 이 정확히 한 세션에 귀속(고아 0)·세션별 합==전체·zoneViewConserved true. ==');
  console.log('seed   | frames | sumSess | consv | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 14, ...BASE, placementOps: OPS, entityOps: ENT });
    const o = r.orch;
    const frames = o.zoneViewFrames();
    const sumSess = o.zoneViewSessions('z1').reduce((acc, sid) => acc + o.zoneViewStats('z1', sid).total, 0);
    const consv = o.zoneViewConserved('z1');
    const ok = check(consv === true && sumSess === frames && frames > 0,
      `seed ${seed}: 무손실 회계 위반 (frames ${frames}·sumSess ${sumSess}·consv ${consv})`);
    console.log(`${pad(seed, 6)} | ${pad(frames, 6)} | ${pad(sumSess, 7)} | ${pad(consv ? 'Y' : 'N', 5)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['hostzoneconsv'] = hostzoneconsv;
kit.ORDER.splice(1, 0, 'hostzoneconsv');

(async () => { process.exit(await kit.cli(process.argv)); })();
