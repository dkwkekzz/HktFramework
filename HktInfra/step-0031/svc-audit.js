'use strict';
// step-0031 분할 preamble — 박스 1개=파일 1개 (CLAUDE.md 임계 규칙). 진입점 net-core.js 가 묶는다.
// dual-mode: Node require / 브라우저는 common.js 를 <script> 선행 로드(전역 __HktNetCommon).
const __c = (typeof module !== 'undefined' && module.exports && typeof require !== 'undefined')
  ? require('./common.js') : globalThis.__HktNetCommon;
const { Net, LoginServer, SessionRegistry, mulberry32, fnv1a, DEFAULTS } = __c;

// ── [게임 서비스] AuditService — "발행자 무수정으로 추가된 새 소비자"(가설의 핵). 존 tick 밖 *순수 반응형*(onTick 없음). ──
//   svc 토픽 4개를 구독해 서비스 이벤트 스트림을 관찰만 한다 — *발신 0*(net.send 호출이 없다) → 비-침습이 구조적.
//   추가는 버스 구독 테이블 행 + 이 박스뿐 — gateway/inventory/chat 의 spec·코드·발신 스트림은 비트 동일(verify `decouple`).
class AuditService {
  constructor() {
    this.seen = new Map();        // topic -> count (토픽별 수신 회계 — 발행 수와 대조)
    this.records = [];            // 'topic|JSON(ev)' — 관찰 스트림(E2E·repro 다이제스트 대상)
  }
  onMsg(m) {
    const p = m.payload;
    if (p.type !== 'ev') return;
    this.seen.set(p.topic, (this.seen.get(p.topic) || 0) + 1);
    this.records.push(p.topic + '|' + JSON.stringify(p.ev));
  }
}

const __part = { AuditService };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).svc_audit = __part;
