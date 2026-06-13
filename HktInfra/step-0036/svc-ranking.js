'use strict';
// step-0036 분할 preamble — 박스 1개=파일 1개 (CLAUDE.md 임계 규칙). 진입점 net-core.js 가 묶는다.
// dual-mode: Node require / 브라우저는 common.js 를 <script> 선행 로드(전역 __HktNetCommon).
const __c = (typeof module !== 'undefined' && module.exports && typeof require !== 'undefined')
  ? require('./common.js') : globalThis.__HktNetCommon;
const { Net, LoginServer, SessionRegistry, mulberry32, fnv1a, DEFAULTS } = __c;

// ── [게임 서비스] RankingService — "발신하는 둘째 소비자"(이 step 의 한 조각). 존 tick 밖 *순수 반응형*(onTick 없음). ──
//   AuditService(0016)가 *관찰 전용*(발신 0)이라면, 이것은 svc.item.out 을 *소비해* svc.rank.out 을 *발행*하는 consume→publish
//   루프 — 이벤트 기반 *읽기 모델*(CQRS read model). rank = 아바타별 보유 아이템 수의 투영(원장 byOwner 의 파생). 원장에 대한
//   *권위는 없다*(가방이 권위) — item_result 스트림에서 재계산하는 파생 뷰일 뿐. pickup ok → 요청자 +1, give ok → from -1·to +1
//   (실패 give 는 무변경 — p.ok 게이트). 변경된 아바타마다 svc.rank.out 발행 → gateway 가 그 아바타 클라에 rank_update 중계.
//   svc.rank.out 은 *어떤 item 서비스도 안 먹는다* → consume→publish 가 다시 item 이벤트를 안 낳음(루프 없음·발행 유계).
class RankingService {
  constructor(opts = {}) {
    this.bus = opts.bus || null;   // 이벤트 버스 주소(발행/구독 경유 — 소비자/발행자 주소 무지). ranking 은 bus 전제.
    this.ranks = new Map();        // avatar -> count (보유 아이템 수 투영 — 원장 byOwner 크기의 파생, 권위 아님)
    this.consumed = 0;             // svc.item.out 소비 수(발신하는 소비자의 *입력* 회계)
    this.published = 0;            // svc.rank.out 발행 수(consume→publish 의 *출력* 회계 — 변경분만, 유계)
  }
  _bump(avatar, delta) {
    const next = (this.ranks.get(avatar) || 0) + delta;
    if (next <= 0) this.ranks.delete(avatar); else this.ranks.set(avatar, next);
    const count = next <= 0 ? 0 : next;
    // consume→publish — 변경된 아바타의 rank 를 svc.rank.out 으로 발행(소비자 주소 무지). 0건 구독이어도 버스가 폐기(발행자 무관).
    if (this.bus) { this.net.send(this.addr, this.bus, { type: 'pub', topic: 'svc.rank.out', ev: { type: 'rank_update', avatar, count } }); this.published++; }
  }
  onMsg(m) {
    const p = m.payload;
    if (p.type !== 'ev' || p.topic !== 'svc.item.out') return;   // svc.item.out 구독 수신만(가방 결과 스트림)
    const ev = p.ev;
    if (ev.type !== 'item_result' || !ev.ok) return;             // 실패 op 는 원장 무변경 → rank 무변경(p.ok 게이트)
    this.consumed++;
    if (ev.op === 'pickup') this._bump(ev.reqAvatar, +1);
    else if (ev.op === 'give') { this._bump(ev.reqAvatar, -1); this._bump(ev.toAvatar, +1); }   // 쌍 이동 = 두 아바타 rank 변경
  }
  rankOf(avatar) { return this.ranks.get(avatar) || 0; }
  // crash(이 step) — 읽기 모델 프로세스 사망(RAM 소실)의 인프로세스 모델. 투영(ranks)·소비/발행 회계 전부 비운다.
  //   읽기 모델은 *자기 영속이 없다*(원장 권위는 가방) — 그래도 잃을 게 없다: 쓰기 모델의 영속 저널에서 *언제든 재계산* 가능(reconstruct).
  crash() {
    this.ranks = new Map();
    this.consumed = 0; this.published = 0;
  }
  // reconstruct(이 step) — 읽기 모델의 *late-join*: 자기 영속 0 인데도 *쓰기 모델의 영속 저널*(PersistStore)을 replay 해 투영을 재계산한다.
  //   매핑: mint → owner +1, xfer → from -1·to +1 (= item_result pickup/give 투영과 정확히 같다 — 저널은 가방이 *수락한* 효과만 담아
  //   ev.ok 게이트와 1:1). 스냅샷(0018 압축 베이스)이 있으면 폐기된 헤드를 원장 히스토그램으로 대신하고 tail(seq>upToSeq)만 적용.
  //   핵심: 다운타임 동안 버스가 흘려보낸 svc.item.out 은 *놓쳤어도*, 그 효과는 가방이 저널에 영속했으므로 저널 replay 가 *완전한* 투영을
  //   복원한다 — 휘발 스트림이 아니라 *내구 저널*이 복구원(CQRS 읽기 모델은 자기 영속 없이 쓰기 저널로 late-join). 발신 0(replay 와 같은 비-침습).
  reconstruct(journal, snapshot) {
    const counts = new Map();
    const bump = (a, d) => { if (a != null) counts.set(a, (counts.get(a) || 0) + d); };
    if (snapshot) for (const [, owner] of snapshot.ledger) bump(owner, +1);   // 압축된 헤드 = 스냅샷 원장의 보유 수 히스토그램(= byOwner 크기)
    const sorted = (journal || []).slice().sort((a, b) => a.seq - b.seq);
    for (const e of sorted) {
      if (snapshot && e.seq <= snapshot.upToSeq) continue;   // 스냅샷에 이미 반영된 헤드 건너뜀(이중 적용 방지 — 압축 정합)
      if (e.kind === 'mint') bump(e.owner, +1);
      else if (e.kind === 'xfer') { bump(e.from, -1); bump(e.to, +1); }
    }
    this.ranks = new Map();
    for (const [a, n] of counts) if (n > 0) this.ranks.set(a, n);   // n<=0 은 비보유(라이브 _bump 의 delete 규약과 동일) → byOwner 와 정확 일치
  }
}

const __part = { RankingService };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).svc_ranking = __part;
