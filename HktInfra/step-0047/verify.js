// HktInfra step-0047 — 헤드리스 검증 (다중 게이트웨이 producer 네임스페이스 — 가방 dedup 을 (producer,reqId) 복합키로·busProducerNs)
// 사용: node step-0047/verify.js <mode> [seed]
//   mode 카탈로그·각 모드 문서: engine/verify-kit.js 헤더 (0001~0029 누적 모드 = 키트). 이 step 의 새 가설 = `pns`.
//   더한 한 조각: 0037 reqId 는 *producer-local* 단조 카운터(게이트웨이마다 0,1,2…)다 — 0042 §9 ① 이 명시: SPINE "게이트웨이 군"처럼 *다중* 게이트웨이가 같은 가방에 발신하면 reqId 네임스페이스가 겹쳐
//                 단일 네임스페이스 dedup(seenReqs)이 둘째 게이트웨이의 reqId k 를 첫째의 *이미 처리한 k* 로 오인해 폐기(요청 손실). 해법: dedup 키를 (producer,reqId) 복합키로 분리(가방은 버스 너머라 producer 태그가 유일한 네임스페이스 신호).
//   검증: ⒜ `reg`(키트) — busProducerNs=0(기본)이면 NET 이 직전 step(0045)과 *비트 동일*(producer 미태깅·키=bare reqId).
//         ⒝ `pns`(이 step·가설) — 둘째 producer(gateway2·버스 seam 주입) reqId 가 첫째와 겹칠 때 OFF(단일 네임스페이스)는 충돌 폐기(minted 손실)·ON(복합키)은 충돌 0(minted 보존).
// 작성법: 누적 회귀(reg 등 18모드)는 키트가 든다. 셸은 ctx 구성 + 이번 step 가설 모드(pns)만 더한다.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../step-0046/net-core.js');   // reg 대조용(직전 step)
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40;        // 권위 존 사망 tick(failover)
const LEASE = 3;         // lease 결손 임계
const RESTART_AT = 60;   // 가방 서비스 재시작 tick(quiescent — 저널 drain 완료 → 복구 투명)
const SNAP_N = 6;        // 가방 저널 스냅샷 압축 주기(0018)
const CHAT_SNAP_N = 5;   // 채팅 커맨드 로그 스냅샷 압축 주기(0022)
const JLOSS = 0.3;       // 저널 홉 손실율(0023~) — inventory→persist 홉 신뢰 NAK/재전송 자극

const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

// ── 이 step 의 가설 모드: pns — 다중 게이트웨이 producer 의 reqId 네임스페이스 겹침을 (producer,reqId) 복합키로 분리 ──
const { run, itemConserved, ledgerConsistent } = NET;
const { check, pad } = kit.helpers;

// 가방·버스·ranking 가 도는 토폴로지(영속/quorum 불필요 — 요청 경로 dedup 만 자극). busResendReq 로 reqId 태깅 활성(dedup 경로). 0045 와 동일 베이스.
const BUS_BASE = (seed) => ({ seed, ticks: 70, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2,
  incremental: true, recovery: true, inventory: true, itemOps: 10, chat: true, chatOps: 12, regions: 2,
  bus: true, audit: true, ranking: true, busResendReq: true });
const INJ_N = 5;       // 둘째 게이트웨이(gateway2)가 주입할 pickup 수 — reqId 0..N-1 로 gateway1 과 겹침.
const INJ_AT = 20;     // 주입 tick(이 무렵 gateway1 은 이미 reqId 0..N-1 을 발신·seenReqs 에 보유 → 충돌 자극).
// gateway2 의 요청열 — producer-local reqId 0..N-1(gateway1 과 동일 시작 → 단일 네임스페이스면 전부 충돌). 합성 아바타라 순수 mint(give 무관·원장 보존).
const INJECT = Array.from({ length: INJ_N }, (_, k) => ({ at: INJ_AT, reqId: k, avatar: 'gw2av' + k, producer: 'gateway2' }));

