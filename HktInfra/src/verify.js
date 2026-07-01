// HktInfra step-0475 — 헤드리스 검증 (#70 실 host.js child 경계 업스트림 — driveUpstream 다중 tick)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `upcdrive`.
//   더한 한 조각: `cluster-hostdriver.driveUpstream(cluster, upclients, ticks, zoneOf)` — 0471~0474 를 매-tick 루프로 통합(발신 포착
//   →경계 배달→실 존 tick→egress 뷰 되먹임). 실 UpClient 가 다중 tick plan 을 경계 넘어 완결하고 최종 seenSig==authSig(desync 0).
//   드라이버 미부착 → run() reg 0.
//   검증: ⒜ `reg`. ⒝ `upcdrive` — plan[[2,1],[3,0],[−1,2]] 구동 후 seenSig==authSig·applied==발신수.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');
const { Cluster } = require('./cluster-core.js');
const { makeClusterHostDriver } = require('./cluster-hostdriver.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;

const GRID = 16;
const zoneSpecOf = (addr, seed) => ({ addr, kind: 'zone', seed, opts: { region: { lo: 0, hi: GRID }, sibling: null, boundary: GRID, grid: GRID, radius: 4 } });
async function withCluster(hosts, fn) {
  const cluster = new Cluster(hosts);
  await cluster.spawn();
  try { return await fn(cluster); } finally { for (const h of hosts.slice()) { try { await cluster.killHost(h); } catch {} } }
}

// step-0475 #70 — upcdrive: driveUpstream 로 다중 tick plan 을 경계 넘어 완결·최종 수렴.
async function upcdrive(seeds) {
  console.log('== upcdrive (0475·#70 경계 업스트림): driveUpstream 다중 tick plan → 실 host.js 존 경계 넘어 완결·seenSig==authSig(desync 0). ==');
  console.log('seed   | applied | UpClient seenSig | authSig | desync 0 | 판정');
  for (const seed of seeds) {
    await withCluster(['hostA'], async (cluster) => {
      await cluster.init(new Map([['hostA', [zoneSpecOf('zone1', seed)]]]));
      const drv = makeClusterHostDriver();
      const uc = new NET.UpClient({ avatar: 'a1', zoneId: 'zone1', joinAt: 1, plan: [[2, 1], [3, 0], [-1, 2]] });
      const applied = await drv.driveUpstream(cluster, [uc], 6, () => 'hostA');
      const authSig = await drv.upstreamAuthSig(cluster, 'hostA', 'zone1');
      const converged = uc.seenSig() === authSig && authSig !== '';
      const pass = check(converged && applied === uc.sent && applied === 4, `seed ${seed}: applied${applied}==sent${uc.sent}·seen==auth ${converged}`);
      console.log(`${pad(seed, 6)} | ${pad(applied, 7)} | ${pad(uc.seenSig() || '-', 16)} | ${pad(authSig || '-', 9)} | ${pad(converged ? 'Y' : 'N', 8)} | ${pass ? 'OK' : 'FAIL'}`);
    });
  }
}

kit.MODES['upcdrive'] = upcdrive;
kit.ORDER.splice(1, 0, 'upcdrive');

(async () => { process.exit(await kit.cli(process.argv)); })();
