// HktInfra step-0091 — 헤드리스 검증 (옛 epoch grace 유예·straggler 내성)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `pepochgrace`.
//   더한 한 조각: 0090 은 더 높은 epoch 도착 시 낮은 epoch 워터마크를 *즉시* 가지친다(단조 epoch 가정·0090 §9). 가지친 *뒤* 옛 epoch 의 지연 straggler 가 도착하면 워터마크가 없어 *신규로 오인 재수신*(중복 적재·전달 유실의 거울상). 이 step 은 *가장 최근 epochGrace 개 닫힌 epoch 워터마크를 유예*(슬라이딩 윈도)해 유예 구간의 straggler 를 정상 dedup 한다. epoch 차원은 producer 당 epochGrace+1 로 여전히 유계(0051 lease grace 의 epoch 판).
//   검증: ⒜ `reg`(키트) — epochGrace 0(기본)이면 즉시 가지치기 = 0090 비트 동일. ⒝ `pepochgrace`(가설) — 1회 재시작(epoch 0→1)·각 epoch 귓속말 2(총 4)·재시작 후 옛 epoch(0) straggler 1개 주입. ON(epochGrace 1): straggler 가 유예된 wrouter#0 워터마크로 dedup → received 4(불변)·duplicates 1. OFF(0090·즉시 가지치기): wrouter#0 가지쳐져 straggler 신규 오인 → received 5(유실의 거울상)·duplicates 0. minted 동일(비침습).
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { run, itemConserved, ledgerConsistent } = NET;
const { check, pad } = kit.helpers;

const DEAD_DIE = 14; const EPOCHS = 2;   // epoch 0,1 (1회 재시작)
// epoch 0 구간: 귓속말 46,48 / 재시작 51 / epoch 1 구간: 54,56. 그 뒤 옛 epoch(0) straggler 주입.
const WHISPERS = [
  { at: 46, from: 'client0', to: 'mbox', body: 'e0a' }, { at: 48, from: 'client0', to: 'mbox', body: 'e0b' },
  { at: 54, from: 'client0', to: 'mbox', body: 'e1a' }, { at: 56, from: 'client0', to: 'mbox', body: 'e1b' },
];
const RESTARTS = [{ at: 51 }];
const TOTAL = WHISPERS.length;   // 4 정상 전달
// 옛 epoch(0) straggler — 재시작·epoch 1 전달이 모두 처리된 뒤(tick 88) 지연 도착. 라우터 producer=wrouter, epoch 0, seq 1(epoch 0 에서 본 seq).
const STRAGGLER = [{ at: 88, from: 'wrouter', epoch: 0, seq: 1, body: 'strag' }];
const P_BASE = (seed, extra) => ({ seed, ticks: 90, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2,
  incremental: true, recovery: true, failover: true, inventory: true, itemOps: 30, chat: true, chatOps: 12, regions: 2,
  bus: true, audit: true, ranking: true, busResend: true, busOutAck: true, busMinWm: true,
  busConsumerLease: true, leaseSpan: 3, busLeaseLife: true, busLeaseAdapt: true, busLeaseGrace: true, cadencePrior: 6,
  busLeaseAudit: true, busLeasePresence: true, busPresenceRecover: true, recoverRetry: true, presencePublish: true,
  presenceMonitor: true, presenceBox: true, presenceReportBus: true, presenceShadow: true, presenceLease: true, hbTimeout: 3,
  presenceQuery: true, whisperRouter: true, rankDie: DEAD_DIE, whisperReceipt: true, deliverRetry: true, deliverTimeout: 4,
  deliverDedupBound: true, epochKeyed: true, deliverEpochBound: true,   // 0081 워터마크 + 0089 epoch 키잉 + 0090 유계화
  whispers: WHISPERS, wrouterRestart: RESTARTS, mboxStraggler: STRAGGLER,
  ...extra });

