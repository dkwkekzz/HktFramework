// HktInfra step-0022 — 헤드리스 검증 (채팅 커맨드 로그 스냅샷 압축 — ChatService 라우팅 스냅샷+tail replay·0018 가방 압축의 커맨드-소싱 판)
// 사용: node step-0022/verify.js <mode> [seed]
//   mode: reg | chat-compact | recover-chat | rank | recover-rank | e2e | sacred | recover | compact | degrade | inject | isolate | hide | repro | all
//     reg          — 회귀 0: 인프로세스 모드(chatSnapshot OFF) → step-0021 과 *비트 동일*(net.log + 상태 + inv/chat/bus/rank).
//                  마지막 cfg 는 chatpersist ON+chatRestart 인데 chatSnapshot OFF — 새 압축 코드(스냅샷·replay 베이스·leaves)가 *휴면*임을 직접 증명.
//     chat-compact — *이 step 의 가설*: 채팅 커맨드 로그 압축이 ① 라우팅 스냅샷+tail replay == 전체-커맨드 replay == 무재시작 *chatDigest 비트 동일*
//                  (무손실 압축) ② 커맨드 로그 절감(full→tail·스냅샷>0) ③ 복구 후 chatDesync 0·누설 0 ④ 커맨드 로그 완전(압축에도 writes==커맨드).
//     recover-chat — (0021 잔존 가설) 채팅 진짜 kill→커맨드 로그 replay 후 ① 복구 라우팅+deliveries == 무재시작(투명·chatDigest 비트 동일)
//                  ② chatpersist OFF+kill 대조군은 구독/배달 *소실* ③ 복구 후 say 누설 0·지역 격리 보존 ④ 커맨드 로그 완전.
//     recover-rank — (0020 잔존 가설) 랭킹 kill→쓰기 저널 reconstruct 후 복구 투영 == 원장 byOwner·persist OFF+kill 소실·rankDesync 0.
//     rank       — (0019 잔존 가설) consume→publish 루프·rank 프로젝션 == 원장 byOwner·발행자 무수정·rankDesync 0·발행 유계.
//     compact    — (0018 잔존 가설) 가방 스냅샷+tail replay == 전체-저널 replay == 무재시작 *비트 동일*(무손실 압축)·저널 절감.
//     e2e        — E2E 동치: 멀티프로세스(persist ON, restart 포함) = 인프로세스 *비트 동일*(log+world+inv+chat+bus+audit+persist+rank+chatpersist)
//                  + 누설 0·phantom 0·chatDesync 0. persist-bus·restart-bus(가방 kill)·rank-restart(랭킹 kill)·chat-restart(채팅 kill→커맨드 로그 replay).
//     sacred     — *신성한 tick*: persist ON vs OFF 월드 상태 *비트 동일*(영속이 시뮬에 비-침습) · persist 는 실제 일함(writes>0)
//                  · 존 도달 persist/journal 0 · persist onTick 0.
//     recover    — *이 step 의 가설*: 가방 kill→replay 후 ① 복구 원장 == 영속 ON 무재시작 *비트 동일*(영속이 원장에 투명)
//                  ② 영속 OFF+restart 대조군은 원장 *소실*(ledger.size 급감·invDigest 다름) ③ 복구 후 itemDesync 0·소유 belief ≤1·
//                  보존/정합 유지 ④ 저널 완전성(저널 항목 == minted+transfers) — quiescent restart 면 저널이 효과 전부를 담는다.
//     degrade    — 버스 홉(svcbus) loss 0.2+redundancy 3 (persist ON·restart 없음): 누설/phantom 0·원장 보존/정합·소유 belief ≤1 은
//                  loss-무관 보존(persist 박스가 0016 열화 의미를 안 깬다). 완전성(itemDesync/chatDesync)만 graceful.
//     inject     — 시나리오 inject write-seam(0016 그대로): 주입 실효·결정론·멀티프로세스 비트 동일.
//     isolate    — 프로세스 분리: persist = 자기 OS pid(broker·가방과 다름)·*안 죽음* · 가방 restart 후 새 호스트 pid != 죽은 가방.
//     hide       — 은닉: persist ON+restart 에도 클라 접점 = 공개 주소(login·gateway)뿐 · 저널/persist/replay/내부 누설 0.
//     repro      — 재현: 같은 시드 멀티프로세스(restart) 2회 → 같은 inv/persist/bus/audit/chat 다이제스트 + 인프로세스와도 동일.
// 모든 수치는 시드 [42, 7, 1234, 99, 2026]. 문서의 수치 = 이 출력.
'use strict';
const NET = require('./net-core.js');
const { run, runMulti, fnv1a, buildTopology, PUBLIC_ADDRS,
        chatDesync, chatPhantom, chatLeak, chatClientNoLeak, chatDigest,
        itemConserved, ledgerConsistent, maxItemBeliefOwners, itemDesync, invDigest,
        busDigest, auditDigest, directSvcMsgs, senderDigest, persistDigest, journalComplete,
        chatPersistDigest, chatJournalComplete,
        ledgerCounts, rankProjectionFaithful, rankDesync, rankDigest } = NET;
const NET16 = require('../step-0021/net-core.js');   // reg 대조용(직전 step)

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40;        // 권위 존 사망 tick(failover)
const LEASE = 3;         // lease 결손 임계
const RESTART_AT = 60;   // 가방 서비스 재시작 tick(가방이 정지(quiescent)한 늦은 tick — 저널 drain 완료 → 복구 투명)
const SNAP_N = 6;        // 가방 저널 스냅샷 압축 주기(0018) — 저널 6항목마다 원장 스냅샷 → upToSeq 이하 폐기(무한 성장 압축)
const CHAT_SNAP_N = 5;   // 채팅 커맨드 로그 스냅샷 압축 주기(이 step) — 커맨드 5항목마다 *라우팅 스냅샷* → upToSeq 이하 폐기(비-빈 tail 강제 → 스냅샷+tail 합성 경로 검증)
let FAILED = false;

function check(cond, label) { if (!cond) { FAILED = true; console.log('  FAIL: ' + label); } return cond; }
function pad(v, w) { return String(v).padStart(w); }
function hex(v) { return '0x' + (v >>> 0).toString(16).padStart(8, '0'); }

function logDigest(r) {
  return fnv1a(r.net.log.map(m => m.from + '>' + m.to + ':' + JSON.stringify(m.payload)).join('\n'));
}
// worldDigest — *월드 상태만*(존 ents + 클라 AOI). persist on/off·restart 유무에 *불변*이어야 함(신성한 tick = 영속 비-침습).
function worldDigest(r) {
  const ents = [];
  for (const z of r.zones) for (const [id, e] of z.ents) ents.push(id + ':' + e.x + ',' + e.y);
  ents.sort();
  const seen = r.clients.map(c => c.avatar + '=' + c.seenIds().join(',')).sort().join(';');
  return fnv1a(ents.join('|') + '#' + seen);
}
// 존에 도달한 서비스/버스/영속 메시지 수(=0 이어야 함 — 서비스·버스·영속은 존을 우회 = 신성한 tick).
function svcMsgsToZones(r) {
  return r.net.log.filter(m => /^zone/.test(m.to) && m.payload && /^(chat|item|pub|sub|ev|journal|snapshot)/.test(m.payload.type || '')).length;
}
function ledgerSize(r) { return r.inventory ? r.inventory.ledger.size : 0; }

