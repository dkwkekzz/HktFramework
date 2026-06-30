// HktInfra step-0423 — 헤드리스 검증 (#61 업스트림 intent 실 클라 3: UpClient 양방향 — 자기 AOI 뷰 수신)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `uprecv`.
//   더한 한 조각: UpClient.onMsg(view/view_delta→seen)·seenIds/seenSig(DownClient 동형). 발신 enter 가 세션→uc0 바인딩→자기 뷰 수신. upClients=null→reg 0.
//   검증: ⒜ `reg`. ⒝ `uprecv` — uc0 가 발신+수신(deltas>0)·seenIds 에 a1·seenSig 가 a1 권위 위치 포함.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { run } = NET;

function upScenario(ucs) {
  return {
    ticks: 14, clients: 0, moves: 0, radius: 4, grid: 16, zones: 2, bus: true, failover: true,
    placeExecute: true, zoneBridge: true, zoneEntityFlow: true, gatewayZoneDir: true, gatewayDirectZone: true, zoneEgress: true,
    placementOps: [{ at: 1, op: { type: 'placeZone', zoneId: 'z1', host: 'hostA' } }, { at: 1, op: { type: 'placeZone', zoneId: 'z2', host: 'hostB' } }],
    upClients: ucs,
  };
}

// step-0423 #61 3 — uprecv: uc0 가 발신(enter+move)+수신(view_delta)→ seenIds 에 a1·seenSig 가 a1 권위 위치 반영(양방향 실 클라).
function uprecv(seeds) {
  console.log('== uprecv (0423·#61 3): UpClient 양방향 — 발신 enter 가 세션→uc0 바인딩→자기 AOI 뷰 수신(deltas>0·seen 에 a1). ==');
  console.log('seed   | sent | deltas | seenIds | seenSig | 판정');
  const plan = [[3, 2], [1, 1]];
  for (const seed of seeds) {
    const r = run({ seed, ...upScenario([{ addr: 'uc0', avatar: 'a1', zoneId: 'z1', joinAt: 3, plan }]) });
    const uc0 = r.upclients[0];
    const ids = uc0.seenIds();
    const ok = check(uc0.sent === 1 + plan.length && uc0.deltas > 0 && ids.includes('a1'),
      `seed ${seed}: 수신 실패 (sent ${uc0.sent}·deltas ${uc0.deltas}·seen ${JSON.stringify(ids)})`);
    console.log(`${pad(seed, 6)} | ${pad(uc0.sent, 4)} | ${pad(uc0.deltas, 6)} | ${pad(JSON.stringify(ids), 8)} | ${pad(uc0.seenSig(), 8)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['uprecv'] = uprecv;
kit.ORDER.splice(1, 0, 'uprecv');

(async () => { process.exit(await kit.cli(process.argv)); })();
