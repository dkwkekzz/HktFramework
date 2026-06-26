// HktInfra step-0341 — 헤드리스 검증 (#9 후속 capstone: 다운스트림 전파 전 정합 downstreamDeliverCoherent)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `downdeliver`.
//   더한 한 조각: 정착 술어 downstreamSettled(모든 세션 egress 버퍼 0 = 산출 frame 전부 게이트웨이 도달·ack·재전송 복구 포함). capstone = 손실+혼합 lifecycle 뒤 정착 && 격리 && 활성 세션 delivered==produced && host 뷰 정합(0330).
//   검증: ⒜ `reg`(키트·비트 동일). ⒝ `downdeliver` — 손실(s:a1#1)+enter/move/leave/migrate 뒤 downstreamSettled·gatewayDeliveryIsolated·downSeqNext==egressSeq(활성)·downstreamCoherent(z1·z2). 전파 sub-arc 0331~0341 닫기.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { run } = NET;

// step-0341 #9 후속 capstone — 다운스트림 전파 전 정합. z1@A(a1·a2·dc0·dc1)·z2@C(b1·dc2)·z1 A→B migrate·a2 leave + s:a1#1 손실.
//   뒤: downstreamSettled(전부 도달·ack·복구)·gatewayDeliveryIsolated(교차 누수 0)·활성 세션(a1·b1) downSeqNext==egressSeq(무손실 인오더)·downstreamCoherent(z1·z2 host 뷰 0330). 전파 sub-arc 0331~0341 닫기.
function downdeliver(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const ENTER = (at, zoneId, avatar, from) => ({ at, from, op: { type: 'zoneEnter', zoneId, avatar } });
  const MOVE = (at, zoneId, avatar, dx, dy, from) => ({ at, from, op: { type: 'zoneMove', zoneId, avatar, dx, dy } });
  const LEAVE = (at, zoneId, avatar, from) => ({ at, from, op: { type: 'zoneLeave', zoneId, avatar } });
  const MIG = (at, zoneId, toHost) => ({ at, op: { type: 'placeMigrate', zoneId, toHost } });
  const OPS = [PLACE(1, 'z1', 'hostA'), PLACE(2, 'z2', 'hostC'), MIG(12, 'z1', 'hostB')];
  const ENT = [ENTER(3, 'z1', 'a1', 'dc0'), ENTER(4, 'z1', 'a2', 'dc1'), ENTER(5, 'z2', 'b1', 'dc2'),
    MOVE(7, 'z1', 'a1', 1, 1, 'dc0'), MOVE(8, 'z2', 'b1', 1, 0, 'dc2'), MOVE(9, 'z1', 'a1', 1, 0, 'dc0'),
    LEAVE(10, 'z1', 'a2', 'dc1'), MOVE(14, 'z1', 'a1', 0, 1, 'dc0'), MOVE(15, 'z2', 'b1', 0, 1, 'dc2')];
  const BASE = { clients: 6, moves: 24, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneEntityFlow: true, zoneHostHandle: true, zoneHostMailbox: true, gatewayZoneDir: true, gatewayDirectZone: true, zoneHostProc: true, zoneEgress: true, egressDrop: ['s:a1#1'], egressTimeout: 4 };
  console.log('== downdeliver (0341·#9 후속 capstone): 손실+혼합 lifecycle 뒤 전파 전 정합. settled·iso·delivered==produced·dcoh. sub-arc 0331~0341 닫기. ==');
  console.log('seed   | settled | iso | a1 d/p | b1 d/p | dc1 | dc2 | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 28, ...BASE, placementOps: OPS, entityOps: ENT });
    const o = r.orch, g = r.gateway;
    const settled = o.downstreamSettled(), iso = g.gatewayDeliveryIsolated();
    const a1d = g.gatewayDownSeqNext('s:a1'), a1p = o.zoneEgressSeq.get('s:a1') || 0;
    const b1d = g.gatewayDownSeqNext('s:b1'), b1p = o.zoneEgressSeq.get('s:b1') || 0;
    const dc1 = o.downstreamCoherent('z1'), dc2 = o.downstreamCoherent('z2');
    const ok = check(settled && iso && a1d === a1p && a1p > 1 && b1d === b1p && b1p > 0 && dc1 && dc2,
      `seed ${seed}: settled ${settled} iso ${iso} a1 ${a1d}/${a1p} b1 ${b1d}/${b1p} dc ${dc1}/${dc2}`);
    console.log(`${pad(seed, 6)} | ${pad(settled ? 'Y' : 'N', 7)} | ${pad(iso ? 'Y' : 'N', 3)} | ${pad(a1d + '/' + a1p, 6)} | ${pad(b1d + '/' + b1p, 6)} | ${pad(dc1 ? 'Y' : 'N', 3)} | ${pad(dc2 ? 'Y' : 'N', 3)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['downdeliver'] = downdeliver;
kit.ORDER.splice(1, 0, 'downdeliver');

(async () => { process.exit(await kit.cli(process.argv)); })();
