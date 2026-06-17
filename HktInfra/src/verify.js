// HktInfra step-0050 — 헤드리스 검증 (적응형 leaseSpan — 축출 임계를 관측 cadence 로 self-size·busLeaseAdapt)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그·각 모드 문서: engine/verify-kit.js 헤더 (누적 회귀 모드 = 키트). 이 step 의 새 가설 = `adapt`.
//   더한 한 조각: 0045~0048 소비자 lease 의 *정직한 한계* 해소 — 고정 leaseSpan 은 *정상 ack cadence(침묵)보다 커야* 산 소비자를 안 쫓는다.
//     그 cadence(생산율×소비자 속도)는 사전에 알 수 없다 → 너무 작으면 *산* 소비자를 cadence 주기마다 반복 오축출(flapping), 너무 크면 죽은 소비자 늦게 감지(0048 verify §9).
//   해법(busLeaseAdapt): 소비자가 ack 할 때마다 그 직전 침묵(=살아서 견딘 cadence)을 per-c 러닝 최대(consumerMaxGap)로 학습 → 축출 임계 = consumerMaxGap + leaseSpan(여유 마진). leaseSpan 의미: 고정 임계 → 관측 cadence 위 마진.
//   검증: ⒜ `reg`(키트) — busLeaseAdapt=0(기본)이면 NET 이 직전 step(0049)과 *비트 동일*(consumerMaxGap 미사용·고정 leaseSpan 예측).
//         ⒝ `adapt`(이 step·가설) — 고정 작은 leaseSpan(+readmission)은 산 소비자를 cadence 주기마다 재축출(flapping·ev ∝ 생산량) vs 적응형은 cadence 학습 후 정착(ev = O(1)·생산량 무관)·죽은 소비자는 *여전히* 축출(죽음 감지 보존·peak 유계 vs no-lease 무계)·minted 보존.
// 작성법: 누적 회귀(reg 등)는 키트가 든다. 셸은 ctx 구성 + 이번 step 가설 모드(adapt)만 더한다.
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

// ── 이 step 의 가설 모드: adapt — 축출 임계를 관측 ack cadence 로 self-size(busLeaseAdapt) ──
const { run, itemConserved, ledgerConsistent } = NET;
const { check, pad } = kit.helpers;

// 0048 leaselife 와 동일 베이스(버스+ranking 둘째 소비자·min-워터마크·결과 ack·lifecycle 정합). ops 가 결과 생산량(×6 클라).
//   leaseSpan 을 *작게*(SLACK=3) 둔다 — 산 ranking 의 정상 cadence(침묵 peak ~6)보다 작아 고정 임계로는 cadence 주기마다 오축출(flapping). 적응형 ON 이면 이 값이 *cadence 위 마진* 으로 의미 전환.
//   busLeaseLife ON(readmission) — 고정 임계의 flapping(축출→재admission→재축출)을 *측정 가능*하게(영구 evicted 가 아니라 churn 횟수로). 적응형은 학습 후 정착해 churn 이 멈춘다.
const SLACK = 3;           // 작은 leaseSpan — 고정(OFF): 절대 임계(<정상 cadence ~6 → flapping). 적응(ON): 관측 cadence 위 여유 마진.
const DEAD_DIE = 14;       // 죽음 대조 — ranking 이 lease 확립 후 다운(영영 ack 끊김). 적응형도 *여전히* 축출해야(죽음 감지 보존).
const BUS_BASE = (seed, ops, extra) => ({ seed, ticks: 90, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2,
  incremental: true, recovery: true, inventory: true, itemOps: ops, chat: true, chatOps: 12, regions: 2,
  bus: true, audit: true, ranking: true, busResend: true, busOutAck: true, busMinWm: true,
  busConsumerLease: true, leaseSpan: SLACK, busLeaseLife: true, ...extra });

