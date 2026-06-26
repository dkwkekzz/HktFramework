// HktInfra step-0342 — 헤드리스 검증 (#9 후속: 실 다운스트림 클라 수렴 — host AOI == 클라 뷰 desync 0)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `dcconv`.
//   더한 한 조각: 수신 전용 실 DownClient 액터(downClients 스폰) — 게이트웨이가 전파한 host 산출 AOI 뷰를 받아 seen 으로 적용. 0331~0341 전파 종단(spectator addr)을 *실 클라*로 교체(0334 한계 해소).
//   검증: ⒜ `reg`(키트·downClients 0→스폰 0·비트 동일). ⒝ `dcconv` — dc0.seenIds == zoneVisibleIds('z1','a1')(host 가 본 AOI == 클라가 보는 AOI·desync 0 수렴)·dc1 동형.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { run } = NET;

// step-0342 #9 후속 — 실 다운스트림 클라 수렴. a1@dc0·a2@dc1 z1 입장·이동 → 게이트웨이가 host 산출 AOI 뷰를 dc0·dc1 에 전파 → 각 클라 seen 적용.
//   desync 0: dc0.seenIds() == orch.zoneVisibleIds('z1','a1')(host 권위 AOI == 클라 뷰)·dc1 == 'a2' AOI. 둘 다 비어있지 않음(자기 ≥1).
function dcconv(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const ENTER = (at, zoneId, avatar, from) => ({ at, from, op: { type: 'zoneEnter', zoneId, avatar } });
  const MOVE = (at, zoneId, avatar, dx, dy, from) => ({ at, from, op: { type: 'zoneMove', zoneId, avatar, dx, dy } });
  const OPS = [PLACE(1, 'z1', 'hostA')];
  const ENT = [ENTER(3, 'z1', 'a1', 'dc0'), ENTER(4, 'z1', 'a2', 'dc1'), MOVE(6, 'z1', 'a1', 1, 1, 'dc0'), MOVE(8, 'z1', 'a2', 1, 0, 'dc1'), MOVE(10, 'z1', 'a1', 1, 0, 'dc0')];
  const BASE = { clients: 6, moves: 24, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneEntityFlow: true, zoneHostHandle: true, zoneHostMailbox: true, gatewayZoneDir: true, gatewayDirectZone: true, zoneHostProc: true, zoneEgress: true, downClients: 2 };
  console.log('== dcconv (0342·#9 후속): 실 다운스트림 클라 수렴. dc.seen == host 권위 AOI(desync 0). ==');
  console.log('seed   | dc0.seen | aoi(a1) | dc1.seen | aoi(a2) | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 16, ...BASE, placementOps: OPS, entityOps: ENT });
    const o = r.orch, dc0 = r.downclients[0], dc1 = r.downclients[1];
    const s0 = dc0.seenIds().join(','), a1 = o.zoneVisibleIds('z1', 'a1').join(',');
    const s1 = dc1.seenIds().join(','), a2 = o.zoneVisibleIds('z1', 'a2').join(',');
    const ok = check(s0 === a1 && s1 === a2 && s0.length > 0 && s1.length > 0,
      `seed ${seed}: dc0 [${s0}] vs aoi(a1) [${a1}] · dc1 [${s1}] vs aoi(a2) [${a2}]`);
    console.log(`${pad(seed, 6)} | ${pad(s0, 8)} | ${pad(a1, 7)} | ${pad(s1, 8)} | ${pad(a2, 7)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['dcconv'] = dcconv;
kit.ORDER.splice(1, 0, 'dcconv');

(async () => { process.exit(await kit.cli(process.argv)); })();
