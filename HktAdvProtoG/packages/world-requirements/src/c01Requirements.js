// C01-Q-S01 — 사냥터 전략에서 세계 요구를 뽑는 매핑.
// 요구는 두 곳에서 나온다:
//   ① 전략이 겨냥하는 공급 대상 → 그 공급을 낳는 장소·자원·상대
//   ② 전략을 이루는 행동 원자   → 그 행동이 성립하기 위한 규칙·정보·재료
// 이 두 표가 "왜 이 장소·자원이 세계에 있어야 하는가"의 전부다 (임의 배치 금지).
import { makeRequirement, buildRequirementGraph } from './requirementGraph.js';

/** 장소 요구 id — TRACE.graph.json 의 요구 노드와 같은 이름을 쓴다 (계획-구현 정합) */
export const C01_PLACE_REQUIREMENT_IDS = {
  'hunter-outpost': 'REQ-outpost',
  'village-pasture': 'REQ-pasture',
  'herd-valley': 'REQ-herd-range',
  'apex-lair': 'REQ-apex-lair',
  'marsh-colony': 'REQ-colony-site',
  'lookout-rocks': 'REQ-vantage',
};

const PLACE_DESCRIPTION = {
  'hunter-outpost': '거래·계약·치료가 모이는 사회 공간이 있어야 한다',
  'village-pasture': '주민의 식량이 나오고 포식자가 노릴 목축지가 있어야 한다',
  'herd-valley': '초식 무리가 먹고 번식할 목초 골짜기가 있어야 한다',
  'apex-lair': '포식 마물이 머물고 회복할 둥지가 있어야 한다',
  'marsh-colony': '약초·미끼 재료가 자라는 군락 습지가 있어야 한다',
  'lookout-rocks': '흔적과 이동을 관측할 지점이 있어야 한다',
};

/** ① 공급 대상 → 그것을 낳는 세계 요소 */
export const C01_TARGET_SITES = {
  'herd-population': { place: 'herd-valley', counterparts: ['herd-lineage'] },
  'herd-valley-forage': { place: 'herd-valley' },
  'marsh-colony': { place: 'marsh-colony', resources: ['healing-herb', 'bait-material'] },
  'village-pasture': { place: 'village-pasture', resources: ['food', 'meat'] },
  'apex-lair': { place: 'apex-lair' },
  'apex-byproducts': { place: 'apex-lair', resources: ['monster-organ', 'hide'], counterparts: ['apex-lineage'] },
  'rare-individual': { place: 'herd-valley', counterparts: ['rare-lineage'] },
  'rare-byproducts': { place: 'herd-valley', resources: ['monster-organ'], counterparts: ['rare-lineage'] },
  'healing-herb': { place: 'marsh-colony', resources: ['healing-herb'] },
  'healing-potion': { place: 'hunter-outpost', resources: ['healing-potion'] },
  'market-inventory': { place: 'hunter-outpost', resources: ['hide', 'monster-organ', 'meat'], rules: ['exchange'] },
  'export-route-capacity': { place: 'hunter-outpost', rules: ['exchange'], routes: ['export-route'] },
  'village-safety': { place: 'hunter-outpost' },
  'contract-fulfillment': { place: 'hunter-outpost', rules: ['contract'], counterparts: ['guild-body'] },
};

/** ② 행동 원자 → 그 행동이 성립하기 위한 조건 */
export const C01_BEHAVIOR_REQUIREMENTS = {
  'stalk-prey': [{ kind: 'information', ref: 'trace-legibility' }],
  stalk: [{ kind: 'information', ref: 'trace-legibility' }],
  'inspect-trace': [{ kind: 'information', ref: 'trace-legibility' }],
  'survey-from-lookout': [{ kind: 'space', ref: 'lookout-rocks' }],
  'update-map': [{ kind: 'information', ref: 'map-record' }],
  'sell-intel': [{ kind: 'rule', ref: 'exchange' }, { kind: 'information', ref: 'map-record' }],
  'spread-rumor': [{ kind: 'information', ref: 'rumor-channel' }],
  'report-sighting': [{ kind: 'information', ref: 'rumor-channel' }],
  hunt: [{ kind: 'rule', ref: 'ownership' }],
  fight: [{ kind: 'rule', ref: 'ownership' }],
  capture: [{ kind: 'rule', ref: 'ownership' }, { kind: 'counterpart', ref: 'rare-lineage' }],
  'raid-pasture': [{ kind: 'rule', ref: 'ownership' }],
  'dress-carcass': [{ kind: 'rule', ref: 'ownership' }],
  'set-bait': [{ kind: 'resource', ref: 'bait-material' }],
  'prepare-gear': [{ kind: 'resource', ref: 'equipment' }],
  'craft-item': [{ kind: 'rule', ref: 'crafting' }],
  appraise: [{ kind: 'information', ref: 'quality-signal' }],
  'gather-herbs': [{ kind: 'space', ref: 'marsh-colony' }],
  buy: [{ kind: 'rule', ref: 'exchange' }],
  'quote-price': [{ kind: 'rule', ref: 'exchange' }, { kind: 'information', ref: 'price-signal' }],
  export: [{ kind: 'rule', ref: 'exchange' }],
  'organize-export': [{ kind: 'rule', ref: 'exchange' }],
  'buy-byproducts': [{ kind: 'rule', ref: 'exchange' }],
  'buy-potions': [{ kind: 'rule', ref: 'exchange' }],
  'issue-cull-contract': [{ kind: 'rule', ref: 'contract' }, { kind: 'counterpart', ref: 'guild-body' }],
  'suspend-cull-contract': [{ kind: 'rule', ref: 'contract' }, { kind: 'counterpart', ref: 'guild-body' }],
  'issue-subjugation-contract': [{ kind: 'rule', ref: 'contract' }, { kind: 'counterpart', ref: 'guild-body' }],
  'rate-contract-performance': [{ kind: 'rule', ref: 'contract' }],
  migrate: [{ kind: 'space', ref: 'monster-route' }],
  'relocate-lair': [{ kind: 'space', ref: 'monster-route' }],
  'trample-colony': [{ kind: 'space', ref: 'marsh-colony' }],
  graze: [{ kind: 'space', ref: 'herd-valley' }],
  breed: [{ kind: 'space', ref: 'herd-valley' }],
  regenerate: [{ kind: 'space', ref: 'marsh-colony' }],
  'recover-injury': [{ kind: 'space', ref: 'apex-lair' }],
  farm: [{ kind: 'space', ref: 'village-pasture' }],
  'herd-livestock': [{ kind: 'space', ref: 'village-pasture' }],
  'flee-to-village': [{ kind: 'space', ref: 'hunter-outpost' }],
};

