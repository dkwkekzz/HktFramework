// HktInfra step-0292 — 헤드리스 검증 (#9 멀티프로세스 배선 2: 존 host mailbox)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `zonembox`.
//   더한 한 조각: zoneHostMailbox — _zoneDeliver 가 frame 을 즉시 적용 대신 핸들 mbox 큐에 enqueue, _tickRuntimes 가 onTick 전 일괄 drain(소켓 수신 버퍼+host.js per-tick deliver 배치 씨앗). OFF→0291 비트 동일(reg).
//   검증: ⒜ `reg`(키트·OFF 비트 동일). ⒝ `zonembox`(가설) — 비동기 수신(큐 경유) 후에도 entityFlowCoherent·entityConserved 불변 + 큐 잔류 0(drained==delivered)·큐 깊이≥1(실제 큐 경유 증거).
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { run } = NET;

// step-0292 #9 멀티프로세스 배선 2 검증 — entity 데이터 평면이 비동기 mailbox(수신 버퍼 큐)를 거쳐도 불변 보존 + 큐 무손실.
//   0291 zonehandle 의 혼합 lifecycle 에 zoneHostMailbox: true 추가 — enter/move/leave frame 이 즉시 적용 대신 큐에 쌓였다 onTick 경계에서 일괄 drain.
//   → entityFlowCoherent·entityConserved·total 1 유지 + framesDrained == framesDelivered(잔류 0)·queueMax≥1(실제 큐 경유). #9 2(소켓 수신 버퍼+host.js per-tick deliver 배치의 씨앗).
function zonembox(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const ENTER = (at, zoneId, avatar) => ({ at, op: { type: 'zoneEnter', zoneId, avatar } });
  const MOVE = (at, zoneId, avatar, dx, dy) => ({ at, op: { type: 'zoneMove', zoneId, avatar, dx, dy } });
  const LEAVE = (at, zoneId, avatar) => ({ at, op: { type: 'zoneLeave', zoneId, avatar } });
  const MIG = (at, zoneId, toHost) => ({ at, op: { type: 'placeMigrate', zoneId, toHost } });
  const REBAL = (at, hosts) => ({ at, op: { type: 'placeRebalance', hosts } });
  const DRAIN = (at, host, hosts) => ({ at, op: { type: 'placeDrain', host, hosts } });
  const DOWN = (at, host, hosts) => ({ at, op: { type: 'placeHostDown', host, hosts } });
  const STOP = (at, zoneId) => ({ at, op: { type: 'placeStop', zoneId } });
  const HS = ['hostA', 'hostB', 'hostC'];
  const PLACEOPS = [PLACE(1, 'z1', 'hostA'), PLACE(2, 'z2', 'hostB'), PLACE(3, 'z3', 'hostC'),
    DOWN(12, 'hostC', HS), STOP(13, 'z2'), MIG(14, 'z1', 'hostB'), REBAL(15, HS), DRAIN(16, 'hostA', HS)];
  const ENTOPS = [ENTER(4, 'z1', 'a1'), ENTER(5, 'z1', 'a2'), ENTER(6, 'z2', 'a3'), ENTER(7, 'z3', 'a4'), ENTER(8, 'z3', 'a5'),
    MOVE(9, 'z1', 'a1', 2, 1), LEAVE(10, 'z1', 'a2')];
  const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneEntityFlow: true, zoneHostHandle: true, zoneHostMailbox: true, placementOps: PLACEOPS, entityOps: ENTOPS };
  console.log('== zonembox (0292·#9 2): 존 host mailbox. 혼합 lifecycle 의 enter/move/leave 가 비동기 큐(수신 버퍼)를 거쳐 onTick drain 돼도 entityFlowCoherent·entityConserved·total1 불변. drained==delivered(잔류0)·queueMax≥1(큐 경유 증거). ==');
  console.log('seed   | flow | consv | total | deliv | drain | qmax | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 20, ...BASE });
    const o = r.orch;
    const ok = check(o.entityFlowCoherent() && o.entityConserved() && o.entitiesSingleOwner() && o.totalEntities() === 1 &&
      o.zoneFramesDrained === o.zoneFramesDelivered && o.zoneFrameQueueMax >= 1,
      `seed ${seed}: mailbox 위반 (flow ${o.entityFlowCoherent()}·consv ${o.entityConserved()}·drain ${o.zoneFramesDrained}!=${o.zoneFramesDelivered}·qmax ${o.zoneFrameQueueMax})`);
    console.log(`${pad(seed, 6)} | ${pad(o.entityFlowCoherent() ? 'Y' : 'N', 4)} | ${pad(o.entityConserved() ? 'Y' : 'N', 5)} | ${pad(o.totalEntities(), 5)} | ${pad(o.zoneFramesDelivered, 5)} | ${pad(o.zoneFramesDrained, 5)} | ${pad(o.zoneFrameQueueMax, 4)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['zonembox'] = zonembox;
kit.ORDER.splice(1, 0, 'zonembox');

(async () => { process.exit(await kit.cli(process.argv)); })();
