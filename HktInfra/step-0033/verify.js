// HktInfra step-0033 — 헤드리스 검증 (윈도 해소의 *유계 sweep + fill 손실 retry*)
// 사용: node step-0033/verify.js <mode> [seed]
//   mode 카탈로그·각 모드 문서: engine/verify-kit.js 헤더 (0001~0029 누적 모드 = 키트). 이 step 의 새 모드 = wfretry(아래).
//   이 step 의 가설: 0031 윈도 해소 sweep 은 ⒜ fill 자체가 손실돼도 *주기적 재-scan 이 내장 retry* 로 수렴하고
//                    ⒝ sweep 범위를 wfWindow 로 유계화(미끄러지는 창)해도 전체 윈도를 결국 덮는다(per-sweep O(K) 비용 상한).
// 작성법: 누적 회귀(reg 등 18모드)는 키트가 든다(0031 wfill 은 그 step 의 *가설* 모드라 셸 한정 — 이 step 은 noloss 기준선이 그 동작을 재검증). 셸은 ctx 구성 + 이 step 의 새 모드만 추가.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../step-0032/net-core.js');   // reg 대조용(직전 step)
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40;        // 권위 존 사망 tick(failover)
const LEASE = 3;         // lease 결손 임계
const RESTART_AT = 60;   // 가방 서비스 재시작 tick(quiescent — 저널 drain 완료 → 복구 투명)
const SNAP_N = 6;        // 가방 저널 스냅샷 압축 주기(0018)
const CHAT_SNAP_N = 5;   // 채팅 커맨드 로그 스냅샷 압축 주기(0022)
const JLOSS = 0.3;       // 저널 홉 손실율(0023~) — inventory→persist 홉 신뢰 NAK/재전송 자극

const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

// ── 이 step 의 새 모드: wfretry — 윈도 해소의 유계 sweep + fill 손실 retry ──
const { run, quorumMergeJournals, itemConserved, ledgerConsistent, itemDesync } = NET;
const { check, pad } = kit.helpers;

// 0029/0031 quorum 쓰기 토폴로지 재사용 — primary + R=3 복제 = N+1=4 사본·W=3 정족수.
const QR = 3, QW = 3;
const WF_K = 8;   // 유계 sweep 창 크기(이 step) — 윈도(~24)보다 작게 잡아 *미끄러지는 창*이 전체를 덮는지 검증.
const BASE = (seed) => ({ seed, ticks: 70, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2, incremental: true, recovery: true });
const WQ_BASE = (seed) => ({ ...BASE(seed), inventory: true, itemOps: 10, chat: true, chatOps: 12, regions: 2,
  bus: true, audit: true, ranking: true, persist: true, persistReplicas: QR, quorumW: QW });
const WTAIL_T = (total) => Math.floor(total * 0.6);   // 윈도 시작 seq(저널 후반 40% 가 정족수 미달)

// fill 무손실 윈도(0031 XQUORUMLOSS) — 원 발신만 떨굼(resend 제외) → fill 은 전부 배달(retry 0 의 기준선).
const XQ_NOFILLLOSS = (seed, T) => ({ seed: (seed ^ 0x71A0) >>> 0, delayMin: 0, delayMax: 0, loss: 1.0, redundancy: 1,
  routeFilter: (m) => {
    if (m.payload.type !== 'journal' || m.payload.resend) return false;
    if (m.to === 'persist2') return true;
    if (m.to === 'persist3' && m.payload.entry.seq >= T) return true;
    return false;
  } });
// fill 손실(이 step) — 원 발신(윈도 생성)에 더해 *각 (seq,store) fill 의 첫 시도*도 떨군다(loss 1.0):
//   첫 fill 시도만 떨구고(seenFill 마킹) 둘째 시도부터 통과 → 결정론적으로 fill 당 정확히 1회 retry 강제.
//   순수 결정론(PRNG 무관·seenFill 마킹 순서는 sweep 순서 = 결정론). run 마다 새 인스턴스(fresh 클로저).
const XQ_FILLLOSS = (seed, T) => {
  const seenFill = new Set();   // (seq:store) 첫 fill 시도 식별 — 첫 시도만 떨굼(retry 자극)
  return { seed: (seed ^ 0x71A0) >>> 0, delayMin: 0, delayMax: 0, loss: 1.0, redundancy: 1,
    routeFilter: (m) => {
      if (m.payload.type !== 'journal') return false;
      if (!m.payload.resend) {   // 원 발신 — 0031 윈도 생성 패턴(persist2 전부·persist3 seq≥T)
        if (m.to === 'persist2') return true;
        if (m.to === 'persist3' && m.payload.entry.seq >= T) return true;
        return false;
      }
      if (m.to !== 'persist2' && m.to !== 'persist3') return false;   // primary/persist4 로의 fill 은 안 떨굼(보유자라 어차피 안 옴)
      const key = m.payload.entry.seq + ':' + m.to;
      if (seenFill.has(key)) return false;   // 이미 첫 시도를 떨궜음 → 이제 통과(retry 배달)
      seenFill.add(key); return true;        // 첫 fill 시도 → 떨굼 → 다음 sweep 이 retry
    } };
};
const noDupSeq = (store) => { const seen = new Set(); for (const e of store.journal) { if (seen.has(e.seq)) return false; seen.add(e.seq); } return true; };

