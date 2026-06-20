// HktInfra step-0069 — 헤드리스 검증 (프레즌스 SSOT 질의 인터페이스: presmon 이 프레즌스 박스에 현재 상태를 pull·presenceQuery)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `presquery`.
//   더한 한 조각: 0064~0068 이 프레즌스 박스를 쓰기·발행·failover 까지 세웠다. 이제 *읽기 경로* — PresenceService 가 {type:'presenceQuery', consumer}→{type:'presenceReply', state} 로 현재 상태를 답한다(pull). 발행(push)이 전이 알림이면 질의(pull)는 현재 상태 조회 — "누가 어디에" SSOT 단일 조회처(귓속말/파티 라우팅 기반). presmon 이 첫 질의자: 관측한 'ranking'(→permanent) + *관측 못 한* 'inventory'(→up·이벤트로는 모름)을 질의해 독립 읽기 경로 증명.
//   검증: ⒜ `reg`(키트) — presenceQuery 미설정이면 0068 비트 동일(질의 0). ⒝ `presquery`(가설) — ON: presmon 질의→응답 무손실(repliesRecv==queriesSent==박스 repliesSent)·queried['ranking']=='permanent'(관측 일치)·queried['inventory']=='up'(미관측 소비자도 pull 로 앎·stateOf('inventory')==null)·관측 행동 ON==OFF(질의 비-침습). OFF: 질의 0. minted 동일.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { run, itemConserved, ledgerConsistent } = NET;
const { check, pad } = kit.helpers;

const DEAD_DIE = 14; const PERM = 99; const CAP = 3;
const P_BASE = (seed, extra) => ({ seed, ticks: 90, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2,
  incremental: true, recovery: true, failover: true, inventory: true, itemOps: 30, chat: true, chatOps: 12, regions: 2,
  bus: true, audit: true, ranking: true, busResend: true, busOutAck: true, busMinWm: true,
  busConsumerLease: true, leaseSpan: 3, busLeaseLife: true, busLeaseAdapt: true, busLeaseGrace: true, cadencePrior: 6,
  busLeaseAudit: true, busLeasePresence: true, busPresenceRecover: true, recoverRetry: true, presencePublish: true,
  presenceMonitor: true, presenceBox: true, presenceReportBus: true, presenceShadow: true, presenceLease: true, hbTimeout: 3,
  rankDie: DEAD_DIE, ...extra });

const pmState = (r) => r.presmon ? r.presmon.stateOf('ranking') : null;
const pmPerm = (r) => (r.presmon && r.presmon.permCount.get('ranking')) || 0;
const pmEvents = (r) => r.presmon ? r.presmon.events : -1;

function presquery(seeds) {
  console.log('== presquery: *가설* — presmon 이 프레즌스 박스 SSOT 를 질의(pull)해 현재 상태 조회. 관측한 ranking(→permanent) + 미관측 inventory(→up) 둘 다 앎(독립 읽기 경로). presenceQuery ON vs OFF ==');
  console.log(`  rankDie ${DEAD_DIE}·dropRecover ${PERM}·상한 ${CAP}. ON: 질의↔응답 무손실·queried[ranking]=permanent(관측 일치)·queried[inventory]=up(미관측도 pull 로 앎)·관측 ON==OFF(비-침습).`);
  console.log('seed   | presmon q/recv | box rx/sent | queried ranking | queried inventory | stateOf inv | 관측 ON==OFF | 비침습 | 판정');
  for (const seed of seeds) {
    const base = { dropRecover: PERM, recoverMaxRetries: CAP };
    const on  = run({ ...P_BASE(seed, { ...base, presenceQuery: true }) });
    const off = run({ ...P_BASE(seed, base) });   // presenceQuery OFF — presmon 질의 안 함(관찰만)
    const pm = on.presmon; const box = on.presence;
    // ① 질의↔응답 무손실 — presmon 질의 수 == 받은 응답 수 == 박스 응답 수(request/reply 닫힌 루프)
    const noLoss = pm.queriesSent > 0 && pm.repliesRecv === pm.queriesSent && box.repliesSent === pm.queriesSent && box.queriesRx === pm.queriesSent;
    // ② 관측 일치 — pull 로 받은 ranking 상태 == 관측한 상태(permanent). 미관측 inventory 도 pull 로 'up'(이벤트로는 모름 → stateOf null).
    const rankAgree = pm.queriedOf('ranking') === 'permanent' && pm.stateOf('ranking') === 'permanent';
    const invPull = pm.queriedOf('inventory') === 'up' && pm.stateOf('inventory') === null;   // 독립 읽기 경로: 구독 못 한 소비자 상태를 질의로 앎
    // ③ 질의는 비-침습 — 관측(events/state) ON==OFF, OFF 는 질의 0
    const observeEq = pmState(on) === pmState(off) && pmEvents(on) === pmEvents(off) && pmPerm(on) === pmPerm(off) && pmState(on) === 'permanent';
    const offSilent = off.presmon.queriesSent === 0 && off.presmon.queried.size === 0;
    const nonInvasive = on.inventory.minted === off.inventory.minted;
    const ok =
      check(noLoss, `seed ${seed}: 질의↔응답 손실(q ${pm.queriesSent} recv ${pm.repliesRecv} boxSent ${box.repliesSent} boxRx ${box.queriesRx})`) &&
      check(rankAgree, `seed ${seed}: ranking pull!=관측(queried ${pm.queriedOf('ranking')} state ${pm.stateOf('ranking')})`) &&
      check(invPull, `seed ${seed}: inventory 독립 읽기 실패(queried ${pm.queriedOf('inventory')} state ${pm.stateOf('inventory')} — 기대 up/null)`) &&
      check(observeEq, `seed ${seed}: 질의가 관측 바꿈(on ${pmState(on)}/${pmEvents(on)} off ${pmState(off)}/${pmEvents(off)})`) &&
      check(offSilent, `seed ${seed}: OFF 인데 질의함(q ${off.presmon.queriesSent})`) &&
      check(nonInvasive, `seed ${seed}: 질의가 원장 권위 바꿈(minted on ${on.inventory.minted} off ${off.inventory.minted})`) &&
      check(ledgerConsistent(on) && itemConserved(on) && ledgerConsistent(off) && itemConserved(off), `seed ${seed}: 원장 자기-정합 깨짐`);
    console.log(`${pad(seed, 6)} | ${pad(pm.queriesSent + '/' + pm.repliesRecv, 14)} | ${pad(box.queriesRx + '/' + box.repliesSent, 11)} | ${pad(pm.queriedOf('ranking') + '', 15)} | ${pad(pm.queriedOf('inventory') + '', 17)} | ${pad(pm.stateOf('inventory') + '', 11)} | ${pad(observeEq + '', 12)} | ${pad(nonInvasive + '', 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 발행(push·전이 알림) 위에 질의(pull·현재 상태 조회)를 더해 프레즌스 박스가 "누가 어디에" SSOT 의 단일 조회처가 된다(귓속말/파티/핸드오프 라우팅의 미래 읽기 기반·SPINE 계층 5). 구독 못 한 소비자(inventory) 상태도 질의로 알 수 있다 = 독립 읽기 경로(발행 구독과 직교).');
  console.log('    presenceQuery 미설정 = 0068 비트 동일(질의 0·reg). 질의는 순수 읽기(SSOT 무변경)·관측 행동 ON==OFF·비-침습(minted 동일). request/reply 닫힌 루프(무손실).');
}

kit.MODES['presquery'] = presquery;
kit.ORDER.splice(1, 0, 'presquery');

(async () => { process.exit(await kit.cli(process.argv)); })();
