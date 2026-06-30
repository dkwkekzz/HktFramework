// HktInfra step-0426 — 헤드리스 검증 (#61 업스트림 intent 실 클라 6: 다중 UpClient 인터리빙 수렴)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `upmulti`.
//   더한 한 조각: 검증 전용 — 2 실 클라(uc0=a1@z1·uc1=b1@z2)가 동시 발신·각자 자기 존 권위로 수렴(다중 클라 intent 인터리빙·desync 0). 코드 박스 무변경(topo-build 가 upClients 배열 지원)→reg 0.
//   검증: ⒜ `reg`. ⒝ `upmulti` — uc0·uc1 둘 다 각자 권위 AOI 로 수렴·a1@z1·b1@z2 권위 위치 정확.
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

// step-0426 #61 6 — upmulti: 2 실 클라(uc0=a1@z1·uc1=b1@z2) 동시 발신 → 각자 자기 존 권위로 수렴(인터리빙·desync 0).
function upmulti(seeds) {
  console.log('== upmulti (0426·#61 6): 2 실 클라(uc0=a1@z1·uc1=b1@z2) 동시 발신 → 각자 자기 존 권위 AOI 로 수렴(인터리빙·desync 0). ==');
  console.log('seed   | uc0 수렴 | uc1 수렴 | a1@z1 | b1@z2 | 판정');
  for (const seed of seeds) {
    const r = run({
      seed, ...BASE, upClients: [
        { addr: 'uc0', avatar: 'a1', zoneId: 'z1', joinAt: 3, plan: [[1, 1], [1, 1]] },
        { addr: 'uc1', avatar: 'b1', zoneId: 'z2', joinAt: 3, plan: [[1, 0], [0, 1]] },
      ],
    });
    const [uc0, uc1] = r.upclients;
    const c0 = uc0.convergedTo(r.orch.zoneAuthSig('z1', 'a1'));
    const c1 = uc1.convergedTo(r.orch.zoneAuthSig('z2', 'b1'));
    const p0 = r.orch.zoneEntityPos('z1', 'a1'), p1 = r.orch.zoneEntityPos('z2', 'b1');
    const ok = check(c0 && c1 && !!p0 && !!p1, `seed ${seed}: 다중 수렴 실패 (c0 ${c0}·c1 ${c1}·a1 ${JSON.stringify(p0)}·b1 ${JSON.stringify(p1)})`);
    console.log(`${pad(seed, 6)} | ${pad(c0 ? 'Y' : 'N', 8)} | ${pad(c1 ? 'Y' : 'N', 8)} | ${pad(p0 ? `{${p0.x},${p0.y}}` : 'N', 5)} | ${pad(p1 ? `{${p1.x},${p1.y}}` : 'N', 5)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['upmulti'] = upmulti;
kit.ORDER.splice(1, 0, 'upmulti');

(async () => { process.exit(await kit.cli(process.argv)); })();
