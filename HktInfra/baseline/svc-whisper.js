'use strict';
// step-0072 — 귓속말 라우터 failover 연속성(whisperFailover): 0071 의 라우터는 queryAddr 를 *고정*(primary 프레즌스 박스)으로 가리켜, primary 사망 후 귓속말 질의가 죽은 박스로 가 끊긴다(0071 §9 — presmon 의 0069 §9 한계가 라우터로 옮겨온 것). 0070 이 presmon 에 준 해법(svc.presence.active 공지→queryAddr 재타깃)을 *라우터*에 적용한다: 승격된 박스가 공지한 새 active 주소를 라우터가 구독해 queryAddr 를 재타깃 → primary 사망 후 귓속말도 승격된 박스로 질의돼 라우팅이 연속된다(읽기 경로 failover 디스커버리의 라우팅 판). 공지 미구독(whisperFailover OFF)이면 재타깃 0 = 0071 비트 동일.
// step-0071 — 귓속말 라우터(whisperRouter): 0069/0070 이 프레즌스 SSOT 의 *질의 인터페이스*(presenceQuery→presenceReply·pull)를 세웠지만, 그 질의자는 presmon(관찰 모델)이었다 — 질의 인터페이스의 *실제 소비자*가 아니라 "질의가 도는가"를 보이는 대역. 이 step 은 그 인터페이스의 첫 *진짜* 소비자를 더한다: 클라가 다른 플레이어에게 귓속말을 보내면, 라우터가 "그가 어디에/어떤 상태인가"를 프레즌스 SSOT 에 질의(pull)하고 그 답으로 *라우팅 결정*을 내린다(up=전달·down/permanent=반송). SPINE 계층5: 프레즌스 SSOT 가 곧 귓속말·파티·핸드오프 라우팅의 단일 조회처라는 큰 그림의 첫 라우팅 소비자. whisperRouter OFF 면 박스 0 = 0070 비트 동일. (분할 preamble: 박스 1개=파일 1개·진입점 net-core.js)
// dual-mode: Node require / 브라우저는 common.js 를 <script> 선행 로드(전역 __HktNetCommon).
const __c = (typeof module !== 'undefined' && module.exports && typeof require !== 'undefined')
  ? require('./common.js') : globalThis.__HktNetCommon;
const { Net, LoginServer, SessionRegistry, mulberry32, fnv1a, DEFAULTS } = __c;

// ── [게임 서비스] WhisperRouter — 귓속말 라우팅의 첫 박스(SPINE 계층3 채팅/소셜 + 계층5 프레즌스 질의 소비). 존 tick 밖 *순수 반응형*(onTick 없음·시뮬 무관). ──
//   클라→라우터: {type:'whisper', to, body} 요청 → 라우터가 프레즌스 SSOT(queryAddr)에 *대상 상태*를 질의(presenceQuery·pull) → 응답(presenceReply)이 오면 보류 귓속말을 라우팅.
//   라우팅 규칙(프레즌스가 결정): state 'up' → 대상에게 전달(whisperDeliver·routed) / 'down'·'permanent' → 반송(bounced·도달 불가). "누가 어디에"의 단일 조회처가 라우팅을 구동한다(SPINE §2 코디네이션 분리 근거의 첫 라우팅 소비자).
//   분리 이유(SPINE §2 판정): 귓속말 팬아웃·라우팅은 존 tick 박자와 무관 — 비동기 서비스. 프레즌스 SSOT 는 *질의*로만 소비(권위 0·은닉: 라우터는 SSOT 내부를 모르고 질의/응답 계약만 안다).
class WhisperRouter {
  constructor(opts = {}) {
    this.queryAddr = opts.queryAddr || null;   // 프레즌스 SSOT 박스 주소(명시 의존·request/reply 경로·0069 인터페이스). null 이면 질의 못 함→전부 보류.
    this.pending = new Map();     // consumer -> [{from, body}] — presenceReply 대기 중인 귓속말(질의↔응답 상관: consumer 키로 묶음).
    this.queriesSent = 0;         // 보낸 presenceQuery 수(계측). repliesRecv = 받은 응답 수(1:1 = 무손실 읽기).
    this.repliesRecv = 0;
    this.routed = 0;              // 전달한 귓속말 수(대상 up·whisperDeliver 발신). bounced = 반송 수(대상 down/permanent).
    this.bounced = 0;
    this.decisions = new Map();   // consumer -> 'routed'|'bounced' — 대상별 최신 라우팅 판정(대시보드·검증 대조).
    this.retargets = 0;           // active 재타깃 수(step-0072·svc.presence.active 공지 수신 — failover 시 1). 미구독이면 0(0071 동일).
  }
  onMsg(m) {
    const p = m.payload;
    // active 재타깃(step-0072·whisperFailover) — 승격된 프레즌스 박스가 svc.presence.active 로 공지한 새 active 주소로 queryAddr 갱신. 이후 귓속말 질의가 승격된 박스로 간다(라우팅 읽기 경로 failover·0070 presmon 재타깃의 라우터 판). 미구독이면 미발화(0071 비트 동일).
    if (p.type === 'ev' && p.topic === 'svc.presence.active' && p.ev) { this.queryAddr = p.ev.addr; this.retargets++; return; }
    // 클라→라우터 귓속말 요청 — 대상 상태를 모르므로 프레즌스 SSOT 에 질의(pull). 응답 올 때까지 보류(consumer 키). queryAddr 없으면 질의 0(전부 영구 보류 = 라우팅 불가의 대조).
    if (p.type === 'whisper') {
      const to = p.to;
      const arr = this.pending.get(to) || []; arr.push({ from: m.from, body: p.body }); this.pending.set(to, arr);
      if (this.queryAddr) { this.net.send(this.addr, this.queryAddr, { type: 'presenceQuery', consumer: to }); this.queriesSent++; }
      return;
    }
    // 프레즌스 SSOT 응답(0069 presenceReply) — 대상 상태로 보류 귓속말을 라우팅. up=전달(whisperDeliver→대상 주소·best-effort), 아니면 반송. 라우팅 결정이 *프레즌스 질의로 구동*된다(이 step 의 핵심).
    if (p.type === 'presenceReply') {
      this.repliesRecv++;
      const arr = this.pending.get(p.consumer) || []; this.pending.delete(p.consumer);
      const deliverable = p.state === 'up';
      for (const w of arr) {
        if (deliverable) { this.net.send(this.addr, p.consumer, { type: 'whisperDeliver', from: w.from, body: w.body }); this.routed++; }
        else this.bounced++;
      }
      this.decisions.set(p.consumer, deliverable ? 'routed' : 'bounced');
      return;
    }
  }
  decisionOf(consumer) { return this.decisions.get(consumer) || null; }
}

const __part = { WhisperRouter };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).svc_whisper = __part;
