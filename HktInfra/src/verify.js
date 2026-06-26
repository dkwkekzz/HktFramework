// HktInfra step-0302 — 헤드리스 검증 (#9 잔여: 실 host.js 물리 분리 2 — host 자기 inbox 수신 + 자기 루프 tick)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `zonehostrecv`.
//   더한 한 조각: _zoneDeliver 가 frame 을 host 컨테이너 inbox(zoneId 태깅)에 enqueue(per-runtime mbox 대체)·_tickRuntimes 가 host 단위로 자기 inbox drain 후 자기 소유 존만 tick. OFF→0301 비트 동일(reg).
//   검증: ⒜ `reg`(키트·OFF 비트 동일). ⒝ `zonehostrecv`(가설) — 혼합 lifecycle 의 전 entity frame 이 host inbox 를 거쳐(recv==drain·잔류0) 적용된 뒤 데이터 평면 보존(directFlowCoherent·total1·ledger) + host 컨테이너==running.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { run } = NET;

function hostContainerMatchesRunning(o) {
  for (const [z, h] of o.running) if (o.zoneHostOf(z) !== h) return false;
  let n = 0; for (const host of o.zoneHostHosts()) n += o.hostRuntimeCount(host);
  return n === o.running.size;
}

// step-0302 #9 잔여 검증 — entity 데이터 평면이 *host 프로세스 inbox 경유*(자기 수신 버퍼→자기 루프 drain·tick)로 흘러도 보존·정합.
//   0300 혼합 lifecycle 을 zoneHostProc ON 으로: 전 entity frame(enter5+move1+leave1=7)이 host inbox 에 수신되어(recv) 같은 수만큼 drain(잔류 0·무손실) + directFlowCoherent·total1·ledger 5/1/2/1 + host 컨테이너==running.
function zonehostrecv(seeds) {
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
    DOWN(15, 'hostC', HS), STOP(16, 'z2'), MIG(17, 'z1', 'hostB'), REBAL(18, HS), DRAIN(19, 'hostA', HS)];
  const ENTOPS = [ENTER(5, 'z1', 'a1'), ENTER(6, 'z1', 'a2'), ENTER(7, 'z2', 'a3'), ENTER(8, 'z3', 'a4'), ENTER(9, 'z3', 'a5'),
    MOVE(10, 'z1', 'a1', 2, 1), LEAVE(11, 'z1', 'a2')];
  const BASE = { clients: 6, moves: 24, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneEntityFlow: true, zoneHostHandle: true, zoneHostMailbox: true, gatewayZoneDir: true, gatewayDirectZone: true, zoneHostProc: true, placementOps: PLACEOPS, entityOps: ENTOPS };
  console.log('== zonehostrecv (0302·#9 잔여 2): host 자기 inbox 수신 + 자기 루프 drain·tick. 전 entity frame 이 host inbox 경유(recv==drain·잔류0) 적용 후 directFlowCoherent·total1·ledger5/1/2/1 + host컨테이너==running. ==');
  console.log('seed   | recv | drain | r==d | dflow | total | ledger        | hc== | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 24, ...BASE });
    const o = r.orch;
    const ledger = `${o.zoneEnters}/${o.zoneLeaves}/${o.zoneEntitiesLost}/${o.zoneEntitiesDiscarded}`;
    const match = hostContainerMatchesRunning(o);
    const rd = o.zoneHostFramesRecv === o.zoneHostDrained;
    const ok = check(o.zoneHostFramesRecv === 7 && rd && o.directFlowCoherent() && o.entityConserved() && o.totalEntities() === 1 &&
      o.zoneEnters === 5 && o.zoneLeaves === 1 && o.zoneEntitiesLost === 2 && o.zoneEntitiesDiscarded === 1 && match,
      `seed ${seed}: host inbox 위반 (recv ${o.zoneHostFramesRecv}·drain ${o.zoneHostDrained}·dflow ${o.directFlowCoherent()}·total ${o.totalEntities()}·ledger ${ledger}·hc ${match})`);
    console.log(`${pad(seed, 6)} | ${pad(o.zoneHostFramesRecv, 4)} | ${pad(o.zoneHostDrained, 5)} | ${pad(rd ? 'Y' : 'N', 4)} | ${pad(o.directFlowCoherent() ? 'Y' : 'N', 5)} | ${pad(o.totalEntities(), 5)} | ${pad(ledger, 13)} | ${pad(match ? 'Y' : 'N', 4)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['zonehostrecv'] = zonehostrecv;
kit.ORDER.splice(1, 0, 'zonehostrecv');

(async () => { process.exit(await kit.cli(process.argv)); })();
