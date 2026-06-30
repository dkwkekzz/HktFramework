// HktInfra step-0414 — 헤드리스 검증 (#62 코드 합류 4: runMultiViaCoord info 의 옛 runMulti clusterInfo parity)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `coordinfoparity`.
//   더한 한 조각: runMultiViaCoord 결과 info 에 옛 runMulti clusterInfo 전송/토폴로지 필드(pids·parentPid·port·ipcMsgs/Bytes·allSerializable·wire) 병합. 미부착→reg 0.
//   검증: ⒜ `reg`. ⒝ `coordinfoparity` — info 가 runMulti 키 집합 보유·pids≥2·ipcMsgs>0·parentPid==process.pid·allSerializable.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');
const { runMultiViaCoord } = require('./cluster-run.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { run, fnv1a } = NET;

const zoneSpecOf = (zone) => ({ addr: zone, kind: 'zone', seed: fnv1a(String(zone)) >>> 0, opts: { grid: 16, radius: 4, region: { lo: 0, hi: 16 }, sibling: null, boundary: 16, orch: null, incremental: true } });

// 공유 시나리오 빌더 — 2 host·3 zone(z1@A·z2@B·z3@A)·entity a1@z1·b1@z2 + move. #62 코디네이터 arc 공통.
function coordScenario() {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const ENTER = (at, zoneId, avatar, from) => ({ at, from, op: { type: 'zoneEnter', zoneId, avatar } });
  const MOVE = (at, zoneId, avatar, dx, dy, from) => ({ at, from, op: { type: 'zoneMove', zoneId, avatar, dx, dy } });
  const OPS = [PLACE(1, 'z1', 'hostA'), PLACE(2, 'z2', 'hostB'), PLACE(3, 'z3', 'hostA')];
  const ENT = [ENTER(3, 'z1', 'a1', 'dc0'), ENTER(3, 'z2', 'b1', 'dc1')];
  for (let k = 0; k < 3; k++) { ENT.push(MOVE(4 + k, 'z1', 'a1', 1, 1, 'dc0')); ENT.push(MOVE(4 + k, 'z2', 'b1', 1, 0, 'dc1')); }
  return { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneEntityFlow: true, zoneHostHandle: true, zoneHostProc: true, gatewayZoneDir: true, gatewayDirectZone: true, clusterDriverReal: true, placementOps: OPS, entityOps: ENT };
}

// 옛 runMulti clusterInfo 반환 계약(cluster-run.js:227~)의 핵심 키 — 코디네이터 path 가 갖춰야 할 parity 집합.
const RUNMULTI_KEYS = ['livePids', 'hostIds', 'placement', 'epoch', 'presumedDead', 'migrations', 'reprovisions', 'pids', 'parentPid', 'port', 'ipcMsgs', 'ipcBytes', 'allSerializable', 'wire'];

// step-0414 #62 코드 합류 4 — coordinfoparity: runMultiViaCoord info 가 runMulti 키 집합 보유·pids≥2·ipcMsgs>0·parentPid==process.pid·allSerializable.
async function coordinfoparity(seeds) {
  console.log('== coordinfoparity (0414·#62 코드 합류 4): runMultiViaCoord info 가 옛 runMulti clusterInfo 키 보유·pids≥2·ipcMsgs>0·parentPid==self·allSerializable. ==');
  console.log('seed   | 키 완비 | pids | ipcMsgs | parentPid==self | serializable | 판정');
  const spec = { migrate: { zone: 'z3', from: 'hostA', to: 'hostB', at: 2 }, reprovision: { zone: 'z1', host: 'hostA_s', at: 3 } };
  for (const seed of seeds) {
    const res = await runMultiViaCoord({ seed, ticks: 12, coordTicks: 6, coordSc: spec, ...coordScenario() }, { run, zoneSpecOf });
    const info = res.info;
    const missing = RUNMULTI_KEYS.filter(k => !(k in info));
    const keysOk = missing.length === 0;
    const pidsOk = Array.isArray(info.pids) && info.pids.length >= 2;
    const ipcOk = info.ipcMsgs > 0;
    const ppOk = info.parentPid === process.pid;
    const serOk = info.allSerializable === true;
    const ok = check(keysOk && pidsOk && ipcOk && ppOk && serOk,
      `seed ${seed}: parity 위반 (missing ${JSON.stringify(missing)}·pids ${info.pids && info.pids.length}·ipc ${info.ipcMsgs}·pp ${ppOk}·ser ${serOk})`);
    console.log(`${pad(seed, 6)} | ${pad(keysOk ? 'Y' : 'N', 7)} | ${pad(info.pids ? info.pids.length : 0, 4)} | ${pad(info.ipcMsgs, 7)} | ${pad(ppOk ? 'Y' : 'N', 15)} | ${pad(serOk ? 'Y' : 'N', 12)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['coordinfoparity'] = coordinfoparity;
kit.ORDER.splice(1, 0, 'coordinfoparity');

(async () => { process.exit(await kit.cli(process.argv)); })();
