// R2 — 현상 생성. 사건이 흔적·소리·목격·기록으로 세계에 남게 한다.
//
// 현상 목록은 손으로 적지 않는다. Q(세계 요구)가 전략 원자마다 낸 **성공 결과**
// (outcomes: {strategy, behavior, effect, at})가 현상 카탈로그의 유일한 출처다 —
// "어떤 행동이 세계에 무엇을 남기는가"는 이미 전략이 선언했다. 여기서 더하는 것은
// 그 자국을 무엇으로 감지하는가(감각)뿐이다.
//
// 이로써 행동 → 세계에 남는 자국의 인과가 끊기지 않는다 (열린 이슈 I-3 의 처리).
import { stableSort, createIdGenerator } from '../../verification/src/deterministic.js';

/** 현상의 감각 종류 — R3(지각)이 주체의 감각과 대조할 어휘 */
export const PHENOMENON_SENSES = ['trace', 'sound', 'sighting', 'record', 'absence'];

/**
 * 행동 원자 → 그 행동이 남기는 자국의 감각과 읽기 난이도.
 * 이 표의 열쇠는 전부 Q 가 선언한 행동이어야 하고, Q 의 행동은 전부 여기 있어야 한다
 * (양방향 검사 — buildPhenomenonCatalog 가 강제한다).
 *
 * legibility: 흔적이 얼마나 쉽게 읽히는가 (0~1). R3 의 지각 판정과 G1 의 추적 숙련이 쓴다.
 */
export const BEHAVIOR_SENSES = {
  // 추적·관측 — 남기는 것보다 읽는 쪽에 가깝다
  'stalk-prey': { sense: 'trace', legibility: 0.4 },
  stalk: { sense: 'trace', legibility: 0.4 },
  'inspect-trace': { sense: 'record', legibility: 0.9 },
  'survey-from-lookout': { sense: 'sighting', legibility: 0.8 },
  'update-map': { sense: 'record', legibility: 1 },
  'sell-intel': { sense: 'record', legibility: 1 },
  'spread-rumor': { sense: 'record', legibility: 0.3 },
  'report-sighting': { sense: 'record', legibility: 0.7 },

  // 사냥·전투 — 크고 읽기 쉬운 자국
  hunt: { sense: 'trace', legibility: 0.8 },
  fight: { sense: 'sound', legibility: 0.9 },
  capture: { sense: 'sighting', legibility: 0.8 },
  'raid-pasture': { sense: 'absence', legibility: 1 },   // 가축 실종 — 없어진 것이 곧 신호다
  'dress-carcass': { sense: 'trace', legibility: 0.9 },

  // 준비·제작·거래
  'set-bait': { sense: 'trace', legibility: 0.5 },
  'prepare-gear': { sense: 'record', legibility: 0.6 },
  'craft-item': { sense: 'record', legibility: 0.7 },
  appraise: { sense: 'record', legibility: 0.6 },
  'gather-herbs': { sense: 'trace', legibility: 0.5 },
  buy: { sense: 'record', legibility: 0.8 },
  'quote-price': { sense: 'record', legibility: 1 },
  export: { sense: 'record', legibility: 0.7 },
  'organize-export': { sense: 'record', legibility: 0.7 },
  'buy-byproducts': { sense: 'record', legibility: 0.8 },
  'buy-potions': { sense: 'record', legibility: 0.8 },

  // 조합의 공고 — 게시판에 붙는 기록이라 누구나 읽는다
  'issue-cull-contract': { sense: 'record', legibility: 1 },
  'suspend-cull-contract': { sense: 'record', legibility: 1 },
  'issue-subjugation-contract': { sense: 'record', legibility: 1 },
  'rate-contract-performance': { sense: 'record', legibility: 0.8 },

  // 생태 — 개체군이 스스로 남기는 자국
  migrate: { sense: 'trace', legibility: 0.7 },
  'relocate-lair': { sense: 'trace', legibility: 0.6 },
  'trample-colony': { sense: 'trace', legibility: 1 },   // 훼손 흔적
  graze: { sense: 'trace', legibility: 0.5 },
  breed: { sense: 'sighting', legibility: 0.6 },
  regenerate: { sense: 'sighting', legibility: 0.4 },
  'recover-injury': { sense: 'absence', legibility: 0.3 },
  farm: { sense: 'sighting', legibility: 0.8 },
  'herd-livestock': { sense: 'sighting', legibility: 0.8 },
  'flee-to-village': { sense: 'sighting', legibility: 0.9 },
};

