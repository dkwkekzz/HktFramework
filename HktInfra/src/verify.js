// HktInfra step-0067 — 헤드리스 검증 (프레즌스 박스 failover 승격: primary 사망→standby active 승격·발행 인계·presencePromote)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `prespromote`.
//   더한 한 조각: 0066 의 standby(presence2)는 SSOT 를 그림자 복제만 했다(발행 억제). 이 step 은 마지막 고리 — primary 사망 시 standby 가 *승격*(active=true)해 svc.presence 발행을 인계한다(존 shadow follower 승격 0009·버스 failover 0034 의 코디네이션 판). shadow 가 모든 보고를 이미 먹었으므로 승격은 SSOT 갭 0: 죽음 전 보고는 둘 다 봤고(down@23), 죽음(t30) 후 보고(permanent@38)는 승격된 standby 가 발행 → 다운스트림(presmon)이 전 전이열(down→permanent) 무손실 수신.
//   검증: ⒜ `reg`(키트) — presenceFailover 미제공이면 0066 비트 동일(crash 0). ⒝ `prespromote`(가설) — ON: primary crash(t30)+standby promote→다운스트림 full 전이열(presmon 'permanent'·events 2)·발행 분담(primary down 1·standby permanent 1). OFF(미승격): primary 만 죽고 standby passive→permanent 영영 미발행(presmon 'down' 에 갇힘·events 1=갭). 비-침습(minted 동일).
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { run, itemConserved, ledgerConsistent } = NET;
const { check, pad } = kit.helpers;

const DEAD_DIE = 14; const PERM = 99; const CAP = 3; const FAIL_AT = 30;
const P_BASE = (seed, extra) => ({ seed, ticks: 90, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2,
  incremental: true, recovery: true, failover: true, inventory: true, itemOps: 30, chat: true, chatOps: 12, regions: 2,
  bus: true, audit: true, ranking: true, busResend: true, busOutAck: true, busMinWm: true,
  busConsumerLease: true, leaseSpan: 3, busLeaseLife: true, busLeaseAdapt: true, busLeaseGrace: true, cadencePrior: 6,
  busLeaseAudit: true, busLeasePresence: true, busPresenceRecover: true, recoverRetry: true, presencePublish: true,
  presenceMonitor: true, presenceBox: true, presenceReportBus: true, presenceShadow: true, rankDie: DEAD_DIE, ...extra });

const pmState = (r) => r.presmon ? r.presmon.stateOf('ranking') : null;
const pmPerm = (r) => (r.presmon && r.presmon.permCount.get('ranking')) || 0;
const pmEvents = (r) => r.presmon ? r.presmon.events : -1;
const setStr = (s) => '{' + [...s].sort() + '}';

