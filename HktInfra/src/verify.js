// HktInfra step-0095 — 헤드리스 검증 (파티 complete 발행·성공 종결 관측)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `ppartycomplete`.
//   더한 한 조각: 0093 은 파티 *실패* 종결(svc.party.incomplete)만 발행했다 — 0082→0087 이 개별 전달 실패+성공으로 수명주기를 완성했듯, 파티 차원에도 *성공 종결*(전원 acked)이 빠져 운영 평면이 실패 절반만 봤다(0093 §9). 이 step 은 파티가 acked(routed>0 && delivered==routed)에 *처음* 이르면 svc.party.complete{partyId,members,routed,delivered} 발행 → audit 구독. 0087 deliveredPublish 의 파티 판·0093 incomplete 와 짝.
//   검증: ⒜ `reg`(키트) — partyCompletePublish 미설정이면 0094 비트 동일(발행 0·구독 행 0). ⒝ `ppartycomplete`(가설) — 파티 'p1'(멤버 1: mbox up·ack). ON: partyCompletePublished 1·audit svc.party.complete 1·acked true. OFF: 0·0. minted 동일(비침습).
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
const MEMBERS = ['mbox'];   // 단일 up 멤버(Mailbox)→전달·ack→delivered==routed=acked(성공 종결).
const P_BASE = (seed, extra) => ({ seed, ticks: 90, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2,
  incremental: true, recovery: true, failover: true, inventory: true, itemOps: 30, chat: true, chatOps: 12, regions: 2,
  bus: true, audit: true, ranking: true, busResend: true, busOutAck: true, busMinWm: true,
  busConsumerLease: true, leaseSpan: 3, busLeaseLife: true, busLeaseAdapt: true, busLeaseGrace: true, cadencePrior: 6,
  busLeaseAudit: true, busLeasePresence: true, busPresenceRecover: true, recoverRetry: true, presencePublish: true,
  presenceMonitor: true, presenceBox: true, presenceReportBus: true, presenceShadow: true, presenceLease: true, hbTimeout: 3,
  presenceQuery: true, whisperRouter: true, rankDie: DEAD_DIE, whisperReceipt: true, deliverRetry: true, deliverTimeout: 4,
  partyReceipt: true,
  parties: [{ at: PARTY_AT, from: 'client0', members: MEMBERS, body: 'party!', partyId: 'p1' }],
  ...extra });

function ppartycomplete(seeds) {
  console.log('== ppartycomplete: *가설* — 파티 complete 발행. 파티가 전원 acked(성공 종결)에 이르면 svc.party.complete 발행 → audit 관측(0087 성공 발행의 파티 판·0093 incomplete 와 짝). partyCompletePublish ON vs OFF ==');
  console.log("  파티 'p1'(멤버 1: mbox up·ack). ON: partyCompletePublished 1·audit svc.party.complete 1·acked true. OFF: 0·0(라우터 내부 원장에만).");
  console.log('seed   | acked | pub ON | audit ON | pub OFF | audit OFF | 비침습 | 판정');
  for (const seed of seeds) {
    const on  = run({ ...P_BASE(seed, { partyCompletePublish: true }) });
    const off = run({ ...P_BASE(seed, { partyCompletePublish: false }) });   // 발행 0(0094 동작)
    const wr = on.wrouter; const wo = off.wrouter;
    const ackOn = wr ? wr.partyAcked('p1') : false;
    const pubOn = wr ? wr.partyCompletePublished : -1;
    const pubOff = wo ? wo.partyCompletePublished : -1;
    const auOn = on.audit ? (on.audit.seen.get('svc.party.complete') || 0) : -1;
    const auOff = off.audit ? (off.audit.seen.get('svc.party.complete') || 0) : -1;
    // ① 발행+관측 — 파티 acked(성공 종결)·발행 1·audit 관측 1.
    const published = ackOn && pubOn === 1 && auOn === 1;
    // ② 대조(OFF) — 발행 0·audit 미관측 0(acked 종결 자체는 0094 불변).
    const silent = wo && wo.partyAcked('p1') && pubOff === 0 && auOff === 0;
    const nonInvasive = on.inventory.minted === off.inventory.minted;
    const ok =
      check(published, `seed ${seed}: 발행/관측 틀림(acked ${ackOn}·pub ${pubOn}·audit ${auOn}·기대 true/1/1)`) &&
      check(silent, `seed ${seed}: OFF 침묵 미재현(acked ${wo && wo.partyAcked('p1')}·pub ${pubOff}·audit ${auOff}·기대 true/0/0)`) &&
      check(nonInvasive, `seed ${seed}: 발행이 원장 권위 바꿈(minted on ${on.inventory.minted} off ${off.inventory.minted})`) &&
      check(ledgerConsistent(on) && itemConserved(on) && ledgerConsistent(off) && itemConserved(off), `seed ${seed}: 원장 자기-정합 깨짐`);
    console.log(`${pad(seed, 6)} | ${pad(ackOn + '', 5)} | ${pad(pubOn, 6)} | ${pad(auOn, 8)} | ${pad(pubOff, 7)} | ${pad(auOff, 9)} | ${pad(nonInvasive + '', 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 파티 전송 발행 수명주기가 완성된다: 멤버십 변경(svc.party.changed·0084) + 실패 종결(svc.party.incomplete·0093) + *성공 종결*(svc.party.complete·0095). 같은 audit sink 가 1:N 전송의 성공·실패 양 끝을 본다(0082+0087 개별 전달 수명주기의 파티 판·SPINE 계층3·5).');
  console.log('    partyCompletePublish 미설정 = 발행 0·구독 행 0 = 0094 비트 동일(reg). 비-침습: 발행은 관측 평면 추가일 뿐 라우팅·원장 권위 불변(minted ON==OFF)·존 tick 밖 순수 반응형.');
}

kit.MODES['ppartycomplete'] = ppartycomplete;
kit.ORDER.splice(1, 0, 'ppartycomplete');

(async () => { process.exit(await kit.cli(process.argv)); })();
