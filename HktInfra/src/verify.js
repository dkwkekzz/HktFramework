// HktInfra step-0424 — 헤드리스 검증 (#61 업스트림 intent 실 클라 4: UpClient 수렴 desync 0)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `upconverge`.
//   더한 한 조각: 검증 전용 — uc0.seenSig() == orch.zoneAuthSig(권위 AOI)·desync 0(발신한 intent 가 권위에 반영되고 그 권위 뷰로 수렴). 코드 박스 무변경→reg 구조적 0.
//   검증: ⒜ `reg`. ⒝ `upconverge` — uc0 가 발신+수신 후 convergedTo(권위 AOI sig)·seenSig==authSig(desync 0).
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

// step-0424 #61 4 — upconverge: uc0 가 발신+수신 후 seenSig() == orch.zoneAuthSig(권위 AOI)·desync 0(자기 intent 가 권위에 반영되고 그 권위 뷰로 수렴).
function upconverge(seeds) {
  console.log('== upconverge (0424·#61 4): uc0 seenSig == 권위 AOI sig(orch.zoneAuthSig)·convergedTo·desync 0(발신→권위 반영→뷰 수렴). ==');
  console.log('seed   | seenSig | authSig | converged | 판정');
  const plan = [[3, 2], [1, 1]];
  for (const seed of seeds) {
    const r = run({ seed, ...upScenario([{ addr: 'uc0', avatar: 'a1', zoneId: 'z1', joinAt: 3, plan }]) });
    const uc0 = r.upclients[0];
    const authSig = r.orch.zoneAuthSig('z1', 'a1');
    const conv = uc0.convergedTo(authSig);
    const ok = check(conv && uc0.seenSig() === authSig && authSig !== '', `seed ${seed}: 수렴 실패 (seen ${uc0.seenSig()}·auth ${authSig})`);
    console.log(`${pad(seed, 6)} | ${pad(uc0.seenSig(), 8)} | ${pad(authSig, 8)} | ${pad(conv ? 'Y' : 'N', 9)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['upconverge'] = upconverge;
kit.ORDER.splice(1, 0, 'upconverge');

(async () => { process.exit(await kit.cli(process.argv)); })();
