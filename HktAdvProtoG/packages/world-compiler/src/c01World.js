// C01-W-S01 — 요구 29건을 하나의 국경 협곡 사냥터로 실체화한다.
// 손으로 적힌 지형 상수는 여기 실체화 표에만 존재하고, 그 표의 항목은 전부
// 요구(Q)에서 불린 것만 쓰인다 — 불리지 않은 것은 잠재(latent)로 남는다.
import { SeededRandom, stableSort } from '../../verification/src/deterministic.js';
import {
  normalizeRequirements, mergeRequirements, CanonicalWorld,
} from './worldCompiler.js';

/** W4 — 공간 실체화표: 협곡 2km x 2km 안의 구역과 산출 */
const PLACE_BLUEPRINT = {
  'hunter-outpost': { zone: [0.15, 0.20], tags: ['social', 'market', 'guild'], attrs: { threat: 0 } },
  'village-pasture': { zone: [0.30, 0.35], tags: ['production', 'threat-target'], yields: { food: 4, meat: 4 }, attrs: { livestock: 8 } },
  'herd-valley': { zone: [0.60, 0.45], tags: ['production', 'danger'], attrs: { carryingCapacityBase: 45 } },
  'apex-lair': { zone: [0.85, 0.75], tags: ['danger'], yields: { 'monster-organ': 5, hide: 6 }, attrs: { integrity: 1, byproductYield: 3 } },
  'marsh-colony': { zone: [0.45, 0.80], tags: ['production'], yields: { 'healing-herb': 6, 'bait-material': 2 } },
  'lookout-rocks': { zone: [0.35, 0.55], tags: ['observation'] },
};

/** W4 — 경로 실체화표: 어느 장소를 잇는가 */
const ROUTE_BLUEPRINT = {
  'monster-route': { connects: ['apex-lair', 'herd-valley', 'marsh-colony'], attrs: {} },
  'export-route': { connects: ['hunter-outpost'], attrs: { capacity: 5 } },
  'hunting-trail': { connects: ['hunter-outpost', 'herd-valley'], attrs: {} },
};

/** W2 — 규칙 실체화표: 각 규칙이 어느 공리에 매인다 */
const RULE_BLUEPRINT = {
  ownership: { boundAxiom: 'AX-AUTHORITY', statement: '사냥물·채집물의 소유는 권위 서버가 한 번만 확정한다' },
  exchange: { boundAxiom: 'AX-CONSERVATION', statement: '교환은 재고를 옮길 뿐 만들어내지 않는다' },
  contract: { boundAxiom: 'AX-ORG-EMBODIED', statement: '계약은 실제 구성원을 통해서만 발급·이행된다' },
  crafting: { boundAxiom: 'AX-CONSERVATION', statement: '제작물은 재료를 소비해야만 나온다' },
};

/** W3 — 제작·비축 기본 재고 (산지 산출이 아닌 것) */
const STOCKPILE = { 'healing-potion': 3, equipment: 2 };

/** 무리가 골짜기에서 쓰고도 남을 목초 여유 — 개체군은 세계 용량 안에 들어간다 */
export const FORAGE_SLACK = 10;

/**
 * W0~W6 을 순서대로 통과해 정식 세계를 만든다.
 * requirementGraph 없이는 어떤 요소도 만들지 않는다.
 */
