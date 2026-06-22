// HktInfra step-0088 — 헤드리스 검증 (파티 ack 집계·delivered)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `pack`.
//   더한 한 조각: 0083 의 파티 영수증 집계는 *라우팅 판정*(routed/bounced)까지만 — "전송을 결정했다"이지 "up 멤버가 실제로 받았다"는 아님(0083 §9). 0076 영수증(whisperAck→delivered)을 파티 단위로 집계해 *실수신 확인*까지 가시화: inflight 에 partyId 를 실어 whisperAck 가 그 파티 delivered++ → partyAcked(delivered==routed=모든 up 멤버 ack). 라우팅 결정(0083 done) + 영수증 확인(0088 acked).
//   검증: ⒜ `reg`(키트) — partyReceipt 미설정이면 0087 비트 동일(집계 0). ⒝ `pack`(가설) — 파티 'p1'(멤버 2: mbox up·ranking permanent). mbox 가 ack → ON: 원장 {members 2, routed 1, bounced 1, delivered 1}·done true·acked true. OFF: 집계 0. minted 동일(비침습).
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { run, itemConserved, ledgerConsistent } = NET;
const { check, pad } = kit.helpers;

const DEAD_DIE = 14; const PARTY_AT = 60;
const MEMBERS = ['mbox', 'ranking'];   // mbox up(ack 함)·ranking permanent(bounced) → routed 1/bounced 1/delivered 1
const P_BASE = (seed, extra) => ({ seed, ticks: 90, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2,
  incremental: true, recovery: true, failover: true, inventory: true, itemOps: 30, chat: true, chatOps: 12, regions: 2,
  bus: true, audit: true, ranking: true, busResend: true, busOutAck: true, busMinWm: true,
  busConsumerLease: true, leaseSpan: 3, busLeaseLife: true, busLeaseAdapt: true, busLeaseGrace: true, cadencePrior: 6,
  busLeaseAudit: true, busLeasePresence: true, busPresenceRecover: true, recoverRetry: true, presencePublish: true,
  presenceMonitor: true, presenceBox: true, presenceReportBus: true, presenceShadow: true, presenceLease: true, hbTimeout: 3,
  presenceQuery: true, whisperRouter: true, rankDie: DEAD_DIE, whisperReceipt: true, deliverRetry: true, deliverTimeout: 4,
  recoverMaxRetries: 3, dropRecover: 99,   // ranking 치유 차단 → permanentDown(파티 멤버 1명 확정 반송)
  parties: [{ at: PARTY_AT, from: 'client0', members: MEMBERS, body: 'party!', partyId: 'p1' }],
  ...extra });

function pack(seeds) {
  console.log('== pack: *가설* — 파티 ack 집계. 라우팅 판정 집계(0083) 위에 영수증(whisperAck→delivered)을 파티 단위로 더해 *실수신 확인*(delivered==routed)을 가시화. inflight 에 partyId 를 실어 ack 를 파티에 귀속. partyReceipt ON vs OFF ==');
  console.log("  파티 'p1'(멤버 2: mbox up·ranking permanent). mbox ack → ON: 원장 {members 2,routed 1,bounced 1,delivered 1}·done true·acked true. OFF: 집계 0.");
  console.log('seed   | routed | bounced | delivered | done | acked | OFF rec수 | 비침습 | 판정');
  for (const seed of seeds) {
    const on  = run({ ...P_BASE(seed, { partyReceipt: true }) });
    const off = run({ ...P_BASE(seed, {}) });   // partyReceipt OFF — 집계 0(0087 동작)
    const wr = on.wrouter; const wo = off.wrouter;
    const rec = wr ? wr.partyReceipts.get('p1') : null;
    const done = wr ? wr.partyDone('p1') : false;
    const acked = wr ? wr.partyAcked('p1') : false;
    // ① ack 집계 — 원장 {members 2, routed 1, bounced 1, delivered 1}·done(라우팅 완료)·acked(실수신 완료·delivered==routed).
    const tallied = rec && rec.members === 2 && rec.routed === 1 && rec.bounced === 1 && rec.delivered === 1 && done && acked;
    // ② 대조(OFF) — 집계 없으면 partyReceipts 비고. 전체 delivered(라우터 전역)는 양쪽 1(영수증 자체는 불변).
    const noAgg = wo && wo.partyReceipts.size === 0 && wo.delivered === 1 && wr.delivered === 1;
    const nonInvasive = on.inventory.minted === off.inventory.minted;
    const ok =
      check(tallied, `seed ${seed}: ack 집계 틀림(rec ${rec && JSON.stringify(rec)}·done ${done}·acked ${acked})`) &&
      check(noAgg, `seed ${seed}: OFF 집계 누설(size ${wo && wo.partyReceipts.size}·delivered ${wo && wo.delivered})`) &&
      check(nonInvasive, `seed ${seed}: 집계가 원장 권위 바꿈(minted on ${on.inventory.minted} off ${off.inventory.minted})`) &&
      check(ledgerConsistent(on) && itemConserved(on) && ledgerConsistent(off) && itemConserved(off), `seed ${seed}: 원장 자기-정합 깨짐`);
    console.log(`${pad(seed, 6)} | ${pad(rec ? rec.routed : 0, 6)} | ${pad(rec ? rec.bounced : 0, 7)} | ${pad(rec ? rec.delivered : 0, 9)} | ${pad(done + '', 4)} | ${pad(acked + '', 5)} | ${pad(wo ? wo.partyReceipts.size : 0, 9)} | ${pad(nonInvasive + '', 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 파티 전송이 *결정*(0083 routed/bounced·done)과 *확인*(0088 delivered·acked) 두 완료 기준을 갖는다: 라우팅을 결정했는가 vs 모든 up 멤버가 실제로 받았는가. 1:1 영수증(0076 delivered)의 1:N 집계 완성(SPINE 계층3 소셜).');
  console.log('    partyReceipt 미설정 = 0087 비트 동일(집계 0·reg). 비-침습: 집계는 추가 회계일 뿐 라우팅·영수증·원장 권위 불변(delivered/minted ON==OFF)·존 tick 밖 순수 반응형.');
}

kit.MODES['pack'] = pack;
kit.ORDER.splice(1, 0, 'pack');

(async () => { process.exit(await kit.cli(process.argv)); })();
