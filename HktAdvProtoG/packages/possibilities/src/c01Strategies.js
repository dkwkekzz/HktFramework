// C01-P-S01 — 사냥터의 의존 대응 전략 카탈로그.
// 각 전략의 이득은 D 의 공급 어휘(C01_SUPPLIES)에서 계산한다 — 전략이 겨냥하는 것은
// 추상 목표가 아니라 세계에 실재하는 공급이다.
import { makeAtom, makeStrategy } from './possibilityGraph.js';
import { C01_SUPPLIES } from '../../dependencies/src/c01Dependencies.js';

const supply = (ctx, target) => Math.max(0, C01_SUPPLIES[target](ctx));
/**
 * 이 전략으로 채울 수 있는 양 = 요구 전체와 대상 공급 중 작은 쪽.
 * D 의 잔여(unmet)가 아니라 요구(demand)로 재는 것이 중요하다 — D 의 할당 캐스케이드는
 * "이렇게 되면 이만큼 충족된다"는 추정이고, 어느 수단을 쓸지는 P 가 다시 고른다.
 */
const fill = (ctx, target, row) => Math.min(row?.demand ?? 0, supply(ctx, target));
const guildStrength = (ctx) =>
  Object.values(ctx.subjects).find((s) => s.archetype === 'hunters-guild')?.members?.length ?? 0;
const herdOf = (ctx) => Object.values(ctx.subjects).find((s) => s.archetype === 'herd-beast');

