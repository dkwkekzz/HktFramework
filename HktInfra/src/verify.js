// HktInfra step-0068 — 헤드리스 검증 (프레즌스 박스 사망 자율 감지: 하트비트 침묵으로 standby 가 스스로 승격·presenceLease)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `presdetect`.
//   더한 한 조각: 0067 의 승격은 *외부 주입*(presenceFailover.at 가 promote 호출)이었다(0067 §9 한계). 이 step 은 트리거를 *자율화* — active 박스가 매 tick svc.presence.hb 하트비트를 발행, standby 가 구독해 침묵 길이(hbTimeout)로 primary 사망을 스스로 감지→자기 promote(외부 호출 0). 0009 의 orch lease 타임아웃→follower 승격을 프레즌스 박스에 적용(감지 권위=standby 자신).
//   검증: ⒜ `reg`(키트) — presenceLease 미설정이면 0067 비트 동일(하트비트·자율 승격 0). ⒝ `presdetect`(가설) — ON: primary crash(t30)→standby 가 하트비트 침묵 hbTimeout(3) 뒤 *스스로* 승격(promotedAt 34=FAIL_AT+1홉+hbTimeout·외부 promote 0)→permanent 인계 발행→presmon full(ev 2). OFF(presenceLease off·외부 promote 도 off): 자율 승격 0→permanent 미발행→presmon 'down' 갭(ev 1). 비-침습(minted 동일).
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { run, itemConserved, ledgerConsistent } = NET;
const { check, pad } = kit.helpers;

const DEAD_DIE = 14; const PERM = 99; const CAP = 3; const FAIL_AT = 30; const HBT = 3;
// 자율 승격 시점 = lastHbTick + hbTimeout. 마지막 하트비트는 primary 가 죽기 전 tick(FAIL_AT-1)에 발행 → 버스 2홉(primary→bus→standby)으로 standby 가 FAIL_AT+1 에 수신(lastHbTick) → +hbTimeout 침묵 후 승격. 결정론(시드 무관).
const PROMO_AT = FAIL_AT + 1 + HBT;
const P_BASE = (seed, extra) => ({ seed, ticks: 90, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2,
  incremental: true, recovery: true, failover: true, inventory: true, itemOps: 30, chat: true, chatOps: 12, regions: 2,
  bus: true, audit: true, ranking: true, busResend: true, busOutAck: true, busMinWm: true,
  busConsumerLease: true, leaseSpan: 3, busLeaseLife: true, busLeaseAdapt: true, busLeaseGrace: true, cadencePrior: 6,
  busLeaseAudit: true, busLeasePresence: true, busPresenceRecover: true, recoverRetry: true, presencePublish: true,
  presenceMonitor: true, presenceBox: true, presenceReportBus: true, presenceShadow: true,
  presenceFailover: { at: FAIL_AT }, hbTimeout: HBT, rankDie: DEAD_DIE, ...extra });

const pmState = (r) => r.presmon ? r.presmon.stateOf('ranking') : null;
const pmPerm = (r) => (r.presmon && r.presmon.permCount.get('ranking')) || 0;
const pmEvents = (r) => r.presmon ? r.presmon.events : -1;

