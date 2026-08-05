// C01-D-S01 (D2·D3) — 사냥터 주체의 기본 의존 그래프 생성과 대상별 공급 함수.
// 의존 6계열: prey(먹이·식량) · safety(안전) · byproduct(부산물 수요) ·
//             healing(치료) · habitat(서식지·이동로) · reputation(계약·평판)
//
// 모든 의존은 rationale(근거)을 갖는다 — Q 계층이 세계 요구를 역추적할 때 쓴다.
import { makeDependency } from './dependencyGraph.js';

const num = (v, d = 0) => (Number.isFinite(v) ? v : d);
const subjectsOf = (ctx, archetype) => Object.values(ctx.subjects).filter((s) => s.archetype === archetype);
const firstOf = (ctx, archetype) => subjectsOf(ctx, archetype)[0] ?? null;
const stock = (ctx, id) => num(ctx.state.resources?.[id]);
const place = (ctx, id) => ctx.state.region?.places?.[id] ?? {};

/** 의존 대상별 공급 함수 — 세계 상태에서 계산된다 (하드코딩된 상수는 지형 용량뿐) */
export const C01_SUPPLIES = {
  'herd-population': (ctx) => num(firstOf(ctx, 'herd-beast')?.population?.count),
  'village-pasture': (ctx) => num(place(ctx, 'village-pasture').livestock),
  'herd-valley-forage': (ctx) =>
    num(place(ctx, 'herd-valley').carryingCapacity) - num(firstOf(ctx, 'herd-beast')?.population?.count),
  'marsh-colony': (ctx) => num(firstOf(ctx, 'resource-colony')?.population?.count),
  'apex-lair': (ctx) => num(place(ctx, 'apex-lair').integrity),
  'apex-byproducts': (ctx) => (firstOf(ctx, 'apex-monster') ? num(place(ctx, 'apex-lair').byproductYield, 3) : 0),
  'rare-individual': (ctx) => num(ctx.state.region?.rareIndividuals),
  'rare-byproducts': (ctx) => num(ctx.state.region?.rareIndividuals) * 2,
  'healing-herb': (ctx) => stock(ctx, 'healing-herb'),
  'healing-potion': (ctx) => stock(ctx, 'healing-potion'),
  'market-inventory': (ctx) => stock(ctx, 'hide') + stock(ctx, 'monster-organ') + stock(ctx, 'meat'),
  'export-route-capacity': (ctx) => num(ctx.state.region?.routes?.['export-route']?.capacity),
  'village-safety': (ctx) => Math.max(0, 20 - 2 * num(place(ctx, 'hunter-outpost').threat)),
  'contract-fulfillment': (ctx) =>
    Object.values(ctx.state.contracts ?? {}).filter((c) => c.status === 'open').length,
};

