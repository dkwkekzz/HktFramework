// HktInfra step-0036 — 헤드리스 검증 (버스 *failover* — 구독 재협상으로 라우팅 복구)
// 사용: node step-0036/verify.js <mode> [seed]
//   mode 카탈로그·각 모드 문서: engine/verify-kit.js 헤더 (0001~0029 누적 모드 = 키트). 이 step 의 새 모드 = busfail(아래).
//   이 step 의 가설: 버스가 죽으면(routing RAM 소실) 서비스 경로가 단절되지만, 소비자들이 *재구독*(0033 동적 sub)하면
//                    라우팅이 재구성돼 팬아웃이 재개된다 — 버스 내부 영속(저널) 없이도(진실 원천 = 소비자). 손실은 crash~재협상 gap 에만.
// 작성법: 누적 회귀(reg 등 18모드)는 키트가 든다. 셸은 ctx 구성 + 이 step 의 새 모드(busfail)만 추가.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../step-0035/net-core.js');   // reg 대조용(직전 step)
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40;        // 권위 존 사망 tick(failover)
const LEASE = 3;         // lease 결손 임계
const RESTART_AT = 60;   // 가방 서비스 재시작 tick(quiescent — 저널 drain 완료 → 복구 투명)
const SNAP_N = 6;        // 가방 저널 스냅샷 압축 주기(0018)
const CHAT_SNAP_N = 5;   // 채팅 커맨드 로그 스냅샷 압축 주기(0022)
const JLOSS = 0.3;       // 저널 홉 손실율(0023~) — inventory→persist 홉 신뢰 NAK/재전송 자극

const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

// ── 이 step 의 새 모드: busfail — 버스 failover: 구독 재협상으로 라우팅 복구 ──
const { run, itemConserved, ledgerConsistent, itemDesync } = NET;
const { check, pad } = kit.helpers;

// 가방·채팅·버스·audit·ranking 가 도는 토폴로지(영속/quorum 불필요 — 버스 라우팅만 자극).
const BUS_BASE = (seed) => ({ seed, ticks: 70, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2,
  incremental: true, recovery: true, inventory: true, itemOps: 10, chat: true, chatOps: 12, regions: 2,
  bus: true, audit: true, ranking: true });
// svc.item.out 이벤트는 tick 11~22 에 몰린다(사전 측정). crash→재협상 창이 활성 구간을 가르게 잡아 gap 손실을 강제.
const TOPIC = 'svc.item.out';     // 측정 토픽 — audit·ranking 공동 구독(가방 결과 스트림)
const CRASH_AT = 12, RENEG_AT = 14;   // pub 스트림(버스 수신)이 재협상 이후로도 흐르게 — crash 전 일부 수신·gap 손실·재협상 후 재개가 모두 가시

