// HktInfra step-0425 — 헤드리스 검증 (#61 업스트림 intent 실 클라 5: UpClient ≡ 합성 entityOps 동치)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `upvsscript`.
//   더한 한 조각: 검증 전용 — 같은 plan 을 ⒜ upClients(실 클라 발신) ⒝ entityOps(합성 주입) 두 경로로 → 같은 최종 권위 위치·둘 다 수렴. 실 클라가 합성 주입을 정확히 대체. reg 구조적 0.
//   검증: ⒜ `reg`. ⒝ `upvsscript` — upClients 런 a1 위치 == entityOps 런 a1 위치·uc0/dc0 둘 다 권위로 수렴.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { run } = NET;

const BASE = {
  ticks: 14, clients: 0, moves: 0, radius: 4, grid: 16, zones: 2, bus: true, failover: true,
  placeExecute: true, zoneBridge: true, zoneEntityFlow: true, gatewayZoneDir: true, gatewayDirectZone: true, zoneEgress: true,
  placementOps: [{ at: 1, op: { type: 'placeZone', zoneId: 'z1', host: 'hostA' } }, { at: 1, op: { type: 'placeZone', zoneId: 'z2', host: 'hostB' } }],
};

// step-0425 #61 5 — upvsscript: 같은 plan(enter@3·move@4,5)을 실 클라(upClients) vs 합성 주입(entityOps)으로 → 같은 최종 권위 위치·둘 다 수렴. 실 클라가 합성 주입을 정확히 대체.
function upvsscript(seeds) {
  console.log('== upvsscript (0425·#61 5): UpClient 발신 ≡ 합성 entityOps 주입 — 같은 plan → 같은 최종 권위 위치·둘 다 수렴(실 클라가 합성 대체). ==');
  console.log('seed   | up a1 | script a1 | 일치 | up 수렴 | script 수렴 | 판정');
  const plan = [[3, 2], [1, 1]];
  for (const seed of seeds) {
    // 실 클라 경로
    const ru = run({ seed, ...BASE, upClients: [{ addr: 'uc0', avatar: 'a1', zoneId: 'z1', joinAt: 3, plan }] });
    const upPos = ru.orch.zoneEntityPos('z1', 'a1');
    const upConv = ru.upclients[0].convergedTo(ru.orch.zoneAuthSig('z1', 'a1'));
    // 합성 주입 경로(같은 plan·dc0 수신)
    const eo = [{ at: 3, from: 'dc0', op: { type: 'zoneEnter', zoneId: 'z1', avatar: 'a1' } }];
    plan.forEach((m, k) => eo.push({ at: 4 + k, from: 'dc0', op: { type: 'zoneMove', zoneId: 'z1', avatar: 'a1', dx: m[0], dy: m[1] } }));
    const rs = run({ seed, ...BASE, downClients: 1, entityOps: eo });
    const scPos = rs.orch.zoneEntityPos('z1', 'a1');
    const scConv = rs.downclients[0].convergedTo(rs.orch.zoneAuthSig('z1', 'a1'));
    const match = upPos && scPos && upPos.x === scPos.x && upPos.y === scPos.y;
    const ok = check(match && upConv && scConv, `seed ${seed}: 동치 실패 (up ${JSON.stringify(upPos)}·script ${JSON.stringify(scPos)}·upConv ${upConv}·scConv ${scConv})`);
    console.log(`${pad(seed, 6)} | ${pad(upPos ? `{${upPos.x},${upPos.y}}` : 'N', 5)} | ${pad(scPos ? `{${scPos.x},${scPos.y}}` : 'N', 9)} | ${pad(match ? 'Y' : 'N', 4)} | ${pad(upConv ? 'Y' : 'N', 7)} | ${pad(scConv ? 'Y' : 'N', 11)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['upvsscript'] = upvsscript;
kit.ORDER.splice(1, 0, 'upvsscript');

(async () => { process.exit(await kit.cli(process.argv)); })();
