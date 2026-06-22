// HktInfra step-0106 — 헤드리스 검증 (귓속말 라우터 공지 epoch 펜싱·announceEpoch·라우터 메아리 정리)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `pwannep`.
//   더한 한 조각: 0072 의 wrouter 도 (0105 presmon 처럼) svc.presence.active 공지를 *무조건* 받아 queryAddr 를 재타깃하고 보류 질의를 재발신한다 — 낡은/메아리 공지가 도착하면 *죽은 박스로 역-재타깃*되고 재시도가 죽은 주소로 폭주한다(0072 §9·0105 의 라우터 판). 이 step 은 0105 의 epoch 펜싱을 wrouter 에도 적용: 공지 epoch 이 본 최고 이하면 메아리로 거부(staleAnnounces++), 더 높은 것만 재타깃.
//   검증: ⒜ `reg`(키트) — announceEpoch 미설정(공지에 epoch 0)이면 무조건 재타깃 = 0072 비트 동일. ⒝ `pwannep`(가설) — wrouter 에 공지 2건 주입: t70 새 active(presence2·e30), t72 메아리(옛 primary presence·e10). ON: presence2 유지·retargets 1·stale 1. OFF: presence(역-재타깃)·retargets 2·stale 0.
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
// 공지 2건: t70 새 active(presence2·epoch30)·t72 메아리(옛 primary presence·epoch10·지연 echo)
const STRAGGLER = [{ at: 70, addr: 'presence2', epoch: 30 }, { at: 72, addr: 'presence', epoch: 10 }];
const P_BASE = (seed, extra) => ({ seed, ticks: 90, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2,
  incremental: true, recovery: true, failover: true, inventory: true, itemOps: 30, chat: true, chatOps: 12, regions: 2,
  bus: true, audit: true, ranking: true, busResend: true, busOutAck: true, busMinWm: true,
  busConsumerLease: true, leaseSpan: 3, busLeaseLife: true, busLeaseAdapt: true, busLeaseGrace: true, cadencePrior: 6,
  busLeaseAudit: true, busLeasePresence: true, busPresenceRecover: true, recoverRetry: true, presencePublish: true,
  presenceMonitor: true, presenceBox: true, presenceReportBus: true, presenceShadow: true, presenceLease: true, hbTimeout: 3,
  presenceQuery: true, presenceAnnounce: true, whisperRouter: true, whisperFailover: true, whisperRetry: true,
  rankDie: DEAD_DIE, whisperReceipt: true, deliverRetry: true, deliverTimeout: 4,
  whisperAnnounceStraggler: STRAGGLER,
  ...extra });

function pwannep(seeds) {
  console.log('== pwannep: *가설* — 귓속말 라우터 공지 epoch 펜싱(announceEpoch·라우터 메아리 정리). wrouter 가 낡은 공지를 메아리로 거부 → 죽은 박스 역-재타깃·재시도 폭주 방지(0072 §9·0105 라우터 판). ON vs OFF ==');
  console.log('  wrouter 에 공지 2건 주입: t70 새 active(presence2·e30)·t72 메아리(옛 primary presence·e10). ON: presence2 유지·retargets 1·stale 1. OFF(epoch 없음): presence 역-재타깃·retargets 2·stale 0.');
  console.log('seed   | queryAddr ON | retargets ON | stale ON | queryAddr OFF | retargets OFF | stale OFF | 비침습 | 판정');
  for (const seed of seeds) {
    const on  = run({ ...P_BASE(seed, { announceEpoch: true }) });
    const off = run({ ...P_BASE(seed, {}) });   // epoch 없음(0072 무조건 재타깃)
    const wr = on.wrouter; const wo = off.wrouter;
    // ① ON 펜싱 — 새 active(presence2) 유지·메아리 거부(stale 1)·retargets 1.
    const fenced = wr && wr.queryAddr === 'presence2' && wr.retargets === 1 && wr.staleAnnounces === 1;
    // ② OFF 대조 — 무조건 재타깃: 메아리가 옛 primary(presence·죽은 박스)로 끌어감·retargets 2·stale 0.
    const echoed = wo && wo.queryAddr === 'presence' && wo.retargets === 2 && wo.staleAnnounces === 0;
    const nonInvasive = on.inventory.minted === off.inventory.minted && ledgerConsistent(on) && ledgerConsistent(off);
    const ok =
      check(fenced, `seed ${seed}: ON 펜싱 틀림(queryAddr ${wr && wr.queryAddr}·retargets ${wr && wr.retargets}·stale ${wr && wr.staleAnnounces}·기대 presence2/1/1)`) &&
      check(echoed, `seed ${seed}: OFF 메아리 미재현(queryAddr ${wo && wo.queryAddr}·retargets ${wo && wo.retargets}·stale ${wo && wo.staleAnnounces}·기대 presence/2/0)`) &&
      check(nonInvasive, `seed ${seed}: 펜싱이 원장/세계 권위 바꿈(minted ${on.inventory.minted}/${off.inventory.minted})`) &&
      check(itemConserved(on) && itemConserved(off), `seed ${seed}: 아이템 보존 깨짐`);
    console.log(`${pad(seed, 6)} | ${pad(wr ? wr.queryAddr : '-', 12)} | ${pad(wr ? wr.retargets : 0, 12)} | ${pad(wr ? wr.staleAnnounces : 0, 8)} | ${pad(wo ? wo.queryAddr : '-', 13)} | ${pad(wo ? wo.retargets : 0, 13)} | ${pad(wo ? wo.staleAnnounces : 0, 9)} | ${pad(nonInvasive + '', 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 라우팅 읽기 경로 디스커버리도 epoch 펜싱으로 메아리 안전: 낡은 공지가 도착해도 wrouter 가 거부 → 죽은 박스 역-재타깃·재시도 폭주 0. presmon(0105)·wrouter(0106)가 같은 svc.presence.active 채널의 두 소비자로 동일 펜싱 — 디스커버리 split-brain 방지가 채널의 모든 소비자에 일관.');
  console.log('    announceEpoch 미설정 = 공지에 epoch 0 = 무조건 재타깃 = 0072 비트 동일(reg). 비-침습: 펜싱은 디스커버리 뷰(queryAddr) 선택일 뿐 원장/세계 권위 불변(minted ON==OFF)·존 tick 밖 순수 반응형.');
}

kit.MODES['pwannep'] = pwannep;
kit.ORDER.splice(1, 0, 'pwannep');

(async () => { process.exit(await kit.cli(process.argv)); })();
