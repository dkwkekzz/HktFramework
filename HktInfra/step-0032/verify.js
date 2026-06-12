// HktInfra step-0032 — 헤드리스 검증 (정합성 윈도 *해소* — quorum-fill: W 미달 윈도 seq 재-fan-out 으로 durable 전환)
// 사용: node step-0032/verify.js <mode> [seed]
//   mode 카탈로그·각 모드 문서: engine/verify-kit.js 헤더 (0001~0029 누적 모드 = 키트). 이 step 의 새 모드 = wfill(아래).
//   이 step 의 가설: 0029 가 정합성 윈도를 워터마크 위로 *감지*만 했다면, windowFill 은 그 윈도를 durable 로 *전환*한다.
// 작성법(이 step 부터 정착): 누적 회귀(reg 등 18모드)는 키트가 든다 — 셸은 ctx 구성 + 새 모드만 추가한다:
//   kit.MODES['<mode>'] = fn; kit.ORDER.splice(1, 0, '<mode>');
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../step-0031/net-core.js');   // reg 대조용(직전 step)
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40;        // 권위 존 사망 tick(failover)
const LEASE = 3;         // lease 결손 임계
const RESTART_AT = 60;   // 가방 서비스 재시작 tick(quiescent — 저널 drain 완료 → 복구 투명)
const SNAP_N = 6;        // 가방 저널 스냅샷 압축 주기(0018)
const CHAT_SNAP_N = 5;   // 채팅 커맨드 로그 스냅샷 압축 주기(0022)
const JLOSS = 0.3;       // 저널 홉 손실율(0023~) — inventory→persist 홉 신뢰 NAK/재전송 자극

const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

// ── 이 step 의 새 모드: wfill — 정합성 윈도 해소(quorum-fill) ──
const { run, quorumMergeJournals, itemConserved, ledgerConsistent, itemDesync } = NET;
const { check, pad } = kit.helpers;

// 0029 의 quorum 쓰기 토폴로지 재사용 — primary + R=3 복제 = N+1=4 사본·W=3 정족수(비-신뢰 스토어·압축 OFF·restart 없음).
const QR = 3, QW = 3;
const BASE = (seed) => ({ seed, ticks: 70, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2, incremental: true, recovery: true });
const WQ_BASE = (seed) => ({ ...BASE(seed), inventory: true, itemOps: 10, chat: true, chatOps: 12, regions: 2,
  bus: true, audit: true, ranking: true, persist: true, persistReplicas: QR, quorumW: QW });
const WTAIL_T = (total) => Math.floor(total * 0.6);   // 윈도 시작 seq(저널 후반 40% 가 정족수 미달)
// tail 정족수 미달 손실(0029 XQUORUMLOSS) — persist2 는 *전* seq, persist3 은 seq≥T 추가 드롭 → seq≥T 홀더={primary,p4}=2(<W) = 윈도.
//   재발신(resend:true)·ack(type!=journal) 은 routeFilter 제외 → 윈도 해소 fill 은 신뢰 배달(갭은 *정족수* 문제로 격리).
const XQUORUMLOSS = (seed, T) => ({ seed: (seed ^ 0x71A0) >>> 0, delayMin: 0, delayMax: 0, loss: 1.0, redundancy: 1,
  routeFilter: (m) => {
    if (m.payload.type !== 'journal' || m.payload.resend) return false;
    if (m.to === 'persist2') return true;
    if (m.to === 'persist3' && m.payload.entry.seq >= T) return true;
    return false;
  } });
// 한 스토어 저널에 중복 seq 가 없는가(멱등 fill — 재발신이 이미 보유한 스토어를 안 친다는 증명)
const noDupSeq = (store) => { const seen = new Set(); for (const e of store.journal) { if (seen.has(e.seq)) return false; seen.add(e.seq); } return true; };

