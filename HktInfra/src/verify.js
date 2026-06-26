// HktInfra step-0339 — 헤드리스 검증 (#9 후속: 다운스트림 leave 정리 — stale 바인딩/버퍼 회수)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `gwleave`.
//   더한 한 조각: leave 시 게이트웨이가 다운스트림 세션 상태(downClients/seq/resync/buffer) 정리(_downCleanup) + orch 가 egress 상태(buf/seq/acked) 정리(_bridgeLeave). 0334 한계(stale 바인딩 누적) 해소.
//   검증: ⒜ `reg`(키트·egress OFF→정리 맵 빈 채·비트 동일). ⒝ `gwleave` — a1 leave 후 게이트웨이 downClientOf(s:a1)==null·orch egress 버퍼 0·a2 는 그대로(영향 격리).
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { run } = NET;

// step-0339 #9 후속 — leave 정리. a1·a2 enter+이동 → a1 leave → 게이트웨이/orch 가 a1 의 다운스트림 상태 정리·a2 는 보존.
//   leave 후: downClientOf(s:a1)==null·orch zoneEgressBufLen(s:a1)==0·cleaned≥1 && a2 보존(downClientOf(s:a2)==dc1).
function gwleave(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const ENTER = (at, zoneId, avatar, from) => ({ at, from, op: { type: 'zoneEnter', zoneId, avatar } });
  const MOVE = (at, zoneId, avatar, dx, dy, from) => ({ at, from, op: { type: 'zoneMove', zoneId, avatar, dx, dy } });
  const LEAVE = (at, zoneId, avatar, from) => ({ at, from, op: { type: 'zoneLeave', zoneId, avatar } });
  const OPS = [PLACE(1, 'z1', 'hostA')];
  const ENT = [ENTER(2, 'z1', 'a1', 'dc0'), ENTER(3, 'z1', 'a2', 'dc1'), MOVE(5, 'z1', 'a1', 1, 1, 'dc0'), MOVE(6, 'z1', 'a2', 1, 0, 'dc1'), LEAVE(9, 'z1', 'a1', 'dc0')];
  const BASE = { clients: 6, moves: 24, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneEntityFlow: true, zoneHostHandle: true, zoneHostMailbox: true, gatewayZoneDir: true, gatewayDirectZone: true, zoneHostProc: true, zoneEgress: true };
  console.log('== gwleave (0339·#9 후속): a1 leave 후 다운스트림 상태 정리·a2 보존. b1==null·buf1==0·cleaned≥1·b2==dc1. ==');
  console.log('seed   | cleaned | b1 | buf1 | b2 | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 16, ...BASE, placementOps: OPS, entityOps: ENT });
    const o = r.orch, g = r.gateway;
    const cleaned = g.gatewayCleanedCount();
    const b1 = g.downClientOf('s:a1'), buf1 = o.zoneEgressBufLen('s:a1'), b2 = g.downClientOf('s:a2');
    const ok = check(cleaned >= 1 && b1 === null && buf1 === 0 && b2 === 'dc1',
      `seed ${seed}: cleaned ${cleaned} b1 ${b1} buf1 ${buf1} b2 ${b2}`);
    console.log(`${pad(seed, 6)} | ${pad(cleaned, 7)} | ${pad(b1 || '-', 2)} | ${pad(buf1, 4)} | ${pad(b2 || '-', 2)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['gwleave'] = gwleave;
kit.ORDER.splice(1, 0, 'gwleave');

(async () => { process.exit(await kit.cli(process.argv)); })();
