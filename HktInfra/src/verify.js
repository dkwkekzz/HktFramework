// HktInfra step-0355 — 헤드리스 검증 (#57 실 host.js OS 프로세스 spawn 5: clusterDriver onFrame entity frame egress)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `hostframe`.
//   더한 한 조각: _zoneDeliver 의 host 컨테이너 inbox enqueue 마다 clusterDriver.onFrame(host,zoneId) — 실 cluster.rpc(host,{cmd:'deliver'}) 소켓 송신의 씨앗. OFF→호출 0·비트 동일.
//   검증: ⒜ `reg`(키트·드라이버 미부착·비트 동일). ⒝ `hostframe` — z1@A·a1 enter+move 뒤 driverFrames==zoneHostFramesRecv>0·모든 frame host==hostA.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { run } = NET;

// step-0355 #57 실 host.js OS 프로세스 spawn 5 — entity frame egress to driver. z1@hostA·a1 enter+이동 → host inbox enqueue 마다 onFrame.
//   driverFrames==zoneHostFramesRecv>0(모든 inbox 수신이 드라이버로 흘렀다)·모든 frame host==hostA(단일 존 단일 host).
function hostframe(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const ENTER = (at, zoneId, avatar, from) => ({ at, from, op: { type: 'zoneEnter', zoneId, avatar } });
  const MOVE = (at, zoneId, avatar, dx, dy, from) => ({ at, from, op: { type: 'zoneMove', zoneId, avatar, dx, dy } });
  const OPS = [PLACE(1, 'z1', 'hostA')];
  const ENT = [ENTER(3, 'z1', 'a1', 'dc0')];
  for (let k = 0; k < 6; k++) ENT.push(MOVE(4 + k, 'z1', 'a1', 1, 1, 'dc0'));
  const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneEntityFlow: true, zoneHostHandle: true, zoneHostProc: true, gatewayZoneDir: true, gatewayDirectZone: true, clusterDriverRecord: true, placementOps: OPS, entityOps: ENT };
  console.log('== hostframe (0355·#57): clusterDriver onFrame — host inbox enqueue=실 cluster.rpc deliver 소켓 송신 씨앗. ==');
  console.log('seed   | recv | driverF | allA | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 14, ...BASE });
    const o = r.orch, drv = o.clusterDriver;
    const allA = drv.frames.length > 0 && drv.frames.every(x => x.startsWith('hostA:'));
    const eqOk = o.driverFrames === o.zoneHostFramesRecv && o.driverFrames === drv.frames.length && o.driverFrames > 0;
    const ok = check(eqOk && allA, `seed ${seed}: frame 위반 (driverFrames ${o.driverFrames}·recv ${o.zoneHostFramesRecv}·allA ${allA})`);
    console.log(`${pad(seed, 6)} | ${pad(o.zoneHostFramesRecv, 4)} | ${pad(o.driverFrames, 7)} | ${pad(allA ? 'Y' : 'N', 4)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['hostframe'] = hostframe;
kit.ORDER.splice(1, 0, 'hostframe');

(async () => { process.exit(await kit.cli(process.argv)); })();
