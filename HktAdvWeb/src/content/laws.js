// =====================================================================
// 콘텐츠 법칙 표 — 절편 밖 동사의 등재 (콘텐츠 단계 C2~C7)
// ---------------------------------------------------------------------
// "동사가 늘어도 법칙은 늘지 않는다"(§4.3) — 표(LawTable)를 늘릴 뿐, 상태 변경의
// 유일한 경로는 여전히 apply() 하나다. 엔진(substrate/laws.js)은 손대지 않고,
// register 로 콘텐츠 동사를 추가한다 (설계가 예고한 확장점).
//
// 여기 등재하는 동사:
//   채취(일반) — 대상의 실속성에서 재료를 분리(정밀도 함수). 절편판 채취를 일반화.
//   결합 — 보유 재료를 합쳐 산출 속성(공명출력·내한성)을 낸다 (제작).
//   비교 — 정보를 대조해 지식/정보 재료를 만든다 (인식 동사).
//   협상 — 관계(신뢰단계)를 쌓거나 속성으로 거래해 재료를 얻는다 (R5).
//   전투 — 교전을 사건으로 기록하고 전리품을 낸다 (상태 전이는 runner 가).
//   조율 — 지식+공명으로 접근권(유적의 문)을 연다 (R4).
//   정제 — 저품질 재료를 가공해 속성을 끌어올린다 (균류 단열재·활성화, R3/R6).
//   포획 — 무리에서 속성 개체(신성내성 생명체)를 선별 확보한다 (R3).
//   탐색 — 세계를 뒤져 위치 정보를 얻는다 (둥지위치·거처위치).
// 에너지 대량 문턱(잔고 ≥ 10/15/50)은 demand 의 "보유 조건"이고, 실제 소각(비용)은
// 각 법칙의 energyCost 다 — 엔진의 모델(demand=잔고 문턱, law=실비용)을 그대로 따른다.
// =====================================================================
import { Law, defaultLawTable } from '../substrate/laws.js';

function clamp01(x) { return Math.max(0, Math.min(1, x)); }

let _seq = 0; // 산출 재료 고유 id (단조 증가 — 결정론적)
function nextId(prefix) { return `${prefix}#c${++_seq}`; }

// 인벤토리에서 속성 name 의 최대값(및 그 개체)을 찾는다.
function bestBy(inventory, name) {
  let best = null;
  for (const s of inventory ?? []) {
    const v = s.properties?.[name];
    if (typeof v === 'number' && (best === null || v > best.v)) best = { s, v };
  }
  return best;
}

// ── 채취(일반) — 대상의 harvestable 속성을 정밀도로 보존해 재료로 분리한다. ──
// 절편판(신성잔향보존율 전용)을 일반화: 심장(촉매+잔향)·수정(공명+손실)·가죽(내한)·
// 축전결정(저장+내성) 등 어떤 무대의 원천이든 실제로 가진 속성만 옮긴다 (재해석, 원칙 ④).
const HARVESTABLE = ['신성잔향보존율', '생체촉매활성', '공명전달률', '에너지손실률',
  '에너지저장밀도', '신성내성', '내한성', '독성'];
export const 채취ContentLaw = new Law({
  verb: '채취',
  cond: null,
  energyCost: 1,
  effect: ({ target, params }) => {
    const 정밀도 = clamp01(params['정밀도'] ?? 0.7);
    const props = {};
    for (const name of HARVESTABLE) {
      const base = target.properties[name];
      if (base === undefined) continue;
      // 에너지손실률은 낮을수록 좋다 — 거칠수록 손실이 오른다.
      props[name] = name === '에너지손실률'
        ? clamp01(base + (1 - 정밀도) * 0.15)
        : clamp01(base * 정밀도);
    }
    if (props['신성잔향보존율'] !== undefined) props['오염도'] = clamp01(1 - 정밀도);
    return {
      adds: [{
        id: nextId('채취물'), archetype: target.archetype ?? '채취물',
        kind: '물질', tags: target.tags ?? [], properties: props,
      }],
      targetDelta: {},
    };
  },
});

// ── 결합 — 보유 재료를 합쳐 산출 속성을 낸다. params.recipe 로 무엇을 만들지 결정. ──
export const 결합Law = new Law({
  verb: '결합', cond: null, energyCost: 3,
  effect: ({ actor, params }) => {
    const recipe = params.recipe ?? '무기';
    const inv = actor.inventory ?? [];
    if (recipe === '무기' || recipe === '진동수단') {
      const t = bestBy(inv, '공명전달률')?.v ?? 0;
      const s = bestBy(inv, '에너지저장밀도')?.v ?? 0;
      // 무기: 전달률 위주 + 저장 보정. 진동수단(실험급): 전달률만.
      const 공명출력 = recipe === '무기' ? clamp01(0.8 * t + 0.2 * s) : clamp01(0.9 * t);
      return { adds: [{ id: nextId('결합체'), archetype: recipe, kind: '물질', tags: ['제작물'], properties: { 공명출력 } }], targetDelta: {} };
    }
    if (recipe === '장비') {
      const h = bestBy(inv, '내한성')?.v ?? 0;
      return { adds: [{ id: nextId('내한장비'), archetype: '내한장비', kind: '물질', tags: ['장비'], properties: { 내한성: clamp01(h) } }], targetDelta: {} };
    }
    throw new Error(`결합: 알 수 없는 recipe '${recipe}'`);
  },
});

