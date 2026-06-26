// HktInfra step-0337 — 헤드리스 검증 (#9 후속: 다운스트림 재전송 — egress 손실을 resync 로 복구)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `gwloss`.
//   더한 한 조각: egress 전송 손실 주입(egressDrop) → 게이트웨이가 dseq gap 감지 → orch 에 zoneResync → orch 가 미-ack 버퍼에서 dseq≥from 재전송 → 게이트웨이 인오더 복귀(gap 닫힘). 인오더 게이팅(중복 드롭).
//   검증: ⒜ `reg`(키트·egressDrop 미설정·zoneEgress OFF→비트 동일). ⒝ `gwloss` — s:a1#1 드롭에도 resync>0·재전송>0·최종 downSeqNext(s:a1)==egressed(a1)(전부 인오더 복구·무손실).
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { run } = NET;

// step-0337 #9 후속 — 다운스트림 재전송 복구. a1 이 여러 번 이동(dseq 0,1,2,3…) 중 s:a1#1 을 전송 손실 → 게이트웨이가 dseq2 에서 gap 감지·resync→orch 재전송→복구.
//   resync>0(복구 발화)·zoneResent>0·zoneEgressDropped==1·최종 downSeqNext('s:a1')==그 세션 egressed(전부 인오더 복구·무손실)·downGaps>0(손실 감지됨).
function gwloss(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const ENTER = (at, zoneId, avatar, from) => ({ at, from, op: { type: 'zoneEnter', zoneId, avatar } });
  const MOVE = (at, zoneId, avatar, dx, dy, from) => ({ at, from, op: { type: 'zoneMove', zoneId, avatar, dx, dy } });
  const OPS = [PLACE(1, 'z1', 'hostA')];
  // a1 이 4번 이동 → reset(dseq0)+update*4 ≈ dseq 0..4. 이른 frame(dseq1)을 손실시켜 뒤 frame 이 gap 을 트리거하고, 뒤에 재전송 복구 여유(tick).
  const ENT = [ENTER(2, 'z1', 'a1', 'dc0'), MOVE(4, 'z1', 'a1', 1, 1, 'dc0'), MOVE(5, 'z1', 'a1', 1, 0, 'dc0'), MOVE(6, 'z1', 'a1', 0, 1, 'dc0'), MOVE(7, 'z1', 'a1', 1, 1, 'dc0')];
  const BASE = { clients: 6, moves: 24, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneEntityFlow: true, zoneHostHandle: true, zoneHostMailbox: true, gatewayZoneDir: true, gatewayDirectZone: true, zoneHostProc: true, zoneEgress: true, egressDrop: ['s:a1#1'] };
  console.log('== gwloss (0337·#9 후속): egress 손실 s:a1#1 → resync 재전송 복구. dropped1·resync>0·resent>0·downSeqNext==egressed(a1)·gap>0. ==');
  console.log('seed   | egrA1 | drop | gap | resync | resent | next | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 24, ...BASE, placementOps: OPS, entityOps: ENT });
    const o = r.orch, g = r.gateway;
    // a1 의 egress 수 = orch egress 시퀀스 다음값(부여한 dseq 수) = zoneEgressSeq('s:a1').
    const egrA1 = o.zoneEgressSeq.get('s:a1') || 0;
    const drop = o.zoneEgressDropped, resync = g.gatewayResyncsSent(), resent = o.zoneResent;
    const gap = g.gatewayDownGaps(), next = g.gatewayDownSeqNext('s:a1');
    const ok = check(drop === 1 && resync > 0 && resent > 0 && gap > 0 && next === egrA1 && egrA1 > 1,
      `seed ${seed}: egrA1 ${egrA1} drop ${drop} gap ${gap} resync ${resync} resent ${resent} next ${next}`);
    console.log(`${pad(seed, 6)} | ${pad(egrA1, 5)} | ${pad(drop, 4)} | ${pad(gap, 3)} | ${pad(resync, 6)} | ${pad(resent, 6)} | ${pad(next, 4)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['gwloss'] = gwloss;
kit.ORDER.splice(1, 0, 'gwloss');

(async () => { process.exit(await kit.cli(process.argv)); })();
