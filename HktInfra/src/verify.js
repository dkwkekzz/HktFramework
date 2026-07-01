// HktInfra step-0477 — 헤드리스 검증 (#70 실 host.js child 경계 업스트림 — 다중 UpClient)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `upcmulti`.
//   더한 한 조각: 코드(박스) 무변경 — 0475 `driveUpstream` 다중 클라 지원을 2 존(zone1·zone2·한 host)·2 UpClient(a1·b1) 로 검증.
//   각 클라가 자기 존으로 경계 배달·자기 존 egress 뷰 수신 → 각자 자기 존 authSig 로 수렴(교차 존 격리·desync 0). run() reg 0.
//   검증: ⒜ `reg`. ⒝ `upcmulti` — a1@zone1·b1@zone2 각 seenSig==해당 존 authSig(경계 넘어 다중 수렴).
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

// step-0477 #70 — upcmulti: 2 존·2 UpClient 경계 업스트림 각자 수렴(교차 존 격리).
async function upcmulti(seeds) {
  console.log('== upcmulti (0477·#70 경계 업스트림): a1@zone1·b1@zone2(한 host) 각 경계 배달·자기 존 뷰 수신 → 각자 authSig 수렴(격리). ==');
  console.log('seed   | applied | a1 seen==auth | b1 seen==auth | 판정');
  for (const seed of seeds) {
    await withCluster(['hostA'], async (cluster) => {
      await cluster.init(new Map([['hostA', [zoneSpecOf('zone1', seed), zoneSpecOf('zone2', seed)]]]));
      const drv = makeClusterHostDriver();
      const a1 = new NET.UpClient({ avatar: 'a1', zoneId: 'zone1', joinAt: 1, plan: [[2, 1], [3, 0]] });
      const b1 = new NET.UpClient({ avatar: 'b1', zoneId: 'zone2', joinAt: 1, plan: [[1, 2], [0, 3]] });
      const applied = await drv.driveUpstream(cluster, [a1, b1], 5, () => 'hostA');
      const authA = await drv.upstreamAuthSig(cluster, 'hostA', 'zone1');
      const authB = await drv.upstreamAuthSig(cluster, 'hostA', 'zone2');
      const okA = a1.seenSig() === authA && authA !== '';
      const okB = b1.seenSig() === authB && authB !== '';
      const pass = check(okA && okB && applied === 6, `seed ${seed}: applied${applied}·a1${okA}(${a1.seenSig()})·b1${okB}(${b1.seenSig()})`);
      console.log(`${pad(seed, 6)} | ${pad(applied, 7)} | ${pad(okA ? 'Y ' + a1.seenSig() : 'N', 13)} | ${pad(okB ? 'Y ' + b1.seenSig() : 'N', 13)} | ${pass ? 'OK' : 'FAIL'}`);
    });
  }
}

kit.MODES['upcmulti'] = upcmulti;
kit.ORDER.splice(1, 0, 'upcmulti');

(async () => { process.exit(await kit.cli(process.argv)); })();
