// HktInfra step-0338 — 헤드리스 검증 (#9 후속: 다운스트림 타임아웃 재전송 — 마지막 frame 손실 복구)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `gwtimeout`.
//   더한 한 조각: orch 가 매 tick 미-ack egress 버퍼를 훑어 egressTimeout tick 경과한 frame 재전송(_retransmitStale). 게이트웨이 gap-resync(0337)는 *뒤 frame*이 트리거라 세션 *마지막* frame 손실은 못 잡는다 — 이 능동 재전송이 메운다.
//   검증: ⒜ `reg`(키트·egressTimeout 0·zoneEgress OFF→비트 동일). ⒝ `gwtimeout` — s:a1 의 *마지막* dseq3 손실(뒤 frame 없음→resync 0)에도 타임아웃 재전송으로 복구(downSeqNext==egressed).
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { run } = NET;

// step-0338 #9 후속 — 타임아웃 재전송. a1 enter+3이동 → dseq 0..3(마지막 3). s:a1#3(마지막) 손실 → 뒤 frame 없어 게이트웨이 gap-resync 못 함(resync 0).
//   orch 가 egressTimeout 후 ack 없는 dseq3 을 능동 재전송 → 복구: timeoutResent>0·resync 0(마지막 frame 확인)·downSeqNext('s:a1')==egrA1(전부 복구).
function gwtimeout(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const ENTER = (at, zoneId, avatar, from) => ({ at, from, op: { type: 'zoneEnter', zoneId, avatar } });
  const MOVE = (at, zoneId, avatar, dx, dy, from) => ({ at, from, op: { type: 'zoneMove', zoneId, avatar, dx, dy } });
  const OPS = [PLACE(1, 'z1', 'hostA')];
  const ENT = [ENTER(2, 'z1', 'a1', 'dc0'), MOVE(3, 'z1', 'a1', 1, 1, 'dc0'), MOVE(4, 'z1', 'a1', 1, 0, 'dc0'), MOVE(5, 'z1', 'a1', 0, 1, 'dc0')];
  const BASE = { clients: 6, moves: 24, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneEntityFlow: true, zoneHostHandle: true, zoneHostMailbox: true, gatewayZoneDir: true, gatewayDirectZone: true, zoneHostProc: true, zoneEgress: true, egressDrop: ['s:a1#3'], egressTimeout: 4 };
  console.log('== gwtimeout (0338·#9 후속): 마지막 frame(s:a1#3) 손실 → resync 못 함(0)·타임아웃 재전송으로 복구. timeoutResent>0·downSeqNext==egrA1. ==');
  console.log('seed   | egrA1 | drop | resync | toResent | next | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 24, ...BASE, placementOps: OPS, entityOps: ENT });
    const o = r.orch, g = r.gateway;
    const egrA1 = o.zoneEgressSeq.get('s:a1') || 0;
    const drop = o.zoneEgressDropped, resync = g.gatewayResyncsSent(), tor = o.zoneEgressTimeoutResent;
    const next = g.gatewayDownSeqNext('s:a1');
    const ok = check(drop === 1 && resync === 0 && tor > 0 && next === egrA1 && egrA1 === 4,
      `seed ${seed}: egrA1 ${egrA1} drop ${drop} resync ${resync} toResent ${tor} next ${next}`);
    console.log(`${pad(seed, 6)} | ${pad(egrA1, 5)} | ${pad(drop, 4)} | ${pad(resync, 6)} | ${pad(tor, 8)} | ${pad(next, 4)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['gwtimeout'] = gwtimeout;
kit.ORDER.splice(1, 0, 'gwtimeout');

(async () => { process.exit(await kit.cli(process.argv)); })();
