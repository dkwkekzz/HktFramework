// HktInfra step-0092 — 헤드리스 검증 (파티 ack 타임아웃 포기·N-of-M 종결)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `ppartygiveup`.
//   더한 한 조각: 0088 의 파티 ack 집계는 delivered==routed 면 acked 로 종결하지만, 일부 멤버 전달이 영영 실패(수신측 사망·손실)하면 delivered<routed 에서 acked 가 영영 false 로 *매달린다* — 파티 전송에 종결 상태가 없다(0088 §9). 0078 의 전달 재시도 상한(deliverMaxRetries→포기·undeliverable)은 개별 전달 차원이지 파티 차원이 아니었다. 이 step 은 그 포기를 파티 원장에 귀속한다: 파티 멤버 전달이 포기되면 failed++ → partyIncomplete(done && delivered+failed==routed && failed>0)로 *부분 전달 종결*을 단정. 0078 포기의 파티 N-of-M 판.
//   검증: ⒜ `reg`(키트) — partyAckGiveup 미설정이면 0091 비트 동일(포기를 파티에 귀속 안 함·undeliverable 자체는 0078 불변). ⒝ `ppartygiveup`(가설) — 파티 'p1'(멤버 2: mbox up·ranking permanent). mbox 의 전달을 전량 손실(deliverDrop) → 재시도 상한(deliverMaxRetries) 후 포기. ON: rec {members 2,routed 1,bounced 1,delivered 0,failed 1}·done true·acked false·incomplete true·partyGiveups 1. OFF: failed 0·incomplete false(영구 보류). 둘 다 undeliverable 1(0078 불변)·minted 동일(비침습).
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
const MEMBERS = ['mbox', 'ranking'];   // 둘 다 up(라우팅됨). mbox=Mailbox(ack 함→delivered). ranking=수신함 없음(ack 0→재시도 상한 후 포기·failed). → 1-of-2 부분 전달.
const P_BASE = (seed, extra) => ({ seed, ticks: 90, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2,
  incremental: true, recovery: true, failover: true, inventory: true, itemOps: 30, chat: true, chatOps: 12, regions: 2,
  bus: true, audit: true, ranking: true, busResend: true, busOutAck: true, busMinWm: true,
  busConsumerLease: true, leaseSpan: 3, busLeaseLife: true, busLeaseAdapt: true, busLeaseGrace: true, cadencePrior: 6,
  busLeaseAudit: true, busLeasePresence: true, busPresenceRecover: true, recoverRetry: true, presencePublish: true,
  presenceMonitor: true, presenceBox: true, presenceReportBus: true, presenceShadow: true, presenceLease: true, hbTimeout: 3,
  presenceQuery: true, whisperRouter: true, rankDie: DEAD_DIE, whisperReceipt: true, deliverRetry: true, deliverTimeout: 4,
  deliverMaxRetries: 2,   // ranking(수신함 없음) 전달이 재시도 상한 후 포기되도록
  partyReceipt: true,   // 파티 원장(0083/0088) — 이 위에 포기 귀속(0092)을 검증
  parties: [{ at: PARTY_AT, from: 'client0', members: MEMBERS, body: 'party!', partyId: 'p1' }],
  ...extra });

