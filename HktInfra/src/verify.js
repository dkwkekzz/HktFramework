// HktInfra step-0335 — 헤드리스 검증 (#9 후속: 다운스트림 per-세션 시퀀스 — egress dseq·순서/유실 추적)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `gwseq`.
//   더한 한 조각: orch egress 가 frame 마다 세션별 단조 dseq 부여(zoneEgressSeq) → 게이트웨이가 per-세션 next 기대로 순서/유실 추적(downSeqNext·downSeqGaps). 클라 ack/재전송의 토대.
//   검증: ⒜ `reg`(키트·zoneEgress OFF→dseq 0·비트 동일). ⒝ `gwseq` — 인오더 전송에서 gap 0·세션별 next == 그 세션 수신 frame 수(0,1,..k 연속).
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { run } = NET;

// step-0335 #9 후속 — 다운스트림 per-세션 시퀀스. a1·a2 enter+이동 → egress frame 마다 세션별 단조 dseq → 게이트웨이가 순서 추적.
//   인오더 전송 → gap 0 && 세션별 next == 그 세션 수신 frame 수(dseq 0..k-1 연속). a1·a2 각 next==2.
function gwseq(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const ENTER = (at, zoneId, avatar, from) => ({ at, from, op: { type: 'zoneEnter', zoneId, avatar } });
  const MOVE = (at, zoneId, avatar, dx, dy, from) => ({ at, from, op: { type: 'zoneMove', zoneId, avatar, dx, dy } });
  const OPS = [PLACE(1, 'z1', 'hostA')];
  const ENT = [ENTER(3, 'z1', 'a1', 'dc0'), ENTER(4, 'z1', 'a2', 'dc1'), MOVE(6, 'z1', 'a1', 1, 1, 'dc0'), MOVE(8, 'z1', 'a2', 1, 0, 'dc1')];
  const BASE = { clients: 6, moves: 24, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneEntityFlow: true, zoneHostHandle: true, zoneHostMailbox: true, gatewayZoneDir: true, gatewayDirectZone: true, zoneHostProc: true, zoneEgress: true };
  console.log('== gwseq (0335·#9 후속): egress 세션별 단조 dseq → 게이트웨이 순서 추적. gap0 && 세션별 next==수신 frame 수. ==');
  console.log('seed   | rx | gap | a1next | a2next | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 16, ...BASE, placementOps: OPS, entityOps: ENT });
    const g = r.gateway;
    const rx = g.gatewayDownstreamCount(), gap = g.gatewayDownGaps();
    const n1 = g.gatewayDownSeqNext('s:a1'), n2 = g.gatewayDownSeqNext('s:a2');
    const ok = check(rx > 0 && gap === 0 && n1 === g.gatewayViewsFor('s:a1') && n2 === g.gatewayViewsFor('s:a2') && n1 > 0 && n2 > 0,
      `seed ${seed}: rx ${rx} gap ${gap} n1 ${n1}/${g.gatewayViewsFor('s:a1')} n2 ${n2}/${g.gatewayViewsFor('s:a2')}`);
    console.log(`${pad(seed, 6)} | ${pad(rx, 2)} | ${pad(gap, 3)} | ${pad(n1, 6)} | ${pad(n2, 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['gwseq'] = gwseq;
kit.ORDER.splice(1, 0, 'gwseq');

(async () => { process.exit(await kit.cli(process.argv)); })();
