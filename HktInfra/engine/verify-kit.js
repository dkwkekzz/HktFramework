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
//   + #16 라운드 2차 grand capstone 승급(0481~0490): mze2ecap·bare2ecap·nete2ecap·asynce2ecap·worldcap·upce2ecap·clusterdatacap·coordmergecap·coordcap · promoted16(등록 가드)
//   + #16 라운드 3차 서비스 saga capstone 재작성 편입(0491~0500): svcexchangecap·svcexchangexfer·svcmailcap·svcmailxfer·svcguildcap·svcbankcap·svcmailexpire·svcsvccombined·svcexchangecancel · promotedsvc(등록 가드)
//   + #16 라운드 4차 완전 saga liveness 손실 체제 편입(0501~0510·STATE §2 ⒜): mailsagatransient·mailsagaunacked·mailsagaabandon·mailsagaabandonpub·mailsagareadmit·mailsagareadmitpub·mailsagapermfail·mailsagafailpub·mailsaga3way · promotedsagaloss(등록 가드)
//   + #46 금고↔가방 escrow 실연동 arc(0511~0520·STATE §2 ②): guildbankdeposit·guildbankwithdraw·guildbankconserved·guildbankcrash·guildbanksaga·guildbankpending·guildbankresend·guildbanksagacons·guildbankxfer·guildbankcap
//     3차 균형 승급(0231~0240): instanceleave·instancereap·placerebalance·placedrain·cachecapacity·cachetouch·worldwb·worldfsync·loginauth·loginabandon
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
  // #16 승급 라운드 2차(0486~) — cluster child_process grand capstone 승격용 주입 deps(engine→src 결합 없이 verify.js 셸이 ctx 로 넘김).
  const { Cluster, makeClusterHostDriver, makeClusterCoordinator, runMultiViaCoord, coordAuthEquiv } = ctx;
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