function ppartygiveup(seeds) {
  console.log('== ppartygiveup: *가설* — 파티 ack 타임아웃 포기. 멤버 전달이 deliverMaxRetries 로 포기되면 그 파티 failed++ → partyIncomplete 로 부분 전달 종결(0078 포기의 파티 N-of-M 판). partyAckGiveup ON vs OFF ==');
  console.log("  파티 'p1'(멤버 2 둘 다 up: mbox ack·ranking 수신함 없어 포기). ON: rec {routed 2,bounced 0,delivered 1,failed 1}·incomplete true·partyGiveups 1·acked false. OFF: failed 0·incomplete false(영구 보류). 둘 다 undeliverable 1·delivered 1.");
  console.log('seed   | routed | bounced | delivered | failed ON | done | inc ON | undel ON | inc OFF | 비침습 | 판정');
  for (const seed of seeds) {
    const on  = run({ ...P_BASE(seed, { partyAckGiveup: true }) });
    const off = run({ ...P_BASE(seed, { partyAckGiveup: false }) });   // 포기를 파티에 귀속 안 함(0091 동작)
    const wr = on.wrouter; const wo = off.wrouter;
    const rec = wr ? wr.partyReceipts.get('p1') : null;
    const done = wr ? wr.partyDone('p1') : false;
    const incOn = wr ? wr.partyIncomplete('p1') : false;
    const incOff = wo ? wo.partyIncomplete('p1') : false;
    const ackedOn = wr ? wr.partyAcked('p1') : false;
    // ① 포기 종결 — rec {routed 2,bounced 0,delivered 1,failed 1}·done·incomplete·acked false·partyGiveups 1(1-of-2 부분 전달).
    const closed = rec && rec.routed === 2 && rec.bounced === 0 && rec.delivered === 1 && rec.failed === 1 && done && incOn && !ackedOn && wr.partyGiveups === 1;
    // ② 대조(OFF) — 포기를 파티에 귀속 안 하면 failed 0·incomplete false(영구 보류). undeliverable 자체는 양쪽 1(0078 불변).
    const hung = wo && wo.partyReceipts.get('p1') && wo.partyReceipts.get('p1').failed === 0 && !incOff && wo.partyGiveups === 0 && wr.undeliverable === 1 && wo.undeliverable === 1;
    const nonInvasive = on.inventory.minted === off.inventory.minted;
    const ok =
      check(closed, `seed ${seed}: 포기 종결 틀림(rec ${rec && JSON.stringify(rec)}·done ${done}·inc ${incOn}·giveups ${wr && wr.partyGiveups})`) &&
      check(hung, `seed ${seed}: OFF 보류 미재현(failed ${wo && wo.partyReceipts.get('p1') && wo.partyReceipts.get('p1').failed}·inc ${incOff}·undel on ${wr && wr.undeliverable}/off ${wo && wo.undeliverable})`) &&
      check(nonInvasive, `seed ${seed}: 포기 귀속이 원장 권위 바꿈(minted on ${on.inventory.minted} off ${off.inventory.minted})`) &&
      check(ledgerConsistent(on) && itemConserved(on) && ledgerConsistent(off) && itemConserved(off), `seed ${seed}: 원장 자기-정합 깨짐`);
    console.log(`${pad(seed, 6)} | ${pad(rec ? rec.routed : 0, 6)} | ${pad(rec ? rec.bounced : 0, 7)} | ${pad(rec ? rec.delivered : 0, 9)} | ${pad(rec ? rec.failed : 0, 9)} | ${pad(done + '', 4)} | ${pad(incOn + '', 6)} | ${pad(wr ? wr.undeliverable : 0, 8)} | ${pad(incOff + '', 7)} | ${pad(nonInvasive + '', 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 파티 전송은 *세 종결*을 갖는다: done(라우팅 결정·0083)·acked(전원 실수신·0088)·incomplete(일부 영구 실패·0092). 0088 까지 일부 멤버가 영영 실패하면 acked 가 false 로 매달려 종결이 없었다 — 0078 의 개별 전달 포기를 파티 차원으로 끌어올려 N-of-M 부분 전달을 *명시적으로 종결*한다(SPINE 계층3·5).');
  console.log('    partyAckGiveup 미설정 = 포기를 파티에 귀속 안 함 = 0091 비트 동일(undeliverable 자체는 0078 불변). 비-침습: failed 집계는 추가 회계일 뿐 라우팅·영수증·원장 권위 불변(minted ON==OFF)·존 tick 밖 순수 반응형.');
}

kit.MODES['ppartygiveup'] = ppartygiveup;
kit.ORDER.splice(1, 0, 'ppartygiveup');

(async () => { process.exit(await kit.cli(process.argv)); })();
