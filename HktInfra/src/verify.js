// HktInfra step-0347 — 헤드리스 검증 (#9 후속: 게이트웨이 수신 버퍼 유계화 — 다운스트림 메모리 상한)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `dcwindow`.
//   더한 한 조각: 게이트웨이 세션별 수신 버퍼(zoneViewIn) 유계 창 K(downRecvWindow). 전달 후 frame 은 클라가 보유하므로 최근 K 만 보관 → per-세션 O(K) 상한(버스 seenBound 0042·수신함 유계 0099 의 다운스트림 판). K=0 무계.
//   검증: ⒜ `reg`(키트·downRecvWindow 0→무계·비트 동일). ⒝ `dcwindow` — K=2 면 수신 buf peak ≤ 2(유계)·클라 수렴은 그대로(desync 0·버퍼는 게이트웨이 회계일 뿐 전달 무영향).
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { run } = NET;

// step-0347 #9 후속 — 게이트웨이 수신 버퍼 유계화. a1@dc0 여러 번 이동(여러 frame) + downRecvWindow=2 → 세션 수신 buf 최근 2 만 보관.
//   downRecvPeak ≤ 2(유계·무계면 frame 수만큼)·클라 수렴 그대로(dc0.seenSig == zoneAuthSig·버퍼 유계가 전달/수렴 무영향).
function dcwindow(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const ENTER = (at, zoneId, avatar, from) => ({ at, from, op: { type: 'zoneEnter', zoneId, avatar } });
  const MOVE = (at, zoneId, avatar, dx, dy, from) => ({ at, from, op: { type: 'zoneMove', zoneId, avatar, dx, dy } });
  const OPS = [PLACE(1, 'z1', 'hostA')];
  const ENT = [ENTER(2, 'z1', 'a1', 'dc0')];
  for (let k = 0; k < 6; k++) ENT.push(MOVE(4 + k, 'z1', 'a1', 1, 0, 'dc0'));   // 6 이동 → 여러 view_delta frame.
  const BASE = { clients: 6, moves: 24, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneEntityFlow: true, zoneHostHandle: true, zoneHostMailbox: true, gatewayZoneDir: true, gatewayDirectZone: true, zoneHostProc: true, zoneEgress: true, downClients: 2, downRecvWindow: 2 };
  console.log('== dcwindow (0347·#9 후속): 게이트웨이 수신 버퍼 유계화. peak ≤ K(=2)·클라 수렴 그대로(desync 0). ==');
  console.log('seed   | rx | peak | buf(s:a1) | conv | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 18, ...BASE, placementOps: OPS, entityOps: ENT });
    const o = r.orch, g = r.gateway, dc0 = r.downclients[0];
    const rx = g.gatewayDownstreamCount(), peak = g.downRecvPeak, buf = g.gatewayViewsFor('s:a1');
    const conv = dc0.convergedTo(o.zoneAuthSig('z1', 'a1'));
    const ok = check(rx > 2 && peak <= 2 && buf <= 2 && conv, `seed ${seed}: rx ${rx} peak ${peak} buf ${buf} conv ${conv}`);
    console.log(`${pad(seed, 6)} | ${pad(rx, 2)} | ${pad(peak, 4)} | ${pad(buf, 9)} | ${pad(conv ? 'Y' : 'N', 4)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['dcwindow'] = dcwindow;
kit.ORDER.splice(1, 0, 'dcwindow');

(async () => { process.exit(await kit.cli(process.argv)); })();
