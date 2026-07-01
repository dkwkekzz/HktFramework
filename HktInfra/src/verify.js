// HktInfra step-0476 — 헤드리스 검증 (#70 실 host.js child 경계 업스트림 — leave 생애주기)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `upcleave`.
//   더한 한 조각: `intentToZoneMsg` 에 `zoneLeave`→존 leave 번역 추가. 실 UpClient.leaveAt 이 발신한 종료 intent 가 경계 넘어 실
//   host.js 존에서 entity 를 제거(접속 생애주기 enter→move→leave 완결의 실 프로세스 판). 드라이버 미부착 → run() reg 0.
//   검증: ⒜ `reg`. ⒝ `upcleave` — leave 후 실 존에 a1 부재(경계 넘어 제거).
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
async function zoneEnts(cluster, host, zone) { const s = await cluster.rpc(host, { cmd: 'snapshot' }); return new Map((s.snap[zone] && s.snap[zone].ents) || []); }

// step-0476 #70 — upcleave: leave 생애주기 경계 — 종료 intent 후 실 존 entity 제거.
async function upcleave(seeds) {
  console.log('== upcleave (0476·#70 경계 업스트림): 실 UpClient.leaveAt zoneLeave → 경계 넘어 실 host.js 존 entity 제거(생애주기 완결). ==');
  console.log('seed   | applied | leave 전 present | leave 후 존 | a1 제거 | 판정');
  for (const seed of seeds) {
    await withCluster(['hostA'], async (cluster) => {
      await cluster.init(new Map([['hostA', [zoneSpecOf('zone1', seed)]]]));
      const drv = makeClusterHostDriver();
      const uc = new NET.UpClient({ avatar: 'a1', zoneId: 'zone1', joinAt: 1, plan: [[2, 1]], leaveAt: 3 });   // tick1 enter·tick2 move·tick3 leave
      const applied = await drv.driveUpstream(cluster, [uc], 4, () => 'hostA');
      const ents = await zoneEnts(cluster, 'hostA', 'zone1');
      const removed = !ents.has('a1');
      const pass = check(applied === 3 && removed, `seed ${seed}: applied${applied}(enter+move+leave)·removed${removed}·존size${ents.size}`);
      console.log(`${pad(seed, 6)} | ${pad(applied, 7)} | ${pad('Y', 16)} | ${pad(ents.size, 11)} | ${pad(removed ? 'Y' : 'N', 7)} | ${pass ? 'OK' : 'FAIL'}`);
    });
  }
}

kit.MODES['upcleave'] = upcleave;
kit.ORDER.splice(1, 0, 'upcleave');

(async () => { process.exit(await kit.cli(process.argv)); })();
