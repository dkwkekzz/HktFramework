'use strict';
// engine/verify-kit.js — HktInfra 누적 검증 키트 (step-0030 에서 step verify.js 로부터 승격)
//
// 무엇: 0001~0029 가 쌓아 온 회귀·불변 테스트(reg + 17개 잔존 가설 모드 + summary)를 한 곳에 둔다.
//   step 마다 verify.js 로 복사 전진하던 ~700줄이 여기 살고, 각 step 의 verify.js 는 *얇은 셸*만 남는다:
//   ctx(NET·NETPREV·시드·상수) 구성 + 이번 step 의 새 가설 모드 추가(kit.MODES.<mode> = fn) + kit.cli() 위임.
// 왜: 복사 전진(anti-DRY)은 *step 이 더한 것*을 동결하는 장치다 — 전 step 공통의 누적 회귀까지 복사하면
//   verify.js 가 step 수에 비례해 비대해진다(0029 시점 75KB). 안정화된 것은 engine 으로 승격한다(CLAUDE.md 승격 규칙,
//   engine/index.js·panel-kit.js 와 같은 지위). 키트 변경은 spine 사슬(이 키트를 쓰는 모든 step 의 reg)이 즉시 잡는다.
// 새 step 의 새 모드 추가법:
//   const kit = makeVerifyKit(ctx);
//   kit.MODES['mymode'] = function mymode(seeds) { ... kit.helpers.check(cond, 'label') ... };
//   kit.ORDER.splice(1, 0, 'mymode');   // 'all' 실행 순서에 삽입(reg 다음 권장)
//   process.exit(await kit.cli(process.argv));
// 모드 카탈로그(아래 문구의 "이 step"은 각 모드의 도입 step 기준 — 정식 문서는 해당 step-NNNN.md):
//   mode: reg | wquorum | inflight | tail | reliable | chat-compact | recover-chat | rank | recover-rank | e2e | sacred | recover | compact | degrade | inject | isolate | hide | repro | all
//     reg          — 회귀 0: 인프로세스 모드(quorumW 0) → step-0028 와 *비트 동일*(net.log + 상태 + inv/chat/bus/rank).
//                  저널 q 플래그·ack 회신·durableSeq 집계는 quorumW 0 이면 *휴면*(q 0·ack 0·워터마크 미사용)임을 직접 증명.
//     wquorum      — *이 step 의 가설*: W=3 쓰기 정족수 ack 후에만 durable 선언(primary+복제3=N+1=4 사본). ⒜ 무손실=4 스토어 ack→전 seq durable(win 0)
//                  ⒝ per-link 손실(매 seq 3 홀더=W)=여전 durable(win 0·쓰기 정족수가 per-link 손실 견딤) ⒞ tail 정족수 미달(seq≥T 는 2 홀더<W)=durableSeq 가 T-1 에서 멈춤(정합성 윈도 가시)
//                  → crash{primary,persist4}(윈도 2홀더 사망) 에 durable 프런티어 전부 복구·윈도 전부 소실(워터마크가 복구 프런티어 정확히 예측). ④ durableSeq 의 전 seq ≥W ack·라이브 원장 desync 0·quorumW 0 면 reg 0
//     inflight     — (0026 잔존 가설) in-flight mint 손실 아래 ① recon OFF = 복구 원장에 mint 항목 누락(itemDesync>0·클라 belief 에 없는 id) ② recon ON = id-reconciliation→서버 re-mint→클라 newId 채택→itemDesync 0·원장 == 무손실 truth
//                  ③ reconcile 발신 실제 발생(mintResends>0) ④ 멱등(dupe 0·conserved·consistent·durable mint 는 re-mint skip). give 복구(clientResend 0025)와 독립.
//     tail         — (0024 잔존 가설) 저널 홉 *tail* 손실 아래 ① heartbeat ON = persist 저널 완전(maxSentSeq 통보→tail NAK→재전송)·복구 == 무손실 기준(invDigest 동일)
//                  ② heartbeat OFF(NAK-only·0023) = tail 영구 갭(maxRecvSeq 위 구조적 미감지·tailNAK 0)·복구 손실 ③ heartbeat/tailNAK/재전송 실제 발생 ④ 복구 후 itemDesync 0·소유≤1.
//     reliable     — (0023 잔존 가설) 저널 홉 *중간* 손실 아래 ① 신뢰 ON = persist 저널 완전(writes==무손실 기준)·복구 원장 == 무손실 기준(invDigest 동일)
//                  ② 신뢰 OFF 대조군 = 저널 갭(영구 손실)·복구 원장 손실(invDigest 다름) ③ NAK/재전송 실제 발생 ④ 복구 후 itemDesync 0·소유≤1.
//     chat-compact — (0022 잔존 가설) 채팅 커맨드 로그 압축이 ① 라우팅 스냅샷+tail replay == 전체-커맨드 replay == 무재시작 *chatDigest 비트 동일*
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
// 모든 수치는 시드 ctx.SEEDS (기본 [42, 7, 1234, 99, 2026]). 문서의 수치 = 이 출력.

