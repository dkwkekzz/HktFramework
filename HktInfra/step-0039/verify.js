// HktInfra step-0039 — 헤드리스 검증 (버스 failover replay 버퍼 *유계화* — busWindow 슬라이딩 K 창)
// 사용: node step-0039/verify.js <mode> [seed]
//   mode 카탈로그·각 모드 문서: engine/verify-kit.js 헤더 (0001~0029 누적 모드 = 키트). 이 step 의 새 가설 = `buswin`.
//   더한 한 조각: 0036 outBuffer(결과)·0037 inBuffer(요청) 의 *무계 성장* 을 0032 wfWindow 의 버스 판으로 유계화 —
//                 busWindow=K 면 두 replay 버퍼가 *최근 K 개*로 슬라이딩(메모리 O(K) 상한). K≥gap 이면 무손실 유지·K<gap 이면 손실 재현.
//   검증: ⒜ `reg`(키트) — busWindow=0(기본)이면 NET 이 직전 step(0038)과 *비트 동일*(replay 버퍼 미사용·OFF 경로).
//         ⒝ `buswin`(이 step·가설) — unbnd(K=0·무계) vs bnd(K≥gap·유계 무손실) vs tiny(K<gap·유계 손실) 비교로 ① 버퍼 유계 ② K≥gap 무손실 ③ 바운드 load-bearing 증명.
// 작성법: 누적 회귀(reg 등 18모드)는 키트가 든다. 셸은 ctx 구성 + 이번 step 가설 모드(buswin)만 더한다.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../step-0038/net-core.js');   // reg 대조용(직전 step)
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40;        // 권위 존 사망 tick(failover)
const LEASE = 3;         // lease 결손 임계
const RESTART_AT = 60;   // 가방 서비스 재시작 tick(quiescent — 저널 drain 완료 → 복구 투명)
const SNAP_N = 6;        // 가방 저널 스냅샷 압축 주기(0018)
const CHAT_SNAP_N = 5;   // 채팅 커맨드 로그 스냅샷 압축 주기(0022)
const JLOSS = 0.3;       // 저널 홉 손실율(0023~) — inventory→persist 홉 신뢰 NAK/재전송 자극

const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

// ── 이 step 의 가설 모드: buswin — 버스 failover replay 버퍼(0036 outBuffer·0037 inBuffer)를 유계 K 창으로 슬라이딩 ──
const { run, itemConserved, ledgerConsistent, itemDesync } = NET;
const { check, pad } = kit.helpers;

// 가방·채팅·버스·audit·ranking 가 도는 토폴로지(영속/quorum 불필요 — 버스 라우팅만 자극). 0036/0037 busfail 과 동일 베이스.
const BUS_BASE = (seed) => ({ seed, ticks: 70, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2,
  incremental: true, recovery: true, inventory: true, itemOps: 10, chat: true, chatOps: 12, regions: 2,
  bus: true, audit: true, ranking: true });
// svc.item 요청 스트림은 활성 초반에 몰린다. crash@12→재협상@14 가 활성 구간을 갈라 gap 에 18개 요청/결과가 떨어진다(사전 측정·아래 K 임계의 근거).
const CRASH_AT = 12, RENEG_AT = 14;
const K_ADQ = 24;   // 유계-충분: K≥gap(18) — 두 버퍼가 24 로 묶이되 gap 을 덮어 무손실(unbnd 60 의 40%).
const K_TINY = 8;   // 유계-부족: K<gap(18) — gap 의 가장 오래된 요청/결과가 evict → 손실 재현(바운드가 load-bearing 임을 보임).

