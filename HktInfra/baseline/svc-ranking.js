'use strict';
// step-0061 — 대체 소비자 자동 활성화(spawnReplace): RankingService 인스턴스가 replaceTarget 을 받으면 *대기(standby)* 소비자가 되어 svc.presence 만 구독한다. orch 가 그 대상을 'permanent'(포기)로 발행하면 스스로 svc.item.out 에 재구독해 죽은 소비자의 역할을 이어받는다(존 shadow follower 승격의 서비스 판). 0060 의 'permanent' 신호에 *행동하는* 첫 반응자. (분할 preamble: 박스 1개=파일 1개·진입점 net-core.js)
// dual-mode: Node require / 브라우저는 common.js 를 <script> 선행 로드(전역 __HktNetCommon).
const __c = (typeof module !== 'undefined' && module.exports && typeof require !== 'undefined')
  ? require('./common.js') : globalThis.__HktNetCommon;
const { Net, LoginServer, SessionRegistry, mulberry32, fnv1a, DEFAULTS } = __c;

// ── [게임 서비스] RankingService — "발신하는 둘째 소비자". 존 tick 밖 *순수 반응형*(onTick 없음). ──
//   AuditService(0016)가 *관찰 전용*(발신 0)이라면, 이것은 svc.item.out 을 *소비해* svc.rank.out 을 *발행*하는 consume→publish
//   루프 — 이벤트 기반 *읽기 모델*(CQRS read model). rank = 아바타별 보유 아이템 수의 투영(원장 byOwner 의 파생). 원장에 대한
//   *권위는 없다*(가방이 권위) — item_result 스트림에서 재계산하는 파생 뷰일 뿐. pickup ok → 요청자 +1, give ok → from -1·to +1
//   (실패 give 는 무변경 — p.ok 게이트). 변경된 아바타마다 svc.rank.out 발행 → gateway 가 그 아바타 클라에 rank_update 중계.
class RankingService {
  constructor(opts = {}) {
    this.bus = opts.bus || null;   // 이벤트 버스 주소(발행/구독 경유 — 소비자/발행자 주소 무지). ranking 은 bus 전제.
    this.ranks = new Map();        // avatar -> count (보유 아이템 수 투영 — 원장 byOwner 크기의 파생, 권위 아님)
    this.consumed = 0;             // svc.item.out 소비 수(발신하는 소비자의 *입력* 회계)
    this.published = 0;            // svc.rank.out 발행 수(consume→publish 의 *출력* 회계 — 변경분만, 유계)
    // ── 다중 소비자 min-워터마크의 *소비자 측*(busMinWm) — ranking 도 게이트웨이처럼 결과를 ack 하는 1급 소비자. ──
    this.busMinWm = opts.busMinWm || false;
    this.outFrontier = -1;         // 소비 확인 outSeq 워터마크(단조) — 이하 재배달은 멱등 폐기·ack 의 frontier.
    this.dropRecover = opts.dropRecover || 0;   // 처음 N개 recover 를 떨군다(step-0058·명령 분실 주입) — 재구독·ack 안 함 → orch 재시도 자극. 0 면 0057 동일.
    this.recoverDropped = 0;       // 떨군 recover 수(계측).
    // 대체 소비자 자동 활성화(step-0061·spawnReplace) — replaceTarget 이 설정된 인스턴스는 *대기(standby)* 소비자: 초기엔 svc.item.out 을 구독하지 않고(토폴로지가 svc.presence 만 구독시킴) svc.presence 의 'permanent' 신호만 듣는다. 그 대상이 영구 down 으로 발행되면 자기 활성화(스스로 svc.item.out 재구독→역할 인계). null 이면 정규 소비자(0060 동일·이 분기 휴면).
    this.replaceTarget = opts.replaceTarget || null;
    this.activated = false;        // 활성화 1회 가드(중복 sub 억제) — permanent 한 번만 인계.
    this.activatedAt = -1;         // 활성화 tick(계측) — 미활성이면 -1.
  }
  _bump(avatar, delta) {
    const next = (this.ranks.get(avatar) || 0) + delta;
    if (next <= 0) this.ranks.delete(avatar); else this.ranks.set(avatar, next);
    const count = next <= 0 ? 0 : next;
    if (this.bus) { this.net.send(this.addr, this.bus, { type: 'pub', topic: 'svc.rank.out', ev: { type: 'rank_update', avatar, count } }); this.published++; }
  }
  onMsg(m) {
    const p = m.payload;
    // 프레즌스 반응의 소비자 측(step-0056·busPresenceRecover) — 코디네이션(orch)이 "너 down 으로 보인다"며 보낸 recover 명령에, 소비자가 *스스로* 버스에 재구독(sub)한다.
    //   재구독은 *구독자 자신*이 보내야 라우팅이 맞다(0034 버스 failover 의 "진실 원천=소비자"와 동형 — orch 가 대신 sub 하면 orch 가 구독자로 등록됨, 0055 §9 난점). 재구독 후 결과 스트림 재개 → 재-ack → 가방 재admission → self-healing 고리 닫힘.
    //   recover 메시지는 orch 가 busPresenceRecover ON 일 때만 발신 → OFF 면 이 분기 미발화 = 0055 비트 동일(handler 는 항상 존재하나 trigger 0).
    if (p.type === 'recover' && this.bus) {
      // 명령 분실 주입(step-0058·dropRecover) — 처음 N개 recover 를 떨군다(재구독·ack 0): orch 가 ack 못 받아 recoverTimeout 뒤 재발신. 분실에도 치유가 수렴하는지 자극. 0 이면 즉시 처리(0057 동일).
      if (this.dropRecover > 0) { this.dropRecover--; this.recoverDropped++; return; }
      this.net.send(this.addr, this.bus, { type: 'sub', topic: p.topic || 'svc.item.out' });   // 자기 재구독(라우팅 권위=구독자)
      this.net.send(this.addr, m.from, { type: 'recoverAck', consumer: this.addr });             // 치유 확인 회신(step-0057) — 명령 보낸 orch(m.from)에 "받아서 재구독함" 통보. orch 가 명령 전달·수행을 안다(분실 0 이면 acks==commands).
      this.resubs = (this.resubs || 0) + 1; return;
    }
    // 대체 소비자 자동 활성화(step-0061·spawnReplace) — 0060 이 'permanent'(포기) 판정을 svc.presence 로 발행했다(반응 로직과 치유 로직 분리). 이 standby 는 그 신호를 구독해, 자기 replaceTarget 이 영구 down 으로 발행되면 *스스로* svc.item.out 에 재구독해 죽은 소비자의 역할을 이어받는다 — 존 shadow follower 승격(0009)의 서비스 판(사전 등록된 대기 액터가 발행 신호에 활성화). 'down'(일시 의심)·'up'(회복)은 무시: permanent 만이 "대체하라". 1회 활성(activated 가드). replaceTarget 미설정이면 이 분기 미발화 = 정규 소비자.
    if (this.replaceTarget && p.type === 'ev' && p.topic === 'svc.presence' && p.ev &&
        p.ev.kind === 'permanent' && p.ev.consumer === this.replaceTarget && !this.activated) {
      this.activated = true;
      this.activatedAt = (m.tick !== undefined) ? m.tick : 0;
      if (this.bus) this.net.send(this.addr, this.bus, { type: 'sub', topic: 'svc.item.out' });   // 자기 재구독(라우팅 권위=구독자, 0034 와 동형) → 이후 결과 스트림 인계
      return;
    }
    if (p.type !== 'ev' || p.topic !== 'svc.item.out') return;   // svc.item.out 구독 수신만(가방 결과 스트림)
    const ev = p.ev;
    if (this.busMinWm && ev.outSeq !== undefined) {
      if (ev.outSeq <= this.outFrontier) return;   // 이미 소비(재발행×live 중복) — 멱등 폐기(counts 이중 적용 0)
      this.outFrontier = ev.outSeq;
      if (this.bus) this.net.send(this.addr, this.bus, { type: 'pub', topic: 'svc.item.out.ack', ev: { outSeq: ev.outSeq, consumer: 'ranking' } });
    }
    if (ev.type !== 'item_result' || !ev.ok) return;             // 실패 op 는 원장 무변경 → rank 무변경(p.ok 게이트)
    this.consumed++;
    if (ev.op === 'pickup') this._bump(ev.reqAvatar, +1);
    else if (ev.op === 'give') { this._bump(ev.reqAvatar, -1); this._bump(ev.toAvatar, +1); }   // 쌍 이동 = 두 아바타 rank 변경
  }
  rankOf(avatar) { return this.ranks.get(avatar) || 0; }
  // crash — 읽기 모델 프로세스 사망(RAM 소실)의 인프로세스 모델. 투영·소비/발행 회계 전부 비운다.
  crash() {
    this.ranks = new Map();
    this.consumed = 0; this.published = 0;
    this.outFrontier = -1;
  }
  // reconstruct — 읽기 모델의 *late-join*: 자기 영속 0 인데도 *쓰기 모델의 영속 저널*(PersistStore)을 replay 해 투영을 재계산.
  //   매핑: mint → owner +1, xfer → from -1·to +1 (= item_result pickup/give 투영과 정확히 같다). 스냅샷이 있으면 폐기된 헤드를 원장 히스토그램으로 대신하고 tail(seq>upToSeq)만 적용.
  //   핵심: 다운타임 동안 버스가 흘려보낸 svc.item.out 은 *놓쳤어도*, 그 효과는 가방이 저널에 영속했으므로 저널 replay 가 *완전한* 투영을 복원한다.
  reconstruct(journal, snapshot) {
    const counts = new Map();
    const bump = (a, d) => { if (a != null) counts.set(a, (counts.get(a) || 0) + d); };
    if (snapshot) for (const [, owner] of snapshot.ledger) bump(owner, +1);
    const sorted = (journal || []).slice().sort((a, b) => a.seq - b.seq);
    for (const e of sorted) {
      if (snapshot && e.seq <= snapshot.upToSeq) continue;
      if (e.kind === 'mint') bump(e.owner, +1);
      else if (e.kind === 'xfer') { bump(e.from, -1); bump(e.to, +1); }
    }
    this.ranks = new Map();
    for (const [a, n] of counts) if (n > 0) this.ranks.set(a, n);
  }
}

const __part = { RankingService };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).svc_ranking = __part;
