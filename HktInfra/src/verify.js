// HktInfra step-0093 — 헤드리스 검증 (파티 incomplete 발행·관측)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `ppartyincpub`.
//   더한 한 조각: 0092 는 파티가 *부분 전달 종결*(incomplete)에 이르렀음을 라우터 내부 원장에만 둔다 — 운영/감사 평면은 파티 전송이 실패로 종결됐는지 못 본다(0092 §9). 0082 가 개별 전달 포기를 svc.whisper.failed 로, 0087 이 성공을 svc.whisper.delivered 로 발행했듯, 이 step 은 *파티 전송* 의 부분 실패 종결을 svc.party.incomplete{partyId,members,routed,delivered,failed} 로 발행 → audit 가 구독 관측. 0082 의 파티 판.
//   검증: ⒜ `reg`(키트) — partyIncompletePublish 미설정이면 0092 비트 동일(발행 0·구독 행 0). ⒝ `ppartyincpub`(가설) — 파티 'p1'(멤버 2: mbox ack·ranking 포기, partyAckGiveup ON). ON: partyIncompletePublished 1·audit svc.party.incomplete 1. OFF: 0·0. minted 동일(비침습).
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
const MEMBERS = ['mbox', 'ranking'];   // 둘 다 up. mbox=Mailbox(ack→delivered). ranking=수신함 없음(ack 0→포기·failed). → 1-of-2 incomplete.
const P_BASE = (seed, extra) => ({ seed, ticks: 90, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2,
  incremental: true, recovery: true, failover: true, inventory: true, itemOps: 30, chat: true, chatOps: 12, regions: 2,
  bus: true, audit: true, ranking: true, busResend: true, busOutAck: true, busMinWm: true,
  busConsumerLease: true, leaseSpan: 3, busLeaseLife: true, busLeaseAdapt: true, busLeaseGrace: true, cadencePrior: 6,
  busLeaseAudit: true, busLeasePresence: true, busPresenceRecover: true, recoverRetry: true, presencePublish: true,
  presenceMonitor: true, presenceBox: true, presenceReportBus: true, presenceShadow: true, presenceLease: true, hbTimeout: 3,
  presenceQuery: true, whisperRouter: true, rankDie: DEAD_DIE, whisperReceipt: true, deliverRetry: true, deliverTimeout: 4,
  deliverMaxRetries: 2, partyReceipt: true, partyAckGiveup: true,   // ranking 포기 → partyIncomplete(0092)
  parties: [{ at: PARTY_AT, from: 'client0', members: MEMBERS, body: 'party!', partyId: 'p1' }],
  ...extra });

function ppartyincpub(seeds) {
  console.log('== ppartyincpub: *가설* — 파티 incomplete 발행. 파티가 부분 전달 종결(incomplete)에 이르면 svc.party.incomplete 발행 → audit 가 관측(0082 failed 발행의 파티 판). partyIncompletePublish ON vs OFF ==');
  console.log("  파티 'p1'(멤버 2: mbox ack·ranking 포기). ON: partyIncompletePublished 1·audit svc.party.incomplete 1. OFF: 0·0(라우터 내부 원장에만).");
  console.log('seed   | incomplete | pub ON | audit ON | pub OFF | audit OFF | 비침습 | 판정');
  for (const seed of seeds) {
    const on  = run({ ...P_BASE(seed, { partyIncompletePublish: true }) });
    const off = run({ ...P_BASE(seed, { partyIncompletePublish: false }) });   // 발행 0(0092 동작)
    const wr = on.wrouter; const wo = off.wrouter;
    const incOn = wr ? wr.partyIncomplete('p1') : false;
    const pubOn = wr ? wr.partyIncompletePublished : -1;
    const pubOff = wo ? wo.partyIncompletePublished : -1;
    const auOn = on.audit ? (on.audit.seen.get('svc.party.incomplete') || 0) : -1;
    const auOff = off.audit ? (off.audit.seen.get('svc.party.incomplete') || 0) : -1;
    // ① 발행+관측 — 파티가 incomplete 종결·발행 1·audit 관측 1.
    const published = incOn && pubOn === 1 && auOn === 1;
    // ② 대조(OFF) — 발행 0·audit 미관측 0(라우터 내부 원장에만·incomplete 종결 자체는 0092 불변).
    const silent = wo && wo.partyIncomplete('p1') && pubOff === 0 && auOff === 0;
    const nonInvasive = on.inventory.minted === off.inventory.minted;
    const ok =
      check(published, `seed ${seed}: 발행/관측 틀림(inc ${incOn}·pub ${pubOn}·audit ${auOn}·기대 true/1/1)`) &&
      check(silent, `seed ${seed}: OFF 침묵 미재현(inc ${wo && wo.partyIncomplete('p1')}·pub ${pubOff}·audit ${auOff}·기대 true/0/0)`) &&
      check(nonInvasive, `seed ${seed}: 발행이 원장 권위 바꿈(minted on ${on.inventory.minted} off ${off.inventory.minted})`) &&
      check(ledgerConsistent(on) && itemConserved(on) && ledgerConsistent(off) && itemConserved(off), `seed ${seed}: 원장 자기-정합 깨짐`);
    console.log(`${pad(seed, 6)} | ${pad(incOn + '', 10)} | ${pad(pubOn, 6)} | ${pad(auOn, 8)} | ${pad(pubOff, 7)} | ${pad(auOff, 9)} | ${pad(nonInvasive + '', 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 파티 전달의 *수명주기 발행*이 완성된다: 멤버십 변경(svc.party.changed·0084)·개별 전달 실패/성공(svc.whisper.failed/delivered·0082/0087)에 더해 *파티 전송 실패 종결*(svc.party.incomplete·0093)을 같은 audit sink 가 한 스트림으로 본다 — 운영 평면이 1:N 전송의 부분 실패를 관측(SPINE 계층3·5).');
  console.log('    partyIncompletePublish 미설정 = 발행 0·구독 행 0 = 0092 비트 동일(reg). 비-침습: 발행은 관측 평면 추가일 뿐 라우팅·원장 권위 불변(minted ON==OFF)·존 tick 밖 순수 반응형.');
}

kit.MODES['ppartyincpub'] = ppartyincpub;
kit.ORDER.splice(1, 0, 'ppartyincpub');

(async () => { process.exit(await kit.cli(process.argv)); })();
