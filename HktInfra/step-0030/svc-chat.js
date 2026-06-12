'use strict';
// step-0030 분할 preamble — 박스 1개=파일 1개 (CLAUDE.md 임계 규칙). 진입점 net-core.js 가 묶는다.
// dual-mode: Node require / 브라우저는 common.js 를 <script> 선행 로드(전역 __HktNetCommon).
const __c = (typeof module !== 'undefined' && module.exports && typeof require !== 'undefined')
  ? require('./common.js') : globalThis.__HktNetCommon;
const { Net, LoginServer, SessionRegistry, mulberry32, fnv1a, DEFAULTS } = __c;

// ── [게임 서비스] ChatService — 채널 팬아웃(채팅). 존 tick 밖 *순수 반응형*(onTick 없음 = 신성한 tick 밖). 0014 가방의 둘째 판. ──
//   가방이 *원장*(itemId→owner, 단일 소유)이라면 채팅은 *구독 라우팅 테이블*(channel→Set<avatar>, 멀티캐스트 팬아웃)이다.
//   say  = 한 발화를 *그 채널 구독자 전원*(발신자 제외)에게 팬아웃. 비-구독자에게 가는 것은 *구조적으로 불가*(구독 Set 만 순회).
//   whisper = *한 타깃*에게만 직접 라우팅(point-to-point — 구독 무관, byAvatar 로 타깃 게이트웨이 조회).
//   채널: 'global'(전체) · 'region:<r>'(지역 — 같은 region 멤버만) · 'whisper'(귓속말). join 시 global+자기 region 구독.
//   deliveries = 서버 권위 진실(누가 무엇을 받았나) — 클라 belief 의 수렴 대상. seq = 발신자 chat op 카운터(메시지 식별·결정론).
class ChatService {
  constructor(opts = {}) {
    this.gateway = opts.gateway || 'gateway';
    this.bus = opts.bus || null;  // 이벤트 버스 주소(null = 0015 직접 라우팅 비트 동일 — 버스 ON 이면 gateway 주소 미사용)
    this.persist = opts.persist || null;  // 채팅 영속 스토어 주소(0021·null = 0020 비트 동일 — write-behind 커맨드 로그 OFF). 0017 가방 PersistStore 의 채팅 판.
    this.snapInterval = opts.snapshot || 0;  // 커맨드 로그 스냅샷 압축 주기(이 step) — 커맨드 N항목마다 *라우팅 스냅샷* 발신(0 = 0021 비트 동일·압축 휴면).
    this.channels = new Map();    // channel -> Set<avatar> (구독 라우팅 — pub/sub 팬아웃 테이블·SSOT)
    this.byAvatar = new Map();    // avatar -> {gateway, region, subs:Set<channel>} (역인덱스 — whisper 타깃·구독 정리·누설 교차검증)
    this.deliveries = [];         // {to, channel, from, seq} (서버 권위 진실 — 클라 belief 수렴 대상)
    this.journalSeq = 0;          // 커맨드 로그 시퀀스(이 step·event sourcing 의 단조 순번 — replay 순서 보존)
    this.replaying = false;       // 복구 재실행 중 플래그(0021) — true 면 _deliver 가 deliveries/계측만 재현하고 *재발신 0*(net.log 비-기여)
    this.joins = 0; this.says = 0; this.whispers = 0; this.whisperFails = 0; this.fanout = 0;
    this.leaves = 0;              // 실제 탈퇴 누적(이 step) — 압축에도 불변인 *누적 커맨드 회계*(writes==join+say+whisper+leave 완전성 — journal.length 아님)
  }
  _sub(ch, avatar) { if (!this.channels.has(ch)) this.channels.set(ch, new Set()); this.channels.get(ch).add(avatar); }
  _deliver(to, channel, from, seq, gateway) {
    this.deliveries.push({ to, channel, from, seq });
    this.fanout++;
    if (this.replaying) return;   // 복구 재실행(이 step) — deliveries/팬아웃 계측만 재현, *재발신 0*(클라 중복 0·net.log 비-기여)
    // 버스 ON 이면 svc.chat.out 토픽 발행(소비자 주소 무지 — byAvatar.gateway 미사용), OFF 면 0015 직접 라우팅(비트 동일).
    if (this.bus) this.net.send(this.addr, this.bus, { type: 'pub', topic: 'svc.chat.out', ev: { type: 'chat_out', toAvatar: to, channel, from, seq } });
    else this.net.send(this.addr, gateway, { type: 'chat_out', toAvatar: to, channel, from, seq });
  }
  // 커맨드 로그 쓰기(이 step·write-behind) — 처리한 chat 커맨드를 PersistStore 로 fire-and-forget(신성한 tick 밖·ack 비대기).
  //   가방(0017)은 *효과*(mint/xfer)를 적었지만, 채팅은 *커맨드*(join/say/whisper/leave)를 적는다 — 라우팅 의존 팬아웃이라
  //   replay 가 *리듀서를 재실행*해 deliveries 를 재유도(순수 event sourcing). replay 중엔 기록 안 함(this.replaying 가드).
  _journal(entry) {
    if (!this.persist || this.replaying) return;
    this.net.send(this.addr, this.persist, { type: 'journal', entry: { ...entry, seq: this.journalSeq++ } });
    // 스냅샷 압축(이 step) — 커맨드 N항목마다 *라우팅 스냅샷*을 persist 로(write-behind·반응형·onTick 0 유지). persist 가 upToSeq 이하
    //   커맨드를 폐기 → 무한 성장 방지. 라이브 라우팅 비-침습(chatDigest 불변) · 복구는 라우팅 스냅샷 베이스 + tail replay(무손실 압축).
    //   가방(0018)이 *원장 값* 스냅샷이라면, 채팅은 *파생 라우팅 상태*(channels/byAvatar/deliveries/계측) 스냅샷 — 커맨드소싱의 압축 판.
    if (this.snapInterval > 0 && this.journalSeq % this.snapInterval === 0) this._snapshot();
  }
  // 스냅샷 발신(이 step) — 현재 *라우팅 파생 상태*(압축 베이스)를 persist 로. upToSeq = 직전 커맨드 seq(스냅샷이 그 이하 커맨드를 *이미 반영*).
  //   channels/byAvatar(라우팅) + deliveries(서버 권위 진실) + 계측을 함께 — replay 가 이 베이스에서 tail 커맨드만 재실행해 전체-커맨드 replay 와 비트 동일.
  //   Set/Map 은 *삽입 순서* 보존으로 직렬화(say 의 구독자 순회 순서 = deliveries 순서 결정론 — 복원도 동순서).
  _snapshot() {
    this.net.send(this.addr, this.persist, { type: 'snapshot', snap: {
      upToSeq: this.journalSeq - 1,
      channels: [...this.channels.entries()].map(([ch, set]) => [ch, [...set]]),
      byAvatar: [...this.byAvatar.entries()].map(([av, e]) => [av, { gateway: e.gateway, region: e.region, subs: [...e.subs] }]),
      deliveries: this.deliveries.slice(),
      joins: this.joins, says: this.says, whispers: this.whispers, whisperFails: this.whisperFails, fanout: this.fanout, leaves: this.leaves,
    } });
  }
  onMsg(m) {
    let p = m.payload;
    if (p.type === 'ev' && p.topic === 'svc.chat') p = p.ev;   // 버스 봉투 해체(구독 수신) — 직접 모드와 같은 chat_req
    if (p.type !== 'chat_req') return;
    // 정규화 — 페이로드를 *커맨드*(라우팅 무관 식별)로. gateway 주소(join 의 m.from)는 이 시점에만 보이므로 커맨드에 박는다(replay 재현용).
    let op = null;
    if (p.op === 'join') op = { kind: 'join', avatar: p.avatar, region: p.region, gateway: m.from };
    else if (p.op === 'say') op = { kind: 'say', fromAvatar: p.fromAvatar, scope: p.scope, mseq: p.seq };
    else if (p.op === 'whisper') op = { kind: 'whisper', fromAvatar: p.fromAvatar, toAvatar: p.toAvatar, mseq: p.seq };
    else if (p.op === 'leave') op = { kind: 'leave', avatar: p.avatar };
    if (op) this._process(op);
  }
  // _process — 단일 리듀서(이 step). live(onMsg)·복구(replay) *둘 다* 이 함수를 쓴다 → 로직 분기 0(divergence 위험 제거).
  //   상태 변이 + _deliver(팬아웃) + _journal(커맨드 로그·this.replaying 가드로 replay 중엔 기록 0). 0020 onMsg 와 *비트 동일* 동작(persist OFF 면 _journal no-op).
  _process(op) {
    if (op.kind === 'join') {
      const subs = new Set(['global', 'region:' + op.region]);   // 전체 + 자기 지역 채널 구독
      this.byAvatar.set(op.avatar, { gateway: op.gateway, region: op.region, subs });
      for (const ch of subs) this._sub(ch, op.avatar);
      this.joins++;
      this._journal(op);                                         // 가입 효과 — replay 가 이 구독을 재현
    } else if (op.kind === 'say') {
      const me = this.byAvatar.get(op.fromAvatar);
      if (!me) return;                                           // 미가입 발신 — 무시(phantom 0·저널 0)
      const ch = (op.scope === 'global') ? 'global' : 'region:' + me.region;   // 지역 채널은 *발신자 region* 으로 해석(채널 의미는 chat 소유)
      const subs = this.channels.get(ch);
      if (!subs) return;
      for (const a of subs) {                                    // 구독자 Set 순회(삽입 순서 = 결정론) — 비-구독자 도달 구조적 0
        if (a === op.fromAvatar) continue;                       // 발신자 제외(자기 발화 에코 없음)
        const tb = this.byAvatar.get(a);
        if (tb) this._deliver(a, ch, op.fromAvatar, op.mseq, tb.gateway);
      }
      this.says++;
      this._journal(op);                                         // 발화 커맨드 — replay 가 라우팅 재실행으로 deliveries 재유도(순서: 원본 onMsg 와 동일)
    } else if (op.kind === 'whisper') {
      const tb = this.byAvatar.get(op.toAvatar);
      if (tb && op.toAvatar !== op.fromAvatar) {                 // 타깃 1명에게만(point-to-point) — 제3자 도달 0
        this._deliver(op.toAvatar, 'whisper', op.fromAvatar, op.mseq, tb.gateway);
        this.whispers++;
        this._journal(op);                                       // 전달된 귓속말만 저널(미가입/자기자신은 효과 0 — 저널 0)
      } else {
        this.whisperFails++;                                     // 미가입/자기자신 타깃 — 거부(phantom 0·저널 0)
      }
    } else if (op.kind === 'leave') {
      const e = this.byAvatar.get(op.avatar);
      if (e) { for (const ch of e.subs) { const s = this.channels.get(ch); if (s) s.delete(op.avatar); } this.byAvatar.delete(op.avatar); this.leaves++; this._journal(op); }   // 실제 탈퇴만 저널(누적 leaves — 압축 완전성 회계)
    }
  }
  // crash(이 step) — 채팅 프로세스 사망(RAM 소실)의 인프로세스 모델: 라우팅 테이블·역인덱스·deliveries·계측 전부 비운다. PersistStore 는 *별 박스*라 무관.
  crash() {
    this.channels = new Map(); this.byAvatar = new Map(); this.deliveries = [];
    this.joins = 0; this.says = 0; this.whispers = 0; this.whisperFails = 0; this.fanout = 0;
    this.leaves = 0;
    this.journalSeq = 0;
  }
  // replay(이 step) — 커맨드 로그로 채팅 상태를 *재현*(상태 전송 아님 = §4 "복제=재현"). seq 순서대로 _process 재실행 — replaying 플래그로
  //   재발신은 억제하되 라우팅(channels/byAvatar)·deliveries·계측은 *비트 동일* 재구성(가방 replay 가 효과 재적용이라면, 채팅 replay 는 *커맨드 재실행*).
  replay(journal, snapshot) {
    this.replaying = true;
    try {
      const sorted = (journal || []).slice().sort((a, b) => a.seq - b.seq);
      let maxSeq = -1;
      // 스냅샷 베이스(이 step) — 압축으로 폐기된 *헤드 커맨드*를 라우팅 스냅샷이 대신한다(상태 직접 복원). 그 뒤 tail(seq>upToSeq) 커맨드만 _process.
      //   snapshot 없으면(0021 전체 커맨드 로그·압축 OFF) 이 블록 휴면 → 종전 경로와 비트 동일. Set/Map 은 직렬화 순서 그대로 복원(순회 순서 = deliveries 순서).
      if (snapshot) {
        this.channels = new Map((snapshot.channels || []).map(([ch, arr]) => [ch, new Set(arr)]));
        this.byAvatar = new Map((snapshot.byAvatar || []).map(([av, e]) => [av, { gateway: e.gateway, region: e.region, subs: new Set(e.subs) }]));
        this.deliveries = (snapshot.deliveries || []).slice();
        this.joins = snapshot.joins; this.says = snapshot.says; this.whispers = snapshot.whispers;
        this.whisperFails = snapshot.whisperFails; this.fanout = snapshot.fanout; this.leaves = snapshot.leaves || 0;
        maxSeq = snapshot.upToSeq;   // seq 베이스 — tail 이 더 큰 seq 를 가짐
      }
      for (const e of sorted) {
        if (snapshot && e.seq <= snapshot.upToSeq) continue;   // 스냅샷에 이미 반영된 헤드는 건너뜀(압축 정합 — 이중 적용 방지)
        if (e.seq > maxSeq) maxSeq = e.seq; this._process(e);
      }
      this.journalSeq = maxSeq + 1;   // 다음 커맨드 seq = max+1(개수 아님 — 빈칸에도 중복 0)
    } finally {
      this.replaying = false;   // 예외(손상 커맨드)로 중단돼도 *persistent* replaying 플래그를 반드시 해제 — 안 그러면 이후 live 가 재발신/저널 영구 침묵
    }
  }
  subscriberCount(ch) { const s = this.channels.get(ch); return s ? s.size : 0; }
}

const __part = { ChatService };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).svc_chat = __part;
