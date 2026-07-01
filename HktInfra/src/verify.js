// HktInfra step-0472 — 헤드리스 검증 (#70 실 host.js child 경계 업스트림 — move intent 배달)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `upcmove`.
//   더한 한 조각: `cluster-hostdriver.intentToZoneMsg` 에 `zoneMove`→존 move 번역 추가. 실 UpClient 의 이동 intent 가 경계 넘어
//   실 host.js 존에 적용되어(존 onTick 이 pending move 적용) entity 가 (dx,dy) 만큼 이동함을 단언(경계 넘어 이동 결정론).
//   드라이버 미부착 → run() reg 0.
//   검증: ⒜ `reg`. ⒝ `upcmove` — enter 위치 + (dx,dy) == move 후 실 존 위치.
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
async function zoneEnts(cluster, host, zone) { const s = await cluster.rpc(host, { cmd: 'snapshot' }); return new Map((s.snap[zone] && s.snap[zone].ents) || []); }

// step-0472 #70 — upcmove: enter 후 move intent 경계 배달 → 실 존 tick 이 (dx,dy) 적용.
async function upcmove(seeds) {
  console.log('== upcmove (0472·#70 경계 업스트림): 실 UpClient zoneMove → 실 host.js 존 entity 가 (dx,dy) 이동(경계 넘어 적용). ==');
  console.log('seed   | enter pos | +plan | move 후 pos | 예상 일치 | 판정');
  for (const seed of seeds) {
    await withCluster(['hostA'], async (cluster) => {
      await cluster.init(new Map([['hostA', [zoneSpecOf('zone1', seed)]]]));
      const drv = makeClusterHostDriver();
      const uc = new NET.UpClient({ avatar: 'a1', zoneId: 'zone1', joinAt: 1, plan: [[2, 1]] });
      for (const op of tickUp(uc, 1)) await drv.deliverIntent(cluster, 'hostA', op);   // enter
      const p0 = (await zoneEnts(cluster, 'hostA', 'zone1')).get('a1');
      for (const op of tickUp(uc, 2)) await drv.deliverIntent(cluster, 'hostA', op);   // move [2,1]
      await drv.tickZone(cluster, 'hostA', 'zone1', 2);                                 // 존 onTick → pending move 적용
      const p1 = (await zoneEnts(cluster, 'hostA', 'zone1')).get('a1');
      const exp = { x: (p0.x + 2 + GRID) % GRID, y: (p0.y + 1 + GRID) % GRID };
      const match = p1 && p1.x === exp.x && p1.y === exp.y;
      const pass = check(!!match, `seed ${seed}: p0(${p0.x},${p0.y})+2,1→p1(${p1 && p1.x},${p1 && p1.y})==exp(${exp.x},${exp.y})`);
      console.log(`${pad(seed, 6)} | ${pad(p0.x + ',' + p0.y, 9)} | ${pad('2,1', 5)} | ${pad((p1 ? p1.x + ',' + p1.y : '-'), 11)} | ${pad(match ? 'Y' : 'N', 9)} | ${pass ? 'OK' : 'FAIL'}`);
    });
  }
}

kit.MODES['upcmove'] = upcmove;
kit.ORDER.splice(1, 0, 'upcmove');

(async () => { process.exit(await kit.cli(process.argv)); })();