// ── 비교 — 정보를 대조해 지식/정보 재료를 만든다 (인식 동사 가족). ──
export const 비교Law = new Law({
  verb: '비교', cond: null, energyCost: 1,
  effect: ({ params }) => {
    const 주제 = params['주제'];
    if (!주제) throw new Error('비교 법칙: params.주제 가 필요하다');
    const kind = params.kind ?? '지식';
    const spec = { id: nextId('대조물'), kind, properties: { 주제 } };
    if (kind === '지식') spec.epistemic = params.epistemic ?? '확인';
    return { adds: [spec], targetDelta: {} };
  },
});

// ── 협상 — 관계(신뢰단계)를 쌓거나 속성으로 거래한다 (R5 시장). ──
export const 협상Law = new Law({
  verb: '협상', cond: null, energyCost: 1,
  effect: ({ params }) => {
    const adds = [];
    if (params['신뢰단계'] !== undefined) {
      adds.push({ id: nextId('관계'), kind: '관계', tags: ['거래'], properties: { 신뢰단계: params['신뢰단계'] } });
    }
    // 속성 기반 거래: 품목이 아니라 "이런 속성을 가진 것"을 산다 (S-0502).
    if (params.buy) {
      adds.push({ id: nextId('매입물'), archetype: params.buy.archetype ?? '매입물', kind: params.buy.kind ?? '물질', tags: params.buy.tags ?? ['거래'], properties: { ...params.buy.properties } });
    }
    return { adds, targetDelta: {} };
  },
});

// ── 전투 — 교전을 사건으로 기록하고 전리품을 낸다. 상태 전이(수송량·둥지활성)는 runner. ──
export const 전투Law = new Law({
  verb: '전투', cond: null, energyCost: 2,
  effect: ({ params }) => ({ adds: (params.spoils ?? []).map((sp) => ({ id: nextId('전리품'), kind: sp.kind ?? '물질', tags: sp.tags ?? [], properties: { ...sp.properties } })), targetDelta: {} }),
});

// ── 조율 — 지식(고대문자)+공명 도구로 유적의 문을 연다 → 접근권 재료. ──
export const 조율Law = new Law({
  verb: '조율', cond: null, energyCost: 2,
  effect: ({ params }) => {
    const 대상 = params['대상'];
    if (!대상) throw new Error('조율 법칙: params.대상 이 필요하다');
    return { adds: [{ id: nextId('접근권'), kind: '접근권', tags: ['문'], properties: { 대상 } }], targetDelta: {} };
  },
});

// ── 정제 — 저품질 재료를 가공해 속성을 끌어올린다 (균류 단열재·활성화). ──
export const 정제Law = new Law({
  verb: '정제', cond: null, energyCost: 1,
  effect: ({ actor, params }) => {
    const 산출 = params['산출'] ?? '단열재';
    const inv = actor.inventory ?? [];
    if (산출 === '단열재') {
      // 발광균류(생체촉매활성/독성)를 압착 → 내한 단열재. 상한이 낮다(문턱 아슬).
      const base = bestBy(inv, '독성')?.s?.properties ?? {};
      const 내한성 = clamp01(0.6); // 압착 단열재 상한 (S-0302 대역)
      return { adds: [{ id: nextId('균류단열재'), archetype: '균류단열재', kind: '물질', tags: ['가공'], properties: { 내한성, 독성: clamp01((base['독성'] ?? 0) * 0.5) } }], targetDelta: {} };
    }
    if (산출 === '활성화') {
      // 배양 지식으로 발광균류의 생체촉매활성을 +0.1 끌어올린다.
      const found = bestBy(inv, '생체촉매활성');
      const v = clamp01((found?.v ?? 0) + 0.1);
      return { adds: [{ id: nextId('활성균류'), archetype: '활성균류', kind: '물질', tags: ['가공'], properties: { 생체촉매활성: v } }], targetDelta: {} };
    }
    throw new Error(`정제: 알 수 없는 산출 '${산출}'`);
  },
});

// ── 포획 — 무리에서 속성 개체(신성내성 생명체)를 선별 확보한다. ──
export const 포획Law = new Law({
  verb: '포획', cond: null, energyCost: 1,
  effect: ({ target, params }) => {
    const 신성내성 = clamp01(target?.properties?.['신성내성'] ?? params['신성내성'] ?? 0);
    return { adds: [{ id: nextId('운반생물'), archetype: '운반생물', kind: '생명체', tags: ['탈것'], properties: { 신성내성 } }], targetDelta: {} };
  },
});

// ── 탐색 — 세계를 뒤져 위치 정보를 얻는다 (둥지위치·거처위치). ──
export const 탐색Law = new Law({
  verb: '탐색', cond: null, energyCost: 1,
  effect: ({ params }) => {
    const 주제 = params['주제'];
    if (!주제) throw new Error('탐색 법칙: params.주제 가 필요하다');
    return { adds: [{ id: nextId('탐색정보'), kind: '정보', properties: { 주제 } }], targetDelta: {} };
  },
});

// 콘텐츠 법칙 표: 절편 기본(채취·관찰·실험·검증) 위에 콘텐츠 동사를 얹는다.
// 채취는 일반판으로 덮어쓴다(같은 verb → register 가 교체).
export function contentLawTable(lexicon = null) {
  const t = defaultLawTable(lexicon);
  t.register(채취ContentLaw);
  t.register(결합Law);
  t.register(비교Law);
  t.register(협상Law);
  t.register(전투Law);
  t.register(조율Law);
  t.register(정제Law);
  t.register(포획Law);
  t.register(탐색Law);
  return t;
}