// ── 검증 시나리오 ──
const BASE = (seed) => ({ seed, ticks: 70, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2, incremental: true, recovery: true });
const SVC = (seed) => ({ ...BASE(seed), inventory: true, itemOps: 10, chat: true, chatOps: 12, regions: 2 });   // 0015 의미(직접 라우팅)
const BUSA = (seed) => ({ ...SVC(seed), bus: true, audit: true, ranking: true });   // 0016 버스+감사 + 0019 랭킹(발신하는 둘째 소비자)
const PERSIST = (seed) => ({ ...BUSA(seed), persist: true, snapshot: SNAP_N });   // + 영속(저널) + 스냅샷 압축(이 step)
const PERSIST_NOSNAP = (seed) => ({ ...BUSA(seed), persist: true });              // + 영속(압축 OFF — 전체 저널·0017 의미·압축 대조군)
const RESTART = (seed) => ({ ...PERSIST(seed), invRestart: { at: RESTART_AT } });   // + 가방 진짜 kill→스냅샷+tail replay
const RESTART_NOSNAP = (seed) => ({ ...PERSIST_NOSNAP(seed), invRestart: { at: RESTART_AT } });   // + 가방 kill→전체 저널 replay(압축 대조)
const RANK_RESTART = (seed) => ({ ...PERSIST(seed), rankRestart: { at: RESTART_AT } });   // 0020 — 랭킹(읽기 모델) 진짜 kill→쓰기 저널 reconstruct(자기 영속 0)
const CHATP = (seed) => ({ ...PERSIST(seed), chatpersist: true, chatSnapshot: CHAT_SNAP_N });   // 0021 채팅 영속 + 커맨드 로그 압축(이 step)·restart 없음(복구 투명 기준)
const CHATP_NOSNAP = (seed) => ({ ...PERSIST(seed), chatpersist: true });   // 채팅 영속(압축 OFF — 전체 커맨드 로그·0021 의미·압축 대조군)
const CHAT_RESTART = (seed) => ({ ...CHATP(seed), chatRestart: { at: RESTART_AT } });   // 이 step — 채팅 kill→라우팅 스냅샷+tail 커맨드 replay
const CHAT_RESTART_NOSNAP = (seed) => ({ ...CHATP_NOSNAP(seed), chatRestart: { at: RESTART_AT } });   // 채팅 kill→전체 커맨드 replay(압축 대조)
const FAILS_PERSIST = (seed) => ({ ...PERSIST(seed), ticks: 80, failover: true, deathTick: DEATH, leaseTimeout: LEASE });
// 전송 열화 — 버스 출입 홉(svcbus) 전체에 redundancy/loss(라우팅 정확성·원장 보존의 loss-무관 검증). persist ON·restart 없음.
const DEGRADE = (seed) => ({ ...PERSIST(seed), transport: { seed: (seed ^ 0xABCD) >>> 0, delayMin: 0, delayMax: 2, loss: 0.2, redundancy: 3, routeFilter: NET.routeFilters.svcbus } });

// ── reg: 인프로세스 0022(chatSnapshot OFF) → 0021 비트 동일(채팅 커맨드 로그 스냅샷 압축 도입 비-침습) ──
//   마지막 cfg 는 chatpersist ON + chatRestart 인데 chatSnapshot OFF — 새 압축 코드(스냅샷 발신·replay 베이스·leaves 회계)가 *휴면*임을 직접 증명.
function reg(seeds) {
  console.log('== reg: 인프로세스 모드(chatSnapshot OFF) → step-0021 과 비트 동일(net.log + 상태 + inv/chat/bus/rank). 채팅 스냅샷 압축 = 비-침습 ==');
  console.log('seed   | 구성                | 0021 logHash | 0022(inproc) | log동일 | 상태동일 | inv/chat/bus/rank 동일 | 판정');
  for (const seed of seeds) {
    const cfgs = [
      ['zones1            ', { zones: 1, recovery: false, failover: false }],
      ['zones2+rec+fo     ', { zones: 2, recovery: true, failover: true, deathTick: DEATH, leaseTimeout: LEASE }],
      ['svc+bus+audit     ', { zones: 2, recovery: true, failover: false, inventory: true, itemOps: 8, chat: true, chatOps: 10, regions: 2, bus: true, audit: true }],
      ['persist+rank+rst  ', { zones: 2, recovery: true, failover: false, inventory: true, itemOps: 8, chat: true, chatOps: 10, regions: 2, bus: true, audit: true, ranking: true, persist: true, snapshot: SNAP_N, invRestart: { at: 40 }, rankRestart: { at: 44 } }],
      ['chatp+chatrst     ', { zones: 2, recovery: true, failover: false, inventory: true, itemOps: 8, chat: true, chatOps: 10, regions: 2, bus: true, audit: true, ranking: true, persist: true, snapshot: SNAP_N, chatpersist: true, chatRestart: { at: 44 } }],
    ];
    for (const [name, c] of cfgs) {
      const p = { seed, ticks: 48, clients: 4, moves: 30, radius: 4, grid: 16, incremental: true, ...c };
      const r20 = NET16.run(p);
      const r21 = run({ ...p });
      const okL = logDigest(r20) === logDigest(r21), okS = worldDigest(r20) === worldDigest(r21);
      const okX = invDigest(r20) === invDigest(r21) && chatDigest(r20) === chatDigest(r21) && busDigest(r20) === busDigest(r21) && rankDigest(r20) === rankDigest(r21);
      check(okL, `seed ${seed} ${name.trim()}: net.log 다름`);
      check(okS, `seed ${seed} ${name.trim()}: 상태 다름`);
      check(okX, `seed ${seed} ${name.trim()}: inv/chat/bus/rank 다름`);
      console.log(`${pad(seed, 6)} | ${name} | ${hex(logDigest(r20))}   | ${hex(logDigest(r21))}   | ${(okL ? '예' : '아니오').padEnd(6)} | ${(okS ? '예' : '아니오').padEnd(8)} | ${(okX ? '예' : '아니오').padEnd(21)} | ${okL && okS && okX ? 'OK' : 'FAIL'}`);
    }
  }
  console.log('  → chatpersist 미제공이면 채팅 _journal 이 no-op·crash/replay 훅 호출 0·_process 는 0020 onMsg 와 동작 동일 — 0020 와 비트 동일.');
}

