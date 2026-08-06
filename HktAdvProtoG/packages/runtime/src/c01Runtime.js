// C01-R-S01·R-S02 — 국경 협곡의 세계 런타임 배선.
// 존재론이 선언한 사건 타입 9종에 리듀서를 붙이고, W 가 실체화한 정식 세계를
// 런타임 상태로 올린다. 현상 카탈로그는 Q 의 성공 결과에서 나온다 (I-3).
// R-S02 는 그 위에 지각·믿음·의도를 얹는다 — 주체는 자기가 아는 것으로만 움직인다.
import { defineC01Ontology } from '../../ontology/src/c01Ontology.js';
import { AxiomRegistry } from '../../ontology/src/axioms.js';
import { registerC01Axioms } from '../../ontology/src/c01Axioms.js';
import { buildC01RequirementGraph, C01_TARGET_SITES } from '../../world-requirements/src/c01Requirements.js';
import { C01_STRATEGIES } from '../../possibilities/src/c01Strategies.js';
import { buildPhenomenonCatalog } from './phenomena.js';
import { WorldRuntime } from './worldRuntime.js';
import { perceiveAll } from './perception.js';
import { BeliefLedger, updateBeliefs } from './beliefs.js';
import { formIntents } from './intents.js';

const bump = (map, key, delta) => { map[key] = Math.max(0, (map[key] ?? 0) + delta); };

/**
 * R1 — 사건 타입별 상태 전이. 각 리듀서는 순수 함수다 (같은 사건 → 같은 다음 상태).
 * 리듀서 밖에서 상태를 만지는 경로는 없다.
 */
export const C01_REDUCERS = {
  // 채집은 땅에서 덜어 창고로 옮긴다 — 산지가 그 자원을 내지 않으면
  // 늘어난 재고를 설명할 비용이 없어 보존 공리가 막는다 (I-5)
  ResourceGathered: (s, ev) => {
    const { resource, qty, at } = ev.payload;
    const place = s.region.places[at];
    const available = place?.yields?.[resource];
    const taken = available === undefined ? qty : Math.min(qty, available);
    if (available !== undefined) place.yields[resource] = available - taken;
    bump(s.resources, resource, taken);
    return s;
  },

  MonsterMoved: (s, ev) => {
    const { subjectId, from, to } = ev.payload;
    const subject = s.subjects[subjectId];
    if (subject) subject.at = to;
    // 떠난 자리의 흔적은 현상이 담당한다 — 상태에는 위치만 남는다
    if (s.region.places[from]) s.region.places[from].lastDeparture = ev.tick;
    if (s.region.places[to]) s.region.places[to].lastArrival = ev.tick;
    return s;
  },

  // 사냥이 치르는 비용은 개체군이다 — 잡은 만큼 줄고, 그 감소가 부산물의 근거가 된다 (I-5)
  MonsterHunted: (s, ev) => {
    const { subjectId, by } = ev.payload;
    const taken = ev.payload.consumesPopulation?.find((c) => c.subjectId === subjectId)?.count ?? 1;
    const subject = s.subjects[subjectId];
    if (subject?.population) subject.population.count = Math.max(0, subject.population.count - taken);
    if (ev.payload.rare) s.region.rareIndividuals = Math.max(0, (s.region.rareIndividuals ?? 0) - 1);
    for (const { resource, qty } of ev.payload.produces ?? []) bump(s.resources, resource, qty);
    s.ownership[`kill:${ev.payload.subjectId}:${ev.tick}`] = by;
    return s;
  },

  ItemCrafted: (s, ev) => {
    for (const { resource, qty } of ev.payload.consumes) bump(s.resources, resource, -qty);
    for (const { resource, qty } of ev.payload.produces) bump(s.resources, resource, qty);
    return s;
  },

  ResourceClaimed: (s, ev) => {
    s.ownership[ev.payload.resource] = ev.payload.by;
    return s;
  },

  ContractIssued: (s, ev) => {
    s.contracts[ev.payload.contractId] = { status: 'open', kind: ev.payload.kind, issuedAt: ev.tick };
    return s;
  },

  ContractResolved: (s, ev) => {
    const c = s.contracts[ev.payload.contractId];
    if (c) { c.status = ev.payload.outcome === 'fulfilled' ? 'fulfilled' : 'failed'; c.resolvedAt = ev.tick; }
    return s;
  },

  TradeExecuted: (s, ev) => {
    // 교환은 재고를 옮길 뿐 만들어내지 않는다 (규칙 exchange ← AX-CONSERVATION)
    const { resource, qty } = ev.payload;
    bump(s.resources, resource, -qty);
    s.ownership[`trade:${resource}:${ev.tick}`] = ev.payload.to;
    return s;
  },

  TrackProgress: (s, ev) => {
    const subject = s.subjects[ev.payload.by];
    if (subject) subject.trackingProgress = (subject.trackingProgress ?? 0) + ev.payload.roll;
    return s;
  },
};

/** C01 런타임 한 벌 — 정식 세계 상태를 사건으로만 굴리는 저장소 */
export function createC01Runtime({ state, ontology = defineC01Ontology(), requirementGraph } = {}) {
  if (!state) throw new Error('createC01Runtime 에 W 가 만든 정식 세계 상태 필수');
  const axioms = new AxiomRegistry();
  registerC01Axioms(axioms);
  const graph = requirementGraph ?? buildC01RequirementGraph(C01_STRATEGIES);
  return new WorldRuntime({
    state, ontology, axioms,
    reducers: C01_REDUCERS,
    phenomenonCatalog: buildPhenomenonCatalog(graph),
  });
}

/**
 * R6 이 쓰는 "이 전략은 어디로 향하는가" — Q 의 요구 매핑(C01_TARGET_SITES)에서 온다.
 * 여기서 장소를 짓지 않는다. 전략의 대상이 곧 그 전략이 향하는 세계 요소다.
 */
export function c01PlaceOf(chosen) {
  if (!chosen?.target) return null;
  return C01_TARGET_SITES[chosen.target]?.place ?? null;
}

/**
 * R3~R6 한 바퀴 — 자국을 지각하고, 믿음을 갱신하고, 계획을 의도로 옮긴다.
 * 세계를 바꾸지 않는다 (의도는 아직 사건이 아니다).
 */
export function senseAndIntend({ runtime, subjects, plans, ledger = new BeliefLedger(), tick = 0, since = 0 }) {
  const state = runtime.state();
  const perceptions = perceiveAll({
    subjects, phenomena: runtime.phenomena.list(), routes: state.region.routes, since,
  });
  updateBeliefs(ledger, perceptions, { tick });
  const intents = formIntents({ plans, subjects, beliefs: ledger, tick, placeOf: c01PlaceOf });
  return { perceptions, ledger, ...intents };
}

/** Lab 산출 — 사건·현상·설명을 사람이 읽을 형태로 */
export function runtimeReport(runtime, label) {
  return {
    label,
    tick: runtime.tick,
    stateHash: runtime.hash(),
    events: runtime.log.list().map((ev) => ({
      seq: ev.seq, id: ev.id, tick: ev.tick, type: ev.type, behavior: ev.behavior,
      traceId: ev.traceId, statePaths: ev.statePaths, payload: ev.payload,
    })),
    phenomena: runtime.phenomena.list(),
    explainedPaths: runtime.explainedPaths().map((path) => ({
      path, events: runtime.explain(path).map((e) => `${e.id}(${e.type})`),
    })),
  };
}
