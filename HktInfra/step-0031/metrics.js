'use strict';
// step-0031 분할 preamble — 박스 1개=파일 1개 (CLAUDE.md 임계 규칙). 진입점 net-core.js 가 묶는다.
// dual-mode: Node require / 브라우저는 common.js 를 <script> 선행 로드(전역 __HktNetCommon).
const __c = (typeof module !== 'undefined' && module.exports && typeof require !== 'undefined')
  ? require('./common.js') : globalThis.__HktNetCommon;
const { Net, LoginServer, SessionRegistry, mulberry32, fnv1a, DEFAULTS } = __c;

// ── 회계·트루스 헬퍼 (0009 그대로 — 인프로세스/멀티프로세스 재구성 r 둘 다 먹음) ──
function inflightSet(net, zoneObjs) {
  const out = new Set();
  for (const msgs of net.queue.values())
    for (const m of msgs)
      if (m.payload && m.payload.type === 'handoff' && /^zone[12]$/.test(m.to) && !net.delivered.has(m.id)) out.add(m.payload.avatar);
  for (const z of zoneObjs) if (z.isAuthority && z.isAuthority()) for (const rec of z.outbox.values()) out.add(rec.avatar);
  return out;
}
function authorityCount(t, avatar) {
  const c = t.committed.get(avatar) || 0;
  if (c > 0) return c;
  return t.inflight.has(avatar) ? 1 : 0;
}
function replicaDivergence(zoneObjs, followers) {
  const auth = new Map(), foll = new Map();
  for (const z of zoneObjs) if (!z.dead) for (const [id, e] of z.ents) auth.set(id, e.x + ',' + e.y);
  for (const z of followers) if (!z.dead && z.shadow) for (const [id, e] of z.ents) foll.set(id, e.x + ',' + e.y);
  let diff = 0;
  for (const [id, v] of auth) if (foll.get(id) !== v) diff++;
  for (const id of foll.keys()) if (!auth.has(id)) diff++;
  return diff;
}
function globalAoiTruth(r, avatar) {
  const live = liveZones(r);
  let me = null;
  for (const z of live) if (z.ents.has(avatar)) { me = z.ents.get(avatar); break; }
  if (!me) return null;
  const R = r.radius;
  const out = [];
  for (const z of live) for (const [id, e] of z.ents)
    if (Math.max(Math.abs(me.x - e.x), Math.abs(me.y - e.y)) <= R) out.push(id);
  return out.sort();
}
function liveZones(r) { return r.allZones ? r.allZones.filter(z => z.isAuthority()) : r.zones; }
function ownerOf(r, avatar) {
  const live = liveZones(r);
  for (const z of live) if (z.ents.has(avatar)) return z.addr;
  return null;
}

