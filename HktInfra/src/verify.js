// HktInfra step-0430 — 헤드리스 검증 (#61 업스트림 intent 실 클라 10·capstone: 양방향 실 클라 E2E)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `upe2ecap`.
//   더한 한 조각: 검증 전용 grand capstone — 실 클라(UpClient)들이 intent 발신→게이트웨이→실 존→egress→자기 뷰 수신으로 양방향 E2E(desync 0)·생애주기(enter/move/leave)·보존(enters−leaves==present). #61 sub-arc(0421~0430) 닫기. reg 구조적 0.
//   검증: ⒜ `reg`. ⒝ `upe2ecap` — uc0(체류) 수렴·uc1(leave) 후 b1 제거·보존(present==enters−leaves)·발신 회계.
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

// step-0430 #61 10·capstone — upe2ecap: 양방향 실 클라 E2E — uc0(a1@z1 체류) 수렴·uc1(b1@z2 leave@9) 후 b1 제거·보존(enters2−leaves1==present1=a1)·발신 회계. 0421~0430 닫기.
function upe2ecap(seeds) {
  console.log('== upe2ecap (0430·#61 grand capstone): 양방향 실 클라 E2E — uc0 체류 수렴·uc1 leave 후 b1 제거·보존(enters−leaves==present)·발신 회계. 0421~0430 닫기. ==');
  console.log('seed   | uc0 수렴 | a1 체류 | b1 제거 | 보존 | 발신회계 | 판정');
  for (const seed of seeds) {
    const r = run({
      seed, ...BASE, upClients: [
        { addr: 'uc0', avatar: 'a1', zoneId: 'z1', joinAt: 3, plan: [[1, 1], [1, 1], [1, 1]] },
        { addr: 'uc1', avatar: 'b1', zoneId: 'z2', joinAt: 3, plan: [[1, 0], [0, 1]], leaveAt: 9 },
      ],
    });
    const [uc0, uc1] = r.upclients;
    const a1 = r.orch.zoneEntityPos('z1', 'a1'), b1 = r.orch.zoneEntityPos('z2', 'b1');
    const conv0 = uc0.convergedTo(r.orch.zoneAuthSig('z1', 'a1'));
    const present = (a1 ? 1 : 0) + (b1 ? 1 : 0);
    const enters = 2, leaves = 1;   // uc0·uc1 enter·uc1 leave
    const conserved = present === enters - leaves;
    const acct = uc0.intentLog.length === uc0.sent && uc1.intentLog.length === uc1.sent && uc1.intentLog.some(o => o.type === 'zoneLeave');
    const ok = check(conv0 && !!a1 && b1 == null && conserved && acct,
      `seed ${seed}: capstone 위반 (conv0 ${conv0}·a1 ${JSON.stringify(a1)}·b1 ${JSON.stringify(b1)}·present ${present}·acct ${acct})`);
    console.log(`${pad(seed, 6)} | ${pad(conv0 ? 'Y' : 'N', 8)} | ${pad(a1 ? 'Y' : 'N', 7)} | ${pad(b1 == null ? 'Y' : 'N', 7)} | ${pad(conserved ? 'Y' : 'N', 4)} | ${pad(acct ? 'Y' : 'N', 8)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['upe2ecap'] = upe2ecap;
kit.ORDER.splice(1, 0, 'upe2ecap');

(async () => { process.exit(await kit.cli(process.argv)); })();
