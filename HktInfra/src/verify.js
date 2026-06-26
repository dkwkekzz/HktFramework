// HktInfra step-0331 — 헤드리스 검증 (#9 후속: 다운스트림 egress — host 산출 뷰를 게이트웨이로 송출)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `egress`.
//   더한 한 조각: orch._drainZoneEgress — 런타임 존이 버퍼에 쌓은 새 view frame 을 매 tick 게이트웨이로 송출(zoneEgress·SPINE §4 경로2 존→게이트웨이 다운스트림 배선). per-rt 커서로 한 frame 1회.
//   검증: ⒜ `reg`(키트·OFF 비트 동일). ⒝ `egress` — enter/move 뒤 zoneEgressCount>0 && == zoneViewFrames(산출된 모든 뷰가 빠짐없이 송출·버퍼 잔류 0).
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { run } = NET;

// step-0331 #9 후속 — 다운스트림 egress. z1@A 에 a1·a2 enter + a1 이동 → 런타임 존이 산출한 view/view_delta frame 을 orch 가 매 tick 게이트웨이로 송출.
//   egressed>0(실제 송출 발생) && egressed == zoneViewFrames(버퍼에 쌓인 모든 뷰가 빠짐없이 송출됨·잔류 0 = 무손실 송출). 게이트웨이 라우팅(세션→클라)은 0332+.
function egress(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const ENTER = (at, zoneId, avatar) => ({ at, op: { type: 'zoneEnter', zoneId, avatar } });
  const MOVE = (at, zoneId, avatar, dx, dy) => ({ at, op: { type: 'zoneMove', zoneId, avatar, dx, dy } });
  const OPS = [PLACE(1, 'z1', 'hostA')];
  const ENT = [ENTER(3, 'z1', 'a1'), ENTER(4, 'z1', 'a2'), MOVE(6, 'z1', 'a1', 1, 1), MOVE(8, 'z1', 'a1', 1, 0)];
  const BASE = { clients: 6, moves: 24, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneEntityFlow: true, zoneHostHandle: true, zoneHostMailbox: true, gatewayZoneDir: true, gatewayDirectZone: true, zoneHostProc: true, zoneEgress: true };
  console.log('== egress (0331·#9 후속): host 산출 뷰를 게이트웨이로 송출. egressed>0 && egressed==zoneViewFrames(버퍼 잔류 0·무손실 송출). ==');
  console.log('seed   | egress | frames | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 16, ...BASE, placementOps: OPS, entityOps: ENT });
    const o = r.orch;
    const eg = o.zoneEgressCount(), fr = o.zoneViewFrames();
    const ok = check(eg > 0 && eg === fr, `seed ${seed}: egress ${eg} != frames ${fr} (또는 0)`);
    console.log(`${pad(seed, 6)} | ${pad(eg, 6)} | ${pad(fr, 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['egress'] = egress;
kit.ORDER.splice(1, 0, 'egress');

(async () => { process.exit(await kit.cli(process.argv)); })();
