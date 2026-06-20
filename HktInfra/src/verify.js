// HktInfra step-0064 — 헤드리스 검증 (전용 프레즌스 박스 분리: orch 의 프레즌스 SSOT+발행을 PresenceService 박스로 인계·presenceBox)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `presbox`.
//   더한 한 조각: 0055~0063 동안 orch 가 프레즌스 *결정·SSOT(consumerDown/permanentDown)·발행(svc.presence)·행동(recover/retry/포기)* 을 전부 했다. 이 step 은 SPINE 계층 5 의 "세션/프레즌스" 박스를 "오케스트레이터"에서 떼어낸다 — PresenceService 가 SSOT+발행을 인수하고, orch 는 전이를 *보고*만 하며 결정·행동에 집중(순수 오케스트레이터). 다운스트림(audit·presmon·ranking2)은 발행자가 바뀐 줄 모른다(은닉·무수정).
//   검증: ⒜ `reg`(키트) — presenceBox=0 이면 0063 비트 동일(박스 0·orch 직접). ⒝ `presbox`(가설) — ON: presence 박스가 SSOT(permanentDown)·발행, orch 위임(presencePublished 0)·다운스트림 presmon 관측 ON==OFF 동일(행동 보존)·발행==보고. OFF: orch 직접. 비-침습(minted 동일).
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
// presenceMonitor 항상 ON(다운스트림 관측자) — presenceBox ON/OFF 의 다운스트림 동치를 본다.
const P_BASE = (seed, extra) => ({ seed, ticks: 90, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2,
  incremental: true, recovery: true, failover: true, inventory: true, itemOps: 30, chat: true, chatOps: 12, regions: 2,
  bus: true, audit: true, ranking: true, busResend: true, busOutAck: true, busMinWm: true,
  busConsumerLease: true, leaseSpan: 3, busLeaseLife: true, busLeaseAdapt: true, busLeaseGrace: true, cadencePrior: 6,
  busLeaseAudit: true, busLeasePresence: true, busPresenceRecover: true, recoverRetry: true, presencePublish: true,
  presenceMonitor: true, rankDie: DEAD_DIE, ...extra });

const pmState = (r) => r.presmon ? r.presmon.stateOf('ranking') : null;
const pmDown = (r) => (r.presmon && r.presmon.downCount.get('ranking')) || 0;
const pmPerm = (r) => (r.presmon && r.presmon.permCount.get('ranking')) || 0;
const pmUp = (r) => (r.presmon && r.presmon.upCount.get('ranking')) || 0;

function presbox(seeds) {
  console.log('== presbox: *가설* — orch 의 프레즌스 SSOT(consumerDown/permanentDown)+발행(svc.presence)을 PresenceService 박스로 인계. orch 는 전이 보고만(순수 오케스트레이터). presenceBox ON vs OFF ==');
  console.log(`  영구 분실(rankDie ${DEAD_DIE}·dropRecover ${PERM}·상한 ${CAP}). ON: presence 박스 SSOT(permDown)·발행·orch 위임(pub 0). 다운스트림 presmon 관측 ON==OFF(행동 보존). 발행==보고.`);
  console.log('seed   | on box perm/pub | on orchPub | off orchPub | presmon ON==OFF | 비침습 | 판정');
  for (const seed of seeds) {
    const extra = { dropRecover: PERM, recoverMaxRetries: CAP };
    const on  = run({ ...P_BASE(seed, { ...extra, presenceBox: true }) });
    const off = run({ ...P_BASE(seed, extra) });   // presenceBox OFF(0063) — orch 직접
    // ON: presence 박스가 SSOT + 발행 인수
    const boxOk = !!on.presence && on.presence.permanentDown.has('ranking') && on.presence.published === on.presence.reports && on.presence.published > 0;
    const orchDelegated = on.orch.presencePublished === 0 && on.orch.consumerDown.size === 0 && on.orch.permanentDown.size === 0;   // orch 위임(직접 SSOT/발행 0)
    const offDirect = off.presence === null && off.orch.presencePublished === 2 && off.orch.permanentDown.has('ranking');           // OFF: orch 직접
    const lossless = (on.presmon ? on.presmon.events : -1) === on.presence.published;   // 발행==다운스트림 수신
    // 다운스트림 동치 — presmon 이 본 상태/전이가 ON/OFF 동일(발행자만 바뀜·행동 보존)
    const downstreamEq = pmState(on) === pmState(off) && pmDown(on) === pmDown(off) && pmPerm(on) === pmPerm(off) && pmUp(on) === pmUp(off) && pmState(on) === 'permanent';
    const nonInvasive = on.inventory.minted === off.inventory.minted;
    const ok =
      check(boxOk, `seed ${seed}: presence 박스 SSOT/발행 실패(perm ${on.presence && [...on.presence.permanentDown]}·pub ${on.presence && on.presence.published}/${on.presence && on.presence.reports})`) &&
      check(orchDelegated, `seed ${seed}: orch 미위임(pub ${on.orch.presencePublished} cd ${on.orch.consumerDown.size} pd ${on.orch.permanentDown.size})`) &&
      check(offDirect, `seed ${seed}: OFF 인데 orch 직접 아님(box ${off.presence} pub ${off.orch.presencePublished})`) &&
      check(lossless, `seed ${seed}: 발행!=다운스트림 수신`) &&
      check(downstreamEq, `seed ${seed}: 다운스트림 관측 ON!=OFF(행동 안 보존·on ${pmState(on)} off ${pmState(off)})`) &&
      check(nonInvasive, `seed ${seed}: 분리가 원장 권위 바꿈(minted on ${on.inventory.minted} off ${off.inventory.minted})`) &&
      check(ledgerConsistent(on) && itemConserved(on) && ledgerConsistent(off) && itemConserved(off), `seed ${seed}: 원장 자기-정합 깨짐`);
    console.log(`${pad(seed, 6)} | ${pad('{' + [...on.presence.permanentDown] + '} ' + on.presence.published, 15)} | ${pad(on.orch.presencePublished, 10)} | ${pad(off.orch.presencePublished, 11)} | ${pad(downstreamEq + '', 15)} | ${pad(nonInvasive + '', 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → SPINE 계층 5 의 "세션/프레즌스" 박스가 "오케스트레이터"에서 분리됨: PresenceService 가 "누가 어디에" SSOT+발행, orch 는 순수 결정/행동(recover/retry/포기). 다운스트림은 발행자가 바뀐 줄 모른다(은닉·무수정 = 0016 decouple 의 코디네이션 판).');
  console.log('    presenceBox=0 = 0063 비트 동일(박스 0·orch 직접·reg). 비-침습: minted ON==OFF. 행동 보존: presmon 관측 ON==OFF(같은 svc.presence 스트림·발행자만 교체).');
}

kit.MODES['presbox'] = presbox;
kit.ORDER.splice(1, 0, 'presbox');

(async () => { process.exit(await kit.cli(process.argv)); })();