function wfretry(seeds) {
  console.log('== wfretry: *가설* — 윈도 해소 sweep 의 ⒜ fill 손실 retry(주기 재-scan 이 내장 retry) ⒝ 유계 sweep(미끄러지는 창이 전체 윈도 덮음) ==');
  console.log('  기준: 무손실 fill(0031) durSeq=total-1·fills=F0. fill손실(첫시도 드롭): 무계/유계(K=8) 둘 다 durSeq=total-1·윈도0·fills>F0(retry).');
  console.log('seed   | total |  T | 무손실 durSeq/fills | fill손실·무계 durSeq/win/fills | fill손실·유계K=8 durSeq/win/fills | retry↑ | dupe0 | crash생존 | desync0 | 판정');
  for (const seed of seeds) {
    const total = run(WQ_BASE(seed)).inventory.journalSeq;
    const T = WTAIL_T(total);
    // 기준선 — fill 무손실(0031): 윈도 해소·retry 0
    const noloss = run({ ...WQ_BASE(seed), transport: XQ_NOFILLLOSS(seed, T), windowFill: true });
    // fill 손실·무계 sweep — 첫 fill 시도 드롭 → 다음 sweep retry → 수렴
    const lossU  = run({ ...WQ_BASE(seed), transport: XQ_FILLLOSS(seed, T), windowFill: true });
    // fill 손실·유계 sweep(K=8) — 미끄러지는 창 + retry → 여전히 수렴
    const lossB  = run({ ...WQ_BASE(seed), transport: XQ_FILLLOSS(seed, T), windowFill: true, wfWindow: WF_K });

    const F0 = noloss.inventory.windowFills, dN = noloss.inventory.durableSeq;
    const dU = lossU.inventory.durableSeq, winU = total - 1 - dU, FU = lossU.inventory.windowFills;
    const dB = lossB.inventory.durableSeq, winB = total - 1 - dB, FB = lossB.inventory.windowFills;

    const baseOK = dN === total - 1;                                // 무손실 기준선 수렴(0031)
    const lossUOK = dU === total - 1 && winU === 0;                 // ⒜ fill 손실에도 무계 sweep 수렴(retry)
    const lossBOK = dB === total - 1 && winB === 0;                 // ⒝ fill 손실 + 유계 sweep 도 수렴(미끄러지는 창)
    const retryUp = FU > F0 && FB > F0;                             // retry 가 실제 발생(fill 손실분 재발신 → fills 증가)
    const dupe0 = noDupSeq(lossB.persist) && lossB.replicaStores.every(noDupSeq) && lossU.replicaStores.every(noDupSeq);   // 첫 시도 드롭은 미저장·재시도만 저장 → 중복 0
    // crash{primary,p4} 후 생존 {persist2,persist3} union 이 전 seq 보유(유계+retry 도 진짜 durable 생산)
    const surv = new Set(quorumMergeJournals([lossB.replicaStores[0], lossB.replicaStores[1]]).journal.map(e => e.seq));
    let crashAll = true; for (let s = 0; s <= total - 1; s++) if (!surv.has(s)) crashAll = false;
    const desync0 = itemConserved(lossB) && ledgerConsistent(lossB) && itemDesync(lossB) === 0;

    const ok =
      check(baseOK, `seed ${seed}: 무손실 기준선 미수렴(durable ${dN}/${total - 1})`) &&
      check(lossUOK, `seed ${seed}: fill손실·무계 미수렴(durable ${dU}·win ${winU})`) &&
      check(lossBOK, `seed ${seed}: fill손실·유계K=${WF_K} 미수렴(durable ${dB}·win ${winB})`) &&
      check(retryUp, `seed ${seed}: retry 미발생(F0 ${F0}·FU ${FU}·FB ${FB} — fill 손실에도 재발신 안 늘음)`) &&
      check(dupe0, `seed ${seed}: retry 가 중복 seq 생성(멱등 위반)`) &&
      check(crashAll, `seed ${seed}: 유계+retry durable 이 crash{primary,p4} 에 소실(진짜 durable 아님)`) &&
      check(desync0, `seed ${seed}: 라이브 원장 보존/정합/desync 깨짐`);
    console.log(`${pad(seed, 6)} | ${pad(total, 5)} | ${pad(T, 2)} | ${pad(dN + '/' + F0, 18)} | ${pad(dU + '/' + winU + '/' + FU, 29)} | ${pad(dB + '/' + winB + '/' + FB, 32)} | ${(retryUp ? '예' : '아니오').padEnd(6)} | ${(dupe0 ? '예' : '아니오').padEnd(5)} | ${(crashAll ? '전부' : '소실').padEnd(8)} | ${(desync0 ? '예' : '아니오').padEnd(7)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → ⒜ fill 손실 retry: 첫 fill 시도가 떨궈져 ack 가 안 오면 seq 가 n<W 로 남는다 → *다음 sweep 이 같은 seq 를 자연 재발신*(주기 재-scan = 내장 retry) → 둘째 시도 배달 → 정족수 충족 → 수렴.');
  console.log('    ⒝ 유계 sweep: 매 sweep [durableSeq+1 .. durableSeq+K] 만 훑어 per-sweep O(K) 상한. durableSeq 전진에 창이 미끄러져 전체 윈도(~24)를 K=8 로도 덮는다. 첫 시도 미저장·retry 만 저장 → dupe 0. wfWindow 0 = 무계(0031 비트 동일).');
}
kit.MODES['wfretry'] = wfretry;
kit.ORDER.splice(1, 0, 'wfretry');   // reg 직후(가설 우선 노출)

(async () => { process.exit(await kit.cli(process.argv)); })();