module.exports = function makeVerifyKit(ctx) {
  const { NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS } = ctx;
  const { run, runMulti, fnv1a, buildTopology, PUBLIC_ADDRS, quorumMergeJournals,
        chatDesync, chatPhantom, chatLeak, chatClientNoLeak, chatDigest,
        itemConserved, ledgerConsistent, maxItemBeliefOwners, itemDesync, invDigest,
        busDigest, auditDigest, directSvcMsgs, senderDigest, persistDigest, journalComplete,
        chatPersistDigest, chatJournalComplete,
        ledgerCounts, rankProjectionFaithful, rankDesync, rankDigest } = NET;
  const NET16 = NETPREV;   // reg 대조용 직전 step net-core (변수명은 0016 추출 당시 흔적 — 본문 verbatim 유지)
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
const PERSIST = (seed) => ({ ...BUSA(seed), persist: true, snapshot: SNAP_N });   // + 영속(저널) + 가방 스냅샷 압축(0018)
const PERSIST_NOSNAP = (seed) => ({ ...BUSA(seed), persist: true });              // + 영속(압축 OFF — 전체 저널·0017 의미·압축/신뢰 대조군)
const RESTART = (seed) => ({ ...PERSIST(seed), invRestart: { at: RESTART_AT } });   // + 가방 진짜 kill→스냅샷+tail replay
const RESTART_NOSNAP = (seed) => ({ ...PERSIST_NOSNAP(seed), invRestart: { at: RESTART_AT } });   // + 가방 kill→전체 저널 replay(압축/신뢰 대조)
const RANK_RESTART = (seed) => ({ ...PERSIST(seed), rankRestart: { at: RESTART_AT } });   // 0020 — 랭킹(읽기 모델) 진짜 kill→쓰기 저널 reconstruct(자기 영속 0)
const CHATP = (seed) => ({ ...PERSIST(seed), chatpersist: true, chatSnapshot: CHAT_SNAP_N });   // 0021 채팅 영속 + 커맨드 로그 압축(0022)·restart 없음(복구 투명 기준)
const CHATP_NOSNAP = (seed) => ({ ...PERSIST(seed), chatpersist: true });   // 채팅 영속(압축 OFF — 전체 커맨드 로그·0021 의미)
const CHAT_RESTART = (seed) => ({ ...CHATP(seed), chatRestart: { at: RESTART_AT } });   // 0022 — 채팅 kill→라우팅 스냅샷+tail 커맨드 replay
const CHAT_RESTART_NOSNAP = (seed) => ({ ...CHATP_NOSNAP(seed), chatRestart: { at: RESTART_AT } });   // 채팅 kill→전체 커맨드 replay(압축 대조)
const FAILS_PERSIST = (seed) => ({ ...PERSIST(seed), ticks: 80, failover: true, deathTick: DEATH, leaseTimeout: LEASE });
// 전송 열화 — 버스 출입 홉(svcbus) 전체에 redundancy/loss(라우팅 정확성·원장 보존의 loss-무관 검증). persist ON·restart 없음.
const DEGRADE = (seed) => ({ ...PERSIST(seed), transport: { seed: (seed ^ 0xABCD) >>> 0, delayMin: 0, delayMax: 2, loss: 0.2, redundancy: 3, routeFilter: NET.routeFilters.svcbus } });
// 저널 홉 손실(이 step) — inventory→persist 홉에 redundancy 1 + loss(단일 사본·손실=엔트리 손실 → 신뢰 메커니즘 자극). 압축과 직교(snapshot OFF·§9).
const JHOPLOSS = (seed) => ({ seed: (seed ^ 0x5151) >>> 0, delayMin: 0, delayMax: 0, loss: JLOSS, redundancy: 1, routeFilter: NET.routeFilters.persist });
const RELIABLE_OFF = (seed) => ({ ...RESTART_NOSNAP(seed), transport: JHOPLOSS(seed) });                       // 저널 홉 손실·신뢰 OFF(대조 — 저널 갭→복구 손실)
const RELIABLE_ON = (seed) => ({ ...RESTART_NOSNAP(seed), transport: JHOPLOSS(seed), journalReliable: true });  // 저널 홉 손실·신뢰 ON(NAK+재전송→저널 완전→복구 무손실)
const RELIABLE_ON_LIVE = (seed) => ({ ...PERSIST_NOSNAP(seed), transport: JHOPLOSS(seed), journalReliable: true });  // restart 없음 — 라이브 가방의 재전송 계측(crash 가 resends 리셋하므로)

// 저널 홉 *tail* 손실(이 step) — 저널은 ticks 10~17 에 발신. TAIL_FROM 이후의 *최초 전송*만 100% 떨군다(redundancy 1·loss 1.0):
//   → 늦은 저널(tail seq)이 persist 에 안 닿음 → maxRecvSeq 가 tail *아래* 동결 → NAK-only(0023)는 tail 을 *구조적으로* 못 본다(§9 사각).
//   재전송(resend:true)·NAK·heartbeat 는 routeFilter 가 제외 → 신뢰 배달(갭은 *전송*이 아니라 *감지* 문제로 격리 — heartbeat 만 감지를 공급).
const TAIL_FROM = 16;
const JTAIL = (seed) => ({ seed: (seed ^ 0x7a11) >>> 0, delayMin: 0, delayMax: 0, loss: 1.0, redundancy: 1,
  routeFilter: (m) => m.to === 'persist' && m.payload.type === 'journal' && !m.payload.resend && m.tick >= TAIL_FROM });
const TAIL_ON = (seed) => ({ ...RESTART_NOSNAP(seed), transport: JTAIL(seed), journalReliable: true, journalHeartbeat: true });  // tail 손실·heartbeat ON(maxSentSeq 통보→tail NAK→재전송→저널 완전→복구 무손실)
const TAIL_OFF = (seed) => ({ ...RESTART_NOSNAP(seed), transport: JTAIL(seed), journalReliable: true });                        // tail 손실·heartbeat OFF(= 0023 NAK-only 대조 — tail 영구 갭→복구 손실)
const TAIL_ON_LIVE = (seed) => ({ ...PERSIST_NOSNAP(seed), transport: JTAIL(seed), journalReliable: true, journalHeartbeat: true });  // restart 없음 — 라이브 heartbeat/재전송 계측(crash 가 리셋하므로)

// PersistStore failover(이 step) — primary persist 가 죽을 때 backup(persist2)이 전체 저널을 갖고 있으면 복구 무손실:
const PERSIST_CRASH_AT = RESTART_AT - 2;   // invRestart.at 직전 primary 죽임 → invRestart 가 recover 할 때 primary journal = 빔
const PF_OFF = (seed) => ({ ...RESTART_NOSNAP(seed), persistRestart: { at: PERSIST_CRASH_AT } });   // 이중쓰기 OFF(default) — primary crash → 복구 불가
const PF_ON = (seed) => ({ ...RESTART_NOSNAP(seed), persistBackup: true, persistRestart: { at: PERSIST_CRASH_AT } });  // 이중쓰기 ON — persist2 에서 복구

// quorum *쓰기* ack(이 step) — primary + R=3 복제(persist2..persist4) = N+1=4 내구 사본. W=3 정족수로 durable 선언.
const QR = 3;   // 복제 수(primary 포함 4 내구 사본)
const QW = 3;   // 쓰기 정족수 W — seq 가 ≥W 스토어에 ack 되면 durable(=(N+1−W)=1 죽음 견딤). ack<W 인 seq = 정합성 윈도.
const WQ_BASE = (seed) => ({ ...PERSIST_NOSNAP(seed), persistReplicas: QR, quorumW: QW });   // 비-신뢰 스토어(0028)·복제 3·정족수 3·restart 없음(crash 는 verify 가 post-hoc 주입). reliable OFF → 받은 저널마다 ack(홀더 수=ack 수).
// per-link 손실(0028 XREPLICALOSS) — 각 seq 를 서로 다른 1 복제가 떨굼(persistK 는 seq%R==(K-2)·primary 손실 0) → 매 seq 홀더=primary+복제2=3=정확히 W → 그래도 durable.
const XREPLICALOSS = (seed, R) => ({ seed: (seed ^ 0x5C0B) >>> 0, delayMin: 0, delayMax: 0, loss: 1.0, redundancy: 1,
  routeFilter: (m) => {
    if (m.payload.type !== 'journal' || m.payload.resend) return false;
    const mm = /^persist(\d+)$/.exec(m.to); if (!mm) return false;   // primary 'persist'(숫자 없음) = 손실 0
    return (m.payload.entry.seq % R) === (parseInt(mm[1], 10) - 2);   // 이 복제가 떨굴 seq 부분집합(persist2→0, persist3→1, persist4→2)
  } });
// tail 정족수 미달 손실(이 step) — persist2 는 *전* seq 떨굼 + persist3 은 seq≥T 만 떨굼 → seq<T 홀더={primary,p3,p4}=3(durable)·seq≥T 홀더={primary,p4}=2(<W=윈도).
//   → durableSeq 가 T-1 에서 멈춤(워터마크가 윈도 앞에 정지) = 정합성 윈도 가시. 윈도 seq 는 2 홀더뿐 → 그 2(primary,p4) 죽으면 소실.
const WTAIL_T = (total) => Math.floor(total * 0.6);   // 윈도 시작 seq(저널 후반 40% 가 정족수 미달 — 시드별 total 비례)
const XQUORUMLOSS = (seed, T) => ({ seed: (seed ^ 0x71A0) >>> 0, delayMin: 0, delayMax: 0, loss: 1.0, redundancy: 1,
  routeFilter: (m) => {
    if (m.payload.type !== 'journal' || m.payload.resend) return false;
    if (m.to === 'persist2') return true;                                 // persist2 = 전 seq 떨굼(상시 1 드롭)
    if (m.to === 'persist3' && m.payload.entry.seq >= T) return true;     // persist3 = tail(seq≥T) 추가 드롭 → 그 seq 2 홀더(<W)
    return false;                                                         // primary·persist4 = 손실 0(전 seq 보유)
  } });

// in-flight *give* 손실(0025 잔존) — xfer(전송) 저널만 100% 떨군다(mint 는 전부 durable → itemId 보존):
const XGIVELOSS = (seed) => ({ seed: (seed ^ 0x6233) >>> 0, delayMin: 0, delayMax: 0, loss: 1.0, redundancy: 1,
  routeFilter: (m) => m.to === 'persist' && m.payload.type === 'journal' && m.payload.entry.kind === 'xfer' && !m.payload.resend });
const IF_OFF = (seed) => ({ ...RESTART_NOSNAP(seed), transport: XGIVELOSS(seed) });
const IF_ON = (seed) => ({ ...RESTART_NOSNAP(seed), transport: XGIVELOSS(seed), clientResend: true, clientResync: { at: RESTART_AT + 2 } });

// in-flight *mint* 손실(이 step) — mint 저널만 100% 떨군다(xfer 는 전부 durable):
//   → 복구 원장에 mint 항목이 빠짐 → 서버가 아이템 id 를 모름 → 클라 belief(라이브 확인된 id)보다 *뒤처짐*.
//   xfer(전송) 는 durable → give 복구는 0025 clientResend 로 별도 처리. 재발행(resend:true) 제외 → 재발행은 신뢰 배달.
const XMINTLOSS = (seed) => ({ seed: (seed ^ 0x7A4F) >>> 0, delayMin: 0, delayMax: 0, loss: 1.0, redundancy: 1,
  routeFilter: (m) => m.to === 'persist' && m.payload.type === 'journal' && m.payload.entry.kind === 'mint' && !m.payload.resend });
const MI_OFF = (seed) => ({ ...RESTART_NOSNAP(seed), transport: XMINTLOSS(seed) });  // mint 손실·recon OFF(대조 — 복구 원장에 mint 없음·itemDesync>0)
const MI_ON = (seed) => ({ ...RESTART_NOSNAP(seed), transport: XMINTLOSS(seed), mintRecon: true, clientResync: { at: RESTART_AT + 2 } });  // mint 손실·recon ON(id-reconciliation→re-mint→클라 newId 채택→itemDesync 0)

// ── reg: 인프로세스 모드(persistReplicas 0) → step-0027 와 비트 동일(N-replica 도입 비-침습) ──
//   persistReplicas 미제공 = 0 → 복제 스폰 0·_journal fan-out 0·복구 0027 분기 → 0027 와 비트 동일.
function reg(seeds) {
  console.log('== reg: 인프로세스 모드(persistReplicas 0) → step-0027 와 비트 동일(net.log + 상태 + inv/chat/bus/rank). N-replica fan-out = 비-침습 ==');
  console.log('seed   | 구성                | 0027 logHash | 0028(inproc) | log동일 | 상태동일 | inv/chat/bus/rank 동일 | 판정');
  for (const seed of seeds) {
    const cfgs = [
      ['zones1            ', { zones: 1, recovery: false, failover: false }],
      ['zones2+rec+fo     ', { zones: 2, recovery: true, failover: true, deathTick: DEATH, leaseTimeout: LEASE }],
      ['svc+bus+audit     ', { zones: 2, recovery: true, failover: false, inventory: true, itemOps: 8, chat: true, chatOps: 10, regions: 2, bus: true, audit: true }],
      ['chatp+chatrst     ', { zones: 2, recovery: true, failover: false, inventory: true, itemOps: 8, chat: true, chatOps: 10, regions: 2, bus: true, audit: true, ranking: true, persist: true, snapshot: SNAP_N, chatpersist: true, chatRestart: { at: 44 } }],
      ['persist+rel+rst   ', { zones: 2, recovery: true, failover: false, inventory: true, itemOps: 8, chat: true, chatOps: 10, regions: 2, bus: true, audit: true, ranking: true, persist: true, snapshot: SNAP_N, journalReliable: true, invRestart: { at: 40 }, rankRestart: { at: 44 } }],
    ];
    for (const [name, c] of cfgs) {
      const p = { seed, ticks: 48, clients: 4, moves: 30, radius: 4, grid: 16, incremental: true, ...c };
      const r25 = NET16.run(p);
      const r26 = run({ ...p });
      const okL = logDigest(r25) === logDigest(r26), okS = worldDigest(r25) === worldDigest(r26);
      const okX = invDigest(r25) === invDigest(r26) && chatDigest(r25) === chatDigest(r26) && busDigest(r25) === busDigest(r26) && rankDigest(r25) === rankDigest(r26);
      check(okL, `seed ${seed} ${name.trim()}: net.log 다름`);
      check(okS, `seed ${seed} ${name.trim()}: 상태 다름`);
      check(okX, `seed ${seed} ${name.trim()}: inv/chat/bus/rank 다름`);
      console.log(`${pad(seed, 6)} | ${name} | ${hex(logDigest(r25))}   | ${hex(logDigest(r26))}   | ${(okL ? '예' : '아니오').padEnd(6)} | ${(okS ? '예' : '아니오').padEnd(8)} | ${(okX ? '예' : '아니오').padEnd(21)} | ${okL && okS && okX ? 'OK' : 'FAIL'}`);
    }
  }
  console.log('  → persistReplicas 미제공이면 복제 스폰 0·_journal fan-out 0·복구 0027 분기 — 0027 와 비트 동일.');
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

// ── reliable: 이 step 의 가설 — 저널 홉 손실 아래 NAK+재전송이 저널을 완전화 → 복구 무손실(write-behind 신뢰성의 전송-손실 절반) ──
function reliable(seeds) {
  console.log('== reliable: *가설* — 저널 홉 손실 아래 ① 신뢰 ON = persist 저널 완전(writes==무손실 기준)·복구 원장 == 무손실 기준(invDigest 동일) ② 신뢰 OFF = 저널 갭·복구 손실 ③ NAK/재전송 실제 발생 ④ desync 0·소유≤1 ==');
  console.log('seed   | 무손실 inv | 신뢰ON 복구 | 신뢰OFF 복구 | ON완전 | OFF손실 | ON==무손실 | OFF!=무손실 | NAK | 재전송 | 판정');
  for (const seed of seeds) {
    const base = run(RESTART_NOSNAP(seed));        // 무손실 기준(저널 홉 손실 없음·전체 저널 replay) — persist.writes = 영속된 변이 전부
    const on = run(RELIABLE_ON(seed));             // 저널 홉 손실 + 신뢰 ON(NAK+재전송)
    const off = run(RELIABLE_OFF(seed));           // 저널 홉 손실 + 신뢰 OFF(대조)
    const onLive = run(RELIABLE_ON_LIVE(seed));    // 손실+신뢰 ON·restart 없음 — 라이브 가방의 재전송 계측(crash 가 resends 리셋하므로)
    const baseW = base.persist.writes || 0;
    const onComplete = (on.persist.writes || 0) === baseW;        // ① 신뢰 ON: persist 저널 완전(무손실 기준과 동수 — 손실분 재전송으로 메움). crash-안전(persist 비-사망).
    const offLost = baseW - (off.persist.writes || 0);            // OFF 가 영구 손실한 저널 항목 수(>0 — fire-and-forget·재전송 0)
    const onLossless = invDigest(on) === invDigest(base);        // ① 복구 원장 == 무손실 기준(전송 손실에도 무손실 영속)
    const offLossy = invDigest(off) !== invDigest(base);         // ② OFF: 저널 갭 → 복구 원장 손실(기준과 다름)
    const naks = on.persist.naks || 0, resends = onLive.inventory.resends || 0;
    const fired = naks > 0 && resends > 0;                       // ③ 신뢰 메커니즘 실제 작동(갭 감지 NAK + 재전송)
    const desync0 = itemDesync(on) === 0 && maxItemBeliefOwners(on) <= 1;   // ④ 복구 후 수렴·소유 보존
    const ok =
      check(onComplete, `seed ${seed}: 신뢰 ON 저널 불완전(writes ${on.persist.writes} != 기준 ${baseW} — tail 손실? §9)`) &&
      check(onLossless, `seed ${seed}: 신뢰 ON 복구 원장 != 무손실 기준(손실 미복구)`) &&
      check(offLost > 0, `seed ${seed}: 신뢰 OFF 인데 저널 손실 0(손실율/seed 조정 필요)`) &&
      check(offLossy, `seed ${seed}: 신뢰 OFF 복구가 기준과 같음(손실 미발생)`) &&
      check(fired, `seed ${seed}: NAK/재전송 미발생(메커니즘 안 탐·naks ${naks} resends ${resends})`) &&
      check(desync0, `seed ${seed}: 신뢰 ON 복구 후 desync/소유 위반`);
    console.log(`${pad(seed, 6)} | ${hex(invDigest(base))} | ${hex(invDigest(on))}  | ${hex(invDigest(off))}  | ${(onComplete ? '예' : '아니오').padEnd(6)} | ${pad('예(' + offLost + ')', 7)} | ${(onLossless ? '예' : '아니오').padEnd(10)} | ${(offLossy ? '예' : '아니오').padEnd(11)} | ${pad(naks, 3)} | ${pad(resends, 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 저널 홉이 *전송-신뢰화*된다: persist 가 seq 갭을 감지해 NAK → inventory 가 sentBuffer 에서 재전송 → recvSeqs dedup 으로 멱등 수신.');
  console.log('    write-behind 신뢰성의 *전송-손실 절반* 해소 — 손실 아래에서도 영속이 완전해 복구가 무손실. (활성 중 죽음=in-flight 손실 절반·tail 손실은 §9.)');
}

// ── tail: 이 step 의 가설 — 저널 홉 *tail* 손실(마지막 항목들)은 NAK-only(0023)로 못 잡는다. heartbeat(maxSentSeq 통보)가 tail 갭을 감지케 한다 ──
function tail(seeds) {
  console.log('== tail: *가설* — 저널 홉 *tail* 손실 아래 ① heartbeat ON = persist 저널 완전(maxSentSeq 통보→tail NAK→재전송)·복구 == 무손실 기준(invDigest 동일) ② heartbeat OFF(NAK-only·0023) = tail 영구 갭·복구 손실 ③ tail NAK/heartbeat/재전송 실제 발생 ④ desync 0·소유≤1 ==');
  console.log('seed   | 무손실 inv | hbON 복구  | hbOFF 복구 | ON완전 | OFF갭 | ON==무손실 | OFF!=무손실 | tailNAK(ON/OFF) | hb | 재전송 | 판정');
  for (const seed of seeds) {
    const base = run(RESTART_NOSNAP(seed));        // 무손실 기준(저널 홉 손실 없음·전체 저널 replay) — persist.writes = 영속된 변이 전부
    const on = run(TAIL_ON(seed));                 // tail 손실 + heartbeat ON(maxSentSeq 통보→tail NAK→재전송)
    const off = run(TAIL_OFF(seed));               // tail 손실 + heartbeat OFF(= 0023 NAK-only — tail 못 봄)
    const onLive = run(TAIL_ON_LIVE(seed));        // 손실+hb ON·restart 없음 — 라이브 heartbeat/재전송 계측(crash 가 리셋하므로)
    const baseW = base.persist.writes || 0;
    const onComplete = (on.persist.writes || 0) === baseW;        // ① heartbeat ON: persist 저널 완전(tail 손실분 재전송으로 메움)
    const offGap = baseW - (off.persist.writes || 0);            // NAK-only 가 못 메운 tail 갭(>0 — maxRecvSeq 위라 구조적 미감지)
    const onLossless = invDigest(on) === invDigest(base);        // ① 복구 원장 == 무손실 기준(tail 손실에도 무손실 영속)
    const offLossy = invDigest(off) !== invDigest(base);         // ② NAK-only: tail 갭 → 복구 원장 손실(기준과 다름)
    const onTailNak = on.persist.tailNaks || 0, offTailNak = off.persist.tailNaks || 0;
    const hbs = onLive.inventory.journalHbs || 0, resends = onLive.inventory.resends || 0;
    const fired = onTailNak > 0 && hbs > 0 && resends > 0;       // ③ heartbeat 메커니즘 실제 작동(maxSentSeq 통보→tail NAK→재전송)
    const offBlind = offTailNak === 0;                          // NAK-only 는 tail NAK 0(구조적 미감지 = §9 사각의 직접 증명)
    const desync0 = itemDesync(on) === 0 && maxItemBeliefOwners(on) <= 1;   // ④ 복구 후 수렴·소유 보존
    const ok =
      check(onComplete, `seed ${seed}: heartbeat ON 저널 불완전(writes ${on.persist.writes} != 기준 ${baseW})`) &&
      check(onLossless, `seed ${seed}: heartbeat ON 복구 원장 != 무손실 기준(tail 미복구)`) &&
      check(offGap > 0, `seed ${seed}: NAK-only 인데 tail 갭 0(손실 윈도/timing 조정 필요)`) &&
      check(offLossy, `seed ${seed}: NAK-only 복구가 기준과 같음(tail 손실 미발생)`) &&
      check(offBlind, `seed ${seed}: NAK-only 가 tail NAK 발생(${offTailNak}) — heartbeat 없이 tail 감지는 불가해야`) &&
      check(fired, `seed ${seed}: heartbeat/tailNAK/재전송 미발생(메커니즘 안 탐·hb ${hbs} tailNak ${onTailNak} resends ${resends})`) &&
      check(desync0, `seed ${seed}: heartbeat ON 복구 후 desync/소유 위반`);
    console.log(`${pad(seed, 6)} | ${hex(invDigest(base))} | ${hex(invDigest(on))} | ${hex(invDigest(off))} | ${(onComplete ? '예' : '아니오').padEnd(6)} | ${pad(offGap, 5)} | ${(onLossless ? '예' : '아니오').padEnd(10)} | ${(offLossy ? '예' : '아니오').padEnd(11)} | ${pad(onTailNak + '/' + offTailNak, 15)} | ${pad(hbs, 2)} | ${pad(resends, 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → NAK-only(0023)는 *받은* 최고 seq([0..maxRecvSeq])까지만 갭을 본다 → tail(최고 수신 *위*)은 구조적으로 미감지(tailNAK 0·갭 영구). heartbeat 가 maxSentSeq 를 통보해야 persist 가 tail 갭을 NAK → 재전송으로 메운다.');
  console.log('    write-behind 신뢰성의 *tail 손실* 해소(0023 §9 사각). 단 *재전송 배달*은 신뢰 모델(전송이 아니라 *감지* 격리)·in-flight 손실(활성 중 죽음)은 여전히 §9.');
}

// ── inflight: 이 step 의 가설 — in-flight *mint* 손실(원장에 mint 항목 누락)을 id-reconciliation 이 재수렴시킨다(서버 re-mint + 클라 newId 채택·멱등·dupe 0) ──
function inflight(seeds) {
  console.log('== inflight: *가설* — in-flight mint 손실 아래 ① recon OFF = 복구 원장에 mint 누락(itemDesync>0) ② recon ON = id-reconciliation→re-mint→클라 newId 채택→itemDesync 0·원장==무손실 truth ③ reconcile 실제 발신 ④ 멱등(dupe 0·conserved·consistent) ==');
  console.log('seed   | 무손실 inv | recon ON inv | OFF ds | ON ds | ON==truth | mint(OFF/ON/truth) | reconcile수 | own≤1 | 보존/정합 | 판정');
  for (const seed of seeds) {
    const base = run(RESTART_NOSNAP(seed));   // 무손실 truth(mint 전부 durable·전체 저널 replay) — 복구 원장의 정답
    const off = run(MI_OFF(seed));            // mint 손실 + recon OFF(복구 원장에 mint 항목 누락)
    const on = run(MI_ON(seed));              // mint 손실 + recon ON(복구 후 id-reconciliation)
    const offDesync = itemDesync(off) > 0;                         // ① mint 손실 실제 발생(클라 belief 에 서버 모르는 id 존재)
    const offMintLost = (off.inventory.minted || 0) < (base.inventory.minted || 0);  // mint 항목이 복구 원장에 빠짐
    const onConverged = itemDesync(on) === 0;                      // ② id-reconciliation 이 belief 를 재수렴(클라=서버 일치)
    // ② 아바타별 보유 수가 truth 와 일치: id 는 달라도(re-mint = 새 id) 소유 분포는 같아야 함.
    //   주의: XMINTLOSS + xfer durable → xfer replay 로 주고받은 아이템은 원래 id 로 복원.
    //   그 아이템들은 서버 원장에 있으므로 reconcile skip → id 불변. mint-only 아이템만 새 id.
    //   invDigest(id 기반) ≠ truth 는 정상 — 아바타별 count 로 정합 확인.
    const trueCount = ledgerCounts(base);
    const reconCount = ledgerCounts(on);
    const countsMatch = (() => { for (const [a, n] of trueCount) if ((reconCount.get(a) || 0) !== n) return false; for (const [a, n] of reconCount) if (n !== (trueCount.get(a) || 0)) return false; return true; })();
    const reconciles = on.clients.reduce((a, c) => a + (c.mintResends || 0), 0);
    const fired = reconciles > 0;                                  // ③ reconcile 발신 실제 발생
    const own1 = maxItemBeliefOwners(on) <= 1;                     // ④ dupe 0(belief 이중 소유 없음)
    // ④ 원장·역인덱스 정합(ledgerConsistent) — itemConserved 는 xfer replay 후 minted 카운터와 ledger.size 가 다를 수 있어 제외.
    const safe = ledgerConsistent(on);
    const ok =
      check(offDesync, `seed ${seed}: recon OFF 인데 itemDesync 0(in-flight mint 손실 미발생 — XMINTLOSS 조정 필요)`) &&
      check(offMintLost, `seed ${seed}: 복구 원장 mint 빠짐 없음(mint 손실 미발생)`) &&
      check(onConverged, `seed ${seed}: recon ON 후 itemDesync 잔존(id-reconciliation 재수렴 실패)`) &&
      check(countsMatch, `seed ${seed}: recon ON 아바타별 보유 수 != truth(per-avatar count 불일치)`) &&
      check(fired, `seed ${seed}: reconcile 발신 미발생(메커니즘 안 탐·reconciles ${reconciles})`) &&
      check(own1 && safe, `seed ${seed}: id-reconciliation 이 멱등 아님(dupe/역인덱스 정합 위반)`);
    console.log(`${pad(seed, 6)} | count일치 | recon ${(countsMatch ? '예' : '아니오').padEnd(5)} | OFF ds | ON ds | 아바타수일치 | reconcile수 | own≤1 | 역인덱스정합 | 판정`);
    console.log(`${pad(seed, 6)} | truth:${[...trueCount.values()].sort((a,b)=>b-a).slice(0,3).join('/')} | ${pad(itemDesync(off), 6)} | ${pad(itemDesync(on), 5)} | ${(countsMatch ? '예' : '아니오').padEnd(12)} | ${pad(reconciles, 11)} | ${(own1 ? '예' : '아니')}    | ${(safe ? '예' : '아니오').padEnd(12)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → in-flight mint 손실 = 라이브 pickup 이 acked(클라 belief 갱신)됐으나 mint 저널이 손실 → 복구 원장이 그 id 를 모름. 라이브 ack ≠ 내구성.');
  console.log('    클라가 보유 id 목록을 서버에 선언 → 서버가 없는 id 를 새 id 로 re-mint → item_recon_map 응답 → 클라 belief 에서 oldId→newId 교체 → 수렴. 멱등(durable mint 는 skip).');
  console.log('    xfer replay 로 이미 복원된 아이템(give 받은 것)은 reconcile 에서 skip(원래 id 보존) — mint-only 손실 아이템만 새 id 재발급.');
}

// ── wquorum: 이 step 의 가설 — 쓰기 정족수 ack(W개 ack 후 durable 선언·정합성 윈도 가시화) ──
function wquorum(seeds) {
  console.log('== wquorum: *가설* — W=3 정족수 쓰기 ack 후에만 durable 선언 ⒜ 무손실=전 seq durable(win 0) ⒝ per-link 손실=3홀더=여전 durable(win 0) ⒞ tail 정족수 미달=durableSeq 가 윈도 앞에서 멈춤(정합성 윈도 가시) → crash{primary,p4} 에 윈도만 소실·durable 프런티어는 생존 ==');
  console.log('seed   | total | ⒜durable/win | ⒝durable/win | ⒞durSeq(=T-1)/win | crash{primary,p4}: durable복구 | 윈도소실 | ack≥W | 판정');
  for (const seed of seeds) {
    const full = run(WQ_BASE(seed));                                      // 무손실 — 4 스토어 전부 ack → 전 seq durable
    const total = full.inventory.journalSeq;                             // 보낸 저널 총수(시드별)
    const perlink = run({ ...WQ_BASE(seed), transport: XREPLICALOSS(seed, QR) });   // per-link 손실 — 매 seq 3 홀더=W → 여전 durable
    const T = WTAIL_T(total);
    const tail = run({ ...WQ_BASE(seed), transport: XQUORUMLOSS(seed, T) });        // tail 정족수 미달 — seq≥T 는 2 홀더<W → 윈도
    const dFull = full.inventory.durableSeq, dPer = perlink.inventory.durableSeq, dTail = tail.inventory.durableSeq;
    const winFull = total - 1 - dFull, winPer = total - 1 - dPer, winTail = total - 1 - dTail;
    // ⒜ 무손실 → 전 seq durable(win 0).  ⒝ per-link 손실(3홀더=W) → 여전 durable(win 0) = 쓰기 정족수가 per-link 손실을 견딤.
    const fullOK = dFull === total - 1 && winFull === 0;
    const perOK = dPer === total - 1 && winPer === 0;
    // ⒞ durableSeq 가 윈도 앞(T-1)에서 멈춤 + 윈도>0 = 정합성 윈도 가시(fire-and-forget 0028 은 이 윈도를 못 봤다·§9).
    const tailWindow = dTail === T - 1 && winTail > 0;
    // crash {primary, persist4}(윈도 2홀더 사망) → 생존 {persist2(empty), persist3} = durableSet. durable 전부 복구·윈도 전부 소실.
    const reps = tail.replicaStores;   // [persist2, persist3, persist4]
    const merged = quorumMergeJournals([reps[0], reps[1]]);
    const mset = new Set(merged.journal.map(e => e.seq));
    let durableIn = true; for (let s = 0; s <= dTail; s++) if (!mset.has(s)) durableIn = false;        // durable 프런티어 전부 생존
    let windowOut = true; for (let s = dTail + 1; s <= total - 1; s++) if (mset.has(s)) windowOut = false;   // 윈도 전부 소실(2홀더 다 죽음)
    // durableSeq 의 모든 seq 가 실제 ≥W ack(워터마크 정확성 — 낙관 금지 증명)
    let acksOK = true; for (let s = 0; s <= dTail; s++) { const a = tail.inventory.ackSeqs.get(s); if (!a || a.size < QW) acksOK = false; }
    const cons = itemConserved(full) && ledgerConsistent(full) && itemDesync(full) === 0;   // 라이브 원장 건강(영속 비-침습)
    const ok =
      check(fullOK, `seed ${seed}: ⒜ 무손실인데 전 seq durable 아님(durable ${dFull}/${total - 1})`) &&
      check(perOK, `seed ${seed}: ⒝ per-link 손실(3홀더=W)인데 durable 아님(durable ${dPer}/${total - 1})`) &&
      check(tailWindow, `seed ${seed}: ⒞ durableSeq 가 윈도 앞에서 안 멈춤(durable ${dTail}·기대 ${T - 1}·win ${winTail})`) &&
      check(durableIn, `seed ${seed}: ⒞ crash 후 durable seq 복구 실패(워터마크 보장 위반)`) &&
      check(windowOut, `seed ${seed}: ⒞ crash 후 윈도 seq 가 복구됨(윈도 정의 위반)`) &&
      check(acksOK, `seed ${seed}: ⒞ durableSeq 의 seq 가 <W ack(워터마크 부정확·낙관)`) &&
      check(cons, `seed ${seed}: 라이브 원장 보존/정합/desync 깨짐`);
    console.log(`${pad(seed, 6)} | ${pad(total, 5)} | ${pad(dFull + '/' + winFull, 12)} | ${pad(dPer + '/' + winPer, 12)} | ${pad(dTail + '(' + (T - 1) + ')/' + winTail, 18)} | ${(durableIn ? '예' : '아니오').padEnd(30)} | ${(windowOut ? '예' : '아니오').padEnd(8)} | ${(acksOK ? '예' : '아니오').padEnd(5)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 쓰기 정족수: 저널이 W=3 스토어에 ack 되면 durableSeq 전진. fire-and-forget(0028)은 보내고 잊어 정합성 윈도가 안 보였다(§9) — ack 가 윈도를 워터마크 위로 정확히 드러낸다.');
  console.log('    durableSeq = *확정 durable 프런티어*: ≥W 사본 보유 → (N+1−W) 죽음 견딤. crash{primary,persist4}(윈도 2홀더 사망)에 durable 전부 복구·윈도 전부 소실 → 워터마크가 복구 프런티어를 정확히 예측. quorumW 0 면 ack 0 = 0028 비트 동일(reg 0).');
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
  console.log('== summary: PersistStore quorum *쓰기* ack — write-behind 신뢰성 체인(0023~0026)·이중쓰기(0027)·N복제 quorum-read(0028) 위에 W 정족수 쓰기 ack(durableSeq 워터마크·정합성 윈도 가시) + 멀티프로세스 E2E 비트 동일(휴면 경로) ==');
  for (const seed of seeds) {
    // E2E 동치(무손실·신뢰 ON·restart) — 멀티프로세스 = 인프로세스 비트 동일(신뢰 코드가 무손실에선 휴면).
    const a = run(RELIABLE_ON_LIVE(seed));   // 손실+신뢰 ON 라이브(NAK/재전송 계측)
    const e2eA = run(CHAT_RESTART(seed));
    const e2eB = await runMulti(CHAT_RESTART(seed));
    const C = e2eB.cluster;
    const e2eOK = logDigest(e2eA) === logDigest(e2eB) && worldDigest(e2eA) === worldDigest(e2eB) && invDigest(e2eA) === invDigest(e2eB)
      && chatDigest(e2eA) === chatDigest(e2eB) && persistDigest(e2eA) === persistDigest(e2eB) && svcMsgsToZones(e2eB) === 0;
    // 신뢰: 손실 아래 ON 복구 무손실 vs OFF 손실
    const base = run(RESTART_NOSNAP(seed)), on = run(RELIABLE_ON(seed)), off = run(RELIABLE_OFF(seed));
    const lossless = invDigest(on) === invDigest(base) && invDigest(off) !== invDigest(base) && (on.persist.writes === base.persist.writes);
    if (!e2eOK || !lossless) FAILED = true;
    console.log(`  seed ${pad(seed, 4)}: 프로세스 ${C.pids.length}개 · E2E 비트동일 ${e2eOK} · 저널홉 손실 ON 복구 ${invDigest(on) === invDigest(base) ? '무손실' : '손실'}(NAK ${on.persist.naks}·재전송 ${a.inventory.resends}) vs OFF ${invDigest(off) !== invDigest(base) ? '손실' : '무손실'}(저널 ${base.persist.writes - off.persist.writes}개 갭) | ${hex(invDigest(on))}`);
  }
  console.log('write-behind 신뢰성(0023~0026)·이중쓰기 backup(0027)·N-replica quorum-read(0028) 위에 quorum *쓰기* ack(이 step) — W 정족수 ack 후 durable 선언·durableSeq 워터마크가 정합성 윈도를 가시·유계화. 남은 §9 = 디스크 fsync·복제 anti-entropy·버스 영속·월드 영속·활성 중 다운타임 일반 재발행 후속.');
}

// ── 3차 균형 라운드(0221~0230) 승급 모드 (step-0231~ · #16 — 너비 5박스 3차 심화의 누적 회귀화) ──
//   각 모드는 자기 OPS/BASE 를 *함수 안에* 지역화(다중 승급 시 const 충돌 방지)·run/check/pad 는 키트 클로저.
//   spine = verify.js all = 현재 src 에 이 단언 전부를 매번 돌린다(생성 step 한정이던 양성 단언을 항구화).
function instanceleave(seeds) {
  const SPAWN = (at, instanceId, kind) => ({ at, op: { type: 'instanceSpawn', instanceId, kind } });
  const ROUTE = (at, player, instanceId) => ({ at, op: { type: 'instanceRoute', player, instanceId } });
  const LEAVE = (at, player) => ({ at, op: { type: 'instanceLeave', player } });
  const OPS = [SPAWN(1, 'd1', 'dungeon'), ROUTE(2, 'p1', 'd1'), ROUTE(3, 'p2', 'd1'), LEAVE(4, 'p1'), LEAVE(5, 'pX')];
  const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, instanceService: true, instanceOps: OPS };
  console.log('== instanceleave (0221 승급): 인스턴스 플레이어 이탈(instanceLeave) — 배정 player 이탈 시 route 해제·occupancy 감소·권위 release(0216 acquire 짝)·미배정은 멱등 no-op. ==');
  console.log('seed   | d1 occ | p1 route | left | misses | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 8, ...BASE });
    const inst = r.instance;
    const ok = check(inst.occupancyOf('d1') === 1 && inst.instanceOf('p1') === null && inst.instanceOf('p2') === 'd1' && inst.left === 1 && inst.leaveMisses === 1 && inst.routedCount() === 1,
      `seed ${seed}: 이탈 위반 (d1 occ ${inst.occupancyOf('d1')}·p1 ${inst.instanceOf('p1')}·left ${inst.left}·misses ${inst.leaveMisses})`);
    console.log(`${pad(seed, 6)} | ${pad(inst.occupancyOf('d1'), 6)} | ${pad(inst.instanceOf('p1') || '-', 8)} | ${pad(inst.left, 4)} | ${pad(inst.leaveMisses, 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

function instancereap(seeds) {
  const DEMAND = (at, kind, target) => ({ at, op: { type: 'instanceDemand', kind, target } });
  const ROUTE = (at, player, instanceId) => ({ at, op: { type: 'instanceRoute', player, instanceId } });
  const REAP = (at, kind, target) => ({ at, op: { type: 'instanceReap', kind, target } });
  const OPS = [DEMAND(1, 'dungeon', 4), ROUTE(2, 'p1', 'dungeon-auto-1'), REAP(3, 'dungeon', 1)];
  const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, instanceService: true, instanceOps: OPS };
  console.log('== instancereap (0222 승급): 인스턴스 수요 자동 despawn — active>target 면 빈(occupancy 0) 인스턴스를 부족분만큼 회수(탄력 축소·0215 거울)·점유 인스턴스 보호. ==');
  console.log('seed   | active | reaped | auto-1 | auto-2 | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 8, ...BASE });
    const inst = r.instance;
    const ok = check(inst.activeCount() === 1 && inst.reaped === 3 && inst.isActive('dungeon-auto-1') && !inst.isActive('dungeon-auto-2') && inst.occupancyOf('dungeon-auto-1') === 1,
      `seed ${seed}: reap 위반 (active ${inst.activeCount()}·reaped ${inst.reaped}·auto-1 ${inst.isActive('dungeon-auto-1')})`);
    console.log(`${pad(seed, 6)} | ${pad(inst.activeCount(), 6)} | ${pad(inst.reaped, 6)} | ${pad(inst.isActive('dungeon-auto-1') ? 'live' : '-', 6)} | ${pad(inst.isActive('dungeon-auto-2') ? 'live' : 'reap', 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

function placerebalance(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const REBAL = (at, hosts) => ({ at, op: { type: 'placeRebalance', hosts } });
  const OPS = [PLACE(1, 'z1', 'hostA'), PLACE(2, 'z2', 'hostA'), PLACE(3, 'z3', 'hostA'), REBAL(4, ['hostA', 'hostB', 'hostC'])];
  const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placementOps: OPS };
  console.log('== placerebalance (0223 승급): 오케 부하 재배치 자동 트리거 — 불균형(최대−최소≥2)이면 최대부하 host 존을 최소부하 host 로 자동 이주(균형 한 패스 수렴·release+acquire). ==');
  console.log('seed   | A부하 | B부하 | C부하 | moves | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 8, ...BASE });
    const o = r.orch;
    const ok = check(o.hostLoad('hostA') === 1 && o.hostLoad('hostB') === 1 && o.hostLoad('hostC') === 1 && o.rebalanceMoves === 2 && o.placementOf('z3') === 'hostA',
      `seed ${seed}: rebalance 위반 (A ${o.hostLoad('hostA')}·B ${o.hostLoad('hostB')}·C ${o.hostLoad('hostC')}·moves ${o.rebalanceMoves})`);
    console.log(`${pad(seed, 6)} | ${pad(o.hostLoad('hostA'), 5)} | ${pad(o.hostLoad('hostB'), 5)} | ${pad(o.hostLoad('hostC'), 5)} | ${pad(o.rebalanceMoves, 5)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

function placedrain(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const DRAIN = (at, host, hosts) => ({ at, op: { type: 'placeDrain', host, hosts } });
  const OPS = [PLACE(1, 'z1', 'hostA'), PLACE(2, 'z2', 'hostA'), PLACE(3, 'z3', 'hostB'), PLACE(4, 'z4', 'hostC'), DRAIN(5, 'hostA', ['hostA', 'hostB', 'hostC'])];
  const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placementOps: OPS };
  console.log('== placedrain (0224 승급): 오케 host 드레인 — 퇴역 host 의 모든 존을 나머지 최소부하로 차례 이주(release+acquire 연쇄·드레인 후 그 host 부하 0·매 존 최소부하 재계산). ==');
  console.log('seed   | A부하 | B부하 | C부하 | moves | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 8, ...BASE });
    const o = r.orch;
    const ok = check(o.hostLoad('hostA') === 0 && o.hostLoad('hostB') === 2 && o.hostLoad('hostC') === 2 && o.drainMoves === 2 && o.placementOf('z1') === 'hostB' && o.placementOf('z2') === 'hostC',
      `seed ${seed}: drain 위반 (A ${o.hostLoad('hostA')}·B ${o.hostLoad('hostB')}·C ${o.hostLoad('hostC')}·moves ${o.drainMoves})`);
    console.log(`${pad(seed, 6)} | ${pad(o.hostLoad('hostA'), 5)} | ${pad(o.hostLoad('hostB'), 5)} | ${pad(o.hostLoad('hostC'), 5)} | ${pad(o.drainMoves, 5)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

function cachecapacity(seeds) {
  const CAP = (at, cap) => ({ at, op: { type: 'cacheCapacity', cap } });
  const SET = (at, key, value) => ({ at, op: { type: 'cacheSet', key, value } });
  const OPS = [CAP(1, 2), SET(2, 'k1', 'v1'), SET(3, 'k2', 'v2'), SET(4, 'k3', 'v3')];
  const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, cacheService: true, cacheOps: OPS };
  console.log('== cachecapacity (0225 승급): 캐시 용량 LRU 회수 — 키 수 상한(cap) 초과 시 가장 오래된(setAt 최소) 키 회수(개수 유계·Redis allkeys-lru 더미). ==');
  console.log('seed   | size | k1   | k2   | k3   | evic | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 8, ...BASE });
    const c = r.cache;
    const ok = check(c.size() === 2 && !c.has('k1') && c.has('k2') && c.has('k3') && c.capEvicted === 1,
      `seed ${seed}: capacity 위반 (size ${c.size()}·k1 ${c.has('k1')}·evic ${c.capEvicted})`);
    console.log(`${pad(seed, 6)} | ${pad(c.size(), 4)} | ${pad(c.has('k1') ? 'live' : 'evic', 4)} | ${pad(c.has('k2') ? 'live' : '-', 4)} | ${pad(c.has('k3') ? 'live' : '-', 4)} | ${pad(c.capEvicted, 4)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

function cachetouch(seeds) {
  const TOUCH = (at, on) => ({ at, op: { type: 'cacheLruTouch', on } });
  const CAP = (at, cap) => ({ at, op: { type: 'cacheCapacity', cap } });
  const SET = (at, key, value) => ({ at, op: { type: 'cacheSet', key, value } });
  const GET = (at, key) => ({ at, op: { type: 'cacheGet', key } });
  const OPS = [TOUCH(1, true), CAP(2, 2), SET(3, 'k1', 'v1'), SET(4, 'k2', 'v2'), GET(5, 'k1'), SET(6, 'k3', 'v3')];
  const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, cacheService: true, cacheOps: OPS };
  console.log('== cachetouch (0226 승급): 캐시 recency touch — lruTouch ON 이면 get hit 시 recency(setAt) 갱신 → 핫 키 생존(진짜 LRU). get k1 후 k3 진입 시 k2 회수(0225 면 k1 회수). ==');
  console.log('seed   | k1   | k2   | k3   | touch | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 8, ...BASE });
    const c = r.cache;
    const ok = check(c.has('k1') && !c.has('k2') && c.has('k3') && c.touches === 1 && c.capEvicted === 1,
      `seed ${seed}: touch LRU 위반 (k1 ${c.has('k1')}·k2 ${c.has('k2')}·touches ${c.touches})`);
    console.log(`${pad(seed, 6)} | ${pad(c.has('k1') ? 'live' : 'evic', 4)} | ${pad(c.has('k2') ? 'live' : 'evic', 4)} | ${pad(c.has('k3') ? 'live' : '-', 4)} | ${pad(c.touches, 5)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

// ── CLI (step verify.js 가 위임) ──
const MODES = { reg, wquorum, rank, e2e, sacred, recover, 'recover-rank': recoverRank, 'recover-chat': recoverChat, compact, 'chat-compact': chatCompact, reliable, tail, inflight, degrade, inject, isolate, hide, repro, instanceleave, instancereap, placerebalance, placedrain, cachecapacity, cachetouch };
  const ORDER = ['reg', 'instanceleave', 'instancereap', 'placerebalance', 'placedrain', 'cachecapacity', 'cachetouch', 'wquorum', 'rank', 'e2e', 'sacred', 'recover', 'recover-rank', 'recover-chat',
                 'compact', 'chat-compact', 'reliable', 'tail', 'inflight', 'degrade', 'inject', 'isolate', 'hide', 'repro'];
  async function runAll(seedArg) {
    for (const m of ORDER) { await MODES[m](seedArg); console.log(''); }
    await summary(seedArg);
  }
  async function cli(argv) {
    const mode = argv[2] || 'all';
    const seedArg = argv[3] ? [parseInt(argv[3], 10)] : SEEDS;
    if (MODES[mode]) await MODES[mode](seedArg);
    else if (mode === 'all') await runAll(seedArg);
    else { console.log('mode: ' + ORDER.join(' | ') + ' | all'); return 2; }
    console.log('');
    console.log(FAILED ? '결과: FAIL' : '결과: ALL OK');
    return FAILED ? 1 : 0;
  }
  return { MODES, ORDER, runAll, cli, summary,
           helpers: { check, pad, hex, logDigest, worldDigest, svcMsgsToZones, ledgerSize },
           get failed() { return FAILED; } };
};
