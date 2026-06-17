// HktInfra step-0045 — 헤드리스 검증 (소비자 lease/축출 — 영구 뒤처진 소비자를 min 정의역에서 떨궈 outBuffer 무계 보유 해소·busConsumerLease)
// 사용: node step-0045/verify.js <mode> [seed]
//   mode 카탈로그·각 모드 문서: engine/verify-kit.js 헤더 (0001~0029 누적 모드 = 키트). 이 step 의 새 가설 = `clease`.
//   더한 한 조각: 0044 min-워터마크(busMinWm)는 outBuffer 를 *모든 기대 소비자 frontier 의 최소(min)*까지만 가지친다 — 자기-크기조정이 *가장 느린* 소비자에 묶인다(0044 §9 대가).
//                 한 소비자(ranking)가 *영영* 죽어 ack 가 끊기면 min 이 그 frontier 에 고정 → outBuffer 무계 성장. 소비자 lease: 생산자 frontier 보다 leaseSpan 이상 뒤처진 소비자를 *축출* → min 이 산 소비자만으로 전진 → 버퍼 drain.
//   검증: ⒜ `reg`(키트) — busConsumerLease=0(기본)이면 NET 이 직전 step(0044)과 *비트 동일*(evicted 항상 비어 min 정의역 무변경).
//         ⒝ `clease`(이 step·가설) — ranking 영구 다운에서 lease OFF(=0044)는 outBuf peak 가 run-length 에 비례(무계·min 고정)·lease ON 은 축출 후 유계(run-length 무관)·산 소비자 오축출 0.
// 작성법: 누적 회귀(reg 등 18모드)는 키트가 든다. 셸은 ctx 구성 + 이번 step 가설 모드(clease)만 더한다.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../step-0044/net-core.js');   // reg 대조용(직전 step)
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40;        // 권위 존 사망 tick(failover)
const LEASE = 3;         // lease 결손 임계
const RESTART_AT = 60;   // 가방 서비스 재시작 tick(quiescent — 저널 drain 완료 → 복구 투명)
const SNAP_N = 6;        // 가방 저널 스냅샷 압축 주기(0018)
const CHAT_SNAP_N = 5;   // 채팅 커맨드 로그 스냅샷 압축 주기(0022)
const JLOSS = 0.3;       // 저널 홉 손실율(0023~) — inventory→persist 홉 신뢰 NAK/재전송 자극

const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

// ── 이 step 의 가설 모드: clease — 영구 뒤처진(죽은) 소비자를 min 정의역에서 축출해 outBuffer 무계 보유 해소 ──
const { run, itemConserved, ledgerConsistent } = NET;
const { check, pad } = kit.helpers;

// 가방·채팅·버스·audit·ranking 가 도는 토폴로지(영속/quorum 불필요 — 버스 라우팅만 자극). 0044 와 동일 베이스. ops 가 결과 생산량(×6 클라).
const BUS_BASE = (seed, ticks = 70, ops = 10) => ({ seed, ticks, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2,
  incremental: true, recovery: true, inventory: true, itemOps: ops, chat: true, chatOps: 12, regions: 2,
  bus: true, audit: true, ranking: true });
const RANK_DIE_AT = 14;    // ranking 영구 다운 tick(이 step) — ranking 이 초기 결과를 ack 해 확립한 *뒤*(frontier~41) 다운 → 이후 결과가 전부 고정 frontier 위에 쌓인다(min 고정·OFF 무계).
const LEASE_SPAN = 8;      // lease 임계(outSeq 뒤처짐) — 정상 ack lag(≤수 개)보다 크고, 영구 죽음은 frontier 전진으로 이내 초과 → 축출.