function pepochgrace(seeds) {
  console.log('== pepochgrace: *가설* — 옛 epoch grace 유예. 즉시 가지치기 대신 최근 N개 닫힌 epoch 워터마크를 유예 → 지연 straggler 를 정상 dedup. epochGrace ON(1) vs OFF(0·0090) ==');
  console.log(`  ${EPOCHS - 1}회 재시작(epoch 0→1)·정상 전달 ${TOTAL}·옛 epoch(0) straggler 1. ON: straggler dedup → received ${TOTAL}·dup 1. OFF: straggler 신규 오인 → received ${TOTAL + 1}·dup 0.`);
  console.log('seed   | restarts | received ON | dup ON | epochKeys ON | received OFF | dup OFF | 비침습 | 판정');
  for (const seed of seeds) {
    const on  = run({ ...P_BASE(seed, { deliverEpochGrace: 1 }) });   // grace 1 — 직전 닫힌 epoch 워터마크 유예
    const off = run({ ...P_BASE(seed, { deliverEpochGrace: 0 }) });   // grace 0 — 즉시 가지치기(0090 동작)
    const mb = on.mbox; const mo = off.mbox; const wr = on.wrouter;
    const onKeys = mb ? mb.epochKeyCount() : -1;
    // ① grace 유예 — straggler 가 유예된 옛 epoch 워터마크로 dedup: received 불변(TOTAL)·duplicates 1·재시작 정상.
    const graced = mb && mb.received === TOTAL && mb.duplicates === 1 && wr && wr.restarts === EPOCHS - 1;
    // ② 대조(OFF) — 즉시 가지치기면 straggler 가 워터마크 없어 신규 오인 재수신: received TOTAL+1·duplicates 0(0090 §9 한계 노출).
    const leaked = mo && mo.received === TOTAL + 1 && mo.duplicates === 0;
    const nonInvasive = on.inventory.minted === off.inventory.minted;
    const ok =
      check(graced, `seed ${seed}: grace 유예 틀림(received ${mb && mb.received}·dup ${mb && mb.duplicates}·restarts ${wr && wr.restarts}·기대 ${TOTAL}/1/${EPOCHS - 1})`) &&
      check(leaked, `seed ${seed}: OFF straggler 누수 미재현(received ${mo && mo.received}·dup ${mo && mo.duplicates}·기대 ${TOTAL + 1}/0)`) &&
      check(nonInvasive, `seed ${seed}: grace 가 원장 권위 바꿈(minted on ${on.inventory.minted} off ${off.inventory.minted})`) &&
      check(ledgerConsistent(on) && itemConserved(on) && ledgerConsistent(off) && itemConserved(off), `seed ${seed}: 원장 자기-정합 깨짐`);
    console.log(`${pad(seed, 6)} | ${pad(wr ? wr.restarts : 0, 8)} | ${pad(mb ? mb.received : 0, 11)} | ${pad(mb ? mb.duplicates : 0, 6)} | ${pad(onKeys, 12)} | ${pad(mo ? mo.received : 0, 12)} | ${pad(mo ? mo.duplicates : 0, 7)} | ${pad(nonInvasive + '', 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log(`  → 즉시 가지치기(0090)는 단조 epoch 도착을 가정한다 — 가지친 뒤 옛 epoch straggler 는 워터마크가 없어 신규 오인 재수신(전달 유실 0089 의 거울상·중복 적재). grace 유예는 최근 N개 닫힌 epoch 워터마크를 살려둬 straggler 를 정상 dedup 하면서도 epoch 차원을 producer 당 N+1 로 유계(0051 lease grace 의 epoch 판·SPINE 계층3·5).`);
  console.log('    epochGrace 0(기본) = e 미만 즉시 제거 = 0090 비트 동일(reg). 비-침습: grace 는 워터마크 유지 윈도만(수신 판정·원장 불변)·minted ON==OFF·존 tick 밖 순수 반응형.');
}

kit.MODES['pepochgrace'] = pepochgrace;
kit.ORDER.splice(1, 0, 'pepochgrace');

(async () => { process.exit(await kit.cli(process.argv)); })();