// ── 가방(0014) 회계·트루스 헬퍼 (인프로세스/멀티프로세스 재구성 r 둘 다 먹음) ──
// 원장 보존 — 아이템은 소멸 없음·이동만 → ledger.size == minted (dupe·loss 0). 전송 열화에도 불변(idempotent).
function itemConserved(r) { return !!r.inventory && r.inventory.ledger.size === r.inventory.minted; }
// 트랜잭션 정합 — 원장(itemId→owner) ≡ byOwner 역인덱스(owner→Set). 비-원자 give 면 둘이 어긋난다.
function ledgerConsistent(r) {
  if (!r.inventory) return true;
  const inv = r.inventory;
  let total = 0;
  for (const [owner, set] of inv.byOwner) {
    total += set.size;
    for (const id of set) if (inv.ledger.get(id) !== owner) return false;   // byOwner 가 원장과 불일치
  }
  if (total !== inv.ledger.size) return false;                              // 합이 원장 크기와 다름(중복/누락)
  for (const [id, owner] of inv.ledger) { const s = inv.byOwner.get(owner); if (!s || !s.has(id)) return false; }
  return true;
}
// 아이템 단일 소유(belief 기준) — 수렴 후 어떤 itemId 도 두 클라가 동시에 소유 믿지 않음(=1). split-brain 검출.
function maxItemBeliefOwners(r) {
  const cnt = new Map();
  for (const c of r.clients) for (const id of (c.items || [])) cnt.set(id, (cnt.get(id) || 0) + 1);
  let mx = 0; for (const v of cnt.values()) if (v > mx) mx = v;
  return mx;
}
// 아이템 수렴(desync) — 클라 belief 가 원장 진실(자기 avatar 소유분)과 일치하는가. 행복 경로 수렴 후 0.
function itemDesync(r) {
  if (!r.inventory) return 0;
  const truth = new Map();
  for (const [id, owner] of r.inventory.ledger) { if (!truth.has(owner)) truth.set(owner, new Set()); truth.get(owner).add(id); }
  let d = 0;
  for (const c of r.clients) {
    if (!c.avatar) continue;
    const own = truth.get(c.avatar) || new Set();
    const belief = c.items instanceof Set ? c.items : new Set(c.items || []);
    if (own.size !== belief.size) { d++; continue; }
    let same = true; for (const id of own) if (!belief.has(id)) { same = false; break; }
    if (!same) d++;
  }
  return d;
}
function invDigest(r) {
  if (!r.inventory) return fnv1a('no-inventory');
  const led = [...r.inventory.ledger.entries()].map(([id, o]) => id + '=' + o).sort().join('|');
  return fnv1a(led + '#m' + r.inventory.minted + ';t' + r.inventory.transfers);
}

// ── 랭킹(0019) 회계·트루스 헬퍼 (발신하는 둘째 소비자 — 읽기 모델 정합) ──
// 원장에서 파생한 *진실* rank — avatar→보유 아이템 수(byOwner 크기). ranking.ranks 의 수렴 대상(읽기 모델 ≡ 쓰기 모델).
function ledgerCounts(r) {
  const c = new Map();
  if (r.inventory) for (const owner of r.inventory.ledger.values()) c.set(owner, (c.get(owner) || 0) + 1);
  return c;
}
// 프로젝션 정합 — ranking.ranks 가 원장 byOwner 크기와 *정확히 일치*(누락·과잉 0). consume→publish 가 이벤트 전수를 순서대로 반영.
function rankProjectionFaithful(r) {
  if (!r.ranking) return true;
  const truth = ledgerCounts(r);
  const ranks = r.ranking.ranks;
  for (const [a, n] of truth) if ((ranks.get(a) || 0) !== n) return false;   // 진실에 있는데 rank 가 다름
  for (const [a, n] of ranks) if (n !== (truth.get(a) || 0)) return false;    // rank 에 있는데 진실과 다름(과잉)
  return true;
}
// rank 수렴(desync) — 클라 rankBelief 가 원장 진실(자기 보유 수)과 일치하는가. happy path 수렴 후 0.
//   주의: rank_update 를 한 번도 못 받은 클라(보유 0·이벤트 없음)는 belief=null·진실 0 → 일치로 간주(미발신=무변경).
function rankDesync(r) {
  if (!r.ranking) return 0;
  const truth = ledgerCounts(r);
  let d = 0;
  for (const c of r.clients) {
    if (!c.avatar) continue;
    const t = truth.get(c.avatar) || 0;
    const b = (c.rankBelief == null) ? 0 : c.rankBelief;
    if (t !== b) d++;
  }
  return d;
}
// 랭킹 다이제스트 — rank 테이블(SSOT) + 소비/발행 회계. E2E·repro 비트 동일의 대상.
function rankDigest(r) {
  if (!r.ranking) return fnv1a('no-ranking');
  const rt = [...r.ranking.ranks.entries()].map(([a, n]) => a + '=' + n).sort().join('|');
  return fnv1a(rt + ';c' + r.ranking.consumed + ';p' + r.ranking.published);
}