function clease(seeds) {
  console.log('== clease: *가설* — 0044 min-워터마크는 outBuffer 를 *모든 기대 소비자 frontier 의 최소(min)*까지만 가지친다 → 자기-크기조정이 *가장 느린* 소비자에 묶인다(0044 §9 대가). 한 소비자(ranking)가 *영영* 죽어 ack 가 끊기면 min 이 그 frontier 에 고정 → outBuffer 무계 성장. 소비자 lease: 생산자 frontier 보다 leaseSpan 이상 뒤처진 소비자를 *축출*(min 정의역 제외) → min 이 산 소비자만으로 전진 → 버퍼 drain ==');
  console.log(`  ranking 영구 다운@${RANK_DIE_AT}(svc.item.out 구독 해지·영구). lease OFF(=0044·min 죽은 frontier 에 고정) vs lease ON(leaseSpan=${LEASE_SPAN}·축출). ops 10/30(결과 ∝ 60/180)로 run-length 의존성 가시화.`);
  console.log('seed   | peak off/on (ops10) | peak off/on (ops30) | evict on(10/30) | ctl evict/peak(=noLease) | 판정');
  const BASE = { busResend: true, busOutAck: true, busMinWm: true, rankDie: RANK_DIE_AT };
  const LEASE = { busConsumerLease: true, leaseSpan: LEASE_SPAN };
  for (const seed of seeds) {
    const off10 = run({ ...BUS_BASE(seed, 70, 10), ...BASE });           // lease OFF(=0044) — min 이 죽은 ranking frontier 에 고정 → 무계
    const on10  = run({ ...BUS_BASE(seed, 70, 10), ...BASE, ...LEASE }); // lease ON — 축출 후 유계
    const off30 = run({ ...BUS_BASE(seed, 70, 30), ...BASE });           // 더 긴 생산 — OFF peak 가 비례 성장(무계 증거)
    const on30  = run({ ...BUS_BASE(seed, 70, 30), ...BASE, ...LEASE }); // ON peak 는 run-length 무관(유계 증거)
    // 대조군 ctl: ranking 죽음 *없음* + lease ON → 오축출 0(산 소비자 안 떨굼)·peak == lease 없는 0044 min-워터마크(정상 동작 무간섭).
    const ctl   = run({ ...BUS_BASE(seed, 70, 30), busResend: true, busOutAck: true, busMinWm: true, ...LEASE });
    const ctlNL = run({ ...BUS_BASE(seed, 70, 30), busResend: true, busOutAck: true, busMinWm: true });
    const pOff10 = off10.inventory.outBufPeak, pOn10 = on10.inventory.outBufPeak;
    const pOff30 = off30.inventory.outBufPeak, pOn30 = on30.inventory.outBufPeak;
    const ev10 = on10.inventory.evictions, ev30 = on30.inventory.evictions;
    // ① ON 이 OFF 보다 작음(축출이 drain) ② OFF 는 run-length 에 비례(무계) ③ ON 은 run-length 무관(유계) ④ 죽은 소비자 축출 ≥1 ⑤ 산 소비자 오축출 0·정상 peak 무간섭 ⑥ 원장 자기-정합
    const ok =
      check(pOn10 < pOff10, `seed ${seed}: lease ON peak 가 OFF 보다 안 작음(ops10 ${pOff10}→${pOn10})`) &&
      check(pOff30 > pOff10, `seed ${seed}: lease OFF peak 가 run-length 무관(무계면 ops10<ops30: ${pOff10},${pOff30})`) &&
      check(pOn30 <= pOn10, `seed ${seed}: lease ON peak 가 run-length 에 비례(유계면 ops30≤ops10: ${pOn10},${pOn30})`) &&
      check(ev10 >= 1 && ev30 >= 1, `seed ${seed}: lease 가 죽은 ranking 을 축출 안 함(ev ${ev10}/${ev30})`) &&
      check(ctl.inventory.evictions === 0 && ctl.inventory.outBufPeak === ctlNL.inventory.outBufPeak, `seed ${seed}: lease 가 정상 동작 간섭(ctl evict ${ctl.inventory.evictions}·peak ${ctl.inventory.outBufPeak} vs noLease ${ctlNL.inventory.outBufPeak})`) &&
      check(ledgerConsistent(on30) && itemConserved(on30) && ledgerConsistent(off30) && itemConserved(off30), `seed ${seed}: 원장 자기-정합 깨짐`);
    console.log(`${pad(seed,6)} | ${pad(pOff10+'/'+pOn10,19)} | ${pad(pOff30+'/'+pOn30,19)} | ${pad(ev10+'/'+ev30,15)} | ${pad(ctl.inventory.evictions+'/'+ctl.inventory.outBufPeak,24)} | ${ok?'OK':'FAIL'}`);
  }
  console.log(`  → 0044 min-워터마크는 outBuffer 를 *모든* 소비자 frontier 의 최소까지만 가지친다 → 한 소비자(ranking)가 영영 죽어 ack 가 끊기면 min 이 고정돼 OFF peak 가 생산량(run-length)에 비례 성장(무계·자기-크기조정이 죽은 소비자에 묶임).`);
  console.log(`    이 step: 가방이 생산자 frontier 보다 leaseSpan 이상 뒤처진 소비자를 *축출*(evicted Set·min 정의역 제외) → min 이 산 소비자(게이트웨이)만으로 전진 → outBuffer drain. ON peak 가 run-length 무관(유계)·축출 ev≥1·산 소비자 오축출 0(ctl).`);
  console.log(`    busConsumerLease=0 = 0044 비트 동일(evicted 항상 빔 → min 정의역 무변경·reg). 정직한 한계: 축출된 소비자가 *나중에* 돌아오면 보존 buffer 가 없어 replay 로 못 따라잡는다 — 자기 저널 reconstruct(0020) 로 복구해야 한다(§9). leaseSpan 은 영구-죽음 vs 일시-지연 분리 임계(오축출 위험).`);
}

kit.MODES['clease'] = clease;
kit.ORDER.splice(1, 0, 'clease');   // reg 직후(가설 우선 노출)

(async () => { process.exit(await kit.cli(process.argv)); })();