function adapt(seeds) {
  console.log('== adapt: *가설* — 소비자 lease 의 *정직한 한계*(0048 verify §9) 해소: 고정 leaseSpan 은 *정상 ack cadence(침묵)보다 커야* 산 소비자를 안 쫓는데, 그 cadence(생산율×소비자 속도)는 사전에 모른다. busLeaseAdapt: 소비자가 ack 할 때마다 그 직전 침묵(=살아서 견딘 cadence)을 per-c 러닝 최대(consumerMaxGap)로 학습 → 축출 임계 = consumerMaxGap + leaseSpan(여유 마진) ==');
  console.log(`  live: ranking 은 *계속 산다*. 정상 cadence(침묵 peak ~6) > 고정 leaseSpan ${SLACK} → OFF 는 cadence 주기마다 오축출+재admission(flapping·ev ∝ 생산량). ON 은 cadence 학습 후 임계가 올라 정착(ev = O(1)·생산량 무관). ops 10/30 으로 생산량 의존성 가시화.`);
  console.log(`  dead: ranking 이 tick ${DEAD_DIE} 에 다운(영영 ack 끊김). 적응형도 consumerMaxGap 동결 → 침묵이 동결값+마진 초과 → *여전히* 축출(죽음 감지 보존). peak 유계 vs lease 끔(no-lease·무계) 대조.`);
  console.log('seed   | live ev OFF 10/30 | live ev ON 10/30 | dead ev/evicted/peak(noLease) | minted OFF/ON | 판정');
  for (const seed of seeds) {
    // live — ranking 계속 산다. OFF(고정 작은 임계)=cadence 주기마다 재축출(flapping·ev ∝ 생산량) vs ON(적응)=학습 후 정착(ev O(1))
    const f10 = run({ ...BUS_BASE(seed, 10) });
    const f30 = run({ ...BUS_BASE(seed, 30) });
    const a10 = run({ ...BUS_BASE(seed, 10, { busLeaseAdapt: true }) });
    const a30 = run({ ...BUS_BASE(seed, 30, { busLeaseAdapt: true }) });
    // dead — ranking 다운(영영 ack 끊김). 적응형도 여전히 축출(죽음 감지) vs lease 끔(no-lease)=outBuffer 무계 보유
    const dead   = run({ ...BUS_BASE(seed, 30, { busLeaseAdapt: true, rankDie: DEAD_DIE }) });
    const deadNL = run({ ...BUS_BASE(seed, 30, { rankDie: DEAD_DIE, busConsumerLease: false }) });
    const fEv10 = f10.inventory.evictions, fEv30 = f30.inventory.evictions;
    const aEv10 = a10.inventory.evictions, aEv30 = a30.inventory.evictions;
    const dEv = dead.inventory.evictions, dRank = dead.inventory.evicted.has('ranking');
    const dPeak = dead.inventory.outBufPeak, dPeakNL = deadNL.inventory.outBufPeak;
    const ok =
      // live ① 고정 OFF 가 산 소비자를 축출(flapping·ev≥1) ② OFF ev 가 생산량에 비례(cadence 주기마다·ops30>ops10) ③ 적응 ON 이 OFF 보다 훨씬 적게 축출(학습) ④ ON ev 가 생산량 무관(O(1)·ops30≤ops10) ⑤ minted 보존(dedup 정확성)
      check(fEv30 >= 1, `seed ${seed}: live OFF 가 산 소비자를 안 축출(flapping 부재·ev ${fEv30})`) &&
      check(fEv30 > fEv10, `seed ${seed}: live OFF ev 가 생산량 비례 아님(flapping 이면 ops30>ops10: ${fEv10},${fEv30})`) &&
      check(aEv30 < fEv30, `seed ${seed}: 적응 ON 이 OFF 보다 덜 축출 안 함(학습 실패·on ${aEv30}·off ${fEv30})`) &&
      check(aEv30 <= aEv10, `seed ${seed}: 적응 ON ev 가 생산량 비례(O(1)이면 ops30≤ops10: ${aEv10},${aEv30})`) &&
      check(f30.inventory.minted === a30.inventory.minted, `seed ${seed}: 적응이 dedup 정확성 깸(minted OFF ${f30.inventory.minted} ≠ ON ${a30.inventory.minted})`) &&
      // dead ① 죽은 소비자는 적응형도 축출(죽음 감지 보존) ② 그 결과 outBuffer 유계 vs lease 끔(무계) ③ 원장 자기-정합
      check(dEv >= 1 && dRank === true, `seed ${seed}: 적응이 죽은 소비자 축출 못 함(ev ${dEv}·evicted ${dRank})`) &&
      check(dPeak < dPeakNL, `seed ${seed}: 죽음 축출이 outBuffer 유계화 못 함(peak ${dPeak} vs no-lease ${dPeakNL})`) &&
      check(ledgerConsistent(a30) && itemConserved(a30) && ledgerConsistent(dead) && itemConserved(dead), `seed ${seed}: 원장 자기-정합 깨짐`);
    console.log(`${pad(seed, 6)} | ${pad(fEv10 + '/' + fEv30, 17)} | ${pad(aEv10 + '/' + aEv30, 16)} | ${pad(dEv + '/' + dRank + '/' + dPeak + '(' + dPeakNL + ')', 29)} | ${pad(f30.inventory.minted + '/' + a30.inventory.minted, 13)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log(`  → live: 고정 작은 leaseSpan(${SLACK}) < 산 ranking 정상 cadence(~6) → OFF 는 cadence 주기마다 침묵이 임계 초과 → 오축출, busLeaseLife 가 재-ack 시 재admission → 다음 주기 또 축출(flapping·ev ∝ 생산량). 적응 ON 은 첫 cadence 를 학습(consumerMaxGap)해 임계를 cadence+마진 으로 올림 → bootstrap 1회 뒤 정착(ev=O(1)·생산량 무관).`);
  console.log(`    dead: ranking 이 영영 ack 을 끊으면 consumerMaxGap 이 동결 → 침묵이 동결값+마진 초과 → 적응형도 *여전히* 축출(죽음 감지 보존) → outBuffer 유계(vs lease 끔 = min 이 죽은 frontier 에 고정 → 무계). leaseSpan 의 의미 전환: 고정 임계(OFF) → 관측 cadence 위 마진(ON) — 사전에 cadence 를 몰라도 산/죽음을 가른다.`);
  console.log(`    busLeaseAdapt=0 = 0049 비트 동일(consumerMaxGap 미사용·고정 leaseSpan 예측·reg). 정직한 한계: bootstrap 1회 오축출은 readmission 으로 회복하나 *0* 은 아니다(첫 cadence 미관측 구간은 prior 가 없어 근본적) — 시작 grace prior 는 후속. 다중 게이트웨이 producer 별 cadence·EWMA 감쇠(cadence 가 줄 때 임계 하향)는 후속.`);
}

kit.MODES['adapt'] = adapt;
kit.ORDER.splice(1, 0, 'adapt');   // reg 직후(가설 우선 노출)

(async () => { process.exit(await kit.cli(process.argv)); })();