function wfill(seeds) {
  console.log('== wfill: *가설* — 정합성 윈도 해소(quorum-fill): W 미달 윈도 seq 를 아직 ack 안 한 스토어에 재-fan-out → durable 로 전환 ==');
  console.log('  OFF(0029) = 윈도 감지만(durableSeq 가 T-1 에 멈춤·윈도>0) / ON = 윈도 닫힘(durableSeq=total-1·윈도 0·fill>0)');
  console.log('seed   | total |  T | OFF durSeq/win | ON durSeq/win | fills | crash{prim,p4} 생존: OFF/ON | dupe0 | desync0 | 판정');
  for (const seed of seeds) {
    const full = run(WQ_BASE(seed));
    const total = full.inventory.journalSeq;
    const T = WTAIL_T(total);
    const off = run({ ...WQ_BASE(seed), transport: XQUORUMLOSS(seed, T) });                    // 0029 ⒞ — 윈도 감지만
    const on  = run({ ...WQ_BASE(seed), transport: XQUORUMLOSS(seed, T), windowFill: true });   // 이 step — 윈도 해소
    const dOff = off.inventory.durableSeq, winOff = total - 1 - dOff;
    const dOn = on.inventory.durableSeq, winOn = total - 1 - dOn;
    const fills = on.inventory.windowFills;
    // crash{primary, persist4}(0029 의 윈도 2홀더) 후 생존 {persist2, persist3} union 으로 무엇이 복구되나:
    //   OFF — persist2(빈)·persist3(seq<T 만) → 윈도(seq≥T) 소실. ON — persist2(seq≥T fill)·persist3(seq<T+fill) → 전 seq 생존.
    const survOff = new Set(quorumMergeJournals([off.replicaStores[0], off.replicaStores[1]]).journal.map(e => e.seq));
    const survOn  = new Set(quorumMergeJournals([on.replicaStores[0],  on.replicaStores[1]]).journal.map(e => e.seq));
    let allOff = true; for (let s = 0; s <= total - 1; s++) if (!survOff.has(s)) allOff = false;   // OFF 는 윈도 소실 → false
    let allOn  = true; for (let s = 0; s <= total - 1; s++) if (!survOn.has(s))  allOn = false;    // ON 은 전 seq 생존 → true
    // 멱등 fill — primary·복제 어느 저널에도 중복 seq 0(재발신이 비-홀더만 침)
    const dupe0 = noDupSeq(on.persist) && on.replicaStores.every(noDupSeq);
    const desync0 = itemConserved(on) && ledgerConsistent(on) && itemDesync(on) === 0;   // 라이브 원장 비-침습(영속 평면 변화가 월드 무관)

    const offWindowSeen = dOff === T - 1 && winOff > 0;     // OFF = 0029 ⒞ 윈도 가시(워터마크가 윈도 앞 정지)
    const onWindowClosed = dOn === total - 1 && winOn === 0 && fills > 0;   // ON = 윈도 닫힘(워터마크가 끝까지·실제 fill 발생)
    const ok =
      check(offWindowSeen, `seed ${seed}: OFF 윈도 가시 깨짐(durable ${dOff}·기대 ${T - 1}·win ${winOff})`) &&
      check(onWindowClosed, `seed ${seed}: ON 윈도 미해소(durable ${dOn}·기대 ${total - 1}·win ${winOn}·fills ${fills})`) &&
      check(!allOff, `seed ${seed}: OFF 인데 crash 후 전 seq 생존(윈도가 durable 화됨 = 윈도 정의 위반)`) &&
      check(allOn, `seed ${seed}: ON 인데 crash 후 윈도 seq 소실(해소가 durable 화 못 함)`) &&
      check(dupe0, `seed ${seed}: fill 이 중복 seq 생성(멱등 위반)`) &&
      check(desync0, `seed ${seed}: 라이브 원장 보존/정합/desync 깨짐`);
    console.log(`${pad(seed, 6)} | ${pad(total, 5)} | ${pad(T, 2)} | ${pad(dOff + '/' + winOff, 14)} | ${pad(dOn + '/' + winOn, 13)} | ${pad(fills, 5)} | ${((allOff ? '전부' : '윈도소실') + '/' + (allOn ? '전부' : '윈도소실')).padEnd(26)} | ${(dupe0 ? '예' : '아니오').padEnd(5)} | ${(desync0 ? '예' : '아니오').padEnd(7)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 윈도 해소: durableSeq 위 W 미달 seq 를 비-홀더 스토어에 재-fan-out(resend:true·q:true) → 저장·ack → 정족수 충족 → 워터마크 전진 → 윈도 닫힘.');
  console.log('    0029 는 윈도를 *감지*만 했다(워터마크가 T-1 에 멈춤) — 이 step 은 같은 윈도를 *전환*한다(durable=total-1). crash{primary,p4} 에 ON 은 전 seq 생존(윈도가 durable 화)·OFF 는 윈도 소실. windowFill 0 면 reg 0(0029 비트 동일).');
}
kit.MODES['wfill'] = wfill;
kit.ORDER.splice(1, 0, 'wfill');   // reg 직후(가설 우선 노출)

(async () => { process.exit(await kit.cli(process.argv)); })();
