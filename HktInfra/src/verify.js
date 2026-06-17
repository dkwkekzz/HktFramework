// HktInfra step-0048 — 헤드리스 검증 (소비자 lease lifecycle 정합 — 시작-시점 죽음 축출 + 축출 비가역 해소·busLeaseLife)
// 사용: node step-0048/verify.js <mode> [seed]
//   mode 카탈로그·각 모드 문서: engine/verify-kit.js 헤더 (0001~0029 누적 모드 = 키트). 이 step 의 새 가설 = `leaselife`.
//   더한 한 조각: 0045 소비자 lease(busConsumerLease)의 두 빈틈(코드리뷰 §2/§3) 해소 —
//     §2 *시작-시점 죽음*: 한 번도 ack 안 한 소비자는 침묵 기준(consumerSeen) 미확립 → 축출 정의역 밖 + consumerWm 미확립으로 min 을 -1 에 고정 → outBuffer 무계(축출도 못 함).
//     §3 *축출 비가역*: 축출된 소비자가 돌아와도(재구독·재-ack) evicted 에서 못 빠져 min 정의역 미복귀 → 이후 결과 starve 재발.
//   해법(busLeaseLife): ⒜ sweep 가 처음 본 미-ack 소비자에 침묵 기준을 frontier 로 *지연* 확립(leaseSpan grace) → 영영-죽음이면 leaseSpan 뒤 축출 ⒝ 축출된 소비자가 재-ack 하면 evicted 에서 제거(재admission).
//   검증: ⒜ `reg`(키트) — busLeaseLife=0(기본)이면 NET 이 직전 step(0047)과 *비트 동일*(지연 baseline 미확립·재admission 0·evicted 동작 무변경).
//         ⒝ `leaselife`(이 step·가설) — §2 never-ack 소비자에서 OFF outBufPeak ∝run-length(무계·축출 0) vs ON 유계(run-length 무관·ev≥1)·§3 revival 에서 OFF 비가역(readm 0·영영 evicted) vs ON 재admission(readm≥1·정의역 복귀)·산 소비자 오축출 0(ctl).
// 작성법: 누적 회귀(reg 등 18모드)는 키트가 든다. 셸은 ctx 구성 + 이번 step 가설 모드(leaselife)만 더한다.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');   // reg 대조용 — 직전 step의 동결 스냅샷. 항상 ../baseline 고정(0049 단일 src/ 전환: step 번호 치환 churn 소멸)
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40;        // 권위 존 사망 tick(failover)
const LEASE = 3;         // lease 결손 임계
const RESTART_AT = 60;   // 가방 서비스 재시작 tick(quiescent — 저널 drain 완료 → 복구 투명)
const SNAP_N = 6;        // 가방 저널 스냅샷 압축 주기(0018)
const CHAT_SNAP_N = 5;   // 채팅 커맨드 로그 스냅샷 압축 주기(0022)
const JLOSS = 0.3;       // 저널 홉 손실율(0023~) — inventory→persist 홉 신뢰 NAK/재전송 자극

const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

// ── 이 step 의 가설 모드: leaselife — 소비자 lease 의 lifecycle 빈틈(시작-시점 죽음·축출 비가역) 해소 ──
const { run, itemConserved, ledgerConsistent } = NET;
const { check, pad } = kit.helpers;

// 0045 clease 와 동일 베이스(버스+ranking 둘째 소비자·min-워터마크·결과 ack). ops 가 결과 생산량(×6 클라). leaseSpan 전제 + busConsumerLease ON.
const BUS_BASE = (seed, ops) => ({ seed, ticks: 70, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2,
  incremental: true, recovery: true, inventory: true, itemOps: ops, chat: true, chatOps: 12, regions: 2,
  bus: true, audit: true, ranking: true, busResend: true, busOutAck: true, busMinWm: true,
  busConsumerLease: true, leaseSpan: LEASE_SPAN });
const LEASE_SPAN = 8;       // lease 임계(outSeq 뒤처짐) — 정상 ack lag·시작 grace 보다 크고, 영구 죽음은 frontier 전진으로 이내 초과 → 축출.
const NEVER_DIE = 1;        // §2 — ranking 이 tick 1 에 구독 해지 → *한 번도 ack 안 함*(consumerSeen·consumerWm 영영 미확립). 0047 은 이 소비자를 못 축출(정의역 밖) → min -1 고정.
const REVIVE_DIE = 14;      // §3 — ranking 이 초기 ack 으로 lease 확립한 *뒤* 다운(축출 대상). 0045 clease 의 RANK_DIE_AT 와 동일.
const REVIVE_AT = 30;       // §3 — 축출된 ranking 이 재구독(busReSub sub) → 결과 재수신 → 재-ack. 0047 은 evicted 영구라 미복귀, 이 step 은 재admission.

