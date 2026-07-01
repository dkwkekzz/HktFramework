// HktInfra step-0478 — 헤드리스 검증 (#70 실 host.js child 경계 업스트림 — 소켓 손실 하 멱등 수렴)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `upclossy`.
//   더한 한 조각: 코드(박스) 무변경 — 손실 wire(`{drop,dropSeed}`)로 실 소켓 유실을 주입. rpc 가 결정론 재전송·host.js 가 reqId
//   멱등(replyCache)으로 중복 cmd 를 재실행 없이 dedup → 재전송된 intent 가 *정확히 한 번* 적용(경계 넘어 exactly-once) → 여전히
//   seenSig==authSig 수렴. 손실이 진짜 발생(dupCmds>0)했는데도 위치가 어긋나지 않음이 exactly-once 증거. run() reg 0.
//   검증: ⒜ `reg`. ⒝ `upclossy` — 손실 하 seenSig==authSig·dupCmds>0(실 재전송)·idempotentHits>0(host dedup).
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
async function withCluster(hosts, wire, fn) {
  const cluster = new Cluster(hosts, wire);
  await cluster.spawn();
  try { return await fn(cluster); } finally { for (const h of hosts.slice()) { try { await cluster.killHost(h); } catch {} } }
}

// step-0478 #70 — upclossy: 소켓 손실 하 rpc 재전송 + host reqId 멱등 → 경계 넘어 exactly-once 수렴.
async function upclossy(seeds) {
  console.log('== upclossy (0478·#70 경계 업스트림): 손실 wire → rpc 재전송·host reqId 멱등 dedup → seenSig==authSig(경계 넘어 exactly-once). ==');
  console.log('seed   | resends | dupCmds | host idem | seen==auth | 판정');
  for (const seed of seeds) {
    await withCluster(['hostA'], { drop: 0.3, dropSeed: (seed ^ 0xC0FE) >>> 0 }, async (cluster) => {
      await cluster.init(new Map([['hostA', [zoneSpecOf('zone1', seed)]]]));
      const drv = makeClusterHostDriver();
      const uc = new NET.UpClient({ avatar: 'a1', zoneId: 'zone1', joinAt: 1, plan: [[2, 1], [3, 0], [-1, 2]] });
      await drv.driveUpstream(cluster, [uc], 6, () => 'hostA');
      const snap = await cluster.rpc('hostA', { cmd: 'snapshot' });
      const auth = await drv.upstreamAuthSig(cluster, 'hostA', 'zone1');
      const converged = uc.seenSig() === auth && auth !== '';
      const idem = snap.idempotentHits || 0;
      const pass = check(converged && cluster.dupCmds > 0 && idem > 0, `seed ${seed}: conv${converged}·dup${cluster.dupCmds}·idem${idem}`);
      console.log(`${pad(seed, 6)} | ${pad(cluster.resends, 7)} | ${pad(cluster.dupCmds, 7)} | ${pad(idem, 9)} | ${pad(converged ? 'Y' : 'N', 10)} | ${pass ? 'OK' : 'FAIL'}`);
    });
  }
}

kit.MODES['upclossy'] = upclossy;
kit.ORDER.splice(1, 0, 'upclossy');

(async () => { process.exit(await kit.cli(process.argv)); })();
