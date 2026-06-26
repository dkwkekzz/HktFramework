// HktInfra step-0332 — 헤드리스 검증 (정리: 브리지 필드 init 분리 — orchestrator.js >30KB 유계화)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `bridgesplit`.
//   더한 한 조각(기능 0): 생성자의 0272~0331 브리지/데이터평면/host컨테이너/egress 필드 대입 블록을 orch-zonebridge.js `_initBridgeFields(opts)` 로 제자리 이동(같은 순서·동일 대입·생성자 같은 지점 호출 → reg 0·orchestrator.js 30.5KB→<30KB).
//   검증: ⒜ `reg`(키트·OFF 비트 동일). ⒝ `bridgesplit` — 분리 후에도 브리지 데이터 평면이 온전: enter/move 뒤 egress==zoneViewFrames && downstreamCoherent(추출된 필드가 정상 배선됐다는 스모크).
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { run } = NET;

// step-0332 정리 — 브리지 필드 init 분리 스모크. 추출된 _initBridgeFields 가 생성자에서 같은 필드를 같은 값으로 세팅했는지를 *기능*으로 확인:
//   egress(zoneEgress 필드)·downstreamCoherent(뷰 회계/keyframe/wire 필드)가 모두 정상 동작이면 추출이 비트 동일(reg 가 OFF, 이 모드가 ON 경로를 증명).
function bridgesplit(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const ENTER = (at, zoneId, avatar) => ({ at, op: { type: 'zoneEnter', zoneId, avatar } });
  const MOVE = (at, zoneId, avatar, dx, dy) => ({ at, op: { type: 'zoneMove', zoneId, avatar, dx, dy } });
  const OPS = [PLACE(1, 'z1', 'hostA')];
  const ENT = [ENTER(3, 'z1', 'a1'), ENTER(4, 'z1', 'a2'), MOVE(6, 'z1', 'a1', 1, 1), MOVE(8, 'z1', 'a1', 1, 0)];
  const BASE = { clients: 6, moves: 24, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneEntityFlow: true, zoneHostHandle: true, zoneHostMailbox: true, gatewayZoneDir: true, gatewayDirectZone: true, zoneHostProc: true, zoneEgress: true };
  console.log('== bridgesplit (0332·정리): 브리지 필드 init 분리 후 데이터 평면 온전. egress==frames && downstreamCoherent(z1). ==');
  console.log('seed   | egress | frames | dcoh | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 16, ...BASE, placementOps: OPS, entityOps: ENT });
    const o = r.orch;
    const eg = o.zoneEgressCount(), fr = o.zoneViewFrames(), dc = o.downstreamCoherent('z1');
    const ok = check(eg > 0 && eg === fr && dc, `seed ${seed}: split 후 데이터 평면 손상 (egress ${eg}·frames ${fr}·dcoh ${dc})`);
    console.log(`${pad(seed, 6)} | ${pad(eg, 6)} | ${pad(fr, 6)} | ${pad(dc ? 'Y' : 'N', 4)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['bridgesplit'] = bridgesplit;
kit.ORDER.splice(1, 0, 'bridgesplit');

(async () => { process.exit(await kit.cli(process.argv)); })();