/**
 * Q 의 성공 결과에서 현상 카탈로그를 만든다 (I-3 — Q 출력의 소비처).
 * 같은 행동을 여러 전략이 쓰면 남기는 자국의 서술과 장소가 누적된다.
 */
export function buildPhenomenonCatalog(requirementGraph, senses = BEHAVIOR_SENSES) {
  const outcomes = requirementGraph?.outcomes ?? [];
  if (outcomes.length === 0) throw new Error('성공 결과가 없는 요구 그래프로는 현상을 만들 수 없다');

  const byBehavior = new Map();
  for (const o of outcomes) {
    const sense = senses[o.behavior];
    if (!sense) throw new Error(`감각 매핑 없는 행동 원자: ${o.behavior} (${o.strategy})`);
    const entry = byBehavior.get(o.behavior) ?? {
      behavior: o.behavior, ...sense, effects: [], places: [], strategies: [],
      // 같은 행동이라도 어느 전략에서 나왔는지에 따라 남는 자국의 서술이 다르다
      // (stalk-prey 는 무리 추적일 수도, 목장 접근일 수도 있다)
      effectByStrategy: {}, placeByStrategy: {},
    };
    if (!entry.effects.includes(o.effect)) entry.effects.push(o.effect);
    if (o.at && !entry.places.includes(o.at)) entry.places.push(o.at);
    if (!entry.strategies.includes(o.strategy)) entry.strategies.push(o.strategy);
    entry.effectByStrategy[o.strategy] = o.effect;
    if (o.at) entry.placeByStrategy[o.strategy] = o.at;
    byBehavior.set(o.behavior, entry);
  }

  // 반대 방향 — 감각 표에만 있고 Q 가 부르지 않는 행동은 죽은 출력이다
  const unused = Object.keys(senses).filter((b) => !byBehavior.has(b));
  if (unused.length) throw new Error(`Q 가 부르지 않는 행동의 감각 매핑: ${unused.join(',')}`);

  const entries = stableSort([...byBehavior.values()], (a, b) => a.behavior.localeCompare(b.behavior))
    .map((e) => ({
      ...e,
      effects: [...e.effects].sort(),
      places: [...e.places].sort(),
      strategies: [...e.strategies].sort(),
    }));
  return {
    entries,
    byBehavior: Object.fromEntries(entries.map((e) => [e.behavior, e])),
    has: (behavior) => behavior in Object.fromEntries(entries.map((e) => [e.behavior, e])),
  };
}

/** R2 — 현상 흐름. 사건이 확정된 뒤에만 자국이 쌓인다 */
export class PhenomenonStream {
  #items = [];
  #nextId = createIdGenerator('ph');

  /**
   * 사건 하나가 남기는 자국들 — 장소가 여럿이면 장소마다 하나씩.
   * strategy 를 주면 그 전략이 선언한 서술·장소를 쓴다 (전략 → 행동 → 자국 사슬 유지).
   */
  emit(catalogEntry, { tick, at, sourceEventId, traceId, actor, strategy = null }) {
    const fromStrategy = strategy ? catalogEntry.effectByStrategy?.[strategy] : null;
    if (strategy && !fromStrategy)
      throw new Error(`${catalogEntry.behavior} 를 부르지 않는 전략: ${strategy}`);
    const places = at ? [at] : (strategy && catalogEntry.placeByStrategy?.[strategy]
      ? [catalogEntry.placeByStrategy[strategy]]
      : catalogEntry.places);
    const made = [];
    for (const place of places.length ? places : [null]) {
      const item = {
        id: this.#nextId(),
        seq: this.#items.length,
        tick,
        behavior: catalogEntry.behavior,
        sense: catalogEntry.sense,
        legibility: catalogEntry.legibility,
        description: fromStrategy ?? catalogEntry.effects[0],
        strategy: strategy ?? null,
        at: place,
        actor: actor ?? null,
        sourceEventId,
        traceId: traceId ?? null,
      };
      this.#items.push(item);
      made.push(item);
    }
    return made;
  }

  list() { return [...this.#items]; }
  get length() { return this.#items.length; }
  at(place) { return this.#items.filter((p) => p.at === place); }
  since(tick) { return this.#items.filter((p) => p.tick >= tick); }
  /** 인과 추적 — 한 사건이 남긴 자국 전부 */
  fromEvent(eventId) { return this.#items.filter((p) => p.sourceEventId === eventId); }
}
