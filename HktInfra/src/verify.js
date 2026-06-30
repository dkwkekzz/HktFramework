// HktInfra step-0428 — 헤드리스 검증 (#61 업스트림 intent 실 클라 8: 손실 하 수렴 — egress 손실→gap-resync→uc0 수렴)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `uplossy`.
//   더한 한 조각: 검증 전용 — 다운스트림 egress 손실(egressDrop) 주입에도 실 클라 uc0 가 신뢰 전파(gap-resync·0337)로 수렴(desync 0). 손실이 진짜(gaps≥1)이고 복구됨(resyncs≥1). reg 구조적 0.
//   검증: ⒜ `reg`. ⒝ `uplossy` — egressDrop 하 게이트웨이 gaps≥1·resyncs≥1(손실 진짜+복구)·uc0 convergedTo(권위)·desync 0.
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
  ticks: 16, clients: 0, moves: 0, radius: 4, grid: 16, zones: 2, bus: true, failover: true,
  placeExecute: true, zoneBridge: true, zoneEntityFlow: true, gatewayZoneDir: true, gatewayDirectZone: true, zoneEgress: true,
  placementOps: [{ at: 1, op: { type: 'placeZone', zoneId: 'z1', host: 'hostA' } }, { at: 1, op: { type: 'placeZone', zoneId: 'z2', host: 'hostB' } }],
};

// step-0428 #61 8 — uplossy: egress 손실(s:a1#2) 주입에도 uc0 가 gap-resync(0337)로 수렴(desync 0). 손실 진짜(gaps≥1)+복구(resyncs≥1).
function uplossy(seeds) {
  console.log('== uplossy (0428·#61 8): 다운스트림 egress 손실(egressDrop) 하 실 클라 uc0 가 gap-resync 로 수렴(desync 0). 손실 진짜(gaps≥1)+복구(resyncs≥1). ==');
  console.log('seed   | gaps | resyncs | uc0 수렴 | 판정');
  const uc = [{ addr: 'uc0', avatar: 'a1', zoneId: 'z1', joinAt: 3, plan: [[1, 1], [1, 1], [1, 1]] }];
  for (const seed of seeds) {
    const r = run({ seed, ...BASE, upClients: uc, egressDrop: ['s:a1#2'], egressTimeout: 3 });
    const uc0 = r.upclients[0];
    const rep = r.gateway.downstreamReport();
    const conv = uc0.convergedTo(r.orch.zoneAuthSig('z1', 'a1'));
    const ok = check(rep.gaps >= 1 && rep.resyncs >= 1 && conv, `seed ${seed}: 손실 하 수렴 실패 (gaps ${rep.gaps}·resyncs ${rep.resyncs}·conv ${conv})`);
    console.log(`${pad(seed, 6)} | ${pad(rep.gaps, 4)} | ${pad(rep.resyncs, 7)} | ${pad(conv ? 'Y' : 'N', 8)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['uplossy'] = uplossy;
kit.ORDER.splice(1, 0, 'uplossy');

(async () => { process.exit(await kit.cli(process.argv)); })();
