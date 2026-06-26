// HktInfra step-0325 — 헤드리스 검증 (#9 후속: host 산출 뷰의 직렬화 경계 — 와이어 준비)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `hostzoneviewwire`.
//   더한 한 조각: 질의 zoneViewWire(산출 뷰 {frames, bytes, serializable}). 다운스트림 뷰가 실 소켓(host→게이트웨이→클라)을 탈 준비(JSON round-trip 동일)인지 검증(_zoneDeliver 0291 의 다운스트림 짝·읽기 전용).
//   검증: ⒜ `reg`(키트·OFF 비트 동일). ⒝ `hostzoneviewwire`(가설) — 산출 뷰 전부 직렬화 가능·와이어 바이트 > 0·frames == zoneViewFrames.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { run } = NET;

// step-0325 #9 후속 검증 — host 산출 뷰의 직렬화 경계(zoneViewWire). z1 에 a1·a2 enter·a1 이동 → 산출된 view_delta frame 들이 모두 JSON round-trip 동일(직렬화 가능)하고 와이어 바이트 > 0.
//   다운스트림 뷰가 실 소켓(host→게이트웨이→클라)을 탈 준비가 됐다는 증거 — 함수/순환 참조 0(원격-검증 토대). _zoneDeliver(0291·업스트림 직렬화 경계)의 다운스트림 짝.
function hostzoneviewwire(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const ENTER = (at, zoneId, avatar) => ({ at, op: { type: 'zoneEnter', zoneId, avatar } });
  const MOVE = (at, zoneId, avatar, dx, dy) => ({ at, op: { type: 'zoneMove', zoneId, avatar, dx, dy } });
  const OPS = [PLACE(1, 'z1', 'hostA')];
  const ENT = [ENTER(3, 'z1', 'a1'), ENTER(4, 'z1', 'a2'), MOVE(6, 'z1', 'a1', 1, 1), MOVE(7, 'z1', 'a1', 1, 1)];
  const BASE = { clients: 6, moves: 24, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneEntityFlow: true, zoneHostHandle: true, zoneHostMailbox: true, gatewayZoneDir: true, gatewayDirectZone: true, zoneHostProc: true };
  console.log('== hostzoneviewwire (0325·#9 후속): host 산출 뷰의 직렬화 경계. 산출 뷰 전부 JSON round-trip 동일·와이어 바이트>0·소켓 준비. ==');
  console.log('seed   | frames | bytes | serializable | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 12, ...BASE, placementOps: OPS, entityOps: ENT });
    const o = r.orch;
    const w = o.zoneViewWire('z1');
    const ok = check(w.serializable === true && w.bytes > 0 && w.frames === o.zoneViewFrames() && w.frames > 0,
      `seed ${seed}: 직렬화 경계 위반 (frames ${w.frames}·bytes ${w.bytes}·serializable ${w.serializable})`);
    console.log(`${pad(seed, 6)} | ${pad(w.frames, 6)} | ${pad(w.bytes, 5)} | ${pad(w.serializable ? 'Y' : 'N', 12)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['hostzoneviewwire'] = hostzoneviewwire;
kit.ORDER.splice(1, 0, 'hostzoneviewwire');

(async () => { process.exit(await kit.cli(process.argv)); })();