// ── 영속(0017) 회계·트루스 헬퍼 (인프로세스/멀티프로세스 재구성 r 둘 다 먹음) ──
// 영속 저널 다이제스트 — 효과 로그(seq 순서)의 비트열. crash+replay 가 투명하면 restart 유무에 불변(저널은 가방 죽음과 독립).
function persistDigest(r) {
  if (!r.persist) return fnv1a('no-persist');
  const j = (r.persist.journal || []).slice().sort((a, b) => a.seq - b.seq)
    .map(e => e.seq + ':' + e.kind + ':' + (e.itemId || '') + ':' + (e.owner || (e.from + '>' + e.to))).join('|');
  // 스냅샷(이 step) 포함 — 압축 베이스(upToSeq + 원장)도 비트열에. 압축 OFF 면 'nosnap'(0017 의미와 호환). E2E/repro 강화.
  const s = r.persist.snapshot;
  const snap = s ? ('S' + s.upToSeq + ':' + s.ledger.map(([i, o]) => i + '=' + o).sort().join(',')) : 'nosnap';
  return fnv1a(j + '#w' + (r.persist.writes || 0) + '#' + snap);
}
// 채팅 커맨드 로그 다이제스트(이 step) — 채팅 영속 저널(seq 순서 커맨드열)의 비트열. crash+replay 가 투명하면 restart 유무에 불변(저널은 채팅 죽음과 독립).
function chatPersistDigest(r) {
  if (!r.chatpersist) return fnv1a('no-chatpersist');
  const j = (r.chatpersist.journal || []).slice().sort((a, b) => a.seq - b.seq)
    .map(e => e.seq + ':' + e.kind + ':' + (e.avatar || e.fromAvatar || '') + ':' + (e.toAvatar || e.scope || e.region || '') + ':' + (e.mseq != null ? e.mseq : '')).join('|');
  // 라우팅 스냅샷(이 step) 포함 — 압축 베이스(upToSeq + 구독 라우팅 + deliveries 수 + 계측)도 비트열에. 압축 OFF 면 'nosnap'(0021 의미와 호환). E2E/repro 강화.
  const s = r.chatpersist.snapshot;
  const snap = s ? ('S' + s.upToSeq + ':' + (s.channels || []).map(([ch, arr]) => ch + '=' + arr.join(',')).join(';') + ':d' + s.deliveries.length + ':j' + s.joins + 's' + s.says + 'w' + s.whispers) : 'nosnap';
  return fnv1a(j + '#w' + (r.chatpersist.writes || 0) + '#' + snap);
}
// 채팅 커맨드 로그 완전성(이 step·압축-인지) — 영속된 커맨드 누적 수(writes) == 채팅이 *기록한 커맨드* 누적(join+say+whisper+leave 효과 합).
//   압축으로 journal.length 가 줄어도 writes 는 누적 진실이므로 불변(압축은 *보관*을 줄일 뿐 영속된 커맨드 수는 안 줄인다) — 0018 journalComplete 의 채팅 판.
//   압축 OFF(0021)면 writes==journal.length 라 종전 의미 호환. (whisperFail/미가입 say 는 효과 0 = 저널 0 → 합산 제외.)
function chatJournalComplete(r) {
  if (!r.chatpersist || !r.chat) return true;
  return (r.chatpersist.writes || 0) === (r.chat.joins + r.chat.says + r.chat.whispers + r.chat.leaves);
}
// 저널 완전성 — 영속된 변이 *누적* 수(writes) == 가방이 수락한 변이 수(mint+transfer). 압축으로 journal.length 가 줄어도 writes 는 누적
//   진실이므로 불변(압축은 *보관*을 줄일 뿐 *영속된 변이 수*는 안 줄인다). 0017(압축 OFF)에선 writes==journal.length 라 비트 동일.
function journalComplete(r) {
  if (!r.persist || !r.inventory) return true;
  return (r.persist.writes || 0) === (r.inventory.minted + r.inventory.transfers);
}

