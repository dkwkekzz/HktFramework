// HktInfra step-0073 — 헤드리스 검증 (파티 라우터: 다중 대상 팬아웃 1:N·party)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `party`.
//   더한 한 조각: 0071/0072 의 귓속말은 1:1(대상 1명)이었다. 이 step 은 같은 라우터에 {type:'party', members:[...]} 를 더한다 — 한 요청이 N 멤버 각각의 상태를 프레즌스 SSOT 에 질의하고, 응답마다 멤버별 라우팅(up=전달·down/permanent=반송) → 한 요청에서 *부분 전달*(일부 전달·일부 반송)이 자연 발생. SPINE 계층3 채팅/소셜 1:N 팬아웃 + 계층5 프레즌스 질의 소비.
//   검증: ⒜ `reg`(키트) — 파티 미주입이면 0072 비트 동일(party 핸들러 휴면). ⒝ `party`(가설) — 멤버 ['inventory'(up),'chat'(up·미관측),'ranking'(permanent)] 1 파티 → parties 1·질의 3·routed 2(up 멤버)·bounced 1(permanent)·질의 무손실(recv==sent==3)·decision inv/chat=routed·rank=bounced. OFF(whisperRouter 끔): wrouter 부재 → 팬아웃 0. minted 동일(비-침습).
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { run, itemConserved, ledgerConsistent } = NET;
const { check, pad } = kit.helpers;

const DEAD_DIE = 14; const PERM = 99; const CAP = 3; const PARTY_AT = 80;
const MEMBERS = ['inventory', 'chat', 'ranking'];   // inventory up·chat up(미관측)·ranking permanent → 부분 전달(routed 2·bounced 1)
const P_BASE = (seed, extra) => ({ seed, ticks: 90, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2,
  incremental: true, recovery: true, failover: true, inventory: true, itemOps: 30, chat: true, chatOps: 12, regions: 2,
  bus: true, audit: true, ranking: true, busResend: true, busOutAck: true, busMinWm: true,
  busConsumerLease: true, leaseSpan: 3, busLeaseLife: true, busLeaseAdapt: true, busLeaseGrace: true, cadencePrior: 6,
  busLeaseAudit: true, busLeasePresence: true, busPresenceRecover: true, recoverRetry: true, presencePublish: true,
  presenceMonitor: true, presenceBox: true, presenceReportBus: true, presenceShadow: true, presenceLease: true, hbTimeout: 3,
  presenceQuery: true, rankDie: DEAD_DIE, ...extra });

function party(seeds) {
  console.log('== party: *가설* — 한 파티 요청이 N 멤버 각각 프레즌스 질의→부분 전달(up 전달·permanent 반송). 귓속말 1:1 → 파티 1:N. whisperRouter ON vs OFF ==');
  console.log(`  rankDie ${DEAD_DIE}·dropRecover ${PERM}·상한 ${CAP}·파티@${PARTY_AT} 멤버 [${MEMBERS}]. ON: parties 1·질의 3·routed 2·bounced 1·무손실. OFF: wrouter 부재→팬아웃 0.`);
  console.log('seed   | parties | queries q/recv | routed/bounced | decision inv/chat/rank | wrouter | 비침습 | 판정');
  for (const seed of seeds) {
    const base = { dropRecover: PERM, recoverMaxRetries: CAP,
      parties: [{ at: PARTY_AT, from: 'client0', members: MEMBERS, body: 'gg' }] };
    const on  = run({ ...P_BASE(seed, { ...base, whisperRouter: true }) });
    const off = run({ ...P_BASE(seed, base) });   // whisperRouter OFF — wrouter 부재(파티 주입 0·팬아웃 없음)
    const wr = on.wrouter;
    // ① 1:N 팬아웃 — 1 파티 요청이 멤버 수(3)만큼 질의로 전개·무손실(recv==sent==3).
    const fanout = wr && wr.parties === 1 && wr.queriesSent === 3 && wr.repliesRecv === 3;
    // ② 부분 전달 — up 멤버(inventory·chat) 전달(routed 2)·permanent 멤버(ranking) 반송(bounced 1).
    const partial = wr && wr.routed === 2 && wr.bounced === 1;
    const decisionOk = wr && wr.decisionOf('inventory') === 'routed' && wr.decisionOf('chat') === 'routed' && wr.decisionOf('ranking') === 'bounced';
    // ③ 대조(OFF) — whisperRouter 끄면 wrouter 박스 부재(팬아웃 인프라 없음).
    const offGap = off.wrouter === null;
    const nonInvasive = on.inventory.minted === off.inventory.minted;
    const ok =
      check(fanout, `seed ${seed}: 팬아웃 틀림(parties ${wr && wr.parties}·sent ${wr && wr.queriesSent}·recv ${wr && wr.repliesRecv})`) &&
      check(partial, `seed ${seed}: 부분 전달 틀림(routed ${wr && wr.routed} bounced ${wr && wr.bounced})`) &&
      check(decisionOk, `seed ${seed}: 라우팅 판정 틀림(inv ${wr && wr.decisionOf('inventory')} chat ${wr && wr.decisionOf('chat')} rank ${wr && wr.decisionOf('ranking')})`) &&
      check(offGap, `seed ${seed}: OFF 대조 깨짐(wrouter ${off.wrouter})`) &&
      check(nonInvasive, `seed ${seed}: 라우터가 원장 권위 바꿈(minted on ${on.inventory.minted} off ${off.inventory.minted})`) &&
      check(ledgerConsistent(on) && itemConserved(on) && ledgerConsistent(off) && itemConserved(off), `seed ${seed}: 원장 자기-정합 깨짐`);
    console.log(`${pad(seed, 6)} | ${pad((wr ? wr.parties : 0) + '', 7)} | ${pad((wr ? wr.queriesSent : 0) + '/' + (wr ? wr.repliesRecv : 0), 14)} | ${pad((wr ? wr.routed : 0) + '/' + (wr ? wr.bounced : 0), 14)} | ${pad((wr ? wr.decisionOf('inventory') : '-') + '/' + (wr ? wr.decisionOf('chat') : '-') + '/' + (wr ? wr.decisionOf('ranking') : '-'), 22)} | ${pad((on.wrouter ? 'box' : 'none'), 7)} | ${pad(nonInvasive + '', 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 한 파티 요청이 멤버 수만큼 프레즌스 질의로 전개되고, 각 멤버의 상태로 부분 전달(up 멤버 전달·permanent 멤버 반송)이 일어난다 — 귓속말 1:1(0071)이 파티 1:N 으로 확장. 같은 라우터·같은 질의 인터페이스(0069)·같은 라우팅 규칙을 멤버 루프로만 재사용.');
  console.log('    파티 미주입 = 0072 비트 동일(party 핸들러 휴면·reg). OFF 면 팬아웃 인프라 부재. 비-침습: 라우터 권위 0·minted ON==OFF·존 tick 밖 순수 반응형.');
}

kit.MODES['party'] = party;
kit.ORDER.splice(1, 0, 'party');

(async () => { process.exit(await kit.cli(process.argv)); })();