function presdetect(seeds) {
  console.log('== presdetect: *가설* — primary 사망(t' + FAIL_AT + ') 을 standby 가 하트비트 침묵(hbTimeout ' + HBT + ')으로 *스스로* 감지→자기 승격(외부 promote 0). presenceLease ON vs OFF ==');
  console.log(`  rankDie ${DEAD_DIE}·dropRecover ${PERM}·상한 ${CAP}. ON: 하트비트 흐름→침묵 감지→자율 승격(promotedAt ${PROMO_AT})→permanent 인계→presmon full(ev 2). OFF(lease·외부 promote 둘 다 off): 자율 승격 0→presmon 'down' 갭(ev 1).`);
  console.log('seed   | primary dead/hbSent | standby hbRecv/promo@ | presmon ON state/ev | presmon OFF state/ev | 자율승격 | 비침습 | 판정');
  for (const seed of seeds) {
    const base = { dropRecover: PERM, recoverMaxRetries: CAP };
    const on  = run({ ...P_BASE(seed, { ...base, presenceLease: true }) });   // 자율 감지 ON·외부 promote 미사용
    const off = run({ ...P_BASE(seed, base) });                                // presenceLease OFF·외부 promote 도 OFF → 승격 0(대조)
    const pri = on.presence; const sh = on.presenceShadow;
    // ① 하트비트 흐름 — active primary 가 발행·standby 가 수신(presenceLease 작동)
    const hbFlow = pri.hbSent > 0 && sh.hbRecv > 0;
    // ② 자율 승격 — standby 가 *스스로* 승격(promotedAt == FAIL_AT+hbTimeout·외부 promote 호출 없이). OFF 는 미승격.
    const autoPromote = sh.active === true && sh.promotedAt === PROMO_AT && off.presenceShadow.active === false && off.presenceShadow.promotedAt === -1;
    const primaryDead = pri.dead === true && off.presence.dead === true;   // 둘 다 primary 는 죽는다(변수=자율 감지만)
    // ③ 다운스트림 연속성 — ON: 자율 승격 standby 가 permanent 인계 발행→presmon full(ev 2·permanent). OFF: 미발행→'down' 갇힘(ev 1).
    const continuity = pmState(on) === 'permanent' && pmPerm(on) === 1 && pmEvents(on) === 2;
    const gapOff = pmState(off) === 'down' && pmPerm(off) === 0 && pmEvents(off) === 1;
    const splitPub = pri.published === 1 && sh.published === 1;   // primary down 1 + 자율 승격 standby permanent 1
    const nonInvasive = on.inventory.minted === off.inventory.minted;
    const ok =
      check(hbFlow, `seed ${seed}: 하트비트 미흐름(sent ${pri.hbSent} recv ${sh.hbRecv})`) &&
      check(primaryDead, `seed ${seed}: primary 미사망(on ${pri.dead} off ${off.presence.dead})`) &&
      check(autoPromote, `seed ${seed}: 자율 승격 실패(active ${sh.active}·@${sh.promotedAt} 기대 ${PROMO_AT}·off active ${off.presenceShadow.active}/@${off.presenceShadow.promotedAt})`) &&
      check(splitPub, `seed ${seed}: 발행 분담 깨짐(primary ${pri.published} standby ${sh.published})`) &&
      check(continuity, `seed ${seed}: ON 다운스트림 불연속(state ${pmState(on)}·perm ${pmPerm(on)}·ev ${pmEvents(on)})`) &&
      check(gapOff, `seed ${seed}: OFF 갭 미재현(state ${pmState(off)}·perm ${pmPerm(off)}·ev ${pmEvents(off)})`) &&
      check(nonInvasive, `seed ${seed}: 자율 감지가 원장 권위 바꿈(minted on ${on.inventory.minted} off ${off.inventory.minted})`) &&
      check(ledgerConsistent(on) && itemConserved(on) && ledgerConsistent(off) && itemConserved(off), `seed ${seed}: 원장 자기-정합 깨짐`);
    console.log(`${pad(seed, 6)} | ${pad(pri.dead + '/' + pri.hbSent, 19)} | ${pad(sh.hbRecv + '/' + sh.promotedAt, 21)} | ${pad(pmState(on) + '/' + pmEvents(on), 19)} | ${pad(pmState(off) + '/' + pmEvents(off), 20)} | ${pad(autoPromote + '', 8)} | ${pad(nonInvasive + '', 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → active 박스의 하트비트(svc.presence.hb) 침묵을 standby 가 스스로 hbTimeout 만큼 재고 사망 단정→자기 승격(외부 트리거 없이·감지 권위=standby). 0009 의 orch lease 타임아웃→follower 승격을 프레즌스 박스에 적용 — 0067 의 외부 주입 한계 해소.');
  console.log('    presenceLease 미설정 = 0067 비트 동일(하트비트·자율 승격 0·reg). OFF(외부 promote 도 off)면 자율 승격 0→죽음 후 전이 영영 미발행(presmon \'down\' 갭). 비-침습: minted ON==OFF.');
}

kit.MODES['presdetect'] = presdetect;
kit.ORDER.splice(1, 0, 'presdetect');

(async () => { process.exit(await kit.cli(process.argv)); })();
