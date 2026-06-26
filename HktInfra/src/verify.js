// HktInfra step-0327 — 헤드리스 검증 (#9 후속: host 이주 중 다운스트림 뷰 연속성)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `hostzonemigrateview`.
//   더한 한 조각: 질의 zoneViewReport(다운스트림 요약 {frames,bytes,sessions,serializable}). 존이 host 이주해도(같은 핸들) 뷰 산출이 끊기지 않는지(연속성) 검증(읽기 전용).
//   검증: ⒜ `reg`(키트·OFF 비트 동일). ⒝ `hostzonemigrateview`(가설) — z1 이 A→B 이주·a1 이동(이주 전후) → update 4 연속·entity 보존·host B·report serializable.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { run } = NET;

// step-0327 #9 후속 검증 — host 이주 중 다운스트림 뷰 연속성(zoneViewReport). z1@A 에 a1 enter·2회 이동(이주 전) → placeMigrate z1 A→B(같은 EntityZone 핸들·상태 보존) → a1 2회 이동(이주 후).
//   이주는 같은 핸들이므로 a1·세션·prevSeen 이 보존돼 뷰 산출이 *끊기지 않는다*: reset 1 + update 4(이주 전 2 + 후 2)·entity 1 보존·런타임 host B·pos (9,9)·report 직렬화 가능. host 이주가 다운스트림을 깨지 않음.
function hostzonemigrateview(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const ENTER = (at, zoneId, avatar) => ({ at, op: { type: 'zoneEnter', zoneId, avatar } });
  const MOVE = (at, zoneId, avatar, dx, dy) => ({ at, op: { type: 'zoneMove', zoneId, avatar, dx, dy } });
  const MIG = (at, zoneId, toHost) => ({ at, op: { type: 'placeMigrate', zoneId, toHost } });
  const OPS = [PLACE(1, 'z1', 'hostA'), MIG(8, 'z1', 'hostB')];
  const ENT = [ENTER(3, 'z1', 'a1'), MOVE(5, 'z1', 'a1', 1, 1), MOVE(6, 'z1', 'a1', 1, 1), MOVE(10, 'z1', 'a1', 1, 1), MOVE(11, 'z1', 'a1', 1, 1)];
  const BASE = { clients: 6, moves: 24, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneEntityFlow: true, zoneHostHandle: true, zoneHostMailbox: true, gatewayZoneDir: true, gatewayDirectZone: true, zoneHostProc: true };
  console.log('== hostzonemigrateview (0327·#9 후속): host 이주 중 다운스트림 뷰 연속성. z1 A→B 이주·a1 이동(전후) → update 4 연속·entity 보존·host B·report serializable. ==');
  console.log('seed   | update | total | host | pos | serializ | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 16, ...BASE, placementOps: OPS, entityOps: ENT });
    const o = r.orch;
    const st = o.zoneViewStats('z1', 's:a1');
    const rep = o.zoneViewReport('z1');
    const pos = o.zoneEntityPos('z1', 'a1');
    const posOk = pos && pos.x === 9 && pos.y === 9;
    const ok = check(st.updates === 4 && st.resets === 1 && o.totalEntities() === 1 && o.zoneRuntimeHostOf('z1') === 'hostB' && posOk && rep.serializable && rep.frames === 5,
      `seed ${seed}: 이주 연속성 위반 (update ${st.updates}·total ${o.totalEntities()}·host ${o.zoneRuntimeHostOf('z1')}·pos ${JSON.stringify(pos)}·frames ${rep.frames})`);
    console.log(`${pad(seed, 6)} | ${pad(st.updates, 6)} | ${pad(o.totalEntities(), 5)} | ${pad(o.zoneRuntimeHostOf('z1'), 5)} | ${pad(posOk ? '9,9' : 'x', 3)} | ${pad(rep.serializable ? 'Y' : 'N', 8)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['hostzonemigrateview'] = hostzonemigrateview;
kit.ORDER.splice(1, 0, 'hostzonemigrateview');

(async () => { process.exit(await kit.cli(process.argv)); })();