/** 원형별 기본 의존 (D2) + 개별 속성에 의한 변형 (D3) */
function dependenciesForSubject(s, ctx) {
  const out = [];
  switch (s.archetype) {
    case 'villager':
      // D3: 겁이 많을수록(courage 낮음) 안전 요구가 크다
      out.push(makeDependency({ holder: s.id, kind: 'prey', targets: ['village-pasture'], demand: 2,
        rationale: '주민은 목장 가축에서 식량을 얻는다' }));
      out.push(makeDependency({ holder: s.id, kind: 'safety', targets: ['village-safety'], demand: Math.ceil((8 - num(s.attrs.courage)) / 3),
        rationale: '주민은 마을 안전에 의존하며 겁이 많을수록 요구가 크다' }));
      out.push(makeDependency({ holder: s.id, kind: 'healing', targets: ['healing-potion'], demand: num(s.attrs.health) < 7 ? 1 : 0,
        rationale: '부상·허약한 주민은 치료제를 필요로 한다' }));
      break;
    case 'hunters-guild':
      out.push(makeDependency({ holder: s.id, kind: 'safety', targets: ['village-safety'], demand: 6,
        rationale: '조합은 마을 방위를 책임진다' }));
      out.push(makeDependency({ holder: s.id, kind: 'healing', targets: ['healing-potion', 'healing-herb'], demand: num(s.injuredHunters),
        rationale: '부상 조합원 수만큼 치료제(없으면 약초)가 필요하다' }));
      out.push(makeDependency({ holder: s.id, kind: 'reputation', targets: ['rare-individual', 'contract-fulfillment'], demand: 1,
        rationale: '조합은 이행 가능한 계약(특히 희귀 개체 토벌)으로 평판을 유지한다' }));
      break;
    case 'merchant':
      // D3: 자본이 클수록 매입 요구가 크다
      out.push(makeDependency({ holder: s.id, kind: 'byproduct', targets: ['market-inventory', 'apex-byproducts'], demand: Math.ceil(num(s.attrs.capital) / 10),
        rationale: '상인은 재고를 유지해야 하며 부족하면 포식 마물 부산물로 몰린다' }));
      out.push(makeDependency({ holder: s.id, kind: 'byproduct', targets: ['export-route-capacity'], demand: 3,
        rationale: '상인은 고가 부산물을 외부로 반출한다' }));
      // 희귀 수요는 대체 경로가 없다 — 희귀 개체가 실재할 때만 요구가 생긴다
      out.push(makeDependency({ holder: s.id, kind: 'byproduct', targets: ['rare-byproducts', 'rare-individual'],
        demand: num(ctx.state.region?.rareIndividuals) > 0 ? 2 : 0,
        rationale: '희귀 개체가 나타나면 상인은 그 부산물을 원한다' }));
      break;
    case 'herd-beast': {
      const pop = num(s.population?.count);
      out.push(makeDependency({ holder: s.id, kind: 'prey', targets: ['herd-valley-forage', 'marsh-colony'], demand: Math.ceil(pop / 10),
        rationale: '무리는 골짜기 목초로 먹고, 부족하면 습지 군락으로 넘어간다' }));
      out.push(makeDependency({ holder: s.id, kind: 'habitat', targets: ['herd-valley-forage'], demand: Math.ceil(pop / 20),
        rationale: '무리는 번식·서식을 위한 여유 목초지가 필요하다' }));
      break;
    }
    case 'apex-monster':
      // D3: 부상 개체는 회복을 위해 먹이 요구가 커진다
      out.push(makeDependency({ holder: s.id, kind: 'prey', targets: ['herd-population', 'village-pasture'], demand: 4 + num(s.attrs.injury),
        rationale: '포식 마물은 무리를 먹고, 부족하면 목장 가축을 노린다' }));
      out.push(makeDependency({ holder: s.id, kind: 'habitat', targets: ['apex-lair'], demand: 1,
        rationale: '포식 마물은 온전한 둥지가 필요하다' }));
      break;
    case 'resource-colony':
      out.push(makeDependency({ holder: s.id, kind: 'habitat', targets: ['marsh-colony'], demand: num(s.population?.count),
        rationale: '군락은 훼손되지 않은 자기 군체 전량이 있어야 재생한다' }));
      break;
    case 'player':
      out.push(...dependenciesForPlayerRole(s));
      break;
    default:
      break;
  }
  return out;
}

function dependenciesForPlayerRole(s) {
  switch (s.role) {
    case 'tracker':
      return [makeDependency({ holder: s.id, kind: 'reputation', targets: ['contract-fulfillment'], demand: 1,
        rationale: '추적꾼은 조사·정보 계약으로 평판을 쌓는다' })];
    case 'hunter':
      return [
        makeDependency({ holder: s.id, kind: 'byproduct', targets: ['rare-byproducts', 'apex-byproducts'], demand: 3,
          rationale: '사냥꾼은 희귀 부산물을 우선하고 없으면 포식 마물 부산물을 취한다' }),
        makeDependency({ holder: s.id, kind: 'reputation', targets: ['rare-individual', 'contract-fulfillment'], demand: 1,
          rationale: '사냥꾼은 고액 토벌 계약으로 명성을 얻는다' }),
      ];
    case 'dresser-crafter':
      return [
        makeDependency({ holder: s.id, kind: 'healing', targets: ['healing-herb', 'marsh-colony'], demand: 3,
          rationale: '제작자는 치료제 재료로 약초가 필요하고, 부족하면 습지에서 직접 채집한다' }),
        makeDependency({ holder: s.id, kind: 'byproduct', targets: ['market-inventory'], demand: 2,
          rationale: '제작자는 장비 재료를 시장에서 산다' }),
      ];
    case 'trader':
      return [makeDependency({ holder: s.id, kind: 'byproduct', targets: ['market-inventory', 'export-route-capacity'], demand: 5,
        rationale: '거래자는 시장 물량을 확보하고 남으면 외부로 반출한다' })];
    default:
      throw new Error(`미지 플레이어 역할의 의존: ${s.role}`);
  }
}

/** 배역 전체의 의존 그래프 생성 (요구 0 인 의존은 제외 — 미소비 출력 금지) */
export function buildC01DependencyGraph(ctx) {
  const deps = [];
  for (const s of Object.values(ctx.subjects)) deps.push(...dependenciesForSubject(s, ctx));
  return deps.filter((d) => d.demand > 0);
}
