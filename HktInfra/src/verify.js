// HktInfra step-0105 — 헤드리스 검증 (active 공지 epoch 펜싱·announceEpoch·메아리 정리)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `pannep`.
//   더한 한 조각: 0070 의 presmon 은 svc.presence.active 공지를 *무조건* 받아 queryAddr 를 재타깃한다 — 낡은/메아리 공지(지연 도착·다중 standby·flapping)가 도착하면 *죽은 박스로 역-재타깃*된다(0068 §9). 이 step 은 공지에 epoch(=promotedAt·승격 시각·단조)를 실어, presmon 이 본 최고 epoch 이하 공지를 메아리로 거부(staleAnnounces++)하고 더 높은 epoch 만 재타깃하게 한다 — 디스커버리 채널 split-brain 방지(0013 펜싱·0090 epochBound 의 읽기-디스커버리 판).
//   검증: ⒜ `reg`(키트) — announceEpoch 미설정(공지에 epoch 0)이면 무조건 재타깃 = 0070 비트 동일. ⒝ `pannep`(가설) — presmon 에 공지 2건 주입: t70 새 active(presence2·epoch30), t72 메아리(옛 primary presence·epoch10). ON: presence2 유지·retargets 1·staleAnnounces 1(메아리 거부). OFF(epoch 없음): presence(역-재타깃)·retargets 2·stale 0(메아리가 죽은 박스로 끌어감).
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
  presenceQuery: true, presenceAnnounce: true, whisperRouter: true, rankDie: DEAD_DIE, whisperReceipt: true, deliverRetry: true, deliverTimeout: 4,
  presAnnounceStraggler: STRAGGLER,
  ...extra });

function pannep(seeds) {
  console.log('== pannep: *가설* — active 공지 epoch 펜싱(announceEpoch·메아리 정리). presmon 이 낡은 공지(epoch≤최고)를 메아리로 거부 → 죽은 박스 역-재타깃 방지(0070 §9). ON vs OFF ==');
  console.log('  공지 2건 주입: t70 새 active(presence2·e30)·t72 메아리(옛 primary presence·e10). ON: presence2 유지·retargets 1·stale 1. OFF(epoch 없음): presence 역-재타깃·retargets 2·stale 0.');
  console.log('seed   | queryAddr ON | retargets ON | stale ON | queryAddr OFF | retargets OFF | stale OFF | 비침습 | 판정');
  for (const seed of seeds) {
    const on  = run({ ...P_BASE(seed, { announceEpoch: true }) });
    const off = run({ ...P_BASE(seed, {}) });   // epoch 없음(0070 무조건 재타깃)
    const pm = on.presmon; const po = off.presmon;
    // ① ON 펜싱 — 새 active(presence2) 유지·메아리 거부(stale 1)·retargets 1(높은 epoch 만).
    const fenced = pm && pm.queryAddr === 'presence2' && pm.retargets === 1 && pm.staleAnnounces === 1;
    // ② OFF 대조 — 무조건 재타깃: 메아리가 옛 primary(presence·죽은 박스)로 끌어감·retargets 2·stale 0.
    const echoed = po && po.queryAddr === 'presence' && po.retargets === 2 && po.staleAnnounces === 0;
    const nonInvasive = on.inventory.minted === off.inventory.minted && ledgerConsistent(on) && ledgerConsistent(off);
    const ok =
      check(fenced, `seed ${seed}: ON 펜싱 틀림(queryAddr ${pm && pm.queryAddr}·retargets ${pm && pm.retargets}·stale ${pm && pm.staleAnnounces}·기대 presence2/1/1)`) &&
      check(echoed, `seed ${seed}: OFF 메아리 미재현(queryAddr ${po && po.queryAddr}·retargets ${po && po.retargets}·stale ${po && po.staleAnnounces}·기대 presence/2/0)`) &&
      check(nonInvasive, `seed ${seed}: 펜싱이 원장/세계 권위 바꿈(minted ${on.inventory.minted}/${off.inventory.minted})`) &&
      check(itemConserved(on) && itemConserved(off), `seed ${seed}: 아이템 보존 깨짐`);
    console.log(`${pad(seed, 6)} | ${pad(pm ? pm.queryAddr : '-', 12)} | ${pad(pm ? pm.retargets : 0, 12)} | ${pad(pm ? pm.staleAnnounces : 0, 8)} | ${pad(po ? po.queryAddr : '-', 13)} | ${pad(po ? po.retargets : 0, 13)} | ${pad(po ? po.staleAnnounces : 0, 9)} | ${pad(nonInvasive + '', 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 읽기 경로 디스커버리(svc.presence.active)가 epoch 펜싱으로 메아리 안전해진다: 낡은 공지(지연·flapping·다중 standby)가 도착해도 본 최고 epoch 이하면 거부 → 죽은 박스 역-재타깃 0(split-brain 방지). 0013 epoch 펜싱(코디네이션)·0090 epochBound(전달)의 읽기-디스커버리 판.');
  console.log('    announceEpoch 미설정 = 공지에 epoch 0 = 무조건 재타깃 = 0070 비트 동일(reg). 비-침습: 펜싱은 디스커버리 뷰(queryAddr) 선택일 뿐 원장/세계 권위 불변(minted ON==OFF)·존 tick 밖 순수 반응형.');
}

kit.MODES['pannep'] = pannep;
kit.ORDER.splice(1, 0, 'pannep');

(async () => { process.exit(await kit.cli(process.argv)); })();