function worldwb(seeds) {
  const BUF = (at, intent) => ({ at, op: { type: 'worldBuffer', intent } });
  const FLUSH = (at) => ({ at, op: { type: 'worldFlush' } });
  const OPS = [BUF(1, { e: 'e1', kind: 'move', to: 11 }), BUF(2, { e: 'e2', kind: 'move', to: 22 }), FLUSH(3), BUF(4, { e: 'e1', kind: 'pickup', item: 'gold' })];
  const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, worldLog: true, worldOps: OPS };
  console.log('== worldwb (0227 승급): 월드 영속 write-behind 버퍼 — intent 를 버퍼링 후 flush 로 durable 로그 일괄 적층(쓰기 지연·배치). 미flush 분은 비-durable(crash 윈도). ==');
  console.log('seed   | 로그 | 버퍼 | flushed | e1 gold | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 8, ...BASE });
    const w = r.worldlog;
    w.replay();
    const e1 = w.stateOf('e1');
    const gold = !!(e1 && e1.items.includes('gold'));
    const ok = check(w.length() === 2 && w.bufferLength() === 1 && w.flushed === 2 && !gold && e1 && e1.pos === 11,
      `seed ${seed}: write-behind 위반 (로그 ${w.length()}·버퍼 ${w.bufferLength()}·flushed ${w.flushed}·gold ${gold})`);
    console.log(`${pad(seed, 6)} | ${pad(w.length(), 4)} | ${pad(w.bufferLength(), 4)} | ${pad(w.flushed, 7)} | ${pad(gold ? 'yes' : 'no', 7)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

function worldfsync(seeds) {
  const APP = (at, intent) => ({ at, op: { type: 'worldAppend', intent } });
  const FSYNC = (at) => ({ at, op: { type: 'worldFsync' } });
  const OPS = [APP(1, { e: 'e1', kind: 'move', to: 1 }), APP(2, { e: 'e2', kind: 'move', to: 2 }), APP(3, { e: 'e3', kind: 'move', to: 3 }), FSYNC(4), APP(5, { e: 'e4', kind: 'move', to: 4 }), APP(6, { e: 'e5', kind: 'move', to: 5 })];
  const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, worldLog: true, worldOps: OPS };
  console.log('== worldfsync (0228 승급): 월드 영속 fsync durable barrier — durableSeq=fsync 로 디스크 확정된 최대 seq. recoverDurable 은 seq≤durableSeq 만 replay(flush=페이지캐시 vs fsync=물리 확정). ==');
  console.log('seed   | durSeq | dur복구 | full복구 | e4(미fsync) | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 8, ...BASE });
    const w = r.worldlog;
    w._replayDurable();
    const durCount = ['e1', 'e2', 'e3', 'e4', 'e5'].filter(e => w.stateOf(e)).length;
    const e4durable = !!w.stateOf('e4');
    w.replay();
    const fullCount = ['e1', 'e2', 'e3', 'e4', 'e5'].filter(e => w.stateOf(e)).length;
    const ok = check(w.durableSeq === 3 && durCount === 3 && !e4durable && fullCount === 5,
      `seed ${seed}: fsync 위반 (durSeq ${w.durableSeq}·dur ${durCount}·full ${fullCount}·e4 ${e4durable})`);
    console.log(`${pad(seed, 6)} | ${pad(w.durableSeq, 6)} | ${pad(durCount, 7)} | ${pad(fullCount, 8)} | ${pad(e4durable ? 'durable' : 'lost', 11)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

function loginauth(seeds) {
  const AUTH = (at, player) => ({ at, op: { type: 'loginAuth', player } });
  const OPS = [AUTH(2, 'p1'), AUTH(3, 'p2'), AUTH(4, 'pX')];
  const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, loginQueue: true, loginAccounts: ['p1', 'p2'], loginOps: OPS };
  console.log('== loginauth (0229 승급): 로그인 계정 검증 — 유효 계정(validAccounts)만 enqueue(검증→줄 세움·미인증→거부·줄 이전 차단). 0001 LoginServer 검증의 엣지 큐 실체화. ==');
  console.log('seed   | 큐 | authed | rejects | pX pos | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 8, ...BASE });
    const q = r.loginqueue;
    const ok = check(q.queueLength() === 2 && q.authed === 2 && q.authRejects === 1 && q.positionOf('p1') === 0 && q.positionOf('pX') === -1,
      `seed ${seed}: 계정검증 위반 (큐 ${q.queueLength()}·authed ${q.authed}·rejects ${q.authRejects})`);
    console.log(`${pad(seed, 6)} | ${pad(q.queueLength(), 2)} | ${pad(q.authed, 6)} | ${pad(q.authRejects, 7)} | ${pad(q.positionOf('pX'), 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

function loginabandon(seeds) {
  const ENQ = (at, player) => ({ at, op: { type: 'loginEnqueue', player } });
  const ABANDON = (at, player) => ({ at, op: { type: 'loginAbandon', player } });
  const OPS = [ENQ(1, 'p1'), ENQ(2, 'p2'), ENQ(3, 'p3'), ABANDON(4, 'p2'), ABANDON(5, 'pX')];
  const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, loginQueue: true, loginOps: OPS };
  console.log('== loginabandon (0230 승급): 로그인 큐 이탈 — 입장 전 player 가 줄 떠남(대기열서 제거). 미줄/이미입장 player 는 멱등 no-op. 좀비 슬롯 회수로 큐 길이 정확(0219 백프레셔). ==');
  console.log('seed   | 큐 | p2 pos | p3 pos | aband | miss | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 8, ...BASE });
    const q = r.loginqueue;
    const ok = check(q.queueLength() === 2 && q.positionOf('p2') === -1 && q.positionOf('p1') === 0 && q.positionOf('p3') === 1 && q.abandoned === 1 && q.abandonMisses === 1,
      `seed ${seed}: 이탈 위반 (큐 ${q.queueLength()}·p2 ${q.positionOf('p2')}·aband ${q.abandoned}·miss ${q.abandonMisses})`);
    console.log(`${pad(seed, 6)} | ${pad(q.queueLength(), 2)} | ${pad(q.positionOf('p2'), 6)} | ${pad(q.positionOf('p3'), 6)} | ${pad(q.abandoned, 5)} | ${pad(q.abandonMisses, 4)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

// ── 시대별 grand capstone 승급 (#16 라운드 2차·0481~) ──
//   각 시대 arc 의 grand capstone 을 누적 회귀로 승격 — 옛 bespoke 검증(그 step 의 verify.js·git per-commit)이
//   HEAD 재검증 불가였던 격차("수치=verify 출력" 실효 깨짐)를 해소한다. 박스 코드 무수정(reg 0 자명).
// step-0470 #4 완전 async 10·grand capstone — mze2ecap: 다중 존 이주 하 유계 resync E2E(world/뷰==lockstep·exactly-once·유계).
function mze2ecap(seeds) {
  console.log('== mze2ecap (0470·#4 grand capstone): 다중 존 loss+delay+핸드오프 — world==lockstep·exactly-once·다운스트림 desync0·유계 resync. ==');
  console.log('seed   | world | exactly-once | 뷰수렴 | 유계(span<H·across0) | handoffs | 판정');
  for (const seed of seeds) {
    const b = { seed, ticks: 70, clients: 6, moves: 30, radius: 4, grid: 24, incremental: true, zones: 2 };
    const off = run({ ...b });
    const on = run({ ...b, asyncBarrier: { loss: 0.2, delay: 0.3, delayMax: 3, resync: true, resyncDelay: 2, seed, ticks: 70 } });
    const st = on.asyncBarrier || {};
    const world = worldDigest(off) === worldDigest(on);
    const once = st.moveDup === 0 && st.lost === 0 && st.pendingAtEnd === 0 && st.moveDeliv > 0;
    const view = off.clients.map(c => c.seenSig()).every((s, i) => s === on.clients[i].seenSig());
    const bounded = st.maxSpan < st.horizon && st.deferredAcrossHandoff === 0 && st.deferN > 0;
    const migrated = off.totals.handoffs > 0 && st.handoffsObs > 0;
    const ok = check(world && once && view && bounded && migrated, `seed ${seed}: w${world}·once${once}·view${view}·bnd${bounded}·mig${migrated}`);
    console.log(`${pad(seed, 6)} | ${pad(world ? 'Y' : 'N', 5)} | ${pad(once ? 'Y' : 'N', 12)} | ${pad(view ? 'Y' : 'N', 6)} | ${pad('span' + st.maxSpan + '<' + st.horizon + '·a' + st.deferredAcrossHandoff, 20)} | ${pad(off.totals.handoffs, 8)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

// step-0460 #4 실 치환 10·grand capstone — bare2ecap: run() 배리어 치환 E2E(손실+지연 world/뷰==lockstep·exactly-once·다중 존 투명).
function bare2ecap(seeds) {
  console.log('== bare2ecap (0460·#4 grand capstone): run() net.step 배리어 치환 — 손실+지연 world/뷰==lockstep·exactly-once·다중 존 투명. ==');
  console.log('seed   | 단일존 world/뷰 | exactly-once | resync·delay | 다중존 world/log | 판정');
  for (const seed of seeds) {
    const b1 = { seed, ticks: 48, clients: 4, moves: 30, radius: 4, grid: 16, incremental: true, zones: 1 };
    const off1 = run({ ...b1 });
    const on1 = run({ ...b1, asyncBarrier: { loss: 0.2, delay: 0.3, delayMax: 3, resync: true, resyncDelay: 2, seed, ticks: 48 } });
    const sig = r => r.clients.map(c => c.seenSig()).join('|');
    const wv1 = worldDigest(off1) === worldDigest(on1) && sig(off1) === sig(on1);
    const st = on1.asyncBarrier || { moveDup: 0, resyncs: 0, delayed: 0 };
    const once = st.moveDup === 0;
    const pert = st.resyncs > 0 && st.delayed > 0;
    const b2 = { seed, ticks: 70, clients: 6, moves: 30, radius: 4, grid: 16, incremental: true, zones: 2 };
    const off2 = run({ ...b2 });
    const on2 = run({ ...b2, asyncBarrier: true });
    const mz = worldDigest(off2) === worldDigest(on2) && logDigest(off2) === logDigest(on2) && off2.totals.handoffs > 0;
    const ok = check(wv1 && once && pert && mz, `seed ${seed}: 단일 ${wv1}·once ${once}·pert r${st.resyncs}/d${st.delayed}·다중 ${mz}`);
    console.log(`${pad(seed, 6)} | ${pad(wv1 ? 'Y' : 'N', 14)} | ${pad(once ? 'Y' : 'N', 12)} | ${pad('r' + st.resyncs + '·d' + st.delayed, 12)} | ${pad(mz ? 'Y' : 'N', 16)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

// step-0450 #4 10·grand capstone — nete2ecap: 실 engine Net 배리어==배리어-free substrate==canonical·전복제 desync0·exactly-once·sound·lossy.
function nete2ecap(seeds) {
  console.log('== nete2ecap (0450·#4 grand capstone): 실 배리어==substrate==canonical·전복제 desync0·exactly-once·sound·배리어-free·lossy. ==');
  console.log('seed   | 이벤트 | 배리어등가 | 전복제desync0 | exactly-once | sound | skew | lossy | 판정');
  for (const seed of seeds) {
    const C = 4, M = 3, MS = 40;
    const s = NET.worldIntentStream(seed, { clients: C, avatars: 4, msgs: MS });
    const events = NET.withSseq(s.events);
    const canonical = NET.simFold(NET.totalOrder(events), seed, s.avatars).digest;
    const sound = NET.totalOrderSound(events, s.edges);
    const L = NET.runLockstepEngine(s.events, seed, s.avatars, C);
    const barrierEq = L.totalDigest === canonical && L.delivered === MS;
    const cap = NET.capstoneReplicas(events, M, seed, s.avatars, C);
    const allConv = cap.reps.every(r => r.digest === canonical);
    const allComplete = cap.reps.every(r => r.complete);
    const lossy = cap.reps.some(r => r.resyncs > 0);
    const skew = cap.skew;
    const ok = check(barrierEq && allConv && allComplete && sound.strict && sound.causal && skew > 0 && lossy,
      `seed ${seed}: barrier ${barrierEq}·conv ${allConv}·once ${allComplete}·sound ${sound.strict && sound.causal}·skew ${skew}·lossy ${lossy}`);
    console.log(`${pad(seed, 6)} | ${pad(MS, 6)} | ${pad(barrierEq ? 'Y' : 'N', 10)} | ${pad(allConv ? 'Y' : 'N', 13)} | ${pad(allComplete ? 'Y' : 'N', 12)} | ${pad(sound.causal ? 'Y' : 'N', 5)} | ${pad(skew, 4)} | ${pad(lossy ? 'Y' : 'N', 5)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

// step-0440 #4 10·grand capstone — asynce2ecap: M 복제 순열+손실→전 복제 desync0·exactly-once·clock0·sound·lossy. (지역 helper: siteOf/shuffle/arrivalFor/replica)
function asynce2ecap(seeds) {
  const siteOf = e => (typeof e.site === 'number' ? e.site : parseInt(String(e.site).replace(/^s/, ''), 10));
  const shuffle = (arr, rnd) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rnd() % (i + 1); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
  const arrivalFor = (events, nsites, rnd) => {
    const queues = Array.from({ length: nsites }, () => []);
    for (const e of events) queues[siteOf(e)].push(e);
    const out = []; let rem = events.length;
    while (rem > 0) { let s = rnd() % nsites; for (let k = 0; k < nsites && queues[s].length === 0; k++) s = (s + 1) % nsites; out.push(queues[s].shift()); rem--; }
    return out;
  };
  const replica = (events, N, rnd) => {
    const site = NET.makeResyncSite(N); const dropped = [];
    for (const e of arrivalFor(events, N, rnd)) { if (rnd() % 5 === 0) dropped.push(e); else site.receive(e); }
    for (const e of shuffle(dropped, rnd)) site.resync(e);
    return { delivered: site.finish(), resyncs: site.resyncs() };
  };
  console.log('== asynce2ecap (0440·#4 grand capstone): M 복제 순열+손실→전 복제 desync0·exactly-once·clock0·인과 존중. ==');
  console.log('seed   | 이벤트 | clock위반 | 전복제수렴 | 인과존중 | exactly-once | 손실 | 판정');
  for (const seed of seeds) {
    const N = 4, M = 3;
    const base = NET.lamportExchange(seed, { sites: N, rounds: 56 });
    const events = NET.withSseq(base.events);
    const canonical = NET.applyDigest(NET.totalOrder(events));
    const clockViol = NET.clockConditionViolations(base.events, base.edges);
    const sound = NET.totalOrderSound(events, base.edges);
    let allConv = true, allComplete = true, lossy = true;
    for (let m = 0; m < M; m++) {
      const r = replica(events, N, NET.mulberry32((seed ^ (0x4000 + m * 97)) >>> 0));
      if (NET.applyDigest(r.delivered) !== canonical) allConv = false;
      if (!NET.accountDelivered(r.delivered, events).complete) allComplete = false;
      if (r.resyncs === 0) lossy = false;
    }
    const ok = check(clockViol === 0 && allConv && sound.strict && sound.causal && allComplete && lossy,
      `seed ${seed}: clock ${clockViol}·conv ${allConv}·sound ${sound.strict && sound.causal}·complete ${allComplete}·lossy ${lossy}`);
    console.log(`${pad(seed, 6)} | ${pad(events.length, 6)} | ${pad(clockViol, 9)} | ${pad(allConv ? 'Y' : 'N', 10)} | ${pad(sound.causal ? 'Y' : 'N', 8)} | ${pad(allComplete ? 'Y' : 'N', 12)} | ${pad(lossy ? 'Y' : 'N', 4)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

// step-0350 #9 후속 grand capstone — worldcap: 월드 다운스트림 E2E(host AOI→포착→전파→실 DownClient 수렴 desync0·게이트웨이 격리). SPINE §4 경로2.
function worldcap(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const ENTER = (at, zoneId, avatar, from) => ({ at, from, op: { type: 'zoneEnter', zoneId, avatar } });
  const MOVE = (at, zoneId, avatar, dx, dy, from) => ({ at, from, op: { type: 'zoneMove', zoneId, avatar, dx, dy } });
  const MIG = (at, zoneId, toHost) => ({ at, op: { type: 'placeMigrate', zoneId, toHost } });
  const OPS = [PLACE(1, 'z1', 'hostA'), PLACE(2, 'z2', 'hostC'), MIG(18, 'z1', 'hostB')];
  const ENT = [ENTER(3, 'z1', 'a1', 'dc0'), ENTER(5, 'z2', 'b1', 'dc2')];
  for (let k = 0; k < 8; k++) ENT.push(MOVE(6 + k, 'z1', 'a1', 1, 1, 'dc0'));
  ENT.push(ENTER(15, 'z1', 'a2', 'dc1'));
  ENT.push(MOVE(16, 'z2', 'b1', 1, 0, 'dc2'));
  const BASE = { clients: 6, moves: 24, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneEntityFlow: true, zoneHostHandle: true, zoneHostMailbox: true, gatewayZoneDir: true, gatewayDirectZone: true, zoneHostProc: true, zoneEgress: true, downClients: 3, egressDrop: ['s:a1#2'], egressTimeout: 4 };
  console.log('== worldcap (0350·#9 후속 grand capstone): 월드 다운스트림 E2E. worldCoherent·dc0·dc1·dc2 수렴·iso. ==');
  console.log('seed   | world | dc0 | dc1 | dc2 | iso | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 30, ...BASE, placementOps: OPS, entityOps: ENT });
    const o = r.orch, g = r.gateway;
    const world = o.downstreamWorldCoherent();
    const c0 = r.downclients[0].convergedTo(o.zoneAuthSig('z1', 'a1'));
    const c1 = r.downclients[1].convergedTo(o.zoneAuthSig('z1', 'a2'));
    const c2 = r.downclients[2].convergedTo(o.zoneAuthSig('z2', 'b1'));
    const iso = g.gatewayDeliveryIsolated();
    const ok = check(world && c0 && c1 && c2 && iso, `seed ${seed}: world ${world} c ${c0}/${c1}/${c2} iso ${iso}`);
    console.log(`${pad(seed, 6)} | ${pad(world ? 'Y' : 'N', 5)} | ${pad(c0 ? 'Y' : 'N', 3)} | ${pad(c1 ? 'Y' : 'N', 3)} | ${pad(c2 ? 'Y' : 'N', 3)} | ${pad(iso ? 'Y' : 'N', 3)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

// step-0480 #70 grand capstone — upce2ecap: 실 UpClient E2E 경계(수렴·exactly-once·회계·생애주기). (cluster child_process — ctx dep Cluster/makeClusterHostDriver 주입)
async function upce2ecap(seeds) {
  const GRID = 16;
  const zoneSpecOf = (addr, seed) => ({ addr, kind: 'zone', seed, opts: { region: { lo: 0, hi: GRID }, sibling: null, boundary: GRID, grid: GRID, radius: 4 } });
  const withCluster = async (hosts, wire, fn) => {
    const cluster = new Cluster(hosts, wire);
    await cluster.spawn();
    try { return await fn(cluster); } finally { for (const h of hosts.slice()) { try { await cluster.killHost(h); } catch {} } }
  };
  const tickUp = (uc, t) => { const cap = []; uc.net = { send: (f, to, p) => cap.push(p) }; uc.onTick(t); return cap; };
  console.log('== upce2ecap (0480·#70 grand capstone): 실 UpClient E2E 경계 — 수렴·exactly-once(손실)·회계·생애주기(leave). ==');
  console.log('seed   | uc0 수렴 | 회계 | exactly-once(dup) | uc1 leave 제거 | 판정');
  for (const seed of seeds) {
    await withCluster(['hostA'], { drop: 0.25, dropSeed: (seed ^ 0x7EE5) >>> 0 }, async (cluster) => {
      await cluster.init(new Map([['hostA', [zoneSpecOf('zone1', seed), zoneSpecOf('zone2', seed)]]]));
      const drv = makeClusterHostDriver();
      const uc0 = new NET.UpClient({ avatar: 'a1', zoneId: 'zone1', joinAt: 1, plan: [[2, 1], [3, 0], [-1, 2]] });
      for (const op of tickUp(uc0, 1)) await drv.deliverIntent(cluster, 'hostA', op);
      drv.feedViews(await drv.tickZone(cluster, 'hostA', 'zone1', 1), uc0);
      const e0 = await drv.zoneEntity(cluster, 'hostA', 'zone1', 'a1');
      for (let t = 2; t <= 5; t++) { for (const op of tickUp(uc0, t)) await drv.deliverIntent(cluster, 'hostA', op); drv.feedViews(await drv.tickZone(cluster, 'hostA', 'zone1', t), uc0); }
      const authA = await drv.upstreamAuthSig(cluster, 'hostA', 'zone1');
      const converged = uc0.seenSig() === authA && authA !== '';
      const d = uc0.intentDelta();
      const exp = { x: ((e0.x + d.dx) % GRID + GRID) % GRID, y: ((e0.y + d.dy) % GRID + GRID) % GRID };
      const fin = await drv.zoneEntity(cluster, 'hostA', 'zone1', 'a1');
      const accounted = fin && fin.x === exp.x && fin.y === exp.y;
      const uc1 = new NET.UpClient({ avatar: 'b1', zoneId: 'zone2', joinAt: 1, plan: [[1, 1]], leaveAt: 3 });
      await drv.driveUpstream(cluster, [uc1], 4, () => 'hostA');
      const removed = (await drv.zoneEntity(cluster, 'hostA', 'zone2', 'b1')) === null;
      const once = cluster.resends > 0 && converged && accounted;
      const pass = check(converged && accounted && once && removed, `seed ${seed}: conv${converged}·acct${accounted}·resend${cluster.resends}·removed${removed}`);
      console.log(`${pad(seed, 6)} | ${pad(converged ? 'Y' : 'N', 8)} | ${pad(accounted ? 'Y' : 'N', 4)} | ${pad('Y(rs' + cluster.resends + '·dup' + cluster.dupCmds + ')', 17)} | ${pad(removed ? 'Y' : 'N', 14)} | ${pass ? 'OK' : 'FAIL'}`);
    });
  }
}

// step-0370 #57 grand capstone — clusterdatacap: 실 데이터 평면 E2E(driveCluster→coherent·실 migrate z1 A→B 상태 보존·hostA release). (cluster child_process — ctx dep Cluster)
async function clusterdatacap(seeds) {
  const zoneSpecOf = (zone) => ({ addr: zone, kind: 'zone', seed: fnv1a(String(zone)) >>> 0, opts: { grid: 16, radius: 4, region: { lo: 0, hi: 16 }, sibling: null, boundary: 16, orch: null, incremental: true } });
  const realPos = (snap, zone, id) => { const z = snap && snap.snap ? snap.snap[zone] : null; const e = z && z.ents ? z.ents.find(([x]) => x === id) : null; return e ? e[1] : null; };
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const ENTER = (at, zoneId, avatar, from) => ({ at, from, op: { type: 'zoneEnter', zoneId, avatar } });
  const MOVE = (at, zoneId, avatar, dx, dy, from) => ({ at, from, op: { type: 'zoneMove', zoneId, avatar, dx, dy } });
  const OPS = [PLACE(1, 'z1', 'hostA'), PLACE(2, 'z2', 'hostB'), PLACE(3, 'z3', 'hostA')];
  const ENT = [ENTER(3, 'z1', 'a1', 'dc0'), ENTER(3, 'z2', 'b1', 'dc1')];
  for (let k = 0; k < 3; k++) { ENT.push(MOVE(4 + k, 'z1', 'a1', 1, 1, 'dc0')); ENT.push(MOVE(4 + k, 'z2', 'b1', 1, 0, 'dc1')); }
  const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneEntityFlow: true, zoneHostHandle: true, zoneHostProc: true, gatewayZoneDir: true, gatewayDirectZone: true, clusterDriverReal: true, placementOps: OPS, entityOps: ENT };
  console.log('== clusterdatacap (0370·#57 grand capstone): 실 데이터 평면 E2E — coherent + 실 migrate 상태 보존. ==');
  console.log('seed   | coherent | mig a1 보존 | hostA release | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 12, ...BASE });
    const o = r.orch, drv = o.clusterDriver;
    const cluster = new Cluster([]);
    let coherent = false, migOk = false, released = false;
    try {
      await cluster.spawn();
      await drv.driveCluster(o, cluster, zoneSpecOf, 1);
      coherent = await drv.clusterCoherent(o, cluster);
      const a1Auth = o.zoneEntityPos('z1', 'a1');
      await drv.migrateZone(cluster, 'z1', 'hostA', 'hostB', zoneSpecOf);
      const a1B = realPos(await cluster.rpc('hostB', { cmd: 'snapshot' }), 'z1', 'a1');
      const sa = await cluster.rpc('hostA', { cmd: 'snapshot' });
      migOk = a1B && a1Auth && a1B.x === a1Auth.x && a1B.y === a1Auth.y;
      released = !(sa && sa.snap && sa.snap['z1']);
    } finally { await cluster.shutdown(); }
    const ok = check(coherent && migOk && released, `seed ${seed}: capstone 위반 (coh ${coherent}·mig ${migOk}·rel ${released})`);
    console.log(`${pad(seed, 6)} | ${pad(coherent ? 'Y' : 'N', 8)} | ${pad(migOk ? 'Y' : 'N', 11)} | ${pad(released ? 'Y' : 'N', 13)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

// 공유 시나리오 빌더 — 2 host·3 zone(z1@A·z2@B·z3@A)·entity a1@z1·b1@z2 + move. #62 코디네이터 arc capstone 공통(coordmergecap·coordcap).
function coordScenario() {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const ENTER = (at, zoneId, avatar, from) => ({ at, from, op: { type: 'zoneEnter', zoneId, avatar } });
  const MOVE = (at, zoneId, avatar, dx, dy, from) => ({ at, from, op: { type: 'zoneMove', zoneId, avatar, dx, dy } });
  const OPS = [PLACE(1, 'z1', 'hostA'), PLACE(2, 'z2', 'hostB'), PLACE(3, 'z3', 'hostA')];
  const ENT = [ENTER(3, 'z1', 'a1', 'dc0'), ENTER(3, 'z2', 'b1', 'dc1')];
  for (let k = 0; k < 3; k++) { ENT.push(MOVE(4 + k, 'z1', 'a1', 1, 1, 'dc0')); ENT.push(MOVE(4 + k, 'z2', 'b1', 1, 0, 'dc1')); }
  return { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneEntityFlow: true, zoneHostHandle: true, zoneHostProc: true, gatewayZoneDir: true, gatewayDirectZone: true, clusterDriverReal: true, placementOps: OPS, entityOps: ENT };
}

// step-0420 #62 코드 합류 grand capstone — coordmergecap: 단일 진입점 종합 warm-failover(migrate+reprovision+kill+promote) → runMultiCoherent·mig1·reprov1·promo1·a1 보존·parity. (cluster child_process — ctx dep runMultiViaCoord/coordAuthEquiv)
async function coordmergecap(seeds) {
  const zoneSpecOf = (zone) => ({ addr: zone, kind: 'zone', seed: fnv1a(String(zone)) >>> 0, opts: { grid: 16, radius: 4, region: { lo: 0, hi: 16 }, sibling: null, boundary: 16, orch: null, incremental: true } });
  const RUNMULTI_KEYS = ['livePids', 'hostIds', 'placement', 'epoch', 'presumedDead', 'migrations', 'reprovisions', 'promotions', 'pids', 'parentPid', 'port', 'ipcMsgs', 'ipcBytes', 'allSerializable', 'wire'];
  console.log('== coordmergecap (0420·#62 코드 합류 grand capstone): 단일 진입점 종합 warm-failover(migrate+reprovision+kill+promote) → runMultiCoherent·mig1·reprov1·promo1·a1 보존·parity. ==');
  console.log('seed   | coherent | mig | reprov | promo | a1 보존 | parity | 판정');
  const spec = {
    migrate: { zone: 'z3', from: 'hostA', to: 'hostB', at: 2 },
    reprovision: { zone: 'z1', host: 'hostA_s', at: 3 },
    kill: { host: 'hostA', at: 4 }, promote: { zone: 'z1', at: 4 },
  };
  for (const seed of seeds) {
    const res = await runMultiViaCoord(
      { seed, ticks: 12, coordTicks: 6, coordSc: spec, ...coordScenario() },
      { run, zoneSpecOf },
      async (coord, cluster) => coordAuthEquiv(coord, cluster, [['z1', 'a1']]));
    const info = res.info, eq = res.probe;
    const preserved = eq.match === eq.total;
    const parity = RUNMULTI_KEYS.every(k => k in info);
    const ok = check(res.coherent && info.migrations === 1 && info.reprovisions === 1 && info.promotions === 1 && preserved && parity,
      `seed ${seed}: capstone 위반 (coherent ${res.coherent}·mig ${info.migrations}·reprov ${info.reprovisions}·promo ${info.promotions}·a1 ${eq.match}/${eq.total}·parity ${parity})`);
    console.log(`${pad(seed, 6)} | ${pad(res.coherent ? 'Y' : 'N', 8)} | ${pad(info.migrations, 3)} | ${pad(info.reprovisions, 6)} | ${pad(info.promotions, 5)} | ${pad(preserved ? 'Y' : 'N', 7)} | ${pad(parity ? 'Y' : 'N', 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

// step-0380 #62 통합 grand capstone — coordcap: broker 측 제어 평면 E2E(start→연속 run→z3 drift→syncPlan 치유 뒤에도 실 cluster==in-proc 권위). (cluster child_process — ctx dep Cluster/makeClusterCoordinator)
async function coordcap(seeds) {
  const zoneSpecOf = (zone) => ({ addr: zone, kind: 'zone', seed: fnv1a(String(zone)) >>> 0, opts: { grid: 16, radius: 4, region: { lo: 0, hi: 16 }, sibling: null, boundary: 16, orch: null, incremental: true } });
  const BASE = coordScenario();
  console.log('== coordcap (0380·#62 grand capstone): broker 측 제어 평면 E2E — run+drift+syncPlan 뒤 coordCoherent. ==');
  console.log('seed   | maxDesync | drift heal | coordCoherent | report coh | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 12, ...BASE });
    const o = r.orch, drv = o.clusterDriver;
    const cluster = new Cluster([]);
    let maxD = -1, healed = false, coh = false, repCoh = false;
    try {
      await cluster.spawn();
      const coord = makeClusterCoordinator(o, cluster, zoneSpecOf, drv);
      await coord.run(5);
      maxD = coord.maxDesync;
      await cluster.rpc('hostA', { cmd: 'zonedel', addr: 'z3' });
      await coord.syncPlan();
      const sa = await cluster.rpc('hostA', { cmd: 'snapshot' });
      healed = !!(sa && sa.snap && sa.snap['z3']);
      coh = await coord.coordCoherent();
      repCoh = (await coord.report()).coherent;
    } finally { await cluster.shutdown(); }
    const ok = check(maxD === 0 && healed && coh && repCoh, `seed ${seed}: capstone 위반 (maxD ${maxD}·heal ${healed}·coh ${coh}·rep ${repCoh})`);
    console.log(`${pad(seed, 6)} | ${pad(maxD, 9)} | ${pad(healed ? 'Y' : 'N', 10)} | ${pad(coh ? 'Y' : 'N', 13)} | ${pad(repCoh ? 'Y' : 'N', 10)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

// step-0490 #16 라운드 2차 정리 — promoted16: 시대별 grand capstone 9종이 ORDER 누적 회귀에 항구 등록됐는지 가드(향후 우발 제거 방지·"no silent cap"·arc 닫기).
function promoted16(seeds) {
  const PROMOTED = ['mze2ecap', 'bare2ecap', 'nete2ecap', 'asynce2ecap', 'worldcap', 'upce2ecap', 'clusterdatacap', 'coordmergecap', 'coordcap'];
  console.log('== promoted16 (0490·#16 라운드 2차 정리): 시대별 grand capstone 9종 ORDER/MODES 항구 등록 가드 — 향후 제거 방지. #16 라운드 2차 arc 닫기. ==');
  console.log('capstone       | ORDER | MODES | 판정');
  for (const m of PROMOTED) {
    const inOrder = ORDER.includes(m);
    const inModes = typeof MODES[m] === 'function';
    const ok = check(inOrder && inModes, `${m}: order ${inOrder}·modes ${inModes}`);
    console.log(`${m.padEnd(14)} | ${pad(inOrder ? 'Y' : 'N', 5)} | ${pad(inModes ? 'Y' : 'N', 5)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  check(PROMOTED.every(m => ORDER.includes(m) && typeof MODES[m] === 'function'), `promoted16: grand capstone 9종 전부 등록`);
}

// ── #16 승급 라운드 3차: 서비스 saga capstone 재작성 편입 (0491~·감사 §2 ①-b) ──
//   grand capstone(0481~0490)이 월드/async/cluster 를 항구화한 뒤, 이 라운드는 *서비스 계층*(거래소·우편·길드)의
//   실행 검증을 verify-kit ORDER 로 편입한다 — 옛 capstone 코드가 git 에 없어(단일 src 전환·history 소실) *재작성*이다.
//   각 capstone 은 run() 을 서비스 opts(exchange/mail/guild + saga)로 구동하고 노출된 정합 술어를 단언한다. 박스 무수정→reg 0.
// step-0491 재작성 — svcexchangecap: 거래소↔가방 saga 정합(0140 sagaLiveConsistent 판). list+buy escrow→가방 give→saga 회신 drain·회계 닫힘.
function svcexchangecap(seeds) {
  console.log('== svcexchangecap (0491·서비스 재작성): 거래소↔가방 saga — list+buy escrow give→회신 drain·sagaLiveConsistent(pending 3분할+회계 닫힘). ==');
  console.log('seed   | gives | acked | oks | pending | sagaLive | 판정');
  for (const seed of seeds) {
    const r = run({
      seed, ticks: 14, clients: 2, moves: 4, radius: 4, grid: 16, zones: 2,
      bus: true, inventory: true, exchange: true, exchInventory: true, exchSaga: true,
      invOps: [{ at: 1, op: { type: 'item_req', op: 'pickup', avatar: 'seller', reqId: 'r0' } }],
      exchangeOps: [
        { at: 3, op: { type: 'exchList', seller: 'seller', item: 'sword', price: 10, itemId: 'item0' } },
        { at: 7, op: { type: 'exchBuy', id: 1, buyer: 'buyer' } },
      ],
    });
    const e = r.exchange;
    const drained = e.pending.size === 0 && e.gives === 2 && e.ackedGives === 2 && e.giveOks === 2;
    const live = e.sagaLiveConsistent() && e.sagaConsistent();
    const moved = r.inventory.ownerOf('item0') === 'buyer';   // 아이템이 seller→escrow→buyer 실물 이동
    const ok = check(drained && live && moved, `seed ${seed}: drain${drained}·live${live}·moved${moved}(gives${e.gives}·pend${e.pending.size})`);
    console.log(`${pad(seed, 6)} | ${pad(e.gives, 5)} | ${pad(e.ackedGives, 5)} | ${pad(e.giveOks, 3)} | ${pad(e.pending.size, 7)} | ${pad(live ? 'Y' : 'N', 8)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

// step-0492 재작성 — svcexchangexfer: 거래소↔가방 2-서비스 교차 회계(0130 판). 거래소 giveOks == 가방 escrowXfers(두 서비스 escrow 회계 합치)·아이템 무손실 보존.
function svcexchangexfer(seeds) {
  console.log('== svcexchangexfer (0492·서비스 재작성): 거래소↔가방 2-서비스 교차 회계 — 거래소 giveOks == 가방 escrowXfers·아이템 단일 소유 보존. ==');
  console.log('seed   | giveOks | escrowXfers | minted | 보존 | 판정');
  for (const seed of seeds) {
    const r = run({
      seed, ticks: 14, clients: 2, moves: 4, radius: 4, grid: 16, zones: 2,
      bus: true, inventory: true, exchange: true, exchInventory: true, exchSaga: true,
      invOps: [{ at: 1, op: { type: 'item_req', op: 'pickup', avatar: 'seller', reqId: 'r0' } }],
      exchangeOps: [
        { at: 3, op: { type: 'exchList', seller: 'seller', item: 'sword', price: 10, itemId: 'item0' } },
        { at: 7, op: { type: 'exchBuy', id: 1, buyer: 'buyer' } },
      ],
    });
    const e = r.exchange, inv = r.inventory;
    const cross = e.giveOks === inv.escrowXfers && e.giveOks === 2;         // 두 서비스 escrow 회계 합치
    const conserved = inv.minted === 1 && inv.ownerOf('item0') === 'buyer';  // 아이템 무손실·단일 소유(dupe 0)
    const ok = check(cross && conserved, `seed ${seed}: cross${cross}(oks${e.giveOks}==xfer${inv.escrowXfers})·conserved${conserved}`);
    console.log(`${pad(seed, 6)} | ${pad(e.giveOks, 7)} | ${pad(inv.escrowXfers, 11)} | ${pad(inv.minted, 6)} | ${pad(conserved ? 'Y' : 'N', 4)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

// step-0493 재작성 — svcmailcap: 아이템 첨부 우편↔가방 saga 정합(0170 sagaLiveConsistent 판). mailSend(첨부·escrow 인출)→mailFetch(입금)·네 회계층 동시 닫힘.
function svcmailcap(seeds) {
  console.log('== svcmailcap (0493·서비스 재작성): 아이템 우편↔가방 saga — mailC+itemC+escrowC+sagaC 동시 닫힘(sagaLiveConsistent). ==');
  console.log('seed   | sent | itemFetched | gives | oks | sagaLive | 판정');
  for (const seed of seeds) {
    const r = run({
      seed, ticks: 16, clients: 2, moves: 4, radius: 4, grid: 16, zones: 2,
      bus: true, inventory: true, mail: true, mailItem: true, mailInv: true, mailSaga: true,
      invOps: [{ at: 1, op: { type: 'item_req', op: 'pickup', avatar: 'alice', reqId: 'r0' } }],
      mailOps: [
        { at: 3, op: { type: 'mailSend', from: 'alice', to: 'bob', body: 'gift', item: 'item0' } },
        { at: 9, op: { type: 'mailFetch', to: 'bob' } },
      ],
    });
    const m = r.mail;
    const live = m.sagaLiveConsistent() && m.mailConsistent() && m.itemConsistent() && m.escrowConsistent() && m.sagaConsistent();
    const acked = m.gives === 2 && m.ackedGives === 2 && m.giveOks === 2 && m.pending.size === 0;
    const moved = r.inventory.ownerOf('item0') === 'bob' && r.inventory.escrowXfers === 2;   // 아이템 alice→escrow→bob
    const ok = check(live && acked && moved, `seed ${seed}: live${live}·acked${acked}·moved${moved}(gives${m.gives})`);
    console.log(`${pad(seed, 6)} | ${pad(m.sent, 4)} | ${pad(m.itemFetched, 11)} | ${pad(m.gives, 5)} | ${pad(m.giveOks, 3)} | ${pad(live ? 'Y' : 'N', 8)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

// step-0494 재작성 — svcmailxfer: 우편↔가방 2-서비스 교차 회계 + saga liveness(0164/0180 판). mail giveOks==가방 escrowXfers·sagaLivenessConsistent(pending 3분할).
function svcmailxfer(seeds) {
  console.log('== svcmailxfer (0494·서비스 재작성): 우편↔가방 2-서비스 교차 + saga liveness — mail giveOks==escrowXfers·sagaLivenessConsistent(pending 3분할). ==');
  console.log('seed   | giveOks | escrowXfers | pending | sagaLive+ness | 판정');
  for (const seed of seeds) {
    const r = run({
      seed, ticks: 16, clients: 2, moves: 4, radius: 4, grid: 16, zones: 2,
      bus: true, inventory: true, mail: true, mailItem: true, mailInv: true, mailSaga: true,
      invOps: [{ at: 1, op: { type: 'item_req', op: 'pickup', avatar: 'alice', reqId: 'r0' } }],
      mailOps: [
        { at: 3, op: { type: 'mailSend', from: 'alice', to: 'bob', body: 'gift', item: 'item0' } },
        { at: 9, op: { type: 'mailFetch', to: 'bob' } },
      ],
    });
    const m = r.mail, inv = r.inventory;
    const cross = m.giveOks === inv.escrowXfers && m.giveOks === 2;         // 두 서비스 escrow 회계 합치
    const liveness = m.sagaLivenessConsistent() && m.sagaConsistent();      // pending 3분할 + 회계 닫힘
    const conserved = inv.ownerOf('item0') === 'bob' && inv.minted === 1;   // 무손실 단일 소유
    const ok = check(cross && liveness && conserved, `seed ${seed}: cross${cross}(oks${m.giveOks}==xfer${inv.escrowXfers})·liveness${liveness}·conserved${conserved}`);
    console.log(`${pad(seed, 6)} | ${pad(m.giveOks, 7)} | ${pad(inv.escrowXfers, 11)} | ${pad(m.pending.size, 7)} | ${pad(liveness ? 'Y' : 'N', 13)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

// step-0495 재작성 — svcguildcap: 길드 로스터 single-master 정합(0190 rosterConsistent 판). create+join+master 이양(쌍 거래) 후 정확히 한 master·고아 0·중복 0.
function svcguildcap(seeds) {
  console.log('== svcguildcap (0495·서비스 재작성): 길드 single-master — create+join+이양(쌍 거래) 후 rosterConsistent(한 master·master∈members·중복0). ==');
  console.log('seed   | creates | master | members | roster | 판정');
  for (const seed of seeds) {
    const r = run({
      seed, ticks: 12, clients: 2, moves: 4, radius: 4, grid: 16, zones: 2, bus: true, guildService: true,
      guildOps: [
        { at: 1, op: { type: 'guildCreate', guildId: 'g1', master: 'alice', members: ['alice'] } },
        { at: 2, op: { type: 'guildJoin', guildId: 'g1', member: 'bob' } },
        { at: 3, op: { type: 'guildTransfer', guildId: 'g1', from: 'alice', to: 'bob' } },
        { at: 4, op: { type: 'guildLeave', guildId: 'g1', member: 'bob' } },   // master 탈퇴 보호(no-op)
      ],
    });
    const g = r.guild, gd = g.guilds.get('g1');
    const roster = g.rosterConsistent();
    const transferred = gd && gd.master === 'bob' && gd.members.includes('alice') && gd.members.includes('bob');   // 이양 성사·from 잔류
    const masterProtected = gd && gd.members.includes('bob');   // master(bob) 탈퇴 no-op(single-master 보존)
    const ok = check(roster && transferred && masterProtected, `seed ${seed}: roster${roster}·transferred${transferred}·protected${masterProtected}`);
    console.log(`${pad(seed, 6)} | ${pad(g.creates, 7)} | ${pad(gd ? gd.master : '-', 6)} | ${pad(gd ? gd.members.length : 0, 7)} | ${pad(roster ? 'Y' : 'N', 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

// step-0496 재작성 — svcbankcap: 길드 금고 원장 정합(0199 bankConsistent 판). deposit/withdraw 후 itemId 단일 길드 소유(교차 중복 0·금고 내 중복 0)·금고 회계(예치−인출==잔여).
function svcbankcap(seeds) {
  console.log('== svcbankcap (0496·서비스 재작성): 길드 금고 원장 — deposit/withdraw 후 bankConsistent(itemId 단일 길드 소유)·금고 회계(예치−인출==잔여). ==');
  console.log('seed   | g1 vault | g2 vault | bankC | 회계 | 판정');
  for (const seed of seeds) {
    const r = run({
      seed, ticks: 12, clients: 2, moves: 4, radius: 4, grid: 16, zones: 2, bus: true, guildService: true, guildBank: true,
      guildOps: [
        { at: 1, op: { type: 'guildCreate', guildId: 'g1', master: 'alice', members: ['alice'] } },
        { at: 1, op: { type: 'guildCreate', guildId: 'g2', master: 'carol', members: ['carol'] } },
        { at: 2, op: { type: 'guildDeposit', guildId: 'g1', itemId: 'gold0', member: 'alice' } },
        { at: 3, op: { type: 'guildDeposit', guildId: 'g1', itemId: 'gold1', member: 'alice' } },
        { at: 4, op: { type: 'guildDeposit', guildId: 'g2', itemId: 'gem0', member: 'carol' } },
        { at: 5, op: { type: 'guildWithdraw', guildId: 'g1', itemId: 'gold0', member: 'alice' } },   // g1: 예치2−인출1=잔여1(gold1)
      ],
    });
    const g = r.guild;
    const v1 = g.bankOf('g1'), v2 = g.bankOf('g2');
    const bankC = g.bankConsistent();                                   // itemId 단일 길드 소유(교차 중복 0)
    const accounting = v1.length === 1 && v1[0] === 'gold1' && v2.length === 1 && v2[0] === 'gem0';   // 예치−인출==잔여·격리
    const ok = check(bankC && accounting, `seed ${seed}: bankC${bankC}·acct${accounting}(g1[${v1}]·g2[${v2}])`);
    console.log(`${pad(seed, 6)} | ${pad(JSON.stringify(v1), 8)} | ${pad(JSON.stringify(v2), 8)} | ${pad(bankC ? 'Y' : 'N', 5)} | ${pad(accounting ? 'Y' : 'N', 4)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

// step-0497 재작성 — svcmailexpire: 우편 메시지 통수 회계(0150 mailConsistent 판). 만료 TTL 포함 — sent == 보유(held) + 수령(fetched) + 만료(expired)·공백/중복 0.
function svcmailexpire(seeds) {
  console.log('== svcmailexpire (0497·서비스 재작성): 우편 메시지 통수 회계 — 만료 TTL 하 sent==held+fetched+expired(공백·중복 0·mailConsistent). ==');
  console.log('seed   | sent | held | fetched | expired | mailC | 판정');
  for (const seed of seeds) {
    const r = run({
      seed, ticks: 20, clients: 2, moves: 4, radius: 4, grid: 16, zones: 2, bus: true, mail: true, mailTtl: 4,
      mailOps: [
        { at: 2, op: { type: 'mailSend', from: 'a', to: 'bob', body: 'm1' } },
        { at: 2, op: { type: 'mailSend', from: 'a', to: 'carol', body: 'm2' } },
        { at: 4, op: { type: 'mailFetch', to: 'bob' } },        // bob 수령
        { at: 12, op: { type: 'mailSweep', now: 12 } },          // carol m2(sentAt2·ttl4) 만료
      ],
    });
    const m = r.mail;
    const mailC = m.mailConsistent();                            // sent == held + fetched + expired
    const split = m.sent === 2 && m.fetched === 1 && m.expired === 1 && m.totalHeld() === 0;   // 세 종결로 분할·잔여 0
    const ok = check(mailC && split, `seed ${seed}: mailC${mailC}·split${split}(sent${m.sent}·f${m.fetched}·e${m.expired}·h${m.totalHeld()})`);
    console.log(`${pad(seed, 6)} | ${pad(m.sent, 4)} | ${pad(m.totalHeld(), 4)} | ${pad(m.fetched, 7)} | ${pad(m.expired, 7)} | ${pad(mailC ? 'Y' : 'N', 5)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

// step-0498 재작성 — svcsvccombined: 거래소+우편+길드 세 서비스 한 run() 동시 구동 — 각 정합 술어 동시 성립 + 상호 비간섭(서비스 격리·아이템 무손실 종합).
function svcsvccombined(seeds) {
  console.log('== svcsvccombined (0498·서비스 재작성): 거래소+우편+길드 한 run() 종합 — 각 정합 술어 동시 성립·서비스 격리(상호 비간섭). ==');
  console.log('seed   | exch | mail | roster | bank | 격리 | 판정');
  for (const seed of seeds) {
    const r = run({
      seed, ticks: 18, clients: 2, moves: 4, radius: 4, grid: 16, zones: 2,
      bus: true, inventory: true,
      exchange: true, exchInventory: true, exchSaga: true,
      mail: true, mailItem: true, mailInv: true, mailSaga: true,
      guildService: true, guildBank: true,
      invOps: [
        { at: 1, op: { type: 'item_req', op: 'pickup', avatar: 'seller', reqId: 'r0' } },   // item0
        { at: 1, op: { type: 'item_req', op: 'pickup', avatar: 'alice', reqId: 'r1' } },     // item1
      ],
      exchangeOps: [
        { at: 3, op: { type: 'exchList', seller: 'seller', item: 'sword', price: 10, itemId: 'item0' } },
        { at: 7, op: { type: 'exchBuy', id: 1, buyer: 'buyer' } },
      ],
      mailOps: [
        { at: 3, op: { type: 'mailSend', from: 'alice', to: 'bob', body: 'gift', item: 'item1' } },
        { at: 9, op: { type: 'mailFetch', to: 'bob' } },
      ],
      guildOps: [
        { at: 1, op: { type: 'guildCreate', guildId: 'g1', master: 'alice', members: ['alice'] } },
        { at: 2, op: { type: 'guildDeposit', guildId: 'g1', itemId: 'gold0', member: 'alice' } },
      ],
    });
    const e = r.exchange, m = r.mail, g = r.guild, inv = r.inventory;
    const exchOk = e.sagaLiveConsistent() && e.giveOks === 2 && inv.ownerOf('item0') === 'buyer';
    const mailOk = m.sagaLiveConsistent() && m.giveOks === 2 && inv.ownerOf('item1') === 'bob';
    const rosterOk = g.rosterConsistent();
    const bankOk = g.bankConsistent() && JSON.stringify(g.bankOf('g1')) === '["gold0"]';
    const isolated = inv.minted === 2 && e.giveOks + m.giveOks === inv.escrowXfers;   // 두 서비스 escrow 합·아이템 무손실(item0·item1 각 단일 소유)
    const ok = check(exchOk && mailOk && rosterOk && bankOk && isolated, `seed ${seed}: exch${exchOk}·mail${mailOk}·roster${rosterOk}·bank${bankOk}·iso${isolated}`);
    console.log(`${pad(seed, 6)} | ${pad(exchOk ? 'Y' : 'N', 4)} | ${pad(mailOk ? 'Y' : 'N', 4)} | ${pad(rosterOk ? 'Y' : 'N', 6)} | ${pad(bankOk ? 'Y' : 'N', 4)} | ${pad(isolated ? 'Y' : 'N', 4)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

// step-0499 재작성 — svcexchangecancel: 거래소 release 경로(취소·만료 TTL) escrow 반환. cancel/expire 로 escrow 아이템이 판매자 가방으로 돌아옴·sagaLiveConsistent 보존.
function svcexchangecancel(seeds) {
  console.log('== svcexchangecancel (0499·서비스 재작성): 거래소 release 경로 — cancel/expire escrow 반환·아이템 판매자 복귀·sagaLiveConsistent 보존. ==');
  console.log('seed   | cancelled | expired | item0/1 소유 | sagaLive | 판정');
  for (const seed of seeds) {
    const r = run({
      seed, ticks: 18, clients: 2, moves: 4, radius: 4, grid: 16, zones: 2,
      bus: true, inventory: true, exchange: true, exchInventory: true, exchSaga: true, exchangeTtl: 4,
      invOps: [
        { at: 1, op: { type: 'item_req', op: 'pickup', avatar: 'seller', reqId: 'r0' } },   // item0
        { at: 1, op: { type: 'item_req', op: 'pickup', avatar: 'seller', reqId: 'r1' } },   // item1
      ],
      exchangeOps: [
        { at: 3, op: { type: 'exchList', seller: 'seller', item: 'sword', price: 10, itemId: 'item0' } },
        { at: 3, op: { type: 'exchList', seller: 'seller', item: 'shield', price: 5, itemId: 'item1' } },
        { at: 5, op: { type: 'exchCancel', id: 1, seller: 'seller' } },   // item0 취소 반환
        { at: 12, op: { type: 'exchSweep', now: 12 } },                    // item1(listedAt3·ttl4) 만료 반환
      ],
    });
    const e = r.exchange, inv = r.inventory;
    const released = e.cancelled === 1 && e.expired === 1;                       // 취소 1·만료 1
    const returned = inv.ownerOf('item0') === 'seller' && inv.ownerOf('item1') === 'seller';   // 둘 다 판매자 복귀
    const live = e.sagaLiveConsistent() && e.sagaConsistent() && e.pending.size === 0;
    const ok = check(released && returned && live, `seed ${seed}: released${released}·returned${returned}·live${live}(o0${inv.ownerOf('item0')}·o1${inv.ownerOf('item1')})`);
    console.log(`${pad(seed, 6)} | ${pad(e.cancelled, 9)} | ${pad(e.expired, 7)} | ${pad(inv.ownerOf('item0') + '/' + inv.ownerOf('item1'), 13)} | ${pad(live ? 'Y' : 'N', 8)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

// step-0500 #16 라운드 3차 정리 — promotedsvc: 서비스 saga capstone 9종이 ORDER 누적 회귀에 항구 등록됐는지 가드(향후 우발 제거 방지·"no silent cap"·arc 닫기).
function promotedsvc(seeds) {
  const PROMOTED = ['svcexchangecap', 'svcexchangexfer', 'svcmailcap', 'svcmailxfer', 'svcguildcap', 'svcbankcap', 'svcmailexpire', 'svcsvccombined', 'svcexchangecancel'];
  console.log('== promotedsvc (0500·#16 라운드 3차 정리): 서비스 saga capstone 9종 ORDER/MODES 항구 등록 가드 — 향후 제거 방지. #16 라운드 3차 arc 닫기. ==');
  console.log('capstone           | ORDER | MODES | 판정');
  for (const m of PROMOTED) {
    const inOrder = ORDER.includes(m);
    const inModes = typeof MODES[m] === 'function';
    const ok = check(inOrder && inModes, `${m}: order ${inOrder}·modes ${inModes}`);
    console.log(`${m.padEnd(18)} | ${pad(inOrder ? 'Y' : 'N', 5)} | ${pad(inModes ? 'Y' : 'N', 5)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  check(PROMOTED.every(m => ORDER.includes(m) && typeof MODES[m] === 'function'), `promotedsvc: 서비스 saga capstone 9종 전부 등록`);
}

// ════════════════════════════════════════════════════════════════════════
//  #16 라운드 4차 — 완전 saga liveness *손실 체제* 편입(0501~0510·STATE §2 ⒜)
//   0491~0500 서비스 saga capstone 은 *행복 경로*(pending 0·abandon 0·permFailed 0)만 구동했다 —
//   3분할 술어(sagaLivenessConsistent)는 참이었으나 (0,0,0) 자명 참이었다. 이 arc 는 우편 saga 의
//   내장 손실 seam(mailAckDrop 1회 드롭·mailAckDropAlways 지속 드롭)으로 *실제 회신 손실*을 주입해
//   재전송→포기(abandon)→재admission(readmit)→영구실패(permFailed) 수명주기를 발현시키고, 각 국면에서
//   sagaConsistent(gives==acked+pending·acked==oks+fails)·sagaLivenessConsistent(pending==pendingGive+
//   abandonedGive+permFailed) 가 *비자명하게*(각 항 nonzero) 성립함을 단언한다. 박스 무수정→reg 0 자명.
// runMailLoss(extra, mailOps, invItems) — 우편 아이템 saga 를 손실 opts 로 구동하는 공용 하니스(9 모드 공유).
function runMailLoss(extra, mailOps, invItems) {
  const invOps = (invItems || ['item0']).map((_, i) => ({ at: 1, op: { type: 'item_req', op: 'pickup', avatar: 'alice', reqId: 'r' + i } }));
  return run(Object.assign({
    seed: 0, ticks: 40, clients: 2, moves: 4, radius: 4, grid: 16, zones: 2,
    bus: true, inventory: true, mail: true, mailItem: true, mailInv: true, mailSaga: true, mailAutoRetry: true,
    invOps, mailOps,
  }, extra));
}

// step-0501 — mailsagatransient: 일시적 회신 손실(mailAckDrop 1회 드롭) 하 자가 치유. autoRetry sweep 1회 재전송이 ack 를 재유도 → pending 0 drain·gives==ackedGives. transient 손실은 스스로 낫는다.
function mailsagatransient(seeds) {
  console.log('== mailsagatransient (0501·손실 체제): 일시 회신 손실(drop-once)+autoRetry → 재전송이 ack 재유도·pending 0 drain·gives==acked. ==');
  console.log('seed   | gives | acked | pending | retries | sagaC | 판정');
  for (const seed of seeds) {
    const m = runMailLoss({ seed, mailAckDrop: [0] },
      [{ at: 3, op: { type: 'mailSend', from: 'alice', to: 'bob', body: 'g', item: 'item0' } },
       { at: 7, op: { type: 'mailSweep', now: 7 } }]).mail;
    const healed = m.pending.size === 0 && m.ackedGives === m.gives && m.gives === 1;   // 재전송으로 회신 재도착·미해결 0
    const retried = m.retries >= 1;                                                      // 최소 1회 재전송(손실이 발현했음)
    const cons = m.sagaConsistent() && m.sagaLivenessConsistent();
    const ok = check(healed && retried && cons, `seed ${seed}: healed${healed}·retried${retried}(ret${m.retries})·cons${cons}`);
    console.log(`${pad(seed, 6)} | ${pad(m.gives, 5)} | ${pad(m.ackedGives, 5)} | ${pad(m.pending.size, 7)} | ${pad(m.retries, 7)} | ${pad(cons ? 'Y' : 'N', 5)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

// step-0502 — mailsagaunacked: 지속 회신 손실(mailAckDropAlways·상한 없음) 하 미해결 give 무손실 회계. 재전송이 영영 통과 못 해도 gives==acked+pending(새는 give 0)·pending==pendingGive(전량 재전송 중)·sagaConsistent. 미해결이 *가시하고 유계*임을 단언(누락 0).
function mailsagaunacked(seeds) {
  console.log('== mailsagaunacked (0502·손실 체제): 지속 손실(drop-always·상한없음) → 미해결 give 무손실 회계·pending==pendingGive·gives==acked+pending. ==');
  console.log('seed   | gives | acked | pending | pendingGive | retries | 판정');
  for (const seed of seeds) {
    const m = runMailLoss({ seed, mailAckDropAlways: [0] },
      [{ at: 3, op: { type: 'mailSend', from: 'alice', to: 'bob', body: 'g', item: 'item0' } },
       { at: 7, op: { type: 'mailSweep', now: 7 } }, { at: 11, op: { type: 'mailSweep', now: 11 } }]).mail;
    const unresolved = m.pending.size === 1 && m.ackedGives === 0;                       // 회신 영영 미도착 → 미해결 잔존
    const accounted = m.gives === m.ackedGives + m.pending.size && m.pending.size === m.pendingGive.size;  // 새는 give 0·전량 재전송 중
    const retried = m.retries >= 2;                                                       // 지속 재전송(포기 상한 없음)
    const cons = m.sagaConsistent() && m.sagaLivenessConsistent();
    const ok = check(unresolved && accounted && retried && cons, `seed ${seed}: unres${unresolved}·acct${accounted}·ret${m.retries}·cons${cons}`);
    console.log(`${pad(seed, 6)} | ${pad(m.gives, 5)} | ${pad(m.ackedGives, 5)} | ${pad(m.pending.size, 7)} | ${pad(m.pendingGive.size, 11)} | ${pad(m.retries, 7)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

// step-0503 — mailsagaabandon: 재시도 상한(mailMaxRetries) 도달 → 포기(abandon) 국면. 지속 손실 하 gid 당 N회 재전송 후 포기 → giveAbandoned>0·pendingGive 0(재전송 중단)·abandonedGive>0(재admission 대기)·pending 잔존. 미해결의 두 번째 분할(pendingGive→abandonedGive) 발현·pending==abandonedGive.
function mailsagaabandon(seeds) {
  console.log('== mailsagaabandon (0503·손실 체제): 재시도 상한 도달 → 포기. giveAbandoned>0·pendingGive 0·abandonedGive>0·pending==abandonedGive·sagaLive. ==');
  console.log('seed   | giveAbandoned | pendingGive | abandonedGive | pending | 판정');
  for (const seed of seeds) {
    const m = runMailLoss({ seed, mailAckDropAlways: [0], mailMaxRetries: 2 },
      [{ at: 3, op: { type: 'mailSend', from: 'alice', to: 'bob', body: 'g', item: 'item0' } },
       { at: 7, op: { type: 'mailSweep', now: 7 } }, { at: 9, op: { type: 'mailSweep', now: 9 } }, { at: 11, op: { type: 'mailSweep', now: 11 } }]).mail;
    const abandoned = m.giveAbandoned === 1 && m.pendingGive.size === 0 && m.abandonedGive.size === 1;   // 상한 도달 → pendingGive→abandonedGive 이행
    const held = m.pending.size === 1 && m.pending.size === m.abandonedGive.size;                        // pending 잔존(미해결)·전량 재admission 대기
    const cons = m.sagaConsistent() && m.sagaLivenessConsistent();
    const ok = check(abandoned && held && cons, `seed ${seed}: aban${abandoned}·held${held}·cons${cons}(ga${m.giveAbandoned})`);
    console.log(`${pad(seed, 6)} | ${pad(m.giveAbandoned, 13)} | ${pad(m.pendingGive.size, 11)} | ${pad(m.abandonedGive.size, 13)} | ${pad(m.pending.size, 7)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

// step-0504 — mailsagaabandonpub: 포기 발행 E2E 관측(mailAbandonPublish+audit). 포기 시 svc.mail.saga_abandoned 1회 발행 → 버스 → audit 수신. abandonPublished==giveAbandoned AND audit.seen 카운트 일치. 운영 가시화가 발행→버스→감사로 실제 닿음(은닉 통신).
function mailsagaabandonpub(seeds) {
  console.log('== mailsagaabandonpub (0504·손실 체제): 포기 발행 E2E — svc.mail.saga_abandoned 발행→버스→audit. abandonPublished==giveAbandoned==audit.seen. ==');
  console.log('seed   | giveAbandoned | abandonPublished | auditSeen | 판정');
  for (const seed of seeds) {
    const m = runMailLoss({ seed, audit: true, mailAckDropAlways: [0], mailMaxRetries: 2, mailAbandonPublish: true },
      [{ at: 3, op: { type: 'mailSend', from: 'alice', to: 'bob', body: 'g', item: 'item0' } },
       { at: 7, op: { type: 'mailSweep', now: 7 } }, { at: 9, op: { type: 'mailSweep', now: 9 } }, { at: 11, op: { type: 'mailSweep', now: 11 } }]);
    const svc = m.mail, seen = m.audit ? (m.audit.seen.get('svc.mail.saga_abandoned') || 0) : -1;
    const published = svc.giveAbandoned === 1 && svc.abandonPublished === svc.giveAbandoned;   // 포기마다 1회 발행(1:1)
    const observed = seen === svc.giveAbandoned;                                               // 버스 경유 audit 수신 일치
    const cons = svc.sagaConsistent() && svc.sagaLivenessConsistent();
    const ok = check(published && observed && cons, `seed ${seed}: pub${published}·obs${observed}(seen${seen})·cons${cons}`);
    console.log(`${pad(seed, 6)} | ${pad(svc.giveAbandoned, 13)} | ${pad(svc.abandonPublished, 16)} | ${pad(seen, 9)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

// step-0505 — mailsagareadmit: 포기 give 재admission(mailReadmit) 복구 기제. 포기(abandonedGive) 후 운영이 mailReadmit → abandonedGive→pendingGive 되돌림·readmitted>0·retryCount 리셋(재전송 재개). pending 불변(여전히 미해결)·sagaLive. 포기의 역이행 — 손실 해소 후 재개의 발판.
function mailsagareadmit(seeds) {
  console.log('== mailsagareadmit (0505·손실 체제): 포기 give 재admission — abandonedGive→pendingGive 되돌림·readmitted>0·pending 불변·sagaLive. 복구 기제(포기의 역이행). ==');
  console.log('seed   | readmitted | abandonedGive | pendingGive | pending | 판정');
  for (const seed of seeds) {
    const m = runMailLoss({ seed, mailAckDropAlways: [0], mailMaxRetries: 2 },
      [{ at: 3, op: { type: 'mailSend', from: 'alice', to: 'bob', body: 'g', item: 'item0' } },
       { at: 7, op: { type: 'mailSweep', now: 7 } }, { at: 9, op: { type: 'mailSweep', now: 9 } }, { at: 11, op: { type: 'mailSweep', now: 11 } },
       { at: 13, op: { type: 'mailReadmit' } }]).mail;
    const readmitted = m.readmitted === 1 && m.giveAbandoned === 1;                            // 포기 1건이 재admission
    const rolled = m.abandonedGive.size === 0 && m.pendingGive.size === 1;                     // abandonedGive→pendingGive 역이행(재전송 재개 대기)
    const held = m.pending.size === 1;                                                          // pending 불변(재admission 은 미해결 상태 안 바꿈)
    const cons = m.sagaConsistent() && m.sagaLivenessConsistent();
    const ok = check(readmitted && rolled && held && cons, `seed ${seed}: radm${readmitted}·rolled${rolled}·held${held}·cons${cons}`);
    console.log(`${pad(seed, 6)} | ${pad(m.readmitted, 10)} | ${pad(m.abandonedGive.size, 13)} | ${pad(m.pendingGive.size, 11)} | ${pad(m.pending.size, 7)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

// step-0506 — mailsagareadmitpub: 재admission 발행 E2E 관측(mailReadmitPublish+audit). 재admission 시 svc.mail.saga_readmitted 1회 발행 → 버스 → audit 수신. readmitPublished==readmitted==audit.seen. 포기 발행(0504)의 짝 — 복구 사건도 은닉 통신으로 가시.
function mailsagareadmitpub(seeds) {
  console.log('== mailsagareadmitpub (0506·손실 체제): 재admission 발행 E2E — svc.mail.saga_readmitted 발행→버스→audit. readmitPublished==readmitted==audit.seen. ==');
  console.log('seed   | readmitted | readmitPublished | auditSeen | 판정');
  for (const seed of seeds) {
    const m = runMailLoss({ seed, audit: true, mailAckDropAlways: [0], mailMaxRetries: 2, mailReadmitPublish: true },
      [{ at: 3, op: { type: 'mailSend', from: 'alice', to: 'bob', body: 'g', item: 'item0' } },
       { at: 7, op: { type: 'mailSweep', now: 7 } }, { at: 9, op: { type: 'mailSweep', now: 9 } }, { at: 11, op: { type: 'mailSweep', now: 11 } },
       { at: 13, op: { type: 'mailReadmit' } }]);
    const svc = m.mail, seen = m.audit ? (m.audit.seen.get('svc.mail.saga_readmitted') || 0) : -1;
    const published = svc.readmitted === 1 && svc.readmitPublished === svc.readmitted;   // 재admission 마다 1회 발행(1:1)
    const observed = seen === svc.readmitted;                                            // 버스 경유 audit 수신 일치
    const cons = svc.sagaConsistent() && svc.sagaLivenessConsistent();
    const ok = check(published && observed && cons, `seed ${seed}: pub${published}·obs${observed}(seen${seen})·cons${cons}`);
    console.log(`${pad(seed, 6)} | ${pad(svc.readmitted, 10)} | ${pad(svc.readmitPublished, 16)} | ${pad(seen, 9)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

// step-0507 — mailsagapermfail: 재admission 상한(mailReadmitMax) 도달 → 영구 실패(permFailed). readmitMax 회 재admission 된 give 가 또 포기되면 abandonedGive 제외(재admission 차단)·permFailed++. 무한 abandon↔readmit 루프 방지. pending 잔존·pending==pendingGive+abandonedGive+permFailed(perm 항 nonzero)·sagaLive. 미해결의 세 번째 종결 분할.
function mailsagapermfail(seeds) {
  console.log('== mailsagapermfail (0507·손실 체제): 재admission 상한 도달 → 영구 실패. permFailed>0·재admission 차단·pending==pg+ab+perm(perm nonzero)·sagaLive. ==');
  console.log('seed   | permFailed | pendingGive | abandonedGive | pending | 판정');
  for (const seed of seeds) {
    const m = runMailLoss({ seed, mailAckDropAlways: [0], mailMaxRetries: 1, mailReadmitMax: 1 },
      [{ at: 3, op: { type: 'mailSend', from: 'alice', to: 'bob', body: 'g', item: 'item0' } },
       { at: 5, op: { type: 'mailSweep', now: 5 } }, { at: 7, op: { type: 'mailSweep', now: 7 } },
       { at: 9, op: { type: 'mailReadmit' } },
       { at: 11, op: { type: 'mailSweep', now: 11 } }, { at: 13, op: { type: 'mailSweep', now: 13 } }]).mail;
    const permanent = m.permFailed === 1 && m.abandonedGive.size === 0 && m.readmitted === 1;   // 재admission 1회 후 또 포기 → 영구 종결(재admission 차단)
    const held = m.pending.size === 1 && m.pending.size === m.pendingGive.size + m.abandonedGive.size + m.permFailed;  // 3분할 합·perm 항 nonzero
    const cons = m.sagaConsistent() && m.sagaLivenessConsistent();
    const ok = check(permanent && held && cons, `seed ${seed}: perm${permanent}·held${held}·cons${cons}(pf${m.permFailed})`);
    console.log(`${pad(seed, 6)} | ${pad(m.permFailed, 10)} | ${pad(m.pendingGive.size, 11)} | ${pad(m.abandonedGive.size, 13)} | ${pad(m.pending.size, 7)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

// step-0508 — mailsagafailpub: 영구 실패 발행 E2E 관측(mailFailPublish+audit). 영구 실패 시 svc.mail.saga_failed 1회 발행 → 버스 → audit 수신. failPublished==permFailed==audit.seen. 포기(0504)·재admission(0506) 발행의 종결 마디 — saga liveness 수명주기 발행 삼종(abandon/readmit/fail) 완비.
function mailsagafailpub(seeds) {
  console.log('== mailsagafailpub (0508·손실 체제): 영구 실패 발행 E2E — svc.mail.saga_failed 발행→버스→audit. failPublished==permFailed==audit.seen. 수명주기 발행 삼종 완비. ==');
  console.log('seed   | permFailed | failPublished | auditSeen | 판정');
  for (const seed of seeds) {
    const m = runMailLoss({ seed, audit: true, mailAckDropAlways: [0], mailMaxRetries: 1, mailReadmitMax: 1, mailFailPublish: true },
      [{ at: 3, op: { type: 'mailSend', from: 'alice', to: 'bob', body: 'g', item: 'item0' } },
       { at: 5, op: { type: 'mailSweep', now: 5 } }, { at: 7, op: { type: 'mailSweep', now: 7 } },
       { at: 9, op: { type: 'mailReadmit' } },
       { at: 11, op: { type: 'mailSweep', now: 11 } }, { at: 13, op: { type: 'mailSweep', now: 13 } }]);
    const svc = m.mail, seen = m.audit ? (m.audit.seen.get('svc.mail.saga_failed') || 0) : -1;
    const published = svc.permFailed === 1 && svc.failPublished === svc.permFailed;   // 영구 실패마다 1회 발행(1:1)
    const observed = seen === svc.permFailed;                                          // 버스 경유 audit 수신 일치
    const cons = svc.sagaConsistent() && svc.sagaLivenessConsistent();
    const ok = check(published && observed && cons, `seed ${seed}: pub${published}·obs${observed}(seen${seen})·cons${cons}`);
    console.log(`${pad(seed, 6)} | ${pad(svc.permFailed, 10)} | ${pad(svc.failPublished, 13)} | ${pad(seen, 9)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

// step-0509 — mailsaga3way: 완전 saga liveness *grand capstone*. 세 미해결 give 를 각각 다른 종결 상태로 몰아 pendingGive>0 AND abandonedGive>0 AND permFailed>0 을 *동시에* 발현(각 항 nonzero) — sagaLivenessConsistent(pending==pg+ab+perm) 가 (0,0,0) 자명 참이 아니라 *비자명*하게 성립함을 단언. 0501~0508 국면들의 종합.
//   gid0→영구실패(포기→재admission→재포기)·gid1→포기 대기(재admission 안 함)·gid2→재전송 중(미포기). readmit 은 abandonedGive 전량을 옮기므로 gid1 은 마지막 readmit *후* 포기시켜 잔존시킨다.
function mailsaga3way(seeds) {
  console.log('== mailsaga3way (0509·손실 체제 grand): 세 give 를 서로 다른 종결로 몰아 pendingGive·abandonedGive·permFailed 동시 nonzero·sagaLivenessConsistent 비자명 성립. ==');
  console.log('seed   | pendingGive | abandonedGive | permFailed | pending | 3way | 판정');
  for (const seed of seeds) {
    const m = runMailLoss({ seed, mailAckDropAlways: [0, 1, 2], mailMaxRetries: 1, mailReadmitMax: 1 },
      [{ at: 2, op: { type: 'mailSend', from: 'alice', to: 'bob', body: 'g0', item: 'item0' } },   // gid0 → permFailed
       { at: 3, op: { type: 'mailSweep', now: 3 } }, { at: 4, op: { type: 'mailSweep', now: 4 } },  // gid0 포기
       { at: 5, op: { type: 'mailReadmit' } },                                                       // gid0 재admission(rc=1)
       { at: 6, op: { type: 'mailSweep', now: 6 } }, { at: 7, op: { type: 'mailSweep', now: 7 } },  // gid0 재포기 → 영구실패
       { at: 9, op: { type: 'mailSend', from: 'alice', to: 'bob', body: 'g1', item: 'item1' } },   // gid1 → abandonedGive
       { at: 10, op: { type: 'mailSweep', now: 10 } }, { at: 11, op: { type: 'mailSweep', now: 11 } }, // gid1 포기(이후 재admission 없음)
       { at: 13, op: { type: 'mailSend', from: 'alice', to: 'bob', body: 'g2', item: 'item2' } }],  // gid2 → pendingGive(이후 sweep 없음)
      ['item0', 'item1', 'item2']).mail;
    const three = m.pendingGive.size > 0 && m.abandonedGive.size > 0 && m.permFailed > 0;    // 세 분할 동시 nonzero(비자명)
    const partition = m.pending.size === m.pendingGive.size + m.abandonedGive.size + m.permFailed;  // 3분할 합 == pending(공백·중복 0)
    const cons = m.sagaConsistent() && m.sagaLivenessConsistent();
    const ok = check(three && partition && cons, `seed ${seed}: 3way${three}(pg${m.pendingGive.size}·ab${m.abandonedGive.size}·pf${m.permFailed})·part${partition}·cons${cons}`);
    console.log(`${pad(seed, 6)} | ${pad(m.pendingGive.size, 11)} | ${pad(m.abandonedGive.size, 13)} | ${pad(m.permFailed, 10)} | ${pad(m.pending.size, 7)} | ${pad(three ? 'Y' : 'N', 4)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

// step-0510 #16 라운드 4차 정리 — promotedsagaloss: 손실 체제 saga liveness 모드 9종이 ORDER 누적 회귀에 항구 등록됐는지 가드(향후 우발 제거 방지·"no silent cap"·arc 닫기). promoted16(0490)·promotedsvc(0500)의 손실 체제 판.
function promotedsagaloss(seeds) {
  const PROMOTED = ['mailsagatransient', 'mailsagaunacked', 'mailsagaabandon', 'mailsagaabandonpub', 'mailsagareadmit', 'mailsagareadmitpub', 'mailsagapermfail', 'mailsagafailpub', 'mailsaga3way', 'promotedsagaloss', 'guildbankdeposit', 'guildbankwithdraw', 'guildbankconserved', 'guildbankcrash', 'guildbanksaga', 'guildbankpending', 'guildbankresend', 'guildbanksagacons', 'guildbankxfer', 'guildbankcap'];
  console.log('== promotedsagaloss (0510·#16 라운드 4차 정리): 손실 체제 saga liveness 9종 ORDER/MODES 항구 등록 가드 — 향후 제거 방지. #16 라운드 4차 arc 닫기. ==');
  console.log('capstone           | ORDER | MODES | 판정');
  for (const m of PROMOTED) {
    const inOrder = ORDER.includes(m);
    const inModes = typeof MODES[m] === 'function';
    const ok = check(inOrder && inModes, `${m}: order ${inOrder}·modes ${inModes}`);
    console.log(`${m.padEnd(18)} | ${pad(inOrder ? 'Y' : 'N', 5)} | ${pad(inModes ? 'Y' : 'N', 5)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  check(PROMOTED.every(m => ORDER.includes(m) && typeof MODES[m] === 'function'), `promotedsagaloss: 손실 체제 saga liveness 9종 전부 등록`);
}

// ════════════════════════════════════════════════════════════════════════
//  #46 금고↔가방 escrow 실연동 arc(0511~0520·STATE §2 ②·2차 심화)
//   0191~0200 길드 금고는 itemId *문자열*만 vault 에 적재(가짜 escrow) — 예치해도 멤버 가방서 안 빠졌다. 이 arc 는
//   거래소 escrow(0117~0130)·우편 custody(0161~0170)의 *조직 공유* 판을 적용: 예치=멤버 가방→escrow give·
//   인출=escrow→멤버 가방 give(가방이 원장 권위·금고는 요청만·은닉). guildBankInv OFF→give 0→reg 0.
// runGuildBank(extra, guildOps, invItems) — 길드 금고 escrow 를 구동하는 공용 하니스(arc 공유).
function runGuildBank(extra, guildOps, invItems) {
  const invOps = (invItems || []).map((it, i) => ({ at: 1, op: { type: 'item_req', op: 'pickup', avatar: it.who, reqId: 'gr' + i } }));
  return run(Object.assign({
    seed: 0, ticks: 16, clients: 2, moves: 4, radius: 4, grid: 16, zones: 2,
    bus: true, inventory: true, guildService: true, guildBank: true, guildBankInv: true,
    invOps, guildOps,
  }, extra));
}

// step-0511 — guildbankdeposit: 금고 예치가 멤버 가방→escrow 실 이동(가짜 escrow 해소·#46). guildDeposit 이 _custody(멤버→'escrow') give → 가방서 아이템이 실제로 빠져 escrow 소유·vault 에도 기록·gives 계측. 거래소 list leg(0117)의 금고 판.
function guildbankdeposit(seeds) {
  console.log('== guildbankdeposit (0511·#46): 금고 예치 = 멤버 가방→escrow 실 이동. gives 1·inv.ownerOf==escrow·vault 보유·escrowIds 추적. ==');
  console.log('seed   | gives | ownerOf(item0) | vault | escrowXfers | 판정');
  for (const seed of seeds) {
    const r = runGuildBank({ seed }, [
      { at: 2, op: { type: 'guildCreate', guildId: 'g1', master: 'alice', members: ['alice'] } },
      { at: 3, op: { type: 'guildDeposit', guildId: 'g1', itemId: 'item0', member: 'alice' } },
    ], [{ who: 'alice' }]);
    const g = r.guild, inv = r.inventory;
    const moved = inv.ownerOf('item0') === 'escrow' && g.gives === 1;                        // 아이템이 alice 가방→escrow 실 이동
    const tracked = g.escrowIds.has('item0') && (g.vault.get('g1') || []).includes('item0');  // vault + escrow 집합 추적
    const crossed = inv.escrowXfers === 1;                                                    // 가방 escrow 회계 발현
    const ok = check(moved && tracked && crossed, `seed ${seed}: moved${moved}·tracked${tracked}·crossed${crossed}(own${inv.ownerOf('item0')})`);
    console.log(`${pad(seed, 6)} | ${pad(g.gives, 5)} | ${pad(inv.ownerOf('item0'), 14)} | ${pad(JSON.stringify(g.vault.get('g1')), 5)} | ${pad(inv.escrowXfers, 11)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

// step-0512 — guildbankwithdraw: 금고 인출이 escrow→멤버 가방 실 이동(0511 짝). guildWithdraw 이 _custody('escrow'→멤버) give → 아이템이 escrow 서 멤버 가방으로 복귀·vault 에서 제거·escrowIds 이탈. 거래소 buy leg(0118)·우편 fetch(0158)의 금고 판.
function guildbankwithdraw(seeds) {
  console.log('== guildbankwithdraw (0512·#46): 금고 인출 = escrow→멤버 가방 실 이동. 예치 후 인출→ownerOf==멤버·vault 비움·escrowIds 이탈·escrowXfers 2. ==');
  console.log('seed   | gives | ownerOf(item0) | vault | escrowIds | 판정');
  for (const seed of seeds) {
    const r = runGuildBank({ seed }, [
      { at: 2, op: { type: 'guildCreate', guildId: 'g1', master: 'alice', members: ['alice'] } },
      { at: 3, op: { type: 'guildDeposit', guildId: 'g1', itemId: 'item0', member: 'alice' } },
      { at: 6, op: { type: 'guildWithdraw', guildId: 'g1', itemId: 'item0', member: 'alice' } },
    ], [{ who: 'alice' }]);
    const g = r.guild, inv = r.inventory;
    const returned = inv.ownerOf('item0') === 'alice' && g.gives === 2;                       // 아이템이 escrow→alice 가방 복귀(예치+인출 give 2)
    const cleared = !(g.vault.get('g1') || []).includes('item0') && !g.escrowIds.has('item0'); // vault·escrow 집합서 제거
    const crossed = inv.escrowXfers === 2;                                                     // 두 escrow give 회계(예치 1+인출 1)
    const ok = check(returned && cleared && crossed, `seed ${seed}: returned${returned}·cleared${cleared}·crossed${crossed}(own${inv.ownerOf('item0')})`);
    console.log(`${pad(seed, 6)} | ${pad(g.gives, 5)} | ${pad(inv.ownerOf('item0'), 14)} | ${pad(JSON.stringify(g.vault.get('g1')), 5)} | ${pad([...g.escrowIds].length, 9)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

// step-0513 — guildbankconserved: 금고↔가방 2-서비스 보존 capstone(거래소 0120·우편 0164 의 금고 판). 금고 escrowIds(길드가 escrow 로 보낸 itemId) == 가방서 'escrow' 소유 itemId(두 서비스 escrow 회계 합치) AND Σvault==escrowIds.size(아이템 무손실·단일 소유). 다중 길드·예치/인출 혼합서 성립.
function guildbankconserved(seeds) {
  console.log('== guildbankconserved (0513·#46): 2-서비스 보존 — 금고 escrowIds == 가방 escrow 소유 집합·Σvault==escrowIds.size·bankConsistent. 다중 길드. ==');
  console.log('seed   | escrowIds | invEscrow | Σvault | match | 판정');
  for (const seed of seeds) {
    const r = runGuildBank({ seed }, [
      { at: 2, op: { type: 'guildCreate', guildId: 'g1', master: 'alice', members: ['alice'] } },
      { at: 2, op: { type: 'guildCreate', guildId: 'g2', master: 'carol', members: ['carol'] } },
      { at: 3, op: { type: 'guildDeposit', guildId: 'g1', itemId: 'item0', member: 'alice' } },
      { at: 4, op: { type: 'guildDeposit', guildId: 'g1', itemId: 'item1', member: 'alice' } },
      { at: 5, op: { type: 'guildDeposit', guildId: 'g2', itemId: 'item2', member: 'carol' } },
      { at: 6, op: { type: 'guildWithdraw', guildId: 'g1', itemId: 'item0', member: 'alice' } },   // g1: 예치2−인출1=잔여1
    ], [{ who: 'alice' }, { who: 'alice' }, { who: 'carol' }]);
    const g = r.guild, inv = r.inventory;
    const invEscrow = [...inv.ledger].filter(([, v]) => v === 'escrow').map(([k]) => k).sort();
    const escrowIds = [...g.escrowIds].sort();
    const vaultTotal = [...g.vault.values()].reduce((a, v) => a + v.length, 0);
    const conserved = JSON.stringify(escrowIds) === JSON.stringify(invEscrow);   // 금고 escrow 집합 == 가방 escrow 소유(두 서비스 합치)
    const noLoss = vaultTotal === escrowIds.length && g.bankConsistent();        // Σvault==escrow·단일 소유(itemId 한 길드)
    const ok = check(conserved && noLoss, `seed ${seed}: conserved${conserved}·noLoss${noLoss}(esc${escrowIds.length}·vault${vaultTotal})`);
    console.log(`${pad(seed, 6)} | ${pad(JSON.stringify(escrowIds), 9)} | ${pad(JSON.stringify(invEscrow), 9)} | ${pad(vaultTotal, 6)} | ${pad(conserved ? 'Y' : 'N', 5)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

// step-0514 — guildbankcrash: 금고 crash→reconstruct 후 escrow 배선 보존. 예치/인출 저널 replay 로 vault 복원 + escrowIds 를 vault 에서 재구성 → 가방(별 박스·crash 무관)의 'escrow' 소유와 여전히 일치(2-서비스 보존 0513 이 crash 후에도 성립). 거래소 0120·우편 0164 crash 체제의 금고 판.
function guildbankcrash(seeds) {
  console.log('== guildbankcrash (0514·#46): 금고 crash→reconstruct 후 escrow 보존. vault replay 복원+escrowIds 재구성==가방 escrow 소유·bankConsistent. ==');
  console.log('seed   | before | after | ==invEscrow | vault | 판정');
  for (const seed of seeds) {
    const r = runGuildBank({ seed, guildPersist: true }, [
      { at: 2, op: { type: 'guildCreate', guildId: 'g1', master: 'alice', members: ['alice'] } },
      { at: 3, op: { type: 'guildDeposit', guildId: 'g1', itemId: 'item0', member: 'alice' } },
      { at: 4, op: { type: 'guildDeposit', guildId: 'g1', itemId: 'item1', member: 'alice' } },
      { at: 6, op: { type: 'guildWithdraw', guildId: 'g1', itemId: 'item0', member: 'alice' } },
    ], [{ who: 'alice' }, { who: 'alice' }]);
    const g = r.guild, inv = r.inventory;
    const before = [...g.escrowIds].sort();
    g.guilds = new Map(); g.vault = new Map(); g.escrowIds = new Set();   // crash 모의 — 휘발 projection 소실(저널·스냅샷은 durable 잔존)
    g.reconstruct();
    const after = [...g.escrowIds].sort();
    const invEscrow = [...inv.ledger].filter(([, v]) => v === 'escrow').map(([k]) => k).sort();
    const preserved = JSON.stringify(before) === JSON.stringify(after) && (g.vault.get('g1') || []).includes('item1');   // crash 전후 escrow 집합 동일·vault 복원
    const conserved = JSON.stringify(after) === JSON.stringify(invEscrow) && g.bankConsistent();                        // 재구성 escrowIds == 가방 escrow(2-서비스 보존 유지)
    const ok = check(preserved && conserved, `seed ${seed}: preserved${preserved}·conserved${conserved}(after${JSON.stringify(after)})`);
    console.log(`${pad(seed, 6)} | ${pad(JSON.stringify(before), 6)} | ${pad(JSON.stringify(after), 5)} | ${pad(conserved ? 'Y' : 'N', 11)} | ${pad(JSON.stringify(g.vault.get('g1')), 5)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

// step-0515 — guildbanksaga: 금고↔가방 saga 회신(닫힌 고리·거래소 0121·우편 0166 의 금고 판). guildBankSaga ON 이면 _custody give 에 replyTo+gid 동봉 → 가방이 item_result 를 금고로 echo → ackedGives/giveOks/giveFails 집계. 무손실서 gives==ackedGives==giveOks(fails 0·닫힌 고리 liveness).
function guildbanksaga(seeds) {
  console.log('== guildbanksaga (0515·#46): 금고↔가방 saga 회신 — give→가방 item_result echo→집계. 무손실서 gives==acked==oks·fails 0(닫힌 고리). ==');
  console.log('seed   | gives | acked | oks | fails | closed | 판정');
  for (const seed of seeds) {
    const r = runGuildBank({ seed, guildBankSaga: true }, [
      { at: 2, op: { type: 'guildCreate', guildId: 'g1', master: 'alice', members: ['alice'] } },
      { at: 3, op: { type: 'guildDeposit', guildId: 'g1', itemId: 'item0', member: 'alice' } },
      { at: 4, op: { type: 'guildDeposit', guildId: 'g1', itemId: 'item1', member: 'alice' } },
      { at: 6, op: { type: 'guildWithdraw', guildId: 'g1', itemId: 'item0', member: 'alice' } },
    ], [{ who: 'alice' }, { who: 'alice' }]);
    const g = r.guild;
    const closed = g.gives === 3 && g.ackedGives === g.gives && g.giveOks === g.gives && g.giveFails === 0;   // 닫힌 고리 — 모든 give acked·성공
    const ok = check(closed, `seed ${seed}: closed${closed}(gives${g.gives}·acked${g.ackedGives}·oks${g.giveOks}·fails${g.giveFails})`);
    console.log(`${pad(seed, 6)} | ${pad(g.gives, 5)} | ${pad(g.ackedGives, 5)} | ${pad(g.giveOks, 3)} | ${pad(g.giveFails, 5)} | ${pad(closed ? 'Y' : 'N', 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

// step-0516 — guildbankpending: 금고 saga 미해결 추적 + 회신 손실 감지(거래소 0125·우편 0167 의 금고 판). _custody 가 gid 를 pending 에 넣고 회신이 delete → 무손실 0 drain. 회신 경로에 손실(ackDropAlalways) 주입 시 그 gid pending 잔존(acked<gives·미해결 격차 가시)·재전송 소스 pendingGive 보관.
function guildbankpending(seeds) {
  console.log('== guildbankpending (0516·#46): saga 미해결 추적·회신 손실 감지 — 무손실 pending 0 drain·손실 시 gid 잔존(acked<gives)·pendingGive 보관. ==');
  console.log('seed   | gives | acked | pending | pendingGive | 판정');
  for (const seed of seeds) {
    const guildOps = [
      { at: 2, op: { type: 'guildCreate', guildId: 'g1', master: 'alice', members: ['alice'] } },
      { at: 3, op: { type: 'guildDeposit', guildId: 'g1', itemId: 'item0', member: 'alice' } },
      { at: 4, op: { type: 'guildDeposit', guildId: 'g1', itemId: 'item1', member: 'alice' } },
    ];
    const items = [{ who: 'alice' }, { who: 'alice' }];
    const normal = runGuildBank({ seed, guildBankSaga: true }, guildOps, items).guild;
    const loss = runGuildBank({ seed, guildBankSaga: true, guildBankAckDropAlways: [0] }, guildOps, items).guild;
    const drained = normal.pending.size === 0 && normal.ackedGives === normal.gives;                    // 무손실 — 미해결 0
    const held = loss.pending.size === 1 && loss.pendingGive.size === 1 && loss.ackedGives === loss.gives - 1;   // 손실 gid0 잔존·재전송 소스 보관
    const ok = check(drained && held, `seed ${seed}: drained${drained}·held${held}(loss pend${loss.pending.size}·acked${loss.ackedGives}/${loss.gives})`);
    console.log(`${pad(seed, 6)} | ${pad(loss.gives, 5)} | ${pad(loss.ackedGives, 5)} | ${pad(loss.pending.size, 7)} | ${pad(loss.pendingGive.size, 11)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

// step-0517 — guildbankresend: 금고 saga 재전송 + 멱등 dedup(거래소 0126·우편 0168 의 금고 판). 일시 회신 손실(ackDrop) 후 guildBankRetry 가 pendingGive 를 같은 gid 로 재발신 → 가방 sagaDedup(replyTo,gid)이 *재실행 없이* 저장된 결과 재회신 → pending drain·escrowXfers 무증가(이중적용 0·아이템 안전).
function guildbankresend(seeds) {
  console.log('== guildbankresend (0517·#46): 재전송+멱등 dedup — 일시 손실 후 guildBankRetry 재발신→가방 dedup 재회신→pending drain·escrowXfers 무증가(재실행 0). ==');
  console.log('seed   | gives | retries | acked | pending | escrowXfers | 판정');
  for (const seed of seeds) {
    const r = runGuildBank({ seed, sagaDedup: true, guildBankSaga: true, guildBankAckDrop: [0] }, [
      { at: 2, op: { type: 'guildCreate', guildId: 'g1', master: 'alice', members: ['alice'] } },
      { at: 3, op: { type: 'guildDeposit', guildId: 'g1', itemId: 'item0', member: 'alice' } },
      { at: 7, op: { type: 'guildBankRetry' } },
    ], [{ who: 'alice' }]);
    const g = r.guild, inv = r.inventory;
    const recovered = g.pending.size === 0 && g.ackedGives === g.gives && g.retries >= 1;   // 재전송이 손실 회신 재유도·미해결 0 drain
    const idempotent = inv.escrowXfers === 1 && inv.ownerOf('item0') === 'escrow';           // dedup — 재전송이 아이템 이중적용 안 함
    const ok = check(recovered && idempotent, `seed ${seed}: recovered${recovered}·idem${idempotent}(ret${g.retries}·xfer${inv.escrowXfers})`);
    console.log(`${pad(seed, 6)} | ${pad(g.gives, 5)} | ${pad(g.retries, 7)} | ${pad(g.ackedGives, 5)} | ${pad(g.pending.size, 7)} | ${pad(inv.escrowXfers, 11)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

// step-0518 — guildbanksagacons: 금고 saga 회계 정합(bankSagaConsistent·거래소 0128·우편 0169 의 금고 판). 두 불변 ① gives==acked+pending(새는 give 0) ② acked==oks+fails(회신 분류 누락 0)이 세 체제(정상 drain·지속 손실 잔존·재전송 회복) 모두서 성립.
function guildbanksagacons(seeds) {
  console.log('== guildbanksagacons (0518·#46): saga 회계 정합 — gives==acked+pending·acked==oks+fails, 정상·손실·재전송 세 체제 모두 성립. ==');
  console.log('seed   | normal | loss | resend | 판정');
  for (const seed of seeds) {
    const base = [
      { at: 2, op: { type: 'guildCreate', guildId: 'g1', master: 'alice', members: ['alice'] } },
      { at: 3, op: { type: 'guildDeposit', guildId: 'g1', itemId: 'item0', member: 'alice' } },
      { at: 4, op: { type: 'guildDeposit', guildId: 'g1', itemId: 'item1', member: 'alice' } },
    ];
    const items = [{ who: 'alice' }, { who: 'alice' }];
    const n = runGuildBank({ seed, guildBankSaga: true }, base, items).guild;                                       // 정상 drain
    const l = runGuildBank({ seed, guildBankSaga: true, guildBankAckDropAlways: [0] }, base, items).guild;          // 지속 손실 잔존
    const rs = runGuildBank({ seed, sagaDedup: true, guildBankSaga: true, guildBankAckDrop: [0] },                 // 재전송 회복
      base.concat([{ at: 8, op: { type: 'guildBankRetry' } }]), items).guild;
    const cn = n.bankSagaConsistent() && n.pending.size === 0, cl = l.bankSagaConsistent() && l.pending.size === 1, cr = rs.bankSagaConsistent() && rs.pending.size === 0;
    const ok = check(cn && cl && cr, `seed ${seed}: normal${cn}·loss${cl}·resend${cr}`);
    console.log(`${pad(seed, 6)} | ${pad(cn ? 'Y' : 'N', 6)} | ${pad(cl ? 'Y' : 'N', 4)} | ${pad(cr ? 'Y' : 'N', 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

// step-0519 — guildbankxfer: 금고↔가방 2-서비스 교차 회계(거래소 0130·우편 0170 의 금고 판). 금고 giveOks == 가방 escrowXfers(두 서비스 escrow 회계 합치·정확히 한 번 이동 증명) AND 아이템 무손실 단일 소유. saga 회신 성공 수와 가방 escrow transfer 수가 정확히 일치.
function guildbankxfer(seeds) {
  console.log('== guildbankxfer (0519·#46): 2-서비스 교차 회계 — 금고 giveOks == 가방 escrowXfers·아이템 단일 소유. 예치/인출 escrow 회계 합치. ==');
  console.log('seed   | giveOks | escrowXfers | minted | 보존 | 판정');
  for (const seed of seeds) {
    const r = runGuildBank({ seed, guildBankSaga: true }, [
      { at: 2, op: { type: 'guildCreate', guildId: 'g1', master: 'alice', members: ['alice'] } },
      { at: 3, op: { type: 'guildDeposit', guildId: 'g1', itemId: 'item0', member: 'alice' } },
      { at: 4, op: { type: 'guildDeposit', guildId: 'g1', itemId: 'item1', member: 'alice' } },
      { at: 6, op: { type: 'guildWithdraw', guildId: 'g1', itemId: 'item0', member: 'alice' } },
    ], [{ who: 'alice' }, { who: 'alice' }]);
    const g = r.guild, inv = r.inventory;
    const cross = g.giveOks === inv.escrowXfers && g.giveOks === 3;                            // 두 서비스 escrow 회계 합치(예치2+인출1)
    const conserved = inv.minted === 2 && inv.ownerOf('item0') === 'alice' && inv.ownerOf('item1') === 'escrow';   // 아이템 무손실·단일 소유(item0 복귀·item1 금고)
    const ok = check(cross && conserved, `seed ${seed}: cross${cross}(oks${g.giveOks}==xfer${inv.escrowXfers})·conserved${conserved}`);
    console.log(`${pad(seed, 6)} | ${pad(g.giveOks, 7)} | ${pad(inv.escrowXfers, 11)} | ${pad(inv.minted, 6)} | ${pad(conserved ? 'Y' : 'N', 4)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

// step-0520 — guildbankcap: 금고↔가방 escrow arc grand capstone(#46 arc 닫기·거래소 0140·우편 0180 의 금고 판). 네 정합층 한 진입점 결합 — ① 물리 이동(아이템 실 가방↔escrow) ② 2-서비스 보존(escrowIds==가방 escrow·bankConsistent) ③ saga 정합(bankSagaConsistent) ④ 교차 회계(giveOks==escrowXfers). 풍부한 연산(다중 길드·예치/인출·saga)서 동시 성립 → 금고가 가방과 실제로 엮여 아이템 권위를 깨지 않음.
function guildbankcap(seeds) {
  console.log('== guildbankcap (0520·#46 arc 닫기): grand capstone — 물리 이동+2-서비스 보존+saga 정합+교차 회계 네 층 동시 성립. 금고↔가방 실연동 완결. ==');
  console.log('seed   | move | conserved | sagaCons | xfer | 판정');
  for (const seed of seeds) {
    const r = runGuildBank({ seed, guildBankSaga: true }, [
      { at: 2, op: { type: 'guildCreate', guildId: 'g1', master: 'alice', members: ['alice'] } },
      { at: 2, op: { type: 'guildCreate', guildId: 'g2', master: 'carol', members: ['carol'] } },
      { at: 3, op: { type: 'guildDeposit', guildId: 'g1', itemId: 'item0', member: 'alice' } },
      { at: 4, op: { type: 'guildDeposit', guildId: 'g1', itemId: 'item1', member: 'alice' } },
      { at: 5, op: { type: 'guildDeposit', guildId: 'g2', itemId: 'item2', member: 'carol' } },
      { at: 7, op: { type: 'guildWithdraw', guildId: 'g1', itemId: 'item0', member: 'alice' } },
    ], [{ who: 'alice' }, { who: 'alice' }, { who: 'carol' }]);
    const g = r.guild, inv = r.inventory;
    const invEscrow = [...inv.ledger].filter(([, v]) => v === 'escrow').map(([k]) => k).sort();
    const move = inv.ownerOf('item0') === 'alice' && inv.ownerOf('item1') === 'escrow' && inv.ownerOf('item2') === 'escrow';   // ① 물리: item0 복귀·item1/item2 금고
    const conserved = JSON.stringify([...g.escrowIds].sort()) === JSON.stringify(invEscrow) && g.bankConsistent();            // ② 2-서비스 보존·단일 소유
    const sagaCons = g.bankSagaConsistent() && g.pending.size === 0;                                                          // ③ saga 회계 정합·drain
    const xfer = g.giveOks === inv.escrowXfers && g.giveOks === 4;                                                            // ④ 교차 회계(예치3+인출1)
    const ok = check(move && conserved && sagaCons && xfer, `seed ${seed}: move${move}·cons${conserved}·saga${sagaCons}·xfer${xfer}(oks${g.giveOks})`);
    console.log(`${pad(seed, 6)} | ${pad(move ? 'Y' : 'N', 4)} | ${pad(conserved ? 'Y' : 'N', 9)} | ${pad(sagaCons ? 'Y' : 'N', 8)} | ${pad(xfer ? 'Y' : 'N', 4)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

// ── CLI (step verify.js 가 위임) ──
const MODES = { reg, wquorum, rank, e2e, sacred, recover, 'recover-rank': recoverRank, 'recover-chat': recoverChat, compact, 'chat-compact': chatCompact, reliable, tail, inflight, degrade, inject, isolate, hide, repro, instanceleave, instancereap, placerebalance, placedrain, cachecapacity, cachetouch, worldwb, worldfsync, loginauth, loginabandon, mze2ecap, bare2ecap, nete2ecap, asynce2ecap, worldcap, upce2ecap, clusterdatacap, coordmergecap, coordcap, promoted16, svcexchangecap, svcexchangexfer, svcmailcap, svcmailxfer, svcguildcap, svcbankcap, svcmailexpire, svcsvccombined, svcexchangecancel, promotedsvc, mailsagatransient, mailsagaunacked, mailsagaabandon, mailsagaabandonpub, mailsagareadmit, mailsagareadmitpub, mailsagapermfail, mailsagafailpub, mailsaga3way, promotedsagaloss, guildbankdeposit, guildbankwithdraw, guildbankconserved, guildbankcrash, guildbanksaga, guildbankpending, guildbankresend, guildbanksagacons, guildbankxfer, guildbankcap };
  const ORDER = ['reg', 'instanceleave', 'instancereap', 'placerebalance', 'placedrain', 'cachecapacity', 'cachetouch', 'worldwb', 'worldfsync', 'loginauth', 'loginabandon', 'wquorum', 'rank', 'e2e', 'sacred', 'recover', 'recover-rank', 'recover-chat',
                 'compact', 'chat-compact', 'reliable', 'tail', 'inflight', 'degrade', 'inject', 'isolate', 'hide', 'repro',
                 'mze2ecap', 'bare2ecap', 'nete2ecap', 'asynce2ecap', 'worldcap', 'upce2ecap', 'clusterdatacap', 'coordmergecap', 'coordcap', 'promoted16', 'svcexchangecap', 'svcexchangexfer', 'svcmailcap', 'svcmailxfer', 'svcguildcap', 'svcbankcap', 'svcmailexpire', 'svcsvccombined', 'svcexchangecancel', 'promotedsvc', 'mailsagatransient', 'mailsagaunacked', 'mailsagaabandon', 'mailsagaabandonpub', 'mailsagareadmit', 'mailsagareadmitpub', 'mailsagapermfail', 'mailsagafailpub', 'mailsaga3way', 'promotedsagaloss', 'guildbankdeposit', 'guildbankwithdraw', 'guildbankconserved', 'guildbankcrash', 'guildbanksaga', 'guildbankpending', 'guildbankresend', 'guildbanksagacons', 'guildbankxfer', 'guildbankcap'];
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
