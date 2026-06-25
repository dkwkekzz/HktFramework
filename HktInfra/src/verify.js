// HktInfra step-0291 — 헤드리스 검증 (#9 멀티프로세스 배선 1: 존 런타임 전송 seam)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `zonehandle`.
//   더한 한 조각: _zoneDeliver 전송 seam — 브리지 enter/move/leave 가 실 EntityZone 핸들에 직접 onMsg 하던 것을, zoneHostHandle ON 시 JSON 직렬화 경계(소켓 와이어 씨앗)로 round-trip. OFF→0290 비트 동일(reg).
//   검증: ⒜ `reg`(키트·OFF 비트 동일). ⒝ `zonehandle`(가설) — 전 데이터 평면이 직렬화 seam 을 통과해도 entityFlowCoherent·entityConserved 불변 + frame 건수/바이트 계측.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { run } = NET;

// step-0291 #9 멀티프로세스 배선 1 검증 — entity 데이터 평면이 직렬화 전송 seam(_zoneDeliver)을 통과해도 불변 보존 + 와이어 계측.
//   0290 zoneflowcap 과 같은 혼합 lifecycle 에 zoneHostHandle: true 만 추가 — enter/move/leave frame 이 JSON round-trip 을 타고도 entityFlowCoherent·entityConserved·단일 소유 유지.
//   → framesDelivered == enters+moves+leaves(소실 0)·frameBytes>0(실제 와이어를 탔다는 증거). #9 arc 시작(브리지 핸들→실 host.js 소켓의 첫 조각: 직렬화 경계).
function zonehandle(seeds) {
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
  const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneEntityFlow: true, zoneHostHandle: true, placementOps: PLACEOPS, entityOps: ENTOPS };
  console.log('== zonehandle (0291·#9 1): 존 런타임 전송 seam. 혼합 lifecycle 의 enter/move/leave 가 _zoneDeliver JSON 직렬화 경계를 round-trip 해도 entityFlowCoherent·entityConserved·단일 소유 불변. frames==enters+moves+leaves·bytes>0(와이어 증거). ==');
  console.log('seed   | flow | consv | total | frames | bytes | E/M/L | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 20, ...BASE });
    const o = r.orch;
    const eml = `${o.zoneEnters}/${o.zoneMoves}/${o.zoneLeaves}`;
    const expectFrames = o.zoneEnters + o.zoneMoves + o.zoneLeaves;
    const ok = check(o.entityFlowCoherent() && o.entityConserved() && o.entitiesSingleOwner() && o.totalEntities() === 1 &&
      o.zoneFramesDelivered === expectFrames && o.zoneFrameBytes > 0,
      `seed ${seed}: seam 위반 (flow ${o.entityFlowCoherent()}·consv ${o.entityConserved()}·frames ${o.zoneFramesDelivered}!=${expectFrames}·bytes ${o.zoneFrameBytes})`);
    console.log(`${pad(seed, 6)} | ${pad(o.entityFlowCoherent() ? 'Y' : 'N', 4)} | ${pad(o.entityConserved() ? 'Y' : 'N', 5)} | ${pad(o.totalEntities(), 5)} | ${pad(o.zoneFramesDelivered, 6)} | ${pad(o.zoneFrameBytes, 5)} | ${pad(eml, 5)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['zonehandle'] = zonehandle;
kit.ORDER.splice(1, 0, 'zonehandle');

(async () => { process.exit(await kit.cli(process.argv)); })();