// ── 채팅(0015) 회계·트루스 헬퍼 (인프로세스/멀티프로세스 재구성 r 둘 다 먹음) ──
// 서버 권위 진실 — 의도된 배달 집합 D = {to|channel|from|seq}. 클라 belief 의 수렴 대상.
function _chatDeliverySet(r) { return new Set((r.chat.deliveries || []).map(d => d.to + '|' + d.channel + '|' + d.from + '|' + d.seq)); }
// 클라 belief 집합 B = ∪{avatar|channel|from|seq}. chat_msg 로만 채워짐(Set → dup 멱등).
function _chatBeliefSet(r) {
  const B = new Set();
  for (const c of r.clients) { if (!c.avatar) continue; const recv = c.chatRecv || []; for (const k of recv) B.add(c.avatar + '|' + k); }
  return B;
}
// 완전성(수렴) — |D \ B| = 의도됐으나 클라에 미도달한 배달 수. happy path(무손실) 0. 전송 열화면 graceful >0(best-effort).
function chatDesync(r) {
  if (!r.chat) return 0;
  const B = _chatBeliefSet(r); let miss = 0;
  for (const d of r.chat.deliveries) { if (!B.has(d.to + '|' + d.channel + '|' + d.from + '|' + d.seq)) miss++; }
  return miss;
}
// phantom — |B \ D| = 서버가 안 보낸 걸 클라가 믿는 수. 구조적 0(belief 는 서버 chat_msg 로만, 재전송 dup 은 Set 멱등).
function chatPhantom(r) {
  if (!r.chat) return 0;
  const D = _chatDeliverySet(r); let ph = 0;
  for (const c of r.clients) { if (!c.avatar) continue; for (const k of (c.chatRecv || [])) if (!D.has(c.avatar + '|' + k)) ph++; }
  return ph;
}
// 누설 — 비-구독자 도달 + 지역 격리 위반 수(둘 다 구조적 0이어야). 구독 테이블 교차검증(say 는 구독 Set 만 순회 = 구조적 보장).
//   region:X 배달의 수신자 region 이 X 가 아니면 격리 위반. whisper 는 구독 무관(직접 라우팅) → 누설 검사 제외.
//   주의 ① 수신자가 이후 disconnect 하면 byAvatar 에서 pruned(op:'leave') → 사후 재검증 불가. 배달 *시점*엔 구독자였음(팬아웃이
//        channels[ch] Set 만 순회 = 비-구독자 배달 구조적 불가)이므로 *현재 부재* 수신자는 skip(이력 deliveries vs live 테이블 불일치
//        false-positive 방지). ② 위반은 *배달당 1*만 — 비-구독자면 그걸로 카운트하고(else-if), 구독 중인데 region 불일치(상태 손상)는
//        교차검증으로만 카운트(이중 집계 방지). region:X 구독은 join 이 X 멤버에게만 부여하므로 보통 redundant — 손상 탐지용.
function chatLeak(r) {
  if (!r.chat) return 0;
  let leak = 0;
  for (const d of r.chat.deliveries) {
    if (d.channel === 'whisper') continue;
    const e = r.chat.byAvatar.get(d.to);
    if (!e) continue;                                                        // disconnect 로 pruned — 배달 시점 구독자였음(skip)
    if (!e.subs.has(d.channel)) leak++;                                      // 비-구독자에게 배달(구조적 0)
    else if (d.channel.startsWith('region:') && e.region !== d.channel.slice(7)) leak++;   // 구독 ≠ region(상태 손상) 교차검증
  }
  return leak;
}
// whisper 프라이버시(카디널리티) — whisper 배달 수 == chat.whispers(팬아웃 1 = 제3자 0). *타깃 정확성*은 별도로 보장된다:
//   _deliver 가 같은 p.toAvatar 를 *조회(byAvatar)와 기록(record.to) 양쪽*에 단일 소스로 써(오라우팅 불가) + phantom(B⊆D)가
//   "타깃 아닌 클라가 그 whisper 를 믿으면" 잡는다. 이 함수는 그중 *팬아웃이 1을 넘지 않음*(브로드캐스트 누설)만 본다.
function chatWhisperPrivate(r) {
  if (!r.chat) return true;
  const wd = r.chat.deliveries.filter(d => d.channel === 'whisper').length;
  return wd === r.chat.whispers;
}
// 채널 누락 — 클라가 받은 채널이 자기 구독(또는 귓속말 타깃)에 모두 부합하는가(클라 측 누설 0 교차검증).
//   chatLeak 과 같은 disconnect 주의 — byAvatar pruned 된 클라(연결 중 정당 수신 후 떠남)는 skip(false-positive 방지).
function chatClientNoLeak(r) {
  if (!r.chat) return true;
  for (const c of r.clients) {
    if (!c.avatar) continue;
    const e = r.chat.byAvatar.get(c.avatar);
    if (!e) continue;                                 // disconnect 로 pruned — 수신은 연결 중 정당했음(skip)
    for (const k of (c.chatRecv || [])) {
      const ch = k.split('|')[0];
      if (ch === 'whisper') continue;                 // 귓속말은 구독 무관(타깃 수신 — phantom 검사가 정당성 보증)
      if (!e.subs.has(ch)) return false;              // 구독 안 한 채널 메시지 수신 = 누설
    }
  }
  return true;
}
function chatDigest(r) {
  if (!r.chat) return fnv1a('no-chat');
  const dl = (r.chat.deliveries || []).map(d => d.to + '|' + d.channel + '|' + d.from + '|' + d.seq).sort().join('#');
  return fnv1a(dl + ';j' + r.chat.joins + ';s' + r.chat.says + ';w' + r.chat.whispers + ';f' + r.chat.fanout);
}

