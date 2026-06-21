// HktInfra step-0075 — 헤드리스 검증 (파티 멤버십 SSOT·partyService)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `partysvc`.
//   더한 한 조각: 0073 의 파티 라우터는 멤버 목록을 요청에 *인라인*으로 받았다(멤버십과 라우팅이 섞임). 이 step 은 멤버십을 전용 박스 PartyService 로 분리 — 클라가 파티 결성(partyCreate)하면 PartyService 가 멤버십 SSOT 를 보유하고, 라우터는 파티 전송 시 멤버 목록을 *질의*(partyQuery→partyMembers)로 얻는다 → 멤버십 SSOT→프레즌스 SSOT(0069)→라우팅 의 2단 조회. 멤버십 ⟂ 라우팅 분리(SPINE 계층3 길드/소셜).
//   검증: ⒜ `reg`(키트) — partyService 미설정이면 0074 비트 동일(pservice 박스 0). ⒝ `partysvc`(가설) — 파티 P1=[inventory(up),chat(up),ranking(permanent)] 결성 후 partyTo P1(멤버 인라인 X). ON: 라우터가 멤버십 질의(membershipQueries 1)→멤버 3 해소(membersResolved 3)→프레즌스 질의 3→routed 2·bounced 1. OFF(partyService 끔): membershipAddr null → partyTo 미해소(membershipQueries 0·routed+bounced 0). minted 동일(비-침습).
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { run, itemConserved, ledgerConsistent } = NET;
const { check, pad } = kit.helpers;

const DEAD_DIE = 14; const PERM = 99; const CAP = 3; const CREATE_AT = 76; const PARTY_AT = 80;
const MEMBERS = ['inventory', 'chat', 'ranking'];   // inventory up·chat up(미관측)·ranking permanent → 부분 전달(routed 2·bounced 1)
const P_BASE = (seed, extra) => ({ seed, ticks: 90, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2,
  incremental: true, recovery: true, failover: true, inventory: true, itemOps: 30, chat: true, chatOps: 12, regions: 2,
  bus: true, audit: true, ranking: true, busResend: true, busOutAck: true, busMinWm: true,
  busConsumerLease: true, leaseSpan: 3, busLeaseLife: true, busLeaseAdapt: true, busLeaseGrace: true, cadencePrior: 6,
  busLeaseAudit: true, busLeasePresence: true, busPresenceRecover: true, recoverRetry: true, presencePublish: true,
  presenceMonitor: true, presenceBox: true, presenceReportBus: true, presenceShadow: true, presenceLease: true, hbTimeout: 3,
  presenceQuery: true, whisperRouter: true, rankDie: DEAD_DIE,
  partyCreate: [{ at: CREATE_AT, from: 'client0', partyId: 'P1', members: MEMBERS }],
  partyTo: [{ at: PARTY_AT, from: 'client0', partyId: 'P1', body: 'gg' }],
  ...extra });

