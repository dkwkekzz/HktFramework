// HktInfra step-0083 — 헤드리스 검증 (파티 1:N 라우팅 영수증 집계)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `pagg`.
//   더한 한 조각: 0073/0075 의 파티 팬아웃은 멤버마다 라우팅(전달/반송)하지만 *파티 단위 완료*를 집계하지 않는다 — "N 멤버 중 몇에 전달/반송, 다 끝났는가"를 모른다(0073 §9). 이 step 은 partyId 별 영수증 원장({members,routed,bounced})을 더해, 멤버 라우팅 판정을 파티에 집계 → routed+bounced==members 면 파티 전송 완료(부분 전달 가시). 1:1 영수증(0076)의 1:N 집계 판.
//   검증: ⒜ `reg`(키트) — partyReceipt 미설정이면 0082 비트 동일(집계 0). ⒝ `pagg`(가설) — 파티 'p1'(멤버 3: inventory up·mbox up·ranking permanent[죽음])→집계 {members 3, routed 2, bounced 1}·완료. ON: partyReceipts.size 1·done true. OFF: 집계 0(파티는 멤버별 라우팅만·routed 2/bounced 1 동일). minted 동일(비침습).
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
const MEMBERS = ['inventory', 'mbox', 'ranking'];   // inventory up·mbox up·ranking 은 rankDie 후 permanent → routed 2/bounced 1
const P_BASE = (seed, extra) => ({ seed, ticks: 90, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2,
  incremental: true, recovery: true, failover: true, inventory: true, itemOps: 30, chat: true, chatOps: 12, regions: 2,
  bus: true, audit: true, ranking: true, busResend: true, busOutAck: true, busMinWm: true,
  busConsumerLease: true, leaseSpan: 3, busLeaseLife: true, busLeaseAdapt: true, busLeaseGrace: true, cadencePrior: 6,
  busLeaseAudit: true, busLeasePresence: true, busPresenceRecover: true, recoverRetry: true, presencePublish: true,
  presenceMonitor: true, presenceBox: true, presenceReportBus: true, presenceShadow: true, presenceLease: true, hbTimeout: 3,
  presenceQuery: true, whisperRouter: true, rankDie: DEAD_DIE, whisperReceipt: true, deliverRetry: true,
  recoverMaxRetries: 3, dropRecover: 99,   // ranking 치유를 막아 permanentDown 으로 — 파티 멤버 중 1명을 확정 반송(부분 전달 시연)
  deliverTimeout: 4, parties: [{ at: PARTY_AT, from: 'client0', members: MEMBERS, body: 'party!', partyId: 'p1' }],
  ...extra });

function pagg(seeds) {
  console.log('== pagg: *가설* — 파티 1:N 라우팅 영수증 집계. partyId 별 {members,routed,bounced} 원장으로 멤버 판정을 파티에 집계 → routed+bounced==members 면 파티 완료(부분 전달 가시). 1:1 영수증의 1:N 집계 판. partyReceipt ON vs OFF ==');
  console.log(`  파티 'p1'(멤버 ${MEMBERS.length}: inventory up·mbox up·ranking permanent). ON: 집계 {members 3, routed 2, bounced 1}·done true. OFF: 집계 0(멤버별 라우팅만·routed/bounced 총계는 동일).`);
  console.log('seed   | parties | routed | bounced | rec.members | rec.routed | rec.bounced | done | OFF rec수 | 비침범 | 판정');
  for (const seed of seeds) {
    const on  = run({ ...P_BASE(seed, { partyReceipt: true }) });
    const off = run({ ...P_BASE(seed, {}) });   // partyReceipt OFF — 파티는 멤버별 라우팅만(0082 동작)·집계 0
    const wr = on.wrouter; const wo = off.wrouter;
    const rec = wr ? wr.partyReceipts.get('p1') : null;
    const done = wr ? wr.partyDone('p1') : false;
    // ① 집계 — 파티 'p1' 원장 {members 3, routed 2, bounced 1}·완료(routed+bounced==members). 전체 routed/bounced 총계는 OFF 와 동일(집계는 비침습 회계).
    const aggregated = rec && rec.members === 3 && rec.routed === 2 && rec.bounced === 1 && done &&
      wr.routed === 2 && wr.bounced === 1 && wr.partyReceipts.size === 1;
    // ② 대조(OFF) — 집계 없으면 partyReceipts 비고: 단 멤버별 라우팅 총계(routed 2/bounced 1)는 같다(집계는 *추가 회계*일 뿐 라우팅 불변).
    const noAgg = wo && wo.partyReceipts.size === 0 && wo.routed === 2 && wo.bounced === 1;
    const nonInvasive = on.inventory.minted === off.inventory.minted;
    const ok =
      check(aggregated, `seed ${seed}: 집계 틀림(rec ${rec && JSON.stringify(rec)}·done ${done}·routed ${wr && wr.routed}/bounced ${wr && wr.bounced}·size ${wr && wr.partyReceipts.size})`) &&
      check(noAgg, `seed ${seed}: OFF 집계 누설(size ${wo && wo.partyReceipts.size}·routed ${wo && wo.routed}/bounced ${wo && wo.bounced})`) &&
      check(nonInvasive, `seed ${seed}: 집계가 원장 권위 바꿈(minted on ${on.inventory.minted} off ${off.inventory.minted})`) &&
      check(ledgerConsistent(on) && itemConserved(on) && ledgerConsistent(off) && itemConserved(off), `seed ${seed}: 원장 자기-정합 깨짐`);
    console.log(`${pad(seed, 6)} | ${pad(wr ? wr.parties : 0, 7)} | ${pad(wr ? wr.routed : 0, 6)} | ${pad(wr ? wr.bounced : 0, 7)} | ${pad(rec ? rec.members : 0, 11)} | ${pad(rec ? rec.routed : 0, 10)} | ${pad(rec ? rec.bounced : 0, 11)} | ${pad(done + '', 4)} | ${pad(wo ? wo.partyReceipts.size : 0, 9)} | ${pad(nonInvasive + '', 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 1:N 파티 팬아웃이 *파티 단위 완료 원장*을 얻는다: 멤버 라우팅 판정(up=routed·permanent=bounced)을 partyId 에 집계해 routed+bounced==members 면 전송 완료(부분 전달 N-of-M 가시). 개별 영수증(0076·delivered)의 1:N 집계 판(SPINE 계층3 소셜).');
  console.log('    partyReceipt 미설정 = 0082 비트 동일(집계 0·reg). 비-침습: 집계는 *추가 회계*일 뿐 라우팅·원장 권위 불변(routed/bounced/minted ON==OFF)·존 tick 밖 순수 반응형.');
}

kit.MODES['pagg'] = pagg;
kit.ORDER.splice(1, 0, 'pagg');

(async () => { process.exit(await kit.cli(process.argv)); })();
