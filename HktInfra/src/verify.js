// HktInfra step-0319 — 헤드리스 검증 (#9 후속: host 프로세스 AOI 뷰 산출 포착 — downstream 데이터 평면 씨앗)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `hostzoneviews`.
//   더한 한 조각: 런타임 존 net 싱크를 no-op→버퍼링 으로(뷰 드롭 폐기·포착). 질의 zoneViewFrames/zoneViewsFor — host 가 산출한 AOI 뷰 수. 버퍼 미읽으면 무관 → reg/spine 비트 동일.
//   검증: ⒜ `reg`(키트·OFF 비트 동일). ⒝ `hostzoneviews`(가설) — 존에 2 avatar enter → 런타임 onTick 이 세션별 view_delta 산출·zoneViewFrames ≥ 2.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { run } = NET;

// step-0319 #9 후속 검증 — host 프로세스 AOI 뷰 산출 포착(zoneViewFrames). z1@A 에 a1·a2 enter·이동 → 런타임 onTick 이 세션별 view_delta(reset keyframe + 증분)를 산출해 버퍼링 싱크에 쌓는다.
//   0282 까지 이 뷰는 no-op 싱크로 *드롭*됐다 — 이제 포착돼 zoneViewFrames > 0(다운스트림 데이터 평면이 실제로 frame 을 만든다는 증거·host→세션 뷰 전파의 씨앗). 미가동 존 0.
function hostzoneviews(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const ENTER = (at, zoneId, avatar) => ({ at, op: { type: 'zoneEnter', zoneId, avatar } });
  const MOVE = (at, zoneId, avatar, dx, dy) => ({ at, op: { type: 'zoneMove', zoneId, avatar, dx, dy } });
  const OPS = [PLACE(1, 'z1', 'hostA')];
  const ENT = [ENTER(3, 'z1', 'a1'), ENTER(4, 'z1', 'a2'), MOVE(6, 'z1', 'a1', 1, 0), MOVE(8, 'z1', 'a2', 0, 1)];
  const BASE = { clients: 6, moves: 24, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneEntityFlow: true, zoneHostHandle: true, zoneHostMailbox: true, gatewayZoneDir: true, gatewayDirectZone: true, zoneHostProc: true };
  console.log('== hostzoneviews (0319·#9 후속): host 프로세스 AOI 뷰 산출 포착. z1 에 2 avatar enter+이동 → 런타임 onTick 이 view_delta 산출·zoneViewFrames ≥ 2(예전엔 드롭). ==');
  console.log('seed   | viewFrames | z1views | total | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 14, ...BASE, placementOps: OPS, entityOps: ENT });
    const o = r.orch;
    const vf = o.zoneViewFrames(), z1v = o.zoneViewsFor('z1');
    const ok = check(vf >= 2 && z1v === vf && o.totalEntities() === 2 && o.zoneViewsFor('zX') === 0,
      `seed ${seed}: 뷰 산출 위반 (viewFrames ${vf}·z1views ${z1v}·total ${o.totalEntities()})`);
    console.log(`${pad(seed, 6)} | ${pad(vf, 10)} | ${pad(z1v, 7)} | ${pad(o.totalEntities(), 5)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['hostzoneviews'] = hostzoneviews;
kit.ORDER.splice(1, 0, 'hostzoneviews');

(async () => { process.exit(await kit.cli(process.argv)); })();
