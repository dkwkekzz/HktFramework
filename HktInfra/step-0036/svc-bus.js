'use strict';
// step-0036 분할 preamble — 박스 1개=파일 1개 (CLAUDE.md 임계 규칙). 진입점 net-core.js 가 묶는다.
// dual-mode: Node require / 브라우저는 common.js 를 <script> 선행 로드(전역 __HktNetCommon).
const __c = (typeof module !== 'undefined' && module.exports && typeof require !== 'undefined')
  ? require('./common.js') : globalThis.__HktNetCommon;
const { Net, LoginServer, SessionRegistry, mulberry32, fnv1a, DEFAULTS } = __c;

// ── [버스] ServiceBus — 이벤트 버스의 *서비스 의미*(0016 의 조각). 존 tick 밖 *순수 반응형*(onTick 없음). ──
//   0012 토픽 버스가 *전송*(broker 프레임 라우팅)이라면 이것은 *서버간 발행/구독 계약* — 발행자는 토픽만 알고
//   소비자 주소·존재를 모른다(구독자 0 이면 폐기). 라우팅 테이블 Map<topic, [subscriber...]> 이 SSOT — pub 은 그 토픽
//   구독자 *전부*에게 ev 사본을 팬아웃(배열 등록 순서 = 결정론 팬아웃 순서). 채팅의 channel→Set<avatar>(클라 단위)와
//   같은 자료구조 패턴의 *서버 박스 단위* 판. 구독은 토폴로지 빌더의 선언 spec(opts.subs)으로 — 새 소비자 추가 =
//   이 테이블에 행 추가뿐(발행자 spec·코드 무수정 — verify `decouple` 이 수치로 증명).
//
// ── step-0036 의 한 조각: *동적 구독/해지*(runtime sub/unsub) — bus failover(영속·재라우팅)의 선결. ──
//   0016 이래 라우팅 테이블은 토폴로지 빌더의 *정적 선언 spec* 으로만 채워졌다(런타임 sub seam 은 존재했으나 미행사·unsub 없음).
//   분산 버스가 죽고 살아날 때 구독은 *재협상*되어야 한다(소비자가 새 브로커에 재구독·이전 라우트 해지) — 그 토대가 라우팅
//   테이블을 *런타임에 양방향으로* 바꾸는 능력이다. 이 step 은 `unsub` 메시지를 더해 해지를 완성하고(sub seam 과 대칭),
//   런타임 sub→unsub→re-sub 이 팬아웃 집합을 *정확히 그 소비자만* 바꾸는지(공동 구독자·발행자 비트 동일) 증명한다.
//   여전히 *순수 반응형*(onTick 0)·신성한 tick 밖이며, 라우팅 테이블 Map 이 유일한 SSOT(별도 상태 없음).
class ServiceBus {
  constructor(opts = {}) {
    this.topics = new Map();      // topic -> [subscriberAddr...] (구독 라우팅 테이블 — SSOT·등록 순서 = 팬아웃 순서)
    this.publishes = 0;           // pub 수신 수
    this.deliveries = 0;          // 구독자 전달 사본 수(팬아웃)
    this.unrouted = 0;            // 구독자 0 토픽 발행(폐기) — 발행자는 소비자 존재를 모른다는 의미의 회계
    this.subsRx = 0;              // 런타임 sub 수신 수(0033 — 동적 구독 회계). 정적 spec 은 _sub 직접 호출이라 비기여
    this.unsubsRx = 0;            // 런타임 unsub 수신 수(0033)
    if (opts.subs) for (const [topic, addr] of opts.subs) this._sub(topic, addr);
  }
  _sub(topic, addr) {
    if (!this.topics.has(topic)) this.topics.set(topic, []);
    const arr = this.topics.get(topic);
    if (!arr.includes(addr)) arr.push(addr);
  }
  // _unsub(0033) — 라우팅 테이블에서 (topic, addr) 행을 제거(sub 의 대칭). 미존재면 무영향(멱등).
  //   splice 로 *그 addr 만* 빼므로 토픽의 나머지 구독자 등록 순서는 보존(공동 구독자 팬아웃 비트 동일).
  _unsub(topic, addr) {
    const arr = this.topics.get(topic);
    if (!arr) return;
    const i = arr.indexOf(addr);
    if (i >= 0) arr.splice(i, 1);
  }
  onMsg(m) {
    const p = m.payload;
    if (p.type === 'sub') { this._sub(p.topic, m.from); this.subsRx++; return; }       // 런타임 구독 seam(0012 broker subscribe 와 동형)
    if (p.type === 'unsub') { this._unsub(p.topic, m.from); this.unsubsRx++; return; }  // 런타임 해지(0033 — sub 와 대칭)
    if (p.type !== 'pub') return;
    this.publishes++;
    const subs = this.topics.get(p.topic);
    if (!subs || !subs.length) { this.unrouted++; return; }
    for (const addr of subs) { this.deliveries++; this.net.send(this.addr, addr, { type: 'ev', topic: p.topic, ev: p.ev }); }
  }
  subscriberCount(topic) { const a = this.topics.get(topic); return a ? a.length : 0; }
  // crash(0034) — 버스 프로세스 사망(RAM 소실)의 인프로세스 모델. 라우팅 테이블을 비운다 → 서비스 경로 단절(이후 pub 전부 unrouted).
  //   버스는 *파생 상태*만 든다(누가 무엇을 구독하는가) — 진실 원천은 *소비자*다. 그래서 복구는 버스 내부 영속이 아니라
  //   소비자들의 *재구독*(재협상·0033 동적 sub)으로 일어난다: routing 은 sub 메시지의 재-적용으로 재구성된다(이력 replay 불필요).
  //   회계(publishes/deliveries…)는 누적 관찰 totals 라 유지 — 외부 관찰자(audit)·소비자(ranking)로 복구를 측정한다.
  crash() { this.topics = new Map(); }
}

const __part = { ServiceBus };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).svc_bus = __part;
