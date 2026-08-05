// C01-R-S01 — 국경 협곡의 세계 런타임 배선.
// 존재론이 선언한 사건 타입 9종에 리듀서를 붙이고, W 가 실체화한 정식 세계를
// 런타임 상태로 올린다. 현상 카탈로그는 Q 의 성공 결과에서 나온다 (I-3).
import { defineC01Ontology } from '../../ontology/src/c01Ontology.js';
import { AxiomRegistry } from '../../ontology/src/axioms.js';
import { registerC01Axioms } from '../../ontology/src/c01Axioms.js';
import { buildC01RequirementGraph } from '../../world-requirements/src/c01Requirements.js';
import { C01_STRATEGIES } from '../../possibilities/src/c01Strategies.js';
import { buildPhenomenonCatalog } from './phenomena.js';
import { WorldRuntime } from './worldRuntime.js';

const bump = (map, key, delta) => { map[key] = Math.max(0, (map[key] ?? 0) + delta); };

/**
 * R1 — 사건 타입별 상태 전이. 각 리듀서는 순수 함수다 (같은 사건 → 같은 다음 상태).
 * 리듀서 밖에서 상태를 만지는 경로는 없다.
 */
export const C01_REDUCERS = {
  ResourceGathered: (s, ev) => {
    const { resource, qty, at } = ev.payload;
    bump(s.resources, resource, qty);
    const place = s.region.places[at];
    if (place?.yields?.[resource] !== undefined) place.yields[resource] = Math.max(0, place.yields[resource] - qty);
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

  MonsterHunted: (s, ev) => {
    const { subjectId, by } = ev.payload;
    const subject = s.subjects[subjectId];
    if (subject?.population) subject.population.count = Math.max(0, subject.population.count - 1);
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
