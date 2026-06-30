// HktInfra step-0429 — 헤드리스 검증 (#61 업스트림 intent 실 클라 9: 업스트림 회계 — 발신 intent == 권위 반영)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `upaccount`.
//   더한 한 조각: UpClient.intentLog(발신 매니페스트)·intentDelta(누적 변위) — 업스트림 회계: enter 위치+발신 변위 == 권위 최종(발신 손실 0). upClients=null→reg 0.
//   검증: ⒜ `reg`. ⒝ `upaccount` — uc0 발신 intent(enter+N move)가 전부 권위에 반영(최종 위치 == enter+intentDelta)·intentLog 길이 == sent.
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

// step-0429 #61 9 — upaccount: uc0 발신 intent(enter+plan)가 전부 권위에 반영 — 최종 위치 == enter(5,5)+intentDelta·intentLog 길이==sent(발신 손실 0).
function upaccount(seeds) {
  console.log('== upaccount (0429·#61 9): 업스트림 회계 — uc0 발신 intent 전부 권위 반영(최종==enter+intentDelta)·intentLog==sent(발신 손실 0). ==');
  console.log('seed   | sent | intentLog | enter+Δ | 권위 최종 | 판정');
  const plan = [[2, 1], [1, 2], [1, 1]];
  const enter = { x: 5, y: 5 };
  for (const seed of seeds) {
    const r = run({ seed, ...BASE, upClients: [{ addr: 'uc0', avatar: 'a1', zoneId: 'z1', joinAt: 3, plan }] });
    const uc0 = r.upclients[0];
    const d = uc0.intentDelta();
    const exp = { x: enter.x + d.dx, y: enter.y + d.dy };
    const pos = r.orch.zoneEntityPos('z1', 'a1');
    const ok = check(uc0.intentLog.length === uc0.sent && pos && pos.x === exp.x && pos.y === exp.y,
      `seed ${seed}: 회계 실패 (log ${uc0.intentLog.length}·sent ${uc0.sent}·exp ${JSON.stringify(exp)}·pos ${JSON.stringify(pos)})`);
    console.log(`${pad(seed, 6)} | ${pad(uc0.sent, 4)} | ${pad(uc0.intentLog.length, 9)} | ${pad(`{${exp.x},${exp.y}}`, 7)} | ${pad(pos ? `{${pos.x},${pos.y}}` : 'N', 9)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['upaccount'] = upaccount;
kit.ORDER.splice(1, 0, 'upaccount');

(async () => { process.exit(await kit.cli(process.argv)); })();
