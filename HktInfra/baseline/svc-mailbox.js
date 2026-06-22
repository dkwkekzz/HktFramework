'use strict';
// step-0076 — 전달 영수증(whisperReceipt) 수신측 박스 Mailbox: 0071~0075 의 라우터는 라우팅 *결정*(up 전달·down 반송)까지만 견고했고, whisperDeliver 자체는 best-effort 였다 — 보낸 순간 routed++ 로 세고 *대상이 실제로 받았는지*는 확인 안 했다(0075 §9). 이 step 은 전달의 *수신 확인 고리*를 더한다: 라우터가 whisperDeliver 에 {seq, ackTo} 를 실어 보내면, 수신측 Mailbox 가 받아 inbox 에 적재하고 ackTo(라우터)로 whisperAck{seq} 를 회신한다 → 라우터가 delivered(확인) 를 센다. 0057 recoverAck(치유 확인 고리)의 *전달* 판. whisperReceipt OFF 면 이 박스 부재·ackTo 없음 = 0075 비트 동일.
// dual-mode: Node require / 브라우저는 common.js 를 <script> 선행 로드(전역 __HktNetCommon).
const __c = (typeof module !== 'undefined' && module.exports && typeof require !== 'undefined')
  ? require('./common.js') : globalThis.__HktNetCommon;
const { Net, LoginServer, SessionRegistry, mulberry32, fnv1a, DEFAULTS } = __c;

// ── [게임 서비스] Mailbox — 귓속말 *수신측* 박스(SPINE 계층3 채팅/소셜). 존 tick 밖 *순수 반응형*(onTick 없음·권위=수신함만). ──
//   whisperDeliver{from, body, seq, ackTo} 수신 → inbox 적재(received++) + ackTo 가 있으면 whisperAck{seq} 회신(전달 영수증). ackTo 없으면(0075 이전 best-effort) 적재만(ack 0).
//   분리 이유(SPINE §2 판정): 귓속말 수신·확인은 존 tick 박자와 무관 — 비동기. 라우터(WhisperRouter)와는 명시 메시지 계약(whisperDeliver/whisperAck)만 공유(은닉). 0069 프레즌스·0075 멤버십과 같은 request/reply 패턴의 *전달 확인* 판.
class Mailbox {
  constructor(opts = {}) {
    this.inbox = [];        // 받은 귓속말 [{from, body}] — 수신함.
    this.received = 0;      // 받은 whisperDeliver 수(계측).
    this.acks = 0;          // 회신한 whisperAck 수(계측·ackTo 있을 때만).
  }
  onMsg(m) {
    const p = m.payload;
    // 귓속말 전달 수신 — 적재 후 ackTo(라우터)로 영수증 회신. ackTo/seq 없으면(best-effort·0075 이하) 적재만(ack 미발신 = 영수증 없는 전달의 대조).
    if (p.type === 'whisperDeliver') {
      this.received++; this.inbox.push({ from: p.from, body: p.body });
      if (p.ackTo && p.seq != null) { this.net.send(this.addr, p.ackTo, { type: 'whisperAck', seq: p.seq }); this.acks++; }
      return;
    }
  }
}

const __part = { Mailbox };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).svc_mailbox = __part;