export function compileC01World({ requirementGraph, seed = 11 }) {
  const normalized = normalizeRequirements(requirementGraph);
  const merged = mergeRequirements(normalized);
  const called = (kind, ref) => merged.some((m) => m.kind === kind && m.ref === ref);
  const rng = new SeededRandom(seed);

  // W4 공간 — 요구에서 불린 장소만 실체화한다
  const places = {};
  for (const [id, bp] of Object.entries(PLACE_BLUEPRINT)) {
    if (!called('space', id)) continue;
    const jitter = () => (rng.int(41) - 20) / 1000;   // ±0.02 (약 ±40m)
    places[id] = {
      tags: [...bp.tags],
      position: { x: Number((bp.zone[0] + jitter()).toFixed(4)), y: Number((bp.zone[1] + jitter()).toFixed(4)) },
      ...structuredClone(bp.attrs ?? {}),
    };
  }
  const routes = {};
  for (const [id, bp] of Object.entries(ROUTE_BLUEPRINT)) {
    if (!called('space', id)) continue;
    routes[id] = { connects: bp.connects.filter((p) => p in places), ...structuredClone(bp.attrs) };
  }

  // W2 규칙 — 요구에서 불린 규칙만, 공리에 매어서
  const rules = {};
  for (const [id, bp] of Object.entries(RULE_BLUEPRINT)) if (called('rule', id)) rules[id] = { ...bp };

  // W3 상태 — 산지 산출 + 비축. 요구에서 불린 자원만 재고를 갖는다
  const resources = {};
  for (const m of merged) if (m.kind === 'resource') resources[m.ref] = 0;
  for (const place of Object.values(PLACE_BLUEPRINT))
    for (const [res, qty] of Object.entries(place.yields ?? {})) if (res in resources) resources[res] += qty;
  for (const [res, qty] of Object.entries(STOCKPILE)) if (res in resources) resources[res] += qty;

  // W5 압축 역사 — 지금의 초기 상태가 왜 이런지 설명한다 (원인은 요구 id)
  const history = [];
  const push = (id, tick, description, causes, effects) => {
    if (causes.every((c) => merged.some((m) => m.requirementIds.includes(c)))) history.push({ id, tick, description, causes, effects });
  };
  push('H-01', -300, '군락 습지가 자리를 잡으며 초식 무리가 인근 골짜기에 정착했다',
    ['REQ-colony-site', 'REQ-herd-range'], ['region.places.herd-valley', 'region.places.marsh-colony']);
  push('H-02', -240, '무리를 따라 포식 마물이 협곡 안쪽에 둥지를 틀었다',
    ['REQ-herd-range', 'REQ-apex-lair'], ['region.places.apex-lair', 'region.routes.monster-route']);
  push('H-03', -120, '부산물과 약초를 노린 사람들이 전초를 세우고 목장을 열었다',
    ['REQ-outpost', 'REQ-pasture'], ['region.places.hunter-outpost', 'region.places.village-pasture']);
  push('H-04', -60, '흔적을 미리 읽으려는 이들이 전망 바위를 관측 지점으로 삼았다',
    ['REQ-vantage'], ['region.places.lookout-rocks']);
  push('H-05', -30, '조합이 서고 계약·거래 질서가 자리 잡았다',
    ['REQ-RULE-contract', 'REQ-RULE-exchange'], ['rules.contract', 'rules.exchange']);

  return new CanonicalWorld({ places, routes, rules, resources, history, merged, seed });
}

/** 개체군은 세계 용량 안에 들어간다 — 골짜기 수용력이 무리 개체수를 제한한다 */
export function fitPopulationToWorld(world, cast) {
  const valley = world.places['herd-valley'];
  if (!valley) return cast;
  const capacity = valley.carryingCapacityBase;
  valley.carryingCapacity = capacity;
  for (const s of Object.values(cast))
    if (s.archetype === 'herd-beast')
      s.population.count = Math.min(s.population.count, capacity - FORAGE_SLACK);
  return cast;
}

/** 정식 세계를 R/X/N 이 쓰는 상태 스키마로 펼친다 */
export function toWorldState(world, baseState) {
  const state = structuredClone(baseState);
  state.region.places = structuredClone(world.places);
  state.region.routes = structuredClone(world.routes);
  state.region.rules = structuredClone(world.rules);
  state.region.rareIndividuals = 0;
  for (const [res, qty] of Object.entries(world.resources))
    if (res in state.resources) state.resources[res] = qty;
  state.observedPaths = [...world.observedPaths];
  return state;
}

/** Lab 미리보기 — 장소·경로를 요구 근거와 함께 (완료 조건) */
export function previewWorld(world) {
  const rows = [];
  for (const [id, place] of Object.entries(world.places)) {
    const p = world.provenance('space', id);
    rows.push({
      element: id, kind: 'place', state: world.classify('space', id),
      position: place.position, tags: place.tags,
      requirements: p.requirementIds, calledBy: p.calledBy, actors: p.actors,
    });
  }
  for (const [id, route] of Object.entries(world.routes)) {
    const p = world.provenance('space', id);
    rows.push({
      element: id, kind: 'route', state: world.classify('space', id),
      connects: route.connects, requirements: p.requirementIds, calledBy: p.calledBy, actors: p.actors,
    });
  }
  // 요구에서 한 번도 불리지 않은 청사진 항목은 잠재로 보고한다
  for (const id of Object.keys(ROUTE_BLUEPRINT))
    if (!(id in world.routes)) rows.push({ element: id, kind: 'route', state: 'latent', requirements: [], calledBy: [], actors: [] });
  return {
    rows: stableSort(rows, (a, b) => a.element.localeCompare(b.element)),
    history: world.history,
    rules: Object.entries(world.rules).map(([id, r]) => ({ id, ...r, state: world.classify('rule', id) })),
    resources: world.resources,
  };
}