export const C01_STRATEGIES = [
  // ── prey ──────────────────────────────────────────────────────────────────
  makeStrategy({
    id: 'P-HUNT-HERD', kind: 'prey', actors: { archetypes: ['apex-monster'] },
    atoms: [makeAtom({ behavior: 'stalk-prey', effect: '무리 추적' }), makeAtom({ behavior: 'hunt', effect: '무리 개체 포식' })],
    target: 'herd-population',
    estimate: (ctx, s, row) => ({ gain: fill(ctx, 'herd-population', row), cost: 1, risk: 1 }),
    rationale: '포식 마물의 기본 먹이원은 골짜기 무리다',
  }),
  makeStrategy({
    id: 'P-RAID-PASTURE', kind: 'prey', actors: { archetypes: ['apex-monster'] },
    atoms: [makeAtom({ behavior: 'stalk-prey', effect: '목장 접근' }), makeAtom({ behavior: 'raid-pasture', effect: '가축 습격' })],
    target: 'village-pasture',
    // 위험은 마을 방위 전력에 비례한다 — 굶주릴수록(절박도) 그 위험을 감수한다
    estimate: (ctx, s, row) => ({ gain: fill(ctx, 'village-pasture', row), cost: 2, risk: 2 + guildStrength(ctx) }),
    rationale: '무리가 마르면 포식 마물은 위험을 무릅쓰고 목장 가축을 노린다',
  }),
  makeStrategy({
    id: 'P-RECOVER-LAIR', kind: 'prey', actors: { archetypes: ['apex-monster'] },
    atoms: [makeAtom({ behavior: 'recover-injury', effect: '둥지에서 회복 — 먹이 요구 감소' })],
    target: null,
    estimate: (ctx, s) => ({ gain: s.attrs?.injury ?? 0, cost: 2, risk: 0 }),
    rationale: '부상이 크면 사냥 대신 회복으로 먹이 요구 자체를 줄인다',
  }),
  makeStrategy({
    id: 'P-GRAZE-VALLEY', kind: 'prey', actors: { archetypes: ['herd-beast'] },
    atoms: [makeAtom({ behavior: 'graze', effect: '골짜기 목초 채식' })],
    target: 'herd-valley-forage',
    estimate: (ctx, s, row) => ({ gain: fill(ctx, 'herd-valley-forage', row), cost: 1, risk: 1 }),
    rationale: '무리는 서식 골짜기에서 먹는다',
  }),
  makeStrategy({
    id: 'P-MIGRATE-MARSH', kind: 'prey', actors: { archetypes: ['herd-beast'] },
    atoms: [makeAtom({ behavior: 'migrate', effect: '습지로 이동' }), makeAtom({ behavior: 'trample-colony', effect: '군락 훼손' })],
    target: 'marsh-colony',
    estimate: (ctx, s, row) => ({ gain: fill(ctx, 'marsh-colony', row), cost: 3, risk: 2 }),
    rationale: '목초가 모자라면 무리는 습지로 넘어가 군락을 훼손한다',
  }),
  makeStrategy({
    id: 'P-TEND-LIVESTOCK', kind: 'prey', actors: { archetypes: ['villager'] },
    atoms: [makeAtom({ behavior: 'farm', effect: '경작' }), makeAtom({ behavior: 'herd-livestock', effect: '목축' })],
    target: 'village-pasture',
    estimate: (ctx, s, row) => ({ gain: fill(ctx, 'village-pasture', row), cost: 1, risk: 0 }),
    rationale: '주민은 목장에서 식량을 얻는다',
  }),

  // ── safety ────────────────────────────────────────────────────────────────
  makeStrategy({
    id: 'P-FLEE-VILLAGE', kind: 'safety', actors: { archetypes: ['villager'] },
    atoms: [makeAtom({ behavior: 'flee-to-village', effect: '마을 안으로 대피' })],
    target: 'village-safety', interventionFamily: 'defend-pasture',
    estimate: (ctx, s, row) => ({ gain: fill(ctx, 'village-safety', row), cost: 1, risk: 0 }),
    rationale: '위험하면 주민은 마을 안으로 물러난다',
  }),
  makeStrategy({
    id: 'P-REPORT-SIGHTING', kind: 'safety', actors: { archetypes: ['villager'] },
    atoms: [makeAtom({ behavior: 'report-sighting', effect: '목격 신고' }), makeAtom({ behavior: 'spread-rumor', effect: '소문 전파' })],
    target: 'village-safety', interventionFamily: 'sell-tracking-intel',
    // 신고는 스스로 안전을 만들지 않는다 — 조합을 움직여 간접 효과를 낸다
    estimate: (ctx, s, row) => ({ gain: Math.min(1, fill(ctx, 'village-safety', row)), cost: 0, risk: 0 }),
    rationale: '주민은 직접 싸우는 대신 흔적을 알려 조합을 움직인다',
  }),
  makeStrategy({
    id: 'P-SUBJUGATION-CONTRACT', kind: 'safety', actors: { archetypes: ['hunters-guild'] },
    atoms: [makeAtom({ behavior: 'issue-subjugation-contract', effect: '토벌 계약 발급' })],
    target: 'village-safety', interventionFamily: 'subjugate',
    estimate: (ctx, s, row) => ({ gain: fill(ctx, 'village-safety', row), cost: 2, risk: 2 }),
    rationale: '조합은 토벌 계약으로 위협 자체를 제거한다',
  }),
  makeStrategy({
    id: 'P-HALT-CULL', kind: 'safety', actors: { archetypes: ['hunters-guild'] },
    atoms: [makeAtom({ behavior: 'suspend-cull-contract', effect: '조절 계약 중단 — 무리 회복' })],
    target: 'village-safety', interventionFamily: 'restore-prey-base',
    // 무리가 얇을수록 회복 여지가 크다 — 먹이터를 되살려 포식자를 마을에서 떼어놓는다
    estimate: (ctx, s, row) => {
      const herd = herdOf(ctx);
      const room = Math.max(0, supply(ctx, 'herd-valley-forage'));
      const thin = herd && herd.population.count < room ? room - herd.population.count : 0;
      return { gain: Math.min(fill(ctx, 'village-safety', row), thin), cost: 1, risk: 1 };
    },
    rationale: '무리를 회복시키면 포식 마물이 목장으로 내려올 이유가 줄어든다',
  }),
  makeStrategy({
    id: 'P-CULL-CONTRACT', kind: 'safety', actors: { archetypes: ['hunters-guild'] },
    atoms: [makeAtom({ behavior: 'issue-cull-contract', effect: '개체 조절 계약 발급' })],
    target: 'village-safety', interventionFamily: 'cull-contract',
    // 무리가 수용력을 넘길 때만 조절이 의미가 있다
    estimate: (ctx, s, row) => {
      const herd = herdOf(ctx);
      const over = herd ? Math.max(0, herd.population.count - supply(ctx, 'herd-valley-forage')) : 0;
      return { gain: Math.min(fill(ctx, 'village-safety', row), over), cost: 2, risk: 1 };
    },
    rationale: '무리가 과잉이면 조합은 조절 계약으로 생태를 관리한다',
  }),

  // ── byproduct ─────────────────────────────────────────────────────────────
  makeStrategy({
    id: 'P-MERCHANT-RESTOCK', kind: 'byproduct', actors: { archetypes: ['merchant'] },
    atoms: [makeAtom({ behavior: 'buy-byproducts', effect: '부산물 매입' })],
    target: 'market-inventory',
    estimate: (ctx, s, row) => ({ gain: fill(ctx, 'market-inventory', row), cost: 1, risk: 0 }),
    rationale: '상인은 시장 물량으로 재고를 채운다',
  }),
  makeStrategy({
    id: 'P-MERCHANT-EXPORT', kind: 'byproduct', actors: { archetypes: ['merchant'] },
    atoms: [makeAtom({ behavior: 'organize-export', effect: '외부 운송대 편성' })],
    target: 'export-route-capacity',
    estimate: (ctx, s, row) => ({ gain: fill(ctx, 'export-route-capacity', row), cost: 2, risk: 1 }),
    rationale: '상인은 남는 물량을 외부로 반출한다',
  }),
  makeStrategy({
    id: 'P-TRADER-BUY', kind: 'byproduct', actors: { roles: ['trader'] },
    atoms: [makeAtom({ behavior: 'quote-price', effect: '시세 확인' }), makeAtom({ behavior: 'buy', effect: '매입' })],
    target: 'market-inventory',
    estimate: (ctx, s, row) => ({ gain: fill(ctx, 'market-inventory', row), cost: 1, risk: 0 }),
    rationale: '거래자는 시장에서 물량을 확보한다',
  }),
  makeStrategy({
    id: 'P-TRADER-EXPORT', kind: 'byproduct', actors: { roles: ['trader'] },
    atoms: [makeAtom({ behavior: 'export', effect: '외부 반출' })],
    target: 'export-route-capacity',
    estimate: (ctx, s, row) => ({ gain: fill(ctx, 'export-route-capacity', row), cost: 2, risk: 1 }),
    rationale: '거래자는 반출로 차익을 낸다',
  }),
  makeStrategy({
    id: 'P-HUNT-APEX', kind: 'byproduct', actors: { roles: ['hunter'] },
    atoms: [
      makeAtom({ behavior: 'prepare-gear', effect: '장비·약품 준비' }), makeAtom({ behavior: 'stalk', effect: '추적' }),
      makeAtom({ behavior: 'fight', effect: '전투' }), makeAtom({ behavior: 'dress-carcass', effect: '해체' }),
    ],
    target: 'apex-byproducts', interventionFamily: 'subjugate',
    estimate: (ctx, s, row) => ({ gain: fill(ctx, 'apex-byproducts', row), cost: 3, risk: 4 }),
    rationale: '사냥꾼은 포식 마물을 잡아 부산물을 얻는다',
  }),
  makeStrategy({
    id: 'P-CAPTURE-RARE', kind: 'byproduct', actors: { roles: ['hunter'] },
    atoms: [
      makeAtom({ behavior: 'prepare-gear', effect: '포획 장비 준비' }), makeAtom({ behavior: 'stalk', effect: '추적' }),
      makeAtom({ behavior: 'capture', effect: '생포' }),
    ],
    target: 'rare-byproducts',
    estimate: (ctx, s, row) => ({ gain: fill(ctx, 'rare-byproducts', row), cost: 4, risk: 3 }),
    rationale: '희귀 개체는 생포하면 부산물 가치가 더 크다',
  }),
  makeStrategy({
    id: 'P-CRAFTER-BUY-STOCK', kind: 'byproduct', actors: { roles: ['dresser-crafter'] },
    atoms: [makeAtom({ behavior: 'appraise', effect: '품질 판별' })],
    target: 'market-inventory',
    estimate: (ctx, s, row) => ({ gain: fill(ctx, 'market-inventory', row), cost: 1, risk: 0 }),
    rationale: '제작자는 장비 재료를 시장에서 고른다',
  }),

  // ── healing ───────────────────────────────────────────────────────────────
  makeStrategy({
    id: 'P-GATHER-HERBS', kind: 'healing', actors: { roles: ['dresser-crafter'] },
    atoms: [makeAtom({ behavior: 'gather-herbs', effect: '습지 약초 채집' })],
    target: 'healing-herb', interventionFamily: 'gather-craft-supply',
    estimate: (ctx, s, row) => ({ gain: fill(ctx, 'healing-herb', row), cost: 1, risk: 1 }),
    rationale: '제작자는 약초를 직접 채집한다',
  }),
  makeStrategy({
    id: 'P-CRAFT-POTION', kind: 'healing', actors: { roles: ['dresser-crafter'] },
    atoms: [makeAtom({ behavior: 'appraise', effect: '재료 판별' }), makeAtom({ behavior: 'craft-item', effect: '치료제 제작' })],
    target: 'healing-potion', interventionFamily: 'gather-craft-supply',
    // 약초 재고가 있어야 제작이 성립한다 (자원·비용 보존)
    estimate: (ctx, s, row) => ({ gain: Math.min(fill(ctx, 'healing-potion', row), Math.floor(supply(ctx, 'healing-herb') / 2)), cost: 2, risk: 0 }),
    rationale: '약초가 있으면 치료제로 가공하는 편이 값어치가 크다',
  }),
  makeStrategy({
    id: 'P-BUY-POTIONS', kind: 'healing', actors: { archetypes: ['hunters-guild'] },
    atoms: [makeAtom({ behavior: 'buy-potions', effect: '치료제 매입' })],
    target: 'healing-potion',
    estimate: (ctx, s, row) => ({ gain: fill(ctx, 'healing-potion', row), cost: 1, risk: 0 }),
    rationale: '조합은 부상 조합원을 위해 치료제를 사들인다',
  }),
  makeStrategy({
    id: 'P-VILLAGER-SEEK-CARE', kind: 'healing', actors: { archetypes: ['villager'] },
    atoms: [makeAtom({ behavior: 'report-sighting', effect: '치료 요청' })],
    target: 'healing-potion',
    estimate: (ctx, s, row) => ({ gain: fill(ctx, 'healing-potion', row), cost: 0, risk: 0 }),
    rationale: '아픈 주민은 치료소에 요청한다',
  }),

  // ── habitat ───────────────────────────────────────────────────────────────
  makeStrategy({
    id: 'P-RELOCATE-LAIR', kind: 'habitat', actors: { archetypes: ['apex-monster'] },
    atoms: [makeAtom({ behavior: 'relocate-lair', effect: '둥지 이전' })],
    target: 'apex-lair',
    estimate: (ctx, s, row) => ({ gain: fill(ctx, 'apex-lair', row), cost: 3, risk: 1 }),
    rationale: '둥지가 훼손되면 포식 마물은 자리를 옮긴다',
  }),
  makeStrategy({
    id: 'P-COLONY-REGENERATE', kind: 'habitat', actors: { archetypes: ['resource-colony'] },
    atoms: [makeAtom({ behavior: 'regenerate', effect: '군체 재생' })],
    target: 'marsh-colony',
    estimate: (ctx, s, row) => ({ gain: fill(ctx, 'marsh-colony', row), cost: 0, risk: 0 }),
    rationale: '군락은 훼손되지 않은 만큼 스스로 회복한다',
  }),
  makeStrategy({
    id: 'P-HERD-RELOCATE', kind: 'habitat', actors: { archetypes: ['herd-beast'] },
    atoms: [makeAtom({ behavior: 'migrate', effect: '서식지를 습지 쪽으로 이동' })],
    target: 'marsh-colony',
    estimate: (ctx, s, row) => ({ gain: fill(ctx, 'marsh-colony', row), cost: 3, risk: 2 }),
    rationale: '골짜기에 여유가 없으면 무리는 서식지 자체를 습지로 옮긴다',
  }),
  makeStrategy({
    id: 'P-HERD-BREED', kind: 'habitat', actors: { archetypes: ['herd-beast'] },
    atoms: [makeAtom({ behavior: 'breed', effect: '번식' })],
    target: 'herd-valley-forage',
    estimate: (ctx, s, row) => ({ gain: fill(ctx, 'herd-valley-forage', row), cost: 1, risk: 1 }),
    rationale: '여유 목초가 있으면 무리는 번식으로 서식을 넓힌다',
  }),

  // ── reputation ────────────────────────────────────────────────────────────
  makeStrategy({
    id: 'P-SURVEY-CONTRACT', kind: 'reputation', actors: { roles: ['tracker'] },
    atoms: [
      makeAtom({ behavior: 'inspect-trace', effect: '흔적 조사' }), makeAtom({ behavior: 'survey-from-lookout', effect: '전망 관측' }),
      makeAtom({ behavior: 'update-map', effect: '지도 갱신' }), makeAtom({ behavior: 'sell-intel', effect: '정보 납품' }),
    ],
    target: 'contract-fulfillment', interventionFamily: 'sell-tracking-intel',
    estimate: (ctx, s, row) => ({ gain: fill(ctx, 'contract-fulfillment', row), cost: 1, risk: 1 }),
    rationale: '추적꾼은 조사 결과를 납품해 계약을 이행한다',
  }),
  makeStrategy({
    id: 'P-BAIT-LURE', kind: 'reputation', actors: { roles: ['hunter'] },
    atoms: [makeAtom({ behavior: 'set-bait', effect: '미끼 설치' }), makeAtom({ behavior: 'stalk', effect: '유인 경로 유도' })],
    target: 'contract-fulfillment', interventionFamily: 'lure-away-with-bait',
    // 싸우지 않고 계약을 이행한다 — 위험이 낮은 대신 비용이 든다
    estimate: (ctx, s, row) => ({ gain: fill(ctx, 'contract-fulfillment', row), cost: 2, risk: 1 }),
    rationale: '사냥꾼은 미끼로 위협을 떼어내 계약을 이행할 수도 있다',
  }),
  makeStrategy({
    id: 'P-HUNT-CONTRACT', kind: 'reputation', actors: { roles: ['hunter'] },
    atoms: [makeAtom({ behavior: 'prepare-gear', effect: '장비 준비' }), makeAtom({ behavior: 'fight', effect: '토벌' })],
    target: 'contract-fulfillment', interventionFamily: 'subjugate',
    estimate: (ctx, s, row) => ({ gain: fill(ctx, 'contract-fulfillment', row), cost: 2, risk: 4 }),
    rationale: '사냥꾼은 토벌로 계약을 이행한다',
  }),
  makeStrategy({
    id: 'P-RATE-PERFORMANCE', kind: 'reputation', actors: { archetypes: ['hunters-guild'] },
    atoms: [makeAtom({ behavior: 'rate-contract-performance', effect: '계약 이행 평가' })],
    target: 'contract-fulfillment',
    estimate: (ctx, s, row) => ({ gain: fill(ctx, 'contract-fulfillment', row), cost: 0, risk: 0 }),
    rationale: '조합은 이행 평가로 계약 질서를 유지한다',
  }),
];