function partysvc(seeds) {
  console.log('== partysvc: *가설* — 멤버십을 전용 박스(PartyService)로 분리. 라우터가 partyTo(멤버 인라인 X) 시 멤버십 SSOT 질의→멤버 해소→프레즌스 질의→라우팅(2단 조회). partyService ON vs OFF ==');
  console.log(`  파티 P1=[${MEMBERS}] 결성@${CREATE_AT}·전송@${PARTY_AT}. ON: membershipQueries 1·membersResolved 3·routed 2·bounced 1. OFF: membershipAddr null→partyTo 미해소(0·0).`);
  console.log('seed   | memQ/resolved | queries q/recv | routed/bounced | decision inv/chat/rank | pservice | 비침습 | 판정');
  for (const seed of seeds) {
    const base = { dropRecover: PERM, recoverMaxRetries: CAP };
    const on  = run({ ...P_BASE(seed, { ...base, partyService: true }) });
    const off = run({ ...P_BASE(seed, base) });   // partyService OFF — pservice 박스 부재·라우터 membershipAddr null(partyTo 미해소)
    const wr = on.wrouter; const ps = on.pservice; const wo = off.wrouter;
    // ① 멤버십 SSOT 조회 — 라우터가 인라인 멤버 없이 PartyService 에 질의(membershipQueries 1)·멤버 3 해소(membersResolved 3). PartyService 가 멤버십 보유(creates 1·repliesSent 1).
    const membership = wr && ps && wr.membershipQueries === 1 && wr.membersResolved === 3 && ps.creates === 1 && ps.repliesSent === 1;
    // ② 2단 조회 끝 라우팅 — 멤버마다 프레즌스 질의(q/recv 3/3 무손실)→부분 전달(routed 2 up·bounced 1 permanent).
    const routed = wr && wr.queriesSent === 3 && wr.repliesRecv === 3 && wr.routed === 2 && wr.bounced === 1;
    const decisionOk = wr && wr.decisionOf('inventory') === 'routed' && wr.decisionOf('chat') === 'routed' && wr.decisionOf('ranking') === 'bounced';
    // ③ 대조(OFF) — 멤버십 SSOT 부재(membershipAddr null) → partyTo 미해소(질의 0·라우팅 0). pservice 박스도 없음.
    const offGap = off.pservice === null && wo && wo.membershipQueries === 0 && (wo.routed + wo.bounced) === 0;
    const nonInvasive = on.inventory.minted === off.inventory.minted;
    const ok =
      check(membership, `seed ${seed}: 멤버십 조회 틀림(memQ ${wr && wr.membershipQueries}·resolved ${wr && wr.membersResolved}·creates ${ps && ps.creates})`) &&
      check(routed, `seed ${seed}: 2단 라우팅 틀림(q ${wr && wr.queriesSent} recv ${wr && wr.repliesRecv} routed ${wr && wr.routed} bounced ${wr && wr.bounced})`) &&
      check(decisionOk, `seed ${seed}: 라우팅 판정 틀림(inv ${wr && wr.decisionOf('inventory')} chat ${wr && wr.decisionOf('chat')} rank ${wr && wr.decisionOf('ranking')})`) &&
      check(offGap, `seed ${seed}: OFF 갭 미재현(pservice ${off.pservice}·memQ ${wo && wo.membershipQueries}·routed ${wo && wo.routed}·bounced ${wo && wo.bounced})`) &&
      check(nonInvasive, `seed ${seed}: 멤버십/라우터가 원장 권위 바꿈(minted on ${on.inventory.minted} off ${off.inventory.minted})`) &&
      check(ledgerConsistent(on) && itemConserved(on) && ledgerConsistent(off) && itemConserved(off), `seed ${seed}: 원장 자기-정합 깨짐`);
    console.log(`${pad(seed, 6)} | ${pad((wr ? wr.membershipQueries : 0) + '/' + (wr ? wr.membersResolved : 0), 13)} | ${pad((wr ? wr.queriesSent : 0) + '/' + (wr ? wr.repliesRecv : 0), 14)} | ${pad((wr ? wr.routed : 0) + '/' + (wr ? wr.bounced : 0), 14)} | ${pad((wr ? wr.decisionOf('inventory') : '-') + '/' + (wr ? wr.decisionOf('chat') : '-') + '/' + (wr ? wr.decisionOf('ranking') : '-'), 22)} | ${pad((on.pservice ? 'box' : 'none'), 8)} | ${pad(nonInvasive + '', 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 멤버십(누가 어느 파티)이 전용 박스 PartyService 의 SSOT 로 분리되고, 라우터는 파티 전송 시 멤버 목록을 *질의*로 얻는다 — 멤버십 SSOT→프레즌스 SSOT(0069)→라우팅 의 2단 조회. 라우터는 멤버 목록을 인라인으로 받지 않는다(멤버십 ⟂ 라우팅 관심사 분리·SPINE 계층3 길드/소셜).');
  console.log('    partyService 미설정 = 0074 비트 동일(pservice 박스 0·reg). OFF 면 멤버십 SSOT 부재로 partyTo 미해소. 비-침습: 멤버십·라우터 권위 0(원장 무관)·minted ON==OFF·존 tick 밖 순수 반응형.');
}

kit.MODES['partysvc'] = partysvc;
kit.ORDER.splice(1, 0, 'partysvc');

(async () => { process.exit(await kit.cli(process.argv)); })();