function prespromote(seeds) {
  console.log('== prespromote: *가설* — primary 프레즌스 박스 사망(t' + FAIL_AT + ') 시 standby(presence2) 승격→svc.presence 발행 인계. shadow 덕에 SSOT 갭 0. presencePromote ON vs OFF(미승격 대조) ==');
  console.log(`  영구 분실(rankDie ${DEAD_DIE}·dropRecover ${PERM}·상한 ${CAP}). down@23(죽음 전·primary 발행)·permanent@38(죽음 후). ON: 승격 standby 가 permanent 발행→presmon full(events 2). OFF: 미발행→presmon 'down' 갇힘(events 1).`);
  console.log('seed   | primary dead/pub | standby promoted/pub | presmon ON state/ev | presmon OFF state/ev | 발행분담 | 비침습 | 판정');
  for (const seed of seeds) {
    const fo = { dropRecover: PERM, recoverMaxRetries: CAP, presenceFailover: { at: FAIL_AT } };
    const on  = run({ ...P_BASE(seed, { ...fo, presencePromote: true }) });
    const off = run({ ...P_BASE(seed, fo) });   // 미승격 대조 — primary 죽고 standby passive
    const pri = on.presence; const sh = on.presenceShadow;
    // ① primary 사망 + standby 승격
    const primaryDead = !!pri && pri.dead === true && off.presence.dead === true;   // 둘 다 primary 는 죽는다(변수=승격만)
    const promoted = !!sh && sh.active === true && sh.promotedAt === FAIL_AT && off.presenceShadow.active === false;
    // ② 발행 분담 — primary 가 죽음 전 down(1)·승격된 standby 가 죽음 후 permanent(1). 합 == 2(무손실).
    const splitPub = pri.published === 1 && sh.published === 1;
    const ssotOk = sh.permanentDown.has('ranking');   // 승격된 standby SSOT 에 permanent 반영(그림자 복제+죽음 후 보고)
    // ③ 다운스트림 연속성 — ON: presmon 이 full 전이열(down→permanent) 수신(events 2·state permanent). OFF: permanent 미발행→'down' 갇힘(events 1).
    const continuity = pmState(on) === 'permanent' && pmPerm(on) === 1 && pmEvents(on) === 2;
    const gapOff = pmState(off) === 'down' && pmPerm(off) === 0 && pmEvents(off) === 1;   // 대조: failover 없으면 죽음 후 전이 소실
    const nonInvasive = on.inventory.minted === off.inventory.minted;
    const ok =
      check(primaryDead, `seed ${seed}: primary 미사망(on ${pri && pri.dead}·off ${off.presence && off.presence.dead})`) &&
      check(promoted, `seed ${seed}: standby 미승격(active ${sh && sh.active}·@${sh && sh.promotedAt}·off active ${off.presenceShadow && off.presenceShadow.active})`) &&
      check(splitPub, `seed ${seed}: 발행 분담 깨짐(primary ${pri.published} standby ${sh.published} — 기대 1/1)`) &&
      check(ssotOk, `seed ${seed}: 승격 standby SSOT 에 permanent 미반영(${setStr(sh.permanentDown)})`) &&
      check(continuity, `seed ${seed}: ON 다운스트림 불연속(state ${pmState(on)}·perm ${pmPerm(on)}·ev ${pmEvents(on)} — 기대 permanent/1/2)`) &&
      check(gapOff, `seed ${seed}: OFF 갭 미재현(state ${pmState(off)}·perm ${pmPerm(off)}·ev ${pmEvents(off)} — 기대 down/0/1)`) &&
      check(nonInvasive, `seed ${seed}: failover 가 원장 권위 바꿈(minted on ${on.inventory.minted} off ${off.inventory.minted})`) &&
      check(ledgerConsistent(on) && itemConserved(on) && ledgerConsistent(off) && itemConserved(off), `seed ${seed}: 원장 자기-정합 깨짐`);
    console.log(`${pad(seed, 6)} | ${pad(pri.dead + '/' + pri.published, 16)} | ${pad((sh.active && sh.promotedAt === FAIL_AT) + '/' + sh.published, 20)} | ${pad(pmState(on) + '/' + pmEvents(on), 19)} | ${pad(pmState(off) + '/' + pmEvents(off), 20)} | ${pad(pri.published + '+' + sh.published, 8)} | ${pad(nonInvasive + '', 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → primary 사망 시 standby 가 승격(active=true)해 svc.presence 발행을 인계 — shadow(0066)가 모든 보고로 SSOT 를 이미 복제했으므로 *SSOT 갭 0*: 죽음 후 보고만 새로 발행해도 다운스트림이 전 전이열을 무손실 수신(존 follower 승격 0009·버스 failover 0034 의 코디네이션 판).');
  console.log('    presenceFailover 미제공 = 0066 비트 동일(crash 0·reg). 미승격(대조)이면 죽음 후 전이 영영 미발행(presmon \'down\' 갇힘) = failover 가 막는 갭. 비-침습: minted ON==OFF.');
}

kit.MODES['prespromote'] = prespromote;
kit.ORDER.splice(1, 0, 'prespromote');

(async () => { process.exit(await kit.cli(process.argv)); })();