// ── 이벤트 버스(0016) 회계·트루스 헬퍼 (인프로세스/멀티프로세스 재구성 r 둘 다 먹음) ──
// 버스 다이제스트 — 구독 라우팅 테이블(SSOT) + 발행/팬아웃 회계. E2E·repro 비트 동일의 대상.
function busDigest(r) {
  if (!r.bus) return fnv1a('no-bus');
  const tt = [...r.bus.topics.entries()].map(([t, arr]) => t + '=' + arr.join(',')).sort().join('|');
  return fnv1a(tt + ';p' + r.bus.publishes + ';d' + r.bus.deliveries + ';u' + r.bus.unrouted);
}
// 감사(새 소비자) 다이제스트 — 관찰한 ev 스트림 전문. E2E·repro 비트 동일의 대상.
function auditDigest(r) {
  if (!r.audit) return fnv1a('no-audit');
  return fnv1a(r.audit.records.join('\n') + ';n' + r.audit.records.length);
}
// gateway↔service *직접* 메시지 수 — 버스 ON 이면 0(N×N 직접 결합의 구조적 제거를 net.log 로 증명), OFF 면 >0(대조).
function directSvcMsgs(r) {
  return r.net.log.filter(m =>
    (m.from === 'gateway' && (m.to === 'inventory' || m.to === 'chat')) ||
    ((m.from === 'inventory' || m.from === 'chat') && m.to === 'gateway')).length;
}
// 발신자별 발신 스트림 다이제스트(from 고정·내용+순서) — "새 소비자 추가 = 발행자 무수정"을 발신 비트열로 증명(audit on/off 불변).
function senderDigest(r, from) {
  return fnv1a(r.net.log.filter(m => m.from === from).map(m => m.from + '>' + m.to + ':' + JSON.stringify(m.payload)).join('\n'));
}
// 토픽별 발행 수(net.log 기준) — audit.seen 과 대조(소비자가 발행 전수를 받았는가).
function topicPublishCount(r, topic) {
  return r.net.log.filter(m => m.to === 'bus' && m.payload && m.payload.type === 'pub' && m.payload.topic === topic).length;
}

const __part = { inflightSet, authorityCount, replicaDivergence, globalAoiTruth, liveZones, ownerOf, itemConserved, ledgerConsistent, maxItemBeliefOwners, itemDesync, invDigest, ledgerCounts, rankProjectionFaithful, rankDesync, rankDigest, persistDigest, chatPersistDigest, chatJournalComplete, journalComplete, chatDesync, chatPhantom, chatLeak, chatWhisperPrivate, chatClientNoLeak, chatDigest, busDigest, auditDigest, directSvcMsgs, senderDigest, topicPublishCount };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).metrics = __part;
