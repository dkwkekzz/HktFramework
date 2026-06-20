// HktInfra step-0066 — 헤드리스 검증 (프레즌스 박스 shadow 복제: standby presence2 가 같은 보고 토픽으로 SSOT 그림자 복제·presenceShadow)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `presshadow`.
//   더한 한 조각: 0065 가 orch→PresenceService 보고를 *버스 토픽*(svc.presence.report)으로 올려 orch 가 프레즌스 박스 주소 무지가 됐다(완전 decouple). 이 step 은 그 위에 *대기(standby)* PresenceService(presence2)를 같은 토픽에 구독시켜 SSOT(consumerDown/permanentDown)를 *그림자 복제*한다 — 단 발행은 억제(active=false → svc.presence 이중 발행 0). 같은 보고 스트림을 먹는 두 박스가 같은 SSOT 로 수렴(존 follower 복제 0002·shadow follower 0009 의 코디네이션 판) → 프레즌스 박스 failover 의 토대(승격 시 SSOT 갭 0).
//   검증: ⒜ `reg`(키트) — presenceShadow=0 이면 0065 비트 동일(standby 없음). ⒝ `presshadow`(가설) — ON: standby presence2 SSOT == primary SSOT(reports/down/perm 동일)·standby 발행 0(active=false)·primary 발행 보존(2)·다운스트림 presmon ON==OFF(행동 보존). OFF: standby 0. 비-침습(minted 동일).
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
  presenceMonitor: true, presenceBox: true, presenceReportBus: true, rankDie: DEAD_DIE, ...extra });

const pmState = (r) => r.presmon ? r.presmon.stateOf('ranking') : null;
const pmDown = (r) => (r.presmon && r.presmon.downCount.get('ranking')) || 0;
const pmPerm = (r) => (r.presmon && r.presmon.permCount.get('ranking')) || 0;
const setStr = (s) => '{' + [...s].sort() + '}';
const setEq = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));

function presshadow(seeds) {
  console.log('== presshadow: *가설* — standby PresenceService(presence2)가 같은 svc.presence.report 토픽 구독으로 SSOT 그림자 복제. active=false → 발행 억제. presenceShadow ON vs OFF ==');
  console.log(`  영구 분실(rankDie ${DEAD_DIE}·dropRecover ${PERM}·상한 ${CAP}). ON: shadow SSOT==primary SSOT(reports/down/perm)·shadow 발행 0·primary 발행 보존. 다운스트림 presmon ON==OFF(행동 보존).`);
  console.log('seed   | primary perm/rep/pub | shadow perm/rep/pub | SSOT 동일 | shadow 침묵 | presmon ON==OFF | 비침습 | 판정');
  for (const seed of seeds) {
    const extra = { dropRecover: PERM, recoverMaxRetries: CAP };
    const on  = run({ ...P_BASE(seed, { ...extra, presenceShadow: true }) });
    const off = run({ ...P_BASE(seed, extra) });   // presenceShadow OFF(0065) — standby 없음
    const pri = on.presence; const sh = on.presenceShadow;
    // ① standby 존재 + 같은 보고 스트림으로 SSOT 그림자 복제(consumerDown·permanentDown·reports 동일)
    const shadowExists = !!sh && off.presenceShadow === null;
    const ssotEq = !!sh && setEq(sh.consumerDown, pri.consumerDown) && setEq(sh.permanentDown, pri.permanentDown) && sh.reports === pri.reports;
    const converged = !!sh && sh.permanentDown.has('ranking') && pri.permanentDown.has('ranking');
    // ② standby 침묵 — active=false 라 svc.presence 이중 발행 0. primary 는 그대로 발행(2).
    const shadowSilent = !!sh && sh.active === false && sh.published === 0;
    const primaryPub = pri.published === 2 && off.presence.published === 2;   // 발행 권위는 primary 만(ON/OFF 동일)
    // ③ 다운스트림 행동 보존 — presmon(svc.presence 소비)이 ON==OFF(standby 가 발행 안 하므로 이벤트 수·상태 동일)
    const downstreamEq = pmState(on) === pmState(off) && pmDown(on) === pmDown(off) && pmPerm(on) === pmPerm(off) && pmState(on) === 'permanent';
    const nonInvasive = on.inventory.minted === off.inventory.minted;
    const ok =
      check(shadowExists, `seed ${seed}: standby 없음(on ${!!sh}·off ${off.presenceShadow !== null})`) &&
      check(ssotEq, `seed ${seed}: shadow SSOT != primary(sh down ${sh && setStr(sh.consumerDown)}/perm ${sh && setStr(sh.permanentDown)}/rep ${sh && sh.reports} vs pri ${setStr(pri.consumerDown)}/${setStr(pri.permanentDown)}/${pri.reports})`) &&
      check(converged, `seed ${seed}: shadow 가 permanentDown 에 ranking 미수렴`) &&
      check(shadowSilent, `seed ${seed}: shadow 발행함(active ${sh && sh.active}·pub ${sh && sh.published}) — 이중 발행`) &&
      check(primaryPub, `seed ${seed}: primary 발행 권위 깨짐(on ${pri.published} off ${off.presence.published})`) &&
      check(downstreamEq, `seed ${seed}: 다운스트림 관측 ON!=OFF(행동 안 보존)`) &&
      check(nonInvasive, `seed ${seed}: shadow 가 원장 권위 바꿈(minted on ${on.inventory.minted} off ${off.inventory.minted})`) &&
      check(ledgerConsistent(on) && itemConserved(on) && ledgerConsistent(off) && itemConserved(off), `seed ${seed}: 원장 자기-정합 깨짐`);
    console.log(`${pad(seed, 6)} | ${pad(setStr(pri.permanentDown) + ' ' + pri.reports + '/' + pri.published, 20)} | ${pad((sh ? setStr(sh.permanentDown) + ' ' + sh.reports + '/' + sh.published : '-'), 19)} | ${pad(ssotEq + '', 9)} | ${pad(shadowSilent + '', 11)} | ${pad(downstreamEq + '', 15)} | ${pad(nonInvasive + '', 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 같은 보고 스트림(svc.presence.report)을 먹는 두 PresenceService 가 같은 SSOT 로 수렴(존 follower 복제 0002·shadow follower 0009 의 코디네이션 판). standby 는 발행을 억제(active=false)해 이중 발행 0 — 승격(0067 후보) 때 SSOT 갭 0 의 토대.');
  console.log('    presenceShadow=0 = 0065 비트 동일(standby 없음·reg). shadow 는 SSOT 그림자 복제만·발행 0 → 다운스트림(presmon) ON==OFF(행동 보존). 비-침습: minted ON==OFF.');
}

kit.MODES['presshadow'] = presshadow;
kit.ORDER.splice(1, 0, 'presshadow');

(async () => { process.exit(await kit.cli(process.argv)); })();