function buswin(seeds) {
  console.log('== buswin: *가설* — 0036/0037 producer replay 버퍼를 *유계 K 창*(busWindow)으로 슬라이딩: K≥gap 이면 메모리 유계 + 무손실, K<gap 이면 손실 재현(0032 wfWindow 의 버스 판) ==');
  console.log(`  bus.crash(@${CRASH_AT})→재협상(@${RENEG_AT}). 모두 busResend+busResendReq ON(전 replay). unbnd(K=0·무계) vs bnd(K=${K_ADQ}≥gap) vs tiny(K=${K_TINY}<gap) 비교.`);
  console.log('seed   | minted base/unbnd/bnd/tiny | buf unbnd/bnd/tiny | desync unbnd/bnd/tiny | 판정');
  for (const seed of seeds) {
    const base  = run(BUS_BASE(seed));   // crash 0 — 전 요청/결과 도달(무손실 기준)
    const R = (K) => run({ ...BUS_BASE(seed), busRestart: { at: CRASH_AT, renegAt: RENEG_AT }, busResend: true, busResendReq: true, busWindow: K });
    const unbnd = R(0), bnd = R(K_ADQ), tiny = R(K_TINY);

    const mB = base.inventory.minted;
    const mU = unbnd.inventory.minted, mA = bnd.inventory.minted, mT = tiny.inventory.minted;
    // 두 replay 버퍼(게이트웨이 inBuffer·가방 outBuffer) 의 최종 길이 — 유계화의 직접 증거(슬라이딩 후 ≤K).
    const bufU = Math.max(unbnd.gateway.inBuffer.length, unbnd.inventory.outBuffer.length);
    const bufA = Math.max(bnd.gateway.inBuffer.length, bnd.inventory.outBuffer.length);
    const bufT = Math.max(tiny.gateway.inBuffer.length, tiny.inventory.outBuffer.length);
    const dU = itemDesync(unbnd), dA = itemDesync(bnd), dT = itemDesync(tiny);

    // ① 유계: K>0 면 두 버퍼가 K 로 묶인다(unbnd 는 K=0 라 활성 op 수만큼 무계 성장 → bufU > K_ADQ).
    const bounded = bufA <= K_ADQ && bufT <= K_TINY && bufU > K_ADQ;
    // ② K≥gap 무손실 투명: bnd 가 unbnd(무계)와 *비트적으로 같은 결과* — minted==base 이고 desync 0(유계화가 동작에 무영향).
    const adequateLossless = mU === mB && mA === mB && dU === 0 && dA === 0;
    // ③ 바운드 load-bearing: K<gap 이면 가장 오래된 gap 요청/결과가 evict → 손실 재현(minted<base 또는 desync>0). 임의 K 가 아니라 *gap 을 덮어야* 무손실.
    const tinyLossy = mT < mB || dT > 0;
    // 원장 무손상 — 유계 슬라이딩이 원장 보존(size==minted)·정합(byOwner≡ledger)을 깨지 않는다(전 변형이 dupe 0).
    const ledgerValid = itemConserved(bnd) && ledgerConsistent(bnd) && itemConserved(tiny) && ledgerConsistent(tiny) && itemConserved(unbnd) && ledgerConsistent(unbnd);

    const ok =
      check(bounded, `seed ${seed}: 버퍼 유계 안 됨(bnd ${bufA}≤${K_ADQ}? tiny ${bufT}≤${K_TINY}? unbnd ${bufU}>${K_ADQ}?)`) &&
      check(adequateLossless, `seed ${seed}: K≥gap 무손실/투명 깨짐(base ${mB}·unbnd ${mU}·bnd ${mA}·desync ${dU}/${dA})`) &&
      check(tinyLossy, `seed ${seed}: K<gap 인데 손실 안 보임(바운드 비-load-bearing? tiny minted ${mT}·desync ${dT})`) &&
      check(ledgerValid, `seed ${seed}: 유계 슬라이딩이 원장 보존/정합 깨뜨림(손상)`);
    console.log(`${pad(seed,6)} | ${pad(mB+'/'+mU+'/'+mA+'/'+mT,25)} | ${pad(bufU+'/'+bufA+'/'+bufT,18)} | ${pad(dU+'/'+dA+'/'+dT,21)} | ${ok?'OK':'FAIL'}`);
  }
  console.log(`  → 0036 outBuffer·0037 inBuffer 는 발신한 *전* 결과/요청을 무계로 쌓았다(장기 가동 시 메모리 무한 성장). failover 가 메우려는 건 gap 구간뿐이라,`);
  console.log(`    버퍼는 그 창을 덮을 만큼만 있으면 된다 — busWindow=K 로 *최근 K 개*만 보관(미끄러지는 유계 창·0032 wfWindow 의 버스 판) → per-producer 메모리 O(K) 상한.`);
  console.log(`    bnd(K=${K_ADQ}≥gap 18): 두 버퍼 ≤${K_ADQ}(무계 unbnd 60 의 40%) *그리고* minted==base·desync 0 — 유계화가 동작에 *투명*(gap 요청/결과는 재구독 시점 최근 항목이라 K 안에 남음).`);
  console.log(`    tiny(K=${K_TINY}<gap 18): 가장 오래된 gap 요청/결과가 evict → minted<base·desync>0(손실 재현) — 바운드가 load-bearing(임의 K 가 아니라 gap 을 덮어야 무손실).`);
  console.log(`    정직한 한계: gap 크기(18)는 crash↔reneg 창과 요청 분포의 함수 — 운영에선 K 를 *최대 예상 다운타임×발신율* 로 잡아야(적응형 K 는 후속). busWindow=0 = 0038 비트 동일(reg).`);
}
kit.MODES['buswin'] = buswin;
kit.ORDER.splice(1, 0, 'buswin');   // reg 직후(가설 우선 노출)

(async () => { process.exit(await kit.cli(process.argv)); })();
