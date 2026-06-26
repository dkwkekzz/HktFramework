// HktInfra step-0333 — 헤드리스 검증 (#9 후속: 다운스트림 — 게이트웨이가 zoneView 수신·세션별 버퍼)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `gwdown`.
//   더한 한 조각: 게이트웨이 onMsg 에 orch zoneView 분기 → _recvZoneView 가 세션별 다운스트림 버퍼(zoneViewIn)에 적재(존→게이트웨이 경로의 게이트웨이 종단). 0331 egress 송출의 짝.
//   검증: ⒜ `reg`(키트·zoneEgress OFF→zoneView 미수신·비트 동일). ⒝ `gwdown` — egress 한 만큼 게이트웨이가 받음(gatewayDownstreamCount == orch.zoneEgressCount·무손실)·세션별 분배.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { run } = NET;

// step-0333 #9 후속 — 게이트웨이 다운스트림 수신. z1@A 에 a1·a2 enter + 이동 → orch egress → 게이트웨이가 zoneView 를 세션별 버퍼에 적재.
//   gatewayDownstreamCount == orch.zoneEgressCount(egress→게이트웨이 무손실) && 세션 2개에 분배(a1·a2 각자 frame>0).
function gwdown(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const ENTER = (at, zoneId, avatar) => ({ at, op: { type: 'zoneEnter', zoneId, avatar } });
  const MOVE = (at, zoneId, avatar, dx, dy) => ({ at, op: { type: 'zoneMove', zoneId, avatar, dx, dy } });
  const OPS = [PLACE(1, 'z1', 'hostA')];
  const ENT = [ENTER(3, 'z1', 'a1'), ENTER(4, 'z1', 'a2'), MOVE(6, 'z1', 'a1', 1, 1), MOVE(8, 'z1', 'a2', 1, 0)];
  const BASE = { clients: 6, moves: 24, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneEntityFlow: true, zoneHostHandle: true, zoneHostMailbox: true, gatewayZoneDir: true, gatewayDirectZone: true, zoneHostProc: true, zoneEgress: true };
  console.log('== gwdown (0333·#9 후속): 게이트웨이가 orch egress zoneView 를 세션별 버퍼에 수신. gwRx==egress(무손실) && 세션 분배. ==');
  console.log('seed   | gwRx | egress | sess | a1 | a2 | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 16, ...BASE, placementOps: OPS, entityOps: ENT });
    const o = r.orch, g = r.gateway;
    const rx = g.gatewayDownstreamCount(), eg = o.zoneEgressCount();
    const sess = g.gatewayViewSessions().length;
    const a1 = g.gatewayViewsFor('s:a1'), a2 = g.gatewayViewsFor('s:a2');
    const ok = check(rx === eg && rx > 0 && a1 > 0 && a2 > 0, `seed ${seed}: gwRx ${rx} egress ${eg} a1 ${a1} a2 ${a2}`);
    console.log(`${pad(seed, 6)} | ${pad(rx, 4)} | ${pad(eg, 6)} | ${pad(sess, 4)} | ${pad(a1, 2)} | ${pad(a2, 2)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['gwdown'] = gwdown;
kit.ORDER.splice(1, 0, 'gwdown');

(async () => { process.exit(await kit.cli(process.argv)); })();
