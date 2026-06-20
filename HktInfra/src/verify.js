// HktInfra step-0065 — 헤드리스 검증 (프레즌스 보고 버스화: orch→PresenceService 보고를 point-to-point→버스 토픽·presenceReportBus)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `reportbus`.
//   더한 한 조각: 0064 는 프레즌스 박스를 분리했지만 orch→PresenceService 보고가 *point-to-point*(presenceAddr 명시)였다(0064 §9 한계). 이 step 은 그 보고를 버스 토픽 svc.presence.report 로 올린다 — orch 가 프레즌스 박스 *주소를 모른다*(토픽만·완전 decouple) → 다중 orch·프레즌스 박스 failover 기반. 0016 decouple 을 코디네이션 *보고 경로*에 적용.
//   검증: ⒜ `reg`(키트) — presenceReportBus=0 이면 0064 비트 동일(point-to-point). ⒝ `reportbus`(가설) — ON: orch presenceAddr 무지(null)·버스로 보고→presence 박스 수신(reports/발행 동일)·다운스트림 presmon ON==OFF(행동 보존). OFF: point-to-point. 비-침습(minted 동일).
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
  presenceMonitor: true, presenceBox: true, rankDie: DEAD_DIE, ...extra });

const pmState = (r) => r.presmon ? r.presmon.stateOf('ranking') : null;
const pmDown = (r) => (r.presmon && r.presmon.downCount.get('ranking')) || 0;
const pmPerm = (r) => (r.presmon && r.presmon.permCount.get('ranking')) || 0;

function reportbus(seeds) {
  console.log('== reportbus: *가설* — orch→PresenceService 보고를 point-to-point→버스 토픽 svc.presence.report 로. orch 가 프레즌스 박스 주소 무지(완전 decouple). presenceReportBus ON vs OFF ==');
  console.log(`  영구 분실(rankDie ${DEAD_DIE}·dropRecover ${PERM}·상한 ${CAP}). ON: orch presenceAddr=null·버스 보고→presence 수신(reports/발행 동일). 다운스트림 presmon ON==OFF(행동 보존).`);
  console.log('seed   | on box perm/rep/pub | on orchAddr | on busReport | presmon ON==OFF | 비침습 | 판정');
  for (const seed of seeds) {
    const extra = { dropRecover: PERM, recoverMaxRetries: CAP };
    const on  = run({ ...P_BASE(seed, { ...extra, presenceReportBus: true }) });
    const off = run({ ...P_BASE(seed, extra) });   // presenceReportBus OFF(0064) — point-to-point
    // ON: 보고가 버스로 — orch 주소 무지, presence 박스가 버스 구독으로 수신
    const decoupled = on.orch.presenceAddr === null && on.orch.presenceReportBus === true;
    const boxOk = !!on.presence && on.presence.permanentDown.has('ranking') && on.presence.reports === 2 && on.presence.published === 2;
    const offP2P = off.orch.presenceAddr === 'presence' && off.orch.presenceReportBus === false && off.presence.reports === 2;   // OFF: point-to-point
    // 보고 경로만 바뀌고 SSOT/발행/다운스트림은 동일(행동 보존)
    const sameSSOT = on.presence.reports === off.presence.reports && on.presence.published === off.presence.published;
    const downstreamEq = pmState(on) === pmState(off) && pmDown(on) === pmDown(off) && pmPerm(on) === pmPerm(off) && pmState(on) === 'permanent';
    const nonInvasive = on.inventory.minted === off.inventory.minted;
    const ok =
      check(decoupled, `seed ${seed}: orch 미-decouple(addr ${on.orch.presenceAddr}·reportBus ${on.orch.presenceReportBus})`) &&
      check(boxOk, `seed ${seed}: presence 박스 버스 수신 실패(perm ${on.presence && [...on.presence.permanentDown]}·rep ${on.presence && on.presence.reports}·pub ${on.presence && on.presence.published})`) &&
      check(offP2P, `seed ${seed}: OFF 인데 point-to-point 아님(addr ${off.orch.presenceAddr}·rep ${off.presence && off.presence.reports})`) &&
      check(sameSSOT, `seed ${seed}: 보고 경로 바뀌며 SSOT/발행 달라짐(on rep ${on.presence.reports}/pub ${on.presence.published} off ${off.presence.reports}/${off.presence.published})`) &&
      check(downstreamEq, `seed ${seed}: 다운스트림 관측 ON!=OFF(행동 안 보존)`) &&
      check(nonInvasive, `seed ${seed}: 버스화가 원장 권위 바꿈(minted on ${on.inventory.minted} off ${off.inventory.minted})`) &&
      check(ledgerConsistent(on) && itemConserved(on) && ledgerConsistent(off) && itemConserved(off), `seed ${seed}: 원장 자기-정합 깨짐`);
    console.log(`${pad(seed, 6)} | ${pad('{' + [...on.presence.permanentDown] + '} ' + on.presence.reports + '/' + on.presence.published, 19)} | ${pad(on.orch.presenceAddr + '', 11)} | ${pad(decoupled + '', 12)} | ${pad(downstreamEq + '', 15)} | ${pad(nonInvasive + '', 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 보고 경로가 버스화되어 orch 가 프레즌스 박스 *주소를 모른다*(토픽만) — 다중 orch·프레즌스 박스 failover 의 기반(주소 결합 제거). 0016 decouple 을 코디네이션 *보고 경로*에 적용(0064 의 point-to-point 한계 해소).');
  console.log('    presenceReportBus=0 = 0064 비트 동일(point-to-point·reg). 보고 경로만 교체·SSOT/발행/다운스트림 동일(행동 보존). 비-침습: minted ON==OFF.');
}

kit.MODES['reportbus'] = reportbus;
kit.ORDER.splice(1, 0, 'reportbus');

(async () => { process.exit(await kit.cli(process.argv)); })();
