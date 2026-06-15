// HktInfra step-0037 — 헤드리스 검증 (버스 failover *요청 경로 무손실* — gateway producer replay 로 base 대비 mint 손실 0)
// 사용: node step-0037/verify.js <mode> [seed]
//   mode 카탈로그·각 모드 문서: engine/verify-kit.js 헤더 (0001~0029 누적 모드 = 키트). 이 step 의 새 모드 = busreq(아래·0036 위에 한 조각 확장).
//   이 step 의 가설: 0036 은 버스 crash gap 의 *결과* 경로(svc.item.out)를 가방 producer replay 로 무손실화했다. 그 거울인 *요청* 경로(svc.item)는
//                    아직 손실(gap 에 떨군 pickup/give 요청은 가방에 도달조차 못 해 mint 자체가 안 일어남 → 원장이 base 보다 작음 = mint 손실·0036 §9).
//                    요청의 producer 인 *게이트웨이*가 발행 요청을 보관했다 버스 복구 시 *재발행*하면 gap 에 떨군 요청이 가방에 도달해 mint → base 대비 mint 손실 0.
//                    재발행은 gap 전 도달분도 함께 보내므로(pickup 은 매번 새 itemId mint = 멱등 불가) 요청마다 reqId 를 실어 가방이 dedup → 이중 mint 0.
// 작성법: 누적 회귀(reg 등 18모드)는 키트가 든다. 셸은 ctx 구성 + 이 step 의 새 모드(busreq)만 추가.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../step-0036/net-core.js');   // reg 대조용(직전 step)
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40;        // 권위 존 사망 tick(failover)
const LEASE = 3;         // lease 결손 임계
const RESTART_AT = 60;   // 가방 서비스 재시작 tick(quiescent — 저널 drain 완료 → 복구 투명)
const SNAP_N = 6;        // 가방 저널 스냅샷 압축 주기(0018)
const CHAT_SNAP_N = 5;   // 채팅 커맨드 로그 스냅샷 압축 주기(0022)
const JLOSS = 0.3;       // 저널 홉 손실율(0023~) — inventory→persist 홉 신뢰 NAK/재전송 자극

const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

// ── 이 step 의 새 모드: busreq — 버스 failover *요청 경로* 무손실(gateway producer replay·base 대비 mint 손실 0) ──
const { run, itemConserved, ledgerConsistent } = NET;
const { check, pad } = kit.helpers;

// 가방·채팅·버스·audit·ranking 가 도는 토폴로지(영속/quorum 불필요 — 버스 라우팅만 자극). 0036 busfail 과 동일 베이스.
const BUS_BASE = (seed) => ({ seed, ticks: 70, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2,
  incremental: true, recovery: true, inventory: true, itemOps: 10, chat: true, chatOps: 12, regions: 2,
  bus: true, audit: true, ranking: true });
// svc.item 요청 스트림은 활성 초반에 몰린다(사전 측정). crash→재협상 창이 활성 구간을 가르게 잡아 *요청* gap 드롭을 강제.
const CRASH_AT = 12, RENEG_AT = 14;