// ── rank: 이 step 의 가설 — 발신하는 둘째 소비자(consume→publish 루프·읽기 모델 정합·발행자 무수정) ──
function rank(seeds) {
  console.log('== rank: *가설* — ① consume→publish 루프 ② rank 프로젝션 == 원장 byOwner ③ 발행자 무수정(decouple) ④ rankDesync 0 ⑤ 루프 없음(발행 유계) ==');
  console.log('seed   | 소비 | 발행 | 프로젝션 == 원장 | inv발신(rank on=off) | rankDesync | 발행유계 | audit 관찰 | 판정');
  for (const seed of seeds) {
    const on = run(PERSIST(seed));                         // ranking ON(BUSA 에 ranking 포함)
    const off = run({ ...PERSIST(seed), ranking: false }); // ranking OFF(대조 — 발행자 무수정 비교)
    const loop = on.ranking.consumed > 0 && on.ranking.published > 0;            // ① 소비·발행 둘 다 발생
    const faithful = rankProjectionFaithful(on);                                 // ② 읽기 모델 ≡ 쓰기 모델
    const decouple = senderDigest(on, 'inventory') === senderDigest(off, 'inventory');   // ③ 발행자(inventory) 발신 비트 동일
    const desync0 = rankDesync(on) === 0;                                        // ④ 클라 rank belief 수렴
    // ⑤ 루프 없음 — ranking 의 발행(published)이 *유한*(다시 item 이벤트를 안 낳음). published == rank 변경 수(소비 기반·발산 0).
    const bounded = on.ranking.published <= on.ranking.consumed * 2 && on.ranking.published > 0;
    const auditSawRank = !on.audit || (on.audit.seen.get('svc.rank.out') || 0) === on.ranking.published;   // audit 도 rank 전수 관찰
    const ok =
      check(loop, `seed ${seed}: consume→publish 루프 미작동(c ${on.ranking.consumed}/p ${on.ranking.published})`) &&
      check(faithful, `seed ${seed}: rank 프로젝션 != 원장 byOwner(읽기 모델 불일치)`) &&
      check(decouple, `seed ${seed}: ranking 추가가 발행자(inventory) 발신을 바꿈(decouple 위반)`) &&
      check(desync0, `seed ${seed}: rankDesync ${rankDesync(on)}`) &&
      check(bounded, `seed ${seed}: 발행 비유계(루프 의심: p ${on.ranking.published} vs c ${on.ranking.consumed})`) &&
      check(auditSawRank, `seed ${seed}: audit rank 관찰 누락(${on.audit ? on.audit.seen.get('svc.rank.out') : '?'} vs ${on.ranking.published})`);
    console.log(`${pad(seed, 6)} | ${pad(on.ranking.consumed, 4)} | ${pad(on.ranking.published, 4)} | ${(faithful ? '예' : '아니오').padEnd(15)} | ${(decouple ? '예(동일)' : '아니오').padEnd(19)} | ${pad(rankDesync(on), 10)} | ${(bounded ? '예' : '아니')}      | ${(auditSawRank ? '예' : '아니')}       | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → ranking 은 svc.item.out 을 *소비해* svc.rank.out 을 *발행*하는 읽기 모델 — 발행자(inventory) 무수정으로 얹히고, rank 투영이 원장과 정확히 일치.');
}

// ── e2e: 멀티프로세스(persist ON, restart 포함) = 인프로세스 비트 동일 ──
async function e2e(seeds) {
  console.log('== e2e: 멀티프로세스(persist ON·restart) = 인프로세스 *비트 동일*(log+world+inv+chat+bus+audit+persist+rank+chatpersist)·누설 0·보존 ==');
  console.log('seed   | 시나리오      | 프로세스 | log | world | inv | chat | bus | audit | persist | 누설 | 보존/정합 | 판정');
  for (const seed of seeds) {
    for (const [name, cfg] of [['persist-bus', PERSIST(seed)], ['restart-bus', RESTART(seed)], ['rank-restart', RANK_RESTART(seed)], ['chat-restart', CHAT_RESTART(seed)]]) {
      const a = run(cfg);
      const b = await runMulti(cfg);
      const okL = logDigest(a) === logDigest(b);
      const okW = worldDigest(a) === worldDigest(b);
      const okI = invDigest(a) === invDigest(b);
      const okC = chatDigest(a) === chatDigest(b) && chatPersistDigest(a) === chatPersistDigest(b);   // 채팅 상태 + 커맨드 로그(0021) 비트 동일
      const okB = busDigest(a) === busDigest(b);
      const okA = auditDigest(a) === auditDigest(b);
      const okP = persistDigest(a) === persistDigest(b);
      const okR = rankDigest(a) === rankDigest(b) && rankProjectionFaithful(b) && rankDesync(b) === 0;   // 랭킹(0019) — 투영/회계 비트 동일·정합·수렴
      const leak = chatLeak(b), dC = chatDesync(b);
      const cons = itemConserved(b) && ledgerConsistent(b);
      // anchor — restart 런이면 *무재시작 기준*과 비교(자족 증명). 인프로세스=멀티 비교만으론 양쪽 동일하게 깨진 복구를 못 잡는다.
      const anchor = cfg.invRestart ? invDigest(b) === invDigest(run(PERSIST(seed)))
        : cfg.chatRestart ? chatDigest(b) === chatDigest(run(CHATP(seed)))   // 채팅 복구 투명(무재시작 기준)
        : true;
      const ok =
        check(okL, `seed ${seed} ${name}: net.log 다름`) &&
        check(okW, `seed ${seed} ${name}: 월드 상태 다름`) &&
        check(okI, `seed ${seed} ${name}: 원장 다름`) &&
        check(okC, `seed ${seed} ${name}: deliveries 다름`) &&
        check(okB, `seed ${seed} ${name}: 버스 라우팅/회계 다름`) &&
        check(okA, `seed ${seed} ${name}: audit 관찰 스트림 다름`) &&
        check(okP, `seed ${seed} ${name}: 영속 저널 다름`) &&
        check(okR, `seed ${seed} ${name}: 랭킹 투영/회계/수렴 다름`) &&
        check(anchor, `seed ${seed} ${name}: restart 원장이 무재시작 기준과 다름(복구 비투명)`) &&
        check(leak === 0, `seed ${seed} ${name}: 누설 ${leak}`) &&
        check(dC === 0, `seed ${seed} ${name}: chatDesync ${dC}`) &&
        check(cons, `seed ${seed} ${name}: 원장 보존/정합 깨짐`);
      console.log(`${pad(seed, 6)} | ${name.padEnd(12)} | ${pad(b.cluster.pids.length, 8)} | ${(okL ? '예' : '아니')} | ${(okW ? '예' : '아니')}  | ${(okI ? '예' : '아니')} | ${(okC ? '예' : '아니')}  | ${(okB ? '예' : '아니')} | ${(okA ? '예' : '아니')}   | ${(okP ? '예' : '아니')}    | ${pad(leak, 4)} | ${(cons ? '예' : '아니오').padEnd(8)} | ${ok ? 'OK' : 'FAIL'}`);
    }
  }
  console.log('  → 가방 replay·랭킹 reconstruct·채팅 커맨드 로그 replay 전부 *제어 평면*(cluster RPC)이라 net.log 비-기여 — 인프로세스 crash()+replay() 와 비트 동일.');
}

// ── sacred: 신성한 tick — 영속이 시뮬에 비-침습(월드 비트 동일)이면서 실제 일한다 ──
function sacred(seeds) {
  console.log('== sacred: *신성한 tick* — persist ON vs OFF 월드 상태 *비트 동일*(영속 비-침습) · persist 는 실제 일함 · 존 도달 persist/journal 0 ==');
  console.log('seed   | world동일(on=off) | 저널 writes | mint+xfer | journal==효과 | 존도달 | persist onTick | 판정');
  for (const seed of seeds) {
    const off = run(BUSA(seed));        // 영속 없음(0016 토폴로지)
    const on = run(PERSIST(seed));      // + 영속
    const okW = worldDigest(off) === worldDigest(on);             // 영속이 월드 시뮬에 비-침습
    const worked = on.persist && on.persist.writes > 0;
    const muts = on.inventory.minted + on.inventory.transfers;
    const complete = journalComplete(on);
    const toZones = svcMsgsToZones(on);
    const persistHasTick = typeof (on.persist && on.persist.onTick) === 'function';   // 신성한 tick = persist onTick 0
    const ok =
      check(okW, `seed ${seed}: 월드 상태가 영속 도입으로 변함(시뮬 침습)`) &&
      check(worked, `seed ${seed}: persist 미작동(writes ${on.persist ? on.persist.writes : 0})`) &&
      check(complete, `seed ${seed}: 저널(${on.persist.writes}) != 수락 변이(${muts})`) &&
      check(toZones === 0, `seed ${seed}: persist/journal 메시지가 존에 ${toZones}건 도달(신성한 tick 침습)`) &&
      check(!persistHasTick, `seed ${seed}: persist 가 onTick 보유(tick 동기 — 신성한 tick 밖 아님)`);
    console.log(`${pad(seed, 6)} | ${(okW ? '예' : '아니오').padEnd(16)} | ${pad(on.persist.writes, 10)} | ${pad(muts, 9)} | ${(complete ? '예' : '아니오').padEnd(12)} | ${pad(toZones, 6)} | ${(persistHasTick ? '있음' : '없음').padEnd(13)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 저널 쓰기는 존을 *우회*해 persist 박스로(존 net.log·상태 불변) — 시뮬 tick 엔 시뮬만. persist 는 tick 무관 순수 반응형.');
}

// ── recover: 이 step 의 가설 — 가방 kill→replay 로 원장 영속 보존 ──
function recover(seeds) {
  console.log('== recover: *가설* — 가방 kill→replay 후 ① 복구 원장 == 무재시작(영속 투명) ② 영속 OFF+restart = 원장 소실 ③ itemDesync 0·소유≤1 ④ 저널 완전 ==');
  console.log('seed   | base mint/xfer | recov mint/xfer | inv동일(투명) | lost ledger | lost!=base | desync(recov) | 소유≤1 | 보존/정합 | 저널완전 | 판정');
  for (const seed of seeds) {
    const base = run(PERSIST(seed));                                  // 영속 ON·restart 없음(기준)
    const recov = run(RESTART(seed));                                 // 영속 ON + 가방 kill→replay
    const lost = run({ ...RESTART(seed), persist: false });           // 대조군 — restart 하지만 영속 없음(replay 불가 → 소실)
    const transparent = invDigest(base) === invDigest(recov);        // ① 복구가 원장에 투명(죽기 전과 비트 동일)
    const lostLost = invDigest(lost) !== invDigest(base) && ledgerSize(lost) < ledgerSize(base);   // ② 영속 부재 = 소실
    const desync0 = itemDesync(recov) === 0;                         // ③ 복구 후 클라 belief 재수렴
    const own1 = maxItemBeliefOwners(recov) <= 1;
    const cons = itemConserved(recov) && ledgerConsistent(recov);
    const complete = journalComplete(base) && journalComplete(recov); // ④ 저널 = 수락 변이 전부
    const restored = recov.inventory.minted === base.inventory.minted && recov.inventory.transfers === base.inventory.transfers;
    const ok =
      check(transparent && restored, `seed ${seed}: 복구 원장이 무재시작과 다름(영속 비투명)`) &&
      check(lostLost, `seed ${seed}: 영속 OFF+restart 인데 원장이 소실 안 됨(대조 실패: lost ledger ${ledgerSize(lost)} vs base ${ledgerSize(base)})`) &&
      check(desync0, `seed ${seed}: 복구 후 itemDesync ${itemDesync(recov)}`) &&
      check(own1, `seed ${seed}: 복구 후 belief 소유자 >1`) &&
      check(cons, `seed ${seed}: 복구 후 원장 보존/정합 깨짐`) &&
      check(complete, `seed ${seed}: 저널 불완전(base/recov)`);
    console.log(`${pad(seed, 6)} | ${pad(base.inventory.minted + '/' + base.inventory.transfers, 14)} | ${pad(recov.inventory.minted + '/' + recov.inventory.transfers, 15)} | ${(transparent ? '예' : '아니오').padEnd(12)} | ${pad(ledgerSize(lost) + '/' + ledgerSize(base), 11)} | ${(lostLost ? '예' : '아니오').padEnd(10)} | ${pad(itemDesync(recov), 13)} | ${(own1 ? '예' : '아니')}    | ${(cons ? '예' : '아니오').padEnd(8)} | ${(complete ? '예' : '아니오').padEnd(8)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → PersistStore(데이터 계층)는 가방이 죽어도 *안 죽는다* — 새 가방이 저널을 replay 해 원장을 죽기 전과 비트 동일하게 재현("세계가 세션보다 오래 산다").');
  console.log('    영속 없으면 같은 kill 이 원장을 소실시킨다 = 영속이 보존의 *원인*. (write-behind 윈도: 활성 중 재시작은 in-flight 저널 손실 — 후속 ack/resend.)');
}

// ── recover-rank: 이 step 의 가설 — 랭킹(읽기 모델) kill→쓰기 저널 reconstruct 로 투영 복원(자기 영속 0·CQRS late-join) ──
function recoverRank(seeds) {
  console.log('== recover-rank: *가설* — 랭킹 kill→*쓰기 모델 저널* reconstruct 후 ① 복구 투영 == 원장 byOwner(정합) ② persist OFF+kill = 투영 소실 ③ rankDesync 0 ④ 자기 영속 0 ==');
  console.log('seed   | base rank수 | recov rank수 | 투영==원장(복구) | lost rank수 | lost!=base | rankDesync(recov) | 발행유계 | 판정');
  for (const seed of seeds) {
    const base = run(PERSIST(seed));                                    // 랭킹 ON·restart 없음(기준)
    const recov = run(RANK_RESTART(seed));                              // 랭킹 진짜 kill→쓰기 저널 reconstruct
    const lost = run({ ...RANK_RESTART(seed), persist: false });        // 대조군 — kill 하지만 영속 없음(reconstruct 불가 → 투영 소실)
    const faithfulBase = rankProjectionFaithful(base);
    const faithfulRecov = rankProjectionFaithful(recov);               // ① 복구 투영 == 원장 byOwner(자기 영속 0 인데도 완전 복원)
    const baseSize = base.ranking.ranks.size, recovSize = recov.ranking.ranks.size, lostSize = lost.ranking.ranks.size;
    const lostLost = !rankProjectionFaithful(lost) && lostSize < baseSize;   // ② 영속 부재 = 투영 소실(reconstruct 불가)
    const desync0 = rankDesync(recov) === 0;                            // ③ 복구 후 클라 rank belief 수렴(quiescent restart — belief 보존)
    const bounded = recov.ranking.published <= recov.ranking.consumed * 2;    // ④ crash 후 재계산(reconstruct 발신 0)·유계
    const ok =
      check(faithfulBase && faithfulRecov, `seed ${seed}: 복구 투영 != 원장 byOwner(읽기 모델 복원 실패)`) &&
      check(lostLost, `seed ${seed}: persist OFF+kill 인데 투영 소실 안 됨(reconstruct 없이 복원? size ${lostSize} vs base ${baseSize})`) &&
      check(desync0, `seed ${seed}: 복구 후 rankDesync ${rankDesync(recov)}`) &&
      check(bounded, `seed ${seed}: 복구 후 발행 비유계(p ${recov.ranking.published} vs c ${recov.ranking.consumed})`);
    console.log(`${pad(seed, 6)} | ${pad(baseSize, 11)} | ${pad(recovSize, 12)} | ${(faithfulRecov ? '예' : '아니오').padEnd(15)} | ${pad(lostSize, 11)} | ${(lostLost ? '예' : '아니오').padEnd(10)} | ${pad(rankDesync(recov), 16)} | ${(bounded ? '예' : '아니')}      | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 읽기 모델은 *자기 영속 0* — kill 후 *쓰기 모델*의 영속 저널(PersistStore)을 reconstruct 해 투영을 재계산(CQRS late-join: 휘발 스트림 아닌 내구 저널이 복구원).');
  console.log('    매핑: mint→owner +1·xfer→from -1/to +1 = item_result 투영과 정확히 같다(저널은 수락 효과만 = ev.ok 게이트와 1:1). 영속 없으면 같은 kill 이 투영을 소실(대조군).');
}

// ── recover-chat: 이 step 의 가설 — 채팅 kill→커맨드 로그 replay 로 라우팅+deliveries 복구(event sourcing·복구 투명) ──
function recoverChat(seeds) {
  console.log('== recover-chat: *가설* — 채팅 kill→*커맨드 로그* replay 후 ① 복구 라우팅+deliveries == 무재시작(투명·chatDigest 비트 동일) ② chatpersist OFF+kill = 소실 ③ 복구 후 say 누설 0·격리 ④ 로그 완전 ==');
  console.log('seed   | base 배달 | recov 배달 | 복구투명(chatDigest) | lost 배달 | lost!=base | 누설(recov) | chatDesync | 로그완전 | 판정');
  for (const seed of seeds) {
    const base = run(CHATP(seed));                                       // 채팅 영속 ON·restart 없음(기준)
    const recov = run(CHAT_RESTART(seed));                               // 채팅 진짜 kill→커맨드 로그 replay
    const lost = run({ ...CHAT_RESTART(seed), chatpersist: false });     // 대조군 — kill 하지만 영속 없음(replay 불가 → 구독/배달 소실)
    const transparent = chatDigest(base) === chatDigest(recov);         // ① 복구가 채팅 상태에 투명(라우팅+deliveries+계측 비트 동일)
    const baseD = base.chat.deliveries.length, recovD = recov.chat.deliveries.length, lostD = lost.chat.deliveries.length;
    const lostLost = chatDigest(lost) !== chatDigest(base) && (lostD < baseD || lost.chat.byAvatar.size < base.chat.byAvatar.size);   // ② 영속 부재 = 소실
    const leak0 = chatLeak(recov) === 0 && chatPhantom(recov) === 0;    // ③ 복구 후 라우팅이 *작동적으로* 정확(비-구독자 누설/phantom 0)
    const desync0 = chatDesync(recov) === 0;                            // 복구 후 클라 belief 수렴(quiescent restart)
    const complete = chatJournalComplete(base) && chatJournalComplete(recov);   // ④ 커맨드 로그 완전(효과 전수 기록)
    const ok =
      check(transparent, `seed ${seed}: 복구 채팅 상태 != 무재시작(복구 비투명·chatDigest 다름)`) &&
      check(lostLost, `seed ${seed}: chatpersist OFF+kill 인데 소실 안 됨(replay 없이 복원? 배달 ${lostD} vs base ${baseD})`) &&
      check(leak0, `seed ${seed}: 복구 후 누설/phantom 발생(라우팅 부정확)`) &&
      check(desync0, `seed ${seed}: 복구 후 chatDesync ${chatDesync(recov)}`) &&
      check(complete, `seed ${seed}: 커맨드 로그 불완전(base/recov)`);
    console.log(`${pad(seed, 6)} | ${pad(baseD, 9)} | ${pad(recovD, 10)} | ${(transparent ? '예' : '아니오').padEnd(19)} | ${pad(lostD, 9)} | ${(lostLost ? '예' : '아니오').padEnd(10)} | ${pad(chatLeak(recov), 11)} | ${pad(chatDesync(recov), 10)} | ${(complete ? '예' : '아니오').padEnd(8)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 채팅 복구원은 *커맨드 로그*(join/say/whisper/leave) — 가방(효과 로그)과 달리 say 팬아웃이 라우팅 의존이라 replay 가 *리듀서를 재실행*해 deliveries 재유도(순수 event sourcing).');
  console.log('    복구된 라우팅 테이블은 *작동적으로* 정확(복구 후 say 누설 0·격리 보존). 영속 없으면 같은 kill 이 구독/배달을 소실(대조군) = 영속이 복원의 *원인*.');
}

// ── compact: 이 step 의 가설 — 스냅샷 압축이 무손실(스냅샷+tail replay == 전체 저널 replay) + 저널 크기 절감 ──
function compact(seeds) {
  console.log('== compact: *가설* — ① 스냅샷+tail replay == 전체-저널 replay == 무재시작 *비트 동일*(무손실 압축) ② 저널 크기 절감 ③ desync 0·소유≤1·저널완전 ==');
  console.log('seed   | 무재시작 inv | 압축복구 inv | 전체복구 inv | 무손실 | 저널 full→tail | 절감% | 스냅샷 | desync | 소유≤1 | 저널완전 | 판정');
  for (const seed of seeds) {
    const base = run(PERSIST_NOSNAP(seed));        // 무재시작·압축 OFF(원장 진실 기준)
    const compd = run(RESTART(seed));              // 압축 ON + 가방 kill → 스냅샷+tail replay
    const full = run(RESTART_NOSNAP(seed));        // 압축 OFF + 가방 kill → 전체 저널 replay(압축 대조)
    const lossless = invDigest(compd) === invDigest(full) && invDigest(compd) === invDigest(base);   // ① 무손실(세 경로 비트 동일)
    const fullJ = full.persist.journal.length;     // 압축 안 한 저널 길이(= 영속된 변이 전부)
    const tailJ = compd.persist.journal.length;    // 압축한 저널 tail 길이(스냅샷 이후만)
    const snaps = compd.persist.snapshots;
    const reduced = tailJ < fullJ && snaps > 0;    // ② 절감 + 실제 압축 발생
    const pct = fullJ > 0 ? Math.round((1 - tailJ / fullJ) * 100) : 0;
    const desync0 = itemDesync(compd) === 0;
    const own1 = maxItemBeliefOwners(compd) <= 1;
    const complete = journalComplete(compd) && journalComplete(full);   // 압축에도 writes==변이(영속된 변이 수 불변)
    const ok =
      check(lossless, `seed ${seed}: 압축 복구 원장 != 전체/무재시작(무손실 깨짐)`) &&
      check(reduced, `seed ${seed}: 저널 절감 안 됨(tail ${tailJ} vs full ${fullJ}, snaps ${snaps})`) &&
      check(desync0, `seed ${seed}: 압축 복구 후 itemDesync ${itemDesync(compd)}`) &&
      check(own1, `seed ${seed}: 압축 복구 후 belief 소유자 >1`) &&
      check(complete, `seed ${seed}: 저널 불완전(압축에도 writes==변이 유지돼야)`);
    console.log(`${pad(seed, 6)} | ${hex(invDigest(base))} | ${hex(invDigest(compd))}  | ${hex(invDigest(full))}  | ${(lossless ? '예' : '아니오').padEnd(6)} | ${pad(fullJ + '→' + tailJ, 13)} | ${pad(pct, 5)} | ${pad(snaps, 6)} | ${pad(itemDesync(compd), 6)} | ${(own1 ? '예' : '아니')}    | ${(complete ? '예' : '아니오').padEnd(8)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 압축은 persist-측 일(라이브 원장 비-침습·invDigest 불변) — 폐기된 헤드 저널을 *스냅샷 원장*이 대신하고 tail 만 replay → 전체 replay 와 비트 동일.');
  console.log('    저널이 (스냅샷 1개 + 짧은 tail)로 유계 — event sourcing 의 "intent 로그 + 주기 스냅샷"(§4 DURABLE·SPINE) 정전 패턴.');
}

// ── chat-compact: 이 step 의 가설 — 채팅 *커맨드 로그* 스냅샷 압축이 무손실(라우팅 스냅샷+tail replay == 전체 커맨드 replay) + 로그 절감 ──
//   compact(가방·효과 로그)의 *커맨드-소싱 판*: 스냅샷이 *원장 값*이 아니라 *라우팅 파생 상태*(channels/byAvatar/deliveries/계측). 무손실 기준은 chatDigest.
function chatCompact(seeds) {
  console.log('== chat-compact: *가설* — ① 라우팅 스냅샷+tail replay == 전체-커맨드 replay == 무재시작 *chatDigest 비트 동일*(무손실 압축) ② 커맨드 로그 절감 ③ chatDesync 0·누설 0·로그완전 ==');
  console.log('seed   | 무재시작 chat | 압축복구 chat | 전체복구 chat | 무손실 | 로그 full→tail | 절감% | 스냅샷 | chatDesync | 누설 | 로그완전 | 판정');
  for (const seed of seeds) {
    const base = run(CHATP_NOSNAP(seed));          // 무재시작·압축 OFF(라우팅 진실 기준)
    const compd = run(CHAT_RESTART(seed));         // 압축 ON + 채팅 kill → 라우팅 스냅샷+tail 커맨드 replay
    const full = run(CHAT_RESTART_NOSNAP(seed));   // 압축 OFF + 채팅 kill → 전체 커맨드 replay(압축 대조)
    const lossless = chatDigest(compd) === chatDigest(full) && chatDigest(compd) === chatDigest(base);   // ① 무손실(세 경로 비트 동일)
    const fullJ = full.chatpersist.journal.length;     // 압축 안 한 커맨드 로그 길이(= 영속된 커맨드 전부)
    const tailJ = compd.chatpersist.journal.length;    // 압축한 로그 tail 길이(스냅샷 이후만)
    const snaps = compd.chatpersist.snapshots;
    const reduced = tailJ < fullJ && snaps > 0;    // ② 절감 + 실제 압축 발생
    const pct = fullJ > 0 ? Math.round((1 - tailJ / fullJ) * 100) : 0;
    const desync0 = chatDesync(compd) === 0;
    const leak0 = chatLeak(compd) === 0 && chatPhantom(compd) === 0;
    const complete = chatJournalComplete(compd) && chatJournalComplete(full);   // 압축에도 writes==커맨드(영속된 커맨드 수 불변)
    const ok =
      check(lossless, `seed ${seed}: 압축 복구 채팅 != 전체/무재시작(무손실 깨짐)`) &&
      check(reduced, `seed ${seed}: 커맨드 로그 절감 안 됨(tail ${tailJ} vs full ${fullJ}, snaps ${snaps})`) &&
      check(desync0, `seed ${seed}: 압축 복구 후 chatDesync ${chatDesync(compd)}`) &&
      check(leak0, `seed ${seed}: 압축 복구 후 누설/phantom 발생`) &&
      check(complete, `seed ${seed}: 커맨드 로그 불완전(압축에도 writes==커맨드 유지돼야)`);
    console.log(`${pad(seed, 6)} | ${hex(chatDigest(base))} | ${hex(chatDigest(compd))}  | ${hex(chatDigest(full))}  | ${(lossless ? '예' : '아니오').padEnd(6)} | ${pad(fullJ + '→' + tailJ, 13)} | ${pad(pct, 5)} | ${pad(snaps, 6)} | ${pad(chatDesync(compd), 10)} | ${pad(chatLeak(compd), 4)} | ${(complete ? '예' : '아니오').padEnd(8)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 채팅 압축 스냅샷은 *라우팅 파생 상태*(channels/byAvatar/deliveries/계측) — 효과 베이스(가방)와 달리 *리듀스 결과*를 통째로 떠 헤드 커맨드를 폐기, tail 커맨드만 replay.');
  console.log('    커맨드 로그가 (라우팅 스냅샷 1개 + 짧은 tail)로 유계 — 0018 "intent 로그 + 주기 스냅샷"의 커맨드-소싱 판(§4 DURABLE·SPINE) — 효과소싱·커맨드소싱 *둘 다* 압축 완성.');
}

// ── degrade: 버스 홉 열화 (persist ON·restart 없음) — 라우팅 정확성·원장 보존은 loss-무관 ──
function degrade(seeds) {
  console.log('== degrade: 버스 홉(svcbus) loss 0.2·redundancy 3 (persist ON) — 누설/phantom 0·원장 보존/정합·소유 belief ≤1 은 loss-무관, 완전성만 graceful ==');
  console.log('seed   | 누설 | phantom | 보존 | 정합 | belief소유≤1 | 직접0 | (참고)itemDesync | (참고)chatDesync | 판정');
  for (const seed of seeds) {
    const d = run(DEGRADE(seed));
    const leak = chatLeak(d), ph = chatPhantom(d);
    const cons = itemConserved(d), consist = ledgerConsistent(d);
    const own = maxItemBeliefOwners(d) <= 1;
    const dz = directSvcMsgs(d) === 0;
    const ok =
      check(leak === 0, `seed ${seed}: 열화 아래 누설 ${leak}`) &&
      check(ph === 0, `seed ${seed}: 열화 아래 phantom ${ph}`) &&
      check(cons, `seed ${seed}: 열화 아래 원장 보존 깨짐`) &&
      check(consist, `seed ${seed}: 열화 아래 원장 정합 깨짐`) &&
      check(own, `seed ${seed}: 열화 아래 belief 소유자 >1(split-brain)`) &&
      check(dz, `seed ${seed}: 열화 아래 직접 메시지 발생`);
    console.log(`${pad(seed, 6)} | ${pad(leak, 4)} | ${pad(ph, 7)} | ${(cons ? '예' : '아니')} | ${(consist ? '예' : '아니')} | ${(own ? '예' : '아니오').padEnd(11)} | ${(dz ? '예' : '아니')}   | ${pad(itemDesync(d), 16)} | ${pad(chatDesync(d), 16)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → persist 박스가 0016 의 버스 열화 의미를 안 깬다 — 라우팅 정확성·원장 불변은 loss-무관, 잃는 건 완전성(belief 수렴)뿐.');
}

// ── inject: 시나리오 inject write-seam(0016 그대로) ──
async function inject(seeds) {
  console.log('== inject: 시나리오 inject write-seam — 주입 실효(월드 변화)·결정론(2회 동일)·멀티프로세스 비트 동일 ==');
  console.log('seed   | 실효(월드변화) | 결정론(2회) | 멀티 비트 동일 | 판정');
  const I = [{ tick: 20, client: 0, move: [3, 0] }, { tick: 25, client: 2, move: [0, 2] }];
  for (const seed of seeds) {
    const r0 = run(BASE(seed));
    const r1 = run({ ...BASE(seed), inject: I });
    const r2 = run({ ...BASE(seed), inject: I });
    const m = await runMulti({ ...BASE(seed), inject: I });
    const eff = worldDigest(r1) !== worldDigest(r0);
    const det = logDigest(r1) === logDigest(r2);
    const multi = logDigest(m) === logDigest(r1) && worldDigest(m) === worldDigest(r1);
    const ok =
      check(eff, `seed ${seed}: 주입이 월드에 무효과(seam 미작동)`) &&
      check(det, `seed ${seed}: 주입 결정론 깨짐(2회 다름)`) &&
      check(multi, `seed ${seed}: 멀티프로세스 inject 가 인프로세스와 다름`);
    console.log(`${pad(seed, 6)} | ${(eff ? '예' : '아니오').padEnd(13)} | ${(det ? '예' : '아니오').padEnd(10)} | ${(multi ? '예' : '아니오').padEnd(13)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

// ── isolate: persist = 자기 OS 프로세스·안 죽음 · 가방 restart 후 새 호스트 pid ──
async function isolate(seeds) {
  console.log('== isolate: persist = *구분되는 OS 프로세스*(pid)·*안 죽음* · 가방 진짜 kill→새 호스트(다른 pid)·persist 저널로 replay ==');
  const seed = seeds[0];
  const b = await runMulti(RESTART(seed));
  const C = b.cluster;
  const hostPid = new Map(C.pidByHost);
  const persistPid = hostPid.get('persist');
  const ir = C.invRestarted;
  const oldInvPid = ir ? hostPid.get(ir.oldHost) : null;
  const newInvPid = ir ? hostPid.get(ir.newHost) : null;
  const ok =
    check(C.placement.some(([a]) => a === 'persist'), `persist 가 배치에 없음`) &&
    check(persistPid != null && persistPid !== C.parentPid, `persist pid(${persistPid}) 가 broker(${C.parentPid})와 같음/부재`) &&
    check(!C.killed.includes(ir ? ir.oldHost : null) || persistPid != null, `persist 검증 불가`) &&
    check(persistPid != null && !C.killed.includes('persist'), `persist 가 kill 됨(데이터 계층은 안 죽어야)`) &&
    check(ir && ir.oldHost && ir.newHost && ir.oldHost !== ir.newHost, `가방 restart 미발생(invRestarted 부재)`) &&
    check(newInvPid != null && newInvPid !== oldInvPid, `새 가방 pid(${newInvPid}) == 죽은 가방 pid(${oldInvPid}) (재spawn 안 됨)`) &&
    check(C.killed.includes(ir ? ir.oldHost : null), `죽은 가방 호스트가 killed 집합에 없음`) &&
    check(b.persist && (b.persist.journal.length > 0 || b.persist.snapshot), `persist 영속 상태 없음(저널 tail+스냅샷 모두 빔)`) &&
    check(invDigest(b) === invDigest(run(RESTART(seed))), `멀티 복구 원장 != 인프로세스 복구 원장`) &&
    check(C.allSerializable, `경계 넘는 메시지에 비직렬화 데이터 존재`);
  console.log(`  broker pid ${C.parentPid}(TCP :${C.port}) · 호스트 ${C.hostIds.length}개 · persist pid ${persistPid}(killed=${C.killed.includes('persist')}) · 저널 tail ${b.persist.journal.length}항목 + 스냅샷(${b.persist.snapshots}회·압축 ${b.persist.compacted}항목)`);
  console.log(`  가방 failover: ${ir ? ir.oldHost : '?'}(pid ${oldInvPid}·killed) → ${ir ? ir.newHost : '?'}(pid ${newInvPid}) @tick ${ir ? ir.at : '?'} · replay tail ${ir ? ir.entries : '?'}항목 + 스냅샷 베이스`);
  console.log('  배치(addr → host → pid):');
  for (const [addr, host] of C.placement) console.log(`    ${addr.padEnd(12)} → ${host.padEnd(12)} → pid ${hostPid.get(host)}`);
  check(ok, 'isolate');
}

// ── hide: persist ON+restart 에도 클라는 게이트웨이만·내부 누설 0 ──
async function hide(seeds) {
  console.log('== hide: persist ON+restart 에도 클라 접점 = 공개 주소(login·gateway)뿐 · 저널/persist/replay/내부 토폴로지 누설 0 ==');
  console.log('seed   | 클라접점 | 비공개주소 | 누설 | 뷰 받은 클라 | 서비스 쓴 클라 | 판정');
  for (const seed of seeds) {
    const r = await runMulti({ ...RESTART(seed), clients: 4 });
    const clientMsgs = r.net.log.filter(m => m.from.startsWith('client') || m.to.startsWith('client'));
    let badAddr = 0, leaks = 0;
    for (const m of clientMsgs) {
      const peer = m.from.startsWith('client') ? m.to : m.from;
      if (!PUBLIC_ADDRS.includes(peer) && !peer.startsWith('client')) badAddr++;
      const probe = JSON.stringify(m.payload);
      if (/zone/i.test(probe) || /registry/i.test(probe) || /orch/i.test(probe) || /sessionId/.test(probe) || /"S\d+"/.test(probe) ||
          /handoff/i.test(probe) || /ghost/i.test(probe) || /lease/i.test(probe) || /promote/i.test(probe) || /relink/i.test(probe) ||
          /inventory/i.test(probe) || /item_req/i.test(probe) || /ledger/i.test(probe) || /byOwner/i.test(probe) || /reqAvatar/i.test(probe) ||
          /chat_req/i.test(probe) || /deliveries/i.test(probe) || /fanout/i.test(probe) || /channels/i.test(probe) ||
          /"pub"/.test(probe) || /"sub"/.test(probe) || /"ev"/.test(probe) || /topic/i.test(probe) || /svc\./.test(probe) || /audit/i.test(probe) || /"bus"/.test(probe) ||
          /journal/i.test(probe) || /persist/i.test(probe) || /replay/i.test(probe)) leaks++;
    }
    const viewed = r.clients.filter(c => c.views > 0).length;
    const used = r.clients.filter(c => (c.chatRecv && c.chatRecv.size > 0) || (c.items && c.items.size > 0)).length;
    const ok =
      check(badAddr === 0, `seed ${seed}: 비공개 주소 직접 통신 ${badAddr}건`) &&
      check(leaks === 0, `seed ${seed}: 내부 토폴로지 누설 ${leaks}건`) &&
      check(viewed === r.clients.length, `seed ${seed}: 뷰 받은 클라 ${viewed}/${r.clients.length}`);
    console.log(`${pad(seed, 6)} | ${pad(clientMsgs.length, 8)} | ${pad(badAddr, 10)} | ${pad(leaks, 4)} | ${pad(viewed + '/' + r.clients.length, 12)} | ${pad(used + '/' + r.clients.length, 12)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 클라 와이어 계약은 0016 그대로(item_*·chat_*) — 저널·persist·replay·복구 choreography 는 전부 *서버간/제어 평면* 경계(비가시).');
}

// ── repro: 같은 시드 멀티프로세스(restart) 2회 → 같은 inv/persist/bus/audit/chat + 인프로세스와도 동일 ──
async function repro(seeds) {
  console.log('== repro: 같은 시드 멀티프로세스(restart) 2회 → 같은 원장+저널+월드 + 인프로세스와도 동일(결정론) ==');
  console.log('seed   | inv 다이제스트 | 멀티 2회 동일 | 인프로세스 동일 | world 동일 | 판정');
  const digests = new Set();
  for (const seed of seeds) {
    const inp = run(RESTART(seed));
    const m1 = await runMulti(RESTART(seed));
    const m2 = await runMulti(RESTART(seed));
    const sig = (r) => invDigest(r) + '/' + persistDigest(r) + '/' + busDigest(r) + '/' + auditDigest(r) + '/' + chatDigest(r) + '/' + rankDigest(r);
    const s1 = sig(m1), s2 = sig(m2), si = sig(inp);
    const w = worldDigest(m1) === worldDigest(inp) && worldDigest(m1) === worldDigest(m2);
    const anchor = invDigest(inp) === invDigest(run(PERSIST(seed)));   // restart 원장이 무재시작 기준과 동일(자족 복구 증명)
    digests.add(invDigest(m1));
    const ok =
      check(s1 === s2, `seed ${seed}: 멀티 2회 다름`) &&
      check(s1 === si, `seed ${seed}: 멀티 != 인프로세스`) &&
      check(anchor, `seed ${seed}: restart 원장이 무재시작 기준과 다름(복구 비투명)`) &&
      check(w, `seed ${seed}: world 다름`);
    console.log(`${pad(seed, 6)} | ${hex(invDigest(m1))}     | ${(s1 === s2 ? 'OK' : 'FAIL').padEnd(12)} | ${(s1 === si ? 'OK' : 'FAIL').padEnd(14)} | ${(w ? 'OK' : 'FAIL').padEnd(10)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  check(digests.size === seeds.length, `시드별 원장 충돌(서로 달라야): ${digests.size}/${seeds.length}`);
}

// ── summary ──
async function summary(seeds) {
  console.log('== summary: 채팅 커맨드 로그 스냅샷 압축 — 라우팅 스냅샷+tail replay 로 커맨드 로그 유계화(무손실·복구 투명·E2E 비트 동일) ==');
  for (const seed of seeds) {
    const a = run(CHAT_RESTART(seed));
    const b = await runMulti(CHAT_RESTART(seed));
    const C = b.cluster;
    const transparent = chatDigest(b) === chatDigest(run(CHATP(seed)));
    const ok = logDigest(a) === logDigest(b) && worldDigest(a) === worldDigest(b) && chatDigest(a) === chatDigest(b)
      && chatPersistDigest(a) === chatPersistDigest(b) && transparent && chatLeak(b) === 0 && chatDesync(b) === 0 && svcMsgsToZones(b) === 0;
    if (!ok) FAILED = true;
    const cr = C.chatRestarted;
    const cp = b.chatpersist || {};
    console.log(`  seed ${pad(seed, 4)}: 프로세스 ${C.pids.length}개 · 채팅 failover ${cr ? cr.oldHost + '→' + cr.newHost + '@' + cr.at : '?'}(스냅샷 베이스 + tail ${cr ? cr.entries : '?'}개 replay·스냅샷 ${cp.snapshots || 0}회·압축 ${cp.compacted || 0}) · 복구투명 ${transparent}(배달 ${b.chat.deliveries.length}) · 누설 ${chatLeak(b)} | ${hex(chatDigest(b))}`);
  }
  console.log('채팅 압축 스냅샷은 *라우팅 파생 상태*(channels/byAvatar/deliveries) — 커맨드 로그가 (스냅샷+짧은 tail)로 유계 · 멀티프로세스 kill→replay = 인프로세스 비트 동일 · 복구 투명·누설 0.');
}

// ── CLI ──
const MODES = { reg, rank, e2e, sacred, recover, 'recover-rank': recoverRank, 'recover-chat': recoverChat, compact, 'chat-compact': chatCompact, degrade, inject, isolate, hide, repro };
(async () => {
  const mode = process.argv[2] || 'all';
  const seedArg = process.argv[3] ? [parseInt(process.argv[3], 10)] : SEEDS;
  if (MODES[mode]) await MODES[mode](seedArg);
  else if (mode === 'all') {
    reg(seedArg); console.log('');
    rank(seedArg); console.log('');
    await e2e(seedArg); console.log('');
    sacred(seedArg); console.log('');
    recover(seedArg); console.log('');
    recoverRank(seedArg); console.log('');
    recoverChat(seedArg); console.log('');
    compact(seedArg); console.log('');
    chatCompact(seedArg); console.log('');
    degrade(seedArg); console.log('');
    await inject(seedArg); console.log('');
    await isolate(seedArg); console.log('');
    await hide(seedArg); console.log('');
    await repro(seedArg); console.log('');
    await summary(seedArg);
  } else { console.log('mode: reg | rank | e2e | sacred | recover | recover-rank | recover-chat | compact | chat-compact | degrade | inject | isolate | hide | repro | all'); process.exit(2); }

  console.log('');
  console.log(FAILED ? '결과: FAIL' : '결과: ALL OK');
  process.exit(FAILED ? 1 : 0);
})();
