// HktInfra step-0471 — 헤드리스 검증 (#70 실 host.js child 경계 업스트림 — enter intent 배달)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `upclenter`.
//   더한 한 조각: `cluster-hostdriver.js` 에 업스트림 seam — `intentToZoneMsg`(게이트웨이-형 intent→존 msg·enter)+`deliverIntent`
//   (실 host.js 존으로 소켓 배달). 실 UpClient(부모) 의 zoneEnter intent 가 *실 프로세스 경계*를 넘어 실 host.js 자식의 존에
//   entity 를 생성함을 단언(#61 in-proc UpClient 의 실 OS 프로세스 짝·#57 다운스트림의 업스트림 대칭). 드라이버 미부착 → run() reg 0.
//   검증: ⒜ `reg`. ⒝ `upclenter` — 실 host.js 존에 a1 present(경계 넘어 enter 적용).
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

// ── #70 실 host.js 경계 업스트림 공용 헬퍼 ──
const zoneSpecOf = (addr, seed) => ({ addr, kind: 'zone', seed, opts: { region: { lo: 0, hi: 16 }, sibling: null, boundary: 16, grid: 16, radius: 4 } });
async function withCluster(hosts, fn) {
  const cluster = new Cluster(hosts);
  await cluster.spawn();
  try { return await fn(cluster); } finally { for (const h of hosts.slice()) { try { await cluster.killHost(h); } catch {} } }
}
// UpClient 를 capturing net 으로 구동해 이번 tick 에 발신한 intent 열을 반환.
function tickUp(uc, t) { const cap = []; uc.net = { send: (f, to, p) => cap.push(p) }; uc.onTick(t); return cap; }

// step-0471 #70 — upclenter: 실 UpClient enter intent 가 실 host.js 경계 넘어 존에 entity 생성.
async function upclenter(seeds) {
  console.log('== upclenter (0471·#70 경계 업스트림): 실 UpClient zoneEnter → 실 host.js 자식 존에 entity present(경계 넘어 enter). ==');
  console.log('seed   | 발신 intent | 실 존 entity | a1 present | 판정');
  for (const seed of seeds) {
    const ok = await withCluster(['hostA'], async (cluster) => {
      await cluster.init(new Map([['hostA', [zoneSpecOf('zone1', seed)]]]));
      const drv = makeClusterHostDriver();
      const uc = new NET.UpClient({ avatar: 'a1', zoneId: 'zone1', joinAt: 1 });
      const ops = tickUp(uc, 1);                       // joinAt 1 → zoneEnter 발신
      for (const op of ops) await drv.deliverIntent(cluster, 'hostA', op);
      const snap = await cluster.rpc('hostA', { cmd: 'snapshot' });
      const ents = new Map((snap.snap.zone1 && snap.snap.zone1.ents) || []);
      const present = ents.has('a1');
      const pass = check(ops.length === 1 && present, `seed ${seed}: sent${ops.length}·a1${present}`);
      console.log(`${pad(seed, 6)} | ${pad(ops.length, 11)} | ${pad(ents.size, 12)} | ${pad(present ? 'Y' : 'N', 10)} | ${pass ? 'OK' : 'FAIL'}`);
      return pass;
    });
    if (!ok) { /* check() 이 이미 기록 */ }
  }
}

kit.MODES['upclenter'] = upclenter;
kit.ORDER.splice(1, 0, 'upclenter');

(async () => { process.exit(await kit.cli(process.argv)); })();
