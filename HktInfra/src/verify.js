// HktInfra step-0326 — 헤드리스 검증 (#9 후속: 다중 존 독립 다운스트림 — 존 간 뷰 격리)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `hostzoneisolate`.
//   더한 한 조각: 질의 zoneViewSessions(그 존이 뷰 산출한 sessionId 집합). 다중 존이 각자 *자기 세션에만* 뷰를 내보내는지(존 간 누수 0·격리) 검증(읽기 전용).
//   검증: ⒜ `reg`(키트·OFF 비트 동일). ⒝ `hostzoneisolate`(가설) — z1(a1·a2)·z2(b1) 동시 → z1 세션={s:a1,s:a2}·z2 세션={s:b1}·entered 교차 0.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { run } = NET;

// step-0326 #9 후속 검증 — 다중 존 독립 다운스트림(zoneViewSessions). z1@A(a1·a2)·z2@B(b1) 동시 가동. 각 존 런타임이 onTick 으로 *자기 세션에만* 뷰를 산출.
//   z1 의 산출 뷰 세션 = {s:a1, s:a2}·z2 = {s:b1}(존 간 누수 0)·z1 의 entered 에 b1 없음·z2 의 entered 에 a1/a2 없음(격리) — 공간 분할 존이 서로의 뷰를 오염하지 않는다.
function hostzoneisolate(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const ENTER = (at, zoneId, avatar) => ({ at, op: { type: 'zoneEnter', zoneId, avatar } });
  const OPS = [PLACE(1, 'z1', 'hostA'), PLACE(2, 'z2', 'hostB')];
  const ENT = [ENTER(4, 'z1', 'a1'), ENTER(5, 'z1', 'a2'), ENTER(6, 'z2', 'b1')];
  const BASE = { clients: 6, moves: 24, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneEntityFlow: true, zoneHostHandle: true, zoneHostMailbox: true, gatewayZoneDir: true, gatewayDirectZone: true, zoneHostProc: true };
  console.log('== hostzoneisolate (0326·#9 후속): 다중 존 독립 다운스트림. z1(a1·a2)·z2(b1) 동시 → z1 세션={s:a1,s:a2}·z2={s:b1}·존 간 누수 0. ==');
  console.log('seed   | z1sess | z2sess | noLeak | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 12, ...BASE, placementOps: OPS, entityOps: ENT });
    const o = r.orch;
    const s1 = o.zoneViewSessions('z1'), s2 = o.zoneViewSessions('z2');
    const e1 = o.zoneViewEntered('z1', 's:a1').concat(o.zoneViewEntered('z1', 's:a2'));
    const e2 = o.zoneViewEntered('z2', 's:b1');
    const noLeak = !e1.includes('b1') && !e2.includes('a1') && !e2.includes('a2');
    const ok = check(s1.join(',') === 's:a1,s:a2' && s2.join(',') === 's:b1' && noLeak,
      `seed ${seed}: 존 격리 위반 (z1sess ${s1}·z2sess ${s2}·noLeak ${noLeak})`);
    console.log(`${pad(seed, 6)} | ${pad(s1.join('|'), 6)} | ${pad(s2.join('|'), 6)} | ${pad(noLeak ? 'Y' : 'N', 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['hostzoneisolate'] = hostzoneisolate;
kit.ORDER.splice(1, 0, 'hostzoneisolate');

(async () => { process.exit(await kit.cli(process.argv)); })();
