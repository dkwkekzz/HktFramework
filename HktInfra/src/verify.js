// HktInfra step-0480 — 헤드리스 검증 (#70 실 host.js child 경계 업스트림 10·grand capstone)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `upce2ecap`.
//   더한 한 조각: grand capstone — 실 UpClient 의 발신 intent 가 *실 프로세스 경계*를 넘어 실 host.js 존에 닿고 egress 뷰가 실 클라로
//   돌아오는 E2E 를 한 시나리오(손실 wire)로 단언: ⒜ 경계 넘어 수렴(seenSig==authSig·desync0) ⒝ exactly-once(손실 하 dupCmds>0·재적용 0)
//   ⒞ 업스트림 회계(enterPos+Σmove==실 존 최종) ⒟ 생애주기(leave→실 존 entity 제거). #70 sub-arc(0471~0480) 닫기. run() reg 0.
//   검증: ⒜ `reg`. ⒝ `upce2ecap` — 위 4항 전부 + 손실 실재.
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
function tickUp(uc, t) { const cap = []; uc.net = { send: (f, to, p) => cap.push(p) }; uc.onTick(t); return cap; }

// step-0480 #70 grand capstone — upce2ecap: 실 UpClient E2E 경계(수렴·exactly-once·회계·생애주기). 0471~0480 닫기.
async function upce2ecap(seeds) {
  console.log('== upce2ecap (0480·#70 grand capstone): 실 UpClient E2E 경계 — 수렴·exactly-once(손실)·회계·생애주기(leave). 0471~0480 닫기. ==');
  console.log('seed   | uc0 수렴 | 회계 | exactly-once(dup) | uc1 leave 제거 | 판정');
  for (const seed of seeds) {
    await withCluster(['hostA'], { drop: 0.25, dropSeed: (seed ^ 0x7EE5) >>> 0 }, async (cluster) => {
      await cluster.init(new Map([['hostA', [zoneSpecOf('zone1', seed), zoneSpecOf('zone2', seed)]]]));
      const drv = makeClusterHostDriver();
      // uc0 — zone1 체류(수렴·회계). enter 위치는 첫 배달 후 읽어 회계 예측.
      const uc0 = new NET.UpClient({ avatar: 'a1', zoneId: 'zone1', joinAt: 1, plan: [[2, 1], [3, 0], [-1, 2]] });
      for (const op of tickUp(uc0, 1)) await drv.deliverIntent(cluster, 'hostA', op);
      drv.feedViews(await drv.tickZone(cluster, 'hostA', 'zone1', 1), uc0);
      const e0 = await drv.zoneEntity(cluster, 'hostA', 'zone1', 'a1');
      for (let t = 2; t <= 5; t++) { for (const op of tickUp(uc0, t)) await drv.deliverIntent(cluster, 'hostA', op); drv.feedViews(await drv.tickZone(cluster, 'hostA', 'zone1', t), uc0); }
      const authA = await drv.upstreamAuthSig(cluster, 'hostA', 'zone1');
      const converged = uc0.seenSig() === authA && authA !== '';
      const d = uc0.intentDelta();
      const exp = { x: ((e0.x + d.dx) % GRID + GRID) % GRID, y: ((e0.y + d.dy) % GRID + GRID) % GRID };
      const fin = await drv.zoneEntity(cluster, 'hostA', 'zone1', 'a1');
      const accounted = fin && fin.x === exp.x && fin.y === exp.y;
      // uc1 — zone2 생애주기(enter→move→leave→제거).
      const uc1 = new NET.UpClient({ avatar: 'b1', zoneId: 'zone2', joinAt: 1, plan: [[1, 1]], leaveAt: 3 });
      await drv.driveUpstream(cluster, [uc1], 4, () => 'hostA');
      const removed = (await drv.zoneEntity(cluster, 'hostA', 'zone2', 'b1')) === null;
      // exactly-once: 손실 실재(resends>0) 하에서도 수렴+회계(enterPos+Σmove==최종) → 이중 적용 0(있으면 위치 어긋남).
      const once = cluster.resends > 0 && converged && accounted;
      const pass = check(converged && accounted && once && removed, `seed ${seed}: conv${converged}·acct${accounted}·resend${cluster.resends}·removed${removed}`);
      console.log(`${pad(seed, 6)} | ${pad(converged ? 'Y' : 'N', 8)} | ${pad(accounted ? 'Y' : 'N', 4)} | ${pad('Y(rs' + cluster.resends + '·dup' + cluster.dupCmds + ')', 17)} | ${pad(removed ? 'Y' : 'N', 14)} | ${pass ? 'OK' : 'FAIL'}`);
    });
  }
}

kit.MODES['upce2ecap'] = upce2ecap;
kit.ORDER.splice(1, 0, 'upce2ecap');

(async () => { process.exit(await kit.cli(process.argv)); })();