function leaselife(seeds) {
  console.log('== leaselife: *가설* — 0045 소비자 lease(busConsumerLease)의 두 빈틈(코드리뷰 §2/§3) 해소. §2 시작-시점 죽음: 한 번도 ack 안 한 소비자는 consumerSeen 미확립 → 축출 정의역 밖 + consumerWm 미확립으로 min 을 -1 에 고정 → outBuffer 무계(축출도 못 함). §3 축출 비가역: 축출된 소비자가 돌아와도 evicted 에서 못 빠져 min 정의역 미복귀 → 이후 starve 재발. busLeaseLife: ⒜ 지연 baseline(처음 본 미-ack 소비자 침묵 기준을 frontier 로·leaseSpan grace) ⒝ 재-ack 시 재admission ==');
  console.log(`  §2 never-ack: ranking 이 tick ${NEVER_DIE} 에 구독 해지(영영 ack 0). OFF(=0047·min -1 고정·축출 불가) vs ON(지연 baseline → leaseSpan ${LEASE_SPAN} 뒤 축출). ops 10/30(결과 ∝ 60/180)로 run-length 의존성 가시화.`);
  console.log(`  §3 revival: ranking 다운@${REVIVE_DIE}(축출) → 재구독@${REVIVE_AT}. OFF(evicted 영구·readm 0) vs ON(재admission·정의역 복귀). 산 소비자 오축출 0(ctl).`);
  console.log('seed   | §2 peak off/on (10/30) | §2 ev off/on | §3 ev/readm/evRank off→on | ctl ev/peak(=leaseOnly) | 판정');
  const REVIVE = [{ at: REVIVE_AT, from: 'ranking', type: 'sub', topic: 'svc.item.out' }];   // 축출된 ranking 재구독(0033 동적 sub 재사용) → 재-ack 경로
  for (const seed of seeds) {
    // §2 never-ack — OFF(=0047) 는 min -1 고정·축출 불가(무계), ON 은 지연 baseline 으로 leaseSpan 뒤 축출(유계)
    const a_off10 = run({ ...BUS_BASE(seed, 10), rankDie: NEVER_DIE });
    const a_on10  = run({ ...BUS_BASE(seed, 10), rankDie: NEVER_DIE, busLeaseLife: true });
    const a_off30 = run({ ...BUS_BASE(seed, 30), rankDie: NEVER_DIE });
    const a_on30  = run({ ...BUS_BASE(seed, 30), rankDie: NEVER_DIE, busLeaseLife: true });
    // §3 revival — OFF 는 evicted 영구(readm 0·ranking 영영 정의역 밖), ON 은 재-ack 시 재admission(정의역 복귀)
    const b_off = run({ ...BUS_BASE(seed, 30), rankDie: REVIVE_DIE, busReSub: REVIVE });
    const b_on  = run({ ...BUS_BASE(seed, 30), rankDie: REVIVE_DIE, busReSub: REVIVE, busLeaseLife: true });
    // 대조군 ctl — ranking 죽음 *없음* + busLeaseLife ON → 오축출 0·재admission 0·peak == lease 만(0047) peak(정상 동작 무간섭)
    const ctl   = run({ ...BUS_BASE(seed, 30), busLeaseLife: true });
    const ctlNL = run({ ...BUS_BASE(seed, 30) });
    const aPOff10 = a_off10.inventory.outBufPeak, aPOn10 = a_on10.inventory.outBufPeak;
    const aPOff30 = a_off30.inventory.outBufPeak, aPOn30 = a_on30.inventory.outBufPeak;
    const aEvOff = a_off30.inventory.evictions, aEvOn = a_on30.inventory.evictions;
    const bEvOn = b_on.inventory.evictions, bRdOff = b_off.inventory.readmissions, bRdOn = b_on.inventory.readmissions;
    const bRankOff = b_off.inventory.evicted.has('ranking'), bRankOn = b_on.inventory.evicted.has('ranking');
    const ok =
      // §2 ① ON 이 OFF 보다 작음(축출 drain) ② OFF run-length 비례(무계·min -1 고정) ③ ON run-length 무관(유계) ④ OFF 축출 0(0047 정의역 밖) ⑤ ON 축출 ≥1(지연 baseline) ⑥ minted 보존
      check(aPOn30 < aPOff30, `seed ${seed}: §2 ON peak 가 OFF 보다 안 작음(ops30 ${aPOff30}→${aPOn30})`) &&
      check(aPOff30 > aPOff10, `seed ${seed}: §2 OFF peak 가 run-length 무관(무계면 ops10<ops30: ${aPOff10},${aPOff30})`) &&
      check(aPOn30 <= aPOn10, `seed ${seed}: §2 ON peak 가 run-length 에 비례(유계면 ops30≤ops10: ${aPOn10},${aPOn30})`) &&
      check(aEvOff === 0 && aEvOn >= 1, `seed ${seed}: §2 never-ack 축출(OFF 0·ON≥1) 위반(off ${aEvOff}·on ${aEvOn})`) &&
      check(a_off30.inventory.minted === a_on30.inventory.minted, `seed ${seed}: §2 가지치기가 dedup 정확성 깸(minted off ${a_off30.inventory.minted} ≠ on ${a_on30.inventory.minted})`) &&
      // §3 ① ON 재admission ≥1 ② OFF 재admission 0(비가역) ③ ON 은 먼저 축출됨(재admission 유의미) ④ OFF 영영 evicted vs ON 정의역 복귀 ⑤ 원장 자기-정합
      check(bRdOn >= 1 && bRdOff === 0, `seed ${seed}: §3 재admission(ON≥1·OFF 0) 위반(off ${bRdOff}·on ${bRdOn})`) &&
      check(bEvOn >= 1, `seed ${seed}: §3 ON 이 먼저 축출 안 됨(재admission 무의미·ev ${bEvOn})`) &&
      check(bRankOff === true && bRankOn === false, `seed ${seed}: §3 정의역 복귀 위반(OFF evicted ${bRankOff}·ON evicted ${bRankOn})`) &&
      check(ledgerConsistent(b_on) && itemConserved(b_on) && ledgerConsistent(a_on30) && itemConserved(a_on30), `seed ${seed}: 원장 자기-정합 깨짐`) &&
      // ctl 산 소비자 오축출 0·재admission 0·peak 무간섭(== lease 만 0047)
      check(ctl.inventory.evictions === 0 && ctl.inventory.readmissions === 0 && ctl.inventory.outBufPeak === ctlNL.inventory.outBufPeak, `seed ${seed}: lease lifecycle 가 정상 동작 간섭(ctl ev ${ctl.inventory.evictions}·readm ${ctl.inventory.readmissions}·peak ${ctl.inventory.outBufPeak} vs leaseOnly ${ctlNL.inventory.outBufPeak})`);
    console.log(`${pad(seed, 6)} | ${pad(aPOff10 + '/' + aPOn10 + ' ' + aPOff30 + '/' + aPOn30, 22)} | ${pad(aEvOff + '/' + aEvOn, 12)} | ${pad(bEvOn + '/' + bRdOff + '→' + bRdOn + '/' + bRankOff + '→' + bRankOn, 25)} | ${pad(ctl.inventory.evictions + '/' + ctl.inventory.outBufPeak + '(' + ctlNL.inventory.outBufPeak + ')', 23)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log(`  → §2: 0045 lease 는 침묵 기준을 *첫 ack 시점*에야 세운다 → 한 번도 ack 안 한 소비자는 미확립 = 축출 정의역 밖 + consumerWm 미확립으로 min -1 고정 → OFF peak 가 생산량(run-length)에 비례(무계). 이 step 의 *지연 baseline*(처음 본 미-ack 소비자에 frontier 기준을 깔고 leaseSpan grace) → ON 은 축출(ev≥1)·유계(run-length 무관).`);
  console.log(`    §3: 0045 는 evicted 가 영구라 축출된 소비자가 돌아와도 min 정의역 미복귀 → 이후 결과 starve 재발(OFF readm 0·영영 evicted). 이 step: 축출된 소비자가 재-ack 하면 evicted 에서 제거(재admission·readm≥1) → 정의역 복귀 → 이후 결과 보존. 옛 가지친 결과는 자기 저널 reconstruct(0020)로 복구(버퍼 replay 아님).`);
  console.log(`    busLeaseLife=0 = 0047 비트 동일(지연 baseline 미확립·재admission 0·evicted 동작 무변경·reg). ctl: 산 소비자는 leaseSpan grace 안에 ack 해 오축출 0·peak 무간섭(구성-시점 -1 baseline 은 시작 ack 지연이 grace 를 넘으면 건강한 소비자도 오축출 → 지연 baseline 채택·§9). 정직한 한계: leaseSpan 은 영구-죽음 vs 일시-지연 분리 임계(여전히 오축출 위험)·다중 게이트웨이 producer 별 lease 는 후속.`);
}

kit.MODES['leaselife'] = leaselife;
kit.ORDER.splice(1, 0, 'leaselife');   // reg 직후(가설 우선 노출)

(async () => { process.exit(await kit.cli(process.argv)); })();
