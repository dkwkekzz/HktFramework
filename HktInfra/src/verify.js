// HktInfra step-0357 — 헤드리스 검증 (#57 실 host.js OS 프로세스 spawn 7: ClusterHostDriver 명령 번역 + flush)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `hostcmd`.
//   더한 한 조각: ClusterHostDriver — orch 드라이버 이벤트(on*)를 cluster 명령(spawnOne/killHost/rpc init·deliver)으로 번역(동기 큐) + flush(cluster) 집행(async). clusterDriverReal ON→topo-run 주입. OFF→null·비트 동일.
//   검증: ⒜ `reg`(키트·드라이버 미부착·비트 동일). ⒝ `hostcmd` — z1@A·a1 enter+move 뒤 commands(spawnOne hostA·init z1·deliver×N·egress×M)·flush→mock cluster 가 spawnOne:hostA·init:hostA·deliver:hostA×N 수신.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { run } = NET;

// 동기 기록 mock cluster — flush 가 부르는 spawnOne/killHost/rpc 를 calls 에 적재(실 child_process/소켓 대역·검증용).
function mockCluster() {
  return {
    calls: [],
    async spawnOne(h) { this.calls.push('spawnOne:' + h); },
    async killHost(h) { this.calls.push('killHost:' + h); },
    async rpc(h, m) { this.calls.push(m.cmd + ':' + h + (m.zone ? '#' + m.zone : (m.zoneId ? '#' + m.zoneId : ''))); },
  };
}

// step-0357 #57 실 host.js OS 프로세스 spawn 7 — ClusterHostDriver. z1@hostA·a1 enter+이동: orch 이벤트→cluster 명령 번역 + flush→mock 집행.
async function hostcmd(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const ENTER = (at, zoneId, avatar, from) => ({ at, from, op: { type: 'zoneEnter', zoneId, avatar } });
  const MOVE = (at, zoneId, avatar, dx, dy, from) => ({ at, from, op: { type: 'zoneMove', zoneId, avatar, dx, dy } });
  const OPS = [PLACE(1, 'z1', 'hostA')];
  const ENT = [ENTER(3, 'z1', 'a1', 'dc0')];
  for (let k = 0; k < 6; k++) ENT.push(MOVE(4 + k, 'z1', 'a1', 1, 1, 'dc0'));
  const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneEntityFlow: true, zoneHostHandle: true, zoneHostProc: true, gatewayZoneDir: true, gatewayDirectZone: true, zoneEgress: true, downClients: 1, clusterDriverReal: true, placementOps: OPS, entityOps: ENT };
  console.log('== hostcmd (0357·#57): ClusterHostDriver — orch 이벤트→cluster 명령 번역 + flush→실 cluster 집행. ==');
  console.log('seed   | spawn | init | deliver | egress | mock spawnOne | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 14, ...BASE });
    const o = r.orch, drv = o.clusterDriver;
    const cmds = drv.commands;
    const nSpawn = cmds.filter(c => c.op === 'spawnOne').length;
    const nInit = cmds.filter(c => c.op === 'init').length;
    const nDeliver = cmds.filter(c => c.op === 'deliver').length;
    const nEgress = cmds.filter(c => c.op === 'egress').length;
    const transOk = nSpawn === 1 && cmds[0].op === 'spawnOne' && cmds[0].host === 'hostA' &&
      nInit === o.driverAssigns && nDeliver === o.driverFrames && nEgress === o.driverEgress && nDeliver > 0;
    // flush → mock cluster 집행
    const mc = mockCluster();
    const executed = await drv.flush(mc);
    const flushOk = executed === (nSpawn + nInit + nDeliver + nEgress) && drv.commands.length === 0 &&
      mc.calls.filter(x => x === 'spawnOne:hostA').length === 1 &&
      mc.calls.filter(x => x === 'init:hostA#z1').length === 1 &&
      mc.calls.filter(x => x === 'deliver:hostA#z1').length === nDeliver;
    const ok = check(transOk && flushOk, `seed ${seed}: cmd 위반 (spawn ${nSpawn}·init ${nInit}·deliver ${nDeliver}·exec ${executed}·calls ${mc.calls.length})`);
    console.log(`${pad(seed, 6)} | ${pad(nSpawn, 5)} | ${pad(nInit, 4)} | ${pad(nDeliver, 7)} | ${pad(nEgress, 6)} | ${pad(mc.calls.filter(x => x === 'spawnOne:hostA').length, 13)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['hostcmd'] = hostcmd;
kit.ORDER.splice(1, 0, 'hostcmd');

(async () => { process.exit(await kit.cli(process.argv)); })();
