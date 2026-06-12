'use strict';
// step-0030 분할 preamble — 박스 1개=파일 1개 (CLAUDE.md 임계 규칙). 진입점 net-core.js 가 묶는다.
// dual-mode: Node require / 브라우저는 common.js 를 <script> 선행 로드(전역 __HktNetCommon).
const __c = (typeof module !== 'undefined' && module.exports && typeof require !== 'undefined')
  ? require('./common.js') : globalThis.__HktNetCommon;
const { Net, LoginServer, SessionRegistry, mulberry32, fnv1a, DEFAULTS } = __c;

// ── [버스] ServiceBus — 이벤트 버스의 *서비스 의미*(이 step 의 한 조각). 존 tick 밖 *순수 반응형*(onTick 없음). ──
//   0012 토픽 버스가 *전송*(broker 프레임 라우팅)이라면 이것은 *서버간 발행/구독 계약* — 발행자는 토픽만 알고
//   소비자 주소·존재를 모른다(구독자 0 이면 폐기). 라우팅 테이블 Map<topic, [subscriber...]> 이 SSOT — pub 은 그 토픽
//   구독자 *전부*에게 ev 사본을 팬아웃(배열 등록 순서 = 결정론 팬아웃 순서). 채팅의 channel→Set<avatar>(클라 단위)와
//   같은 자료구조 패턴의 *서버 박스 단위* 판. 구독은 토폴로지 빌더의 선언 spec(opts.subs)으로 — 새 소비자 추가 =
//   이 테이블에 행 추가뿐(발행자 spec·코드 무수정 — verify `decouple` 이 수치로 증명).
class ServiceBus {
  constructor(opts = {}) {
    this.topics = new Map();      // topic -> [subscriberAddr...] (구독 라우팅 테이블 — SSOT·등록 순서 = 팬아웃 순서)
    this.publishes = 0;           // pub 수신 수
    this.deliveries = 0;          // 구독자 전달 사본 수(팬아웃)
    this.unrouted = 0;            // 구독자 0 토픽 발행(폐기) — 발행자는 소비자 존재를 모른다는 의미의 회계
    if (opts.subs) for (const [topic, addr] of opts.subs) this._sub(topic, addr);
  }
  _sub(topic, addr) {
    if (!this.topics.has(topic)) this.topics.set(topic, []);
    const arr = this.topics.get(topic);
    if (!arr.includes(addr)) arr.push(addr);
  }
  onMsg(m) {
    const p = m.payload;
    if (p.type === 'sub') { this._sub(p.topic, m.from); return; }   // 런타임 구독 seam(0012 broker subscribe 와 동형) — 0016 토폴로지는 선언 spec 사용
    if (p.type !== 'pub') return;
    this.publishes++;
    const subs = this.topics.get(p.topic);
    if (!subs || !subs.length) { this.unrouted++; return; }
    for (const addr of subs) { this.deliveries++; this.net.send(this.addr, addr, { type: 'ev', topic: p.topic, ev: p.ev }); }
  }
  subscriberCount(topic) { const a = this.topics.get(topic); return a ? a.length : 0; }
}

const __part = { ServiceBus };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).svc_bus = __part;
