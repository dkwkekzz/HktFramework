// HktInfra step-0334 — 헤드리스 검증 (#9 후속: 다운스트림 — 게이트웨이가 zoneView 를 바인딩된 클라로 라우팅)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `gwroute`.
//   더한 한 조각: 게이트웨이가 클라 zoneEnter 시 세션→클라(downClients) 바인딩 → zoneView 수신 시 그 클라로 frame 전달(존→게이트웨이→클라 완성). 미바인딩 드롭.
//   검증: ⒜ `reg`(키트·zoneEgress OFF→zoneView 0·맵 write 만·비트 동일). ⒝ `gwroute` — 수신 frame 전부 바인딩 클라로 전달(routed==rx·drop0)·세션→클라 바인딩 정확.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { run } = NET;

// step-0334 #9 후속 — 게이트웨이 다운스트림 라우팅. a1 은 클라 dc0·a2 는 dc1 로 게이트웨이에 zoneEnter → 게이트웨이가 세션→클라 바인딩.
//   egress→게이트웨이 수신 frame 을 전부 바인딩 클라로 전달: routed==rx && drop==0 && downClientOf(s:a1)==dc0·downClientOf(s:a2)==dc1.
function gwroute(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const ENTER = (at, zoneId, avatar, from) => ({ at, from, op: { type: 'zoneEnter', zoneId, avatar } });
  const MOVE = (at, zoneId, avatar, dx, dy, from) => ({ at, from, op: { type: 'zoneMove', zoneId, avatar, dx, dy } });
  const OPS = [PLACE(1, 'z1', 'hostA')];
  const ENT = [ENTER(3, 'z1', 'a1', 'dc0'), ENTER(4, 'z1', 'a2', 'dc1'), MOVE(6, 'z1', 'a1', 1, 1, 'dc0'), MOVE(8, 'z1', 'a2', 1, 0, 'dc1')];
  const BASE = { clients: 6, moves: 24, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneEntityFlow: true, zoneHostHandle: true, zoneHostMailbox: true, gatewayZoneDir: true, gatewayDirectZone: true, zoneHostProc: true, zoneEgress: true };
  console.log('== gwroute (0334·#9 후속): 게이트웨이가 zoneView 를 바인딩된 클라로 전달. routed==rx && drop0 && 세션→클라 바인딩. ==');
  console.log('seed   | rx | routed | drop | a1→ | a2→ | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 16, ...BASE, placementOps: OPS, entityOps: ENT });
    const g = r.gateway;
    const rx = g.gatewayDownstreamCount(), routed = g.gatewayRoutedCount(), drop = g.gatewayDroppedCount();
    const b1 = g.downClientOf('s:a1'), b2 = g.downClientOf('s:a2');
    const ok = check(rx > 0 && routed === rx && drop === 0 && b1 === 'dc0' && b2 === 'dc1',
      `seed ${seed}: rx ${rx} routed ${routed} drop ${drop} b1 ${b1} b2 ${b2}`);
    console.log(`${pad(seed, 6)} | ${pad(rx, 2)} | ${pad(routed, 6)} | ${pad(drop, 4)} | ${pad(b1 || '-', 3)} | ${pad(b2 || '-', 3)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['gwroute'] = gwroute;
kit.ORDER.splice(1, 0, 'gwroute');

(async () => { process.exit(await kit.cli(process.argv)); })();
