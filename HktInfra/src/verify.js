// HktInfra step-0096 — 헤드리스 검증 (멤버별 Mailbox 토폴로지·partyAcked N>1)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `pmemberbox`.
//   더한 한 조각: 0088~0095 의 파티 ack 집계·종결·발행은 *up 멤버가 Mailbox 를 가질 때만* delivered 에 기여한다 — 현 토폴로지엔 mbox 하나뿐이라 up 멤버 중 mbox 만 ack → up 멤버가 여럿이면 acked 가 영영 false(delivered<routed·0088 §9). 이 step 은 둘째 수신함(mbox2)을 더해 *멤버마다 자기 수신함*을 갖게 한다 → 모든 up 멤버가 ack → partyAcked/complete 가 N>1 에서 의미 있다. mailbox2 OFF 면 둘째 박스 0 = 0095 비트 동일.
//   검증: ⒜ `reg`(키트) — mailbox2 미설정이면 0095 비트 동일(박스 0). ⒝ `pmemberbox`(가설) — 파티 'p1'(멤버 2: mbox·mbox2). ON(mailbox2): 둘 다 수신함 보유→routed 2·delivered 2·acked true·mbox/mbox2 received 1씩. OFF: mbox2 수신함 없음→delivered 1<routed 2·acked false(0088 §9 한계). minted 동일(비침습).
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
const MEMBERS = ['mbox', 'mbox2'];   // 둘 다 up. ON 이면 둘 다 Mailbox→ack. OFF 면 mbox2 수신함 부재→ack 0.
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

function pmemberbox(seeds) {
  console.log('== pmemberbox: *가설* — 멤버별 Mailbox 토폴로지. 둘째 수신함(mbox2)을 더해 파티원마다 자기 수신함 → 모든 up 멤버 ack → partyAcked 가 N>1 에서 의미. mailbox2 ON vs OFF ==');
  console.log("  파티 'p1'(멤버 2: mbox·mbox2). ON: routed 2·delivered 2·acked true·mbox/mbox2 received 1씩. OFF: mbox2 수신함 없음→delivered 1·acked false(0088 §9 한계).");
  console.log('seed   | routed | deliv ON | acked ON | mb2 recv ON | deliv OFF | acked OFF | 비침습 | 판정');
  for (const seed of seeds) {
    const on  = run({ ...P_BASE(seed, { mailbox2: true }) });
    const off = run({ ...P_BASE(seed, { mailbox2: false }) });   // 둘째 박스 0(0095 동작)
    const wr = on.wrouter; const wo = off.wrouter;
    const recOn = wr ? wr.partyReceipts.get('p1') : null;
    const recOff = wo ? wo.partyReceipts.get('p1') : null;
    const ackOn = wr ? wr.partyAcked('p1') : false;
    const ackOff = wo ? wo.partyAcked('p1') : false;
    const mb2 = on.mbox2 ? on.mbox2.received : -1;
    // ① 멤버별 수신함 — routed 2·delivered 2·acked true·mbox/mbox2 각 received 1(모든 up 멤버 ack).
    const allAck = recOn && recOn.routed === 2 && recOn.delivered === 2 && ackOn && on.mbox && on.mbox.received === 1 && mb2 === 1;
    // ② 대조(OFF) — mbox2 수신함 부재면 delivered 1<routed 2·acked false(0088 §9 한계)·mbox2 박스 없음.
    const hung = recOff && recOff.routed === 2 && recOff.delivered === 1 && !ackOff && off.mbox2 === null;
    const nonInvasive = on.inventory.minted === off.inventory.minted;
    const ok =
      check(allAck, `seed ${seed}: 멤버별 ack 틀림(rec ${recOn && JSON.stringify(recOn)}·acked ${ackOn}·mb2 ${mb2}·기대 routed2/deliv2/true/1)`) &&
      check(hung, `seed ${seed}: OFF 한계 미재현(rec ${recOff && JSON.stringify(recOff)}·acked ${ackOff}·mbox2 ${off.mbox2}·기대 deliv1/false/null)`) &&
      check(nonInvasive, `seed ${seed}: 둘째 박스가 원장 권위 바꿈(minted on ${on.inventory.minted} off ${off.inventory.minted})`) &&
      check(ledgerConsistent(on) && itemConserved(on) && ledgerConsistent(off) && itemConserved(off), `seed ${seed}: 원장 자기-정합 깨짐`);
    console.log(`${pad(seed, 6)} | ${pad(recOn ? recOn.routed : 0, 6)} | ${pad(recOn ? recOn.delivered : 0, 8)} | ${pad(ackOn + '', 8)} | ${pad(mb2, 11)} | ${pad(recOff ? recOff.delivered : 0, 9)} | ${pad(ackOff + '', 9)} | ${pad(nonInvasive + '', 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → partyAcked(전원 실수신)는 *모든 up 멤버가 ack 가능*할 때만 의미 있다 — 멤버별 Mailbox 토폴로지가 그 전제를 세운다(0088 §9 해소). 0083~0095 의 파티 집계·종결·발행이 N>1 에서 정확해진다(SPINE 계층3·5: 파티원마다 독립 수신함 = 분산 1:N 전달의 실 토폴로지).');
  console.log('    mailbox2 미설정 = 둘째 박스 0 = 0095 비트 동일(reg). 비-침습: 둘째 수신함은 수신 토폴로지 추가일 뿐 라우팅·원장 권위 불변(minted ON==OFF)·존 tick 밖 순수 반응형.');
}

kit.MODES['pmemberbox'] = pmemberbox;
kit.ORDER.splice(1, 0, 'pmemberbox');

(async () => { process.exit(await kit.cli(process.argv)); })();
