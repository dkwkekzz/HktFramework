// HktInfra step-0479 — 헤드리스 검증 (#70 실 host.js child 경계 업스트림 — 업스트림 경계 회계)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `upcaccount`.
//   더한 한 조각: `cluster-hostdriver.zoneEntity(cluster,host,zone,id)`(실 존 한 entity 위치 읽기). 업스트림 경계 회계 — 실 UpClient
//   가 발신한 intent(intentLog)==실 host.js 존 반영: enter 위치 + Σ발신 move 변위 == 최종 실 존 위치(경계 넘어 발신 손실 0·클램프 0).
//   run() reg 0.
//   검증: ⒜ `reg`. ⒝ `upcaccount` — enterPos + intentDelta == 최종 실 존 pos·applied==intentLog 길이.
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

// step-0479 #70 — upcaccount: 발신 intent == 실 존 반영(경계 넘어 발신 손실 0).
async function upcaccount(seeds) {
  console.log('== upcaccount (0479·#70 경계 업스트림): 발신 intent == 실 host.js 존 반영 — enterPos + Σmove == 최종 실 존 pos(경계 넘어 손실 0). ==');
  console.log('seed   | intentLog | enterPos | Δ발신 | 예상 | 실 존 최종 | 일치 | 판정');
  for (const seed of seeds) {
    await withCluster(['hostA'], async (cluster) => {
      await cluster.init(new Map([['hostA', [zoneSpecOf('zone1', seed)]]]));
      const drv = makeClusterHostDriver();
      const uc = new NET.UpClient({ avatar: 'a1', zoneId: 'zone1', joinAt: 1, plan: [[2, 1], [3, 0], [-1, 2]] });
      for (const op of tickUp(uc, 1)) await drv.deliverIntent(cluster, 'hostA', op);   // enter
      const e = await drv.zoneEntity(cluster, 'hostA', 'zone1', 'a1');                  // enter 위치
      for (let t = 2; t <= 5; t++) { for (const op of tickUp(uc, t)) await drv.deliverIntent(cluster, 'hostA', op); await drv.tickZone(cluster, 'hostA', 'zone1', t); }
      const fin = await drv.zoneEntity(cluster, 'hostA', 'zone1', 'a1');
      const d = uc.intentDelta();
      const exp = { x: ((e.x + d.dx) % GRID + GRID) % GRID, y: ((e.y + d.dy) % GRID + GRID) % GRID };
      const match = fin && fin.x === exp.x && fin.y === exp.y;
      const nMoves = uc.intentLog.filter(o => o.type === 'zoneMove').length;
      const pass = check(!!match && uc.intentLog.length === 4 && nMoves === 3, `seed ${seed}: log${uc.intentLog.length}·enter(${e.x},${e.y})+Δ(${d.dx},${d.dy})==exp(${exp.x},${exp.y})·fin(${fin && fin.x},${fin && fin.y})`);
      console.log(`${pad(seed, 6)} | ${pad(uc.intentLog.length, 9)} | ${pad(e.x + ',' + e.y, 8)} | ${pad(d.dx + ',' + d.dy, 5)} | ${pad(exp.x + ',' + exp.y, 4)} | ${pad((fin ? fin.x + ',' + fin.y : '-'), 10)} | ${pad(match ? 'Y' : 'N', 4)} | ${pass ? 'OK' : 'FAIL'}`);
    });
  }
}

kit.MODES['upcaccount'] = upcaccount;
kit.ORDER.splice(1, 0, 'upcaccount');

(async () => { process.exit(await kit.cli(process.argv)); })();
