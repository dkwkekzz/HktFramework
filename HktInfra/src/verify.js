// HktInfra step-0336 — 헤드리스 검증 (#9 후속: 다운스트림 egress 버퍼 자기-크기조정 — 게이트웨이 ack 가지치기)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `gwack`.
//   더한 한 조각: orch 가 egress frame 을 세션별 미-ack 버퍼(zoneEgressBuf)에 보관 → 게이트웨이가 dseq ack → orch 가 ack 워터마크 이하 가지치기(자기-크기조정·재전송 소스). 버스 ack(0040) 의 다운스트림 판.
//   검증: ⒜ `reg`(키트·zoneEgress OFF→egress/ack 0·비트 동일). ⒝ `gwack` — 정상 흐름에 ack 가 흘러 세션 버퍼 0(전부 ack·가지침)·ack 워터마크 == 마지막 dseq·pruned == egressed.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { run } = NET;

// step-0336 #9 후속 — egress 버퍼 자기-크기조정. a1·a2 enter+이동 → orch egress 버퍼 적재 → 게이트웨이 ack → orch 가지치기.
//   정상 인오더 흐름엔 ack 가 다 흘러 세션 버퍼 0(전부 가지침)·pruned == egressed·ack 워터마크 == 마지막 dseq(= 그 세션 frame 수 −1).
function gwack(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const ENTER = (at, zoneId, avatar, from) => ({ at, from, op: { type: 'zoneEnter', zoneId, avatar } });
  const MOVE = (at, zoneId, avatar, dx, dy, from) => ({ at, from, op: { type: 'zoneMove', zoneId, avatar, dx, dy } });
  const OPS = [PLACE(1, 'z1', 'hostA')];
  const ENT = [ENTER(3, 'z1', 'a1', 'dc0'), ENTER(4, 'z1', 'a2', 'dc1'), MOVE(6, 'z1', 'a1', 1, 1, 'dc0'), MOVE(8, 'z1', 'a2', 1, 0, 'dc1')];
  const BASE = { clients: 6, moves: 24, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneEntityFlow: true, zoneHostHandle: true, zoneHostMailbox: true, gatewayZoneDir: true, gatewayDirectZone: true, zoneHostProc: true, zoneEgress: true };
  console.log('== gwack (0336·#9 후속): egress 버퍼 ack 자기-크기조정. 정상 흐름 세션 버퍼 0·pruned==egressed·ack wm==마지막 dseq. ==');
  console.log('seed   | egr | pruned | buf1 | buf2 | wm1 | wm2 | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 16, ...BASE, placementOps: OPS, entityOps: ENT });
    const o = r.orch;
    const egr = o.zoneEgressCount(), pr = o.zoneEgressPruned;
    const b1 = o.zoneEgressBufLen('s:a1'), b2 = o.zoneEgressBufLen('s:a2');
    const w1 = o.zoneEgressAckedOf('s:a1'), w2 = o.zoneEgressAckedOf('s:a2');
    const f1 = r.gateway.gatewayViewsFor('s:a1'), f2 = r.gateway.gatewayViewsFor('s:a2');
    const ok = check(egr > 0 && pr === egr && b1 === 0 && b2 === 0 && w1 === f1 - 1 && w2 === f2 - 1,
      `seed ${seed}: egr ${egr} pruned ${pr} buf ${b1}/${b2} wm ${w1}/${w2} (f ${f1}/${f2})`);
    console.log(`${pad(seed, 6)} | ${pad(egr, 3)} | ${pad(pr, 6)} | ${pad(b1, 4)} | ${pad(b2, 4)} | ${pad(w1, 3)} | ${pad(w2, 3)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['gwack'] = gwack;
kit.ORDER.splice(1, 0, 'gwack');

(async () => { process.exit(await kit.cli(process.argv)); })();