const RULE_DESCRIPTION = {
  ownership: '사냥물·채집물의 소유가 한 번만 확정되는 규칙이 있어야 한다',
  exchange: '교환 가치와 매매가 성립하는 규칙이 있어야 한다',
  contract: '계약을 발급·이행·평가하는 규칙이 있어야 한다',
  crafting: '재료를 소비해 제작물을 얻는 규칙이 있어야 한다',
};
const INFO_DESCRIPTION = {
  'trace-legibility': '발자국·훼손이 읽을 수 있는 흔적으로 남아야 한다',
  'map-record': '알아낸 것을 기록·전달할 수단이 있어야 한다',
  'rumor-channel': '목격과 소문이 퍼지는 통로가 있어야 한다',
  'quality-signal': '재료의 품질이 판별 가능해야 한다',
  'price-signal': '시세가 관측 가능해야 한다',
};
const COUNTERPART_DESCRIPTION = {
  'herd-lineage': '사냥할 초식 개체군이 실재해야 한다',
  'apex-lineage': '추적할 포식 개체가 실재해야 한다',
  'rare-lineage': '변이가 일어날 혈통이 실재해야 한다',
  'guild-body': '계약을 낼 실제 조직과 구성원이 있어야 한다',
};

const spaceReq = (place) => makeRequirement({
  id: C01_PLACE_REQUIREMENT_IDS[place] ?? `REQ-SPACE-${place}`,
  kind: 'space', ref: place,
  description: PLACE_DESCRIPTION[place] ?? `${place} 공간이 있어야 한다`,
});
const resourceReq = (resource) => makeRequirement({
  id: `REQ-RES-${resource}`, kind: 'resource', ref: resource,
  description: `${resource} 이(가) 세계에서 생산·유통될 수 있어야 한다`,
});
const ruleReq = (rule) => makeRequirement({
  id: `REQ-RULE-${rule}`, kind: 'rule', ref: rule, description: RULE_DESCRIPTION[rule] ?? `${rule} 규칙이 있어야 한다`,
});
const infoReq = (info) => makeRequirement({
  id: `REQ-INFO-${info}`, kind: 'information', ref: info, description: INFO_DESCRIPTION[info] ?? `${info} 정보가 있어야 한다`,
});
const counterpartReq = (cp) => makeRequirement({
  id: `REQ-CP-${cp}`, kind: 'counterpart', ref: cp, description: COUNTERPART_DESCRIPTION[cp] ?? `${cp} 상대가 있어야 한다`,
});
const routeReq = (route) => makeRequirement({
  id: `REQ-SPACE-${route}`, kind: 'space', ref: route, description: `${route} 이동 경로가 있어야 한다`,
});

const BY_KIND = { space: spaceReq, resource: resourceReq, rule: ruleReq, information: infoReq, counterpart: counterpartReq };

/** Q0·Q1 — 전략 하나의 세계 조건과 성공 결과 */
export function c01Extractor(strategy) {
  const conditions = [];
  const push = (req) => { if (!conditions.some((c) => c.id === req.id)) conditions.push(req); };

  const site = strategy.target ? C01_TARGET_SITES[strategy.target] : null;
  if (strategy.target && !site) throw new Error(`요구 매핑 없는 전략 대상: ${strategy.target} (${strategy.id})`);
  if (site) {
    if (site.place) push(spaceReq(site.place));
    for (const r of site.resources ?? []) push(resourceReq(r));
    for (const r of site.rules ?? []) push(ruleReq(r));
    for (const c of site.counterparts ?? []) push(counterpartReq(c));
    for (const r of site.routes ?? []) push(routeReq(r));
  }
  for (const atom of strategy.atoms) {
    const reqs = C01_BEHAVIOR_REQUIREMENTS[atom.behavior];
    if (!reqs) throw new Error(`요구 매핑 없는 행동 원자: ${atom.behavior} (${strategy.id})`);
    for (const { kind, ref } of reqs) push(kind === 'space' && !C01_PLACE_REQUIREMENT_IDS[ref] ? routeReq(ref) : BY_KIND[kind](ref));
  }
  // Q1 — 성공 결과는 세계 조건이 아니라 세계에 남는 변화다 (W/R 이 소비)
  const outcomes = strategy.atoms.map((a) => ({ effect: a.effect, behavior: a.behavior, at: site?.place ?? null }));
  return { conditions, outcomes };
}

export function buildC01RequirementGraph(catalog) {
  return buildRequirementGraph(catalog, c01Extractor);
}
