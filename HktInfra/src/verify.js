// HktInfra step-0474 — 헤드리스 검증 (#70 실 host.js child 경계 업스트림 — 경계 넘어 수렴 desync 0)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `upcconverge`.
//   더한 한 조각: `cluster-hostdriver.upstreamAuthSig(cluster,host,zone)` — 실 host.js 존 권위 AOI 서명(snapshot·UpClient.seenSig 형식).
//   실 UpClient 가 발신(enter+move)→경계 넘어 실 존 적용→egress 뷰 수신 뒤 seenSig()==authSig(desync 0)임을 단언 — 발신→권위 반영
//   →뷰 수렴이 *실 프로세스 경계*를 넘어 성립(#61 in-proc upconverge 의 실 OS 프로세스 판). 드라이버 미부착 → run() reg 0.
//   검증: ⒜ `reg`. ⒝ `upcconverge` — UpClient.seenSig == 실 존 authSig(경계 넘어 desync 0).
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
function tickUp(uc, t) { const cap = []; uc.net = { send: (f, to, p) => cap.push(p) }; uc.onTick(t); return cap; }

// step-0474 #70 — upcconverge: 발신→경계 넘어 권위 반영→뷰 수렴 desync 0.
async function upcconverge(seeds) {
  console.log('== upcconverge (0474·#70 경계 업스트림): 실 UpClient 발신(enter+move)→실 host.js 존→egress 뷰 → seenSig==authSig(경계 넘어 desync 0). ==');
  console.log('seed   | UpClient seenSig | 실 존 authSig | desync 0 | 판정');
  for (const seed of seeds) {
    await withCluster(['hostA'], async (cluster) => {
      await cluster.init(new Map([['hostA', [zoneSpecOf('zone1', seed)]]]));
      const drv = makeClusterHostDriver();
      const uc = new NET.UpClient({ avatar: 'a1', zoneId: 'zone1', joinAt: 1, plan: [[2, 1]] });
      for (const op of tickUp(uc, 1)) await drv.deliverIntent(cluster, 'hostA', op);   // enter
      drv.feedViews(await drv.tickZone(cluster, 'hostA', 'zone1', 1), uc);
      for (const op of tickUp(uc, 2)) await drv.deliverIntent(cluster, 'hostA', op);   // move
      drv.feedViews(await drv.tickZone(cluster, 'hostA', 'zone1', 2), uc);
      const authSig = await drv.upstreamAuthSig(cluster, 'hostA', 'zone1');
      const converged = uc.seenSig() === authSig && authSig !== '';
      const pass = check(converged, `seed ${seed}: seen ${uc.seenSig()} == auth ${authSig}`);
      console.log(`${pad(seed, 6)} | ${pad(uc.seenSig() || '-', 16)} | ${pad(authSig || '-', 13)} | ${pad(converged ? 'Y' : 'N', 8)} | ${pass ? 'OK' : 'FAIL'}`);
    });
  }
}

kit.MODES['upcconverge'] = upcconverge;
kit.ORDER.splice(1, 0, 'upcconverge');

(async () => { process.exit(await kit.cli(process.argv)); })();
