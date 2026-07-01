// HktInfra step-0473 — 헤드리스 검증 (#70 실 host.js child 경계 업스트림 — egress 뷰→UpClient)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `upcrecv`.
//   더한 한 조각: `cluster-hostdriver.feedViews(sends, upclient)` — 실 host.js 존 tick 이 낸 게이트웨이-향 view/view_delta 를 골라
//   자기 세션 클라(UpClient)의 onMsg 로 배달(다운스트림 0333 라우팅의 경계 업스트림 판). 실 UpClient 가 자기 AOI 뷰를 *경계 넘어* 수신.
//   드라이버 미부착 → run() reg 0.
//   검증: ⒜ `reg`. ⒝ `upcrecv` — enter+tick 후 UpClient.seen 에 a1(자기)·seenSig 비어있지 않음.
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

// step-0473 #70 — upcrecv: 실 host.js 존 egress 뷰가 경계 넘어 실 UpClient 로 되먹임.
async function upcrecv(seeds) {
  console.log('== upcrecv (0473·#70 경계 업스트림): 실 host.js 존 egress view_delta → 실 UpClient.onMsg(경계 넘어 뷰 수신). ==');
  console.log('seed   | 뷰 배달 | UpClient seen | a1 in seen | 판정');
  for (const seed of seeds) {
    await withCluster(['hostA'], async (cluster) => {
      await cluster.init(new Map([['hostA', [zoneSpecOf('zone1', seed)]]]));
      const drv = makeClusterHostDriver();
      const uc = new NET.UpClient({ avatar: 'a1', zoneId: 'zone1', joinAt: 1 });
      for (const op of tickUp(uc, 1)) await drv.deliverIntent(cluster, 'hostA', op);   // enter
      const sends = await drv.tickZone(cluster, 'hostA', 'zone1', 1);                   // 존 tick → egress view_delta
      const fed = drv.feedViews(sends, uc);                                             // 경계 넘어 되먹임
      const hasSelf = uc.seen.has('a1');
      const pass = check(fed >= 1 && hasSelf && uc.seenSig() !== '', `seed ${seed}: fed${fed}·seen${uc.seenSig()}`);
      console.log(`${pad(seed, 6)} | ${pad(fed, 7)} | ${pad(uc.seenSig() || '-', 13)} | ${pad(hasSelf ? 'Y' : 'N', 10)} | ${pass ? 'OK' : 'FAIL'}`);
    });
  }
}

kit.MODES['upcrecv'] = upcrecv;
kit.ORDER.splice(1, 0, 'upcrecv');

(async () => { process.exit(await kit.cli(process.argv)); })();