function busreq(seeds) {
  console.log('== busreq: *가설* — 버스 crash gap 에 떨군 svc.item *요청*을 게이트웨이(producer)가 *재발행*하면 가방에 도달해 base 대비 mint 손실 0 ==');
  console.log(`  bus.crash(@${CRASH_AT}) → 재협상(@${RENEG_AT}). recover(재구독만·gap 요청 손실=대조군) vs resendReq(재구독+요청 재발행·busResendReq ON·무손실) 비교.`);
  console.log('seed   | minted base/recov/resendReq | mint손실 recov | 복구 resendReq | inResends | 원장valid | 판정');
  for (const seed of seeds) {
    const base     = run(BUS_BASE(seed));   // crash 0 — 전 요청 도달
    const recov    = run({ ...BUS_BASE(seed), busRestart: { at: CRASH_AT, renegAt: RENEG_AT } });                        // crash + 재구독만 = 요청 gap 손실(대조군)
    const resendReq = run({ ...BUS_BASE(seed), busRestart: { at: CRASH_AT, renegAt: RENEG_AT }, busResendReq: true });   // crash + 재구독 + 요청 재발행(이 step) = 무손실

    const mBase = base.inventory.minted, mRecov = recov.inventory.minted, mResend = resendReq.inventory.minted;
    const inResends = resendReq.gateway.inResends;

    // 이 step 의 핵심: recov(재구독만)는 gap 의 떨군 *요청* 때문에 그 pickup 이 mint 되지 않음 → 원장이 base 보다 작다(mint 손실).
    //   resendReq(busResendReq ON)는 게이트웨이가 보관 요청을 재발행 → gap 요청이 가방에 도달해 mint → minted 가 base 와 *정확히* 일치.
    //   *정확히* 가 핵심: gap 전 도달분도 재발행되므로 dedup 없으면 base 초과(이중 mint) — minted==base 가 dedup 작동(멱등)을 동시 증명.
    const lostWithoutResend = mRecov < mBase;          // 대조군: 재구독만으론 요청 gap 손실(mint 누락)
    const losslessWithResend = mResend === mBase;      // 가설: 요청 재발행으로 mint 손실 0 *그리고* 이중 mint 0(dedup)
    const resendHappened = inResends > 0;              // 재발행이 실제 일어남(producer replay 발동)
    // 원장 무손상 — 요청 재발행/dedup 이 원장 보존(size==minted)·정합(byOwner≡ledger)을 깨지 않는다(재발행이 dupe 를 안 만든다).
    const ledgerValid = itemConserved(resendReq) && ledgerConsistent(resendReq) && itemConserved(recov) && ledgerConsistent(recov);

    const ok =
      check(lostWithoutResend, `seed ${seed}: 대조군(재구독만) mint 손실 안 보임(base ${mBase}·recov ${mRecov})`) &&
      check(losslessWithResend, `seed ${seed}: 요청 재발행 후 minted≠base(이중 mint 또는 잔존 손실·base ${mBase}·resendReq ${mResend})`) &&
      check(resendHappened, `seed ${seed}: 요청 재발행 0(producer replay 미발동·inResends ${inResends})`) &&
      check(ledgerValid, `seed ${seed}: 요청 재발행/dedup 이 원장 보존/정합 깨뜨림(손상)`);
    console.log(`${pad(seed,6)} | ${pad(mBase+'/'+mRecov+'/'+mResend,27)} | ${pad(mBase-mRecov,14)} | ${pad(mResend-mRecov,14)} | ${pad(inResends,9)} | ${(ledgerValid?'예':'아니오').padEnd(8)} | ${ok?'OK':'FAIL'}`);
  }
  console.log(`  → 0036 거울: 버스는 *살아 돌아온* 새 박스(영속 0)라 crash gap 에 떨군 *요청*도 못 메운다 — 요청의 진실 원천(producer=게이트웨이)이 보관했다 재발행해야 한다.`);
  console.log(`    recover(재구독만)는 routing 만 복구 → gap 의 떨군 *요청*(가방 미도달 → mint 안 됨)은 영구 손실(원장 < base = mint 손실·양측 모름이라 desync 0·0036 §9 = 대조군).`);
  console.log(`    resendReq(busResendReq ON)는 0036 결과 producer replay 의 *요청 판* — 게이트웨이가 svc.item 요청을 재발행 → gap 요청이 가방 도달·mint(원장이 base 따라잡음). reqId dedup 으로 gap 전 도달분 재발행은 멱등(이중 mint 0).`);
  console.log(`    정직한 한계: inBuffer 무계(유계 슬라이딩 창은 후속 — 0036 outBuffer 와 동일). *give 요청* 재발행은 result-ahead/클라 재-give 와 얽혀(transfers≠base·desync 0 수렴은 유지) 완전 복구는 0025 give-resend 결합 영역. busResendReq OFF = 0036 비트 동일(reg).`);
}
kit.MODES['busreq'] = busreq;
kit.ORDER.splice(1, 0, 'busreq');   // reg 직후(가설 우선 노출)

(async () => { process.exit(await kit.cli(process.argv)); })();
