// HktInfra step-0084 — 헤드리스 검증 (증분 가입/탈퇴 + 멤버십 변경 발행)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `pchange`.
//   더한 한 조각: 0075 의 PartyService 는 멤버십을 partyCreate(*전체 목록 덮어쓰기*)로만 갱신했고, 변경이 *관측 불가*였다(0075 §9). 이 step 은 증분 명령 partyJoin/partyLeave(멤버 델타) + 변경 발행(svc.party.changed→audit)을 더한다. 0082 failedPublish·0060 presencePublish 의 멤버십 변경 판.
//   검증: ⒜ `reg`(키트) — partyChange 미설정·증분 명령 미주입이면 0083 비트 동일(발행 0). ⒝ `pchange`(가설) — 파티 'p1' 결성[a,b]→join c→leave a → 멤버십 [b,c]. ON(changePublish): 발행 2(join·leave)·audit 관측 2·joins 1·leaves 1. OFF: 발행 0·audit 0(멤버십 변경은 같되 관측 불가). minted 동일(비침습).
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { run, itemConserved, ledgerConsistent } = NET;
const { check, pad } = kit.helpers;

const DEAD_DIE = 14;
const P_BASE = (seed, extra) => ({ seed, ticks: 90, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2,
  incremental: true, recovery: true, failover: true, inventory: true, itemOps: 30, chat: true, chatOps: 12, regions: 2,
  bus: true, audit: true, ranking: true, busResend: true, busOutAck: true, busMinWm: true,
  busConsumerLease: true, leaseSpan: 3, busLeaseLife: true, busLeaseAdapt: true, busLeaseGrace: true, cadencePrior: 6,
  busLeaseAudit: true, busLeasePresence: true, busPresenceRecover: true, recoverRetry: true, presencePublish: true,
  presenceMonitor: true, presenceBox: true, presenceReportBus: true, presenceShadow: true, presenceLease: true, hbTimeout: 3,
  presenceQuery: true, whisperRouter: true, rankDie: DEAD_DIE, whisperReceipt: true, partyService: true,
  partyCreate: [{ at: 40, partyId: 'p1', members: ['a', 'b'] }],
  partyOps: [{ at: 50, op: 'join', partyId: 'p1', member: 'c' }, { at: 56, op: 'leave', partyId: 'p1', member: 'a' }],
  ...extra });

function pchange(seeds) {
  console.log('== pchange: *가설* — 증분 가입/탈퇴 + 멤버십 변경 발행. partyJoin/partyLeave(멤버 델타)로 멤버십을 증분 갱신, svc.party.changed 로 발행 → audit 관측. 0082 failedPublish 의 멤버십 변경 판. changePublish ON vs OFF ==');
  console.log("  파티 'p1' 결성[a,b]→join c→leave a → 멤버십 [b,c]. ON: 발행 2·audit 관측 2·joins 1·leaves 1. OFF: 발행 0·audit 0(멤버십은 같되 관측 불가).");
  console.log('seed   | members      | joins | leaves | published | audit관측 | OFF audit | OFF pub | 비침습 | 판정');
  for (const seed of seeds) {
    const on  = run({ ...P_BASE(seed, { partyChange: true }) });
    const off = run({ ...P_BASE(seed, {}) });   // changePublish OFF — 멤버십 증분 갱신은 같되 발행 0(0083 동작·관측 불가)
    const ps = on.pservice; const po = off.pservice;
    const mem = ps ? ps.membersOf('p1').slice().sort() : null;
    const memOff = po ? po.membersOf('p1').slice().sort() : null;
    const auON  = on.audit ? (on.audit.seen.get('svc.party.changed') || 0) : -1;
    const auOFF = off.audit ? (off.audit.seen.get('svc.party.changed') || 0) : -1;
    // ① 증분+발행 — 멤버십 [b,c](join c·leave a 반영)·발행 2(join·leave)·audit 관측 2·joins 1·leaves 1.
    const ok1 = mem && mem.length === 2 && mem[0] === 'b' && mem[1] === 'c' && ps.published === 2 && auON === 2 && ps.joins === 1 && ps.leaves === 1;
    // ② 대조(OFF) — 멤버십은 *같다*(증분 명령은 발행과 무관)·발행 0·audit 미관측.
    const ok2 = memOff && memOff.length === 2 && memOff[0] === 'b' && memOff[1] === 'c' && po.published === 0 && auOFF === 0;
    const nonInvasive = on.inventory.minted === off.inventory.minted;
    const ok =
      check(ok1, `seed ${seed}: 증분/발행 틀림(members ${mem}·pub ${ps && ps.published}·audit ${auON}·joins ${ps && ps.joins}·leaves ${ps && ps.leaves})`) &&
      check(ok2, `seed ${seed}: OFF 멤버십/발행 틀림(members ${memOff}·pub ${po && po.published}·audit ${auOFF})`) &&
      check(nonInvasive, `seed ${seed}: 발행이 원장 권위 바꿈(minted on ${on.inventory.minted} off ${off.inventory.minted})`) &&
      check(ledgerConsistent(on) && itemConserved(on) && ledgerConsistent(off) && itemConserved(off), `seed ${seed}: 원장 자기-정합 깨짐`);
    console.log(`${pad(seed, 6)} | ${pad(mem ? '[' + mem.join(',') + ']' : '-', 12)} | ${pad(ps ? ps.joins : 0, 5)} | ${pad(ps ? ps.leaves : 0, 6)} | ${pad(ps ? ps.published : 0, 9)} | ${pad(auON, 9)} | ${pad(auOFF, 9)} | ${pad(po ? po.published : 0, 7)} | ${pad(nonInvasive + '', 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 멤버십이 *증분 델타*(가입/탈퇴)로 갱신되고 그 변경이 버스로 발행돼 audit(발행자 무수정 소비자)가 본다 — 전체 목록 재전송(0075)과 무관측을 둘 다 해소. 0082 failedPublish 의 멤버십 변경 판(SPINE 계층3 길드/소셜).');
  console.log('    partyChange 미설정·증분 명령 미주입 = 0083 비트 동일(발행 0·reg). 비-침습: 발행 권위 0(원장 무관)·멤버십 ON==OFF·minted ON==OFF·존 tick 밖 순수 반응형·은닉(bus 만 알고 구독자 무지).');
}

kit.MODES['pchange'] = pchange;
kit.ORDER.splice(1, 0, 'pchange');

(async () => { process.exit(await kit.cli(process.argv)); })();