function pns(seeds) {
  console.log('== pns: *가설* — 0037 reqId 는 *producer-local* 단조 카운터(게이트웨이마다 0,1,2…)다(0042 §9 ①). SPINE "게이트웨이 군"처럼 둘째 게이트웨이가 같은 가방에 발신하면 reqId 네임스페이스가 겹쳐(gw1 reqId k vs gw2 reqId k) 단일 네임스페이스 dedup 이 gw2 의 k 를 gw1 의 *이미 처리한 k* 로 오인해 폐기(요청 손실). per-producer 복합키((producer,reqId))로 분리 → 충돌 0 ==');
  console.log(`  둘째 게이트웨이(gateway2)가 reqId 0..${INJ_N - 1}(gateway1 과 겹침) pickup ${INJ_N}개를 버스 seam 에 주입@${INJ_AT}. base(주입 0) 대비 minted 증가분으로 측정. OFF(단일 네임스페이스) vs ON(복합키).`);
  console.log(`seed   | base minted | off(+주입) | on(+주입) | offΔ(손실) | onΔ(보존) | 판정`);
  for (const seed of seeds) {
    const base = run({ ...BUS_BASE(seed) });                                            // 주입 없음 — gateway1 단독 mint 기준선
    const off  = run({ ...BUS_BASE(seed), producerInject: INJECT });                    // 단일 네임스페이스(busProducerNs OFF=0045) — gw2 reqId 가 gateway1 과 충돌 → 폐기
    const on   = run({ ...BUS_BASE(seed), producerInject: INJECT, busProducerNs: true });// 복합키 — (producer,reqId) 분리 → 충돌 0 → 전부 mint
    const offD = off.inventory.minted - base.inventory.minted;   // 0 이어야(둘째 producer 전부 충돌 폐기 = 손실)
    const onD  = on.inventory.minted - base.inventory.minted;    // INJ_N 이어야(전부 보존)
    // ① OFF 는 둘째 producer 요청 전부 손실(충돌 dedup·offΔ 0) ② ON 은 전부 보존(복합키·onΔ N) ③ 원장 자기-정합(순수 mint·보존)
    const ok =
      check(offD === 0, `seed ${seed}: 단일 네임스페이스인데 둘째 producer 요청이 충돌 폐기 안 됨(offΔ ${offD}, 기대 0)`) &&
      check(onD === INJ_N, `seed ${seed}: 복합키인데 둘째 producer 요청 보존 안 됨(onΔ ${onD}, 기대 ${INJ_N})`) &&
      check(ledgerConsistent(on) && itemConserved(on) && ledgerConsistent(off) && itemConserved(off), `seed ${seed}: 원장 자기-정합 깨짐`);
    console.log(`${pad(seed, 6)} | ${pad(base.inventory.minted, 11)} | ${pad(off.inventory.minted, 10)} | ${pad(on.inventory.minted, 9)} | ${pad(offD, 10)} | ${pad(onD, 9)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log(`  → reqId 는 producer-local(0042 §9 ①). 둘째 게이트웨이 reqId 0..${INJ_N - 1}이 gateway1 과 겹쳐, 단일 네임스페이스 seenReqs 는 그것을 *이미 처리한 reqId* 로 오인해 폐기(offΔ 0 = 둘째 producer ${INJ_N}건 전부 손실).`);
  console.log(`    이 step: 가방 dedup 키를 (producer,reqId) 복합키로(가방은 버스 너머라 발신 게이트웨이를 구별 못 함·producer 태그가 유일한 네임스페이스 신호) → 같은 reqId 라도 producer 다르면 별개 → 충돌 0(onΔ ${INJ_N} = 전부 보존). busProducerNs=0 = 0045 비트 동일(키=bare reqId·reg).`);
  console.log(`    정직한 한계: 둘째 게이트웨이는 *버스 producer seam* 으로 대표(svc.item pub) — 클라-대면 풀 와이어(로그인·존·세션)는 직교한 다중 게이트웨이 토폴로지 후속. per-producer *ack 워터마크/seenWm*(다중 게이트웨이 inBuffer 자기-크기조정)도 후속(이 조각은 dedup 네임스페이스만).`);
}

kit.MODES['pns'] = pns;
kit.ORDER.splice(1, 0, 'pns');   // reg 직후(가설 우선 노출)

(async () => { process.exit(await kit.cli(process.argv)); })();