function busfail(seeds) {
  console.log('== busfail: *가설* — 버스 crash(라우팅 RAM 소실)는 서비스 경로를 끊지만, 소비자 *재구독*(0033 동적 sub)이 라우팅을 재구성해 복구한다 ==');
  console.log(`  bus.crash(@${CRASH_AT}) → 재협상(@${RENEG_AT}, 정적 subs 재발신). 기준선(crash 0)·crash만(영구 단절·대조군)·crash+재협상(복구·gap 만 손실) 3런 비교.`);
  console.log('seed   | A0 base | A_crashOnly | A_recover | ranking R0/Rc/Rr | bus subN base/recov/crashO | 원장valid | gap(desync) r/c | 판정');
  for (const seed of seeds) {
    const base   = run(BUS_BASE(seed));   // crash 0 — 전 구독 유지(0033 동작)
    const crashO = run({ ...BUS_BASE(seed), busRestart: { at: CRASH_AT } });                       // crash 만(재협상 없음) = 영구 단절(대조군)
    const recov  = run({ ...BUS_BASE(seed), busRestart: { at: CRASH_AT, renegAt: RENEG_AT } });    // crash + 재협상 = 복구

    const A0 = base.audit.seen.get(TOPIC) || 0, Ac = crashO.audit.seen.get(TOPIC) || 0, Ar = recov.audit.seen.get(TOPIC) || 0;
    const R0 = base.ranking.consumed, Rc = crashO.ranking.consumed, Rr = recov.ranking.consumed;
    const subN0 = base.bus.subscriberCount(TOPIC), subNr = recov.bus.subscriberCount(TOPIC), subNc = crashO.bus.subscriberCount(TOPIC);
    const dR = itemDesync(recov), dC = itemDesync(crashO);   // crash gap 의 *요청* 드롭 = at-most-once 손실(비영속 버스의 정직한 한계)

    const crashSevers = Ac < A0 && Rc < R0;          // crash 후 서비스 경로 단절(audit·ranking 둘 다 수신 멈춤)
    const recovers = Ar > Ac && Rr > Rc;             // 재협상 후 팬아웃 재개(복구가 단절보다 더 받음)
    const gapOnly = Ar < A0;                          // 손실은 crash~재협상 gap 에만(at-most-once — 버스 이력 없음)
    const routingBack = subNr === subN0 && subN0 > 0; // 재협상이 라우팅 테이블을 *완전* 복원(구독자 수 == 기준선)
    const severed = subNc === 0;                       // 대조군: crash 후 재협상 0 이면 구독자 0(영구 단절)
    // 원장 무손상 — 버스 failover 가 권위 원장을 *오염*시키지 않는다(보존·정합 유지). desync 는 gap 의 요청 드롭(at-most-once)으로 별도 보고:
    //   비영속 버스라 in-flight svc.item 요청이 gap 에 떨궈지면 그 item op 은 원장에 안 닿는다(클라 belief 와 격차) — 손상이 아니라 *손실*.
    //   재협상은 라우팅을 복구할 뿐 gap 의 떨군 메시지를 메우지 않는다(요청 경로 무손실 = 홉 신뢰의 버스 판·후속). reneg 가 악화시키지 않음(dR ≤ dC).
    const ledgerValid = itemConserved(recov) && ledgerConsistent(recov) && itemConserved(crashO) && ledgerConsistent(crashO);
    const renegNoWorse = dR <= dC;

    const ok =
      check(crashSevers, `seed ${seed}: crash 가 서비스 경로 안 끊음(A0 ${A0}·Ac ${Ac}·R0 ${R0}·Rc ${Rc})`) &&
      check(recovers, `seed ${seed}: 재협상 후 복구 안 됨(Ac ${Ac}·Ar ${Ar}·Rc ${Rc}·Rr ${Rr})`) &&
      check(gapOnly, `seed ${seed}: gap 손실 없음(Ar ${Ar}==A0 ${A0} — 복구가 과거를 메움?)`) &&
      check(routingBack, `seed ${seed}: 재협상이 라우팅 미복원(subN base ${subN0}·recover ${subNr})`) &&
      check(severed, `seed ${seed}: 대조군 crash 후에도 구독자 잔존(영구 단절 아님·subN ${subNc})`) &&
      check(ledgerValid, `seed ${seed}: 버스 failover 가 원장 보존/정합 깨뜨림(손상)`) &&
      check(renegNoWorse, `seed ${seed}: 재협상이 요청 gap 을 악화(dR ${dR} > dC ${dC})`);
    console.log(`${pad(seed,6)} | ${pad(A0,7)} | ${pad(Ac,11)} | ${pad(Ar,9)} | ${pad(R0+'/'+Rc+'/'+Rr,16)} | ${pad(subN0+'/'+subNr+'/'+subNc,26)} | ${(ledgerValid?'예':'아니오').padEnd(8)} | ${pad(dR+'/'+dC,15)} | ${ok?'OK':'FAIL'}`);
  }
  console.log(`  → 버스는 *파생 상태*(라우팅 테이블)만 든다 — 진실 원천은 소비자다. crash 로 routing 이 비면 pub 은 전부 unrouted(서비스 경로 단절·대조군 subN 0).`);
  console.log(`    복구 = 소비자들이 (같은 주소의) 버스에 sub 재발신(재협상·0033 동적 sub) → routing 재구성(subN 복원) → 팬아웃 재개. 버스 내부 영속/이력 replay 불필요.`);
  console.log(`    정직한 한계: gap 의 in-flight 메시지(관찰 미스 + svc.item *요청* 드롭=desync ${'≥0'})는 at-most-once 손실 — 원장은 *손상 아닌 손실*(보존·정합 유지). 요청 경로 무손실(홉 신뢰의 버스 판)은 후속. busRestart OFF = 0033 비트 동일(reg).`);
}
kit.MODES['busfail'] = busfail;
kit.ORDER.splice(1, 0, 'busfail');   // reg 직후(가설 우선 노출)

(async () => { process.exit(await kit.cli(process.argv)); })();
